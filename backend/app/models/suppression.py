import enum
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, UUIDMixin


class SuppressionReason(str, enum.Enum):
    opt_out = "opt_out"
    not_interested = "not_interested"
    dnd = "dnd"
    manual = "manual"


class SuppressionSource(str, enum.Enum):
    call = "call"
    whatsapp = "whatsapp"
    dashboard = "dashboard"


class SuppressionList(UUIDMixin, Base):
    __tablename__ = "suppression_list"

    phone: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    reason: Mapped[SuppressionReason] = mapped_column(SAEnum(SuppressionReason), nullable=False)
    source: Mapped[SuppressionSource] = mapped_column(SAEnum(SuppressionSource), nullable=False)
    suppressed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
