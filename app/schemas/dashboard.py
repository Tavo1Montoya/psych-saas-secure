# app/schemas/dashboard.py
from pydantic import BaseModel
from typing import Optional


class DashboardMetrics(BaseModel):
    # Pacientes
    total_patients_active: int
    new_patients_in_range: int

    # Citas
    total_appointments_in_range: int
    scheduled_appointments_in_range: int
    cancelled_appointments_in_range: int

    # Notas clínicas
    total_notes_in_range: int

    # Utilización (minutos)
    booked_minutes_in_range: int
    available_minutes_in_range: int
    utilization_percent: float

    class Config:
        from_attributes = True


class AppointmentsByDayPoint(BaseModel):
    date: str  # "YYYY-MM-DD"
    total: int
    scheduled: int
    cancelled: int


class UpcomingAppointmentItem(BaseModel):
    id: int
    patient_id: int
    user_id: int

    # ✅ NUEVO: para que "Próximas citas" muestre nombre
    patient_name: Optional[str] = None

    start_time: str  # ISO string
    duration_minutes: int
    status: Optional[str] = None