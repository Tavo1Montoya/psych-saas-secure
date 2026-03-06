from pydantic import BaseModel
from typing import List, Literal, Optional

SlotStatus = Literal["free", "booked", "blocked"]


class CalendarDaySummary(BaseModel):
    date: str  # YYYY-MM-DD
    booked: int = 0
    completed: int = 0
    cancelled: int = 0
    all_day_blocked: bool = False


class CalendarEventsResponse(BaseModel):
    from_date: str
    to_date: str
    days: List[CalendarDaySummary]


class DaySlot(BaseModel):
    start: str  # "HH:MM"
    end: str    # "HH:MM"
    status: SlotStatus


class DaySlotsResponse(BaseModel):
    date: str
    slot_minutes: int
    working_hours: Optional[dict] = None
    slots: List[DaySlot]