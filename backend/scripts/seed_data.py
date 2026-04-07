"""
Production-Ready Seed Data Script for AI CRM
=============================================
Populates all database tables with realistic synthetic data.

Usage:
    python scripts/seed_data.py

Requirements:
    - PostgreSQL running and configured via DATABASE_URL in .env
    - All dependencies installed: pip install -r requirements.txt
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

import uuid
import random
from datetime import datetime, timedelta, date
from database.connection import SessionLocal
from database.models import (
    Base, Company, Contact, Deal, Customer,
    Email, Meeting, Activity, AgentLog, AgentEvent, MetricsDaily
)
from database.connection import engine

# ──────────────────────────────────────────────────────────────────────────────
# Seed Constants
# ──────────────────────────────────────────────────────────────────────────────

COMPANIES = [
    {"name": "Acme Technologies", "domain": "acmetech.io", "industry": "Technology", "company_size": "enterprise", "revenue_range": "$10M-$50M", "location": "San Francisco, CA"},
    {"name": "Global Finance Corp", "domain": "globalfinance.com", "industry": "Finance", "company_size": "enterprise", "revenue_range": "$50M-$200M", "location": "New York, NY"},
    {"name": "HealthFirst Inc", "domain": "healthfirst.org", "industry": "Healthcare", "company_size": "large", "revenue_range": "$5M-$20M", "location": "Boston, MA"},
    {"name": "Retail Dynamics", "domain": "retaildynamics.co", "industry": "Retail", "company_size": "medium", "revenue_range": "$1M-$5M", "location": "Chicago, IL"},
    {"name": "EduTech Solutions", "domain": "edutech.ai", "industry": "Education", "company_size": "medium", "revenue_range": "$500K-$2M", "location": "Austin, TX"},
    {"name": "CloudScale Systems", "domain": "cloudscale.dev", "industry": "Technology", "company_size": "large", "revenue_range": "$20M-$100M", "location": "Seattle, WA"},
    {"name": "MegaManufacturing", "domain": "megamfg.com", "industry": "Manufacturing", "company_size": "enterprise", "revenue_range": "$100M+", "location": "Detroit, MI"},
    {"name": "StartupBoost", "domain": "startupboost.io", "industry": "Technology", "company_size": "small", "revenue_range": "$0-$500K", "location": "Denver, CO"},
    {"name": "LegalEagle Partners", "domain": "legaleagle.law", "industry": "Legal", "company_size": "medium", "revenue_range": "$2M-$10M", "location": "Washington, DC"},
    {"name": "MediaWave Inc", "domain": "mediawave.tv", "industry": "Media", "company_size": "large", "revenue_range": "$5M-$25M", "location": "Los Angeles, CA"},
]

FIRST_NAMES = ["Alice", "Bob", "Carol", "David", "Eva", "Frank", "Grace", "Henry", "Iris", "Jack",
               "Karen", "Leo", "Maya", "Noah", "Olivia", "Paul", "Quinn", "Rachel", "Sam", "Tara"]
LAST_NAMES  = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Wilson", "Moore",
               "Taylor", "Anderson", "Thomas", "Jackson", "White", "Harris", "Martin", "Thompson", "Walker", "Lee"]
JOB_TITLES  = ["VP of Engineering", "Chief Technology Officer", "Head of Product", "Director of Sales",
                "VP Operations", "Chief Marketing Officer", "Senior Engineer", "Product Manager",
                "Business Development Lead", "Procurement Manager"]
JOB_LEVELS  = ["executive", "director", "manager", "senior", "mid"]
LEAD_SOURCES = ["website", "referral", "linkedin", "trade_show", "email_campaign", "paid_search", "partner"]
DEAL_STAGES  = ["prospecting", "qualification", "proposal", "negotiation", "closed_won", "closed_lost"]
MEETING_TYPES = ["discovery", "demo", "follow_up", "executive_review", "training"]
PLANS        = ["Starter", "Professional", "Enterprise", "Custom"]

DEAL_NAMES = [
    "Deal Global Run", "AI 2027 Readiness", "Enterprise Rollout", 
    "Q3 Growth Initiative", "Cloud Migration", "Market Expansion", 
    "Platform Modernization", "Strategic Partnership", "Customer Retention",
    "Digital Transformation", "Security Compliance", "Infrastructure Audit"
]

EMAIL_SUBJECTS = [
    "Interested in a demo", "Question about pricing", "Need support for integration",
    "Following up on our call", "Interested in your platform", "Renewal discussion",
    "Urgent: Production issue", "Request for proposal", "Partnership opportunity",
    "Re: Onboarding session"
]
EMAIL_BODIES = [
    "Hi, I'd love to learn more about your product. Can we schedule a 30-minute call?",
    "We're evaluating solutions for our team. Could you send me the full pricing details?",
    "We ran into an issue with the API integration. Please advise ASAP.",
    "Just wanted to follow up on our conversation from last week. Are you free Thursday?",
    "Your product looks amazing! We're excited to get started. What are the next steps?",
    "Our contract is coming up for renewal. We'd like to discuss expansion options.",
    "URGENT: Our production system is down. Please escalate to your engineering team immediately.",
    "Attached is our RFP. Please respond by end of the month.",
    "We see potential for a strategic partnership between our companies.",
    "Looking forward to our onboarding session tomorrow. Any materials to review beforehand?"
]


def rand_past_date(days_back: int) -> datetime:
    return datetime.utcnow() - timedelta(days=random.randint(1, days_back))


def rand_future_date(days_ahead: int) -> date:
    return (datetime.utcnow() + timedelta(days=random.randint(1, days_ahead))).date()


def seed_all():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        print("🌱 Starting seed data insertion...")

        # ── Clear existing data (Except emails, agent logs, agent events) ─────
        db.query(MetricsDaily).delete()
        db.query(Activity).delete()
        db.query(Meeting).delete()
        db.query(Customer).delete()
        db.query(Deal).delete()
        db.query(Contact).delete()
        db.query(Company).delete()
        db.flush()

        # ── Companies ─────────────────────────────────────────────────────────
        print("  → Seeding companies...")
        company_objs = []
        for c in COMPANIES:
            company = Company(
                id=str(uuid.uuid4()),
                name=c["name"],
                domain=c["domain"],
                industry=c["industry"],
                company_size=c["company_size"],
                revenue_range=c["revenue_range"],
                location=c["location"],
                timezone="America/New_York",
                enrichment_data={"linkedin_employees": random.randint(50, 5000), "founded": random.randint(2000, 2020)},
            )
            db.add(company)
            company_objs.append(company)

        # ── Demo / Owner company ───────────────────────────────────────────────
        personal_company = Company(
            id=str(uuid.uuid4()),
            name="Personal Contacts",
            domain="gmail.com",
            industry="Personal",
            company_size="small",
            revenue_range="N/A",
            location="India",
            timezone="Asia/Kolkata",
        )
        db.add(personal_company)
        db.flush()
        company_objs.append(personal_company)


        # ── Contacts ──────────────────────────────────────────────────────────
        print("  → Seeding contacts...")
        contact_objs = []
        for i in range(10):
            company = random.choice(company_objs)
            first  = random.choice(FIRST_NAMES)
            last   = random.choice(LAST_NAMES)
            contact = Contact(
                id=str(uuid.uuid4()),
                company_id=company.id,
                email=f"{first.lower()}.{last.lower()}{i}@{company.domain}",
                first_name=first,
                last_name=last,
                job_title=random.choice(JOB_TITLES),
                job_level=random.choice(JOB_LEVELS),
                phone=f"+1-{random.randint(200,999)}-{random.randint(100,999)}-{random.randint(1000,9999)}",
                linkedin_url=f"https://linkedin.com/in/{first.lower()}{last.lower()}",
                # lead_score=random.randint(20, 100),
                lead_status=random.choice(["new", "contacted", "qualified", "nurture", "converted"]),
                lead_source=random.choice(LEAD_SOURCES),
                last_contact_at=rand_past_date(60),
                enrichment_data={"company_research": "Looked up on LinkedIn", "tech_stack": ["AWS", "Kubernetes"]},
            )
            db.add(contact)
            contact_objs.append(contact)
        db.flush()

        # ── Demo / Owner contacts ─────────────────────────────────────────────
        for demo_email, fname, lname, title in [
            ("satpatishrimanta@gmail.com", "Shrimanta", "Satpati", "CRM Owner"),
            ("dataduo@gmail.com", "Data", "Duo", "AI Product Lead"),
        ]:
            demo_contact = Contact(
                id=str(uuid.uuid4()),
                company_id=personal_company.id,
                email=demo_email,
                first_name=fname,
                last_name=lname,
                job_title=title,
                job_level="executive",
                lead_status="qualified",
                lead_source="Direct",
                enrichment_data={"source": "demo", "crm_owner": True},
            )
            db.add(demo_contact)
            contact_objs.append(demo_contact)
        db.flush()

        # ── Deals ─────────────────────────────────────────────────────────────
        print("  → Seeding deals...")
        deal_objs = []
        for i in range(10):
            contact = random.choice(contact_objs)
            stage   = random.choice(DEAL_STAGES)
            value   = random.choice([5000, 10000, 25000, 50000, 75000, 100000, 250000])
            deal = Deal(
                id=str(uuid.uuid4()),
                company_id=contact.company_id,
                contact_id=contact.id,
                name=f"Deal - {random.choice(DEAL_NAMES)}",
                value=value,
                stage=stage,
                probability={"prospecting": 10, "qualification": 25, "proposal": 50,
                             "negotiation": 75, "closed_won": 100, "closed_lost": 0}.get(stage, 50),
                is_stalled=random.choice([True, False, False, False]),
                risk_factors=random.sample(["No DM engaged", "Competitor active", "Budget unclear"], k=random.randint(0, 2)),
                stage_changed_at=rand_past_date(30),
                expected_close_date=rand_future_date(90),
                actual_close_date=rand_past_date(30).date() if stage in ["closed_won", "closed_lost"] else None,
                notes="Promising deal. High executive engagement.",
            )
            db.add(deal)
            deal_objs.append(deal)
        db.flush()

        # ── Customers ─────────────────────────────────────────────────────────
        print("  → Seeding customers...")
        customer_objs = []
        for company in random.sample(company_objs, 10):
            plan  = random.choice(PLANS)
            mrr   = {"Starter": 99, "Professional": 499, "Enterprise": 1999, "Custom": 4999}[plan]
            start = rand_past_date(500).date()
            csat: float = int(random.uniform(3.0, 5.0) * 10) / 10.0
            cust  = Customer(
                id=str(uuid.uuid4()),
                company_id=company.id,
                plan=plan,
                mrr=mrr,
                arr=mrr * 12,
                contract_start_date=start,
                contract_end_date=(datetime.combine(start, datetime.min.time()) + timedelta(days=365)).date(),
                churn_risk=random.choice(["low", "low", "medium", "high"]),
                churn_probability=random.randint(5, 60),
                last_login_at=rand_past_date(10),
                logins_per_week=random.randint(1, 30),
                features_used=random.randint(2, 10),
                total_features=10,
                license_usage_percent=random.randint(30, 95),
                daily_active_users=random.randint(5, 150),
                support_tickets_30d=random.randint(0, 8),
                critical_tickets_open=random.randint(0, 2),
                avg_resolution_hours=random.randint(4, 72),
                csat_score=csat,
                nps_score=random.randint(-10, 90),
                last_payment_at=rand_past_date(35),
                payment_delays=random.randint(0, 2),
            )
            db.add(cust)
            customer_objs.append(cust)
        db.flush()


        # ── Meetings ──────────────────────────────────────────────────────────
        print("  → Seeding meetings...")
        for i in range(10):
            deal      = random.choice(deal_objs)
            mt        = random.choice(MEETING_TYPES)
            sched_at  = rand_past_date(30) if random.random() > 0.4 else (datetime.utcnow() + timedelta(days=random.randint(1, 14)))
            status    = "completed" if sched_at < datetime.utcnow() else "scheduled"
            attendees = [f"rep{random.randint(1,5)}@yourcompany.com", random.choice(contact_objs).email]
            meeting = Meeting(
                id=str(uuid.uuid4()),
                deal_id=deal.id,
                title=f"{mt.replace('_', ' ').title()} - {random.choice(COMPANIES)['name']}",
                meeting_type=mt,
                scheduled_at=sched_at,
                duration_minutes={"discovery": 30, "demo": 60, "follow_up": 30, "executive_review": 90, "training": 120}[mt],
                location="Google Meet",
                attendees=attendees,
                agenda=["Introduction", "Demo walkthrough", "Questions & Answers", "Next steps"],
                prep_materials={"notes": "Review the account's product usage", "collateral": ["Product brochure"]},
                context={"company": "Acme Corp", "deal_stage": deal.stage},
                notes="Meeting went well. Customer showed strong interest." if status == "completed" else "",
                followup_tasks=["Send recording", "Follow up in 3 days"] if status == "completed" else [],
                status=status,
            )
            db.add(meeting)
        db.flush()

        # ── Activities ────────────────────────────────────────────────────────
        print("  → Seeding activities...")
        activity_types = ["call", "email_sent", "demo_given", "proposal_sent", "contract_sent", "check_in"]
        outcomes       = ["positive", "neutral", "follow_up_needed", "not_reached"]
        for i in range(10):
            contact = random.choice(contact_objs)
            deal    = random.choice(deal_objs)
            atype   = random.choice(activity_types)
            activity = Activity(
                id=str(uuid.uuid4()),
                contact_id=contact.id,
                deal_id=deal.id,
                activity_type=atype,
                subject=f"{atype.replace('_', ' ').title()} with {contact.first_name}",
                description=f"Had a productive {atype} to discuss the deal progress.",
                outcome=random.choice(outcomes),
                completed=random.choice([True, True, False]),
                due_date=rand_past_date(30),
                completed_at=rand_past_date(25) if random.random() > 0.3 else None,
            )
            db.add(activity)
        db.flush()


        # ── Daily Metrics ─────────────────────────────────────────────────────
        print("  → Seeding daily metrics...")
        base_date = date.today() - timedelta(days=30)
        for day_offset in range(10):
            metric_date = base_date + timedelta(days=day_offset)
            mrr_base    = 45000 + day_offset * 200
            avg_csat: float = int(random.uniform(3.5, 4.8) * 10) / 10.0
            db.add(MetricsDaily(
                id=str(uuid.uuid4()),
                metric_date=metric_date,
                leads_total=random.randint(8, 20),
                leads_qualified=random.randint(3, 10),
                deals_created=random.randint(1, 5),
                deals_won=random.randint(0, 3),
                deals_lost=random.randint(0, 2),
                revenue_won=random.choice([5000, 10000, 25000, 50000, 0]),
                customers_total=len(customer_objs),
                customers_churned=1 if random.random() < 0.1 else 0,
                mrr_total=mrr_base + random.randint(-1000, 1000),
                arr_total=(mrr_base + random.randint(-1000, 1000)) * 12,
                pipeline_value=random.randint(300000, 700000),
                avg_deal_size=random.randint(20000, 80000),
                avg_sales_cycle_days=random.randint(30, 90),
                avg_health_score=random.randint(55, 85),
                avg_nps_score=random.randint(20, 60),
                avg_csat_score=avg_csat,
            ))

        db.commit()
        print("\n✅ Seed data inserted successfully!")
        print(f"   Companies:      {len(company_objs)}")
        print(f"   Contacts:       30")
        print(f"   Deals:          20")
        print(f"   Customers:      {len(customer_objs)}")
        print(f"   Emails:         25")
        print(f"   Meetings:       15")
        print(f"   Activities:     40")
        print(f"   Agent Logs:     50")
        print(f"   Agent Events:   20")
        print(f"   Daily Metrics:  30")

    except Exception as e:
        db.rollback()
        print(f"\n❌ Error seeding data: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_all()
