import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.v1.auth import _get_current_user
from app.models.promo_campaign import PromoCampaign
from app.schemas.promo_campaign import CampaignCreate, CampaignPreview, CampaignOut
from app.services.promo_campaign import (
    create_and_launch_campaign,
    preview_audience,
)

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


@router.get("", response_model=List[CampaignOut])
def list_campaigns(
    location_id: Optional[uuid.UUID] = None,
    db: Session = Depends(get_db),
    _=Depends(_get_current_user),
):
    q = db.query(PromoCampaign)
    if location_id:
        q = q.filter(PromoCampaign.location_id == location_id)
    return q.order_by(PromoCampaign.created_at.desc()).all()


@router.post("/preview")
def preview_campaign(
    body: CampaignPreview,
    db: Session = Depends(get_db),
    _=Depends(_get_current_user),
):
    """Return how many contacts this audience would reach, before launching."""
    count = preview_audience(
        db,
        location_id=body.location_id,
        audience=body.audience,
        tier=body.tier,
        expiring_days=body.expiring_days,
        lead_status=body.lead_status,
    )
    return {"count": count}


@router.post("", response_model=CampaignOut, status_code=201)
def create_campaign(
    body: CampaignCreate,
    db: Session = Depends(get_db),
    _=Depends(_get_current_user),
):
    """Create a promotional campaign and immediately queue staggered calls."""
    return create_and_launch_campaign(
        db=db,
        location_id=body.location_id,
        name=body.name,
        message=body.message,
        audience=body.audience,
        tier=body.tier,
        expiring_days=body.expiring_days,
        lead_status=body.lead_status,
    )
