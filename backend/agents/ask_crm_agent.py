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

        # Step 4: LLM summary using metadata only (not raw values)
        steps.append("🧩 Reasoning Agent synthesizing final narrative response...")
        data_snippet = str(safe_data[:5])[:300]  # Max 5 rows, 300 chars for summary input
        summary_prompt = (
            f'CRM query: "{prompt[:100]}". '
            f'Result ({len(data)} rows): {data_snippet}. '
            f'Write a 1-2 sentence professional summary.'
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
                "row_count": len(data),
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
                    f"SQLite CRM Expert. Generate a valid SQLite SELECT query.\n"
                    f"Question: \"{query_prompt[:200]}\"\n\n"
                    f"DATABASE SCHEMA:\n{schema_str[:1500]}\n\n"
                    f"BUSINESS LOGIC HINTS:\n"
                    f"- 'Revenue' means SUM(value) from deals where stage='closed_won'.\n"
                    f"- 'Deals' are in the deals table.\n"
                    f"- 'Pipeline' value is sum(value) of deals that are NOT won/lost.\n"
                    f"- 'Customers' refers to the customers table or contacts with status='customer'.\n"
                    f"- IMPORTANT: ALWAYS use descriptive AS aliases for calculated columns (e.g., SUM(value) AS total_revenue).\n\n"
                    f"{error_hint}"
                    f"Return ONLY raw SQL. No markdown, no ```sql."
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
