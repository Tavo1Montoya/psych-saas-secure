from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
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
    if current_user.role == "assistant":
        return get_owner_user(db).id
    return current_user.id


def _appointment_access_query(db: Session, current_user: User, appointment_id: int):
    query = db.query(Appointment).filter(
        Appointment.id == appointment_id,
        Appointment.is_active == True
    )

    if current_user.role == "admin":
        return query

    target_user_id = get_target_user_id(db, current_user)
    return query.filter(Appointment.user_id == target_user_id)


def _patient_access_query(db: Session, current_user: User, patient_id: int):
    query = db.query(Patient).filter(
        Patient.id == patient_id,
        Patient.is_active == True
    )

    if current_user.role == "admin":
        return query

    target_user_id = get_target_user_id(db, current_user)
    return query.filter(Patient.user_id == target_user_id)


def _validate_note_payload(
    note_type: Optional[str],
    subjective: Optional[str],
    objective: Optional[str],
    assessment: Optional[str],
    plan: Optional[str],
    content: Optional[str],
):
    final_type = note_type or "soap"

    if final_type == "general":
        if not content or not content.strip():
            raise HTTPException(
                status_code=400,
                detail="Para note_type='general' debes enviar 'content'"
            )
        return

    if final_type == "soap":
        if not any([
            (subjective and subjective.strip()),
            (objective and objective.strip()),
            (assessment and assessment.strip()),
            (plan and plan.strip()),
            (content and content.strip()),
        ]):
            raise HTTPException(
                status_code=400,
                detail="Para note_type='soap' debes enviar al menos un campo (subjective/objective/assessment/plan/content)"
            )
        return


# =========================
# Endpoints
# =========================

@router.post("/", response_model=NoteResponse, operation_id="create_note")
def create_note(
    data: NoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(ALLOWED_ROLES))
):
    # 1) validar contenido
    _validate_note_payload(
        note_type=data.note_type,
        subjective=data.subjective,
        objective=data.objective,
        assessment=data.assessment,
        plan=data.plan,
        content=data.content,
    )

    # 2) validar paciente
    patient = _patient_access_query(db, current_user, data.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado o sin acceso")

    # 3) validar cita si se envió
    appt = None
    if data.appointment_id is not None:
        appt = _appointment_access_query(db, current_user, data.appointment_id).first()
        if not appt:
            raise HTTPException(status_code=404, detail="Cita no encontrada o sin acceso")

        if appt.patient_id != patient.id:
            raise HTTPException(
                status_code=400,
                detail="La cita seleccionada no pertenece al paciente indicado"
            )

    # 4) dueño real de la nota
    if current_user.role == "admin":
        target_user_id = appt.user_id if appt else patient.user_id
    else:
        target_user_id = get_target_user_id(db, current_user)

    # 5) crear nota
    note = Note(
        patient_id=patient.id,
        appointment_id=appt.id if appt else None,
        user_id=target_user_id,
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
    patient = _patient_access_query(db, current_user, patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado o sin acceso")

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

    # 1) determinar paciente final
    final_patient_id = data.patient_id if data.patient_id is not None else note.patient_id
    patient = _patient_access_query(db, current_user, final_patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado o sin acceso")

    # 2) determinar cita final
    final_appointment_id = note.appointment_id
    if data.appointment_id is not None:
        final_appointment_id = data.appointment_id

    appt = None
    if final_appointment_id is not None:
        appt = _appointment_access_query(db, current_user, final_appointment_id).first()
        if not appt:
            raise HTTPException(status_code=404, detail="Cita no encontrada o sin acceso")

        if appt.patient_id != patient.id:
            raise HTTPException(
                status_code=400,
                detail="La cita seleccionada no pertenece al paciente indicado"
            )

    # 3) validar contenido final
    final_note_type = data.note_type if data.note_type is not None else note.note_type
    final_subjective = data.subjective if data.subjective is not None else note.subjective
    final_objective = data.objective if data.objective is not None else note.objective
    final_assessment = data.assessment if data.assessment is not None else note.assessment
    final_plan = data.plan if data.plan is not None else note.plan
    final_content = data.content if data.content is not None else note.content

    _validate_note_payload(
        note_type=final_note_type,
        subjective=final_subjective,
        objective=final_objective,
        assessment=final_assessment,
        plan=final_plan,
        content=final_content,
    )

    # 4) actualizar
    note.patient_id = patient.id
    note.appointment_id = appt.id if appt else None
    note.note_type = final_note_type
    note.subjective = final_subjective
    note.objective = final_objective
    note.assessment = final_assessment
    note.plan = final_plan
    note.content = final_content
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