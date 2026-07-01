import logging
import httpx
from typing import Optional
from app.core.config import settings

logger = logging.getLogger(__name__)
GRAPH_URL = "https://graph.facebook.com/v21.0"

OPT_OUT_KEYWORDS = [
    "stop", "not interested", "band karo", "mat karo",
    "வேண்டாம்", "unsubscribe", "nahin", "nahi", "remove me",
]


class WhatsAppCredentials:
    def __init__(self, phone_number_id: str, access_token: str):
        self.phone_number_id = phone_number_id
        self.access_token = access_token


def _resolve_credentials(
    phone_number_id: Optional[str] = None,
    access_token: Optional[str] = None,
) -> Optional[WhatsAppCredentials]:
    pid = phone_number_id or settings.whatsapp_phone_number_id
    token = access_token or settings.whatsapp_access_token
    if pid and token:
        return WhatsAppCredentials(pid, token)
    return None


def credentials_from_location(location) -> Optional[WhatsAppCredentials]:
    if location and location.whatsapp_phone_number_id and location.whatsapp_access_token:
        return WhatsAppCredentials(location.whatsapp_phone_number_id, location.whatsapp_access_token)
    return _resolve_credentials()


def _headers(access_token: str) -> dict:
    return {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }


def _stub_response(action: str, phone: str) -> dict:
    logger.info(f"[WhatsApp STUB] {action} → {phone} (credentials not configured)")
    return {"status": "stub", "action": action, "phone": phone}


def send_template_message(
    phone: str,
    template_name: str,
    language_code: str,
    components: list = None,
    phone_number_id: Optional[str] = None,
    access_token: Optional[str] = None,
) -> dict:
    """Send a Meta-approved template message (used for first contact)."""
    creds = _resolve_credentials(phone_number_id, access_token)
    if not creds:
        return _stub_response("send_template", phone)

    payload = {
        "messaging_product": "whatsapp",
        "to": phone,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": language_code},
            "components": components or [],
        },
    }
    with httpx.Client(timeout=15) as client:
        resp = client.post(
            f"{GRAPH_URL}/{creds.phone_number_id}/messages",
            headers=_headers(creds.access_token),
            json=payload,
        )
        if not resp.is_success:
            logger.error(
                f"WhatsApp API error {resp.status_code} for {phone}: {resp.text} "
                f"(phone_number_id={creds.phone_number_id})"
            )
            try:
                err_code = resp.json().get("error", {}).get("code")
            except Exception:
                err_code = None
            if err_code == 132001:
                return {"status": "skipped", "reason": "template_not_found", "phone": phone}
            resp.raise_for_status()
        return resp.json()


def send_text_message(
    phone: str,
    text: str,
    phone_number_id: Optional[str] = None,
    access_token: Optional[str] = None,
) -> dict:
    """Send a free-form session message (only within 24h of customer reply)."""
    creds = _resolve_credentials(phone_number_id, access_token)
    if not creds:
        return _stub_response("send_text", phone)

    payload = {
        "messaging_product": "whatsapp",
        "to": phone,
        "type": "text",
        "text": {"body": text},
    }
    with httpx.Client(timeout=15) as client:
        resp = client.post(
            f"{GRAPH_URL}/{creds.phone_number_id}/messages",
            headers=_headers(creds.access_token),
            json=payload,
        )
        if not resp.is_success:
            logger.error(
                f"WhatsApp API error {resp.status_code} for {phone}: {resp.text} "
                f"(phone_number_id={creds.phone_number_id})"
            )
            resp.raise_for_status()
        return resp.json()


def send_booking_confirmation(
    phone: str,
    customer_name: str,
    service: str,
    scheduled_at: str,
    language: str,
    phone_number_id: Optional[str] = None,
    access_token: Optional[str] = None,
) -> dict:
    """Send appointment confirmation via approved template."""
    lang_map = {"en": "en", "hi": "hi", "ta": "ta_IN"}
    template_map = {"en": "booking_confirmation_en", "hi": "booking_confirmation_hi", "ta": "booking_confirmation_ta"}

    return send_template_message(
        phone=phone,
        template_name=template_map.get(language, "booking_confirmation_en"),
        language_code=lang_map.get(language, "en"),
        components=[{
            "type": "body",
            "parameters": [
                {"type": "text", "text": customer_name},
                {"type": "text", "text": service},
                {"type": "text", "text": scheduled_at},
            ],
        }],
        phone_number_id=phone_number_id,
        access_token=access_token,
    )


def is_opt_out(message_text: str) -> bool:
    """Detect opt-out keywords in any supported language."""
    text_lower = message_text.lower().strip()
    return any(kw in text_lower for kw in OPT_OUT_KEYWORDS)


def language_from_code(lang: str) -> str:
    """Map language enum to WhatsApp language code."""
    return {"en": "en", "hi": "hi", "ta": "ta_IN"}.get(lang, "en")


def location_agent_variables(location) -> dict:
    """Variables passed to Bolna agents — include per-location knowledge base."""
    if not location:
        return {"knowledge_base": "", "location_id": ""}
    return {
        "business_name": location.name,
        "business_type": location.type.value,
        "city": location.city,
        "knowledge_base": location.knowledge_base or "",
        "location_id": str(location.id),
    }
