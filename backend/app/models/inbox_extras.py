import enum
import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, Text, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, UUIDMixin


class ConvStatus(str, enum.Enum):
    open = "open"
    resolved = "resolved"


class ConversationState(UUIDMixin, Base):
    """Per-phone open/resolved status + AI-reply toggle for the WhatsApp inbox."""
    __tablename__ = "conversation_states"

    phone: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    status: Mapped[ConvStatus] = mapped_column(SAEnum(ConvStatus), default=ConvStatus.open)
    # When False, the AI assistant stops auto-replying to this phone — a staff member
    # has taken the conversation over manually. Defaults True (AI replies as normal).
    ai_enabled: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
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
