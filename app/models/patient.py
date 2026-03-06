from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean, Date
from sqlalchemy.orm import relationship
from datetime import datetime

from app.db.base_class import Base


class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)

    # ✅ Visible en UI
    full_name = Column(String, nullable=False)
    age = Column(Integer, nullable=False)

    # ✅ NUEVO: N° Expediente (editable, opcional, NO es PK)
    expediente_number = Column(String, nullable=True, index=True)

    # ✅ NUEVO: Alias (opcional)
    alias = Column(String, nullable=True, index=True)

    # ✅ Campos base
    phone = Column(String, nullable=True)
    birth_date = Column(Date, nullable=True)

    # ✅ Ficha de identificación (todo opcional)
    sex = Column(String, nullable=True)
    marital_status = Column(String, nullable=True)
    occupation = Column(String, nullable=True)
    workplace = Column(String, nullable=True)
    work_days = Column(String, nullable=True)
    work_schedule = Column(String, nullable=True)

    birth_place = Column(String, nullable=True)
    education = Column(String, nullable=True)
    religion = Column(String, nullable=True)
    address = Column(String, nullable=True)

    emergency_contact_name = Column(String, nullable=True)
    emergency_contact_phone = Column(String, nullable=True)

    notes = Column(String, nullable=True)

    # 🔐 Dueño del paciente (psicóloga de la agenda)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # 🔥 Auditoría
    created_by = Column(Integer, nullable=True)
    updated_by = Column(Integer, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True)

    # 🔥 Soft delete
    is_active = Column(Boolean, default=True)

    # =========================
    # ✅ Relaciones
    # =========================
    owner = relationship("User", back_populates="patients")

    appointments = relationship(
        "Appointment",
        back_populates="patient"
    )

    clinical_notes = relationship(
        "Note",
        back_populates="patient",
        cascade="all, delete-orphan"
    )