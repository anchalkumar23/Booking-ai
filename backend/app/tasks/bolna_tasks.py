import logging
from datetime import datetime, timezone
from app.tasks.celery_app import celery_app
from app.core.config import settings
from app.core.database import SessionLocal
from app.models.suppression import SuppressionList
from app.models.customer import Customer
from app.models.scheduled_call import ScheduledCall, ScheduledCallKind, ScheduledCallStatus
from app.integrations.bolna import trigger_outbound_call_sync

logger = logging.getLogger(__name__)


def _is_suppressed(phone: str) -> bool:
    """Check global suppression list before dialling."""
    db = SessionLocal()
    try:
        return db.query(SuppressionList).filter(
            SuppressionList.phone == phone
        ).first() is not None
    finally:
        db.close()


@celery_app.task(name="app.tasks.bolna_tasks.send_reminder_call", bind=True, max_retries=3)
def send_reminder_call(self, appointment_id: str, phone: str, variables: dict):
    """Send appointment reminder call via Bolna."""
    if _is_suppressed(phone):
        logger.info(f"Skipping reminder call to suppressed number: {phone}")
        return {"status": "suppressed"}
    try:
        result = trigger_outbound_call_sync(
            agent_id=settings.bolna_reminder_agent_id,
            recipient_phone=phone,
            variables={**variables, "appointment_id": appointment_id},
        )
        logger.info(f"Reminder call triggered for appointment {appointment_id}: {result}")
        return result
    except Exception as exc:
        logger.error(f"Reminder call failed for {phone}: {exc}")
        raise self.retry(exc=exc, countdown=60)


@celery_app.task(name="app.tasks.bolna_tasks.send_renewal_call", bind=True, max_retries=3)
def send_renewal_call(self, membership_id: str, phone: str, variables: dict):
    """Send membership renewal call via Bolna."""
    if _is_suppressed(phone):
        logger.info(f"Skipping renewal call to suppressed number: {phone}")
        return {"status": "suppressed"}
    try:
        result = trigger_outbound_call_sync(
            agent_id=settings.bolna_renewal_agent_id,
            recipient_phone=phone,
            variables={**variables, "membership_id": membership_id},
        )
        logger.info(f"Renewal call triggered for membership {membership_id}: {result}")
        return result
    except Exception as exc:
        logger.error(f"Renewal call failed for {phone}: {exc}")
        raise self.retry(exc=exc, countdown=60)


@celery_app.task(name="app.tasks.bolna_tasks.send_lead_call", bind=True, max_retries=3)
def send_lead_call(self, lead_id: str, phone: str, variables: dict):
    """Send lead outreach call via Bolna."""
    if _is_suppressed(phone):
        logger.info(f"Skipping lead call to suppressed number: {phone}")
        return {"status": "suppressed"}
    try:
        result = trigger_outbound_call_sync(
            agent_id=settings.bolna_lead_agent_id,
            recipient_phone=phone,
            variables={**variables, "lead_id": lead_id},
        )
        logger.info(f"Lead call triggered for lead {lead_id}: {result}")
        return result
    except Exception as exc:
        logger.error(f"Lead call failed for {phone}: {exc}")
        raise self.retry(exc=exc, countdown=60)


@celery_app.task(name="app.tasks.bolna_tasks.send_promo_call", bind=True, max_retries=3)
def send_promo_call(self, campaign_id: str, phone: str, variables: dict):
    """Send a promotional offer call via Bolna.
    Uses the dedicated promo agent if configured, else falls back to the lead agent."""
    if _is_suppressed(phone):
        logger.info(f"Skipping promo call to suppressed number: {phone}")
        return {"status": "suppressed"}
    agent_id = settings.bolna_promo_agent_id or settings.bolna_lead_agent_id
    try:
        result = trigger_outbound_call_sync(
            agent_id=agent_id,
            recipient_phone=phone,
            variables={**variables, "campaign_id": campaign_id},
        )
        logger.info(f"Promo call triggered for campaign {campaign_id} → {phone}: {result}")
        return result
    except Exception as exc:
        logger.error(f"Promo call failed for {phone}: {exc}")
        raise self.retry(exc=exc, countdown=60)


@celery_app.task(name="app.tasks.bolna_tasks.dispatch_due_calls")
def dispatch_due_calls():
    """Runs every minute (celery beat). Fires any scheduled_calls whose due_at has
    passed. Rows are marked sent before dispatch so a call is never placed twice."""
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        due = (
            db.query(ScheduledCall)
            .filter(
                ScheduledCall.status == ScheduledCallStatus.pending,
                ScheduledCall.due_at <= now,
            )
            .order_by(ScheduledCall.due_at)
            .limit(200)
            .all()
        )
        if not due:
            return {"dispatched": 0}

        # Mark sent first (single commit) so a poller crash can't double-dial.
        for row in due:
            row.status = ScheduledCallStatus.sent
            row.sent_at = now
        db.commit()

        for row in due:
            if row.kind == ScheduledCallKind.promo:
                send_promo_call.delay(campaign_id=row.ref_id, phone=row.phone, variables=row.variables)
            else:
                send_lead_call.delay(lead_id=row.ref_id, phone=row.phone, variables=row.variables)
        logger.info(f"dispatch_due_calls fired {len(due)} call(s)")
        return {"dispatched": len(due)}
    finally:
        db.close()


@celery_app.task(name="app.tasks.bolna_tasks.retry_call_task", bind=True, max_retries=2)
def retry_call_task(self, phone: str, purpose: str, user_data: dict):
    """Auto-retry a missed or failed call."""
    if _is_suppressed(phone):
        return {"status": "suppressed"}

    agent_map = {
        "reminder": settings.bolna_reminder_agent_id,
        "renewal": settings.bolna_renewal_agent_id,
        "lead": settings.bolna_lead_agent_id,
    }
    agent_id = agent_map.get(purpose, settings.bolna_reminder_agent_id)

    try:
        result = trigger_outbound_call_sync(
            agent_id=agent_id,
            recipient_phone=phone,
            variables=user_data,
        )
        logger.info(f"Retry call triggered for {phone} ({purpose}): {result}")
        return result
    except Exception as exc:
        logger.error(f"Retry call failed for {phone}: {exc}")
        raise self.retry(exc=exc, countdown=120)
