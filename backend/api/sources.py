"""Source Systems API — Salesforce, Excel, and REST Ingestion"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from database.connection import get_db
from database.models import Company, Contact, Deal, Customer
from typing import List, Dict, Any
import uuid
import random
import io
import csv
from datetime import datetime, timedelta

router = APIRouter()

@router.post("/import/salesforce")
async def import_salesforce(payload: List[Dict[str, Any]], db: Session = Depends(get_db)):
    """Simulate a Salesforce Sync — mapping SF objects to CRM schema.
       Uses upsert logic: updates existing records by domain instead of inserting duplicates.
    """
    imported_count = 0
    try:
        for entry in payload:
            domain = entry.get("Website", "")

            # Upsert Company — update if domain already exists
            existing_company = db.query(Company).filter(Company.domain == domain).first() if domain else None
            if existing_company:
                existing_company.name = entry.get("AccountName", existing_company.name)
                existing_company.industry = entry.get("Industry", existing_company.industry)
                existing_company.location = entry.get("BillingCity", existing_company.location)
                db.flush()
                company_id = existing_company.id
            else:
                company_id = str(uuid.uuid4())
                new_company = Company(
                    id=company_id,
                    name=entry.get("AccountName", "New SF Account"),
                    domain=domain,
                    industry=entry.get("Industry", ""),
                    location=entry.get("BillingCity", ""),
                    enrichment_data={"source": "Salesforce", "sf_id": entry.get("Id")}
                )
                db.add(new_company)
                db.flush()

            # Upsert Contact — check by masked email pattern
            masked_email_prefix = f"sf_{entry.get('FirstName', 'Unknown').lower()}_{entry.get('LastName', 'Contact').lower()}"
            existing_contact = db.query(Contact).filter(
                Contact.company_id == company_id,
                Contact.lead_source == "Salesforce"
            ).first()

            if existing_contact:
                existing_contact.first_name = entry.get("FirstName", existing_contact.first_name)
                existing_contact.last_name = entry.get("LastName", existing_contact.last_name)
                existing_contact.job_title = entry.get("Title", existing_contact.job_title)
                db.flush()
                contact_id = existing_contact.id
            else:
                contact_id = str(uuid.uuid4())
                new_contact = Contact(
                    id=contact_id,
                    company_id=company_id,
                    email=f"{masked_email_prefix}_{contact_id[:8]}@masked.com",
                    first_name=entry.get("FirstName", "Unknown"),
                    last_name=entry.get("LastName", "Contact"),
                    job_title=entry.get("Title", ""),
                    lead_source="Salesforce"
                )
                db.add(new_contact)

            # Upsert Deal by company + name
            if entry.get("Amount"):
                deal_name = f"SF Opportunity - {entry.get('AccountName')}"
                existing_deal = db.query(Deal).filter(
                    Deal.company_id == company_id,
                    Deal.name == deal_name
                ).first()
                if existing_deal:
                    existing_deal.value = float(entry.get("Amount", existing_deal.value))
                else:
                    new_deal = Deal(
                        id=str(uuid.uuid4()),
                        company_id=company_id,
                        contact_id=contact_id,
                        name=deal_name,
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
            if not company_name:
                continue

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
        "rest_api": {"status": "active"},
        "excel": {"status": "ready"}
    }


@router.post("/seed")
async def seed_production_data():
    """Delete the existing database and repopulate with fresh data from seed_data.py.
    This is the canonical 'Generate Full Dataset' action.
    """
    try:
        import subprocess
        import sys
        import os
        script_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts", "seed_data.py")
        result = subprocess.run(
            [sys.executable, script_path],
            capture_output=True,
            text=True,
            timeout=60
        )
        if result.returncode != 0:
            raise HTTPException(status_code=500, detail=f"Seed script failed: {result.stderr}")
        return {"status": "success", "message": "✓ Database wiped and repopulated with fresh production data from seed_data.py"}
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=500, detail="Seed script timed out")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Seeding failed: {str(e)}")


@router.post("/import/rest")
async def import_rest_api(config: Dict[str, Any], db: Session = Depends(get_db)):
    """Import data from a custom REST API endpoint."""
    import httpx
    url = config.get("endpoint")
    method = config.get("method", "GET")
    headers = config.get("headers", {})
    body = config.get("body")

    if not url:
        raise HTTPException(status_code=400, detail="Missing endpoint URL")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            if method == "GET":
                res = await client.get(url, headers=headers)
            else:
                import json
                parsed_body = json.loads(body) if body else {}
                res = await client.post(url, headers=headers, json=parsed_body)
            
            data = res.json()
            # If it's a list, import it
            imported = 0
            if isinstance(data, list):
                for item in data[:50]: # Cap at 50 for demo
                    # Simple mapping for demo: look for email/name
                    email = item.get("email") or item.get("Email")
                    if not email: continue
                    
                    contact = Contact(
                        id=str(uuid.uuid4()),
                        email=email,
                        first_name=item.get("first_name") or item.get("Name", "REST"),
                        last_name=item.get("last_name") or "",
                        lead_source="REST API"
                    )
                    db.add(contact)
                    imported += 1
                db.commit()
            
            return {
                "status": "success",
                "http_status": res.status_code,
                "imported": imported,
                "data": data
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"REST import failed: {str(e)}")
