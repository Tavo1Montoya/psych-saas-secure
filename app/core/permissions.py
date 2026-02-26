# app/core/permissions.py
from datetime import datetime
from fastapi import HTTPException
from app.models.user import User
from app.models.appointment import Appointment
# app/core/permissions.py
from fastapi import HTTPException
from app.models.user import User


FINAL_STATES = {"completed", "cancelled", "no-show"}

def ensure_can_delete_block(current_user: User) -> None:
    # Admin y psychologist sí pueden
    if current_user.role in ("admin", "psychologist"):
        return

    # Assistant NO
    raise HTTPException(status_code=403, detail="Assistant no puede eliminar bloqueos de agenda")

def _is_past(appt: Appointment) -> bool:
    # "pasada" = ya inició antes de ahora (UTC)
    return appt.start_time < datetime.utcnow()


def ensure_can_edit_appointment(current_user: User, appt: Appointment) -> None:
    """
    Reglas finas para EDITAR (PUT) una cita.
    """
    # Admin puede todo
    if current_user.role == "admin":
        return

    # Assistant: no editar citas pasadas ni cerradas
    if current_user.role == "assistant":
        if _is_past(appt):
            raise HTTPException(status_code=403, detail="Assistant no puede modificar citas pasadas")
        if appt.status in FINAL_STATES:
            raise HTTPException(status_code=403, detail=f"Assistant no puede modificar citas en estado '{appt.status}'")
        return

    # Psychologist: por ahora permitimos editar mientras no esté completed/no-show/cancelled si tú lo deseas
    # (Si tú ya bloqueaste completed en update, se mantiene)
    return


def ensure_can_cancel_appointment(current_user: User, appt: Appointment) -> None:
    """
    Reglas finas para CANCELAR (DELETE o PUT status='cancelled') una cita.
    """
    if current_user.role == "admin":
        return

    if current_user.role == "assistant":
        if _is_past(appt):
            raise HTTPException(status_code=403, detail="Assistant no puede cancelar citas pasadas")
        if appt.status == "completed":
            raise HTTPException(status_code=403, detail="Assistant no puede cancelar citas completadas")
        if appt.status in {"cancelled"}:
            raise HTTPException(status_code=400, detail="La cita ya está cancelada")
        return

    # psychologist: permitimos cancelar si no está completed
    if current_user.role == "psychologist":
        if appt.status == "completed":
            raise HTTPException(status_code=403, detail="No puedes cancelar una cita completada")
        return


def ensure_can_mark_no_show(current_user: User, appt: Appointment) -> None:
    """
    Reglas finas para marcar no-show.
    """
    if current_user.role == "admin":
        return

    if current_user.role == "assistant":
        # NO marcar no-show de citas futuras
        if appt.start_time > datetime.utcnow():
            raise HTTPException(status_code=403, detail="Assistant no puede marcar no-show una cita futura")
        if appt.status in FINAL_STATES:
            raise HTTPException(status_code=403, detail=f"No puedes marcar no-show desde estado '{appt.status}'")
        return

    # psychologist: permitir no-show si ya pasó y no está final
    if current_user.role == "psychologist":
        if appt.start_time > datetime.utcnow():
            raise HTTPException(status_code=400, detail="No puedes marcar no-show una cita futura")
        if appt.status in FINAL_STATES:
            raise HTTPException(status_code=400, detail=f"Esta cita ya está en estado '{appt.status}'")
        return


def ensure_can_complete_appointment(current_user: User, appt: Appointment) -> None:
    """
    Reglas finas para completar cita.
    """
    if current_user.role == "admin":
        return

    if current_user.role == "assistant":
        # assistant NO completa (solo psychologist/admin)
        raise HTTPException(status_code=403, detail="Assistant no puede completar citas")

    if current_user.role == "psychologist":
        if appt.status in FINAL_STATES:
            raise HTTPException(status_code=400, detail=f"No puedes completar desde estado '{appt.status}'")
        return


def ensure_can_delete_block(current_user: User) -> None:
    """
    Bloqueos: assistant NO puede borrar.
    """
    if current_user.role == "assistant":
        raise HTTPException(status_code=403, detail="Assistant no puede eliminar bloqueos de agenda")
    
    