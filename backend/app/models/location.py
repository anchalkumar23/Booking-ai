import enum
import uuid
from sqlalchemy import String, Boolean, Text, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import Base, UUIDMixin


class LocationType(str, enum.Enum):
    gym = "gym"
    salon = "salon"
    restaurant = "restaurant"


class Location(UUIDMixin, Base):
    __tablename__ = "locations"

    owner_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    type: Mapped[LocationType] = mapped_column(SAEnum(LocationType), nullable=False)
    city: Mapped[str] = mapped_column(String, nullable=False)
    phone: Mapped[str] = mapped_column(String, nullable=False)
    timezone: Mapped[str] = mapped_column(String, default="Asia/Kolkata")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    password_hash: Mapped[str | None] = mapped_column(String, nullable=True)
    knowledge_base: Mapped[str | None] = mapped_column(Text, nullable=True)
    whatsapp_phone_number_id: Mapped[str | None] = mapped_column(String, nullable=True)
    whatsapp_waba_id: Mapped[str | None] = mapped_column(String, nullable=True)
    whatsapp_access_token: Mapped[str | None] = mapped_column(String, nullable=True)
    whatsapp_display_phone: Mapped[str | None] = mapped_column(String, nullable=True)

    @property
    def whatsapp_connected(self) -> bool:
        return bool(self.whatsapp_phone_number_id and self.whatsapp_access_token)
