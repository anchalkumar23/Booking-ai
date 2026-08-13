import logging
import uuid
from datetime import date, timedelta
from typing import Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.promo_campaign import PromoCampaign, CampaignAudience, CampaignStatus
from app.models.customer import Customer
from app.models.membership import Membership
from app.models.lead import Lead, LeadStatus
from app.models.location import Location
from app.models.suppression import SuppressionList

logger = logging.getLogger(__name__)

# Stagger promo calls so a big list doesn't dial everyone at once.
CALL_STAGGER_SECS = 60


def _suppressed_phones(db: Session) -> set:
    return {row.phone for row in db.query(SuppressionList.phone).all()}


def resolve_audience(
    db: Session,
    location_id: uuid.UUID,
    audience: CampaignAudience,
    tier: Optional[str] = None,
    expiring_days: Optional[int] = None,
    lead_status: Optional[str] = None,
) -> list[dict]:
    """Return a deduped list of {phone, name, language} for the chosen audience,
    excluding suppressed / DND / call-stopped contacts and rows without a phone."""
    suppressed = _suppressed_phones(db)
    contacts: dict[str, dict] = {}  # keyed by phone → dedupe

    def add(phone: str, name: str, language: str):
        phone = (phone or "").strip()
        if not phone or phone in suppressed or phone in contacts:
            return
        contacts[phone] = {"phone": phone, "name": name or "there", "language": language or "en"}

    if audience == CampaignAudience.all_customers:
        rows = db.query(Customer).filter(
            Customer.location_id == location_id,
            Customer.is_suppressed == False,
            Customer.is_dnd == False,
        ).all()
        for c in rows:
            add(c.phone, c.full_name, c.language.value)

    elif audience == CampaignAudience.members_by_tier:
        q = db.query(Customer, Membership).join(
            Membership, Membership.customer_id == Customer.id
        ).filter(
            Membership.location_id == location_id,
            Customer.is_suppressed == False,
            Customer.is_dnd == False,
        )
        if tier:
            q = q.filter(Membership.tier == tier)
        for c, _m in q.all():
            add(c.phone, c.full_name, c.language.value)

    elif audience == CampaignAudience.expiring_members:
        cutoff = date.today() + timedelta(days=expiring_days if expiring_days is not None else 7)
        q = db.query(Customer, Membership).join(
            Membership, Membership.customer_id == Customer.id
        ).filter(
            Membership.location_id == location_id,
            Membership.expires_at <= cutoff,   # expiring within N days OR already lapsed
            Customer.is_suppressed == False,
            Customer.is_dnd == False,
        )
        for c, _m in q.all():
            add(c.phone, c.full_name, c.language.value)

    elif audience == CampaignAudience.leads:
        q = db.query(Lead).filter(
            Lead.location_id == location_id,
            Lead.call_stopped == False,
        )
        if lead_status:
            try:
                q = q.filter(Lead.status == LeadStatus(lead_status))
            except ValueError:
                pass
        for lead in q.all():
            add(lead.phone, lead.full_name, lead.language.value)

    return list(contacts.values())


def preview_audience(db: Session, location_id: uuid.UUID, audience: CampaignAudience, **kwargs) -> int:
    """How many contacts a campaign would reach — shown before launching."""
    return len(resolve_audience(db, location_id, audience, **kwargs))


def launch_campaign_from_contacts(
    db: Session,
    location_id: uuid.UUID,
    name: str,
    message: str,
    rows: list[dict],
) -> PromoCampaign:
    """Create and launch a promo campaign from an uploaded CSV/Excel contact list.
    Each row needs at least `phone`; `full_name` (or `name`) is optional."""
    from app.tasks.bolna_tasks import send_promo_call
    from app.integrations.whatsapp import location_agent_variables

    location = db.query(Location).filter(Location.id == location_id).first()
    if not location:
        raise HTTPException(status_code=404, detail={"message": "Location not found.", "code": "not_found"})

    suppressed = _suppressed_phones(db)
    contacts: dict[str, dict] = {}
    skipped = 0
    for row in rows:
        phone = str(row.get("phone", "")).strip()
        cname = str(row.get("full_name") or row.get("name") or "there").strip()
        if not phone:
            skipped += 1
            continue
        if phone in suppressed or phone in contacts:
            skipped += 1
            continue
        contacts[phone] = {"phone": phone, "name": cname, "language": "en"}

    contact_list = list(contacts.values())

    campaign = PromoCampaign(
        location_id=location_id,
        name=name,
        message=message,
        audience=CampaignAudience.uploaded_list,
        status=CampaignStatus.running,
        total_targets=len(contact_list),
        skipped=skipped,
    )
    db.add(campaign)
    db.commit()
    db.refresh(campaign)

    if not contact_list:
        campaign.status = CampaignStatus.completed
        db.commit()
        db.refresh(campaign)
        return campaign

    base_vars = location_agent_variables(location)
    for i, contact in enumerate(contact_list):
        variables = {
            **base_vars,
            "customer_name": contact["name"],
            "promo_message": message,
            "language": contact["language"],
        }
        send_promo_call.apply_async(
            kwargs={
                "campaign_id": str(campaign.id),
                "phone": contact["phone"],
                "variables": variables,
            },
            countdown=30 + (i * CALL_STAGGER_SECS),
        )

    campaign.calls_queued = len(contact_list)
    db.commit()
    db.refresh(campaign)
    logger.info(f"Promo campaign {campaign.id} (uploaded list) launched: {len(contact_list)} calls")
    return campaign


def create_and_launch_campaign(
    db: Session,
    location_id: uuid.UUID,
    name: str,
    message: str,
    audience: CampaignAudience,
    tier: Optional[str] = None,
    expiring_days: Optional[int] = None,
    lead_status: Optional[str] = None,
) -> PromoCampaign:
    from app.tasks.bolna_tasks import send_promo_call
    from app.integrations.whatsapp import location_agent_variables

    location = db.query(Location).filter(Location.id == location_id).first()
    if not location:
        raise HTTPException(status_code=404, detail={"message": "Location not found.", "code": "not_found"})

    contacts = resolve_audience(db, location_id, audience, tier=tier, expiring_days=expiring_days, lead_status=lead_status)

    campaign = PromoCampaign(
        location_id=location_id,
        name=name,
        message=message,
        audience=audience,
        tier=tier,
        expiring_days=expiring_days,
        lead_status=lead_status,
        status=CampaignStatus.running,
        total_targets=len(contacts),
    )
    db.add(campaign)
    db.commit()
    db.refresh(campaign)

    if not contacts:
        campaign.status = CampaignStatus.completed
        db.commit()
        db.refresh(campaign)
        return campaign

    base_vars = location_agent_variables(location)
    queued = 0
    for i, contact in enumerate(contacts):
        variables = {
            **base_vars,
            "customer_name": contact["name"],
            "promo_message": message,
            "language": contact["language"],
        }
        send_promo_call.apply_async(
            kwargs={
                "campaign_id": str(campaign.id),
                "phone": contact["phone"],
                "variables": variables,
            },
            countdown=30 + (i * CALL_STAGGER_SECS),
        )
        queued += 1

    campaign.calls_queued = queued
    db.commit()
    db.refresh(campaign)
    logger.info(f"Promo campaign {campaign.id} launched: {queued} calls staggered {CALL_STAGGER_SECS}s apart")
    return campaign
