import httpx
from app.core.config import settings

BOLNA_BASE_URL = "https://api.bolna.ai"


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {settings.bolna_api_key}",
        "Content-Type": "application/json",
    }


def _build_payload(agent_id: str, recipient_phone: str, variables: dict) -> dict:
    # variables goes at top level for {{placeholder}} substitution in the agent prompt
    # user_data is echoed back in the webhook so we can identify the call
    metadata_keys = {"appointment_id", "lead_id", "membership_id", "retry_count"}
    user_data = {k: v for k, v in variables.items() if k in metadata_keys}
    return {
        "agent_id": agent_id,
        "recipient_phone_number": recipient_phone,
        "variables": variables,
        "user_data": user_data,
    }


async def trigger_outbound_call(
    agent_id: str,
    recipient_phone: str,
    variables: dict,
) -> dict:
    """Trigger a single outbound call via Bolna API."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{BOLNA_BASE_URL}/call",
            headers=_headers(),
            json=_build_payload(agent_id, recipient_phone, variables),
        )
        resp.raise_for_status()
        return resp.json()


def trigger_outbound_call_sync(
    agent_id: str,
    recipient_phone: str,
    variables: dict,
) -> dict:
    """Synchronous version for use inside Celery tasks."""
    with httpx.Client(timeout=30) as client:
        resp = client.post(
            f"{BOLNA_BASE_URL}/call",
            headers=_headers(),
            json=_build_payload(agent_id, recipient_phone, variables),
        )
        resp.raise_for_status()
        return resp.json()
