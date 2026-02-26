from pydantic import BaseModel
from datetime import time


class ClinicSettingsBase(BaseModel):
    start_time: time
    end_time: time

    mon: bool
    tue: bool
    wed: bool
    thu: bool
    fri: bool
    sat: bool
    sun: bool


class ClinicSettingsUpdate(ClinicSettingsBase):
    """
    Para actualizar configuración completa.
    (Lo dejamos completo para hacerlo simple y claro en Swagger)
    """
    pass


class ClinicSettingsResponse(ClinicSettingsBase):
    id: int

    class Config:
        from_attributes = True