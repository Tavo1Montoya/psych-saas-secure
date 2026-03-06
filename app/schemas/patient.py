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

    # ✅ NUEVOS
    expediente_number: Optional[str] = None
    alias: Optional[str] = None

    # ✅ FICHA DE IDENTIFICACIÓN (opcional)
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


class PatientUpdate(BaseModel):
    full_name: Optional[str] = None
    age: Optional[int] = None
    phone: Optional[str] = None
    birth_date: Optional[date] = None
    notes: Optional[str] = None

    # ✅ NUEVOS
    expediente_number: Optional[str] = None
    alias: Optional[str] = None

    # ✅ FICHA DE IDENTIFICACIÓN (opcional)
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

    # ✅ NUEVOS (se devuelven para mostrarlos en UI)
    expediente_number: Optional[str] = None
    alias: Optional[str] = None

    # ✅ FICHA DE IDENTIFICACIÓN (salida)
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

    class Config:
        from_attributes = True