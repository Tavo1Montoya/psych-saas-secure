from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import time

from app.db.deps import get_db
from app.core.auth import require_roles
from app.models.user import User
from app.models.clinic_settings import ClinicSettings
from app.schemas.clinic_settings import ClinicSettingsResponse, ClinicSettingsUpdate

router = APIRouter(prefix="/settings", tags=["Settings"])

ALLOWED = ["admin", "psychologist"]


def get_or_create_settings(db: Session) -> ClinicSettings:
    settings = db.query(ClinicSettings).first()
    if settings:
        return settings

    # Default: L-D 09:00-21:00
    settings = ClinicSettings(
        start_time=time(9, 0),
        end_time=time(21, 0),
        mon=True, tue=True, wed=True, thu=True, fri=True, sat=True, sun=True
    )
    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings


@router.get("/", response_model=ClinicSettingsResponse)
def read_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(ALLOWED))
):
    return get_or_create_settings(db)


@router.put("/", response_model=ClinicSettingsResponse)
def update_settings(
    data: ClinicSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(ALLOWED))
):
    settings = get_or_create_settings(db)

    payload = data.dict(exclude_unset=True)
    for k, v in payload.items():
        setattr(settings, k, v)

    # Validación simple
    if settings.start_time >= settings.end_time:
        raise HTTPException(status_code=400, detail="start_time debe ser menor que end_time")

    db.commit()
    db.refresh(settings)
    return settings