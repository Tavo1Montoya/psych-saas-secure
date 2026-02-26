from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import date, datetime

from app.db.deps import get_db
from app.models.patient import Patient
from app.schemas.patient import PatientCreate, PatientResponse, PatientUpdate
from app.core.auth import get_current_user, require_roles
from app.models.user import User
from app.models.appointment import Appointment
from app.models.note import Note

router = APIRouter(prefix="/patients", tags=["Patients"])

ALLOWED_ROLES = ["admin", "psychologist", "assistant"]


# =========================
# Helpers (1 psicóloga)
# =========================
def _calc_age(birth_date: date) -> int:
    """Calcula edad a partir de birth_date (date)."""
    today = date.today()
    years = today.year - birth_date.year
    if (today.month, today.day) < (birth_date.month, birth_date.day):
        years -= 1
    return max(years, 0)


def get_owner_user(db: Session) -> User:
    """
    Obtiene a la psicóloga (única).
    ✅ Igual que en appointments: debe existir y estar activa.
    """
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
    Propietario objetivo:
    - psychologist: ella misma
    - assistant: psicóloga (owner)
    - admin: admin (pero admin ve todo en list)
    """
    if current_user.role == "assistant":
        return get_owner_user(db).id
    return current_user.id


def _patient_access_query(db: Session, current_user: User, patient_id: int):
    """
    Admin: cualquier paciente activo
    Psychologist: sus pacientes
    Assistant: pacientes de la psicóloga (owner)
    """
    q = db.query(Patient).filter(
        Patient.id == patient_id,
        Patient.is_active == True
    )

    if current_user.role == "admin":
        return q

    target_user_id = get_target_user_id(db, current_user)
    return q.filter(Patient.user_id == target_user_id)


def _model_to_dict_exclude_unset(model):
    """
    ✅ Compat: Pydantic v2 (model_dump) / v1 (dict)
    """
    if hasattr(model, "model_dump"):
        return model.model_dump(exclude_unset=True)
    return model.dict(exclude_unset=True)


# =========================
# Endpoints
# =========================
@router.post("/", response_model=PatientResponse)
def create_patient(
    patient: PatientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(ALLOWED_ROLES))
):
    target_user_id = get_target_user_id(db, current_user)

    # ✅ Resolver edad sin romper nada
    resolved_age = patient.age
    if resolved_age is None and patient.birth_date:
        resolved_age = _calc_age(patient.birth_date)

    # Si aún sigue None, no podemos crear (tu DB probablemente tiene age NOT NULL)
    if resolved_age is None:
        raise HTTPException(
            status_code=422,
            detail="Debes enviar 'age' o 'birth_date' (para calcular edad)."
        )

    # ✅ Crear paciente con ficha (TODOS opcionales, no rompe nada)
    new_patient = Patient(
        full_name=patient.full_name,
        age=resolved_age,
        phone=getattr(patient, "phone", None),
        birth_date=getattr(patient, "birth_date", None),
        notes=getattr(patient, "notes", None),

        # ✅ Ficha de identificación (si el schema ya los trae, se guardan; si no, quedan None)
        sex=getattr(patient, "sex", None),
        marital_status=getattr(patient, "marital_status", None),
        occupation=getattr(patient, "occupation", None),
        workplace=getattr(patient, "workplace", None),
        work_days=getattr(patient, "work_days", None),
        work_schedule=getattr(patient, "work_schedule", None),

        birth_place=getattr(patient, "birth_place", None),
        education=getattr(patient, "education", None),
        religion=getattr(patient, "religion", None),
        address=getattr(patient, "address", None),

        emergency_contact_name=getattr(patient, "emergency_contact_name", None),
        emergency_contact_phone=getattr(patient, "emergency_contact_phone", None),

        user_id=target_user_id,     # ✅ assistant crea para la psicóloga
        created_by=current_user.id
    )

    db.add(new_patient)
    db.commit()
    db.refresh(new_patient)
    return new_patient


@router.get("/", response_model=List[PatientResponse])
def get_patients(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    q = db.query(Patient).filter(Patient.is_active == True)

    # ✅ Admin ve todo
    if current_user.role == "admin":
        return q.order_by(Patient.id.desc()).all()

    # ✅ Otros roles: solo los del owner/agenda objetivo
    target_user_id = get_target_user_id(db, current_user)
    return q.filter(Patient.user_id == target_user_id).order_by(Patient.id.desc()).all()


@router.get("/{patient_id}", response_model=PatientResponse)
def get_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    patient = _patient_access_query(db, current_user, patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado o sin acceso")
    return patient


@router.put("/{patient_id}", response_model=PatientResponse)
def update_patient(
    patient_id: int,
    patient_data: PatientUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(ALLOWED_ROLES))
):
    patient = _patient_access_query(db, current_user, patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado o sin acceso")

    data = _model_to_dict_exclude_unset(patient_data)

    # ✅ Si cambian birth_date y no mandan age, recalculamos edad automáticamente
    if "birth_date" in data and data.get("birth_date") and "age" not in data:
        data["age"] = _calc_age(data["birth_date"])

    # ✅ Aplicar cambios (incluye ficha si viene en payload)
    for field, value in data.items():
        setattr(patient, field, value)

    patient.updated_by = current_user.id
    patient.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(patient)
    return patient


@router.delete("/{patient_id}")
def delete_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(ALLOWED_ROLES))
):
    patient = _patient_access_query(db, current_user, patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado o sin acceso")

    now = datetime.utcnow()

    # 1) Desactivar paciente (soft delete)
    patient.is_active = False
    patient.updated_by = current_user.id
    patient.updated_at = now

    # 2) Desactivar TODAS las citas activas de ese paciente
    appts = db.query(Appointment).filter(
        Appointment.patient_id == patient_id,
        Appointment.is_active == True
    ).all()

    for ap in appts:
        ap.is_active = False
        ap.status = "cancelled"   # para que quede coherente
        ap.updated_by = current_user.id
        ap.updated_at = now

    # 3) Desactivar TODAS las notas activas de ese paciente
    notes = db.query(Note).filter(
        Note.patient_id == patient_id,
        Note.is_active == True
    ).all()

    for n in notes:
        n.is_active = False
        n.updated_by = current_user.id
        n.updated_at = now

    db.commit()

    return {"message": "Paciente y registros relacionados desactivados correctamente"}