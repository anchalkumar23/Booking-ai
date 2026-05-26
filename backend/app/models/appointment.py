import enum
import uuid
from datetime import datetime
from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, Enum as SAEnum, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import Base, UUIDMixin


class AppointmentStatus(str, enum.Enum):
    scheduled = "scheduled"
    completed = "completed"
    cancelled = "cancelled"
    no_show = "no_show"


class BookedVia(str, enum.Enum):
    call = "call"
    whatsapp = "whatsapp"
    dashboard = "dashboard"


class Appointment(UUIDMixin, Base):
    __tablename__ = "appointments"
    __table_args__ = (
        UniqueConstraint("location_id", "scheduled_at", name="uq_location_slot"),
    )

    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=False)
    location_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("locations.id"), nullable=False)
    service: Mapped[str] = mapped_column(String, nullable=False)
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    duration_mins: Mapped[int] = mapped_column(Integer, default=60)
    status: Mapped[AppointmentStatus] = mapped_column(SAEnum(AppointmentStatus), default=AppointmentStatus.scheduled)
    gcal_event_id: Mapped[str | None] = mapped_column(String, nullable=True)
    booked_via: Mapped[BookedVia] = mapped_column(SAEnum(BookedVia), nullable=False)
    reminder_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    staff_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("staff.id"), nullable=True
    )
