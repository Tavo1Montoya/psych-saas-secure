import os
import uvicorn
from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Cargar variables
load_dotenv()

# ✅ Base y engine
from app.db.base_class import Base
from app.db.session import engine

# ✅ Importar modelos
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

# ✅ MEJORA CORS: Lista extendida para asegurar comunicación total
origins = [
    "http://localhost:5173",
    "http://localhost:8080",
    "http://localhost:8000",
    "https://frontend-production-24ac.up.railway.app", # Tu URL de frontend
    "*", 
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    try:
        # Esto confirma la conexión que ya vimos exitosa en tus logs
        with engine.connect() as connection:
            print("--- Conexión a Base de Datos EXITOSA ---")
    except Exception as e:
        print(f"--- ERROR conectando a la DB: {e} ---")

@app.get("/")
def root():
    return {"status": "online", "message": "Psych SaaS API running"}

@app.get("/health")
def health():
    return {"status": "ok"}

# ✅ Registro de Routers (Sin cambios para no dañar rutas)
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

# ✅ MEJORA MAESTRA: Sincronización de puerto con Railway
if __name__ == "__main__":
    # Si Railway detecta puerto 8080 en logs, aquí lo forzamos a leer la variable PORT
    port = int(os.environ.get("PORT", 8080)) 
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=False)