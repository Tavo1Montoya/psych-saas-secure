from sqlalchemy import Column, Integer, Time, Boolean, DateTime
from datetime import datetime, time
from app.db.base_class import Base


class ClinicSettings(Base):
    __tablename__ = "clinic_settings"

    id = Column(Integer, primary_key=True, index=True)

    # Horario laboral (24h)
    start_time = Column(Time, nullable=False, default=time(9, 0))  # 08:00
    end_time = Column(Time, nullable=False, default=time(22, 0))   # 22:00

    # Días activos
    mon = Column(Boolean, default=True)
    tue = Column(Boolean, default=True)
    wed = Column(Boolean, default=True)
    thu = Column(Boolean, default=True)
    fri = Column(Boolean, default=True)
    sat = Column(Boolean, default=False)
    sun = Column(Boolean, default=False)

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)