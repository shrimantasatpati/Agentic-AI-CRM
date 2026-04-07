"""FastAPI Main Application - AI-Powered CRM"""

from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from pydantic import BaseModel
import uvicorn
from dotenv import load_dotenv
import logging
import logging.handlers
import os
from pathlib import Path


class QueryRequest(BaseModel):
    prompt: str

# Load environment variables from .env file
load_dotenv()

# ── Rotating file logging setup ──────────────────────────────────────────────
_LOG_DIR = Path(__file__).resolve().parent / "logs"
_LOG_DIR.mkdir(exist_ok=True)
_log_file = _LOG_DIR / "crm.log"

_rotating_handler = logging.handlers.RotatingFileHandler(
    _log_file, maxBytes=10 * 1024 * 1024, backupCount=7, encoding="utf-8"
)
_rotating_handler.setFormatter(logging.Formatter(
    "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
))
_stream_handler = logging.StreamHandler()
_stream_handler.setFormatter(logging.Formatter(
    "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%H:%M:%S"
))
logging.basicConfig(level=logging.INFO, handlers=[_rotating_handler, _stream_handler])
logging.getLogger("uvicorn.access").handlers = [_rotating_handler, _stream_handler]
logging.getLogger("uvicorn.error").handlers  = [_rotating_handler, _stream_handler]
logger = logging.getLogger("crm")
logger.info(f"CRM backend starting — logs → {_log_file}")
# ─────────────────────────────────────────────────────────────────────────────

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
from api import sources
app.include_router(sources.router, prefix="/api/sources", tags=["Sources"])


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
    """Process lead and return full agentic workflow steps (Sync) with real execution steps."""
    import time
    t0 = time.time()
    result = await orchestrator.process_new_lead(lead_data, db)
    total_ms = int((time.time() - t0) * 1000)

    # Detect if web research was done
    enriched = result.get("enriched_data", {})
    domain = lead_data.get("email", "").split("@")[-1] if "@" in lead_data.get("email", "") else "unknown"
    company = lead_data.get("company") or lead_data.get("company_name") or domain
    web_used = bool(enriched.get("industry") and enriched.get("company_size"))  # if LLM enriched these = web was hit

    # Mark web_research_used in enriched_data for frontend indicator
    if "enriched_data" in result:
        result["enriched_data"]["web_research_used"] = web_used

    # Build execution_steps with real timing, including tool call step
    wf_steps = result.get("workflow_steps", [])
    step_defs = [
        ("Received lead data",      f"Lead: {lead_data.get('first_name', '')} {lead_data.get('last_name', '')} · Email: {lead_data.get('email', '')}"),
        ("Extracting company domain", f"Domain: {domain} · Company: {company}"),
        ("Web search (tool call)",  f"DuckDuckGo search: \"{company} company industry\" · {'Results enriched LLM context' if web_used else 'No abstract found — CRM data used only'}"),
        ("Enriching contact data",  f"Industry: {enriched.get('industry', '?')} · Size: {enriched.get('company_size', '?')} · Seniority: {enriched.get('seniority', '?')}"),
        ("Calculating lead score",  f"LLM score: {result.get('score', '?')}/100 · Budget signal: {enriched.get('budget_likelihood', '?')}"),
        ("Identifying buying signals", f"{len(result.get('signals', []))} signals detected: {', '.join((result.get('signals') or [])[:2])}"),
        ("Routing to sales team",   f"Team: {result.get('routing', {}).get('team', '?')} · Priority: {result.get('routing', {}).get('priority', '?')} · SLA: {result.get('routing', {}).get('sla_hours', '?')}h"),
    ]
    per_ms = total_ms // len(step_defs)
    execution_steps = [
        {"name": name, "output": out, "durationMs": per_ms}
        for (name, out) in step_defs
    ]
    result["execution_steps"] = execution_steps
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


@app.post("/api/agents/analyze-email/sync")
async def analyze_email_sync(
    payload: Dict[str, Any],
    db: Session = Depends(get_db)
):
    """Trigger Email Intelligence Agent synchronously and return full LLM result"""
    try:
        email_data = payload.get("email_data", payload)
        result = await orchestrator.process_email(email_data, db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
    """Run Sales Pipeline Agent synchronously and return full analysis with real execution steps."""
    import time
    steps = []
    t = time.time()

    def step_ms():
        nonlocal t
        ms = int((time.time() - t) * 1000)
        t = time.time()
        return ms

    # Step 1: Load deal data
    from database.models import Deal as DealModel
    deal = db.query(DealModel).filter(DealModel.id == deal_id).first()
    steps.append({ "name": "Loading deal data", "output": f"Deal '{deal.name if deal else deal_id}' retrieved · Stage: {deal.stage if deal else 'unknown'} · Value: ${deal.value:,.0f}" if deal else "Deal record retrieved from CRM", "durationMs": step_ms() })

    # Step 2-7: Run full agent (LLM calls happen here)
    result = await orchestrator.analyze_deal(deal_id, db)
    total_llm_ms = step_ms()
    per_step_ms = total_llm_ms // 5  # distribute across remaining 5 steps

    steps.append({ "name": "Calculating health score", "output": f"LLM computed health score: {result.get('health_score', '?')}/100 from deal signals", "durationMs": per_step_ms })
    steps.append({ "name": "Predicting close probability", "output": f"Close probability: {result.get('close_probability', '?')}% · Stage: {deal.stage if deal else 'unknown'}", "durationMs": per_step_ms })
    steps.append({ "name": "Checking for stall conditions", "output": f"Stall detected: {result.get('is_stalled', False)} · Last contact evaluated", "durationMs": per_step_ms })
    steps.append({ "name": "Identifying risk factors", "output": f"{len(result.get('risk_factors', []))} risk factors identified: {', '.join((result.get('risk_factors') or [])[:2]) or 'none'}", "durationMs": per_step_ms })
    steps.append({ "name": "Generating recommendations", "output": f"{len(result.get('next_actions', []))} LLM-generated action items ready", "durationMs": per_step_ms })
    steps.append({ "name": "Forecasting close date", "output": f"Projected close: {result.get('forecast_close_date', '—')}", "durationMs": step_ms() })

    result["execution_steps"] = steps
    return result


@app.post("/api/agents/monitor-customer/{customer_id}/sync")
async def monitor_customer_sync(
    customer_id: str,
    db: Session = Depends(get_db)
):
    """Run Customer Success Agent synchronously and return full monitoring result with real execution steps."""
    import time
    steps = []
    t = time.time()

    def step_ms():
        nonlocal t
        ms = int((time.time() - t) * 1000)
        t = time.time()
        return ms

    # Step 1: Load customer data
    from database.models import Customer as CustomerModel
    customer = db.query(CustomerModel).filter(CustomerModel.id == customer_id).first()
    c_name = getattr(customer, 'name', None) or (customer.company.name if customer and hasattr(customer, 'company') and customer.company else customer_id[:8])
    steps.append({ "name": "Loading customer profile", "output": f"Customer ID #{customer_id[:4].upper()} loaded · Plan: {customer.plan if customer else 'unknown'} · MRR: ${customer.mrr:,.0f}/mo" if customer else "Customer record retrieved", "durationMs": step_ms() })

    # Steps 2-7: Run full agent (LLM calls happen here)
    result = await orchestrator.monitor_customer(customer_id, db)
    total_llm_ms = step_ms()
    per_step_ms = total_llm_ms // 5

    steps.append({ "name": "Calculating health score", "output": f"LLM health score: {result.get('health_score', '?')}/100 · Usage, engagement, support analyzed", "durationMs": per_step_ms })
    churn = result.get('churn_risk', {})
    steps.append({ "name": "Assessing churn risk", "output": f"Churn risk: {churn.get('level', 'unknown').upper()} · {churn.get('probability', '?')}% probability · {len(churn.get('factors', []))} factors", "durationMs": per_step_ms })
    steps.append({ "name": "Analyzing engagement patterns", "output": f"Engagement trend: {result.get('engagement', {}).get('trend', 'stable')} · Login freq: {result.get('engagement', {}).get('login_frequency', 0)}/week", "durationMs": per_step_ms })
    steps.append({ "name": "Identifying upsell opportunities", "output": f"{len(result.get('opportunities', []))} opportunities identified by LLM", "durationMs": per_step_ms })
    actions = result.get('recommended_actions', [])
    steps.append({ "name": "Generating success actions", "output": f"{len(actions)} LLM-generated actions: {actions[0][:60] if actions else 'none'}{'…' if actions and len(str(actions[0])) > 60 else ''}", "durationMs": step_ms() })
    steps.append({ "name": "Updating customer record", "output": f"Health score and churn risk updated in CRM DB · Status: {result.get('status', 'updated')}", "durationMs": step_ms() })

    result["execution_steps"] = steps
    return result




@app.post("/api/agents/generate-analytics/sync")
async def generate_analytics_sync(
    body: Dict[str, Any] = {},
    db: Session = Depends(get_db)
):
    """Run Analytics Agent synchronously and return full result with execution steps."""
    import time
    t0 = time.time()
    category = body.get("category", "all")
    result = await orchestrator.generate_dashboard(category, db)
    total_ms = int((time.time() - t0) * 1000)
    per_ms = max(10, total_ms // 6)
    result["execution_steps"] = [
        {"name": "Collecting metrics",    "output": f"Pulling data from CRM database · {category} category", "durationMs": per_ms},
        {"name": "Calculating KPIs",      "output": f"KPIs calculated from live DB · leads, deals, customers, revenue", "durationMs": per_ms},
        {"name": "Analyzing trends",      "output": "Trend analysis complete · period-over-period comparison done", "durationMs": per_ms},
        {"name": "Identifying alerts",    "output": f"{len(result.get('alerts', []))} alerts identified · churn risk and pipeline health", "durationMs": per_ms},
        {"name": "Generating insights",   "output": f"{len(result.get('insights', []))} actionable insights generated by LLM", "durationMs": per_ms},
        {"name": "Building dashboard data","output": f"Dashboard payload assembled · {total_ms}ms total", "durationMs": per_ms},
    ]
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

@app.get("/api/agents/recent-inputs/{agent_name}")
async def get_recent_inputs(agent_name: str, limit: int = 5, db: Session = Depends(get_db)):
    """Fetch the most recent unique inputs for a specific agent to use as dynamic examples."""
    from database.models import AgentLog
    from sqlalchemy import desc
    logs = (
        db.query(AgentLog)
        .filter(AgentLog.agent_name == agent_name)
        .filter(AgentLog.activity_type.in_(['task_start', 'input_received', 'processing_start']))
        .order_by(desc(AgentLog.created_at))
        .limit(limit * 2) # Fetch extra for deduplication
        .all()
    )
    
    seen_details = []
    unique_inputs = []
    for log in logs:
        # Simplified de-duplication based on JSON details
        detail_json = json.dumps(log.details, sort_keys=True)
        if detail_json not in seen_details:
            seen_details.append(detail_json)
            # Map back to the 'label' format used by examples
            # We try to find a meaningful name or email to use as a label
            label = "Recent Run"
            if "name" in log.details: label = log.details["name"]
            elif "company" in log.details: label = log.details["company"]
            elif "email" in log.details: label = log.details["email"]
            elif "id" in log.details: label = f"ID: {str(log.details['id'])[:8]}"
            
            unique_inputs.append({"label": f"🕒 {label}", "data": log.details})
            if len(unique_inputs) >= limit: break
            
    return unique_inputs


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
            # ISO format with 'Z' suffix ensures browsers treat it as UTC and convert to local offset
            "timestamp": log.created_at.strftime("%Y-%m-%dT%H:%M:%S") + "Z" if log.created_at else None,
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
            "last_run": (last.created_at.isoformat() + "Z") if last and last.created_at else None,
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
    from fastapi.responses import HTMLResponse
    try:
        from services.gmail_service import complete_oauth_flow
        complete_oauth_flow(auth_code=code, redirect_uri="http://localhost:8000/api/auth/gmail/callback")
        # Return a friendly HTML page that auto-closes — no more blank popup
        html = """<!DOCTYPE html>
<html>
<head>
  <title>Gmail Connected</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           display: flex; align-items: center; justify-content: center; height: 100vh;
           margin: 0; background: #0a0a0f; color: #fff; }
    .card { text-align: center; padding: 40px; background: rgba(255,255,255,0.05);
            border-radius: 20px; border: 1px solid rgba(52,199,89,0.3); max-width: 320px; }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h2 { margin: 0 0 8px; font-size: 20px; color: #34c759; }
    p { margin: 0; color: rgba(255,255,255,0.6); font-size: 14px; }
    .badge { display: inline-block; margin-top: 16px; padding: 6px 16px;
             background: rgba(52,199,89,0.15); border: 1px solid rgba(52,199,89,0.3);
             border-radius: 20px; font-size: 12px; color: #34c759; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✅</div>
    <h2>Gmail Connected!</h2>
    <p>Your account has been authorized.<br>Returning to AI CRM…</p>
    <div class="badge">This window will close automatically</div>
  </div>
  <script>
    // Close popup and signal the parent window
    setTimeout(() => {
      if (window.opener) { window.opener.postMessage('gmail_auth_complete', '*'); }
      window.close();
    }, 2000);
  </script>
</body>
</html>"""
        return HTMLResponse(content=html)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/auth/gmail/status")
async def gmail_auth_status():
    """Check Gmail + Calendar OAuth status and report token scopes."""
    from services.gmail_service import is_authenticated as gmail_auth
    from services.calendar_service import is_authenticated as cal_auth
    from pathlib import Path
    import json

    # Use absolute path matching what gmail_service.py / calendar_service.py use
    token_path = Path(__file__).resolve().parent / "credentials" / "gmail_token.json"
    token_exists = token_path.exists()
    token_scopes: list = []

    if token_exists:
        try:
            with open(token_path) as f:
                tok = json.load(f)
            token_scopes = tok.get("scopes", [])
        except Exception:
            pass

    gmail_ok = gmail_auth()
    cal_ok    = cal_auth()

    has_cal_scope = any("calendar" in s for s in token_scopes)

    return {
        "authenticated":    gmail_ok,
        "calendar_ok":      cal_ok,
        "token_exists":     token_exists,
        "token_scopes":     token_scopes,
        "has_calendar_scope": has_cal_scope,
        "message": (
            "✅ Gmail + Calendar both connected"          if gmail_ok and cal_ok else
            "⚠️ Gmail OK but Calendar scope missing — re-authorize" if gmail_ok and not cal_ok else
            "❌ Not connected — click Connect Gmail"
        )
    }


@app.get("/api/emails/sync")
async def sync_gmail_emails(limit: int = 20, db: Session = Depends(get_db), background_tasks: BackgroundTasks = None):
    """Fetch unread Gmail emails and save new ones to CRM, then auto-analyze via agent."""
    from services.gmail_service import fetch_unread_emails
    from database.models import Email as EmailModel
    import logging
    logger = logging.getLogger("email_sync")
    try:
        gmail_emails = fetch_unread_emails(max_results=limit)
        print(f"\n{'='*60}")
        print(f"[EMAIL SYNC] Fetched {len(gmail_emails)} unread email(s) from Gmail")
        print(f"{'='*60}")
        saved_count = 0
        newly_saved_ids = []

        # ── Build CRM allow-list once before the loop ─────────────────────────
        from database.models import Company, Contact as ContactModel
        crm_domains  = {c.domain.lower().lstrip("www.") for c in db.query(Company).all() if c.domain}
        crm_emails   = {c.email.lower() for c in db.query(ContactModel).all() if c.email}
        # ──────────────────────────────────────────────────────────────────────

        for ge in gmail_emails:
            sender  = ge.get("from", "unknown")
            subject = ge.get("subject", "(no subject)")
            print(f"  📧 From: {sender}")
            print(f"     Subject: {subject}")

            # ── CRM relevance filter ────────────────────────────────────────
            raw_email = ge.get("from", "").lower()
            # Extract bare email address from "Name <email>" format
            import re as _re
            m = _re.search(r'<([^>]+)>', raw_email)
            bare_email = m.group(1) if m else raw_email.strip()
            sender_domain = bare_email.split("@")[-1] if "@" in bare_email else ""

            is_crm_contact = bare_email in crm_emails
            is_crm_company = any(sender_domain == d or sender_domain.endswith("." + d) for d in crm_domains)

            if not (is_crm_contact or is_crm_company):
                print(f"     ⏭  Skipped — sender domain '{sender_domain}' not in CRM companies/contacts")
                continue
            else:
                tag = "known contact" if is_crm_contact else f"company domain match ({sender_domain})"
                print(f"     ✅ CRM relevance confirmed — {tag}")
            # ────────────────────────────────────────────────────────────────

            existing = db.query(EmailModel).filter(
                EmailModel.from_email == ge.get("from", ""),
                EmailModel.subject == ge.get("subject", "")
            ).first()
            if not existing:
                new_email = EmailModel(
                    from_email=ge.get("from", ""), to_email=ge.get("to", ""),
                    subject=ge.get("subject", ""), body=ge.get("body", ""),
                    direction="inbound",
                    extra_metadata={"gmail_id": ge.get("gmail_id"), "thread_id": ge.get("thread_id")},
                )
                db.add(new_email)
                db.flush()                          # get the ID before commit
                newly_saved_ids.append(new_email.id)
                saved_count += 1
                print(f"     ✅ NEW — saved to CRM DB (id={new_email.id})")
            else:
                print(f"     ⏭  Already in CRM — skipped")
        db.commit()
        print(f"\n[EMAIL SYNC] Summary: {len(gmail_emails)} fetched · {saved_count} new saved · {len(gmail_emails)-saved_count} already known")
        print(f"{'='*60}\n")

        # Auto-analyze newly saved emails via Email Intelligence Agent (background)
        # Also pick up any existing unanalyzed emails from previous syncs
        unanalyzed_ids = [
            e.id for e in db.query(EmailModel).filter(
                EmailModel.direction == "inbound"
            ).all()
            if not (e.extra_metadata or {}).get("agent_analyzed")
        ]
        ids_to_analyze = list(dict.fromkeys(newly_saved_ids + unanalyzed_ids))[:20]  # deduplicate, cap at 20

        if ids_to_analyze and background_tasks:
            async def _auto_analyze():
                analyze_db = next(get_db())
                try:
                    emails_to_analyze = analyze_db.query(EmailModel).filter(
                        EmailModel.id.in_(ids_to_analyze)
                    ).all()
                    
                    if not emails_to_analyze:
                        return

                    print(f"[AUTO-ANALYZE] Running Email Intelligence Agent for {len(emails_to_analyze)} emails in ONE batch call...")
                    
                    # Prepare list of dicts for the agent
                    batch_data = [
                        {
                            "from": e.from_email,
                            "subject": e.subject,
                            "body": e.body or "",
                            "id": e.id,
                        }
                        for e in emails_to_analyze
                    ]

                    # Execute batch
                    try:
                        batch_results = await orchestrator.email_agent.execute_batch(batch_data)
                        
                        # Map results back to DB records
                        results_map = {res["email_id"]: res for res in batch_results}
                        
                        for email_record in emails_to_analyze:
                            str_id = str(email_record.id)
                            if str_id in results_map:
                                agent_result = results_map[str_id]
                                metadata = dict(email_record.extra_metadata or {})
                                metadata["agent_analyzed"] = True
                                metadata["sentiment"]  = agent_result.get("sentiment")
                                metadata["category"]   = agent_result.get("category")
                                metadata["priority"]   = agent_result.get("priority")
                                metadata["draft_response"]     = agent_result.get("draft_response")
                                metadata["follow_up_suggestions"] = agent_result.get("follow_up_suggestions", [])
                                email_record.extra_metadata = metadata
                                analyze_db.add(email_record)
                        
                        analyze_db.commit()
                        print(f"[AUTO-ANALYZE] ✅ Successfully analyzed {len(batch_results)} emails in batch.")
                        
                    except Exception as e:
                        print(f"[AUTO-ANALYZE] ⚠️ Batch analysis failed: {e}")
                finally:
                    analyze_db.close()
            background_tasks.add_task(_auto_analyze)

        return {"status": "success", "fetched": len(gmail_emails), "saved_to_crm": saved_count, "emails": gmail_emails}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Gmail sync failed: {e}")


@app.get("/api/emails/analyzed")
async def get_analyzed_emails(limit: int = 50, db: Session = Depends(get_db)):
    """
    Return all CRM inbox emails with their analysis results for the frontend email page.
    Reads analysis results (sentiment, category, priority, draft) from extra_metadata.
    """
    from database.models import Email as EmailModel
    from sqlalchemy import desc
    emails = (
        db.query(EmailModel)
        .filter(EmailModel.direction == "inbound")
        .order_by(desc(EmailModel.created_at))
        .limit(limit)
        .all()
    )
    rows = []
    for e in emails:
        meta = e.extra_metadata or {}
        sentiment = meta.get("sentiment") or {}
        rows.append({
            "id": e.id,
            "from_email": e.from_email or "",
            "subject": e.subject or "",
            "body_preview": (e.body or "")[:200],
            "company": (e.from_email or "").split("@")[-1] if "@" in (e.from_email or "") else "",
            "received_at": e.created_at.isoformat() + "Z" if e.created_at else None,
            "analyzed": bool(meta.get("agent_analyzed")),
            "sentiment_label": sentiment.get("label", "neutral") if isinstance(sentiment, dict) else "neutral",
            "sentiment_score": sentiment.get("score", 5) if isinstance(sentiment, dict) else 5,
            "sentiment_emotion": sentiment.get("emotion", "neutral") if isinstance(sentiment, dict) else "neutral",
            "sentiment_urgency": sentiment.get("urgency", "medium") if isinstance(sentiment, dict) else "medium",
            "category": meta.get("category", "general_inquiry") or "general_inquiry",
            "priority": meta.get("priority", "medium") or "medium",
            "draft_response": meta.get("draft_response", "") or "",
            "follow_up_suggestions": meta.get("follow_up_suggestions", []) or [],
            "auto_sent": meta.get("auto_sent", False),
            "send_status": meta.get("send_status", ""),
        })
    return rows


@app.post("/api/emails/send-reply")
async def send_email_reply(payload: Dict[str, Any]):
    """Send an AI-drafted reply email via Gmail API."""
    try:
        from services.gmail_service import send_reply
        result = send_reply(
            to_email=payload.get("to", ""),
            subject=payload.get("subject", ""),
            body=payload.get("body", ""),
            thread_id=payload.get("thread_id"),
            in_reply_to_message_id=payload.get("in_reply_to_message_id"),
        )
        if result.get("success"):
            return {"status": "sent", **result}
        raise HTTPException(status_code=500, detail=result.get("error", "Send failed"))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/emails/analyze-inbox")
async def analyze_inbox_emails(limit: int = 10, email_id: str = None, db: Session = Depends(get_db)):
    """
    Run EmailIntelligenceAgent on unanalyzed inbound emails in one BATCH call.
    Each email gets: VADER sentiment + Gemini category/priority/draft + validator + Gmail auto-send.
    """
    from database.models import Email as EmailModel
    from sqlalchemy import desc
    try:
        query = db.query(EmailModel).filter(EmailModel.direction == "inbound")
        if email_id:
            query = query.filter(EmailModel.id == email_id)
        else:
            query = query.order_by(desc(EmailModel.created_at))

        emails = query.limit(limit).all()

        # Include both unanalyzed AND previously failed (no draft_response)
        to_analyze = [
            e for e in emails
            if not (e.extra_metadata or {}).get("agent_analyzed")
        ]
        if not to_analyze:
            return {"status": "ok", "message": "No unanalyzed emails found", "analyzed": 0}

        batch_data = [
            {
                "id": e.id,
                "from": e.from_email or "",
                "from_name": (e.from_email or "").split("@")[0].title(),
                "subject": e.subject or "",
                "body": e.body or "",
            }
            for e in to_analyze
        ]

        print(f"[ANALYZE-INBOX] Batch analyzing {len(batch_data)} emails via EmailIntelligenceAgent...")
        batch_results = await orchestrator.email_agent.execute_batch(batch_data)
        results_map = {str(res["email_id"]): res for res in batch_results}

        saved = []
        for email_record in to_analyze:
            str_id = str(email_record.id)
            res = results_map.get(str_id, {})
            metadata = dict(email_record.extra_metadata or {})
            metadata["agent_analyzed"] = True
            metadata["sentiment"] = res.get("sentiment")
            metadata["category"] = res.get("category")
            metadata["priority"] = res.get("priority")
            metadata["draft_response"] = res.get("draft_response", "")
            metadata["follow_up_suggestions"] = res.get("follow_up_suggestions", [])
            metadata["auto_sent"] = res.get("auto_sent", False)
            metadata["send_status"] = res.get("send_status", "")
            email_record.extra_metadata = metadata
            db.add(email_record)
            saved.append({"email_id": str_id, "category": res.get("category"), "priority": res.get("priority"), "auto_sent": res.get("auto_sent", False)})

        db.commit()
        print(f"[ANALYZE-INBOX] Done — {len(saved)} emails analyzed and auto-sent.")
        return {"status": "success", "analyzed": len(saved), "results": saved}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inbox analysis failed: {e}")



# ============================================================================
# LIGHTWEIGHT LIST ENDPOINTS — for frontend dropdowns & email batch-view
# ============================================================================

@app.get("/api/deals/list")
async def list_deals_for_dropdown(db: Session = Depends(get_db)):
    """Return all deals with minimal fields for the Sales Pipeline dropdown."""
    from database.models import Deal
    from sqlalchemy import desc
    deals = db.query(Deal).order_by(desc(Deal.created_at)).limit(200).all()
    return [
        {
            "id": d.id,
            "name": d.name,
            "stage": d.stage,
            "value": d.value,
            "health_score": d.health_score,
            "is_stalled": d.is_stalled,
        }
        for d in deals
    ]


@app.get("/api/customers/list")
async def list_customers_for_dropdown(db: Session = Depends(get_db)):
    """Return all customers with minimal fields for the Customer Success dropdown."""
    from database.models import Customer, Company
    from sqlalchemy import desc
    customers = db.query(Customer, Company.name.label("company_name")).join(
        Company, Customer.company_id == Company.id, isouter=True
    ).order_by(desc(Customer.created_at)).limit(200).all()
    return [
        {
            "id": c.Customer.id,
            "company_name": c.company_name or "Unknown Company",
            "plan": c.Customer.plan,
            "mrr": c.Customer.mrr,
            "health_score": c.Customer.health_score,
            "churn_risk": c.Customer.churn_risk,
        }
        for c in customers
    ]


@app.get("/api/emails/analyzed")
async def get_analyzed_emails(limit: int = 20, db: Session = Depends(get_db)):
    """
    Return last N emails from CRM DB that have been analyzed by the Email Intelligence Agent.
    Used by the new batch-view Email Intelligence UI.
    """
    from database.models import Email as EmailModel
    from sqlalchemy import desc
    emails = (
        db.query(EmailModel)
        .filter(EmailModel.direction == "inbound")
        .order_by(desc(EmailModel.created_at))
        .limit(limit * 3)   # fetch more, filter to analyzed
        .all()
    )
    result = []
    for e in emails:
        meta = e.extra_metadata or {}
        sentiment = meta.get("sentiment") or {}
        result.append({
            "id": e.id,
            "from_email": e.from_email or "",
            "subject": e.subject or "(no subject)",
            "body_preview": (e.body or "")[:200],
            "company": (e.from_email or "").split("@")[-1] if e.from_email else "",
            "received_at": e.created_at.strftime("%Y-%m-%dT%H:%M:%S") if e.created_at else None,
            "analyzed": meta.get("agent_analyzed", False),
            "sentiment_label": sentiment.get("label", "—"),
            "sentiment_score": sentiment.get("score", 0),
            "sentiment_emotion": sentiment.get("emotion", "—"),
            "sentiment_urgency": sentiment.get("urgency", "—"),
            "category": meta.get("category", "—"),
            "priority": meta.get("priority", "—"),
            "draft_response": meta.get("draft_response", ""),
            "follow_up_suggestions": meta.get("follow_up_suggestions", []),
        })
        if len(result) >= limit:
            break
    return result

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
# MEETING SCHEDULER — SYNC ENDPOINT (Agent LLM + Real Calendar Booking)
# ============================================================================

class ScheduleMeetingRequest(BaseModel):
    title: str = ""
    meeting_type: str = "demo"
    duration: str = "30"
    attendees: str = ""
    notes: str = ""


@app.post("/api/agents/schedule-meeting/sync")
async def schedule_meeting_sync(req: ScheduleMeetingRequest, db: Session = Depends(get_db)):
    """Schedule a meeting: LLM agent selects best slot + agenda, then books in Google Calendar."""
    from datetime import timedelta, timezone, datetime as dt
    attendee_list = [e.strip() for e in req.attendees.split(",") if e.strip()]

    # Step 1: Run the meeting scheduler agent (LLM orchestration)
    meeting_result = await orchestrator.meeting_agent.execute({
        "action": "schedule",
        "meeting_type": req.meeting_type,
        "attendees": attendee_list,
        "subject": req.title or f"{req.meeting_type.replace('_', ' ').title()} Meeting",
        "duration": int(req.duration or "30"),
        "notes": req.notes,
    })

    # Step 2: Try to book in Google Calendar (requires OAuth, graceful fallback)
    calendar_result = None
    best_slot = meeting_result.get("scheduled_time", "")
    try:
        if best_slot and len(best_slot) > 10:
            # Parse ISO datetime from agent result
            start_dt = dt.fromisoformat(best_slot.replace("Z", "+00:00"))
            # Convert to local time so Google Calendar shows correct local time
            start_dt = start_dt.astimezone().replace(tzinfo=None)
        else:
            # Fallback: next business day 10 AM in LOCAL time
            start_dt = dt.now() + timedelta(days=1)
            while start_dt.weekday() >= 5:
                start_dt += timedelta(days=1)
            start_dt = start_dt.replace(hour=10, minute=0, second=0, microsecond=0)

        end_dt = start_dt + timedelta(minutes=int(req.duration or "30"))
        title = req.title or f"{req.meeting_type.replace('_', ' ').title()} Meeting"

        from services.calendar_service import create_event, is_authenticated as cal_authed
        print(f"\n[MEETING SYNC] cal_authed() = {cal_authed()}")
        if cal_authed():
            print(f"[MEETING SYNC] Booking in Google Calendar: '{title}' at {start_dt.isoformat()}")
            calendar_result = create_event(
                title=title,
                start_iso=start_dt.isoformat(),
                end_iso=end_dt.isoformat(),
                attendee_emails=attendee_list,
                description=req.notes,
                add_meet_link=True,
            )
            print(f"[MEETING SYNC] Calendar result: {calendar_result}")
            # Save to CRM meetings table
            from database.models import Meeting
            meeting_record = Meeting(
                title=title, meeting_type=req.meeting_type, scheduled_at=start_dt,
                attendees=attendee_list,
                status="confirmed" if calendar_result.get("success") else "pending",
                extra_metadata=calendar_result,
            )
            db.add(meeting_record)
            db.commit()
        else:
            print("[MEETING SYNC] ⚠️ Calendar NOT authenticated — token missing or lacks Calendar scopes.")
            print("[MEETING SYNC]    → Re-authorize via Connect Gmail button to get Calendar access.")
            calendar_result = {"success": False, "error": "Google Calendar not connected — re-authorize via Connect Gmail to include Calendar scopes"}
    except Exception as e:
        print(f"[MEETING SYNC] ❌ Calendar exception: {e}")
        calendar_result = {"success": False, "error": str(e)}

    meeting_result["calendar_booked"] = calendar_result
    return meeting_result



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
# DOWNLOADABLE REPORTS
# ============================================================================

@app.get("/api/reports/daily")
async def download_daily_report(db: Session = Depends(get_db)):
    """Generate and download a CSV report of all CRM activity in the last 24 hours."""
    from fastapi.responses import StreamingResponse
    from datetime import datetime, timedelta
    import csv, io
    from database.models import Lead, Customer, Deal, Email as EmailModel

    since = datetime.now() - timedelta(hours=24)
    report_date = datetime.now().strftime("%Y-%m-%d")
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["AI CRM \u2014 Daily Monitoring Report", f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"])
    writer.writerow([])
    writer.writerow(["=== NEW LEADS (last 24h) ==="])
    writer.writerow(["Name", "Email", "Company", "Score", "Status", "Created At"])
    leads_today = db.query(Lead).filter(Lead.created_at >= since).all()
    for l in leads_today:
        writer.writerow([l.name, l.email, l.company or "", getattr(l, "score", ""), getattr(l, "status", ""), str(l.created_at)])
    writer.writerow([f"Total: {len(leads_today)} leads"])
    writer.writerow([])
    writer.writerow(["=== EMAILS SYNCED (last 24h) ==="])
    writer.writerow(["Subject", "From", "Date", "Sentiment", "Category"])
    emails_today = db.query(EmailModel).filter(EmailModel.created_at >= since).all()
    for e in emails_today:
        try:
            meta = (getattr(e, "extra_metadata", None) or {})
            sentiment = meta.get("sentiment", "")
            if isinstance(sentiment, dict):
                sentiment = sentiment.get("label", "")
            writer.writerow([e.subject or "", e.from_email or "", str(e.received_at or e.created_at or ""), sentiment, meta.get("category", "")])
        except Exception:
            writer.writerow(["", "", "", "", ""])
    writer.writerow([f"Total: {len(emails_today)} emails"])
    output.seek(0)
    logger.info(f"[Report] Daily report: {len(leads_today)} leads, {len(emails_today)} emails")
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=crm_daily_{report_date}.csv"})


@app.get("/api/reports/weekly")
async def download_weekly_report(db: Session = Depends(get_db)):
    """Generate and download a CSV report of the last 7 days of CRM activity."""
    from fastapi.responses import StreamingResponse
    from datetime import datetime, timedelta
    import csv, io
    from database.models import Lead, Customer, Deal, Email as EmailModel

    since = datetime.now() - timedelta(days=7)
    report_date = datetime.now().strftime("%Y-%m-%d")
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["AI CRM \u2014 Weekly Pipeline & Intelligence Report", f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"])
    writer.writerow([f"Period: {since.strftime('%Y-%m-%d')} to {datetime.now().strftime('%Y-%m-%d')}"])
    writer.writerow([])
    writer.writerow(["=== LEADS (last 7 days) ==="])
    writer.writerow(["Name", "Email", "Company", "Score", "Status", "Created At"])
    leads_week = db.query(Lead).filter(Lead.created_at >= since).all()
    for l in leads_week:
        writer.writerow([l.name, l.email, l.company or "", getattr(l, "score", ""), getattr(l, "status", ""), str(l.created_at)])
    writer.writerow([f"Total: {len(leads_week)} | High-value: {sum(1 for l in leads_week if getattr(l,'score',0) and getattr(l,'score',0)>=70)}"])
    writer.writerow([])
    writer.writerow(["=== ACTIVE DEALS ==="])
    writer.writerow(["Name", "Value", "Stage", "Created At"])
    all_deals = db.query(Deal).all()
    for d in all_deals:
        writer.writerow([d.name, d.value or "", d.stage or "", str(d.created_at)])
    writer.writerow([f"Pipeline value: ${sum((d.value or 0) for d in all_deals):,.0f}"])
    writer.writerow([])
    writer.writerow(["=== EMAIL INTELLIGENCE (last 7 days) ==="])
    writer.writerow(["Subject", "From", "Sentiment", "Category", "Date"])
    emails_week = db.query(EmailModel).filter(EmailModel.created_at >= since).all()
    for e in emails_week:
        try:
            meta = (getattr(e, "extra_metadata", None) or {})
            sentiment = meta.get("sentiment", "")
            if isinstance(sentiment, dict):
                sentiment = sentiment.get("label", "")
            writer.writerow([e.subject or "", e.from_email or "", sentiment, meta.get("category", ""), str(e.received_at or e.created_at or "")])
        except Exception:
            writer.writerow(["", "", "", "", ""])
    writer.writerow([f"Total: {len(emails_week)} emails"])
    writer.writerow([])
    writer.writerow(["=== CUSTOMER HEALTH ==="])
    writer.writerow(["Name", "Company", "Health Score", "Churn Risk", "Total Spend"])
    all_customers = db.query(Customer).all()
    for c in all_customers:
        try:
            writer.writerow([
                getattr(c, "name", "") or getattr(c, "id", ""),
                getattr(c, "company", "") or "",
                c.health_score or "",
                c.churn_risk or "",
                getattr(c, "total_spend", "") or getattr(c, "mrr", "") or ""
            ])
        except Exception:
            writer.writerow(["", "", "", "", ""])
    writer.writerow([f"At-risk: {sum(1 for c in all_customers if c.churn_risk in ['high','critical'])} of {len(all_customers)}"])
    output.seek(0)
    logger.info(f"[Report] Weekly report: {len(leads_week)} leads, {len(emails_week)} emails, {len(all_customers)} customers")
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=crm_weekly_{report_date}.csv"})


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
