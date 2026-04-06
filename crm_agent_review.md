# AI CRM — Multi-Agent System: Full Technical & Business Review

---

## 1. Live Agent Activity & Agent Status Panel

### ✅ Time Shown Is Local Machine Time
- **Fixed in this session**: `base_agent.py` was updated to use `datetime.now()` (local time) instead of `datetime.utcnow()`.
- The events API (`GET /api/agents/events`) now serves timestamps formatted as `%Y-%m-%dT%H:%M:%S` — no timezone suffix — so the browser's `new Date()` parses them as **local time (IST)**.
- **"Last run"** = the `created_at` timestamp of the most recent `AgentLog` entry for each agent — correct.
- **"Runs today"** = count of `AgentLog` rows for that agent with `created_at` >= midnight today — correct.

---

## 2. Configure Panel — What Data Is Actually Used?

### Critical Finding: Configure Panel Is NOT Always Mapped to CRM DB

| Agent | Configure Panel Inputs | CRM DB Used? | How DB Is Used |
|---|---|---|---|
| **Lead Qualification** | Email, Name, Company, Job Title, Message | ✅ Partially | Checks if contact exists by email; updates score/status if found |
| **Sales Pipeline** | Deal ID, Deal Name, Stage, Value, Days Since Activity | ⚠️ Partially | **Only `deal_id` is used to query the DB.** Other fields (name, stage, value) are ignored — the agent fetches them from the DB by ID. If the ID doesn't exist in DB, it falls back to an error. |
| **Customer Success** | Customer ID, Company Name, MRR, Health Score, Last Login Days | ⚠️ Partially | **Only `customer_id` is used to query the DB.** The other fields (MRR, health score, last login) are display-only for the user — they are NOT passed to the agent. The agent fetches real data from the DB by Customer ID. |
| **Email Intelligence** | From Email, Subject, Body | ❌ No | The form fields are passed directly as the email to analyze. Not stored in DB by default. |
| **Meeting Scheduler** | Title, Type, Duration, Attendees, Notes | ✅ Stored | After the LLM schedules, the meeting is saved to the `meetings` table. Google Calendar is called for real booking. |
| **Analytics** | Category selector | ✅ Full | Entirely driven by CRM DB — queries `contacts`, `deals`, `customers`, `metrics_daily`. No user text input. |
| **NL Query** | Natural language question | ✅ Full | Generates SQL from NL, runs it on the SQLite DB, summarizes the result. |

### What This Means:
- **Sales Pipeline & Customer Success**: The extra fields in the configure panel (stage, value, MRR, health score) are **cosmetic** — they help the user understand what they're querying but don't feed the agent. The agent always reads live DB data.
- **The right approach is minimal inputs** — just the ID needed to look up CRM data. ✅ This is the correct design.

---

## 3. LLM Usage Map — Where LLM Is Used vs. Not Used

### Lead Qualification Agent
| Step | LLM? | Reason |
|---|---|---|
| Receive & parse lead | ❌ | Simple dict extraction |
| Enrich company domain | ❌ | String split on email |
| Qualify (enrich + score + signals) | ✅ **1 LLM call** | Needs business judgment (industry, seniority, intent, budget signals) |
| Route to team | ❌ | Rule-based threshold (score ≥ 70 → Enterprise Sales) |
| Save to DB | ❌ | SQLAlchemy ORM |
| Send auto-email | ❌ | Gmail API send (not LLM) |

### Email Intelligence Agent
| Step | LLM? | Reason |
|---|---|---|
| Sentiment (score, label, emotion) | ❌ **VADER** | Fast, deterministic, no rate limit |
| Category + Priority + Urgency | ✅ **1 LLM call** | Requires business context understanding |
| Draft email response + follow-ups | ✅ **1 LLM call** | Personalized writing requires LLM |

### Sales Pipeline Agent
| Step | LLM? | Reason |
|---|---|---|
| Fetch deal from DB | ❌ | DB query |
| Health score + close probability + next actions | ✅ **1 LLM call** | Holistic deal judgment requires LLM |
| Stall detection | ❌ | Rule-based (days_since_activity > threshold) |
| Risk factors | ❌ | Rule-based from deal metadata |
| Forecast close date | ❌ | Math: stage close rate × remaining pipeline days |
| Update DB health score | ❌ | SQLAlchemy ORM |

### Customer Success Agent
| Step | LLM? | Reason |
|---|---|---|
| Fetch customer from DB | ❌ | DB query |
| Health score + recommended actions | ✅ **1 LLM call** | Synthesizing 15+ signals into narrative recommendations |
| Churn risk level | ❌ | Rule-based (health_score thresholds) |
| Engagement metrics | ❌ | Math from logins_per_week, feature_adoption_pct |
| Upsell opportunities | ✅ **1 LLM call** | Needs to read usage context and suggest relevant upsell |
| DB update (health score, churn risk) | ❌ | SQLAlchemy ORM |

### Meeting Scheduler Agent
| Step | LLM? | Reason |
|---|---|---|
| Parse attendees | ❌ | String split |
| Find available slots | ❌ | Google Calendar freebusy API |
| Select best slot + generate agenda | ✅ **1 LLM call** | Time preference + context-aware agenda generation |
| Create Google Calendar event | ❌ | Calendar API |
| Save to meetings DB | ❌ | SQLAlchemy ORM |

---

## 4. Lead Agent — Is Data Inserted Into CRM DB?

**Yes, with upsert logic:**
1. **`lead_qualification_agent.py`**: If the email is new → skips insert (orchestrator handles it). If exists → updates `lead_score` and `lead_status`.
2. **`orchestrator.py`**: After qualification, checks if contact exists by email. If not → inserts new `Contact` row. If yes → skips insert (no duplicate).
3. **`api/leads.py` (just fixed)**: Now does proper upsert — updates existing contact if email matches.

**What gets stored:**
- `contacts` table: email, first_name, last_name, job_title, lead_score, lead_status, enrichment_data

---

## 5. Auto-Email Format — Bug & Fix

### Why It Sends Raw JSON
The LLM returns: `{"draft": "Dear John...", "follow_ups": ["action 1", ...]}`

The `draft_response()` method correctly parses `.get("draft")` — **but if JSON parsing fails**, the entire raw string (including the JSON wrapper) is returned as the draft.

**Fix applied in `orchestrator.py`**: Added a second extraction guard before `send_reply()`:
```python
if isinstance(draft, str) and draft.strip().startswith("{"):
    parsed_draft = json.loads(...)
    draft = parsed_draft.get("draft", draft)
```

> **Still seeing the issue?** This means the LLM returned malformed JSON that failed both parse attempts. The root fix is to ensure the LLM prompt is tightly structured and the fallback returns plain text.

---

## 6. Email Intelligence Agent — Full Honest Assessment

### What It Currently Does
1. **Manual compose panel** (From, Subject, Body) → user types or pastes an email
2. Agent runs VADER sentiment + LLM category/priority/urgency analysis
3. LLM drafts a reply + 3 follow-up actions
4. Result shown in UI — NOT saved to DB by default when triggered from the frontend form

### What Gmail Sync Actually Does
- **Gmail Sync button** on the `/email` page calls `GET /api/sync/gmail`
- Fetches real emails from your Gmail inbox via Gmail API
- Saves them to the `emails` table in CRM DB
- **Automatically queues all unanalyzed inbound emails** for the Email Intelligence Agent (background task)
- Agent results (sentiment, category, priority, draft_response) are written back to the `emails` DB row

### Where Are The Emails Coming From?
> **"Those emails are not present in my actual inbox"**

This is expected behavior — the seed script (`seed_data.py`) pre-populated 25 fake emails in the `emails` DB table. These are **synthetic seed data**, not real Gmail messages. When you click Sync Gmail, it fetches **real Gmail messages** and adds them on top. The existing seed entries stay in the DB.

### Is the LLM Analyzing the Emails?
Yes — but only for emails that were synced **and** marked as `analyzed = False` in the DB. The auto-trigger runs in a background task on every sync.

### Current Value Assessment
> **The manual compose panel has limited real-world value.** The real value comes from the Gmail Sync → Auto-analysis pipeline.

---

## 7. Desired Email Intelligence Behavior — Recommendation

### Proposed New UI for `/email` page:

**Replace the manual compose panel with:**
- Input: `N = last N emails to fetch` (configurable, default 10)
- Button: **"Fetch & Analyze Emails"**
- Output: A table/card list showing each email with:
  - Gmail Message ID
  - From (sender email + name)
  - Subject
  - Company (domain extracted)
  - Sentiment (VADER label + score)
  - Category
  - Priority
  - AI Draft Response (expandable)
  - Follow-up actions

### Should It Replace or Build On Top?
**Build on top** — the backend `sync_gmail_emails` + auto-analyze loop already works correctly. Only the **frontend UI** needs to be redesigned to:
1. Accept N as input
2. Show a list of analyzed emails instead of a single compose form
3. Allow expanding each email to see its AI draft response

---

## 8. Sales Pipeline Agent — Why So Many Inputs?

### The Problem
The configure panel asks for: Deal Name, Deal ID, Stage, Value, Days Since Activity.

**Only `deal_id` is actually used by the agent** — it queries the DB by ID to get all other fields.

### Fix Needed
Reduce to **one input: Deal ID** (or a dropdown of deals from the DB).

The other fields (Stage, Value) should be **display-only** — fetched from DB and shown after the deal is loaded, not entered by the user.

### Remaining Mock Data Issue
`_get_deal_data` still has some hardcoded values:
```python
"last_contact_days_ago": 2,       # ← MOCK
"engagement_level": "medium",      # ← MOCK
"competitor_activity": "low",      # ← MOCK
"activities_count": 10,            # ← MOCK
```
These should be fetched from the `activities` table for the deal's contact.

---

## 9. Customer Success Agent — Why Is LLM Returning The Input Score?

### The Problem
User enters `health_score: 34` → LLM returns `34` as the health score.

This happens because the **configure panel inputs are NOT passed to the agent** — only the `customer_id` is. The agent reads the real `health_score` from the DB (which is `34` because the seed data set it to `34`).

The LLM is tasked with **re-evaluating** the health score from 15+ signals (logins, features used, support tickets, CSAT, etc.) — but if the DB health_score is `34`, the LLM is likely anchored to that value in its reasoning.

### LLM Value Here
The LLM's job is to:
1. Synthesize 15 numerical signals into one narrative recommendation
2. Generate specific action items (emergency CEO call, assign CSM, etc.)
3. Identify upsell opportunities from usage patterns

If the score comes back the same as DB, it means the LLM's weighted analysis agrees with the existing score — which is expected for seed data that was already assigned reasonable scores.

---

## 10. Meeting Scheduler & Analytics — Configure Panel Mapping

| Agent | Configure Input Used By | CRM DB Mapping |
|---|---|---|
| Meeting Scheduler | All fields sent to LLM agent + Calendar API | Meeting saved to `meetings` table after scheduling |
| Analytics | Category selection only | Entirely DB-driven: queries contacts, deals, customers, metrics_daily |

---

## 11. Daily Monitoring & Weekly Executive Workflows

### How They Work
Both workflows are triggered from `/workflows` page:
1. **Daily Monitoring**: Calls `GET /api/reports/daily` → queries last 24h of CRM activity (leads, emails, deals, customers) → generates CSV
2. **Weekly Executive**: Calls `GET /api/reports/weekly` → queries last 7 days → generates CSV

### Agents Called (in order):
- Daily: `SalesPipelineAgent` (all deals), `CustomerSuccessAgent` (all customers), `EmailIntelligenceAgent` (email stats)
- Weekly: Same agents + `AnalyticsAgent`

### Download CSV 500 Error — Status
**Fixed in previous session**: Incorrect field names (`e.sender` → `e.from_email`) were causing crashes. Safety `try/except` wrappers were added.

> **If still seeing 500**: Restart the backend (it needs to pick up the code changes). The running `python backend\run.py` has been up for 17h+ and has not reloaded.

---

## 12. Terminal Logs

The rotating log file is configured in `backend/main.py` via `RotatingFileHandler` → `backend/logs/crm.log`.

**What gets logged:**
- `[SYNC]` — Gmail fetch results per email
- `[AUTO-ANALYZE]` — which emails are queued for the Email Intelligence Agent
- `[LEAD AUTO-EMAIL]` — whether auto-email was sent successfully
- `[MEETING SYNC]` — `cal_authed()` result + calendar booking result
- All agent `log_activity()` calls → printed to terminal via the base agent logger

**LLM calls are logged** via the `think()` method in `base_agent.py` — each call logs the response arrival.

---

## 13. Webhook Simulator

**Two working webhooks:**
- `POST /webhooks/email-received/tracked` → runs `EmailIntelligenceAgent` on the payload
- `POST /webhooks/form-submission/tracked` → runs `LeadQualificationAgent` on the payload

**The simulator in `/workflows`** sends test payloads to these endpoints and displays the agent result.

**Is it working?** Yes — if Gmail is authenticated. The lead webhook also triggers auto-email.

---

## 14. Run Full Orchestration

### What It Does
Calls `POST /api/orchestrate/full` → triggers all agents sequentially:
1. `LeadQualificationAgent` on all new contacts
2. `SalesPipelineAgent` on all active deals
3. `CustomerSuccessAgent` on all customers
4. `EmailIntelligenceAgent` on all unanalyzed emails
5. `AnalyticsAgent` for dashboard refresh

### Why You Don't See Results
Two reasons:
1. **It updates the DB** — but the frontend dashboards need a page refresh to show updated data
2. **It runs in the background** — the orchestration logs appear in the terminal but there's no live status UI for it

**The CRM DB IS updated** — check `agent_logs` table and Mission Control after running.

---

## 15. Summary: Issues Still Requiring Code Changes

| # | Issue | Fix Needed | Priority |
|---|---|---|---|
| 1 | Email Intelligence UI pointless for manual use | Redesign to fetch-N-emails flow | High |
| 2 | Sales Pipeline has unnecessary inputs | Reduce to Deal ID only; fetch rest from DB | Medium |
| 3 | Customer Success has unnecessary inputs | Reduce to Customer ID only dropdown | Medium |
| 4 | `_get_deal_data` has hardcoded mock values | Fetch from `activities` table | Medium |
| 5 | Auto-email still sends JSON in some cases | Already fixed — restart backend | Done |
| 6 | CSV 500 error | Already fixed — restart backend | Done |
| 7 | `_get_customer_context` hardcoded placeholder | Wire to real `contacts`/`emails` DB query | Low |
| 8 | Backend needs restart (17h+ old process) | `Ctrl+C` + `python backend/run.py` | Immediate |
