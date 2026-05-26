import enum
from sqlalchemy import String, Boolean, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, UUIDMixin


class LocationType(str, enum.Enum):
    gym = "gym"
    salon = "salon"
    restaurant = "restaurant"


class Location(UUIDMixin, Base):
    __tablename__ = "locations"

    name: Mapped[str] = mapped_column(String, nullable=False)
    type: Mapped[LocationType] = mapped_column(SAEnum(LocationType), nullable=False)
    city: Mapped[str] = mapped_column(String, nullable=False)
    phone: Mapped[str] = mapped_column(String, nullable=False)
    timezone: Mapped[str] = mapped_column(String, default="Asia/Kolkata")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
