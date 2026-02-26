from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from typing import List

from app.db.deps import get_db
from app.models.user import User
from app.core.security import SECRET_KEY, ALGORITHM


# 🔐 Define de dónde FastAPI obtiene el token
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


# 👤 Obtener usuario actual desde el token
def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:  # 👈 buena práctica tipar retorno
    """
    Decodifica el JWT y devuelve el usuario autenticado.
    """

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token inválido o expirado",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        # 🔎 Decodificamos el token
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str | None = payload.get("sub")

        if email is None:
            raise credentials_exception

    except JWTError:
        raise credentials_exception

    # 🔎 Buscamos el usuario en la base de datos
    user = db.query(User).filter(User.email == email).first()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )

    return user


# 🎭 CONTROL DE ROLES (RBAC - Role Based Access Control)
def require_roles(allowed_roles: List[str]):
    """
    Permite restringir acceso a ciertos roles.
    Ejemplo:
    Depends(require_roles(["psychologist", "assistant"]))
    """

    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para acceder a este recurso"
            )
        return current_user

    return role_checker
