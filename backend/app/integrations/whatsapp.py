import logging
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)
GRAPH_URL = "https://graph.facebook.com/v21.0"

OPT_OUT_KEYWORDS = [
    "stop", "not interested", "band karo", "mat karo",
    "வேண்டாம்", "unsubscribe", "nahin", "nahi", "remove me",
]


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {settings.whatsapp_access_token}",
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
) -> dict:
    """Send a Meta-approved template message (used for first contact)."""
    if not settings.whatsapp_access_token or not settings.whatsapp_phone_number_id:
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
            f"{GRAPH_URL}/{settings.whatsapp_phone_number_id}/messages",
            headers=_headers(),
            json=payload,
        )
        if not resp.is_success:
            logger.error(
                f"WhatsApp API error {resp.status_code} for {phone}: {resp.text} "
                f"(phone_number_id={settings.whatsapp_phone_number_id})"
            )
            # 132001 = template does not exist — no point retrying, skip gracefully
            try:
                err_code = resp.json().get("error", {}).get("code")
            except Exception:
                err_code = None
            if err_code == 132001:
                return {"status": "skipped", "reason": "template_not_found", "phone": phone}
            resp.raise_for_status()
        return resp.json()


def send_text_message(phone: str, text: str) -> dict:
    """Send a free-form session message (only within 24h of customer reply)."""
    if not settings.whatsapp_access_token or not settings.whatsapp_phone_number_id:
        return _stub_response("send_text", phone)

    payload = {
        "messaging_product": "whatsapp",
        "to": phone,
        "type": "text",
        "text": {"body": text},
    }
    with httpx.Client(timeout=15) as client:
        resp = client.post(
            f"{GRAPH_URL}/{settings.whatsapp_phone_number_id}/messages",
            headers=_headers(),
            json=payload,
        )
        if not resp.is_success:
            logger.error(
                f"WhatsApp API error {resp.status_code} for {phone}: {resp.text} "
                f"(phone_number_id={settings.whatsapp_phone_number_id})"
            )
            resp.raise_for_status()
        return resp.json()


def send_booking_confirmation(phone: str, customer_name: str, service: str, scheduled_at: str, language: str) -> dict:
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
    )


def is_opt_out(message_text: str) -> bool:
    """Detect opt-out keywords in any supported language."""
    text_lower = message_text.lower().strip()
    return any(kw in text_lower for kw in OPT_OUT_KEYWORDS)


def language_from_code(lang: str) -> str:
    """Map language enum to WhatsApp language code."""
    return {"en": "en", "hi": "hi", "ta": "ta_IN"}.get(lang, "en")
