from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta, time, timezone

from app.core.permissions import (
    ensure_can_edit_appointment,
    ensure_can_cancel_appointment,
    ensure_can_mark_no_show,
    ensure_can_complete_appointment
)

from app.db.deps import get_db
from app.models.appointment import Appointment
from app.models.patient import Patient
from app.core.auth import get_current_user, require_roles
from app.models.user import User
from app.schemas.appointment import AppointmentCreate, AppointmentResponse, AppointmentUpdate
from app.models.clinic_settings import ClinicSettings

# (si lo estás usando)
from app.models.appointment_block import AppointmentBlock

router = APIRouter(
    prefix="/appointments",
    tags=["Appointments"]
)

ALLOWED_ROLES = ["admin", "psychologist", "assistant"]


# =========================
# ✅ Helper: convertir Appointment -> AppointmentResponse con patient_name
# =========================
def _appointment_to_response(appt: Appointment, patient_name: Optional[str] = None) -> dict:
    """
    Convierte un Appointment ORM a dict compatible con AppointmentResponse,
    agregando patient_name sin modificar el modelo.
    """
    return {
        "id": appt.id,
        "patient_id": appt.patient_id,
        "user_id": appt.user_id,
        "start_time": appt.start_time,
        "duration_minutes": appt.duration_minutes,
        "status": appt.status,
        "notes": appt.notes,
        "patient_name": patient_name,

        "is_active": appt.is_active,
        "created_at": appt.created_at,
        "updated_at": appt.updated_at,
        "created_by": appt.created_by,
        "updated_by": appt.updated_by,
    }


# =========================
# Clinic Settings (Opción A)
# =========================
def get_settings(db: Session) -> ClinicSettings:
    """
    Obtiene la configuración de la clínica (un solo registro).
    Si no existe, la crea con defaults:
    L–D 09:00–21:00
    """
    settings = db.query(ClinicSettings).first()
    if not settings:
        settings = ClinicSettings(
            start_time=time(9, 0),
            end_time=time(21, 0),
            mon=True, tue=True, wed=True, thu=True, fri=True, sat=True, sun=True
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


def _as_utc_aware(dt: datetime) -> datetime:
    """
    Convierte cualquier datetime a UTC-aware.
    - Si viene naive (sin tz), asumimos que ya está en UTC (porque backend trabaja en UTC).
    - Si viene aware, lo convertimos a UTC.
    """
    if dt is None:
        return dt
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

def _normalize_status_param(status: Optional[str]) -> Optional[str]:
    """
    Normaliza status recibido por query param.
    Acepta: no-show, noshow, no_show.
    """
    if not status:
        return None
    s = status.strip().lower()

    if s in ["no-show", "noshow", "no_show"]:
        return "no_show"

    return s

def _validate_no_past(start_dt: datetime):
    # Si viene sin timezone, asumimos UTC para evitar crash
    if start_dt.tzinfo is None:
        start_dt = start_dt.replace(tzinfo=timezone.utc)

    now_utc = datetime.now(timezone.utc)

    # Comparamos todo en UTC (aware vs aware)
    if start_dt.astimezone(timezone.utc) < now_utc:
        raise HTTPException(status_code=400, detail="La cita no puede estar en el pasado")


def validate_within_working_hours(db: Session, start_dt: datetime, duration_minutes: int):
    """
    Valida:
    - Día habilitado (mon..sun)
    - Hora dentro del rango settings.start_time .. settings.end_time
    - La cita NO cruza al día siguiente
    """
    if duration_minutes is None or duration_minutes <= 0:
        raise HTTPException(status_code=400, detail="duration_minutes debe ser mayor a 0")

    settings = get_settings(db)

    weekday = start_dt.weekday()  # 0=lun ... 6=dom
    day_enabled = {
        0: settings.mon,
        1: settings.tue,
        2: settings.wed,
        3: settings.thu,
        4: settings.fri,
        5: settings.sat,
        6: settings.sun
    }.get(weekday, False)

    if not day_enabled:
        raise HTTPException(status_code=400, detail="Ese día no está habilitado para citas")

    end_dt = start_dt + timedelta(minutes=duration_minutes)

    # No permitir cruzar al día siguiente
    if end_dt.date() != start_dt.date():
        raise HTTPException(status_code=400, detail="La cita no puede cruzar al día siguiente (fuera de horario)")

    start_t = start_dt.time()
    end_t = end_dt.time()

    # Debe iniciar dentro del horario
    if start_t < settings.start_time or start_t >= settings.end_time:
        raise HTTPException(
            status_code=400,
            detail=f"La cita debe iniciar dentro del horario permitido ({settings.start_time}–{settings.end_time})"
        )

    # Debe terminar dentro del horario (permitimos terminar EXACTAMENTE a end_time)
    if end_t > settings.end_time or end_t <= settings.start_time:
        raise HTTPException(
            status_code=400,
            detail=f"La cita debe terminar dentro del horario permitido ({settings.start_time}–{settings.end_time})"
        )


# =========================
# Helpers: 1 psicóloga
# =========================
def _ensure_not_cancelled(appt: Appointment):
    if appt.status == "cancelled" or appt.is_active is False:
        raise HTTPException(status_code=400, detail="No puedes operar una cita cancelada")


def _ensure_not_completed(appt: Appointment):
    if appt.status == "completed":
        raise HTTPException(status_code=400, detail="No puedes modificar una cita completada")


def _ensure_not_no_show(appt: Appointment):
    if appt.status == "no_show":
        raise HTTPException(status_code=400, detail="No puedes modificar una cita marcada como no-show")


def get_owner_user(db: Session) -> User:
    """
    Obtiene automáticamente a la psicóloga (role='psychologist').
    Este sistema asume UNA sola psicóloga.
    """
    owner = db.query(User).filter(
        User.role == "psychologist",
        User.is_active == True
    ).first()

    if not owner:
        raise HTTPException(status_code=500, detail="No existe usuario con rol 'psychologist'")

    return owner


def get_target_user_id(db: Session, current_user: User) -> int:
    """
    Define a quién pertenece la agenda:
    - psychologist: su propia agenda
    - assistant: agenda de la psicóloga
    - admin: su propia agenda por default (admin puede ver todo en list)
    """
    if current_user.role == "assistant":
        return get_owner_user(db).id
    return current_user.id


def _patient_access_query(db: Session, current_user: User, patient_id: int):
    """
    Reglas de acceso al paciente:
    - admin: cualquiera activo
    - psychologist: solo sus pacientes
    - assistant: pacientes de la psicóloga (owner) Y también los que el assistant haya creado,
                para evitar el 404 cuando el assistant registró el paciente.
    """
    base = db.query(Patient).filter(
        Patient.id == patient_id,
        Patient.is_active == True
    )

    if current_user.role == "admin":
        return base

    if current_user.role == "assistant":
        owner_id = get_owner_user(db).id
        return base.filter(Patient.user_id.in_([owner_id, current_user.id]))

    # psychologist
    return base.filter(Patient.user_id == current_user.id)


def _validate_overlap(
    db: Session,
    target_user_id: int,
    new_start: datetime,
    new_end: datetime,
    exclude_id: Optional[int] = None
):
    """
    ✅ Valida traslape contra agenda objetivo (user_id = target_user_id)
    Normaliza todo a UTC-aware para evitar:
    TypeError: can't compare offset-naive and offset-aware datetimes
    """
    new_start_utc = _as_utc_aware(new_start)
    new_end_utc = _as_utc_aware(new_end)

    q = db.query(Appointment).filter(
        Appointment.is_active == True,
        Appointment.user_id == target_user_id
    )
    if exclude_id is not None:
        q = q.filter(Appointment.id != exclude_id)

    existing = q.all()

    for ap in existing:
        ap_start_utc = _as_utc_aware(ap.start_time)
        ap_end_utc = _as_utc_aware(ap.start_time + timedelta(minutes=ap.duration_minutes or 0))

        overlap = (new_start_utc < ap_end_utc) and (ap_start_utc < new_end_utc)
        if overlap:
            raise HTTPException(status_code=400, detail="Ya existe una cita con ese horario")

def _validate_patient_no_double_booking(
    db: Session,
    target_user_id: int,
    patient_id: int,
    new_start: datetime,
    exclude_id: Optional[int] = None
):
    """
    Regla A:
    Un paciente NO puede tener otra cita 'scheduled' futura en la misma agenda (user_id = target_user_id).
    """
    q = db.query(Appointment).filter(
        Appointment.is_active == True,
        Appointment.user_id == target_user_id,
        Appointment.patient_id == patient_id,
        Appointment.status == "scheduled",
        Appointment.start_time >= datetime.utcnow()
    )

    if exclude_id is not None:
        q = q.filter(Appointment.id != exclude_id)

    existing = q.first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Este paciente ya tiene una cita agendada (cita #{existing.id} el {existing.start_time})."
        )
# ✅ Bloqueos (AppointmentBlock) - Evitar agendar dentro de rangos bloqueados
def _validate_not_blocked(
    db: Session,
    target_user_id: int,
    start_dt: datetime,
    duration_minutes: int
):
    """
    Valida que NO exista un bloqueo activo que traslape con el rango:
    [start_dt, end_dt)

    Usa UTC-aware para evitar errores naive/aware.
    """
    if duration_minutes is None or duration_minutes <= 0:
        raise HTTPException(status_code=400, detail="duration_minutes debe ser mayor a 0")

    end_dt = start_dt + timedelta(minutes=duration_minutes)

    start_utc = _as_utc_aware(start_dt)
    end_utc = _as_utc_aware(end_dt)

    # Traemos bloqueos activos de esa agenda (user_id = target_user_id)
    blocks = db.query(AppointmentBlock).filter(
        AppointmentBlock.is_active == True,
        AppointmentBlock.user_id == target_user_id
    ).all()

    for b in blocks:
        b_start = _as_utc_aware(b.start_time)
        b_end = _as_utc_aware(b.end_time)

        overlap = (start_utc < b_end) and (b_start < end_utc)
        if overlap:
            raise HTTPException(
                status_code=400,
                detail="Horario bloqueado. No se pueden agendar citas en ese rango."
            )


# =========================
# Endpoints
# =========================
@router.post("/", response_model=AppointmentResponse)
def create_appointment(
    data: AppointmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(ALLOWED_ROLES))
):
    # 1) no pasado
    _validate_no_past(data.start_time)

    # 2) horario clínica
    validate_within_working_hours(db, data.start_time, data.duration_minutes)

    # 3) paciente existe y accesible
    patient = _patient_access_query(db, current_user, data.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado o sin acceso")

    # 4) agenda objetivo (assistant -> psicóloga)
    target_user_id = get_target_user_id(db, current_user)

    # ✅ 4.1) Validar que NO esté bloqueado (a nivel agenda objetivo)
    _validate_not_blocked(db, target_user_id, data.start_time, data.duration_minutes)
    # ✅ 5) traslape (CREATE: aquí NO existe appt, se valida contra target_user_id)
    new_start = data.start_time
    new_duration = data.duration_minutes
    new_end = new_start + timedelta(minutes=new_duration)
    
    _validate_patient_no_double_booking(
       db,
       target_user_id=target_user_id,
       patient_id=data.patient_id,
       new_start=data.start_time
)
    _validate_overlap(db, target_user_id, new_start, new_end)

    # 6) crear
    appt = Appointment(
        patient_id=data.patient_id,
        user_id=target_user_id,
        start_time=data.start_time,
        duration_minutes=data.duration_minutes,
        status=data.status,
        notes=data.notes,
        created_by=current_user.id
    )

    db.add(appt)
    db.commit()
    db.refresh(appt)

    # ✅ devolver con patient_name
    return _appointment_to_response(appt, patient_name=getattr(patient, "full_name", None))

@router.get("/", response_model=List[AppointmentResponse])
def list_appointments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),

    # ✅ filtros
    status: Optional[str] = None,
    patient_id: Optional[int] = None,

    # ✅ rango fechas
    date_from: Optional[str] = None,
    date_to: Optional[str] = None
):
    # ✅ Normalizar status (acepta no-show / noshow)
    status_norm = _normalize_status_param(status)

    # ✅ Regla:
    # - Por defecto: solo is_active=True
    # - Si filtras status=cancelled: permitimos incluir canceladas aunque is_active=False
    query = db.query(Appointment)

    if status_norm != "cancelled":
        query = query.filter(Appointment.is_active == True)
        query = query.filter(Appointment.patient.has(Patient.is_active == True))

    # ✅ Admin ve todo, otros por agenda objetivo
    if current_user.role != "admin":
        target_user_id = get_target_user_id(db, current_user)
        query = query.filter(Appointment.user_id == target_user_id)

    # ✅ filtro por status
    if status_norm:
        allowed = {"scheduled", "completed", "cancelled", "no_show"}
        if status_norm not in allowed:
            raise HTTPException(
                status_code=400,
                detail=f"status inválido. Usa: {', '.join(sorted(allowed))}"
            )
        query = query.filter(Appointment.status == status_norm)

    # ✅ filtro por paciente
    if patient_id is not None:
        query = query.filter(Appointment.patient_id == patient_id)

    # ✅ filtro por rango de fechas
    if date_from:
        try:
            start = datetime.fromisoformat(date_from + "T00:00:00")
        except ValueError:
            raise HTTPException(status_code=400, detail="date_from inválido. Usa YYYY-MM-DD")
        query = query.filter(Appointment.start_time >= start)

    if date_to:
        try:
            end = datetime.fromisoformat(date_to + "T23:59:59")
        except ValueError:
            raise HTTPException(status_code=400, detail="date_to inválido. Usa YYYY-MM-DD")
        query = query.filter(Appointment.start_time <= end)

    # ✅ join para nombre del paciente
    # (opcional) agregamos Patient.is_active==True para no “revivir” pacientes desactivados
    query = query.outerjoin(
        Patient,
        (Patient.id == Appointment.patient_id) & (Patient.is_active == True)
    ).add_columns(Patient.full_name)

    rows = query.order_by(Appointment.start_time.asc()).all()

    result = []
    for appt, full_name in rows:
        result.append(_appointment_to_response(appt, patient_name=full_name))
    return result

@router.get("/availability", operation_id="get_appointments_availability")
def get_availability(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    date_from: str = None,
    date_to: str = None,
    slot_minutes: int = 30,
    duration_minutes: int = 60
):
    """
    Devuelve slots disponibles según:
    - ClinicSettings (días habilitados + horario)
    - Agenda objetivo (assistant -> agenda de la psicóloga)
    - Traslapes con citas existentes
    """
    if not date_from or not date_to:
        raise HTTPException(status_code=400, detail="Debes enviar date_from y date_to (YYYY-MM-DD)")

    try:
        d_from = datetime.fromisoformat(date_from + "T00:00:00").date()
        d_to = datetime.fromisoformat(date_to + "T00:00:00").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato inválido. Usa YYYY-MM-DD")

    if d_to < d_from:
        raise HTTPException(status_code=400, detail="date_to debe ser >= date_from")

    if slot_minutes <= 0:
        raise HTTPException(status_code=400, detail="slot_minutes debe ser > 0")

    if duration_minutes <= 0:
        raise HTTPException(status_code=400, detail="duration_minutes debe ser > 0")

    target_user_id = get_target_user_id(db, current_user)
    settings = get_settings(db)

    range_start_dt = datetime.combine(d_from, time(0, 0))
    range_end_dt = datetime.combine(d_to, time(23, 59, 59))

    appts = db.query(Appointment).filter(
        Appointment.is_active == True,
        Appointment.user_id == target_user_id,
        Appointment.start_time >= range_start_dt,
        Appointment.start_time <= range_end_dt,
        Appointment.status.in_(["scheduled"])
    ).all()

    appt_ranges = []
    for ap in appts:
        ap_start = ap.start_time
        ap_end = ap.start_time + timedelta(minutes=ap.duration_minutes)
        appt_ranges.append((ap_start, ap_end))

    day_enabled_map = {
        0: settings.mon,
        1: settings.tue,
        2: settings.wed,
        3: settings.thu,
        4: settings.fri,
        5: settings.sat,
        6: settings.sun
    }

    days_output = []
    cur = d_from

    while cur <= d_to:
        weekday = cur.weekday()
        if not day_enabled_map.get(weekday, False):
            days_output.append({"date": cur.isoformat(), "slots": []})
            cur = cur + timedelta(days=1)
            continue

        day_slots = []
        day_start_dt = datetime.combine(cur, settings.start_time)
        day_end_dt = datetime.combine(cur, settings.end_time)

        last_start = day_end_dt - timedelta(minutes=duration_minutes)

        t = day_start_dt
        while t <= last_start:
            candidate_start = t
            candidate_end = t + timedelta(minutes=duration_minutes)

            if candidate_start < datetime.utcnow():
                t += timedelta(minutes=slot_minutes)
                continue

            conflict = False
            for (ap_start, ap_end) in appt_ranges:
                if (candidate_start < ap_end) and (ap_start < candidate_end):
                    conflict = True
                    break

            if not conflict:
                day_slots.append(candidate_start.time().strftime("%H:%M"))

            t += timedelta(minutes=slot_minutes)

        days_output.append({"date": cur.isoformat(), "slots": day_slots})
        cur = cur + timedelta(days=1)

    return {
        "agenda_user_id": target_user_id,
        "date_from": d_from.isoformat(),
        "date_to": d_to.isoformat(),
        "slot_minutes": slot_minutes,
        "duration_minutes": duration_minutes,
        "working_hours": {
            "start_time": settings.start_time.strftime("%H:%M"),
            "end_time": settings.end_time.strftime("%H:%M"),
            "days_enabled": {
                "mon": settings.mon, "tue": settings.tue, "wed": settings.wed, "thu": settings.thu,
                "fri": settings.fri, "sat": settings.sat, "sun": settings.sun
            }
        },
        "days": days_output
    }


@router.get("/{appointment_id}", response_model=AppointmentResponse)
def get_appointment(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Appointment).filter(
        Appointment.id == appointment_id,
        Appointment.is_active == True
    )

    if current_user.role != "admin":
        target_user_id = get_target_user_id(db, current_user)
        query = query.filter(Appointment.user_id == target_user_id)

    appt = query.first()
    if not appt:
        raise HTTPException(status_code=404, detail="Cita no encontrada")

    patient = db.query(Patient).filter(Patient.id == appt.patient_id).first()
    patient_name = getattr(patient, "full_name", None) if patient else None

    return _appointment_to_response(appt, patient_name=patient_name)


@router.put("/{appointment_id}", response_model=AppointmentResponse)
def update_appointment(
    appointment_id: int,
    data: AppointmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(ALLOWED_ROLES))
):
    query = db.query(Appointment).filter(
        Appointment.id == appointment_id,
        Appointment.is_active == True
    )

    if current_user.role != "admin":
        target_user_id = get_target_user_id(db, current_user)
        query = query.filter(Appointment.user_id == target_user_id)

    appt = query.first()
    if not appt:
        raise HTTPException(status_code=404, detail="Cita no encontrada")

    if appt.status in ["completed", "no_show"]:
        raise HTTPException(
            status_code=400,
            detail=f"No puedes modificar una cita en estado '{appt.status}'"
        )

    if appt.status == "cancelled":
        raise HTTPException(status_code=400, detail="No puedes modificar una cita cancelada")

    if data.status in ["completed", "no_show"]:
        raise HTTPException(
            status_code=400,
            detail="Para marcar 'completed' o 'no_show' usa el endpoint correspondiente"
        )

    ensure_can_edit_appointment(current_user, appt)

    new_start = data.start_time if data.start_time is not None else appt.start_time
    new_duration = data.duration_minutes if data.duration_minutes is not None else appt.duration_minutes
    new_end = new_start + timedelta(minutes=new_duration)

    if data.start_time is not None:
        _validate_no_past(new_start)

    validate_within_working_hours(db, new_start, new_duration)
    _validate_overlap(db, appt.user_id, new_start, new_end, exclude_id=appt.id)
    
    for field, value in data.dict(exclude_unset=True).items():
        setattr(appt, field, value)

    appt.updated_by = current_user.id
    appt.updated_at = datetime.utcnow()
    _validate_patient_no_double_booking(
    db,
    target_user_id=appt.user_id,
    patient_id=appt.patient_id,
    new_start=new_start,
    exclude_id=appt.id
)


    db.commit()
    db.refresh(appt)

    patient = db.query(Patient).filter(Patient.id == appt.patient_id).first()
    patient_name = getattr(patient, "full_name", None) if patient else None

    return _appointment_to_response(appt, patient_name=patient_name)


@router.delete("/{appointment_id}")
def cancel_appointment(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(ALLOWED_ROLES))
):
    query = db.query(Appointment).filter(
        Appointment.id == appointment_id,
        Appointment.is_active == True
    )

    if current_user.role != "admin":
        target_user_id = get_target_user_id(db, current_user)
        query = query.filter(Appointment.user_id == target_user_id)

    appt = query.first()
    if not appt:
        raise HTTPException(status_code=404, detail="Cita no encontrada")

    # ✅ (ARREGLADO) antes estaba mal indentado
    ensure_can_cancel_appointment(current_user, appt)

    appt.is_active = False
    appt.status = "cancelled"
    appt.updated_by = current_user.id
    appt.updated_at = datetime.utcnow()

    db.commit()
    return {"message": "Cita cancelada/desactivada correctamente"}


@router.put("/{appointment_id}/no-show", response_model=AppointmentResponse)
def mark_no_show(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(ALLOWED_ROLES))
):
    query = db.query(Appointment).filter(
        Appointment.id == appointment_id,
        Appointment.is_active == True
    )

    if current_user.role != "admin":
        target_user_id = get_target_user_id(db, current_user)
        query = query.filter(Appointment.user_id == target_user_id)

    appt = query.first()
    if not appt:
        raise HTTPException(status_code=404, detail="Cita no encontrada o sin acceso")

    ensure_can_mark_no_show(current_user, appt)

    if appt.status != "scheduled":
        raise HTTPException(
            status_code=400,
            detail=f"No puedes marcar no-show porque la cita está en estado '{appt.status}'"
        )

    now = datetime.utcnow()
    if appt.start_time > now:
        raise HTTPException(
            status_code=400,
            detail="No puedes marcar no-show: la cita aún no ha ocurrido (start_time está en el futuro)"
        )

    appt.status = "no_show"
    appt.updated_by = current_user.id
    appt.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(appt)

    patient = db.query(Patient).filter(Patient.id == appt.patient_id).first()
    patient_name = getattr(patient, "full_name", None) if patient else None

    return _appointment_to_response(appt, patient_name=patient_name)


@router.put("/{appointment_id}/complete", response_model=AppointmentResponse)
def complete_appointment(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(ALLOWED_ROLES))
):
    """
    ✅ Marca una cita como COMPLETADA.
    """
    query = db.query(Appointment).filter(
        Appointment.id == appointment_id,
        Appointment.is_active == True
    )

    if current_user.role != "admin":
        target_user_id = get_target_user_id(db, current_user)
        query = query.filter(Appointment.user_id == target_user_id)

    appt = query.first()
    if not appt:
        raise HTTPException(status_code=404, detail="Cita no encontrada o sin acceso")

    ensure_can_complete_appointment(current_user, appt)

    if appt.status == "cancelled":
        raise HTTPException(status_code=400, detail="No puedes completar una cita cancelada")

    appt.status = "completed"
    appt.updated_by = current_user.id
    appt.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(appt)

    patient = db.query(Patient).filter(Patient.id == appt.patient_id).first()
    patient_name = getattr(patient, "full_name", None) if patient else None

    return _appointment_to_response(appt, patient_name=patient_name)