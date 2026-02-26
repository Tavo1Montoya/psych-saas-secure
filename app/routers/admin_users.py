# app/routers/admin_users.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.db.deps import get_db
from app.core.deps import require_roles
from app.core.security import get_password_hash
from app.models.user import User
from app.schemas.user import AdminUserCreate

router = APIRouter(prefix="/admin/users", tags=["Admin - Users"])

ALLOWED_ROLES = {"admin", "psychologist", "assistant"}


@router.get("/", response_model=List[dict], operation_id="admin_list_users")
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    users = db.query(User).order_by(User.id.desc()).all()
    return [
        {
            "id": u.id,
            "email": u.email,
            "role": u.role,
            "is_active": u.is_active,
        }
        for u in users
    ]


@router.post("/", response_model=dict, operation_id="admin_create_user")
def create_user(
    payload: AdminUserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    email = payload.email.strip().lower()
    role = payload.role.strip().lower()

    if role not in ALLOWED_ROLES:
        raise HTTPException(status_code=400, detail="role inválido (admin, psychologist, assistant)")

    exists = db.query(User).filter(User.email == email).first()
    if exists:
        raise HTTPException(status_code=409, detail="Ya existe un usuario con ese email")

    user = User(
        email=email,
        hashed_password=get_password_hash(payload.password),
        role=role,
        is_active=True,
    )

    # Si tu modelo User NO tiene full_name, no lo asignamos para no romper nada.
    # Si sí lo tiene, descomenta esto:
    # if payload.full_name:
    #     user.full_name = payload.full_name.strip()

    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "id": user.id,
        "email": user.email,
        "role": user.role,
        "is_active": user.is_active,
    }


@router.delete("/{user_id}", response_model=dict, operation_id="admin_deactivate_user")
def deactivate_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado o ya desactivado")

    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="No puedes desactivarte a ti mismo")

    user.is_active = False
    db.commit()
    return {"message": "Usuario desactivado correctamente"}