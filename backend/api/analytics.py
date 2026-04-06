"""Analytics API Endpoints"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from database.connection import get_db
from database.models import Deal, Contact, Customer
import io
import csv
from datetime import datetime, timedelta

router = APIRouter()

@router.get("/dashboard")
async def get_dashboard(db: Session = Depends(get_db)):
    """Get dashboard metrics with real period-over-period trend calculations."""
    now = datetime.utcnow()
    last_30 = now - timedelta(days=30)
    prev_30 = now - timedelta(days=60)

    def get_trend(curr: float, prev: float) -> dict:
        if prev == 0:
            return {"value": 0, "direction": "neutral"}
        pct = round(((curr - prev) / prev) * 100)
        return {"value": abs(pct), "direction": "up" if pct >= 0 else "down"}

    # Leads
    total_leads = db.query(Contact).count()
    leads_curr = db.query(Contact).filter(Contact.created_at >= last_30).count()
    leads_prev = db.query(Contact).filter(Contact.created_at >= prev_30, Contact.created_at < last_30).count()
    
    # Revenue (Pipeline)
    pipe_all = db.query(func.sum(Deal.value)).filter(
        Deal.stage.in_(['prospecting', 'qualification', 'proposal', 'negotiation'])
    ).scalar() or 0
    pipe_curr = db.query(func.sum(Deal.value)).filter(
        Deal.stage.in_(['prospecting', 'qualification', 'proposal', 'negotiation']),
        Deal.created_at >= last_30
    ).scalar() or 0
    pipe_prev = db.query(func.sum(Deal.value)).filter(
        Deal.stage.in_(['prospecting', 'qualification', 'proposal', 'negotiation']),
        Deal.created_at >= prev_30, Deal.created_at < last_30
    ).scalar() or 0
    
    # Customers & MRR
    total_customers = db.query(Customer).count()
    cust_prev = db.query(Customer).filter(Customer.created_at < last_30).count()
    total_mrr = db.query(func.sum(Customer.mrr)).scalar() or 0

    return {
        "leads": {
            "total": total_leads,
            "qualified": db.query(Contact).filter(Contact.lead_status == 'qualified').count(),
            "trend": get_trend(leads_curr, leads_prev)
        },
        "deals": {
            "total": total_deals,
            "pipeline_value": float(pipe_all),
            "trend": get_trend(float(pipe_curr), float(pipe_prev))
        },
        "customers": {
            "total": total_customers,
            "mrr": float(total_mrr),
            "arr": float(total_mrr * 12),
            "trend": get_trend(total_customers, cust_prev)
        }
    }


@router.get("/pipeline")
async def get_pipeline_metrics(db: Session = Depends(get_db)):
    """Get pipeline breakdown by stage"""

    stages = ['prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost']
    pipeline = {}

    for stage in stages:
        count = db.query(Deal).filter(Deal.stage == stage).count()
        value = db.query(func.sum(Deal.value)).filter(Deal.stage == stage).scalar() or 0

        pipeline[stage] = {
            "count": count,
            "value": float(value)
        }

    return pipeline


@router.get("/report/csv")
async def download_csv_report(db: Session = Depends(get_db)):
    """Download a full CRM CSV report covering Leads, Deals, and Customers."""
    try:
        output = io.StringIO()
        writer = csv.writer(output)

        writer.writerow(["=== LEADS / CONTACTS ==="])
        writer.writerow(["ID", "First Name", "Last Name", "Email", "Job Title", "Lead Score", "Lead Status", "Lead Source", "Company ID", "Created At"])
        contacts = db.query(Contact).order_by(Contact.created_at.desc()).limit(500).all()
        for c in contacts:
            writer.writerow([c.id or "", c.first_name or "", c.last_name or "", c.email or "", c.job_title or "", c.lead_score or 0, c.lead_status or "", c.lead_source or "", c.company_id or "", str(c.created_at)[:19] if c.created_at else ""])

        writer.writerow([])
        writer.writerow(["=== DEALS ==="])
        writer.writerow(["ID", "Name", "Stage", "Value ($)", "Probability (%)", "Health Score", "Is Stalled", "Expected Close", "Created At"])
        deals = db.query(Deal).order_by(Deal.created_at.desc()).limit(500).all()
        for d in deals:
            writer.writerow([d.id or "", d.name or "", d.stage or "", d.value or 0, d.probability or 0, d.health_score or 0, "Yes" if d.is_stalled else "No", str(d.expected_close_date) if d.expected_close_date else "", str(d.created_at)[:19] if d.created_at else ""])

        writer.writerow([])
        writer.writerow(["=== CUSTOMERS ==="])
        writer.writerow(["ID", "Company ID", "Plan", "MRR ($)", "ARR ($)", "Health Score", "Churn Risk", "Churn Probability (%)", "Logins/Week", "CSAT Score", "NPS Score", "Created At"])
        customers = db.query(Customer).order_by(Customer.created_at.desc()).limit(500).all()
        for cu in customers:
            writer.writerow([cu.id or "", cu.company_id or "", cu.plan or "", cu.mrr or 0, cu.arr or 0, cu.health_score or 0, cu.churn_risk or "", cu.churn_probability or 0, cu.logins_per_week or 0, cu.csat_score or 0, cu.nps_score or 0, str(cu.created_at)[:19] if cu.created_at else ""])

        output.seek(0)
        csv_bytes = output.getvalue().encode("utf-8-sig")

        return StreamingResponse(
            iter([csv_bytes]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=crm_report.csv"}
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
