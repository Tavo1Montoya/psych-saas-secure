from fastapi import APIRouter, Depends
from app.core.auth import require_admin
from app.models.user import User

router = APIRouter(
    prefix="/admin",
    tags=["Admin"]
)

@router.get("/dashboard")
def admin_dashboard(current_user: User = Depends(require_admin)):
    return {
        "message": "Bienvenido al panel de administrador",
        "user": current_user.email
    }
