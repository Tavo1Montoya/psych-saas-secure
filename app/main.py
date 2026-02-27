import os
from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Cargar variables (Railway ya las inyecta, pero esto no estorba)
load_dotenv()

# ✅ Base y engine
from app.db.base_class import Base
from app.db.session import engine

# ✅ Importar modelos (Importante para SQLAlchemy)
from app.models.user import User
from app.models.patient import Patient
from app.models.appointment import Appointment
from app.models.note import Note
from app.models.clinic_settings import ClinicSettings
from app.models.appointment_block import AppointmentBlock

# ✅ Importar Routers
from app.routers import admin_users
from app.routers.auth import router as auth_router
from app.routers.admin import router as admin_router
from app.routers.users import router as users_router
from app.routers.patients import router as patients_router
from app.routers.appointments import router as appointments_router
from app.routers.notes import router as notes_router
from app.routers.clinical import router as clinical_router
from app.routers.settings import router as settings_router
from app.routers.clinic_settings import router as clinic_settings_router
from app.routers.appointment_blocks import router as appointment_blocks_router
from app.routers.dashboard import router as dashboard_router
from app.routers.timeline import router as timeline_router

app = FastAPI(title="Psych SaaS API")

# ✅ Configuración de CORS: Agregué "*" para que Railway no te bloquee el Frontend
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "*", # Permite que el dominio de Railway del frontend se conecte
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ Evento de Inicio: Esto evita que la app se muera si la DB tarda en responder
@app.on_event("startup")
def startup_event():
    try:
        with engine.connect() as connection:
            print("--- Conexión a Base de Datos EXITOSA ---")
    except Exception as e:
        print(f"--- ERROR conectando a la DB: {e} ---")

# ✅ Rutas de salud (Solo una de cada una, eliminé duplicados)
@app.get("/")
def root():
    return {"status": "online", "message": "Psych SaaS API running"}

@app.get("/health")
def health():
    return {"status": "ok"}

# ✅ Registrar routers (Manteniendo tu orden)
app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(users_router)
app.include_router(patients_router)
app.include_router(appointments_router)
app.include_router(notes_router)
app.include_router(clinical_router)
app.include_router(settings_router)
app.include_router(clinic_settings_router)
app.include_router(appointment_blocks_router)
app.include_router(dashboard_router)
app.include_router(timeline_router)
app.include_router(admin_users.router)