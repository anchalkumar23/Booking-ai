import enum
import uuid
from datetime import datetime
from sqlalchemy import Integer, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import Base, UUIDMixin


class StepChannel(str, enum.Enum):
    whatsapp = "whatsapp"
    call = "call"


class StepStatus(str, enum.Enum):
    pending = "pending"
    sent = "sent"
    delivered = "delivered"
    replied = "replied"
    failed = "failed"


class LeadSequenceStep(UUIDMixin, Base):
    __tablename__ = "lead_sequence_steps"

    lead_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("leads.id"), nullable=False)
    step_number: Mapped[int] = mapped_column(Integer, nullable=False)
    channel: Mapped[StepChannel] = mapped_column(SAEnum(StepChannel), nullable=False)
    status: Mapped[StepStatus] = mapped_column(SAEnum(StepStatus), default=StepStatus.pending)
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    lead = relationship("Lead", lazy="select")
