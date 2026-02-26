from sqlalchemy import Column, Integer, DateTime, Boolean, ForeignKey, Text, String
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base_class import Base

class Note(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)

    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=False)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    note_type = Column(String, nullable=False, default="soap")
    subjective = Column(Text, nullable=True)
    objective = Column(Text, nullable=True)
    assessment = Column(Text, nullable=True)
    plan = Column(Text, nullable=True)

    content = Column(Text, nullable=True)

    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True)

    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    # ✅ Relaciones correctas
    patient = relationship("Patient", back_populates="clinical_notes")
    appointment = relationship("Appointment", back_populates="clinical_notes")

    # ✅ Owner real (Note.user_id)
    owner = relationship(
        "User",
        foreign_keys=[user_id],
        back_populates="notes"
    )

    # ✅ Auditoría navegable (created_by / updated_by)
    creator = relationship(
        "User",
        foreign_keys=[created_by],
        back_populates="notes_created"
    )

    updater = relationship(
        "User",
        foreign_keys=[updated_by],
        back_populates="notes_updated"
    )