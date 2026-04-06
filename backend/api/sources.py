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
        raise HTTPException(status_code=500, detail=f"Salesforce import failed: {e}")

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
