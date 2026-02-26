# app/routers/timeline.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime

from app.db.deps import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.patient import Patient
from app.models.appointment import Appointment
from app.models.note import Note
from app.schemas.timeline import PatientTimelineResponse, TimelineEvent

router = APIRouter(prefix="/patients", tags=["Timeline"])

ALLOWED_ROLES = ["admin", "psychologist", "assistant"]


# =========================
# Helpers (1 psicóloga)
# =========================
def get_owner_user(db: Session) -> User:
    owner = db.query(User).filter(User.role == "psychologist", User.is_active == True).first()
    if not owner:
        raise HTTPException(status_code=500, detail="No existe usuario con rol 'psychologist'")
    return owner


def get_target_user_id(db: Session, current_user: User) -> int:
    # assistant -> agenda/pacientes de la psicóloga
    if current_user.role == "assistant":
        return get_owner_user(db).id
    return current_user.id


def patient_access_query(db: Session, current_user: User, patient_id: int):
    """
    ✅ Admin: cualquier paciente activo
    ✅ Psychologist: sus pacientes
    ✅ Assistant: pacientes de la psicóloga (modo 1 psicóloga)
    """
    q = db.query(Patient).filter(Patient.id == patient_id, Patient.is_active == True)

    if current_user.role == "admin":
        return q

    target_user_id = get_target_user_id(db, current_user)
    return q.filter(Patient.user_id == target_user_id)


# =========================
# Endpoint: Timeline
# =========================
@router.get("/{patient_id}/timeline", response_model=PatientTimelineResponse)
def get_patient_timeline(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    date_from: Optional[str] = None,  # YYYY-MM-DD
    date_to: Optional[str] = None,    # YYYY-MM-DD
    limit: int = 200
):
    """
    ✅ Timeline = Appointments + Notes del paciente, ordenado desc por fecha.
    - Respeta permisos por rol
    - Puedes filtrar por rango de fechas (opcional)
    """

    if current_user.role not in ALLOWED_ROLES:
        raise HTTPException(status_code=403, detail="No tienes permisos para esta acción")

    # 1) Validar acceso al paciente
    patient = patient_access_query(db, current_user, patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado o sin acceso")

    # 2) Rango fechas opcional
    start_dt = None
    end_dt = None
    if date_from and date_to:
        try:
            start_dt = datetime.fromisoformat(date_from + "T00:00:00")
            end_dt = datetime.fromisoformat(date_to + "T23:59:59")
        except ValueError:
            raise HTTPException(status_code=400, detail="Fechas inválidas. Usa YYYY-MM-DD")
    elif date_from or date_to:
        raise HTTPException(status_code=400, detail="Envía date_from y date_to juntos (YYYY-MM-DD)")

    # 3) Para assistant: target_user_id = psicóloga (para filtrar agenda)
    target_user_id = get_target_user_id(db, current_user)

    # 4) Obtener citas del paciente (según permisos)
    appt_q = db.query(Appointment).filter(
        Appointment.is_active == True,
        Appointment.patient_id == patient_id
    )

    # Admin puede ver todas; no-admin solo las de su agenda objetivo
    if current_user.role != "admin":
        appt_q = appt_q.filter(Appointment.user_id == target_user_id)

    if start_dt and end_dt:
        appt_q = appt_q.filter(Appointment.start_time >= start_dt, Appointment.start_time <= end_dt)

    appts: List[Appointment] = appt_q.all()

    # 5) Obtener notes del paciente (según permisos)
    notes_q = db.query(Note).filter(
        Note.is_active == True,
        Note.patient_id == patient_id
    )

    if current_user.role != "admin":
        notes_q = notes_q.filter(Note.user_id == target_user_id)

    if start_dt and end_dt:
        notes_q = notes_q.filter(Note.created_at >= start_dt, Note.created_at <= end_dt)

    notes: List[Note] = notes_q.all()

    # 6) Construir eventos
    events: List[TimelineEvent] = []

    for a in appts:
        events.append(TimelineEvent(
            event_type="appointment",
            at=a.start_time,
            appointment_id=a.id,
            status=a.status,
            duration_minutes=a.duration_minutes,
            start_time=a.start_time
        ))

    for n in notes:
        events.append(TimelineEvent(
            event_type="note",
            at=n.created_at,
            note_id=n.id,
            appointment_id=n.appointment_id,
            note_type=n.note_type,
            content=n.content,
            subjective=n.subjective,
            objective=n.objective,
            assessment=n.assessment,
            plan=n.plan
        ))

    # 7) Ordenar y limitar
    events.sort(key=lambda e: e.at, reverse=True)
    if limit and limit > 0:
        events = events[: min(limit, 500)]  # hard cap 500 para no explotar

    return PatientTimelineResponse(
        patient_id=patient_id,
        total_events=len(events),
        events=events
    )