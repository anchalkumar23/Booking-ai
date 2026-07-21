from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import uuid

from app.models.promo_campaign import CampaignAudience, CampaignStatus


class CampaignCreate(BaseModel):
    location_id: uuid.UUID
    name: str = Field(min_length=1)
    message: str = Field(min_length=1)
    audience: CampaignAudience
    tier: Optional[str] = None
    expiring_days: Optional[int] = None
    lead_status: Optional[str] = None


class CampaignPreview(BaseModel):
    location_id: uuid.UUID
    audience: CampaignAudience
    tier: Optional[str] = None
    expiring_days: Optional[int] = None
    lead_status: Optional[str] = None


class CampaignOut(BaseModel):
    model_config = {"from_attributes": True}
    id: uuid.UUID
    location_id: uuid.UUID
    name: str
    message: str
    audience: CampaignAudience
    tier: Optional[str] = None
    expiring_days: Optional[int] = None
    lead_status: Optional[str] = None
    status: CampaignStatus
    total_targets: int
    calls_queued: int
    skipped: int
    created_at: datetime
