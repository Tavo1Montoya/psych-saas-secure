# app/schemas/appointment.py

from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime

# ✅ Estados permitidos (ajustado a lo que ya usas)
AppointmentStatus = Literal["scheduled", "confirmed", "cancelled", "completed", "no_show"]


class AppointmentBase(BaseModel):
    patient_id: int = Field(..., examples=[1])
    start_time: datetime = Field(..., examples=["2026-02-11T15:30:00"])
    duration_minutes: int = Field(60, ge=15, le=240, examples=[60])
    status: AppointmentStatus = "scheduled"
    notes: Optional[str] = None

    # ✅ EXTRA: nombre del paciente (para mostrar en frontend)
    # OJO: si el backend NO lo manda, no truena porque es opcional.
    patient_name: Optional[str] = None

    class Config:
        from_attributes = True


class AppointmentCreate(AppointmentBase):
    # ✅ CREATE normalmente NO requiere patient_name,
    # pero dejarlo aquí NO rompe nada (si no lo mandas, se ignora).
    pass


class AppointmentUpdate(BaseModel):
    start_time: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    status: Optional[AppointmentStatus] = None
    notes: Optional[str] = None

    class Config:
        from_attributes = True


class AppointmentResponse(AppointmentBase):
    id: int
    user_id: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    created_by: Optional[int] = None
    updated_by: Optional[int] = None

    class Config:
        from_attributes = True