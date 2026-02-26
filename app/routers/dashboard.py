# app/routers/dashboard.py
import csv
from io import StringIO
from datetime import datetime, timedelta, time
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy.exc import ProgrammingError, OperationalError

from app.db.deps import get_db
from app.core.auth import require_roles
from app.models.user import User
from app.models.patient import Patient
from app.models.appointment import Appointment
from app.models.note import Note
from app.models.clinic_settings import ClinicSettings

# ✅ Si existe el modelo AppointmentBlock en tu proyecto, lo importamos
# (Si la TABLA no existe en DB, NO pasa nada: lo manejamos con try/except)
from app.models.appointment_block import AppointmentBlock

from app.schemas.dashboard import (
    DashboardMetrics,
    AppointmentsByDayPoint,
    UpcomingAppointmentItem,
)

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

ALLOWED_ROLES = ["admin", "psychologist", "assistant"]


# =========================
# Helpers (compatibilidad)
# =========================
def _has_column(model, col_name: str) -> bool:
    """
    ✅ Evita errores si en DB no existe cierta columna (ej. created_at).
    """
    try:
        return hasattr(model, col_name) and col_name in model.__table__.columns
    except Exception:
        return False


# =========================
# Helpers (1 psicóloga)
# =========================
def get_owner_user(db: Session) -> User:
    owner = (
        db.query(User)
        .filter(User.role == "psychologist", User.is_active == True)
        .first()
    )
    if not owner:
        raise HTTPException(
            status_code=500,
            detail="No existe usuario con rol 'psychologist'",
        )
    return owner


def get_target_user_id(db: Session, current_user: User) -> int:
    # assistant -> agenda de la psicóloga
    if current_user.role == "assistant":
        return get_owner_user(db).id
    return current_user.id


# =========================
# Clinic Settings (si existe)
# =========================
def get_settings(db: Session) -> ClinicSettings:
    """
    ✅ Si la tabla clinic_settings no existe o no está migrada aún,
    devolvemos settings default SIN crashear.
    """
    try:
        settings = db.query(ClinicSettings).first()
    except (ProgrammingError, OperationalError):
        return ClinicSettings(
            start_time=time(9, 0),
            end_time=time(17, 0),
            mon=True,
            tue=True,
            wed=True,
            thu=True,
            fri=True,
            sat=False,
            sun=False,
        )

    if not settings:
        # Crear default si la tabla existe pero está vacía
        settings = ClinicSettings(
            start_time=time(9, 0),
            end_time=time(17, 0),
            mon=True,
            tue=True,
            wed=True,
            thu=True,
            fri=True,
            sat=False,
            sun=False,
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)

    return settings


def _day_enabled(settings: ClinicSettings, weekday: int) -> bool:
    # weekday: 0=lun ... 6=dom
    return {
        0: settings.mon,
        1: settings.tue,
        2: settings.wed,
        3: settings.thu,
        4: settings.fri,
        5: settings.sat,
        6: settings.sun,
    }.get(weekday, False)


def _clamp_range(a_start: datetime, a_end: datetime, b_start: datetime, b_end: datetime) -> int:
    """
    Devuelve minutos de intersección entre [a_start, a_end] y [b_start, b_end]
    """
    start = max(a_start, b_start)
    end = min(a_end, b_end)
    if end <= start:
        return 0
    return int((end - start).total_seconds() // 60)


def _calc_available_minutes(db: Session, target_user_id: int, start_dt: datetime, end_dt: datetime) -> int:
    """
    Minutos disponibles = (horario habilitado por día) - (bloqueos)
    ✅ NO truena si la tabla appointment_blocks no existe (bloqueos = 0)
    """
    settings = get_settings(db)

    total = 0
    cursor = datetime(start_dt.year, start_dt.month, start_dt.day, 0, 0, 0)

    while cursor < end_dt:
        day_start = datetime(cursor.year, cursor.month, cursor.day, 0, 0, 0)
        day_end = day_start + timedelta(days=1)

        if _day_enabled(settings, day_start.weekday()):
            # ventana clínica del día
            open_dt = datetime.combine(day_start.date(), settings.start_time)
            close_dt = datetime.combine(day_start.date(), settings.end_time)

            # recortar a rango solicitado
            window_start = max(open_dt, start_dt)
            window_end = min(close_dt, end_dt)

            if window_end > window_start:
                minutes_today = int((window_end - window_start).total_seconds() // 60)

                # ✅ restar bloqueos si existen, si no, se asume 0
                try:
                    blocks = (
                        db.query(AppointmentBlock)
                        .filter(
                            AppointmentBlock.is_active == True,
                            AppointmentBlock.user_id == target_user_id,
                            AppointmentBlock.start_time < window_end,
                            AppointmentBlock.end_time > window_start,
                        )
                        .all()
                    )
                except (ProgrammingError, OperationalError):
                    blocks = []

                blocked = 0
                for b in blocks:
                    blocked += _clamp_range(window_start, window_end, b.start_time, b.end_time)

                total += max(0, minutes_today - blocked)

        cursor = day_end

    return total


# =========================
# ENDPOINTS
# =========================
@router.get("/metrics", response_model=DashboardMetrics)
def get_metrics(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(ALLOWED_ROLES)),
    date_from: Optional[str] = None,  # YYYY-MM-DD
    date_to: Optional[str] = None,     # YYYY-MM-DD
    days: Optional[int] = None,        # ✅ NUEVO (7/14/30) hacia adelante
):
    """
    ✅ Métricas para dashboard.

    - Si envías date_from/date_to => usa ese rango
    - Si envías days => usa [ahora, ahora+days]
    - Si no envías nada => se mantiene el comportamiento actual (últimos 7 días hacia atrás)
    """
    target_user_id = get_target_user_id(db, current_user)

    # 1) Rango
    if date_from and date_to:
        try:
            start_dt = datetime.fromisoformat(date_from + "T00:00:00")
            end_dt = datetime.fromisoformat(date_to + "T23:59:59")
        except ValueError:
            raise HTTPException(status_code=400, detail="Fechas inválidas. Usa YYYY-MM-DD")

    elif days is not None:
        if days <= 0 or days > 90:
            raise HTTPException(status_code=400, detail="days debe estar entre 1 y 90")
        start_dt = datetime.utcnow()
        end_dt = start_dt + timedelta(days=days)

    else:
        # ✅ Compatibilidad: tu comportamiento actual (pasado)
        end_dt = datetime.utcnow()
        start_dt = end_dt - timedelta(days=7)
        
    # 2) Pacientes activos
    total_patients_active = (
        db.query(Patient)
        .filter(Patient.is_active == True, Patient.user_id == target_user_id)
        .count()
    )

    # ✅ Si Patient.created_at no existe, se evita el filtro y se devuelve 0
    if _has_column(Patient, "created_at"):
        new_patients_in_range = (
            db.query(Patient)
            .filter(
                Patient.is_active == True,
                Patient.user_id == target_user_id,
                Patient.created_at >= start_dt,
                Patient.created_at <= end_dt,
            )
            .count()
        )
    else:
        new_patients_in_range = 0

    # 3) Citas
    appt_q = (
        db.query(Appointment)
        .filter(
            Appointment.is_active == True,
            Appointment.user_id == target_user_id,
            Appointment.start_time >= start_dt,
            Appointment.start_time <= end_dt,
        )
    )

    total_appointments_in_range = appt_q.count()
    scheduled_appointments_in_range = appt_q.filter(Appointment.status == "scheduled").count()
    cancelled_appointments_in_range = appt_q.filter(Appointment.status == "cancelled").count()

    # 4) Notes
    notes_q = (
        db.query(Note)
        .filter(Note.is_active == True, Note.user_id == target_user_id)
    )

    # ✅ Solo filtra created_at si existe
    if _has_column(Note, "created_at"):
        notes_q = notes_q.filter(Note.created_at >= start_dt, Note.created_at <= end_dt)

    total_notes_in_range = notes_q.count()

    # 5) Booked minutes
    appts = appt_q.all()
    booked_minutes_in_range = 0
    for a in appts:
        booked_minutes_in_range += int(a.duration_minutes or 0)

    # 6) Available minutes (horario - blocks)
    available_minutes_in_range = _calc_available_minutes(db, target_user_id, start_dt, end_dt)

    utilization_percent = 0.0
    if available_minutes_in_range > 0:
        utilization_percent = round((booked_minutes_in_range / available_minutes_in_range) * 100, 2)

    return DashboardMetrics(
        total_patients_active=total_patients_active,
        new_patients_in_range=new_patients_in_range,
        total_appointments_in_range=total_appointments_in_range,
        scheduled_appointments_in_range=scheduled_appointments_in_range,
        cancelled_appointments_in_range=cancelled_appointments_in_range,
        total_notes_in_range=total_notes_in_range,
        booked_minutes_in_range=booked_minutes_in_range,
        available_minutes_in_range=available_minutes_in_range,
        utilization_percent=utilization_percent,
    )


@router.get("/appointments-by-day", response_model=List[AppointmentsByDayPoint])
def appointments_by_day(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(ALLOWED_ROLES)),
    date_from: Optional[str] = None,  # YYYY-MM-DD
    date_to: Optional[str] = None,     # YYYY-MM-DD
):
    """
    ✅ Devuelve conteo de citas por día para gráficas.
    Si NO mandas fechas: últimos 14 días.
    """
    target_user_id = get_target_user_id(db, current_user)

    # 1) Rango
    if not date_from and not date_to:
        end_dt = datetime.utcnow()
        start_dt = end_dt - timedelta(days=14)
    else:
        if not date_from or not date_to:
            raise HTTPException(status_code=400, detail="Envía date_from y date_to juntos (YYYY-MM-DD)")
        try:
            start_dt = datetime.fromisoformat(date_from + "T00:00:00")
            end_dt = datetime.fromisoformat(date_to + "T23:59:59")
        except ValueError:
            raise HTTPException(status_code=400, detail="Fechas inválidas. Usa YYYY-MM-DD")

    # 2) Traer citas del rango
    appts = (
        db.query(Appointment)
        .filter(
            Appointment.is_active == True,
            Appointment.user_id == target_user_id,
            Appointment.start_time >= start_dt,
            Appointment.start_time <= end_dt,
        )
        .all()
    )

    # 3) Agrupar por fecha
    bucket = {}
    for a in appts:
        day = a.start_time.date().isoformat()
        if day not in bucket:
            bucket[day] = {"total": 0, "scheduled": 0, "cancelled": 0}

        bucket[day]["total"] += 1
        if (a.status or "").lower() == "cancelled":
            bucket[day]["cancelled"] += 1
        else:
            bucket[day]["scheduled"] += 1

    # 4) Rellenar días sin citas
    out: List[AppointmentsByDayPoint] = []
    cursor = datetime(start_dt.year, start_dt.month, start_dt.day, 0, 0, 0)
    end_cursor = datetime(end_dt.year, end_dt.month, end_dt.day, 0, 0, 0)

    while cursor <= end_cursor:
        day = cursor.date().isoformat()
        data = bucket.get(day, {"total": 0, "scheduled": 0, "cancelled": 0})
        out.append(
            AppointmentsByDayPoint(
                date=day,
                total=data["total"],
                scheduled=data["scheduled"],
                cancelled=data["cancelled"],
            )
        )
        cursor += timedelta(days=1)

    return out


@router.get("/upcoming", response_model=List[UpcomingAppointmentItem])
def upcoming_appointments(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(ALLOWED_ROLES)),
    days: int = 7,
    limit: int = 20,
):
    """
    ✅ Citas próximas desde 'ahora' (UTC) en los siguientes X días.
    ✅ Ahora incluye patient_name para que el Dashboard muestre el nombre.
    """
    if days <= 0 or days > 90:
        raise HTTPException(status_code=400, detail="days debe estar entre 1 y 90")
    if limit <= 0 or limit > 200:
        raise HTTPException(status_code=400, detail="limit debe estar entre 1 y 200")

    target_user_id = get_target_user_id(db, current_user)

    now = datetime.utcnow()
    end_dt = now + timedelta(days=days)

    # ✅ Traemos citas + nombre del paciente con JOIN
    rows = (
        db.query(Appointment, Patient.full_name)
        .join(Patient, Patient.id == Appointment.patient_id)
        .filter(
            Appointment.is_active == True,
            Appointment.user_id == target_user_id,
            Appointment.start_time >= now,
            Appointment.start_time <= end_dt,
        )
        .order_by(Appointment.start_time.asc())
        .limit(limit)
        .all()
    )

    out: List[UpcomingAppointmentItem] = []
    for a, patient_full_name in rows:
        out.append(
            UpcomingAppointmentItem(
                id=a.id,
                patient_id=a.patient_id,
                user_id=a.user_id,
                patient_name=patient_full_name,  # ✅ AQUÍ VA LA MAGIA
                start_time=a.start_time.isoformat(),
                duration_minutes=int(a.duration_minutes or 0),
                status=a.status,
            )
        )

    return out


@router.get("/metrics/export.csv")
def export_metrics_csv(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(ALLOWED_ROLES)),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
):
    # Reusa tu función actual llamando directamente
    data = get_metrics(db=db, current_user=current_user, date_from=date_from, date_to=date_to)

    def generate():
        buffer = StringIO()
        writer = csv.writer(buffer)
        writer.writerow(["metric", "value"])
        writer.writerow(["total_patients_active", data.total_patients_active])
        writer.writerow(["new_patients_in_range", data.new_patients_in_range])
        writer.writerow(["total_appointments_in_range", data.total_appointments_in_range])
        writer.writerow(["scheduled_appointments_in_range", data.scheduled_appointments_in_range])
        writer.writerow(["cancelled_appointments_in_range", data.cancelled_appointments_in_range])
        writer.writerow(["total_notes_in_range", data.total_notes_in_range])
        writer.writerow(["booked_minutes_in_range", data.booked_minutes_in_range])
        writer.writerow(["available_minutes_in_range", data.available_minutes_in_range])
        writer.writerow(["utilization_percent", data.utilization_percent])
        yield buffer.getvalue()

    return StreamingResponse(
        generate(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=dashboard_metrics.csv"},
    )