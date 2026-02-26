from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from jose import jwt, JWTError
from typing import List, Callable
import os

from app.db.deps import get_db
from app.models.user import User

# ✅ Control de registro público (para /auth/register si lo usas)
ALLOW_PUBLIC_REGISTER = os.getenv("ALLOW_PUBLIC_REGISTER", "false").lower() == "true"

# 📌 URL donde el frontend hará login
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


SECRET_KEY = os.getenv("JWT_SECRET", "dev_only_change_me")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    """
    🔐 Verifica que el usuario exista usando el token.

    ✅ Modo nuevo: token = JWT => se decodifica y se saca el email de 'sub'
    ✅ Modo viejo (compatibilidad): token = email => se busca directo
    """

    email = None

    # --- 1) Intentar decodificar como JWT ---
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
    except JWTError:
        email = None

    # --- 2) Fallback (modo viejo): token era el email ---
    if not email:
        email = token

    user = db.query(User).filter(User.email == email).first()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o usuario inactivo",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


def require_admin(user: User = Depends(get_current_user)):
    """🚨 Permite acceso SOLO a administradores"""
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos de administrador"
        )
    return user


def require_roles(roles: List[str]) -> Callable:
    """
    ✅ Valida que el usuario tenga uno de los roles permitidos.
    Uso:
        Depends(require_roles(["admin", "psychologist"]))
    """
    def _checker(user: User = Depends(get_current_user)):
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para esta acción"
            )
        return user

    return _checker
