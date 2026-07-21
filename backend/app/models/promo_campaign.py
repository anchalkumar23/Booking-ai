import enum
import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Integer, Text, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import Base, UUIDMixin


class CampaignAudience(str, enum.Enum):
    all_customers = "all_customers"      # every customer at the location
    members_by_tier = "members_by_tier"  # customers with a membership of a given tier
    expiring_members = "expiring_members"  # memberships expiring soon or already lapsed
    leads = "leads"                      # people in the Leads list


class CampaignStatus(str, enum.Enum):
    running = "running"
    completed = "completed"
    failed = "failed"


class PromoCampaign(UUIDMixin, Base):
    __tablename__ = "promo_campaigns"

    location_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("locations.id"), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)  # the offer the AI pitches on the call
    audience: Mapped[CampaignAudience] = mapped_column(SAEnum(CampaignAudience), nullable=False)
    # Optional refinements depending on audience:
    tier: Mapped[str | None] = mapped_column(String, nullable=True)          # for members_by_tier
    expiring_days: Mapped[int | None] = mapped_column(Integer, nullable=True)  # for expiring_members
    lead_status: Mapped[str | None] = mapped_column(String, nullable=True)   # for leads

    status: Mapped[CampaignStatus] = mapped_column(SAEnum(CampaignStatus), default=CampaignStatus.running)
    total_targets: Mapped[int] = mapped_column(Integer, default=0)   # matched after suppression/DND filtering
    calls_queued: Mapped[int] = mapped_column(Integer, default=0)
    skipped: Mapped[int] = mapped_column(Integer, default=0)         # suppressed / DND / no phone

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
