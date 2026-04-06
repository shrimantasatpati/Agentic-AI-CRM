import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.connection import SessionLocal
from database.models import (
    Company, Contact, Deal, Customer,
    Email, Meeting, Activity, AgentLog, AgentEvent, MetricsDaily
)

def purge_all():
    db = SessionLocal()
    try:
        print("🗑️ Purging all tables for production transition...")
        
        # Order matters if there are foreign keys, but since this is SQLite,
        # we can just delete all.
        db.query(AgentEvent).delete()
        db.query(AgentLog).delete()
        db.query(Activity).delete()
        db.query(Meeting).delete()
        db.query(Email).delete()
        db.query(Deal).delete()
        db.query(Customer).delete()
        db.query(Contact).delete()
        db.query(Company).delete()
        db.query(MetricsDaily).delete()
        
        db.commit()
        print("✅ Database purged successfully. CRM is now clean.")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error during purge: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    confirm = input("⚠️ This will DELETE ALL CRM DATA. Type 'PURGE' to confirm: ")
    if confirm == "PURGE":
        purge_all()
    else:
        print("❌ Purge cancelled.")
