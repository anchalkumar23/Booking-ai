import logging
import uuid
from datetime import date, timedelta
from typing import Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.promo_campaign import PromoCampaign, CampaignAudience, CampaignChannel, CampaignStatus
from app.models.customer import Customer
from app.models.membership import Membership
from app.models.lead import Lead, LeadStatus
from app.models.location import Location
from app.models.suppression import SuppressionList

logger = logging.getLogger(__name__)

# Stagger promo calls so a big list doesn't dial everyone at once.
CALL_STAGGER_SECS = 60
# WhatsApp messages can go out faster than calls; keep a light stagger for rate limits.
MSG_STAGGER_SECS = 2


def _suppressed_phones(db: Session) -> set:
    return {row.phone for row in db.query(SuppressionList.phone).all()}


def _queue_wa_messages(
    db: Session, campaign, location, contacts: list[dict],
    template: str, language: str, params: list,
) -> None:
    """Write one scheduled_messages row per contact for a WhatsApp broadcast, lightly
    staggered. Each contact's params have the {name} token replaced with their name.
    The DB poller (dispatch_due_messages) sends them when due. Caller commits."""
    from datetime import datetime, timezone, timedelta
    from app.models.scheduled_message import ScheduledMessage

    now = datetime.now(timezone.utc)
    for i, contact in enumerate(contacts):
        resolved = [str(p).replace("{name}", contact["name"]) for p in (params or [])]
        db.add(ScheduledMessage(
            location_id=location.id,
            campaign_id=str(campaign.id),
            phone=contact["phone"],
            template=template,
            language=language or "en",
            params=resolved,
            due_at=now + timedelta(seconds=5 + (i * MSG_STAGGER_SECS)),
        ))


def _queue_promo_calls(db: Session, campaign, location, contacts: list[dict], message: str) -> None:
    """Write one scheduled_calls row per contact, staggered CALL_STAGGER_SECS apart.
    The DB poller (dispatch_due_calls) fires them when due, so a worker restart mid-
    campaign never drops calls. Caller commits."""
    from datetime import datetime, timezone, timedelta
    from app.models.scheduled_call import ScheduledCall, ScheduledCallKind
    from app.integrations.whatsapp import location_agent_variables

    base_vars = location_agent_variables(location)
    now = datetime.now(timezone.utc)
    for i, contact in enumerate(contacts):
        variables = {
            **base_vars,
            "customer_name": contact["name"],
            "promo_message": message,
            "language": contact["language"],
        }
        db.add(ScheduledCall(
            kind=ScheduledCallKind.promo,
            phone=contact["phone"],
            ref_id=str(campaign.id),
            variables=variables,
            due_at=now + timedelta(seconds=30 + (i * CALL_STAGGER_SECS)),
        ))


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
    channel: CampaignChannel = CampaignChannel.call,
    wa_template: Optional[str] = None,
    wa_language: Optional[str] = None,
    wa_params: Optional[list] = None,
) -> PromoCampaign:
    """Create and launch a campaign from an uploaded CSV/Excel contact list.
    Each row needs at least `phone`; `full_name` (or `name`) is optional."""
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
        channel=channel,
        wa_template=wa_template,
        wa_language=wa_language,
        wa_params=wa_params,
        status=CampaignStatus.running,
        total_targets=len(contact_list),
        skipped=skipped,
    )
    db.add(campaign)
    db.commit()
    db.refresh(campaign)

    return _finalize_launch(db, campaign, location, contact_list, message)


def _finalize_launch(db: Session, campaign, location, contacts: list[dict], message: str) -> PromoCampaign:
    """Queue calls or WhatsApp messages depending on the campaign channel."""
    if not contacts:
        campaign.status = CampaignStatus.completed
        db.commit()
        db.refresh(campaign)
        return campaign

    if campaign.channel == CampaignChannel.whatsapp:
        if not campaign.wa_template:
            raise HTTPException(status_code=400, detail={"message": "A WhatsApp template is required.", "code": "no_template"})
        _queue_wa_messages(db, campaign, location, contacts, campaign.wa_template, campaign.wa_language, campaign.wa_params or [])
        campaign.messages_queued = len(contacts)
        db.commit()
        db.refresh(campaign)
        logger.info(f"WhatsApp campaign {campaign.id} launched: {len(contacts)} messages ({campaign.wa_template})")
    else:
        _queue_promo_calls(db, campaign, location, contacts, message)
        campaign.calls_queued = len(contacts)
        db.commit()
        db.refresh(campaign)
        logger.info(f"Call campaign {campaign.id} launched: {len(contacts)} calls")
    return campaign


def create_and_launch_campaign(
    db: Session,
    location_id: uuid.UUID,
    name: str,
    message: str,
    audience: CampaignAudience,
    channel: CampaignChannel = CampaignChannel.call,
    tier: Optional[str] = None,
    expiring_days: Optional[int] = None,
    lead_status: Optional[str] = None,
    wa_template: Optional[str] = None,
    wa_language: Optional[str] = None,
    wa_params: Optional[list] = None,
) -> PromoCampaign:
    location = db.query(Location).filter(Location.id == location_id).first()
    if not location:
        raise HTTPException(status_code=404, detail={"message": "Location not found.", "code": "not_found"})

    contacts = resolve_audience(db, location_id, audience, tier=tier, expiring_days=expiring_days, lead_status=lead_status)

    campaign = PromoCampaign(
        location_id=location_id,
        name=name,
        message=message,
        audience=audience,
        channel=channel,
        tier=tier,
        expiring_days=expiring_days,
        lead_status=lead_status,
        wa_template=wa_template,
        wa_language=wa_language,
        wa_params=wa_params,
        status=CampaignStatus.running,
        total_targets=len(contacts),
    )
    db.add(campaign)
    db.commit()
    db.refresh(campaign)

    return _finalize_launch(db, campaign, location, contacts, message)
