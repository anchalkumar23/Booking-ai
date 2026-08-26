from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import uuid

from app.models.promo_campaign import CampaignAudience, CampaignChannel, CampaignStatus


class CampaignCreate(BaseModel):
    location_id: uuid.UUID
    name: str = Field(min_length=1)
    message: str = ""  # call: the AI pitch; whatsapp: optional note
    audience: CampaignAudience
    channel: CampaignChannel = CampaignChannel.call
    tier: Optional[str] = None
    expiring_days: Optional[int] = None
    lead_status: Optional[str] = None
    wa_template: Optional[str] = None
    wa_language: Optional[str] = None
    wa_params: Optional[List[str]] = None


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
    channel: CampaignChannel
    tier: Optional[str] = None
    expiring_days: Optional[int] = None
    lead_status: Optional[str] = None
    wa_template: Optional[str] = None
    wa_language: Optional[str] = None
    status: CampaignStatus
    total_targets: int
    calls_queued: int
    messages_queued: int
    skipped: int
    created_at: datetime
