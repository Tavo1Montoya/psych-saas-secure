# app/schemas/timeline.py
from pydantic import BaseModel
from typing import List, Optional, Literal
from datetime import datetime

EventType = Literal["appointment", "note"]


class TimelineEvent(BaseModel):
    event_type: EventType
    at: datetime  # fecha principal para ordenar

    # IDs
    appointment_id: Optional[int] = None
    note_id: Optional[int] = None

    # Appointment fields
    status: Optional[str] = None
    duration_minutes: Optional[int] = None
    start_time: Optional[datetime] = None

    # Note fields
    note_type: Optional[str] = None
    content: Optional[str] = None
    subjective: Optional[str] = None
    objective: Optional[str] = None
    assessment: Optional[str] = None
    plan: Optional[str] = None

    class Config:
        from_attributes = True


class PatientTimelineResponse(BaseModel):
    patient_id: int
    total_events: int
    events: List[TimelineEvent]