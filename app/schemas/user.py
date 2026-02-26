from pydantic import BaseModel, EmailStr, Field
from typing import Literal, Optional

# ✅ Roles permitidos
UserRole = Literal["admin", "psychologist", "assistant"]


# 🔹 Para registrar usuarios (si lo usas en /auth/register)
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: UserRole


# 🔹 Para login (NO necesita role)
class UserLogin(BaseModel):
    email: EmailStr
    password: str


# ✅ NUEVO: Para que el ADMIN cree usuarios desde Swagger/panel admin
class AdminUserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    role: UserRole
    full_name: Optional[str] = None  # opcional por si luego lo quieres mostrar en UI