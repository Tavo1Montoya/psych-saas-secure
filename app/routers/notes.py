from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from app.db.deps import get_db
from app.core.auth import get_current_user, require_roles
from app.models.user import User
from app.models.appointment import Appointment
from app.models.patient import Patient
from app.models.note import Note
from app.schemas.note import NoteCreate, NoteUpdate, NoteResponse

router = APIRouter(prefix="/notes", tags=["Notes"])

ALLOWED_ROLES = ["admin", "psychologist", "assistant"]

# =========================
# Helpers para "1 psicóloga"
# =========================
def get_owner_user(db: Session) -> User:
    owner = (
        db.query(User)
        .filter(User.role == "psychologist", User.is_active == True)
        .first()
    )
    if not owner:
        raise HTTPException(status_code=500, detail="No existe usuario con rol 'psychologist'")
    return owner


def get_target_user_id(db: Session, current_user: User) -> int:
    """
    Define a quién pertenece la agenda clínica:
    - psychologist: su propia agenda
    - assistant: agenda de la psicóloga (owner)
    - admin: admin ve todo (pero aquí usamos current_user.id si se requiere)
    """
    if current_user.role == "assistant":
        return get_owner_user(db).id
    return current_user.id


def _appointment_access_query(db: Session, current_user: User, appointment_id: int):
    """
    Admin: puede acceder a cualquier cita activa
    Psychologist: solo su agenda
    Assistant: agenda de la psicóloga
    """
    query = db.query(Appointment).filter(
        Appointment.id == appointment_id,
        Appointment.is_active == True
    )

    if current_user.role == "admin":
        return query

    target_user_id = get_target_user_id(db, current_user)
    return query.filter(Appointment.user_id == target_user_id)


def _patient_access_query(db: Session, current_user: User, patient_id: int):
    """
    Admin: cualquier paciente activo
    Psychologist: sus pacientes
    Assistant: pacientes de la psicóloga (owner)
    """
    query = db.query(Patient).filter(
        Patient.id == patient_id,
        Patient.is_active == True
    )

    if current_user.role == "admin":
        return query

    target_user_id = get_target_user_id(db, current_user)
    return query.filter(Patient.user_id == target_user_id)

# =========================
# Endpoints
# =========================

@router.post("/", response_model=NoteResponse, operation_id="create_note")
def create_note(
    data: NoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(ALLOWED_ROLES))
):
    # 0) Validación mínima para evitar notas vacías
    if data.note_type == "general":
        if not data.content or not data.content.strip():
            raise HTTPException(status_code=400, detail="Para note_type='general' debes enviar 'content'")
    elif data.note_type == "soap":
        if not any([
            (data.subjective and data.subjective.strip()),
            (data.objective and data.objective.strip()),
            (data.assessment and data.assessment.strip()),
            (data.plan and data.plan.strip()),
            (data.content and data.content.strip()),
        ]):
            raise HTTPException(
                status_code=400,
                detail="Para note_type='soap' debes enviar al menos un campo (subjective/objective/assessment/plan/content)"
            )

    # 1) validar cita existe y tengo acceso (con agenda objetivo)
    appt = _appointment_access_query(db, current_user, data.appointment_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Cita no encontrada o sin acceso")

    # 2) validar paciente ligado a esa cita (y activo)
    patient = _patient_access_query(db, current_user, appt.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado o sin acceso")

    # 3) determinar a quién pertenece la nota (agenda objetivo)
    #    assistant -> psicóloga, psychologist -> él/ella, admin -> puede dejarla en la agenda de la cita
    if current_user.role == "admin":
        target_user_id = appt.user_id
    else:
        target_user_id = get_target_user_id(db, current_user)

    # 4) crear nota
    note = Note(
        appointment_id=appt.id,
        patient_id=appt.patient_id,
        user_id=target_user_id,          # ✅ dueño clínico de la nota (agenda)
        note_type=data.note_type,
        subjective=data.subjective,
        objective=data.objective,
        assessment=data.assessment,
        plan=data.plan,
        content=data.content,
        created_by=current_user.id
    )

    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@router.get("/", response_model=List[NoteResponse], operation_id="list_notes")
def list_notes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Note).filter(Note.is_active == True)
    query = query.filter(Note.patient.has(Patient.is_active == True))

    if current_user.role == "admin":
        return query.order_by(Note.created_at.desc()).all()

    target_user_id = get_target_user_id(db, current_user)
    return query.filter(Note.user_id == target_user_id).order_by(Note.created_at.desc()).all()


@router.get("/by-patient/{patient_id}", response_model=List[NoteResponse], operation_id="list_notes_by_patient")
def list_notes_by_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1) validar acceso al paciente
    patient = _patient_access_query(db, current_user, patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado o sin acceso")

    # 2) notas del paciente (por agenda)
    q = db.query(Note).filter(Note.patient_id == patient_id, Note.is_active == True)

    if current_user.role == "admin":
        return q.order_by(Note.created_at.desc()).all()

    target_user_id = get_target_user_id(db, current_user)
    return q.filter(Note.user_id == target_user_id).order_by(Note.created_at.desc()).all()


@router.put("/{note_id}", response_model=NoteResponse, operation_id="update_note")
def update_note(
    note_id: int,
    data: NoteUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(ALLOWED_ROLES))
):
    query = db.query(Note).filter(Note.id == note_id, Note.is_active == True)

    if current_user.role != "admin":
        target_user_id = get_target_user_id(db, current_user)
        query = query.filter(Note.user_id == target_user_id)

    note = query.first()
    if not note:
        raise HTTPException(status_code=404, detail="Nota no encontrada o sin acceso")

    # Validación mínima al actualizar
    if data.note_type == "general":
        if data.content is not None and not data.content.strip():
            raise HTTPException(status_code=400, detail="content no puede ir vacío para note_type='general'")

    for field, value in data.dict(exclude_unset=True).items():
        setattr(note, field, value)

    note.updated_by = current_user.id
    note.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(note)
    return note


@router.delete("/{note_id}", operation_id="delete_note")
def delete_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(ALLOWED_ROLES))
):
    query = db.query(Note).filter(Note.id == note_id, Note.is_active == True)

    if current_user.role != "admin":
        target_user_id = get_target_user_id(db, current_user)
        query = query.filter(Note.user_id == target_user_id)

    note = query.first()
    if not note:
        raise HTTPException(status_code=404, detail="Nota no encontrada o sin acceso")

    note.is_active = False
    note.updated_by = current_user.id
    note.updated_at = datetime.utcnow()

    db.commit()
    return {"message": "Nota desactivada correctamente"}