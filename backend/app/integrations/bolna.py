import logging
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)

BOLNA_BASE_URL = "https://api.bolna.ai"


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {settings.bolna_api_key}",
        "Content-Type": "application/json",
    }


async def trigger_outbound_call(
    agent_id: str,
    recipient_phone: str,
    variables: dict,
) -> dict:
    """Trigger a single outbound call via Bolna API.
    Bolna substitutes {variable_name} placeholders in the agent prompt from user_data."""
    payload = {
        "agent_id": agent_id,
        "recipient_phone_number": recipient_phone,
        "user_data": variables,
    }
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{BOLNA_BASE_URL}/call",
            headers=_headers(),
            json=payload,
        )
        resp.raise_for_status()
        return resp.json()


def trigger_outbound_call_sync(
    agent_id: str,
    recipient_phone: str,
    variables: dict,
) -> dict:
    """Synchronous version for use inside Celery tasks."""
    payload = {
        "agent_id": agent_id,
        "recipient_phone_number": recipient_phone,
        "user_data": variables,
    }
    logger.info(f"Bolna call payload: {payload}")
    with httpx.Client(timeout=30) as client:
        resp = client.post(
            f"{BOLNA_BASE_URL}/call",
            headers=_headers(),
            json=payload,
        )
        logger.info(f"Bolna response {resp.status_code}: {resp.text}")
        resp.raise_for_status()
        return resp.json()
