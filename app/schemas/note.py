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

    content: Optional[str] = None  # para nota simple


class NoteCreate(NoteBase):
    appointment_id: int


class NoteUpdate(BaseModel):
    note_type: Optional[NoteType] = None
    subjective: Optional[str] = None
    objective: Optional[str] = None
    assessment: Optional[str] = None
    plan: Optional[str] = None
    content: Optional[str] = None


class NoteResponse(NoteBase):
    id: int
    patient_id: int
    appointment_id: int
    user_id: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True