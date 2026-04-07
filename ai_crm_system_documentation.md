# AI CRM — Complete System Documentation
### For Demo Presentation · April 2026

---

## Table of Contents
1. [System Overview](#system-overview)
2. [How AI Works — Technical Truth](#how-ai-works)
3. [Navigation Tabs](#navigation-tabs)
4. [Agent Deep Dives](#agent-deep-dives)
5. [Email Intelligence (Special)](#email-intelligence)
6. [Data & Database](#data--database)
7. [Demo Script](#demo-script)

---

## System Overview

**AI CRM** is a production-grade Customer Relationship Management system powered by real Large Language Model (LLM) AI agents. Every action you see triggers an actual LLM call — no smoke and mirrors.

### Tech Stack
| Layer | Technology |
|---|---|
| **Frontend** | Next.js 14 (App Router) + TypeScript |
| **Backend** | FastAPI (Python) + async/await |
| **Database** | SQLite (`ai_crm.db`) — 10 companies, 12 contacts, 20 deals, 10 customers |
| **LLM** | Groq (llama-3.1-8b-instant) → Gemini → xAI/Grok (auto-detected by API key) |
| **Email** | Gmail OAuth2 API (real inbox) |
| **Sentiment** | VADER (rule-based, real-time, no API cost) |
| **Search** | WebSearchTool (for lead enrichment) |

### LLM Provider Priority
```
GROQ_API_KEY present → Uses Groq llama-3.1-8b (fastest, free tier)
GEMINI_API_KEY present → Uses Gemini 2.0 Flash
XAI_API_KEY present → Uses Grok-2-1212
None → MOCK mode (outputs "MOCK — no LLM configured")
```

---

## How AI Works — Technical Truth

> [!IMPORTANT]  
> Every agent **makes a real LLM API call**. There is no hardcoded output. The execution steps panel shows the **actual wall-clock timing** of that LLM call, replayed step-by-step after the result arrives.

### What is REAL vs MOCK?

| Component | Real or Mock? | Notes |
|---|---|---|
| Lead scoring (0–100) | ✅ **REAL LLM** | Groq/Gemini analyzes lead data |
| Deal health score | ✅ **REAL LLM** | Single LLM call: health + probability + actions |
| Customer health score | ✅ **REAL LLM** | Single LLM call: health + recommended_actions |
| Email sentiment | ✅ **REAL (VADER)** | Rule-based NLP, instant, no API cost |
| Email category + priority | ✅ **REAL LLM** | Single LLM call per batch |
| Email draft response | ✅ **REAL LLM** | Context-aware draft |
| Execution step animation | ✅ **REAL TIMING** | Replays actual LLM timing, NOT fake timers |
| Analytics KPIs | ✅ **REAL DB** | Computed from ai_crm.db records |
| Risk factors (deals) | ✅ **REAL rule-based** | From actual deal data (days stalled, stage, etc.) |
| Lead enrichment | ✅ **REAL (WebSearch)** | If API key configured |

### How Execution Steps Work (Post-Fix)
```
Old (broken): Steps animated with random 300–800ms fake timers INDEPENDENTLY of API
New (fixed):  1. User clicks Run → API call starts
              2. Panel shows "Agent Running… real analysis in progress"
              3. When LLM responds (2–8 seconds), backend returns:
                 { result: {...}, execution_steps: [{name, output, durationMs}] }
              4. WorkflowSteps replays these steps in animated sequence
              5. Each step output shows the ACTUAL LLM result (health score, factors, etc.)
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
**What it does:** AI scores incoming leads 0–100, routes them to the right team, and auto-sends a welcome email if score ≥ 70.

**How to demo:**
1. Select any contact from the "Select Lead from CRM" list
2. Fields auto-fill (name, email, company)
3. Click **Run Agent**
4. Wait 3–8 seconds for real LLM response
5. See execution steps replay with actual timing
6. Score, routing decision, signals, and breakdown all come from LLM

**What LLM does:**
```python
# Single LLM call returns all this:
{
  "score": 87,           # 0-100
  "tier": "A",           # A/B/C/D
  "qualification": {...},
  "routing": {"team": "enterprise-sales", "priority": "high"},
  "signals": ["Budget confirmed", "Demo requested"]
}
```

**Auto-email:** If score ≥ 70, a personalized email is automatically drafted by the Email Intelligence Agent and sent via Gmail (if connected).

---

### 💼 Sales Pipeline Agent
**URL:** `/pipeline`  
**What it does:** Analyzes any deal in the CRM, computes health score, close probability, stall detection, risk factors, and recommended actions — all via LLM.

**How to demo:**
1. Select any deal from the "Deals from CRM" list (e.g. "Deal - Market Expansion")
2. Click **Run Agent**
3. Wait for real LLM result (2–5 seconds)
4. Execution steps show real timing:
   - Step 1: DB load (near 0ms)
   - Steps 2–6: LLM call total time split across steps
   - Each step output shows actual LLM-generated values

**Key outputs:**
- **Health Score** — LLM-computed 0–100 (not a formula)
- **Close Probability** — % likelihood of winning
- **Is Stalled** — Rule-based: if last contact > 14 days or stage too old
- **Risk Factors** — Derived from deal data (budget, champion, stage)
- **Next Actions** — LLM-generated specific action items
- **Forecast Close Date** — Computed from stage velocity

---

### 🤝 Customer Success Agent
**URL:** `/customers`  
**What it does:** Monitors customer health, detects churn risk, identifies upsell opportunities.

**How to demo:**
1. Select a customer from the list (badges show `#XXXX` 4-digit ID)
2. Click **Run Agent**
3. Real LLM computes:
   - **Health Score** from plan, usage, tickets, CSAT, payment history
   - **Churn Risk** (low/medium/high/critical) with probability %
   - **Engagement metrics** (login frequency, feature adoption)
   - **Upsell Opportunities** (LLM identifies expansion potential)
   - **Recommended Actions** (LLM-generated specific CSM tasks)

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
3. Real backend queries SQLite + LLM generates narrative insights

**Key outputs:**
- **KPIs:** Conversion rate, avg deal size, win rate, churn rate, MRR, ARR
- **Trends:** Month-over-month pipeline performance
- **AI Insights:** LLM-generated narrative analysis (not formulaic)
- **Alerts:** Anomaly detection (deals at risk, churn spikes)
- **Quick Insights:** Bullet-point executive summary from LLM

---

### 💬 Ask CRM (Natural Language Query)
**URL:** `/ask`  
**What it does:** Chat interface to query your CRM in plain English.

Examples:
- *"Which deals have the highest churn risk?"*
- *"Show me all leads from enterprise companies scored above 70"*
- *"What is the pipeline value this quarter?"*

The LLM converts natural language → SQL → runs against SQLite → returns formatted answer.

---

### 🔌 Source Systems
**URL:** `/sources`  
**What it does:** Connect external data sources to import contacts, deals, and companies.

| Source | Status |
|---|---|
| Salesforce Sync | Simulated — maps SF objects to CRM schema |
| CSV/Excel Upload | Upload any CSV with Company/Name/Email columns |
| Custom REST API | API key-based push endpoint |

**Seed Data:** Click "Seed Production Data" to populate 10 companies, 10 contacts, 10 deals, 3 customers, plus the 2 Gmail contacts.

---

## Email Intelligence

**URL:** `/email`  
**This agent is different** — it's automated, not triggered by a button.

### How It Works End-to-End

```
Gmail Inbox (OAuth)
      ↓
[Sync Button / Auto-sync]
      ↓
/api/emails/sync
      ↓
Filter → Only emails from addresses IN the CRM contacts table
  (satpatishrimanta2024@gmail.com ✅ — in DB)
  (dataduo@gmail.com ✅ — in DB)
  (random@unknown.com ❌ — not in CRM, skipped)
      ↓
Save to emails table in SQLite
      ↓
[Background Task] — Email Intelligence Agent runs AUTOMATICALLY
      ↓
VADER → Sentiment score (100ms, no API cost)
LLM → Category + Priority + Urgency + Draft Response (batch call)
      ↓
Results saved back to email record
      ↓
[2 seconds later] Inbox refreshes → shows analyzed emails
```

### What "Pending AI Analysis" Means
An email has been received and saved but the LLM batch hasn't returned yet. This resolves automatically in ~5–10 seconds.

### Connect Gmail Button
- Opens Google OAuth consent screen
- Requests Gmail read + calendar scopes
- Token saved to `token.json`
- After auth: Sync button fetches real inbox

### Fixing "Stuck in Analysis"
The infinite loop bug has been fixed:
- Analysis now fires **exactly once on mount** using a `useRef` guard
- Manual "Analyze N Pending" button still works for re-runs
- No more `loadEmails → triggerAutoAnalysis → loadEmails` cycle

### Batch Analysis (How LLM Efficiency Works)
```python
# ONE LLM call processes ALL pending emails:
prompt = """
Analyze these 3 emails:
--- EMAIL ID: abc123 --- Subject: Demo request...
--- EMAIL ID: def456 --- Subject: Need pricing...
--- EMAIL ID: ghi789 --- Subject: Support issue...

Return JSON array with category, priority, draft_response for each.
"""
# → Single API call → 3 results → mapped back by ID
```

---

## Data & Database

**File:** `backend/ai_crm.db` (SQLite)

### Tables & Record Counts
| Table | Records | Seeded From |
|---|---|---|
| `companies` | 11 (10 + personal) | `sources.py /seed` |
| `contacts` | 12 (10 + 2 Gmail) | `scripts/seed_data.py` |
| `deals` | 20 | `scripts/seed_data.py` |
| `customers` | 10 | `scripts/seed_data.py` |
| `emails` | 0–25 | Gmail sync |
| `agent_logs` | Auto-generated | Every agent run |
| `activities` | 40 | `scripts/seed_data.py` |

### Deal Names Convention
All deals follow the format: `"Deal - [Descriptive Name]"`  
Examples: `"Deal - Market Expansion"`, `"Deal - AI 2027 Readiness"`, `"Deal - Digital Transformation"`

### Customer ID Display
Customer IDs are shown as `#XXXX` (first 4 characters of UUID) for readability.

---

## Demo Script

> [!TIP]
> Run backend + frontend before the demo: `python backend/run.py` and `npm run dev` in the frontend folder.

### Recommended Demo Flow (10 minutes)

**1. Mission Control (1 min)**
- Open `http://localhost:3000`
- Show live KPIs from real DB: "This is real data from our SQLite database"
- Point out pipeline stage bar chart

**2. Lead Qualification Agent (2 min)**
- Go to `/leads`
- Select "Shrimanta Satpati" from the lead list
- Click Run Agent — wait for real LLM (~3-5s)
- Watch execution steps fill in with real timing
- Show score (e.g. 87/100), routing decision, signals
- "The LLM just analyzed this lead and decided to route to Enterprise Sales"

**3. Sales Pipeline Agent (2 min)**
- Go to `/pipeline`
- Select "Deal - Market Expansion"
- Click Run Agent
- Show health score, risk factors, next actions — all from LLM
- "This is what our AI told our sales team to do next"

**4. Customer Success Agent (2 min)**
- Go to `/customers`
- Select any customer (show the #XXXX badge)
- Run Agent — show churn risk level, upsell opportunities
- "The AI is monitoring every customer for early churn signals"

**5. Email Intelligence (2 min)**
- Go to `/email`
- Show "Gmail — Connected" banner
- Explain: "Any email from CRM contacts gets automatically analyzed"
- Show the analyzed email from satpatishrimanta2024@gmail.com
- Show sentiment, category, draft response

**6. Analytics Agent (1 min)**
- Go to `/analytics`
- Run — show KPIs, trend chart, AI narrative insights

---

> [!NOTE]
> **If asked about data privacy:** All email bodies are analyzed but never stored to third parties. VADER sentiment runs 100% locally. LLM calls use only what is sent in the prompt (subject + body snippet, truncated to 600 chars).

> [!NOTE]
> **If LLM is slow:** Groq's free tier is rate-limited. The execution steps panel will wait for the real response. Consider switching to Gemini Flash for faster responses during demo.
