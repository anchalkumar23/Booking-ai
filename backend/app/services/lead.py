import logging
from datetime import date
from typing import Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.lead import Lead, LeadStatus
from app.models.suppression import SuppressionList
from app.models.customer import Language
from app.models.location import Location
import uuid

logger = logging.getLogger(__name__)


def _is_suppressed(db: Session, phone: str) -> bool:
    return db.query(SuppressionList).filter(
        SuppressionList.phone == phone
    ).first() is not None


def create_lead_and_trigger_outreach(
    db: Session,
    location_id: uuid.UUID,
    full_name: str,
    phone: str,
    language: Language,
    source: str,
    follow_up_date: Optional[date] = None,
) -> Lead:
    """Create a lead and immediately fire WhatsApp sequence + Bolna call."""
    # Validate location exists
    location = db.query(Location).filter(Location.id == location_id).first()
    if not location:
        raise HTTPException(status_code=404, detail={"message": "Location not found.", "code": "not_found"})

    # Check suppression
    if _is_suppressed(db, phone):
        raise HTTPException(
            status_code=409,
            detail={"message": "This number is on the suppression list.", "code": "suppressed"},
        )

    # Check for duplicate lead
    existing = db.query(Lead).filter(Lead.phone == phone).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail={"message": "A lead with this phone number already exists.", "code": "duplicate_lead"},
        )

    lead = Lead(
        location_id=location_id,
        full_name=full_name,
        phone=phone,
        language=language,
        source=source,
        status=LeadStatus.new,
        follow_up_date=follow_up_date,
    )
    db.add(lead)
    db.commit()
    db.refresh(lead)

    # Trigger outreach asynchronously
    _trigger_outreach(db, lead, location)
    db.commit()  # persist the scheduled_call row
    return lead


def _trigger_outreach(db: Session, lead: Lead, location: Location, call_delay: int = 30) -> None:
    """Fire WhatsApp sequence and queue a Bolna cold call.
    call_delay: seconds before the Bolna call fires (default 30s so WA lands first;
    bulk imports increase this per-lead to stagger calls). The call is written to the
    scheduled_calls queue (not a Celery countdown) so it survives worker restarts.
    Caller is responsible for committing."""
    from datetime import datetime, timezone, timedelta
    from app.tasks.whatsapp_tasks import start_lead_sequence
    from app.models.scheduled_call import ScheduledCall, ScheduledCallKind
    from app.integrations.whatsapp import location_agent_variables

    variables = {
        **location_agent_variables(location),
        "lead_name": lead.full_name,
        "customer_name": lead.full_name,
        "language": lead.language.value,
        "lead_id": str(lead.id),
    }

    # Start WhatsApp 4-step sequence (step 1 immediate)
    start_lead_sequence.delay(lead_id=str(lead.id))

    # Queue the Bolna cold call to fire at due_at
    db.add(ScheduledCall(
        kind=ScheduledCallKind.lead,
        phone=lead.phone,
        ref_id=str(lead.id),
        variables=variables,
        due_at=datetime.now(timezone.utc) + timedelta(seconds=call_delay),
    ))
    logger.info(f"Outreach queued for lead {lead.id} ({lead.phone}), call in {call_delay}s")


def bulk_create_leads(
    db: Session,
    location_id: uuid.UUID,
    rows: list,
) -> dict:
    """Import multiple leads, skip duplicates and suppressed numbers silently."""
    location = db.query(Location).filter(Location.id == location_id).first()
    if not location:
        raise HTTPException(status_code=404, detail={"message": "Location not found.", "code": "not_found"})

    created = 0
    skipped = 0
    errors = []

    # Stagger calls: 30s base + 60s per lead so 100 leads spread over ~100 minutes
    CALL_STAGGER_SECS = 60

    for row in rows:
        phone = row.get("phone", "").strip()
        full_name = row.get("full_name", "").strip()

        if not phone or not full_name:
            errors.append({"phone": phone, "reason": "missing_fields"})
            skipped += 1
            continue

        if _is_suppressed(db, phone):
            skipped += 1
            continue

        existing = db.query(Lead).filter(Lead.phone == phone).first()
        if existing:
            skipped += 1
            continue

        lang_str = row.get("language", "en").strip().lower()
        try:
            language = Language(lang_str)
        except ValueError:
            language = Language.en

        lead = Lead(
            location_id=location_id,
            full_name=full_name,
            phone=phone,
            language=language,
            source=row.get("source", "csv_import"),
            status=LeadStatus.new,
        )
        db.add(lead)
        db.flush()  # get the ID without full commit
        call_delay = 30 + (created * CALL_STAGGER_SECS)
        _trigger_outreach(db, lead, location, call_delay=call_delay)
        created += 1

    db.commit()  # persists leads + their scheduled_call rows
    return {"created": created, "skipped": skipped, "errors": errors}
