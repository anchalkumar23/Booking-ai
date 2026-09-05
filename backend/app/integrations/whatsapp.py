import re
import logging
import httpx
from typing import Optional
from app.core.config import settings
from app.core.phone import normalize_phone as _normalize_phone

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
        "to": _normalize_phone(phone),
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
        "to": _normalize_phone(phone),
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
    """Send appointment confirmation via approved template (English only)."""
    return send_template_message(
        phone=phone,
        template_name="booking_confirmation_en",
        language_code="en",
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


def _body_variable_count(components: list) -> int:
    """Count {{n}} placeholders in a template's BODY component."""
    for comp in components or []:
        if (comp.get("type") or "").upper() == "BODY":
            nums = re.findall(r"\{\{\s*(\d+)\s*\}\}", comp.get("text") or "")
            return max((int(n) for n in nums), default=0)
    return 0


def _body_text(components: list) -> str:
    for comp in components or []:
        if (comp.get("type") or "").upper() == "BODY":
            return comp.get("text") or ""
    return ""


def list_all_templates(waba_id: str, access_token: str) -> list[dict]:
    """List every message template for a WABA, any review status.
    Returns [{name, language, category, status, rejected_reason, variables, body}] —
    used for the template management UI so users see Pending/Rejected alongside
    Approved ones after submitting a new template."""
    if not waba_id or not access_token:
        return []
    out: list[dict] = []
    url = f"{GRAPH_URL}/{waba_id}/message_templates"
    params = {"fields": "name,status,language,category,components,rejected_reason", "limit": 200}
    try:
        with httpx.Client(timeout=15) as client:
            resp = client.get(url, headers={"Authorization": f"Bearer {access_token}"}, params=params)
            if not resp.is_success:
                logger.error(f"WhatsApp template list error {resp.status_code}: {resp.text}")
                return []
            data = resp.json().get("data", [])
    except Exception as e:
        logger.error(f"WhatsApp template list failed: {e}")
        return []

    for t in data:
        comps = t.get("components", [])
        out.append({
            "name": t.get("name"),
            "language": t.get("language"),
            "category": t.get("category"),
            "status": (t.get("status") or "").upper(),
            "rejected_reason": t.get("rejected_reason"),
            "variables": _body_variable_count(comps),
            "body": _body_text(comps),
        })
    return out


def list_approved_templates(waba_id: str, access_token: str) -> list[dict]:
    """List only APPROVED message templates — used to populate the broadcast
    template picker when launching a campaign."""
    return [t for t in list_all_templates(waba_id, access_token) if t.get("status") == "APPROVED"]


def create_message_template(
    waba_id: str,
    access_token: str,
    name: str,
    category: str,
    language: str,
    body_text: str,
    example_params: Optional[list] = None,
) -> dict:
    """Submit a new WhatsApp message template to Meta for review.
    Meta returns it with status PENDING; once approved it shows up automatically
    in list_approved_templates / list_all_templates — no polling needed on our side."""
    components: list = [{"type": "BODY", "text": body_text}]
    var_count = _body_variable_count(components)
    if var_count > 0:
        params = [str(p) for p in (example_params or [])][:var_count]
        while len(params) < var_count:
            params.append(f"example{len(params) + 1}")
        components[0]["example"] = {"body_text": [params]}

    payload = {
        "name": name,
        "language": language,
        "category": category.upper(),
        "components": components,
    }
    url = f"{GRAPH_URL}/{waba_id}/message_templates"
    with httpx.Client(timeout=20) as client:
        resp = client.post(
            url,
            headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
            json=payload,
        )
        if not resp.is_success:
            logger.error(f"WhatsApp template create error {resp.status_code}: {resp.text}")
            try:
                err = resp.json().get("error", {})
                message = err.get("error_user_msg") or err.get("message") or resp.text
            except Exception:
                message = resp.text
            raise ValueError(message)
        return resp.json()


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
