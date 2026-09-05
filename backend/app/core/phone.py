import re

DEFAULT_COUNTRY_CODE = "91"


def normalize_phone(phone: str, country_code: str = DEFAULT_COUNTRY_CODE) -> str:
    """Normalize a phone number to international format (+<country><number>).

    Users no longer need to type +91 themselves — a bare 10-digit Indian number is
    assumed to have this country code. Applied at every point a phone number enters
    the system (manual entry, CSV/Excel import, the inbound WhatsApp webhook) so all
    representations of the same number converge to one canonical string for storage,
    dedup, and suppression matching. Numbers already in another country's format
    (already start with '+') are left untouched.
    """
    phone = (phone or "").strip()
    phone = re.sub(r"[\s\-()]", "", phone)
    if not phone:
        return phone
    if phone.startswith("+"):
        return phone
    if phone.startswith("00"):
        return "+" + phone[2:]
    if phone.startswith(country_code) and len(phone) == len(country_code) + 10:
        return "+" + phone
    if phone.isdigit() and len(phone) == 10:
        return "+" + country_code + phone
    return phone
