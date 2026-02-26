# app/routers/appointment_blocks.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import ProgrammingError, OperationalError
from typing import List, Optional
from datetime import datetime

from app.db.deps import get_db
from app.core.auth import get_current_user, require_roles
from app.core.permissions import ensure_can_delete_block

from app.models.user import User
from app.models.appointment_block import AppointmentBlock

from app.schemas.appointment_block import (
    AppointmentBlockCreate,
    AppointmentBlockUpdate,
    AppointmentBlockResponse
)

router = APIRouter(prefix="/appointments/blocks", tags=["Appointment Blocks"])

ALLOWED_ROLES = ["admin", "psychologist", "assistant"]


# =========================
# Helpers: 1 psicóloga
# =========================
def get_owner_user(db: Session) -> User:
    owner = db.query(User).filter(
        User.role == "psychologist",
        User.is_active == True
    ).first()
    if not owner:
        raise HTTPException(status_code=500, detail="No existe usuario con rol 'psychologist'")
    return owner


def get_target_user_id(db: Session, current_user: User) -> int:
    if current_user.role == "assistant":
        return get_owner_user(db).id
    return current_user.id


def _validate_block_range(start_time: datetime, end_time: datetime):
    if end_time <= start_time:
        raise HTTPException(status_code=400, detail="end_time debe ser mayor a start_time")


def _table_missing_exc(e: Exception) -> bool:
    """
    Detecta cuando NO existe la tabla appointment_blocks (o hay problema similar).
    """
    msg = str(e).lower()
    return ("appointment_blocks" in msg) and ("does not exist" in msg or "no existe" in msg)


def _safe_list_query(db: Session, current_user: User):
    """
    ✅ Si la tabla NO existe / no migraste, NO truena.
    Devuelve [] y el frontend deja de marcar CORS.
    """
    try:
        q = db.query(AppointmentBlock).filter(AppointmentBlock.is_active == True)

        if current_user.role != "admin":
            target_user_id = get_target_user_id(db, current_user)
            q = q.filter(AppointmentBlock.user_id == target_user_id)

        return q.order_by(AppointmentBlock.start_time.asc()).all()

    except (ProgrammingError, OperationalError) as e:
        # Si la tabla no existe, devolvemos lista vacía (para que el UI no muera)
        if _table_missing_exc(e):
            return []
        # si es otra cosa, sí lo reportamos
        raise


def _validate_block_overlap(
    db: Session,
    user_id: int,
    start_time: datetime,
    end_time: datetime,
    exclude_id: Optional[int] = None
):
    """
    ✅ Detecta traslapes.
    Si la tabla NO existe, manda error claro (no CORS).
    """
    try:
        q = db.query(AppointmentBlock).filter(
            AppointmentBlock.is_active == True,
            AppointmentBlock.user_id == user_id
        )
        if exclude_id is not None:
            q = q.filter(AppointmentBlock.id != exclude_id)

        blocks = q.all()

    except (ProgrammingError, OperationalError) as e:
        if _table_missing_exc(e):
            raise HTTPException(
                status_code=500,
                detail="La tabla appointment_blocks no existe en la BD. Ejecuta migraciones/creación de tablas."
            )
        raise

    for b in blocks:
        overlap = (start_time < b.end_time) and (b.start_time < end_time)
        if overlap:
            raise HTTPException(status_code=400, detail="Ya existe un bloqueo que traslapa ese horario")


# =========================
# Endpoints
# =========================
@router.post("/", response_model=AppointmentBlockResponse)
def create_block(
    data: AppointmentBlockCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(ALLOWED_ROLES))
):
    _validate_block_range(data.start_time, data.end_time)

    target_user_id = get_target_user_id(db, current_user)
    _validate_block_overlap(db, target_user_id, data.start_time, data.end_time)

    try:
        block = AppointmentBlock(
            user_id=target_user_id,
            start_time=data.start_time,
            end_time=data.end_time,
            reason=data.reason,
            created_by=current_user.id
        )
        db.add(block)
        db.commit()
        db.refresh(block)
        return block

    except (ProgrammingError, OperationalError) as e:
        db.rollback()
        if _table_missing_exc(e):
            raise HTTPException(
                status_code=500,
                detail="No existe la tabla appointment_blocks en tu BD. Ejecuta migraciones/creación de tablas."
            )
        raise


@router.get("/", response_model=List[AppointmentBlockResponse])
def list_blocks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # ✅ Esto evita el 500 y por ende el “CORS missing allow origin”
    return _safe_list_query(db, current_user)


@router.put("/{block_id}", response_model=AppointmentBlockResponse)
def update_block(
    block_id: int,
    data: AppointmentBlockUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(ALLOWED_ROLES))
):
    try:
        q = db.query(AppointmentBlock).filter(
            AppointmentBlock.id == block_id,
            AppointmentBlock.is_active == True
        )

        if current_user.role != "admin":
            target_user_id = get_target_user_id(db, current_user)
            q = q.filter(AppointmentBlock.user_id == target_user_id)

        block = q.first()

    except (ProgrammingError, OperationalError) as e:
        if _table_missing_exc(e):
            raise HTTPException(
                status_code=500,
                detail="No existe la tabla appointment_blocks en tu BD. Ejecuta migraciones/creación de tablas."
            )
        raise

    if not block:
        raise HTTPException(status_code=404, detail="Bloqueo no encontrado o sin acceso")

    new_start = data.start_time if data.start_time is not None else block.start_time
    new_end = data.end_time if data.end_time is not None else block.end_time
    _validate_block_range(new_start, new_end)

    _validate_block_overlap(db, block.user_id, new_start, new_end, exclude_id=block.id)

    for field, value in data.dict(exclude_unset=True).items():
        setattr(block, field, value)

    block.updated_by = current_user.id
    block.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(block)
    return block


@router.delete("/{block_id}")
def delete_block(
    block_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(ALLOWED_ROLES))
):
    ensure_can_delete_block(current_user)

    try:
        q = db.query(AppointmentBlock).filter(
            AppointmentBlock.id == block_id,
            AppointmentBlock.is_active == True
        )

        if current_user.role != "admin":
            target_user_id = get_target_user_id(db, current_user)
            q = q.filter(AppointmentBlock.user_id == target_user_id)

        block = q.first()

    except (ProgrammingError, OperationalError) as e:
        if _table_missing_exc(e):
            raise HTTPException(
                status_code=500,
                detail="No existe la tabla appointment_blocks en tu BD. Ejecuta migraciones/creación de tablas."
            )
        raise

    if not block:
        raise HTTPException(status_code=404, detail="Bloqueo no encontrado o sin acceso")

    block.is_active = False
    block.updated_by = current_user.id
    block.updated_at = datetime.utcnow()

    db.commit()
    return {"message": "Bloqueo desactivado correctamente"}