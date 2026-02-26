from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Text
from sqlalchemy.orm import relationship
from datetime import datetime

from app.db.base_class import Base  # ✅ SIEMPRE el mismo Base del proyecto


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)

    # 🔗 Relaciones FK
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)          # dueño de la agenda
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)       # quién creó
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)       # quién actualizó
    patient = relationship("Patient")

    # 📅 Datos de agenda
    start_time = Column(DateTime, nullable=False)
    duration_minutes = Column(Integer, nullable=False, default=60)

    status = Column(String, nullable=False, default="scheduled")

    # ✅ Texto libre (NO relación)
    notes = Column(Text, nullable=True)

    # 🔥 Soft delete + auditoría timestamps
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True)

    # -------------------------
    # ✅ RELATIONSHIPS
    # -------------------------

    # Paciente de la cita
    patient = relationship("Patient", back_populates="appointments")

    # Dueño de la agenda (psicóloga/asistente/admin según lógica)
    user = relationship("User", foreign_keys=[user_id], back_populates="appointments")

    # Si quieres auditoría navegable (opcional pero recomendable)
    creator = relationship("User", foreign_keys=[created_by])
    updater = relationship("User", foreign_keys=[updated_by])

    # ✅ Notas clínicas relacionadas a la cita (lista)
    clinical_notes = relationship(
        "Note",
        back_populates="appointment",
        cascade="all, delete-orphan"
    )