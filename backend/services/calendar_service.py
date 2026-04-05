"""
Google Calendar Service — Real calendar operations
Provides:
  - freebusy queries to find mutual availability
  - Event creation (books actual meetings in Google Calendar)
  - OAuth2 token management (shared with Gmail via same credentials)
"""

import os
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta, timezone
from pathlib import Path

logger = logging.getLogger(__name__)

_BASE_DIR = Path(__file__).resolve().parent.parent          # D:\AI_CRM\backend
_PROJECT_ROOT = _BASE_DIR.parent                            # D:\AI_CRM

def _resolve_credentials_path() -> Path:
    """Resolve the credentials file path from env var or search known locations."""
    env_val = os.getenv("GMAIL_API_CREDENTIALS", "").strip().strip('"').strip("'")
    if env_val:
        p = Path(env_val)
        if p.is_absolute():
            return p                        # Absolute path — use directly
        if (_BASE_DIR / p).exists():
            return _BASE_DIR / p
        return _PROJECT_ROOT / p
    default = "client_secret_643405311346-b56epskobkh3a7bavssp2gljg9sm42th.apps.googleusercontent.com.json"
    if (_BASE_DIR / default).exists():
        return _BASE_DIR / default
    return _PROJECT_ROOT / default          # Where the user placed it

_CREDENTIALS_FILE = _resolve_credentials_path()
_TOKEN_FILE = _BASE_DIR / "credentials" / "gmail_token.json"  # shared token with Gmail

# Scopes needed for Calendar (include Gmail scopes for shared token)
_SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.events",
]


def _get_credentials():
    """Load OAuth2 credentials, refreshing if expired. Shared with Gmail service."""
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request

    creds: Optional[object] = None

    if _TOKEN_FILE.exists():
        try:
            creds = Credentials.from_authorized_user_file(str(_TOKEN_FILE), _SCOPES)
        except Exception as e:
            logger.warning(f"[CalendarService] Failed to load token: {e}")

    if creds and creds.expired and creds.refresh_token:
        try:
            creds.refresh(Request())
            # Save refreshed token
            _TOKEN_FILE.parent.mkdir(parents=True, exist_ok=True)
            with open(_TOKEN_FILE, "w") as f:
                f.write(creds.to_json())
        except Exception as e:
            logger.warning(f"[CalendarService] Token refresh failed: {e}")
            creds = None

    if not creds or not creds.valid:
        raise RuntimeError(
            "Google Calendar not authenticated. "
            "Visit GET /api/auth/gmail to authorize (Calendar access is included)."
        )

    return creds


def _build_service():
    """Build authenticated Google Calendar API service."""
    from googleapiclient.discovery import build
    creds = _get_credentials()
    return build("calendar", "v3", credentials=creds)


def is_authenticated() -> bool:
    """Check if Calendar OAuth token is valid."""
    try:
        _get_credentials()
        return True
    except Exception:
        return False


def get_freebusy(
    attendee_emails: List[str],
    start_dt: datetime,
    end_dt: datetime,
) -> Dict[str, Any]:
    """
    Query Google Calendar freebusy API to find busy times for all attendees.
    Returns a dict of {email: [busy_slots]} where each slot is {start, end}.
    """
    try:
        service = _build_service()

        # Always query your own primary calendar + attendees
        items = [{"id": email} for email in attendee_emails]
        if not items:
            items = [{"id": "primary"}]

        body = {
            "timeMin": start_dt.isoformat(),
            "timeMax": end_dt.isoformat(),
            "timeZone": "UTC",
            "items": items,
        }

        response = service.freebusy().query(body=body).execute()
        calendars = response.get("calendars", {})

        result: Dict[str, List[Dict[str, str]]] = {}
        for email, cal_data in calendars.items():
            result[email] = cal_data.get("busy", [])

        logger.info(f"[CalendarService] Freebusy queried for {len(attendee_emails)} attendees")
        return result

    except Exception as e:
        logger.error(f"[CalendarService] freebusy query failed: {e}")
        return {}


def find_available_slots(
    attendee_emails: List[str],
    duration_minutes: int = 30,
    days_ahead: int = 7,
    max_slots: int = 5,
) -> List[Dict[str, str]]:
    """
    Find mutually available time slots for all attendees using real freebusy data.
    Searches business hours (9 AM–5 PM UTC) over the next `days_ahead` days.

    Returns a list of {start, end, display} dicts.
    """
    now = datetime.now(timezone.utc).replace(second=0, microsecond=0)
    end_window = now + timedelta(days=days_ahead)

    # Get busy periods from Google Calendar
    busy_map = get_freebusy(attendee_emails, now, end_window)

    # Flatten all busy periods across all attendees
    all_busy: List[Dict[str, str]] = []
    for periods in busy_map.values():
        all_busy.extend(periods)

    # Parse busy periods to datetime objects
    busy_ranges: List[tuple] = []
    for period in all_busy:
        try:
            s = datetime.fromisoformat(period["start"].replace("Z", "+00:00"))
            e = datetime.fromisoformat(period["end"].replace("Z", "+00:00"))
            busy_ranges.append((s, e))
        except (KeyError, ValueError):
            pass

    # Scan business hours for free slots
    available: List[Dict[str, str]] = []
    check = now.replace(hour=9, minute=0, second=0, microsecond=0)
    if check < now:
        check += timedelta(days=1)

    duration = timedelta(minutes=duration_minutes)

    while check < end_window and len(available) < max_slots:
        # Skip weekends
        if check.weekday() >= 5:
            check += timedelta(days=1)
            check = check.replace(hour=9, minute=0)
            continue

        # Only business hours 9–17 UTC
        if check.hour >= 17:
            check += timedelta(days=1)
            check = check.replace(hour=9, minute=0)
            continue

        slot_end = check + duration

        # Check if slot overlaps any busy period
        is_free = all(
            slot_end <= b_start or check >= b_end
            for b_start, b_end in busy_ranges
        )

        if is_free:
            available.append({
                "start": check.isoformat(),
                "end": slot_end.isoformat(),
                "display": check.strftime("%A, %b %d at %I:%M %p UTC"),
            })

        check += timedelta(minutes=30)  # Check in 30-min intervals

    if not available:
        # Fallback: next business day at 10 AM
        fallback = now + timedelta(days=1)
        while fallback.weekday() >= 5:
            fallback += timedelta(days=1)
        fallback = fallback.replace(hour=10, minute=0, second=0, microsecond=0)
        available = [{
            "start": fallback.isoformat(),
            "end": (fallback + duration).isoformat(),
            "display": fallback.strftime("%A, %b %d at %I:%M %p UTC") + " (fallback)",
        }]

    logger.info(f"[CalendarService] Found {len(available)} available slots")
    return available


def create_event(
    title: str,
    start_iso: str,
    end_iso: str,
    attendee_emails: List[str],
    description: str = "",
    location: str = "Google Meet",
    add_meet_link: bool = True,
) -> Dict[str, Any]:
    """
    Create a Google Calendar event and send invites to all attendees.
    Returns the created event details including Google Meet link if requested.
    """
    try:
        service = _build_service()

        attendees = [{"email": email} for email in attendee_emails if email]

        event_body: Dict[str, Any] = {
            "summary": title,
            "description": description,
            "location": location,
            "start": {
                "dateTime": start_iso,
                "timeZone": "UTC",
            },
            "end": {
                "dateTime": end_iso,
                "timeZone": "UTC",
            },
            "attendees": attendees,
            "reminders": {
                "useDefault": False,
                "overrides": [
                    {"method": "email", "minutes": 24 * 60},   # 24 hours before
                    {"method": "popup", "minutes": 30},         # 30 min before
                ],
            },
        }

        # Add Google Meet link if requested
        if add_meet_link:
            event_body["conferenceData"] = {
                "createRequest": {
                    "requestId": f"crm_{datetime.now().timestamp()}",
                    "conferenceSolutionKey": {"type": "hangoutsMeet"},
                }
            }

        created = service.events().insert(
            calendarId="primary",
            body=event_body,
            conferenceDataVersion=1 if add_meet_link else 0,
            sendUpdates="all",  # Send email invites to attendees
        ).execute()

        meet_link = None
        if add_meet_link:
            meet_link = (
                created.get("conferenceData", {})
                .get("entryPoints", [{}])[0]
                .get("uri")
            )

        logger.info(f"[CalendarService] ✅ Event created: {created['id']} — {title}")

        return {
            "success": True,
            "event_id": created["id"],
            "event_link": created.get("htmlLink"),
            "meeting_link": meet_link or "Google Meet link will be generated",
            "title": title,
            "start": start_iso,
            "end": end_iso,
            "attendees": attendee_emails,
            "status": "confirmed",
        }

    except Exception as e:
        logger.error(f"[CalendarService] create_event failed: {e}")
        return {
            "success": False,
            "error": str(e),
            "title": title,
            "start": start_iso,
            "attendees": attendee_emails,
        }


def delete_event(event_id: str) -> bool:
    """Cancel/delete a Google Calendar event."""
    try:
        service = _build_service()
        service.events().delete(calendarId="primary", eventId=event_id).execute()
        logger.info(f"[CalendarService] Event deleted: {event_id}")
        return True
    except Exception as e:
        logger.error(f"[CalendarService] delete_event failed: {e}")
        return False
