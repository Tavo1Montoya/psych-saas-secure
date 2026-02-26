from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean, Date
from sqlalchemy.orm import relationship
from datetime import datetime

from app.db.base_class import Base


class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, nullable=False)
    age = Column(Integer, nullable=False)

    # ✅ Campos base
    phone = Column(String, nullable=True)         # teléfono
    birth_date = Column(Date, nullable=True)      # fecha de nacimiento (YYYY-MM-DD)

    # ✅ Ficha de identificación (todo opcional)
    sex = Column(String, nullable=True)  # sexo
    marital_status = Column(String, nullable=True)  # estado civil
    occupation = Column(String, nullable=True)  # ocupación
    workplace = Column(String, nullable=True)  # lugar de trabajo
    work_days = Column(String, nullable=True)  # días laborales (texto)
    work_schedule = Column(String, nullable=True)  # horario laboral (texto)

    birth_place = Column(String, nullable=True)  # lugar de nacimiento
    education = Column(String, nullable=True)  # escolaridad
    religion = Column(String, nullable=True)  # religión
    address = Column(String, nullable=True)  # domicilio

    emergency_contact_name = Column(String, nullable=True)  # contacto emergencia (nombre)
    emergency_contact_phone = Column(String, nullable=True)  # contacto emergencia (teléfono)

    # ✅ Notas del paciente (texto libre)
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

    # ✅ Debe coincidir con User.patients = relationship(..., back_populates="owner")
    owner = relationship("User", back_populates="patients")

    # ✅ Citas del paciente
    appointments = relationship(
        "Appointment",
        back_populates="patient"
        # (opcional) cascade="all, delete-orphan"
    )

    # ✅ Notas clínicas del paciente
    clinical_notes = relationship(
        "Note",
        back_populates="patient",
        cascade="all, delete-orphan"
    )