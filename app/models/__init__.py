# app/models/__init__.py
# Importar TODOS los modelos aquí para que Alembic los detecte.
from app.models.user import User
from app.models.patient import Patient
from app.models.appointment import Appointment

# ✅ Si ya existe app/models/note.py, este import la registra
from app.models.note import Note  # <- IMPORTANTE