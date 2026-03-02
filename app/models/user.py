from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
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

    # =========================================================
    # ✅ NUEVO: vínculo para que una assistant pertenezca a una psicóloga
    # =========================================================
    # - Si role == "assistant": aquí guardas el id de la psicóloga dueña
    # - Si role == "psychologist" o "admin": puede quedar NULL
    owner_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Relación: el "dueño" (psicóloga) de esta assistant
    owner = relationship(
        "User",
        remote_side=[id],
        foreign_keys=[owner_user_id],
        back_populates="assistants",
    )

    # Relación inversa: psicóloga -> lista de assistants
    assistants = relationship(
        "User",
        foreign_keys=[owner_user_id],
        back_populates="owner",
    )
    # =========================================================
    # ✅ Relaciones existentes (NO se dañan)
    # =========================================================

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