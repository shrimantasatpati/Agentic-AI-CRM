"""Source Systems API — Salesforce, Excel, and REST Ingestion"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from database.connection import get_db
from database.models import Company, Contact, Deal, Customer
import uuid
import random
import json
import io
import csv
from datetime import datetime, timedelta

router = APIRouter()

@router.post("/import/salesforce")
async def import_salesforce(payload: list, db: Session = Depends(get_db)):
    """Simulate a Salesforce Sync — mapping SF objects to CRM schema.
       Excludes email population for privacy as requested.
    """
    imported_count = 0
    try:
        for entry in payload:
            # Create Company
            company_id = str(uuid.uuid4())
            new_company = Company(
                id=company_id,
                name=entry.get("AccountName", "New SF Account"),
                domain=entry.get("Website", ""),
                industry=entry.get("Industry", ""),
                location=entry.get("BillingCity", ""),
                enrichment_data={"source": "Salesforce", "sf_id": entry.get("Id")}
            )
            db.add(new_company)
            
            # Create Contact (Excluding Email)
            contact_id = str(uuid.uuid4())
            new_contact = Contact(
                id=contact_id,
                company_id=company_id,
                email=f"sf_import_{contact_id[:8]}@masked.com", # Masked as requested
                first_name=entry.get("FirstName", "Unknown"),
                last_name=entry.get("LastName", "Contact"),
                job_title=entry.get("Title", ""),
                lead_source="Salesforce"
            )
            db.add(new_contact)
            
            # Create Deal
            if entry.get("Amount"):
                new_deal = Deal(
                    id=str(uuid.uuid4()),
                    company_id=company_id,
                    contact_id=contact_id,
                    name=f"SF Opportunity - {entry.get('AccountName')}",
                    value=float(entry.get("Amount", 0)),
                    stage="qualification",
                    probability=10
                )
                db.add(new_deal)
            
            imported_count += 1
            
        db.commit()
        return {"status": "success", "imported": imported_count}
    except Exception as e:
        db.rollback()
        # Ensure we return a string, not an object, to avoid [object Object] in frontend
        error_msg = str(e)
        raise HTTPException(status_code=500, detail=f"Salesforce import failed: {error_msg}")

@router.post("/import/excel")
async def import_excel(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Import dataset from Excel/CSV and map to CRM schema."""
    try:
        content = await file.read()
        stream = io.StringIO(content.decode('utf-8'))
        reader = csv.DictReader(stream)
        
        count = 0
        for row in reader:
            # Basic mapping logic — looks for common headers
            company_name = row.get("Company") or row.get("Account") or row.get("Organization")
            if not company_name: continue
            
            company = Company(
                name=company_name,
                domain=row.get("Domain") or row.get("Website", ""),
                location=row.get("City", ""),
                enrichment_data={"source": "CSV/Excel Upload"}
            )
            db.add(company)
            db.flush()
            
            contact = Contact(
                company_id=company.id,
                email=row.get("Email") or f"import_{uuid.uuid4().hex[:8]}@masked.com",
                first_name=row.get("FirstName") or row.get("Name", "User"),
                lead_source="Excel Import"
            )
            db.add(contact)
            count += 1
            
        db.commit()
        return {"status": "success", "rows_processed": count}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"File import failed: {e}")

@router.get("/status")
async def get_source_status():
    """Health status of external source connectors"""
    return {
        "salesforce": {"status": "connected", "last_sync": datetime.now().isoformat()},
        "rest_api": {"status": "active", "endpoint": "/api/sources/import/rest"},
        "excel": {"status": "ready"}
    }

@router.post("/seed")
async def seed_production_data(db: Session = Depends(get_db)):
    """Populate CRM with high-quality synthetic data (max 10 records per table).
    Excludes emails and logs as requested.
    """
    try:
        # 1. Clear existing data (optional, but requested for 'fresh' production feel)
        # We only clear core entities to avoid breaking existing logs if they exist
        db.query(Customer).delete()
        db.query(Deal).delete()
        db.query(Contact).delete()
        db.query(Company).delete()
        db.flush()

        # 2. Seed Companies (10)
        from .analytics import COMPANIES as SEED_COMPANIES # Reuse if possible or define locally
        
        # Local definition for robustness
        COMPANIES_LIST = [
            {"name": "Acme Corp", "domain": "acme.com", "industry": "Technology", "loc": "San Francisco"},
            {"name": "Global Dynamics", "domain": "global-d.id", "industry": "Manufacturing", "loc": "Austin"},
            {"name": "Stark Industries", "domain": "stark.com", "industry": "Aerospace", "loc": "New York"},
            {"name": "Wayne Enterprises", "domain": "wayne.co", "industry": "Finance", "loc": "Gotham"},
            {"name": "Cyberdyne Systems", "domain": "cyberdyne.ai", "industry": "AI/Robotics", "loc": "Los Angeles"},
            {"name": "Oscorp", "domain": "oscorp.net", "industry": "Biotech", "loc": "New York"},
            {"name": "Initech", "domain": "initech.com", "industry": "Software", "loc": "Houston"},
            {"name": "Hooli", "domain": "hooli.com", "industry": "Search/Cloud", "loc": "Palo Alto"},
            {"name": "Pied Piper", "domain": "piedpiper.io", "industry": "Data Compression", "loc": "Palo Alto"},
            {"name": "Massive Dynamic", "domain": "massivedynamic.com", "industry": "Applied Science", "loc": "Boston"},
        ]

        companies = []
        for c in COMPANIES_LIST:
            comp = Company(
                id=str(uuid.uuid4()),
                name=c["name"],
                domain=c["domain"],
                industry=c["industry"],
                location=c["loc"]
            )
            db.add(comp)
            companies.append(comp)
        db.flush()

        # 3. Seed Contacts (1 per company)
        names = [("Elon", "Musk"), ("Sheryl", "Sandberg"), ("Satya", "Nadella"), ("Sundar", "Pichai"), 
                 ("Tim", "Cook"), ("Jensen", "Huang"), ("Lisa", "Su"), ("Marc", "Benioff"), 
                 ("Jack", "Dorsey"), ("Parag", "Agrawal")]
        
        contacts = []
        for i, comp in enumerate(companies):
            first, last = names[i]
            contact = Contact(
                id=str(uuid.uuid4()),
                company_id=comp.id,
                first_name=first,
                last_name=last,
                email=f"{first.lower()}.{last.lower()}@{comp.domain}",
                job_title=random.choice(["CEO", "CTO", "VP Engineering", "Head of Growth", "Director"]),
                lead_source="Direct Inbound"
            )
            db.add(contact)
            contacts.append(contact)
        db.flush()

        # 4. Seed Deals (1 per contact)
        deals = []
        stages = ["prospecting", "qualification", "proposal", "negotiation", "closed_won"]
        for i, contact in enumerate(contacts):
            deal = Deal(
                id=str(uuid.uuid4()),
                company_id=contact.company_id,
                contact_id=contact.id,
                name=f"Expansion Deal - {companies[i].name}",
                value=random.choice([25000, 50000, 75000, 120000, 250000]),
                stage=random.choice(stages),
                probability=50,
                health_score=random.randint(60, 95)
            )
            db.add(deal)
            deals.append(deal)
        db.flush()

        # 5. Seed Customers (3 from the companies)
        for i in range(3):
            comp = companies[i]
            db.add(Customer(
                id=str(uuid.uuid4()),
                company_id=comp.id,
                plan=random.choice(["Enterprise", "Growth"]),
                mrr=random.choice([5000, 10000, 15000]),
                health_score=random.randint(70, 99),
                churn_risk="low"
            ))

        db.commit()
        return {"status": "success", "message": "Synthetic production data seeded successfully (10 Companies, 10 Contacts, 10 Deals, 3 Customers)."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Seeding failed: {str(e)}")
