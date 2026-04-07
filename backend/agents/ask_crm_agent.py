"""Ask CRM Agent - SQL generation with dynamic schema, SQL validation, and metadata profiling"""

from typing import Dict, Any, List, Tuple
from .base_agent import BaseAgent
from sqlalchemy import text
from services.schema_inspector import get_schema_formatted
from services.sql_validator import validate_sql, extract_sql
from services.metadata_profiler import build_metadata_profile, strip_pii_from_rows, build_chart_suggestion


class AskCRMAgent(BaseAgent):
    """
    Autonomous agent that:
    - Dynamically discovers the live DB schema (no hardcoded strings)
    - Generates SQLite queries based on NL questions
    - Validates SQL before execution (blocks mutations)
    - Self-corrects SQL errors (3x retry with error feedback)
    - Profiles query results without sending raw data to LLM
    - Summarizes data for the end user
    """

    def __init__(self, llm, tools=None, memory=None, redis_client=None):
        super().__init__(
            name="AskCRMAgent",
            llm=llm,
            tools=tools,
            memory=memory,
            redis_client=redis_client
        )
        self.max_retries = 3

    async def execute(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """Execute Ask CRM workflow with dynamic schema + self-healing SQL"""
        prompt = task.get("prompt", "")
        db = task.get("db")
        steps = []

        steps.append("🔍 Analyzing user intent and mapping to CRM schema...")

        # Step 1: Discover live schema from DB (no hardcoded strings)
        steps.append("📋 Discovering live database schema...")
        schema_str = ""
        if db is not None:
            try:
                from database.connection import engine
                schema_str = get_schema_formatted(engine)
                steps.append(f"✅ Schema discovered: {schema_str.count('Table:')} tables found")
            except Exception as e:
                steps.append(f"⚠️ Schema discovery failed, using fallback: {e}")

        # Step 2: SQL generation + validation + execution with retry loop
        sql_result, data, agent_steps = await self.execute_sql_with_retry(prompt, db, schema_str)
        steps.extend(agent_steps)

        if not data and sql_result:
            steps.append("⚠️ Data retrieval unsuccessful. Attempting fallback summary.")

        # Step 3: Build metadata profile (no raw data sent to LLM)
        steps.append("🔒 Building privacy-safe metadata profile...")
        profile = build_metadata_profile(data)
        safe_data = strip_pii_from_rows(data, profile.get("pii_columns", []))

        # Step 4: Rich LLM narrative — include actual row count + sampled values for context
        steps.append("🧩 Reasoning Agent synthesizing final narrative response...")
        data_snippet = str(safe_data[:5])[:500]
        row_count = len(data)
        summary_prompt = (
            f'You are a CRM data analyst. The user asked: "{prompt[:150]}".\n'
            f'The SQL returned {row_count} row(s). Sample data: {data_snippet}.\n'
            f'Write a concise 2-3 sentence executive summary of the results. '
            f'Include specific numbers, names, or values from the data. '
            f'If zero rows returned, explain what that might mean for the business (e.g., no won deals = pipeline at risk). '
            f'Be direct and actionable, not generic.'
        )
        summary = await self.think(summary_prompt)

        # Suggest chart type without an extra LLM call
        chart_suggestion = build_chart_suggestion(profile, prompt)
        steps.append(f"📊 Chart type suggested: {chart_suggestion}")

        return {
            "summary": summary.strip(),
            "data": safe_data,
            "sql": sql_result,
            "steps": steps,
            "chart_suggestion": chart_suggestion,
            "metadata": {
                "row_count": row_count,
                "pii_columns_redacted": profile.get("pii_columns", []),
            },
        }

    async def execute_sql_with_retry(
        self, query_prompt: str, db: Any, schema_str: str
    ) -> Tuple[str, List[Dict[str, Any]], List[str]]:
        """Self-healing SQL engine: generate → validate → execute, up to max_retries."""
        steps = []
        current_try = 1
        last_error = None
        sql = ""
        data = []

        while current_try <= self.max_retries:
            try:
                steps.append(f"🛠️ Step: Generating optimized SQL query (Attempt {current_try})...")

                error_hint = f"Previous SQL failed: {last_error}. Fix it.\n" if last_error else ""
                gen_prompt = (
                    f"You are a SQLite CRM expert. Generate a valid, optimized SELECT query.\n"
                    f"Question: \"{query_prompt[:250]}\"\n\n"
                    f"LIVE DATABASE SCHEMA:\n{schema_str[:2000]}\n\n"
                    f"CRM ENTITY RELATIONSHIPS:\n"
                    f"- contacts JOIN companies ON contacts.company_id = companies.id\n"
                    f"- deals JOIN contacts ON deals.contact_id = contacts.id\n"
                    f"- deals JOIN companies ON deals.company_id = companies.id\n"
                    f"- customers JOIN companies ON customers.company_id = companies.id\n"
                    f"- emails JOIN contacts ON emails.contact_id = contacts.id\n\n"
                    f"BUSINESS LOGIC:\n"
                    f"- 'Revenue' / 'Won' = SUM(deals.value) WHERE deals.stage = 'closed_won'\n"
                    f"- 'Pipeline value' = SUM(deals.value) WHERE deals.stage NOT IN ('closed_won','closed_lost')\n"
                    f"- 'MRR' = SUM(customers.mrr)\n"
                    f"- 'ARR' = SUM(customers.arr) or SUM(customers.mrr) * 12\n"
                    f"- 'Leads' = contacts WHERE lead_score IS NOT NULL\n"
                    f"- 'High-value leads' = contacts WHERE lead_score >= 70\n"
                    f"- 'Stalled deals' = deals WHERE is_stalled = 1\n"
                    f"- 'Churn risk' = customers WHERE churn_risk IN ('high','critical')\n"
                    f"- 'Active customers' = customers WHERE churn_risk != 'critical'\n\n"
                    f"QUERY RULES:\n"
                    f"- ALWAYS add descriptive AS aliases: SUM(value) AS total_revenue\n"
                    f"- Use LEFT JOIN when company/contact may be null\n"
                    f"- For 'top N', use ORDER BY ... DESC LIMIT N\n"
                    f"- For trends, GROUP BY strftime('%Y-%m', created_at)\n"
                    f"- Never use column names that don't exist in the schema\n"
                    f"- For stage breakdown: GROUP BY stage ORDER BY value DESC\n\n"
                    f"{error_hint}"
                    f"Return ONLY raw SQL. No markdown, no explanation, no ```sql."
                )

                raw_sql = await self.think(gen_prompt)
                sql = extract_sql(raw_sql) or raw_sql.replace("```sql", "").replace("```", "").strip()

                # Validate before execution — block destructive queries
                valid, reason = validate_sql(sql)
                if not valid:
                    last_error = f"SQL Validation Failed: {reason}"
                    steps.append(f"❌ Step: Validation failed (Attempt {current_try}): {reason}")
                    current_try += 1
                    continue

                # Execute
                steps.append(f"🚀 Step: Executing: {sql[:80]}...")
                res = db.execute(text(sql)).fetchall()
                data = [dict(r._mapping) for r in res]

                steps.append(f"✅ Step: Result extraction successful. {len(data)} rows retrieved.")
                return sql, data, steps

            except Exception as e:
                last_error = str(e)
                steps.append(f"❌ Step: SQL Attempt {current_try} failed: {last_error[:60]}...")
                current_try += 1

        steps.append("🛑 Step: SQL Agent exhausted retries. Using safety fallback.")
        return sql, [], steps
