from pydantic import BaseModel
from typing import Optional, Literal
from datetime import datetime

NoteType = Literal["soap", "general"]


class NoteBase(BaseModel):
    note_type: NoteType = "soap"

    subjective: Optional[str] = None
    objective: Optional[str] = None
    assessment: Optional[str] = None
    plan: Optional[str] = None

    content: Optional[str] = None


class NoteCreate(NoteBase):
    # ✅ Siempre necesitamos paciente
    patient_id: int

    # ✅ Ahora la cita es opcional
    appointment_id: Optional[int] = None


class NoteUpdate(BaseModel):
    # ✅ Permitimos cambiar paciente o cita si hace falta
    patient_id: Optional[int] = None
    appointment_id: Optional[int] = None

    note_type: Optional[NoteType] = None
    subjective: Optional[str] = None
    objective: Optional[str] = None
    assessment: Optional[str] = None
    plan: Optional[str] = None
    content: Optional[str] = None


class NoteResponse(NoteBase):
    id: int
    patient_id: int
    appointment_id: Optional[int] = None
    user_id: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True