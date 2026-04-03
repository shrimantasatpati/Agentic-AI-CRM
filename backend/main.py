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
