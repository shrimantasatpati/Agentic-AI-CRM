"""
Gmail Service — Google Gmail API integration
Handles OAuth2 authentication and real email operations:
  - Fetching unread emails from Gmail inbox
  - Sending AI-drafted replies via Gmail API
  - OAuth2 token management (initial flow + automatic refresh)
"""

import os
import json
import base64
import logging
from typing import List, Dict, Any, Optional
from pathlib import Path

logger = logging.getLogger(__name__)

# Paths
_BASE_DIR = Path(__file__).resolve().parent.parent          # D:\AI_CRM\backend
_PROJECT_ROOT = _BASE_DIR.parent                            # D:\AI_CRM

def _resolve_credentials_path() -> Path:
    """Resolve the credentials file path from env var or search known locations."""
    env_val = os.getenv("GMAIL_API_CREDENTIALS", "").strip().strip('"').strip("'")
    if env_val:
        p = Path(env_val)
        if p.is_absolute():
            return p                        # Absolute path — use directly
        # Relative path — resolve from backend dir first, then project root
        if (_BASE_DIR / p).exists():
            return _BASE_DIR / p
        return _PROJECT_ROOT / p
    # Default filename — search backend dir then project root
    default = "client_secret_643405311346-b56epskobkh3a7bavssp2gljg9sm42th.apps.googleusercontent.com.json"
    if (_BASE_DIR / default).exists():
        return _BASE_DIR / default
    return _PROJECT_ROOT / default          # Where the user placed it

_CREDENTIALS_FILE = _resolve_credentials_path()
_TOKEN_FILE = _BASE_DIR / "credentials" / "gmail_token.json"

# Gmail API scopes — read + send + Calendar (shared token covers both services)
_SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.events",
]


def _get_credentials():
    """Load OAuth2 credentials, refreshing the token if expired."""
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    from google_auth_oauthlib.flow import InstalledAppFlow

    creds: Optional[Credentials] = None

    # Load existing token
    if _TOKEN_FILE.exists():
        try:
            creds = Credentials.from_authorized_user_file(str(_TOKEN_FILE), _SCOPES)
        except Exception as e:
            logger.warning(f"[GmailService] Failed to load token: {e}")

    # Refresh if expired
    if creds and creds.expired and creds.refresh_token:
        try:
            creds.refresh(Request())
            _save_token(creds)
        except Exception as e:
            logger.warning(f"[GmailService] Token refresh failed: {e}")
            creds = None

    # Need fresh auth
    if not creds or not creds.valid:
        if not _CREDENTIALS_FILE.exists():
            raise RuntimeError(
                f"Gmail credentials file not found at {_CREDENTIALS_FILE}. "
                "Please complete OAuth setup first via GET /api/auth/gmail"
            )
        raise RuntimeError(
            "Gmail not authenticated. Visit GET /api/auth/gmail to authorize first."
        )

    return creds


def _save_token(creds) -> None:
    """Persist the OAuth2 token for future use."""
    _TOKEN_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(_TOKEN_FILE, "w") as f:
        f.write(creds.to_json())


def _build_service():
    """Build and return an authenticated Gmail API service client."""
    from googleapiclient.discovery import build
    creds = _get_credentials()
    return build("gmail", "v1", credentials=creds)


def is_authenticated() -> bool:
    """Check if Gmail OAuth token exists and is valid."""
    try:
        _get_credentials()
        return True
    except Exception:
        return False


def get_oauth_authorization_url(redirect_uri: str) -> tuple[str, str]:
    """
    Generate the OAuth2 authorization URL for the initial setup flow.
    Returns (auth_url, state).
    Call this once; user visits the URL and approves.
    """
    from google_auth_oauthlib.flow import Flow

    if not _CREDENTIALS_FILE.exists():
        raise RuntimeError(f"Credentials file not found: {_CREDENTIALS_FILE}")

    flow = Flow.from_client_secrets_file(
        str(_CREDENTIALS_FILE),
        scopes=_SCOPES,
        redirect_uri=redirect_uri,
    )
    auth_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )
    return auth_url, state


def complete_oauth_flow(auth_code: str, redirect_uri: str) -> None:
    """
    Complete OAuth2 flow after user approval.
    Saves token to disk for future use.
    """
    from google_auth_oauthlib.flow import Flow

    flow = Flow.from_client_secrets_file(
        str(_CREDENTIALS_FILE),
        scopes=_SCOPES,
        redirect_uri=redirect_uri,
    )
    flow.fetch_token(code=auth_code)
    _save_token(flow.credentials)
    logger.info("[GmailService] ✅ OAuth2 token saved successfully")


def fetch_unread_emails(max_results: int = 20, include_read: bool = True) -> List[Dict[str, Any]]:
    """
    Fetch emails from Gmail inbox.
    By default fetches both read and unread (include_read=True) so the CRM
    always has data to work with. Pass include_read=False for unread-only.
    """
    try:
        service = _build_service()

        # Build label filter — include_read=True → just INBOX, False → INBOX + UNREAD
        label_ids = ["INBOX"] if include_read else ["INBOX", "UNREAD"]

        result = service.users().messages().list(
            userId="me",
            labelIds=label_ids,
            maxResults=max_results,
        ).execute()

        messages = result.get("messages", [])

        # If inbox is totally empty (new account / test), also pull from SENT
        if not messages:
            logger.info("[GmailService] Inbox empty — trying SENT folder as fallback")
            sent_result = service.users().messages().list(
                userId="me", labelIds=["SENT"], maxResults=max_results
            ).execute()
            messages = sent_result.get("messages", [])

        emails: List[Dict[str, Any]] = []

        for msg_ref in messages:
            try:
                msg = service.users().messages().get(
                    userId="me",
                    id=msg_ref["id"],
                    format="full",
                ).execute()

                headers = {h["name"]: h["value"] for h in msg.get("payload", {}).get("headers", [])}
                body = _extract_body(msg.get("payload", {}))
                label_ids_on_msg = msg.get("labelIds", [])
                is_unread = "UNREAD" in label_ids_on_msg

                emails.append({
                    "gmail_id":  msg_ref["id"],
                    "thread_id": msg.get("threadId"),
                    "from":      headers.get("From", ""),
                    "to":        headers.get("To", ""),
                    "subject":   headers.get("Subject", "(no subject)"),
                    "date":      headers.get("Date", ""),
                    "body":      body[:2000],
                    "snippet":   msg.get("snippet", ""),
                    "labels":    label_ids_on_msg,
                    "is_unread": is_unread,
                })
            except Exception as e:
                logger.warning(f"[GmailService] Could not fetch message {msg_ref['id']}: {e}")

        logger.info(f"[GmailService] Fetched {len(emails)} inbox emails (include_read={include_read})")
        return emails

    except Exception as e:
        logger.error(f"[GmailService] fetch_unread_emails failed: {e}")
        raise


def send_reply(
    to_email: str,
    subject: str,
    body: str,
    thread_id: Optional[str] = None,
    in_reply_to_message_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Send an email reply via Gmail API.
    If thread_id is provided, the message is added to the existing thread.
    """
    try:
        service = _build_service()

        # Build RFC 2822 email message
        email_lines = [
            f"To: {to_email}",
            f"Subject: {subject}",
            "MIME-Version: 1.0",
            "Content-Type: text/plain; charset=utf-8",
        ]
        if in_reply_to_message_id:
            email_lines.append(f"In-Reply-To: {in_reply_to_message_id}")
            email_lines.append(f"References: {in_reply_to_message_id}")

        email_lines.append("")  # Blank line separates headers from body
        email_lines.append(body)

        raw_email = "\n".join(email_lines)
        encoded = base64.urlsafe_b64encode(raw_email.encode("utf-8")).decode("utf-8")

        message_body: Dict[str, Any] = {"raw": encoded}
        if thread_id:
            message_body["threadId"] = thread_id

        sent = service.users().messages().send(userId="me", body=message_body).execute()
        logger.info(f"[GmailService] ✅ Email sent to {to_email}, id={sent['id']}")

        return {
            "success": True,
            "gmail_message_id": sent["id"],
            "thread_id": sent.get("threadId"),
            "to": to_email,
            "subject": subject,
        }

    except Exception as e:
        logger.error(f"[GmailService] send_reply failed: {e}")
        return {"success": False, "error": str(e)}


def mark_as_read(gmail_message_id: str) -> bool:
    """Mark a Gmail message as read (remove UNREAD label)."""
    try:
        service = _build_service()
        service.users().messages().modify(
            userId="me",
            id=gmail_message_id,
            body={"removeLabelIds": ["UNREAD"]},
        ).execute()
        return True
    except Exception as e:
        logger.warning(f"[GmailService] mark_as_read failed for {gmail_message_id}: {e}")
        return False


def _extract_body(payload: Dict[str, Any]) -> str:
    """Recursively extract plain text body from a Gmail message payload."""
    mime_type = payload.get("mimeType", "")

    if mime_type == "text/plain":
        data = payload.get("body", {}).get("data", "")
        if data:
            return base64.urlsafe_b64decode(data + "==").decode("utf-8", errors="replace")

    if mime_type.startswith("multipart/"):
        for part in payload.get("parts", []):
            text = _extract_body(part)
            if text:
                return text

    return ""
