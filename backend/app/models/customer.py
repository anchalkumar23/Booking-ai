import enum
import uuid
from sqlalchemy import String, Boolean, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import Base, UUIDMixin


class Language(str, enum.Enum):
    en = "en"
    hi = "hi"
    ta = "ta"


class Customer(UUIDMixin, Base):
    __tablename__ = "customers"

    location_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("locations.id"), nullable=False
    )
    full_name: Mapped[str] = mapped_column(String, nullable=False)
    phone: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    email: Mapped[str | None] = mapped_column(String, nullable=True)
    language: Mapped[Language] = mapped_column(SAEnum(Language), default=Language.en)
    is_dnd: Mapped[bool] = mapped_column(Boolean, default=False)
    is_suppressed: Mapped[bool] = mapped_column(Boolean, default=False)

    location = relationship("Location", lazy="select")
