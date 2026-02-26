from sqlalchemy import Column, Integer, String, Boolean
from sqlalchemy.orm import relationship, synonym
from app.db.base_class import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)

    # ✅ IMPORTANTE: aquí guardamos el HASH (no el texto plano)
    password = Column(String, nullable=False)

    # ✅ Alias para que el resto del proyecto pueda usar "hashed_password"
    hashed_password = synonym("password")

    role = Column(String, default="assistant")
    is_active = Column(Boolean, default=True)

    patients = relationship("Patient", back_populates="owner")

    appointments = relationship(
        "Appointment",
        back_populates="user",
        foreign_keys="Appointment.user_id"
    )

    # ✅ NOTAS: separa las 3 rutas FK para evitar AmbiguousForeignKeysError
    notes = relationship(
        "Note",
        back_populates="owner",
        foreign_keys="Note.user_id"
    )

    notes_created = relationship(
        "Note",
        back_populates="creator",
        foreign_keys="Note.created_by"
    )

    notes_updated = relationship(
        "Note",
        back_populates="updater",
        foreign_keys="Note.updated_by"
    )