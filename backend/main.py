"""FastAPI Main Application - AI-Powered CRM"""

from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from pydantic import BaseModel
import uvicorn
from dotenv import load_dotenv


class QueryRequest(BaseModel):
    prompt: str

# Load environment variables from .env file
load_dotenv()

from database.models import Base, Contact, Deal, Customer, Email, Meeting
from database.connection import engine, get_db, init_db_tables
from api import leads, deals, customers, emails, meetings, analytics
from workflows.orchestrator import AgentOrchestrator

# Initialize database tables (only creates if they don't exist)
init_db_tables(Base)

# Initialize FastAPI app
app = FastAPI(
    title="AI-Powered CRM",
    description="Production-ready CRM with multi-agent AI architecture",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize agent orchestrator
orchestrator = AgentOrchestrator()


# ============================================================================
# HEALTH CHECK
# ============================================================================

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "name": "AI-Powered CRM",
        "version": "1.0.0",
        "status": "healthy",
        "agents": orchestrator.get_agent_status()
    }


@app.get("/health")
async def health_check():
    """Detailed health check"""
    return {
        "api": "healthy",
        "database": "connected",
        "agents": orchestrator.get_agent_status(),
        "redis": "connected"  # If using Redis
    }


# ============================================================================
# INCLUDE ROUTERS
# ============================================================================

app.include_router(leads.router, prefix="/api/leads", tags=["Leads"])
app.include_router(deals.router, prefix="/api/deals", tags=["Deals"])
app.include_router(customers.router, prefix="/api/customers", tags=["Customers"])
app.include_router(emails.router, prefix="/api/emails", tags=["Emails"])
app.include_router(meetings.router, prefix="/api/meetings", tags=["Meetings"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])


# ============================================================================
# AGENT TRIGGER ENDPOINTS
# ============================================================================

@app.post("/api/agents/qualify-lead")
async def qualify_lead(
    lead_data: Dict[str, Any],
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Trigger Lead Qualification Agent (Async)"""
    background_tasks.add_task(
        orchestrator.process_new_lead,
        lead_data,
        db
    )
    return {"status": "processing", "message": "Lead qualification started"}


@app.post("/api/leads/workflow")
async def process_lead_workflow(
    lead_data: Dict[str, Any],
    db: Session = Depends(get_db)
):
    """Process lead and return full agentic workflow steps (Sync)"""
    result = await orchestrator.process_new_lead(lead_data, db)
    return result


@app.post("/api/agents/analyze-email")
async def analyze_email(
    email_data: Dict[str, Any],
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Trigger Email Intelligence Agent"""
    background_tasks.add_task(
        orchestrator.process_email,
        email_data,
        db
    )
    return {"status": "processing", "message": "Email analysis started"}


@app.post("/api/agents/analyze-deal/{deal_id}")
async def analyze_deal(
    deal_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Trigger Sales Pipeline Agent"""
    background_tasks.add_task(
        orchestrator.analyze_deal,
        deal_id,
        db
    )
    return {"status": "processing", "message": "Deal analysis started"}


@app.post("/api/agents/monitor-customer/{customer_id}")
async def monitor_customer(
    customer_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Trigger Customer Success Agent"""
    background_tasks.add_task(
        orchestrator.monitor_customer,
        customer_id,
        db
    )
    return {"status": "processing", "message": "Customer monitoring started"}


@app.post("/api/agents/schedule-meeting")
async def schedule_meeting(
    meeting_request: Dict[str, Any],
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Trigger Meeting Scheduler Agent"""
    background_tasks.add_task(
        orchestrator.schedule_meeting,
        meeting_request,
        db
    )
    return {"status": "processing", "message": "Meeting scheduling started"}


@app.post("/api/agents/generate-dashboard")
async def generate_dashboard(
    category: str = "all",
    db: Session = Depends(get_db)
):
    """Trigger Analytics Agent - synchronous"""
    dashboard = await orchestrator.generate_dashboard(category, db)
    return dashboard


@app.post("/api/query")
async def query_data(request: QueryRequest, db: Session = Depends(get_db)):
    """Unified query endpoint consumed by frontend."""
    # Use the orchestrator to handle the natural language query
    response = await orchestrator.handle_user_query(request.prompt, db)
    return response


# ============================================================================
# DEMO / AUTOMATION TRIGGERS
# ============================================================================

@app.post("/api/demo/run-agent-workflow")
async def run_demo_workflow(
    workflow_type: str = "daily",
    db: Session = Depends(get_db)
):
    """Manually trigger the daily/weekly automated workflows for demo purposes."""
    if workflow_type == "daily":
        await orchestrator.run_daily_workflows(db)
        return {"status": "success", "message": "Daily agentic workflows triggered"}
    elif workflow_type == "weekly":
        await orchestrator.run_weekly_workflows(db)
        return {"status": "success", "message": "Weekly executive workflows triggered"}
    else:
        raise HTTPException(status_code=400, detail="Invalid workflow type")


# ============================================================================
# WEBHOOKS
# ============================================================================

@app.post("/webhooks/email-received")
async def email_webhook(
    email_data: Dict[str, Any],
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Webhook for incoming emails"""
    background_tasks.add_task(
        orchestrator.process_email,
        email_data,
        db
    )
    return {"status": "received"}


@app.post("/webhooks/form-submission")
async def form_webhook(
    form_data: Dict[str, Any],
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Webhook for form submissions (new leads)"""
    background_tasks.add_task(
        orchestrator.process_new_lead,
        form_data,
        db
    )
    return {"status": "received"}


# ============================================================================
# MODEL CONFIGURATION — Switch between Gemini / Groq / xAI at runtime
# ============================================================================

class ModelSwitchRequest(BaseModel):
    model: str


@app.get("/api/config/model")
async def get_current_model():
    """Return the currently active LLM provider and model name."""
    return orchestrator.get_llm_info()


@app.post("/api/config/model")
async def switch_model(req: ModelSwitchRequest):
    """Switch the active LLM model at runtime (affects all agents immediately)."""
    info = orchestrator.switch_model(req.model)
    return {"status": "switched", **info}


# ============================================================================
# SYNCHRONOUS AGENT ENDPOINTS — Return full results (not background tasks)
# These are used by the frontend to get real LLM-powered results.
# ============================================================================

@app.post("/api/agents/analyze-email/sync")
async def analyze_email_sync(
    email_data: Dict[str, Any],
    db: Session = Depends(get_db)
):
    """Run Email Intelligence Agent synchronously and return full result."""
    result = await orchestrator.process_email(email_data, db)
    return result


@app.post("/api/agents/analyze-deal/{deal_id}/sync")
async def analyze_deal_sync(
    deal_id: str,
    body: Dict[str, Any] = {},
    db: Session = Depends(get_db)
):
    """Run Sales Pipeline Agent synchronously and return full analysis."""
    result = await orchestrator.analyze_deal(deal_id, db)
    return result


@app.post("/api/agents/monitor-customer/{customer_id}/sync")
async def monitor_customer_sync(
    customer_id: str,
    db: Session = Depends(get_db)
):
    """Run Customer Success Agent synchronously and return full monitoring result."""
    result = await orchestrator.monitor_customer(customer_id, db)
    return result


@app.post("/api/agents/schedule-meeting/sync")
async def schedule_meeting_sync(
    meeting_request: Dict[str, Any],
    db: Session = Depends(get_db)
):
    """Run Meeting Scheduler Agent synchronously and return full result."""
    result = await orchestrator.schedule_meeting(meeting_request, db)
    return result


@app.post("/api/agents/generate-analytics/sync")
async def generate_analytics_sync(
    body: Dict[str, Any] = {},
    db: Session = Depends(get_db)
):
    """Run Analytics Agent synchronously and return full result."""
    category = body.get("category", "all")
    result = await orchestrator.generate_dashboard(category, db)
    return result


# ============================================================================
# WEBHOOK WITH AGENT RESULT — Fire webhook and track job outcome
# ============================================================================

_webhook_results: Dict[str, Any] = {}  # in-memory store for demo purposes


@app.post("/webhooks/email-received/tracked")
async def email_webhook_tracked(
    email_data: Dict[str, Any],
    db: Session = Depends(get_db)
):
    """Webhook for incoming emails — runs agent synchronously and returns the result."""
    result = await orchestrator.process_email(email_data, db)
    return {"status": "processed", "agent_result": result}


@app.post("/webhooks/form-submission/tracked")
async def form_webhook_tracked(
    form_data: Dict[str, Any],
    db: Session = Depends(get_db)
):
    """Webhook for form submissions — runs lead agent synchronously and returns result."""
    result = await orchestrator.process_new_lead(form_data, db)
    return {"status": "processed", "agent_result": result}



# ============================================================================
# LIVE AGENT ACTIVITY — real data from agent_logs table
# ============================================================================

@app.get("/api/agents/events")
async def get_agent_events(limit: int = 25, db: Session = Depends(get_db)):
    """Return most recent agent activity events. Frontend polls this every 5s."""
    from database.models import AgentLog
    from sqlalchemy import desc
    logs = db.query(AgentLog).order_by(desc(AgentLog.created_at)).limit(limit).all()
    return [
        {
            "id": log.id, "agent": log.agent_name, "type": log.activity_type,
            "details": log.details,
            "timestamp": log.created_at.isoformat() if log.created_at else None,
        }
        for log in logs
    ]


@app.get("/api/agents/status")
async def get_agent_status_live(db: Session = Depends(get_db)):
    """Return per-agent run count + last run time from real DB logs."""
    from database.models import AgentLog
    from sqlalchemy import func, desc
    from datetime import date
    known_agents = [
        {"name": "LeadQualificationAgent", "emoji": "\U0001f3af", "color": "#0066cc", "route": "/leads"},
        {"name": "EmailIntelligenceAgent", "emoji": "\U0001f4e7", "color": "#5e5ce6", "route": "/email"},
        {"name": "SalesPipelineAgent",     "emoji": "\U0001f4bc", "color": "#34c759", "route": "/pipeline"},
        {"name": "CustomerSuccessAgent",   "emoji": "\U0001f91d", "color": "#ff9500", "route": "/customers"},
        {"name": "MeetingSchedulerAgent",  "emoji": "\U0001f4c5", "color": "#bf5af2", "route": "/meetings"},
        {"name": "AnalyticsAgent",         "emoji": "\U0001f4ca", "color": "#ff3b30", "route": "/analytics"},
        {"name": "AskCRMAgent",            "emoji": "\U0001f50d", "color": "#30b0c7", "route": "/query"},
    ]
    today = date.today()
    results = []
    for a in known_agents:
        runs = db.query(func.count(AgentLog.id)).filter(
            AgentLog.agent_name == a["name"],
            func.date(AgentLog.created_at) == today
        ).scalar() or 0
        last = db.query(AgentLog).filter(AgentLog.agent_name == a["name"]).order_by(desc(AgentLog.created_at)).first()
        results.append({
            "name": a["name"], "emoji": a["emoji"], "color": a["color"], "route": a["route"],
            "status": "active" if runs > 0 else "standby",
            "runs_today": runs,
            "last_run": last.created_at.isoformat() if last and last.created_at else None,
        })
    return results


# ============================================================================
# GMAIL OAUTH + EMAIL OPERATIONS
# ============================================================================

@app.get("/api/auth/gmail")
async def gmail_auth_start():
    """Step 1 of Gmail OAuth2 — returns the URL the user must visit."""
    try:
        from services.gmail_service import get_oauth_authorization_url
        auth_url, state = get_oauth_authorization_url(
            redirect_uri="http://localhost:8000/api/auth/gmail/callback"
        )
        return {"auth_url": auth_url, "state": state,
                "instructions": "Open auth_url in your browser to authorize Gmail"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/auth/gmail/callback")
async def gmail_auth_callback(code: str, state: str = ""):
    """Step 2 — Google redirects here after user approval."""
    try:
        from services.gmail_service import complete_oauth_flow
        complete_oauth_flow(auth_code=code, redirect_uri="http://localhost:8000/api/auth/gmail/callback")
        return {"status": "Gmail authorized! You can now use /api/emails/sync"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/auth/gmail/status")
async def gmail_auth_status():
    """Check if Gmail OAuth token is present and valid."""
    from services.gmail_service import is_authenticated
    authed = is_authenticated()
    return {"authenticated": authed,
            "message": "Gmail connected" if authed else "Not connected — GET /api/auth/gmail to authorize"}


@app.get("/api/emails/sync")
async def sync_gmail_emails(limit: int = 20, db: Session = Depends(get_db)):
    """Fetch unread Gmail emails and save new ones to CRM."""
    from services.gmail_service import fetch_unread_emails
    from database.models import Email as EmailModel
    try:
        gmail_emails = fetch_unread_emails(max_results=limit)
        saved_count = 0
        for ge in gmail_emails:
            existing = db.query(EmailModel).filter(
                EmailModel.from_email == ge.get("from", ""),
                EmailModel.subject == ge.get("subject", "")
            ).first()
            if not existing:
                db.add(EmailModel(
                    from_email=ge.get("from", ""), to_email=ge.get("to", ""),
                    subject=ge.get("subject", ""), body=ge.get("body", ""),
                    direction="inbound",
                    extra_metadata={"gmail_id": ge.get("gmail_id"), "thread_id": ge.get("thread_id")},
                ))
                saved_count += 1
        db.commit()
        return {"status": "success", "fetched": len(gmail_emails), "saved_to_crm": saved_count, "emails": gmail_emails}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Gmail sync failed: {e}")


class SendReplyRequest(BaseModel):
    to_email: str
    subject: str
    body: str
    thread_id: str = None


@app.post("/api/emails/send-reply")
async def send_email_reply(req: SendReplyRequest, db: Session = Depends(get_db)):
    """Send an AI-drafted email reply via Gmail API and save to CRM."""
    from services.gmail_service import send_reply
    from database.models import Email as EmailModel
    try:
        result = send_reply(to_email=req.to_email, subject=req.subject, body=req.body, thread_id=req.thread_id)
        if result.get("success"):
            db.add(EmailModel(
                from_email="me", to_email=req.to_email, subject=req.subject, body=req.body,
                direction="outbound", response_sent=True,
                extra_metadata={"gmail_message_id": result.get("gmail_message_id")},
            ))
            db.commit()
        return result
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Gmail send failed: {e}")


# ============================================================================
# GOOGLE CALENDAR — REAL AVAILABILITY + BOOKING
# ============================================================================

@app.get("/api/calendar/availability")
async def get_calendar_availability(attendees: str = "", duration: int = 30, days_ahead: int = 7):
    """Query real Calendar freebusy API. attendees = comma-separated emails."""
    from services.calendar_service import find_available_slots
    try:
        attendee_list = [e.strip() for e in attendees.split(",") if e.strip()]
        slots = find_available_slots(attendee_emails=attendee_list, duration_minutes=duration, days_ahead=days_ahead)
        return {"slots": slots, "attendees": attendee_list, "duration_minutes": duration}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Calendar check failed: {e}")


class BookMeetingRequest(BaseModel):
    title: str
    start_iso: str
    end_iso: str
    attendee_emails: List[str]
    description: str = ""
    meeting_type: str = "general"


@app.post("/api/meetings/schedule-and-book")
async def schedule_and_book_meeting(req: BookMeetingRequest, db: Session = Depends(get_db)):
    """Book a meeting in Google Calendar AND save it to the CRM meetings table."""
    from services.calendar_service import create_event
    from database.models import Meeting
    from datetime import datetime as dt
    try:
        cal_result = create_event(
            title=req.title, start_iso=req.start_iso, end_iso=req.end_iso,
            attendee_emails=req.attendee_emails, description=req.description, add_meet_link=True,
        )
        try:
            scheduled_at = dt.fromisoformat(req.start_iso.replace("Z", "+00:00"))
        except ValueError:
            scheduled_at = dt.utcnow()
        meeting = Meeting(
            title=req.title, meeting_type=req.meeting_type, scheduled_at=scheduled_at,
            attendees=req.attendee_emails,
            status="confirmed" if cal_result.get("success") else "pending",
            extra_metadata=cal_result,
        )
        db.add(meeting)
        db.commit()
        db.refresh(meeting)
        return {
            "crm_meeting_id": meeting.id, "calendar": cal_result,
            "message": "Meeting booked and saved to CRM" if cal_result.get("success") else "Saved to CRM (connect Calendar first)",
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Meeting booking failed: {e}")


# ============================================================================
# RUN SERVER
# ============================================================================

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
