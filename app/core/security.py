from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi.security import OAuth2PasswordBearer
from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.deps import get_db
from app.models.user import User

# ==============================
# 🔐 CONFIGURACIÓN JWT
# ==============================
import os
SECRET_KEY = os.getenv("JWT_SECRET", "dev_only_change_me")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = 43200

# ==============================
# 🔑 ENCRIPTACIÓN
# ==============================

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ==============================
# 🔒 OAUTH2 ESQUEMA
# ==============================

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# ==============================
# 🔐 HASH PASSWORD
# ==============================

def hash_password(password: str):
    return pwd_context.hash(password)

# ✅ Alias para compatibilidad con otros módulos (ej. admin_users.py)
def get_password_hash(password: str):
    return hash_password(password)

# ==============================
# 🔎 VERIFY PASSWORD
# ==============================

def verify_password(plain_password: str, hashed_password: str):
    return pwd_context.verify(plain_password, hashed_password)

# ==============================
# 🎫 CREATE ACCESS TOKEN
# ==============================

def create_access_token(data: dict):
    to_encode = data.copy()

    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})

    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# ==============================
# 👤 GET CURRENT USER
# ==============================

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    credentials_exception = HTTPException(
        status_code=401,
        detail="No autorizado",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")

        if email is None:
            raise credentials_exception

    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.email == email).first()

    if user is None:
        raise credentials_exception

    return user

# ✅ Alias para compatibilidad con imports típicos
def get_password_hash(password: str):
    return hash_password(password)