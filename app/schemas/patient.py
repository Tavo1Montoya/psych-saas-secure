from pydantic import BaseModel, Field
from typing import Optional
from datetime import date, datetime

# =========================
# Inputs
# =========================
class PatientCreate(BaseModel):
    full_name: str = Field(..., min_length=1)
    age: Optional[int] = None
    phone: Optional[str] = None
    birth_date: Optional[date] = None
    notes: Optional[str] = None

    # =========================
    # ✅ FICHA DE IDENTIFICACIÓN (opcional)
    # =========================
    sex: Optional[str] = None  # sexo
    marital_status: Optional[str] = None  # estado civil
    occupation: Optional[str] = None  # ocupación
    workplace: Optional[str] = None  # lugar de trabajo
    work_days: Optional[str] = None  # días laborales (texto)
    work_schedule: Optional[str] = None  # horario laboral (texto)

    birth_place: Optional[str] = None  # lugar de nacimiento
    education: Optional[str] = None  # escolaridad
    religion: Optional[str] = None  # religión
    address: Optional[str] = None  # domicilio

    emergency_contact_name: Optional[str] = None  # contacto emergencia (nombre)
    emergency_contact_phone: Optional[str] = None  # contacto emergencia (teléfono)


class PatientUpdate(BaseModel):
    full_name: Optional[str] = None
    age: Optional[int] = None
    phone: Optional[str] = None
    birth_date: Optional[date] = None
    notes: Optional[str] = None

    # =========================
    # ✅ FICHA DE IDENTIFICACIÓN (opcional)
    # =========================
    sex: Optional[str] = None
    marital_status: Optional[str] = None
    occupation: Optional[str] = None
    workplace: Optional[str] = None
    work_days: Optional[str] = None
    work_schedule: Optional[str] = None

    birth_place: Optional[str] = None
    education: Optional[str] = None
    religion: Optional[str] = None
    address: Optional[str] = None

    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None


# =========================
# Outputs
# =========================
class PatientResponse(BaseModel):
    id: int
    full_name: str
    age: Optional[int] = None
    phone: Optional[str] = None
    birth_date: Optional[date] = None
    notes: Optional[str] = None

    # =========================
    # ✅ FICHA DE IDENTIFICACIÓN (salida)
    # =========================
    sex: Optional[str] = None
    marital_status: Optional[str] = None
    occupation: Optional[str] = None
    workplace: Optional[str] = None
    work_days: Optional[str] = None
    work_schedule: Optional[str] = None

    birth_place: Optional[str] = None
    education: Optional[str] = None
    religion: Optional[str] = None
    address: Optional[str] = None

    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None

    user_id: int
    is_active: bool

    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    # ✅ CLAVE para que FastAPI pueda serializar modelos SQLAlchemy
    class Config:
        from_attributes = True  # Pydantic v2
        # Si estuvieras en Pydantic v1, sería: orm_mode = True