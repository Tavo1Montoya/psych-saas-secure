import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# 1. Obtener la URL de Railway
DATABASE_URL = os.getenv("DATABASE_URL")

# 2. Validación y Parche de compatibilidad
if not DATABASE_URL:
    # Esto solo saltará si olvidaste poner la variable en el Dashboard
    raise RuntimeError("DATABASE_URL no encontrada. Configúrala en el Dashboard de Railway.")

# Railway usa 'postgres://', pero SQLAlchemy 1.4+ requiere 'postgresql://'
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# 3. Crear el Engine con optimización para la nube
# pool_pre_ping asegura que si Railway reinicia la DB, la app no falle al reconectar
engine = create_engine(
    DATABASE_URL, 
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20
)

# 4. Configurar la Sesión
SessionLocal = sessionmaker(
    autocommit=False, 
    autoflush=False, 
    bind=engine
)

# Función útil para tus rutas de FastAPI
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()