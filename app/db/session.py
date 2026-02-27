import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# 1. Obtener la URL de Railway
DATABASE_URL = os.getenv("DATABASE_URL")

# 2. Validación y Parche de compatibilidad
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL no encontrada. Configúrala en el Dashboard de Railway.")

# ✅ CORRECCIÓN AQUÍ: Si empieza con 'postgres://', cámbialo a 'postgresql://'
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# 3. Crear el Engine con optimización para la nube
engine = create_engine(
    DATABASE_URL, 
    pool_pre_ping=True,  # Vital para no perder la conexión
    pool_size=10,
    max_overflow=20
)

# 4. Configurar la Sesión
SessionLocal = sessionmaker(
    autocommit=False, 
    autoflush=False, 
    bind=engine
)

# Función para tus rutas de FastAPI
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()