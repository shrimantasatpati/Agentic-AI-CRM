# AI CRM — Complete System Documentation
### For Demo Presentation · April 2026

---

## Table of Contents
1. [System Overview](#system-overview)
2. [How AI Works — Technical Truth](#how-ai-works)
3. [Active LLM Model](#active-llm-model)
4. [Navigation Tabs](#navigation-tabs)
5. [Agent Deep Dives](#agent-deep-dives)
6. [Email Intelligence (Special)](#email-intelligence)
7. [Data & Database](#data--database)
8. [Salesforce Sync — Data Format](#salesforce-sync)
9. [Demo Script](#demo-script)

---

## System Overview

**AI CRM** is a production-grade Customer Relationship Management system powered by real Large Language Model (LLM) AI agents. Every action you see triggers an actual LLM call — no smoke and mirrors.

### Tech Stack
| Layer | Technology |
|---|---|
| **Frontend** | Next.js 14 (App Router) + TypeScript |
| **Backend** | FastAPI (Python) + async/await |
| **Database** | SQLite (`ai_crm.db`) — 11 companies, 30 contacts, 20 deals, 10 customers |
| **LLM** | **Gemini 2.5 Flash** (primary) · Groq (fallback) · xAI/Grok (fallback) |
| **Email** | Gmail OAuth2 API (real inbox) |
| **Sentiment** | VADER (rule-based, real-time, no API cost) |
| **Search** | WebSearchTool (DuckDuckGo, for lead enrichment) |

---

## Active LLM Model

> [!IMPORTANT]
> The system is configured to use **Google Gemini 2.5 Flash** (`gemini-2.5-flash-preview-04-17`).

### How the LLM is chosen (`backend/.env`)
```
MODEL_PROVIDER=gemini           ← Forces Gemini as the active provider
GEMINI_MODEL_NAME=gemini-2.5-flash-preview-04-17
GEMINI_API_KEY=sk-...           ← Your Gemini API key
GROQ_API_KEY=gsk_...            ← Kept as fallback
```

### Priority Order (from `workflows/orchestrator.py`)
```
MODEL_PROVIDER env var set → that provider wins
Otherwise: Groq → Gemini → xAI → MOCK (no key)
```

Since `MODEL_PROVIDER=gemini`, **Groq is NOT used** even though `GROQ_API_KEY` is set.

### LLM Provider Table
| Provider | Model | When Used |
|---|---|---|
| **Gemini** (active) | `gemini-2.5-flash-preview-04-17` | `MODEL_PROVIDER=gemini` (current) |
| Groq (fallback) | `llama-3.1-8b-instant` | If `MODEL_PROVIDER` not set and Groq key exists |
| xAI/Grok | `grok-2-1212` | If only `XAI_API_KEY` set |
| Mock | — | No API key configured |

To switch back to Groq: remove `MODEL_PROVIDER=gemini` from `.env`.

---

## How AI Works — Technical Truth

> [!IMPORTANT]
> Every agent **makes a real LLM API call**. There is no hardcoded output. The execution steps panel shows the **actual wall-clock timing** of that LLM call, replayed step-by-step after the result arrives.

### What is REAL vs MOCK?

| Component | Real or Mock? | Notes |
|---|---|---|
| Lead scoring (0–100) | ✅ **REAL LLM** | Gemini 2.5 Flash analyzes lead data |
| Lead score_breakdown | ✅ **REAL LLM** | Company size / job title / industry / engagement / budget scores |
| Deal health score | ✅ **REAL LLM** | Single LLM call: health + probability + actions |
| Customer health score | ✅ **REAL LLM** | Single LLM call: health + recommended_actions |
| Email sentiment | ✅ **REAL (VADER)** | Rule-based NLP, instant, no API cost |
| Email category + priority | ✅ **REAL LLM** | Single LLM call per batch |
| Email draft response | ✅ **REAL LLM** | Context-aware draft with CRM customer history |
| Email validator (2nd LLM call) | ✅ **REAL LLM** | Checks tone, personalizes greeting, adds "AI CRM Team" sign-off |
| Email auto-send | ✅ **REAL Gmail API** | Sent automatically — no human approval needed |
| Execution step animation | ✅ **REAL TIMING** | Replays actual LLM timing, NOT fake timers |
| Analytics KPIs | ✅ **REAL DB** | Computed from ai_crm.db records |
| SQL Query Agent | ✅ **REAL LLM + DB** | LLM generates SQL → runs against live SQLite → narrative summary |
| Risk factors (deals) | ✅ **REAL rule-based** | From actual deal data (days stalled, stage, etc.) |
| Lead enrichment | ✅ **REAL (WebSearch)** | DuckDuckGo API if available |

### How Execution Steps Work
```
1. User clicks Run → API call starts immediately
2. Panel shows "Agent Running… real analysis in progress"
3. When Gemini 2.5 Flash responds (2–8 seconds), backend returns:
   { result: {...}, execution_steps: [{name, output, durationMs}] }
4. WorkflowSteps replays these steps in animated sequence with real timing
5. Each step output shows the ACTUAL LLM result (health score, factors, etc.)
6. Auto-email toast (if score ≥ 70) fires AFTER all steps finish animating
```

---

## Navigation Tabs

### 🏠 Mission Control (Home)
**URL:** `/`
**What it shows:** Real-time dashboard with live CRM metrics.

| Card | Data Source |
|---|---|
| Total Leads | `contacts` table, `lead_status='qualified'` |
| Pipeline Value | Sum of `deals.value` where `stage != 'closed_lost'` |
| Health Score | Avg `customers.health_score` |
| At-Risk Deals | Count of `is_stalled=True` deals |
| Pipeline Stage Breakdown | Bar chart from `deals` grouped by `stage` |
| Recent Activity | `activities` table, last 5 records |

**Backend endpoints:** `GET /api/analytics/dashboard`, `GET /api/analytics/pipeline`

---

### 🎯 Lead Qualification Agent
**URL:** `/leads`
**What it does:** AI scores incoming leads 0–100, routes them to the right team, and auto-sends a welcome email after step animation completes (if score ≥ 70).

**How to demo:**
1. Select any contact from the "Incoming Leads" CRM list (30 contacts from DB)
2. Fields auto-fill (name, email, company)
3. Click **Run Agent**
4. Wait 3–8 seconds for real Gemini LLM response
5. See execution steps replay with actual timing
6. Score, routing decision, signals, and breakdown all come from Gemini

**LLM Output (one call returns ALL of this):**
```json
{
  "company_size": "enterprise",
  "industry": "Technology",
  "seniority": "executive",
  "budget_likelihood": "high",
  "score": 87,
  "signals": ["Company domain confirms B2B intent", "CTO title = budget authority", "Demo request = high intent"],
  "score_breakdown": { "company_size": 22, "job_title": 25, "industry": 19, "engagement": 12, "budget_signals": 9 },
  "outreach_priority": "immediate",
  "recommended_action": "Schedule executive demo call within 4 hours"
}
```

**UI Result Panels:**
- **Outreach Priority Banner** — 🚨 IMMEDIATE / ⚡ WITHIN 24H / 🌱 NURTURE (color coded)
- **Score Gauge** — animated 0–100 circle
- **Score Breakdown bars** — visual bar chart for each of 5 scoring dimensions
- **Enrichment Signals** — company size, industry, seniority, budget, domain
- **Routing Decision** — which team, priority level, next action
- **Buying Signals** — list of specific intent indicators the LLM found
- **Auto-email toast** — appears after step animation ends (not immediately)

---

### 💼 Sales Pipeline Agent
**URL:** `/pipeline`
**What it does:** Analyzes any deal in the CRM, computes health score, close probability, stall detection, risk factors, and deal-specific recommended actions — all via Gemini LLM.

**LLM prompt now includes:**
- Deal name, company, contact name, value
- Days in stage, last contact days ago, activities count
- Proposal sent status, blockers from DB

**Key outputs:**
- **Health Score** — LLM-computed 0–100 (not a formula)
- **Close Probability** — % likelihood of winning
- **Is Stalled** — Rule-based: last contact > 14 days or stage too old
- **Risk Factors** — Derived from deal data (budget, champion, stage)
- **Next Actions** — LLM-generated with specific deal context, company name, and contact name
- **Forecast Close Date** — Computed from stage velocity

---

### 🤝 Customer Success Agent
**URL:** `/customers`
**What it does:** Monitors customer health, detects churn risk, identifies upsell opportunities.

**LLM prompt now includes:**
- Company name, MRR, ARR, industry
- Login frequency, features used, CSAT score
- Days to renewal, support ticket count

**Key outputs:**
- **Health Score** from plan, usage, tickets, CSAT, payment history
- **Churn Risk** (low/medium/high/critical) with probability %
- **Upsell Opportunities** — LLM identifies expansion potential with confidence %
- **Recommended Actions** — LLM-generated specific CSM tasks with customer name and MRR context

---

### 📧 Email Intelligence Agent
**URL:** `/email`
**Special workflow — see dedicated section below**

---

### 📅 Meeting Scheduler Agent
**URL:** `/meetings`
**What it does:** AI-powered meeting scheduling with conflict detection and CRM contact matching.

- Suggests optimal meeting times based on context
- Matches meeting with CRM contacts
- Integrates with Google Calendar (if connected)
- Generates meeting agendas via LLM

---

### 📊 Analytics Intelligence Agent
**URL:** `/analytics`
**What it does:** Generates comprehensive business intelligence from live CRM data.

**How to demo:**
1. Select category (all/sales/customers/leads/pipeline)
2. Click **Run Agent**
3. Real backend queries SQLite + Gemini LLM generates narrative insights

**Key outputs:**
- **KPIs:** Conversion rate, avg deal size, win rate, churn rate, MRR, ARR
- **Trends:** Month-over-month pipeline performance
- **AI Insights:** LLM-generated narrative analysis (not formulaic)
- **Alerts:** Anomaly detection (deals at risk, churn spikes)
- **Quick Insights:** Bullet-point executive summary from LLM

---

### 💬 Ask CRM (Natural Language Query)
**URL:** `/ask`
**What it does:** Chat interface to query your CRM in plain English. Gemini generates SQL → runs against live SQLite → gives executive summary.

**Example queries that work:**
- *"Show all leads with score above 70"*
- *"What is total pipeline value?"*
- *"Which deals are stalled?"*
- *"Show top 5 customers by MRR"*
- *"What is our total revenue from closed deals?"*

**How it works:**
```
User types question
     ↓
Gemini 2.5 Flash generates SQLite query (with JOIN hints + CRM business logic)
     ↓
SQL validated (blocks any DELETE/UPDATE/DROP)
     ↓
Executed against ai_crm.db
     ↓
Up to 3 self-healing retries if SQL fails
     ↓
Gemini writes executive summary with specific numbers from the result
     ↓
Chart type suggested (bar/line/table)
```

**Business logic the LLM knows:**
- Revenue = `SUM(deals.value) WHERE stage='closed_won'`
- Pipeline = deals NOT in closed_won or closed_lost
- High-value leads = `contacts WHERE lead_score >= 70`
- Churn risk = `customers WHERE churn_risk IN ('high','critical')`

---

### 🔌 Source Systems
**URL:** `/sources`
**What it does:** Connect external data sources to import contacts, deals, and companies.

| Source | Status |
|---|---|
| Salesforce Sync | Simulated — maps SF objects to CRM schema (see below) |
| CSV/Excel Upload | Upload any CSV with Company/Name/Email columns |
| Custom REST API | API key-based push endpoint |

---

## Email Intelligence

**URL:** `/email`
**This agent is fully automated** — no human approval step.

### Automated 4-Stage Pipeline

```
Gmail Inbox (OAuth)
      ↓
[Sync Button / Auto-sync] → /api/emails/sync
      ↓
Filter: Only emails from addresses in CRM contacts table
      ↓
Save to emails table in SQLite
      ↓
[Background Task] Email Intelligence Agent runs AUTOMATICALLY

STAGE 1: VADER Sentiment Analysis (100ms, no API cost)
→ score (1-10), label (positive/neutral/negative), emotion

STAGE 2: Gemini LLM — Category + Priority + Urgency (single batch call)
→ category (sales_inquiry/demo_request/complaint/etc), priority (low/medium/high)

STAGE 3: Gemini LLM — Draft Response
→ Personalized reply with CRM customer history context
→ Signed with "Best regards, AI CRM Team"

STAGE 4: Gemini LLM — Email Validator (second LLM call)
→ Checks tone matches category
→ Personalizes greeting with sender's first name
→ Ensures "Best regards, AI CRM Team" closing
→ Removes any [placeholder] text
→ Returns issues_fixed list

STAGE 5: Gmail API — Auto-Send
→ Sends validated reply to sender automatically
→ No human approval required
→ Skips masked/internal addresses (masked.com, example.com)
```

### What the Email Panel Shows
- Email list (fetched from Gmail)
- Per-email: sentiment score, category badge, priority level
- AI draft (as sent by the agent — final validated version with signature)
- Auto-send confirmation: "Agent auto-sent reply to X · Signed as AI CRM Team"
- Follow-up suggestions

### Connect Gmail Button
- Opens Google OAuth consent screen
- Requests Gmail read + send + calendar scopes
- Token saved to `token.json`
- After auth: Sync button fetches real inbox

---

## Data & Database

**File:** `backend/ai_crm.db` (SQLite)

### Tables & Record Counts (After Seeding)
| Table | Records | Seeded From |
|---|---|---|
| `companies` | 11 | `scripts/seed_data.py` |
| `contacts` | 30 (with `lead_score` 50–100) | `scripts/seed_data.py` |
| `deals` | 20 | `scripts/seed_data.py` |
| `customers` | 10 | `scripts/seed_data.py` |
| `emails` | 0–25 | Gmail sync |
| `agent_logs` | Auto-generated | Every agent run |
| `activities` | 40 | `scripts/seed_data.py` |

### Key Schema Details
- **`contacts.lead_score`** — Integer 0–100 (seeded as 50–100). Used by Ask CRM queries like "show leads with score > 80"
- **`deals.risk_factors`** — JSON array of blocker strings, used in Sales Pipeline LLM prompt
- **`customers.churn_risk`** — "low"/"medium"/"high"/"critical", used in Customer Success analysis
- **`contacts.enrichment_data`** — JSON blob, contains `{"source": "Salesforce", "sf_id": "SF-001"}` for Salesforce imports

### How to Re-Seed
```bash
cd backend
python scripts/seed_data.py
```

---

## Salesforce Sync

### How It Works
The **"Simulate Salesforce Sync"** button on `/sources` sends a hardcoded mock payload to the backend that simulates what a real Salesforce export would look like.

### Input Data Format (Salesforce Object Structure)
The frontend sends this JSON array to `POST /api/sources/import/salesforce`:
```json
[
  {
    "Id": "SF-001",
    "AccountName": "Tesla Inc",
    "Website": "tesla.com",
    "Industry": "Automotive",
    "BillingCity": "Austin",
    "FirstName": "Elon",
    "LastName": "Musk",
    "Title": "Technoking",
    "Amount": 500000
  },
  {
    "Id": "SF-002",
    "AccountName": "SpaceX",
    "Website": "spacex.com",
    "Industry": "Aerospace",
    "BillingCity": "Starbase",
    "FirstName": "Gwynne",
    "LastName": "Shotwell",
    "Title": "President",
    "Amount": 1200000
  }
]
```

### How Data Gets Stored (Field Mapping)
| Salesforce Field | CRM Table | CRM Column |
|---|---|---|
| `AccountName` | `companies` | `name` |
| `Website` | `companies` | `domain` |
| `Industry` | `companies` | `industry` |
| `BillingCity` | `companies` | `location` |
| `Id` | `companies.enrichment_data` | `{"source":"Salesforce","sf_id":"SF-001"}` |
| `FirstName` | `contacts` | `first_name` |
| `LastName` | `contacts` | `last_name` |
| `Title` | `contacts` | `job_title` |
| `"Salesforce"` (constant) | `contacts` | `lead_source` |
| `Amount` | `deals` | `value` |
| `"SF Opportunity - {AccountName}"` | `deals` | `name` |
| `"qualification"` (constant) | `deals` | `stage` |

### Upsert Logic (No Duplicates)
- **Company:** matched by `domain` — updates name/industry/location if exists
- **Contact:** matched by `company_id` + `lead_source='Salesforce'` — updates name/title if exists
- **Deal:** matched by `company_id` + `name` — updates value if exists
- All new records get fresh UUIDs

---

## Demo Script

> [!TIP]
> Start backend and frontend before demo:
> ```
> cd backend && python run.py
> cd frontend && npm run dev
> ```

### Recommended Demo Flow (12 minutes)

**1. Mission Control (1 min)**
- Open `http://localhost:3000`
- Show live KPIs: "All of this is real data from our SQLite database"
- Point out pipeline stage bar chart

**2. Lead Qualification Agent (3 min)**
- Go to `/leads`
- Select any lead from the "Incoming Leads" list (30 real contacts)
- Click Run Agent — wait for Gemini (3-6s)
- Watch execution steps fill in with real timing
- Show: Score + Outreach Priority banner (e.g. 🚨 IMMEDIATE)
- Show: Score Breakdown bars — explain each dimension
- Show: Buying signals list — "Gemini identified these from the raw email/title"
- Wait for auto-email toast — "Notice how the toast appeared AFTER all steps finished"

**3. Sales Pipeline Agent (2 min)**
- Go to `/pipeline`
- Select any deal from the CRM list
- Click Run Agent
- Show health score, risk factors, next actions — all from Gemini
- "This is what our AI told the sales team to do next for THIS specific deal"

**4. Customer Success Agent (2 min)**
- Go to `/customers`
- Select any customer
- Run Agent — show churn risk, upsell opportunities
- "The AI is monitoring every customer for early churn signals"

**5. Email Intelligence (2 min)**
- Go to `/email`
- Show "Gmail — Connected" banner
- Explain: "Any email from CRM contacts is automatically analyzed, drafted, validated, and replied to"
- Show draft in the panel with "AI CRM Team" signature
- Show auto-send confirmation footer

**6. Ask CRM / Query Database (1 min)**
- Go to `/ask`
- Type: "Show me the top 5 deals by value"
- Shows real SQL generated by Gemini + result table + narrative summary
- "This is natural language → SQL → database → executive summary"

**7. Analytics Agent (1 min)**
- Go to `/analytics`
- Run — show KPIs, trend chart, AI narrative insights

---

> [!NOTE]
> **If asked about data privacy:** All email bodies are analyzed but never stored to third parties. VADER sentiment runs 100% locally. LLM calls use only what is sent in the prompt (subject + body snippet, truncated to 600 chars).

> [!NOTE]
> **If Gemini is slow:** Gemini 2.5 Flash responses take 3–8 seconds for complex analysis. The execution steps panel waits for the real response — this is intentional to show real AI processing time, not fake animation.

> [!NOTE]
> **Model switch:** To use Groq (faster, free tier): remove `MODEL_PROVIDER=gemini` from `backend/.env`. The system will then auto-detect the Groq key and use `llama-3.1-8b-instant`.
