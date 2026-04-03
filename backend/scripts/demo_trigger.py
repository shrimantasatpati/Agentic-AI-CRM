"""
Demo Trigger Script for AI CRM
===============================
Simulates real-world events (incoming emails, form submissions)
to demonstrate automated agentic workflows.

Usage:
    python scripts/demo_trigger.py [scenario]
    
Scenarios:
    - email: Simulates an incoming customer email with negative sentiment.
    - lead:  Simulates a high-value lead filling out a website form.
    - all:   Runs both scenarios.
"""

import httpx
import asyncio
import sys
import json

BACKEND_URL = "http://localhost:8000"

async def trigger_email():
    print("\n📧 [Scenario] Incoming Customer Email...")
    payload = {
        "from": "jane.doe@frustrated-client.com",
        "to": "support@aicrm.io",
        "subject": "Urgent: Integration issues",
        "body": "I'm really having a hard time with the new API. It's been failing all morning and we're missing deadlines. Can someone please look into this immediately? Our contract renewal is next month and this isn't looking good."
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(f"{BACKEND_URL}/webhooks/email-received", json=payload)
            print(f"✅ Webhook sent! Status: {response.status_code}")
            print(f"🤖 AI Action: Analyzing sentiment and alerting Customer Success...")
        except Exception as e:
            print(f"❌ Failed to reach backend: {e}")

async def trigger_lead():
    print("\n🏆 [Scenario] High-Value Lead Form Submission...")
    payload = {
        "email": "sarah.connor@sky-high-tech.com",
        "first_name": "Sarah",
        "last_name": "Connor",
        "job_title": "VP of Engineering",
        "company": "Sky-High Tech",
        "message": "We are looking to scale our AI operations and need a robust CRM that handles automated agentic workflows. Can we schedule a demo for a team of 50?"
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(f"{BACKEND_URL}/webhooks/form-submission", json=payload)
            print(f"✅ Webhook sent! Status: {response.status_code}")
            print(f"🤖 AI Action: Qualifying lead, scoring 90+, and drafting follow-up...")
        except Exception as e:
            print(f"❌ Failed to reach backend: {e}")

async def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/demo_trigger.py [email|lead|all]")
        return

    scenario = sys.argv[1].lower()
    
    if scenario == "email":
        await trigger_email()
    elif scenario == "lead":
        await trigger_lead()
    elif scenario == "all":
        await trigger_email()
        await asyncio.sleep(2)
        await trigger_lead()
    else:
        print(f"Unknown scenario: {scenario}")

if __name__ == "__main__":
    asyncio.run(main())
