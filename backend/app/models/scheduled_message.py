import enum
import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, UUIDMixin


class ScheduledMessageStatus(str, enum.Enum):
    pending = "pending"
    sent = "sent"
    failed = "failed"


class ScheduledMessage(UUIDMixin, Base):
    """A single WhatsApp template message queued to fire at due_at.

    WhatsApp broadcasts are staggered by writing rows here (increasing due_at) rather
    than as long-lived Celery tasks — the DB poller dispatch_due_messages sends them
    when due, so a worker restart mid-broadcast never drops messages.
    """
    __tablename__ = "scheduled_messages"

    location_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("locations.id"), nullable=False)
    campaign_id: Mapped[str | None] = mapped_column(String, nullable=True)
    phone: Mapped[str] = mapped_column(String, nullable=False)
    template: Mapped[str] = mapped_column(String, nullable=False)
    language: Mapped[str] = mapped_column(String, default="en")
    params: Mapped[list] = mapped_column(JSONB, default=list)  # already-resolved body variable strings
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    status: Mapped[ScheduledMessageStatus] = mapped_column(
        SAEnum(ScheduledMessageStatus), default=ScheduledMessageStatus.pending, index=True
    )
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
