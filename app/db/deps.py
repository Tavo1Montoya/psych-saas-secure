from app.db.session import SessionLocal


# 🔹 Dependency que abre y cierra la conexión a la DB
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
