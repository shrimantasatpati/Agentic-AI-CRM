"""
Schema Inspector — Dynamic SQLite schema discovery via SQLAlchemy
No LLM call — purely structural metadata from the live DB.
Replaces the hardcoded self.schema_hint in AskCRMAgent.
"""

from typing import List, Dict, Any
from sqlalchemy import inspect as sa_inspect
from sqlalchemy.engine import Engine


def get_schema_formatted(engine: Engine) -> str:
    """
    Inspect the live SQLite database and return a human-readable schema string
    for use in LLM prompts. Always matches the actual schema — never stale.
    """
    try:
        inspector = sa_inspect(engine)
        table_names = inspector.get_table_names()
        if not table_names:
            return "No tables found in the database."

        lines: List[str] = []
        for table_name in table_names:
            columns = inspector.get_columns(table_name)
            col_lines = [
                f"  - {col['name']} ({col['type']}"
                + ("" if col.get("nullable", True) else ", NOT NULL")
                + ")"
                for col in columns
            ]
            lines.append(f"Table: {table_name}\n" + "\n".join(col_lines))

        return "\n\n".join(lines)
    except Exception as e:
        # Fallback to a known safe schema hint if inspection fails
        return f"""Schema inspection failed ({e}). Known tables:
Table: contacts
  - id (VARCHAR), email (VARCHAR), first_name (VARCHAR), last_name (VARCHAR)
  - lead_score (INTEGER), lead_status (VARCHAR), job_title (VARCHAR)

Table: deals
  - id (VARCHAR), name (VARCHAR), value (FLOAT), stage (VARCHAR)
  - health_score (INTEGER), is_stalled (BOOLEAN)

Table: customers
  - id (VARCHAR), health_score (INTEGER), churn_risk (VARCHAR)
  - churn_probability (INTEGER), mrr (FLOAT)

Table: emails
  - id (VARCHAR), from_email (VARCHAR), subject (TEXT)
  - sentiment (VARCHAR), priority (VARCHAR), category (VARCHAR)

Table: meetings
  - id (VARCHAR), title (VARCHAR), meeting_type (VARCHAR)
  - scheduled_at (DATETIME), status (VARCHAR)"""


def get_schema_dict(engine: Engine) -> List[Dict[str, Any]]:
    """
    Returns structured schema as a list of {table, columns} dicts.
    Useful for programmatic schema introspection.
    """
    try:
        inspector = sa_inspect(engine)
        result = []
        for table_name in inspector.get_table_names():
            columns = [
                {"name": col["name"], "type": str(col["type"]), "nullable": col.get("nullable", True)}
                for col in inspector.get_columns(table_name)
            ]
            result.append({"table": table_name, "columns": columns})
        return result
    except Exception:
        return []
