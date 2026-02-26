from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordRequestForm
import os

from app.schemas.user import UserCreate
from app.models.user import User
from app.db.deps import get_db
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token
)

router = APIRouter(prefix="/auth", tags=["Auth"])

# ✅ Por defecto NO permite registro público
# (Solo si en .env pones ALLOW_PUBLIC_REGISTER=true)
ALLOW_PUBLIC_REGISTER = os.getenv("ALLOW_PUBLIC_REGISTER", "false").lower() == "true"


# -------------------------
# REGISTER (solo si se habilita)
# -------------------------
@router.post("/register")
def register(user: UserCreate, db: Session = Depends(get_db)):

    # ✅ Si ya decidiste "solo admin crea usuarios", bloquea aquí
    if not ALLOW_PUBLIC_REGISTER:
        raise HTTPException(
            status_code=403,
            detail="Registro público deshabilitado. El admin debe crear usuarios."
        )

    existing = db.query(User).filter(User.email == user.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email ya registrado")

    # ✅ Seguridad: nadie se registra como admin desde aquí
    allowed_roles = ["psychologist", "assistant"]
    role = user.role if user.role in allowed_roles else "psychologist"

    new_user = User(
        email=user.email,
        password=hash_password(user.password),
        role=role,
        is_active=True  # ✅ por si tu modelo lo maneja
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {"message": "Usuario creado correctamente"}


# -------------------------
# LOGIN (OAuth2 estándar)
# -------------------------
@router.post("/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    # OAuth2 usa "username" como campo del email
    user = db.query(User).filter(User.email == form_data.username).first()

    if not user:
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")

    # ✅ Si tu modelo tiene is_active (por tu screenshot sí)
    if hasattr(user, "is_active") and not user.is_active:
        raise HTTPException(status_code=401, detail="Usuario desactivado")

    if not verify_password(form_data.password, user.password):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")

    access_token = create_access_token(
        data={"sub": user.email, "role": user.role}
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "email": user.email,
        "role": user.role
    }
