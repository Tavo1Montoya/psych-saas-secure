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
# Helpers: settings
# =========================
def get_settings(db: Session) -> ClinicSettings:
    settings = db.query(ClinicSettings).first()
    if not settings:
        # default si no existe (compat)
        settings = ClinicSettings(
            start_time=time(9, 0),
            end_time=time(18, 0),
            mon=True, tue=True, wed=True, thu=True, fri=True, sat=False, sun=False
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


# =========================
# Helpers: target_user_id (compatible con tu app)
# - Si assistant tiene owner_user_id => usarlo
# - Si no lo tiene => fallback a "primera psychologist" (compat con appointments)
# =========================
def get_owner_user_id_fallback(db: Session) -> int:
    owner = db.query(User).filter(User.role == "psychologist", User.is_active == True).order_by(User.id.asc()).first()
    if not owner:
        raise HTTPException(status_code=500, detail="No existe psicóloga activa en el sistema.")
    return owner.id


def get_target_user_id(db: Session, current_user: User) -> int:
    if current_user.role == "assistant":
        if getattr(current_user, "owner_user_id", None):
            return current_user.owner_user_id
        return get_owner_user_id_fallback(db)

    # admin/psychologist: su propia agenda (compat)
    return current_user.id


def _parse_date_yyyy_mm_dd(val: str, field_name: str) -> date:
    try:
        return datetime.fromisoformat(val + "T00:00:00").date()
    except Exception:
        raise HTTPException(status_code=400, detail=f"{field_name} inválido. Usa YYYY-MM-DD")


def _overlap(a_start: datetime, a_end: datetime, b_start: datetime, b_end: datetime) -> bool:
    return (a_start < b_end) and (b_start < a_end)


# =========================
# A) GET /calendar/events?from=YYYY-MM-DD&to=YYYY-MM-DD
# =========================
@router.get("/events", response_model=CalendarEventsResponse)
def get_calendar_events(
    from_date: str,
    to_date: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    d_from = _parse_date_yyyy_mm_dd(from_date, "from")
    d_to = _parse_date_yyyy_mm_dd(to_date, "to")

    if d_to < d_from:
        raise HTTPException(status_code=400, detail="to debe ser >= from")

    # límite defensivo (para no pedir 5 años)
    if (d_to - d_from).days > 370:
        raise HTTPException(status_code=400, detail="Rango demasiado grande (máx 370 días).")

    settings = get_settings(db)
    target_user_id = get_target_user_id(db, current_user)

    range_start = datetime.combine(d_from, time(0, 0))
    range_end = datetime.combine(d_to, time(23, 59, 59))

    # citas del rango (activas)
    appts = db.query(Appointment).filter(
        Appointment.is_active == True,
        Appointment.user_id == target_user_id,
        Appointment.start_time >= range_start,
        Appointment.start_time <= range_end,
    ).all()

    # bloqueos del rango (activos)
    blocks = db.query(AppointmentBlock).filter(
        AppointmentBlock.is_active == True,
        AppointmentBlock.user_id == target_user_id,
        AppointmentBlock.start_time <= range_end,
        AppointmentBlock.end_time >= range_start,
    ).all()

    # bucket por día
    bucket = {}

    def ensure(day: str):
        if day not in bucket:
            bucket[day] = CalendarDaySummary(date=day, booked=0, completed=0, cancelled=0, all_day_blocked=False)
        return bucket[day]

    # contar citas
    for a in appts:
        day = a.start_time.date().isoformat()
        row = ensure(day)
        st = (a.status or "").lower()
        if st == "completed":
            row.completed += 1
        elif st == "cancelled":
            row.cancelled += 1
        else:
            # scheduled / confirmed / no_show etc => lo consideramos “booked” para indicador
            row.booked += 1

    # marcar días con bloqueo “de día completo” (respecto a ventana laboral)
    # criterio: si algún bloqueo cubre TODA la ventana [start_time, end_time] del día
    for b in blocks:
        # recorrer días que toca ese bloqueo
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

    # si día no laborable => all_day_blocked (para pintar)
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

    return CalendarEventsResponse(from_date=d_from.isoformat(), to_date=d_to.isoformat(), days=out_days)


# =========================
# B) GET /calendar/day-slots?date=YYYY-MM-DD
# =========================
@router.get("/day-slots", response_model=DaySlotsResponse)
def get_day_slots(
    date_str: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    d = _parse_date_yyyy_mm_dd(date_str, "date")
    settings = get_settings(db)
    target_user_id = get_target_user_id(db, current_user)

    slot_minutes = SLOT_MINUTES_DEFAULT

    # si no es laborable => todos blocked (pero devolvemos slots dentro del horario para que se vea el “día bloqueado”)
    day_enabled = _day_enabled(settings, d.weekday())

    day_open = datetime.combine(d, settings.start_time)
    day_close = datetime.combine(d, settings.end_time)

    # traer citas del día
    appts = db.query(Appointment).filter(
        Appointment.is_active == True,
        Appointment.user_id == target_user_id,
        Appointment.start_time >= day_open,
        Appointment.start_time < day_close,
    ).all()

    # traer bloqueos que traslapen el día
    blocks = db.query(AppointmentBlock).filter(
        AppointmentBlock.is_active == True,
        AppointmentBlock.user_id == target_user_id,
        AppointmentBlock.start_time < day_close,
        AppointmentBlock.end_time > day_open,
    ).all()

    # precomputar rangos de citas (excluye cancelled)
    appt_ranges = []
    for a in appts:
        st = (a.status or "").lower()
        if st == "cancelled":
            continue
        a_start = a.start_time
        a_end = a.start_time + timedelta(minutes=int(a.duration_minutes or 0))
        appt_ranges.append((a_start, a_end))

    # rangos bloques
    block_ranges = [(b.start_time, b.end_time) for b in blocks]

    slots = []
    cur = day_open
    while cur < day_close:
        end = cur + timedelta(minutes=slot_minutes)

        status = "free"

        if not day_enabled:
            status = "blocked"
        else:
            # blocked por bloqueo
            for (bs, be) in block_ranges:
                if _overlap(cur, end, bs, be):
                    status = "blocked"
                    break

            # booked por cita (si no está blocked)
            if status != "blocked":
                for (as_, ae) in appt_ranges:
                    if _overlap(cur, end, as_, ae):
                        status = "booked"
                        break

        slots.append(DaySlot(
            start=cur.time().strftime("%H:%M"),
            end=end.time().strftime("%H:%M"),
            status=status
        ))

        cur = end

    return DaySlotsResponse(
        date=d.isoformat(),
        slot_minutes=slot_minutes,
        working_hours={
            "start_time": settings.start_time.strftime("%H:%M"),
            "end_time": settings.end_time.strftime("%H:%M"),
            "days_enabled": {
                "mon": settings.mon, "tue": settings.tue, "wed": settings.wed,
                "thu": settings.thu, "fri": settings.fri, "sat": settings.sat, "sun": settings.sun
            }
        },
        slots=slots
    )