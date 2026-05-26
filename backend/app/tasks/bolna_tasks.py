import logging
from app.tasks.celery_app import celery_app
from app.core.config import settings
from app.core.database import SessionLocal
from app.models.suppression import SuppressionList
from app.models.customer import Customer
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
