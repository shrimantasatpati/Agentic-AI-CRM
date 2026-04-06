"""Leads API Endpoints"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from database.connection import get_db
from database.models import Contact

router = APIRouter()


class LeadCreate(BaseModel):
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    company_name: Optional[str] = None
    job_title: Optional[str] = None
    lead_source: Optional[str] = None


class LeadResponse(BaseModel):
    id: str
    email: str
    first_name: str
    last_name: str
    lead_score: int
    lead_status: str

    class Config:
        from_attributes = True


@router.get("/", response_model=List[LeadResponse])
async def list_leads(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """List all leads"""
    leads = db.query(Contact).offset(skip).limit(limit).all()
    return leads


@router.get("/{lead_id}", response_model=LeadResponse)
async def get_lead(lead_id: str, db: Session = Depends(get_db)):
    """Get lead by ID"""
    lead = db.query(Contact).filter(Contact.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead


@router.post("/", response_model=LeadResponse)
async def create_lead(lead: LeadCreate, db: Session = Depends(get_db)):
    """Create new lead — if email already exists, update the record (upsert)."""
    # Check for existing contact with same email (avoids UNIQUE constraint error)
    existing = db.query(Contact).filter(Contact.email == lead.email).first()
    if existing:
        # Update non-null fields only (upsert behaviour)
        data = lead.model_dump(exclude_unset=True)
        for field, value in data.items():
            if value is not None and hasattr(existing, field):
                setattr(existing, field, value)
        db.commit()
        db.refresh(existing)
        return existing
    # New contact — insert normally
    db_lead = Contact(**lead.model_dump())
    db.add(db_lead)
    db.commit()
    db.refresh(db_lead)
    return db_lead


@router.delete("/{lead_id}")
async def delete_lead(lead_id: str, db: Session = Depends(get_db)):
    """Delete lead"""
    lead = db.query(Contact).filter(Contact.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    db.delete(lead)
    db.commit()
    return {"status": "deleted"}
