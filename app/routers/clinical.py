from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime

from app.db.deps import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.patient import Patient
from app.models.appointment import Appointment
from app.models.note import Note

router = APIRouter(prefix="/clinical", tags=["Clinical"])


# =========================
# Helpers para "1 psicóloga"
# =========================
def get_owner_user(db: Session) -> User:
    owner = db.query(User).filter(User.role == "psychologist", User.is_active == True).first()
    if not owner:
        raise HTTPException(status_code=500, detail="No existe usuario con rol 'psychologist' activo")
    return owner


def get_target_user_id(db: Session, current_user: User) -> int:
    # assistant trabaja para la psicóloga
    if current_user.role == "assistant":
        return get_owner_user(db).id
    return current_user.id


def _patient_access_query(db: Session, current_user: User, patient_id: int):
    q = db.query(Patient).filter(Patient.id == patient_id, Patient.is_active == True)

    if current_user.role == "admin":
        return q

    # assistant: pacientes de psicóloga
    if current_user.role == "assistant":
        owner_id = get_owner_user(db).id
        return q.filter(Patient.user_id == owner_id)

    # psychologist: solo los suyos
    return q.filter(Patient.user_id == current_user.id)


# =========================
# Endpoints
# =========================

@router.get("/patient/{patient_id}/summary")
def patient_summary(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    ✅ Resumen clínico por paciente:
    - datos del paciente
    - total de citas (activas)
    - total de notas (activas)
    - última cita pasada (si existe)
    - próxima cita (si existe)
    """
    patient = _patient_access_query(db, current_user, patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado o sin acceso")

    if current_user.role == "admin":
        target_user_id = None
    else:
        target_user_id = get_target_user_id(db, current_user)

    # Filtros de agenda (si no admin)
    appt_q = db.query(Appointment).filter(
        Appointment.is_active == True,
        Appointment.patient_id == patient_id
    )
    note_q = db.query(Note).filter(
        Note.is_active == True,
        Note.patient_id == patient_id
    )

    if target_user_id is not None:
        appt_q = appt_q.filter(Appointment.user_id == target_user_id)
        note_q = note_q.filter(Note.user_id == target_user_id)

    total_appointments = appt_q.count()
    total_notes = note_q.count()

    now = datetime.utcnow()

    last_appointment = appt_q.filter(Appointment.start_time <= now).order_by(Appointment.start_time.desc()).first()
    next_appointment = appt_q.filter(Appointment.start_time > now).order_by(Appointment.start_time.asc()).first()

    return {
        "patient": {
            "id": patient.id,
            "full_name": patient.full_name,
            "age": patient.age,
            "notes": patient.notes,  # tu campo de texto del paciente
            "created_at": patient.created_at,
            "is_active": patient.is_active
        },
        "counts": {
            "appointments": total_appointments,
            "notes": total_notes
        },
        "last_appointment": None if not last_appointment else {
            "id": last_appointment.id,
            "start_time": last_appointment.start_time,
            "duration_minutes": last_appointment.duration_minutes,
            "status": last_appointment.status
        },
        "next_appointment": None if not next_appointment else {
            "id": next_appointment.id,
            "start_time": next_appointment.start_time,
            "duration_minutes": next_appointment.duration_minutes,
            "status": next_appointment.status
        }
    }


@router.get("/patient/{patient_id}/timeline")
def patient_timeline(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = 50
):
    """
    ✅ Timeline clínico (últimas notas) por paciente
    """
    patient = _patient_access_query(db, current_user, patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado o sin acceso")

    q = db.query(Note).filter(Note.is_active == True, Note.patient_id == patient_id)

    if current_user.role != "admin":
        target_user_id = get_target_user_id(db, current_user)
        q = q.filter(Note.user_id == target_user_id)

    notes = q.order_by(Note.created_at.desc()).limit(limit).all()

    # response simple (sin schema extra por ahora)
    return [
        {
            "id": n.id,
            "created_at": n.created_at,
            "note_type": n.note_type,
            "appointment_id": n.appointment_id,
            "subjective": n.subjective,
            "objective": n.objective,
            "assessment": n.assessment,
            "plan": n.plan,
            "content": n.content,
        }
        for n in notes
    ]