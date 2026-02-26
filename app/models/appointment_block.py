from sqlalchemy import Column, Integer, DateTime, ForeignKey, Boolean, Text
from sqlalchemy.orm import relationship
from datetime import datetime

from app.db.base_class import Base


class AppointmentBlock(Base):
    __tablename__ = "appointment_blocks"

    id = Column(Integer, primary_key=True, index=True)

    # ✅ agenda a la que afecta (psicóloga)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # ✅ rango bloqueado
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)

    reason = Column(Text, nullable=True)

    # 🔥 auditoría + soft delete
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Relaciones
    user = relationship("User", foreign_keys=[user_id])