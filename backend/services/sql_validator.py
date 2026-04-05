"""
SQL Validator — Security Guard
Blocks any LLM-generated SQL that contains mutating or destructive statements.
Only SELECT queries are allowed through.
"""

import re
from typing import Tuple

# Forbidden SQL statement patterns
_FORBIDDEN_PATTERNS = [
    (r'\bINSERT\b',    'INSERT statements are not allowed'),
    (r'\bUPDATE\b',    'UPDATE statements are not allowed'),
    (r'\bDELETE\b',    'DELETE statements are not allowed'),
    (r'\bDROP\b',      'DROP statements are not allowed'),
    (r'\bALTER\b',     'ALTER statements are not allowed'),
    (r'\bTRUNCATE\b',  'TRUNCATE statements are not allowed'),
    (r'\bCREATE\b',    'CREATE statements are not allowed'),
    (r'\bGRANT\b',     'GRANT statements are not allowed'),
    (r'\bREVOKE\b',    'REVOKE statements are not allowed'),
    (r'\bATTACH\b',    'ATTACH statements are not allowed (SQLite)'),
    (r'\bDETACH\b',    'DETACH statements are not allowed (SQLite)'),
    (r'--+',           'SQL comment injection detected'),
    (r'/\*',           'Block comment injection detected'),
    (r';\s*\w',        'Multiple-statement injection detected'),
    (r'\bEXEC\b',      'EXEC statements are not allowed'),
    (r'\bEXECUTE\b',   'EXECUTE statements are not allowed'),
    (r'\bSLEEP\s*\(',  'SLEEP function is not allowed'),
    (r'\bBENCHMARK\s*\(', 'BENCHMARK function is not allowed'),
]


def validate_sql(sql: str) -> Tuple[bool, str]:
    """
    Validate that SQL is a safe, read-only SELECT statement.

    Returns:
        (True, "") if valid
        (False, reason) if invalid
    """
    trimmed = sql.strip()

    if not trimmed:
        return False, "SQL string is empty"

    # Must start with SELECT
    if not re.match(r'^\s*SELECT\b', trimmed, re.IGNORECASE):
        preview = trimmed[:60].replace('\n', ' ')
        return False, f"Query must start with SELECT. Got: \"{preview}...\""

    # Check for forbidden patterns
    for pattern, reason in _FORBIDDEN_PATTERNS:
        if re.search(pattern, trimmed, re.IGNORECASE):
            return False, reason

    return True, ""


def extract_sql(text: str) -> str:
    """
    Extract a clean SQL statement from raw LLM output.
    Handles markdown code blocks and stray text around the SQL.
    """
    # Try to extract from markdown code block first
    code_block = re.search(r'```(?:sql)?\s*([\s\S]*?)```', text, re.IGNORECASE)
    if code_block:
        return code_block.group(1).strip().rstrip(';')

    # Fallback: find the SELECT statement directly
    select_match = re.search(r'(SELECT[\s\S]+?)(?:;|$)', text, re.IGNORECASE)
    if select_match:
        sql = select_match.group(1).strip().rstrip(';')
        # Strip trailing conversational artifacts (quotes, brackets the LLM may hallucinate)
        sql = re.sub(r"[`\"'''""]+$", '', sql).strip()
        return sql

    # Last resort: return the text after stripping markdown
    cleaned = text.replace('```sql', '').replace('```', '').strip().rstrip(';')
    return cleaned
