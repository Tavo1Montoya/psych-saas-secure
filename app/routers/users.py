from fastapi import APIRouter, Depends
from app.core.security import get_current_user
from app.models.user import User
from app.core.deps import require_roles

router = APIRouter(
    prefix="/users",
    tags=["Users"]
)

@router.get("/me")
def read_current_user(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "role": current_user.role,
        "is_active": current_user.is_active
    }
@router.get("/admin-only")
def admin_route(current_user: User = Depends(require_roles(["admin"]))):
    return {
        "message": "Bienvenido administrador",
        "email": current_user.email
    }