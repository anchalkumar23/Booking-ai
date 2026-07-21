import enum
import uuid
from datetime import date
from sqlalchemy import String, Boolean, Integer, Date, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column
from typing import Optional
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import Base, UUIDMixin
from app.models.customer import Language


class LeadStatus(str, enum.Enum):
    new = "new"
    contacted = "contacted"
    interested = "interested"
    converted = "converted"
    not_interested = "not_interested"


class Lead(UUIDMixin, Base):
    __tablename__ = "leads"

    location_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("locations.id"), nullable=False)
    full_name: Mapped[str] = mapped_column(String, nullable=False)
    phone: Mapped[str] = mapped_column(String, nullable=False, index=True)
    language: Mapped[Language] = mapped_column(SAEnum(Language), default=Language.en)
    source: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[LeadStatus] = mapped_column(SAEnum(LeadStatus), default=LeadStatus.new)
    wa_sequence_step: Mapped[int] = mapped_column(Integer, default=0)
    wa_stopped: Mapped[bool] = mapped_column(Boolean, default=False)
    call_stopped: Mapped[bool] = mapped_column(Boolean, default=False)
    follow_up_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    wa_last_error: Mapped[Optional[str]] = mapped_column(String, nullable=True)
