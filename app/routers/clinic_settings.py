from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import time

from app.db.deps import get_db
from app.core.auth import require_roles, get_current_user
from app.models.user import User
from app.models.clinic_settings import ClinicSettings
from app.schemas.clinic_settings import ClinicSettingsResponse, ClinicSettingsUpdate

router = APIRouter(prefix="/clinic-settings", tags=["Clinic Settings"])

ALLOWED_UPDATE_ROLES = ["admin", "psychologist"]


def get_settings(db: Session) -> ClinicSettings:
    """
    Obtiene la configuración (1 registro).
    Si no existe, la crea con defaults:
    L–D 09:00–21:00
    """
    settings = db.query(ClinicSettings).first()
    if not settings:
        settings = ClinicSettings(
            start_time=time(9, 0),
            end_time=time(21, 0),
            mon=True, tue=True, wed=True, thu=True, fri=True, sat=True, sun=True
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


@router.get("/", response_model=ClinicSettingsResponse, operation_id="get_clinic_settings")
def read_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Cualquier usuario logueado puede ver configuración
    return get_settings(db)


@router.put("/", response_model=ClinicSettingsResponse, operation_id="update_clinic_settings")
def update_settings(
    data: ClinicSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(ALLOWED_UPDATE_ROLES))
):
    settings = get_settings(db)

    # Validaciones mínimas
    if data.start_time >= data.end_time:
        raise HTTPException(status_code=400, detail="start_time debe ser menor que end_time")

    for field, value in data.dict().items():
        setattr(settings, field, value)

    db.commit()
    db.refresh(settings)
    return settings