import enum
from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, UUIDMixin


class WADirection(str, enum.Enum):
    inbound = "inbound"
    outbound = "outbound"


class WAMessageType(str, enum.Enum):
    template = "template"
    session = "session"


class WAStatus(str, enum.Enum):
    sent = "sent"
    delivered = "delivered"
    read = "read"
    failed = "failed"
    replied = "replied"


class WhatsAppMessage(UUIDMixin, Base):
    __tablename__ = "whatsapp_messages"

    wa_message_id: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    phone: Mapped[str] = mapped_column(String, nullable=False, index=True)
    direction: Mapped[WADirection] = mapped_column(SAEnum(WADirection), nullable=False)
    message_type: Mapped[WAMessageType] = mapped_column(SAEnum(WAMessageType), nullable=False)
    template_name: Mapped[str | None] = mapped_column(String, nullable=True)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[WAStatus] = mapped_column(SAEnum(WAStatus), default=WAStatus.sent)
    sent_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
