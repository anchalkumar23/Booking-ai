import json
import logging
from datetime import datetime, timedelta
from typing import Optional
from zoneinfo import ZoneInfo

from app.core.config import settings

logger = logging.getLogger(__name__)
IST = ZoneInfo("Asia/Kolkata")


def _get_service():
    """Build and return an authenticated Google Calendar service."""
    if not settings.google_calendar_credentials_json or not settings.google_calendar_id:
        return None
    try:
        from google.oauth2 import service_account
        from googleapiclient.discovery import build

        creds_dict = json.loads(settings.google_calendar_credentials_json)
        credentials = service_account.Credentials.from_service_account_info(
            creds_dict,
            scopes=["https://www.googleapis.com/auth/calendar"],
        )
        return build("calendar", "v3", credentials=credentials, cache_discovery=False)
    except Exception as e:
        logger.error(f"Google Calendar auth failed: {e}")
        return None


def _format_datetime(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=IST)
    return dt.isoformat()


def create_event(
    summary: str,
    description: str,
    start: datetime,
    duration_mins: int,
    attendee_email: Optional[str] = None,
) -> Optional[str]:
    """Create a Google Calendar event. Returns event ID or None."""
    service = _get_service()
    if not service:
        logger.info("[GCal STUB] create_event — credentials not configured")
        return None

    end = start + timedelta(minutes=duration_mins)
    event = {
        "summary": summary,
        "description": description,
        "start": {"dateTime": _format_datetime(start), "timeZone": "Asia/Kolkata"},
        "end":   {"dateTime": _format_datetime(end),   "timeZone": "Asia/Kolkata"},
        "reminders": {
            "useDefault": False,
            "overrides": [
                {"method": "popup", "minutes": 60},
                {"method": "popup", "minutes": 15},
            ],
        },
    }
    if attendee_email:
        event["attendees"] = [{"email": attendee_email}]

    try:
        result = service.events().insert(
            calendarId=settings.google_calendar_id,
            body=event,
            sendUpdates="all" if attendee_email else "none",
        ).execute()
        event_id = result.get("id")
        logger.info(f"GCal event created: {event_id} — {summary}")
        return event_id
    except Exception as e:
        logger.error(f"GCal create_event failed: {e}")
        return None


def update_event(
    event_id: str,
    summary: str,
    description: str,
    start: datetime,
    duration_mins: int,
    attendee_email: Optional[str] = None,
) -> bool:
    """Update an existing Google Calendar event. Returns True on success."""
    service = _get_service()
    if not service:
        logger.info(f"[GCal STUB] update_event {event_id} — credentials not configured")
        return False

    end = start + timedelta(minutes=duration_mins)
    event = {
        "summary": summary,
        "description": description,
        "start": {"dateTime": _format_datetime(start), "timeZone": "Asia/Kolkata"},
        "end":   {"dateTime": _format_datetime(end),   "timeZone": "Asia/Kolkata"},
    }
    if attendee_email:
        event["attendees"] = [{"email": attendee_email}]

    try:
        service.events().update(
            calendarId=settings.google_calendar_id,
            eventId=event_id,
            body=event,
            sendUpdates="all" if attendee_email else "none",
        ).execute()
        logger.info(f"GCal event updated: {event_id}")
        return True
    except Exception as e:
        logger.error(f"GCal update_event failed for {event_id}: {e}")
        return False


def delete_event(event_id: str) -> bool:
    """Delete a Google Calendar event. Returns True on success."""
    service = _get_service()
    if not service:
        logger.info(f"[GCal STUB] delete_event {event_id} — credentials not configured")
        return False

    try:
        service.events().delete(
            calendarId=settings.google_calendar_id,
            eventId=event_id,
            sendUpdates="all",
        ).execute()
        logger.info(f"GCal event deleted: {event_id}")
        return True
    except Exception as e:
        logger.error(f"GCal delete_event failed for {event_id}: {e}")
        return False
