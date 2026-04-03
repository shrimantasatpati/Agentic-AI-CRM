# 🚀 AI-Powered CRM - Quick Start Guide

## 📋 Prerequisites

- Python 3.9+
- PostgreSQL 14+
- Redis (optional, for caching)
- OpenAI or Anthropic API key

## ⚡ Quick Start (5 minutes)

### 1. Clone and Setup

```bash
cd ~/ai-crm-agents

# Run automated setup
chmod +x setup.sh
./setup.sh
```

### 2. Configure API Keys

Edit `.env` file with your credentials:

```bash
# Required: Add your LLM API key
OPENAI_API_KEY=sk-your-key-here
# OR
ANTHROPIC_API_KEY=sk-ant-your-key-here

# Database (default is fine for local dev)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ai_crm
```

### 3. Start the Server

```bash
# Activate virtual environment
source venv/bin/activate

# Start API server
python run.py
```

Server starts at:
- **API**: http://localhost:8000
- **Docs**: http://localhost:8000/docs
- **Health**: http://localhost:8000/health

## 🎯 Try It Out

### Test Lead Qualification Agent

```bash
curl -X POST http://localhost:8000/api/agents/qualify-lead \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@acme.com",
    "first_name": "John",
    "last_name": "Doe",
    "job_title": "VP of Engineering",
    "company_name": "Acme Corp"
  }'
```

### Test Email Intelligence

```bash
curl -X POST http://localhost:8000/api/agents/analyze-email \
  -H "Content-Type: application/json" \
  -d '{
    "from": "customer@example.com",
    "subject": "Product issue",
    "body": "I am frustrated with the recent update. It broke our workflow."
  }'
```

### Get Analytics Dashboard

```bash
curl http://localhost:8000/api/analytics/dashboard
```

## 📊 View API Documentation

Open your browser: http://localhost:8000/docs

Interactive Swagger UI with all endpoints documented.

## 🏗️ Project Structure

```
ai-crm-agents/
├── agents/                  # 6 AI Agents
│   ├── base_agent.py
│   ├── lead_qualification_agent.py
│   ├── email_intelligence_agent.py
│   ├── sales_pipeline_agent.py
│   ├── customer_success_agent.py
│   ├── meeting_scheduler_agent.py
│   └── analytics_agent.py
├── api/                     # FastAPI Endpoints
│   ├── leads.py
│   ├── deals.py
│   ├── customers.py
│   ├── emails.py
│   ├── meetings.py
│   └── analytics.py
├── database/                # Database Layer
│   ├── schema.sql
│   ├── models.py
│   └── connection.py
├── workflows/               # Agent Orchestration
│   └── orchestrator.py
├── main.py                  # FastAPI Application
├── run.py                   # Quick Start Script
└── requirements.txt         # Dependencies
```

## 🤖 Available Agents

### 1. Lead Qualification Agent 🎯
- Scores incoming leads (0-100)
- Enriches contact data
- Routes to appropriate sales team
- Identifies buying signals

**Endpoint**: `POST /api/agents/qualify-lead`

### 2. Email Intelligence Agent 📧
- Sentiment analysis
- Auto-categorizes emails
- Drafts personalized responses
- Prioritizes by urgency

**Endpoint**: `POST /api/agents/analyze-email`

### 3. Sales Pipeline Agent 💰
- Tracks deal health
- Predicts close probability
- Identifies stalled deals
- Recommends next actions

**Endpoint**: `POST /api/agents/analyze-deal/{deal_id}`

### 4. Customer Success Agent 🎉
- Monitors customer health scores
- Detects churn risk early
- Triggers retention workflows
- Identifies upsell opportunities

**Endpoint**: `POST /api/agents/monitor-customer/{customer_id}`

### 5. Meeting Scheduler Agent 📅
- Smart calendar management
- Context-aware scheduling
- Automatic meeting prep
- Follow-up task creation

**Endpoint**: `POST /api/agents/schedule-meeting`

### 6. Analytics Agent 📊
- Real-time dashboards
- Predictive analytics
- Performance insights
- Custom reports

**Endpoint**: `POST /api/agents/generate-dashboard`

## 🔗 API Endpoints

### Leads
- `GET /api/leads` - List all leads
- `GET /api/leads/{id}` - Get lead details
- `POST /api/leads` - Create new lead
- `DELETE /api/leads/{id}` - Delete lead

### Deals
- `GET /api/deals` - List all deals
- `GET /api/deals/{id}` - Get deal details
- `POST /api/deals` - Create new deal
- `PATCH /api/deals/{id}/stage` - Update deal stage

### Customers
- `GET /api/customers` - List all customers
- `GET /api/customers/{id}` - Get customer details
- `GET /api/customers/{id}/health` - Get health metrics

### Analytics
- `GET /api/analytics/dashboard` - Main dashboard
- `GET /api/analytics/pipeline` - Pipeline metrics

## 🔄 Automated Workflows

The orchestrator runs these workflows automatically:

1. **New Lead Flow**
   - Lead Qualification → Email Draft → Meeting Suggestion

2. **Email Processing**
   - Sentiment Analysis → Category → Draft Response → Alert if Negative

3. **Deal Health**
   - Health Check → Risk Assessment → Follow-up if Stalled

4. **Customer Monitoring**
   - Health Score → Churn Detection → Retention Trigger

## ⚙️ Configuration

### LLM Selection

Edit `workflows/orchestrator.py`:

```python
# Use OpenAI
from langchain.llms import OpenAI
llm = OpenAI(temperature=0.7, model="gpt-4")

# OR use Anthropic Claude
from langchain.llms import Anthropic
llm = Anthropic(temperature=0.7, model="claude-3-opus-20240229")
```

### Database

Default PostgreSQL connection:
```
postgresql://postgres:postgres@localhost:5432/ai_crm
```

Change in `.env` file if needed.

## 🧪 Development

### Run Tests
```bash
pytest
```

### Format Code
```bash
black .
flake8 .
```

### Database Migrations
```bash
alembic revision --autogenerate -m "description"
alembic upgrade head
```

## 🚀 Production Deployment

### Docker (Recommended)

```bash
# Build image
docker build -t ai-crm .

# Run with docker-compose
docker-compose up -d
```

### Manual Deployment

1. Set `DEBUG=False` in `.env`
2. Configure production database
3. Use gunicorn instead of uvicorn:

```bash
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker
```

## 📝 Next Steps

1. ✅ Set up LLM API keys
2. ✅ Test all 6 agents
3. ✅ Configure email integration
4. ✅ Set up calendar sync
5. ✅ Connect to your CRM data
6. ✅ Deploy to production

## 💡 Tips

- Start with Lead Qualification Agent (easiest to test)
- Check `/docs` for full API documentation
- Use `/health` to verify all agents are running
- Monitor agent logs for debugging

## 🆘 Troubleshooting

### Database Connection Error
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Reset database
dropdb ai_crm
createdb ai_crm
python -c "from database.models import Base; from database.connection import engine; Base.metadata.create_all(bind=engine)"
```

### LLM API Error
- Verify API key in `.env`
- Check API quota/billing
- Test with curl first

### Agent Not Responding
- Check agent status: `curl http://localhost:8000/health`
- Review logs in terminal

## 📚 Documentation

- Full API Docs: http://localhost:8000/docs
- Database Schema: `database/schema.sql`
- Agent Details: See `agents/*.py` files

---

**Built with ❤️ for modern sales teams**
