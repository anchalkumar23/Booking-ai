import enum
import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, UUIDMixin


class ScheduledCallKind(str, enum.Enum):
    lead = "lead"
    promo = "promo"


class ScheduledCallStatus(str, enum.Enum):
    pending = "pending"
    sent = "sent"
    failed = "failed"


class ScheduledCall(UUIDMixin, Base):
    """A single outbound Bolna call queued to fire at due_at.

    Bulk lead/campaign calls are staggered by writing rows here (with increasing due_at)
    rather than as long-lived Celery countdown tasks — the DB poller dispatch_due_calls
    fires them when due, so they survive worker restarts and deploys.
    """
    __tablename__ = "scheduled_calls"

    kind: Mapped[ScheduledCallKind] = mapped_column(SAEnum(ScheduledCallKind), nullable=False)
    phone: Mapped[str] = mapped_column(String, nullable=False)
    ref_id: Mapped[str | None] = mapped_column(String, nullable=True)  # lead_id or campaign_id
    variables: Mapped[dict] = mapped_column(JSONB, default=dict)
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    status: Mapped[ScheduledCallStatus] = mapped_column(
        SAEnum(ScheduledCallStatus), default=ScheduledCallStatus.pending, index=True
    )
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
