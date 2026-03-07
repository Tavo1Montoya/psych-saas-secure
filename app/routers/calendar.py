from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, date, time

from app.db.deps import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.appointment import Appointment
from app.models.appointment_block import AppointmentBlock
from app.models.clinic_settings import ClinicSettings

from app.schemas.calendar import (
    CalendarEventsResponse,
    CalendarDaySummary,
    DaySlotsResponse,
    DaySlot,
)

router = APIRouter(prefix="/calendar", tags=["Calendar"])

SLOT_MINUTES_DEFAULT = 30


# =========================
# Helpers: agenda compartida
# =========================
def get_owner_user(db: Session) -> User:
    """
    Busca la psicóloga activa dueña de la agenda.
    Esta función replica la lógica que ya usas en otros módulos.
    """
    owner = (
        db.query(User)
        .filter(User.role == "psychologist", User.is_active == True)
        .order_by(User.id.asc())
        .first()
    )
    if not owner:
        raise HTTPException(status_code=500, detail="No existe psicóloga activa en el sistema.")
    return owner


def get_target_user_id(db: Session, current_user: User) -> int:
    """
    Determina de qué agenda debe leer/escribir el usuario actual.

    psychologist -> su propia agenda
    assistant    -> agenda de la psychologist dueña
    admin        -> compatibilidad actual: su propia agenda
    """
    if current_user.role == "assistant":
        # Si assistant tiene owner_user_id configurado, usarlo
        if getattr(current_user, "owner_user_id", None):
            return current_user.owner_user_id

        # Fallback compatible con tu proyecto actual
        return get_owner_user(db).id

    return current_user.id


# =========================
# Helpers: settings
# =========================
def get_settings(db: Session) -> ClinicSettings:
    """
    Obtiene configuración clínica global.
    Si no existe, crea una por compatibilidad.
    """
    settings = db.query(ClinicSettings).first()

    if not settings:
        settings = ClinicSettings(
            start_time=time(8, 0),
            end_time=time(22, 0),
            mon=True,
            tue=True,
            wed=True,
            thu=True,
            fri=True,
            sat=True,
            sun=True,
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)

    return settings


def _day_enabled(settings: ClinicSettings, weekday: int) -> bool:
    return {
        0: settings.mon,
        1: settings.tue,
        2: settings.wed,
        3: settings.thu,
        4: settings.fri,
        5: settings.sat,
        6: settings.sun,
    }.get(weekday, False)


def _parse_date_yyyy_mm_dd(val: str, field_name: str) -> date:
    try:
        return datetime.fromisoformat(val + "T00:00:00").date()
    except Exception:
        raise HTTPException(status_code=400, detail=f"{field_name} inválido. Usa YYYY-MM-DD")


def _overlap(a_start: datetime, a_end: datetime, b_start: datetime, b_end: datetime) -> bool:
    return (a_start < b_end) and (b_start < a_end)


# =========================
# A) GET /calendar/events?from_date=YYYY-MM-DD&to_date=YYYY-MM-DD
# =========================
@router.get("/events", response_model=CalendarEventsResponse)
def get_calendar_events(
    from_date: str,
    to_date: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    d_from = _parse_date_yyyy_mm_dd(from_date, "from_date")
    d_to = _parse_date_yyyy_mm_dd(to_date, "to_date")

    if d_to < d_from:
        raise HTTPException(status_code=400, detail="to_date debe ser >= from_date")

    # límite defensivo
    if (d_to - d_from).days > 370:
        raise HTTPException(status_code=400, detail="Rango demasiado grande (máx 370 días).")

    settings = get_settings(db)
    target_user_id = get_target_user_id(db, current_user)

    range_start = datetime.combine(d_from, time(0, 0))
    range_end = datetime.combine(d_to, time(23, 59, 59))

    # =========================
    # Citas de la agenda compartida
    # =========================
    appts = (
        db.query(Appointment)
        .filter(
            Appointment.is_active == True,
            Appointment.user_id == target_user_id,
            Appointment.start_time >= range_start,
            Appointment.start_time <= range_end,
        )
        .all()
    )

    # =========================
    # Bloqueos de la agenda compartida
    # =========================
    blocks = (
        db.query(AppointmentBlock)
        .filter(
            AppointmentBlock.is_active == True,
            AppointmentBlock.user_id == target_user_id,
            AppointmentBlock.start_time <= range_end,
            AppointmentBlock.end_time >= range_start,
        )
        .all()
    )

    # bucket por día
    bucket = {}

    def ensure(day: str):
        if day not in bucket:
            bucket[day] = CalendarDaySummary(
                date=day,
                booked=0,
                completed=0,
                cancelled=0,
                all_day_blocked=False,
            )
        return bucket[day]

    # =========================
    # Contar citas por día
    # =========================
    for a in appts:
        day = a.start_time.date().isoformat()
        row = ensure(day)

        st = (a.status or "").lower()

        if st == "completed":
            row.completed += 1
        elif st == "cancelled":
            row.cancelled += 1
        else:
            # scheduled / confirmed / no_show / etc
            row.booked += 1

    # =========================
    # Marcar días con bloqueo completo
    # =========================
    for b in blocks:
        cur = b.start_time.date()
        endd = b.end_time.date()

        while cur <= endd:
            day_iso = cur.isoformat()
            row = ensure(day_iso)

            open_dt = datetime.combine(cur, settings.start_time)
            close_dt = datetime.combine(cur, settings.end_time)

            # si el bloqueo cubre toda la ventana laboral
            if b.start_time <= open_dt and b.end_time >= close_dt:
                row.all_day_blocked = True

            cur = cur + timedelta(days=1)

    # =========================
    # Marcar días no laborables
    # =========================
    cur = d_from
    while cur <= d_to:
        day_iso = cur.isoformat()
        row = ensure(day_iso)

        if not _day_enabled(settings, cur.weekday()):
            row.all_day_blocked = True

        cur = cur + timedelta(days=1)

    # salida ordenada
    out_days = []
    cur = d_from
    while cur <= d_to:
        out_days.append(bucket[cur.isoformat()])
        cur = cur + timedelta(days=1)

    return CalendarEventsResponse(
        from_date=d_from.isoformat(),
        to_date=d_to.isoformat(),
        days=out_days,
    )


# =========================
# B) GET /calendar/day-slots?date_str=YYYY-MM-DD
# =========================
@router.get("/day-slots", response_model=DaySlotsResponse)
def get_day_slots(
    date_str: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    d = _parse_date_yyyy_mm_dd(date_str, "date_str")
    settings = get_settings(db)
    target_user_id = get_target_user_id(db, current_user)

    slot_minutes = SLOT_MINUTES_DEFAULT
    day_enabled = _day_enabled(settings, d.weekday())

    day_open = datetime.combine(d, settings.start_time)
    day_close = datetime.combine(d, settings.end_time)

    # =========================
    # Citas del día de la agenda compartida
    # =========================
    appts = (
        db.query(Appointment)
        .filter(
            Appointment.is_active == True,
            Appointment.user_id == target_user_id,
            Appointment.start_time >= day_open,
            Appointment.start_time < day_close,
        )
        .all()
    )

    # =========================
    # Bloqueos del día de la agenda compartida
    # =========================
    blocks = (
        db.query(AppointmentBlock)
        .filter(
            AppointmentBlock.is_active == True,
            AppointmentBlock.user_id == target_user_id,
            AppointmentBlock.start_time < day_close,
            AppointmentBlock.end_time > day_open,
        )
        .all()
    )

    # Citas activas que sí ocupan horario
    appt_ranges = []
    for a in appts:
        st = (a.status or "").lower()

        # canceladas no ocupan horario
        if st == "cancelled":
            continue

        a_start = a.start_time
        a_end = a.start_time + timedelta(minutes=int(a.duration_minutes or 0))
        appt_ranges.append((a_start, a_end))

    # Bloqueos
    block_ranges = [(b.start_time, b.end_time) for b in blocks]

    slots = []
    cur = day_open

    while cur < day_close:
        end = cur + timedelta(minutes=slot_minutes)
        status = "free"

        if not day_enabled:
            status = "blocked"
        else:
            # bloquear por AppointmentBlock
            for bs, be in block_ranges:
                if _overlap(cur, end, bs, be):
                    status = "blocked"
                    break

            # booked por Appointment
            if status != "blocked":
                for as_, ae in appt_ranges:
                    if _overlap(cur, end, as_, ae):
                        status = "booked"
                        break

        slots.append(
            DaySlot(
                start=cur.time().strftime("%H:%M"),
                end=end.time().strftime("%H:%M"),
                status=status,
            )
        )

        cur = end

    return DaySlotsResponse(
        date=d.isoformat(),
        slot_minutes=slot_minutes,
        working_hours={
            "start_time": settings.start_time.strftime("%H:%M"),
            "end_time": settings.end_time.strftime("%H:%M"),
            "days_enabled": {
                "mon": settings.mon,
                "tue": settings.tue,
                "wed": settings.wed,
                "thu": settings.thu,
                "fri": settings.fri,
                "sat": settings.sat,
                "sun": settings.sun,
            },
        },
        slots=slots,
    )