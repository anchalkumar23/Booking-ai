import enum
from datetime import datetime, timezone
from sqlalchemy import String, Float, Integer, Text, DateTime, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, UUIDMixin


class CallDirection(str, enum.Enum):
    inbound = "inbound"
    outbound = "outbound"


class CallPurpose(str, enum.Enum):
    booking = "booking"
    reminder = "reminder"
    renewal = "renewal"
    lead = "lead"
    inbound = "inbound"


class CallOutcome(str, enum.Enum):
    booked = "booked"
    rescheduled = "rescheduled"
    busy = "busy"
    not_interested = "not_interested"
    no_answer = "no_answer"
    transferred = "transferred"
    low_confidence = "low_confidence"
    failed = "failed"


class CallLog(UUIDMixin, Base):
    __tablename__ = "call_logs"

    bolna_call_id: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    phone: Mapped[str] = mapped_column(String, nullable=False, index=True)
    direction: Mapped[CallDirection] = mapped_column(SAEnum(CallDirection), nullable=False)
    purpose: Mapped[CallPurpose] = mapped_column(SAEnum(CallPurpose), nullable=False)
    outcome: Mapped[CallOutcome | None] = mapped_column(SAEnum(CallOutcome), nullable=True)
    confidence_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    duration_secs: Mapped[int | None] = mapped_column(Integer, nullable=True)
    transcript: Mapped[str | None] = mapped_column(Text, nullable=True)
    recording_url: Mapped[str | None] = mapped_column(String, nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    called_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
