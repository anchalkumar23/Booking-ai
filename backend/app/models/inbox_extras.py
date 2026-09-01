import enum
import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, UUIDMixin


class ConvStatus(str, enum.Enum):
    open = "open"
    resolved = "resolved"


class ConversationState(UUIDMixin, Base):
    """Per-phone open/resolved status for the WhatsApp inbox."""
    __tablename__ = "conversation_states"

    phone: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    status: Mapped[ConvStatus] = mapped_column(SAEnum(ConvStatus), default=ConvStatus.open)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class CannedReply(UUIDMixin, Base):
    """Reusable quick-reply snippets for the inbox. location_id NULL = available everywhere."""
    __tablename__ = "canned_replies"

    location_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("locations.id"), nullable=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
