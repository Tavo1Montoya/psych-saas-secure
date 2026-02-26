from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class AppointmentBlockBase(BaseModel):
    start_time: datetime
    end_time: datetime
    reason: Optional[str] = None


class AppointmentBlockCreate(AppointmentBlockBase):
    pass


class AppointmentBlockUpdate(BaseModel):
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    reason: Optional[str] = None
    is_active: Optional[bool] = None


class AppointmentBlockResponse(AppointmentBlockBase):
    id: int
    user_id: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    created_by: Optional[int] = None
    updated_by: Optional[int] = None

    class Config:
        from_attributes = True