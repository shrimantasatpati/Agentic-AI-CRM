"""
Metadata Profiler — Privacy Bypass Engine
Transforms raw DB rows into anonymized structural metadata before any LLM call.
Raw data values NEVER leave the backend — only shape/statistics go to the LLM.
"""

import re
from typing import List, Dict, Any, Optional


# PII column name patterns — these columns are redacted from LLM input and API output
_PII_PATTERNS = [
    r'email',
    r'phone',
    r'mobile',
    r'ssn',
    r'passport',
    r'\baddress\b',
    r'zip',
    r'postal',
    r'credit.?card',
    r'card.?number',
    r'\bdob\b',
    r'date.?of.?birth',
    r'national.?id',
    r'ip.?address',
    r'password',
    r'secret',
    r'\btoken\b',
    r'first.?name',
    r'last.?name',
]


def _is_pii_column(column_name: str) -> bool:
    """Detect PII columns by name pattern."""
    name_lower = column_name.lower()
    return any(re.search(p, name_lower) for p in _PII_PATTERNS)


def _infer_type(values: List[Any]) -> str:
    """Infer column data type from a sample of values."""
    non_null = [v for v in values if v is not None]
    if not non_null:
        return "string"

    sample = non_null[0]

    if isinstance(sample, bool):
        return "boolean"

    if isinstance(sample, (int, float)):
        return "numeric"

    if isinstance(sample, str):
        # Check if it looks like a date
        if re.match(r'^\d{4}-\d{2}-\d{2}', sample):
            return "date"
        # Check if numeric string
        try:
            float(sample)
            if sample.strip():
                return "numeric"
        except ValueError:
            pass
        return "categorical"

    return "string"


def build_metadata_profile(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Build an anonymized metadata profile from raw database rows.

    Returns structural statistics only — no raw values.
    This is safe to send to LLM for dashboard config generation.
    """
    if not rows:
        return {"row_count": 0, "columns": [], "pii_columns": []}

    column_names = list(rows[0].keys())
    columns: List[Dict[str, Any]] = []
    pii_columns: List[str] = []

    for name in column_names:
        values = [row.get(name) for row in rows]
        non_null = [v for v in values if v is not None]
        null_count = len(values) - len(non_null)
        has_pii = _is_pii_column(name)

        if has_pii:
            pii_columns.append(name)
            columns.append({
                "name": name,
                "type": "pii",
                "contains_pii": True,
                "null_count": null_count,
                "unique_count": len(set(str(v) for v in non_null)),
            })
            continue

        dtype = _infer_type(values)
        col: Dict[str, Any] = {
            "name": name,
            "type": dtype,
            "contains_pii": False,
            "null_count": null_count,
        }

        if dtype == "numeric":
            nums = [float(v) for v in non_null if v is not None]
            if nums:
                col["min"] = min(nums)
                col["max"] = max(nums)
                col["sum"] = sum(nums)
            col["unique_count"] = len(set(non_null))

        elif dtype == "categorical":
            col["unique_count"] = len(set(str(v) for v in non_null))
            # Only include cardinality info — never the actual values

        elif dtype == "date":
            col["sample_format"] = "YYYY-MM-DD"
            valid_dates = []
            for v in non_null:
                try:
                    from datetime import datetime
                    d = datetime.fromisoformat(str(v).split('T')[0])
                    valid_dates.append(d)
                except (ValueError, TypeError):
                    pass
            if valid_dates:
                col["min"] = min(valid_dates).strftime("%Y-%m-%d")
                col["max"] = max(valid_dates).strftime("%Y-%m-%d")

        elif dtype == "boolean":
            true_count = sum(1 for v in non_null if v)
            col["true_count"] = true_count
            col["false_count"] = len(non_null) - true_count

        columns.append(col)

    return {
        "row_count": len(rows),
        "columns": columns,
        "pii_columns": pii_columns,  # Used to strip from API response
    }


def strip_pii_from_rows(
    rows: List[Dict[str, Any]],
    pii_columns: List[str]
) -> List[Dict[str, Any]]:
    """Remove PII columns from raw rows before sending to the frontend."""
    if not pii_columns:
        return rows
    return [
        {k: v for k, v in row.items() if k not in pii_columns}
        for row in rows
    ]


def build_chart_suggestion(profile: Dict[str, Any], prompt: str) -> Optional[str]:
    """
    Lightweight chart type suggestion without an LLM call.
    Used as fallback when LLM dashboard config generation is skipped.
    """
    columns = profile.get("columns", [])
    numeric_cols = [c for c in columns if c["type"] == "numeric" and not c.get("contains_pii")]
    categorical_cols = [c for c in columns if c["type"] == "categorical" and not c.get("contains_pii")]
    date_cols = [c for c in columns if c["type"] == "date"]

    if not numeric_cols:
        return "table"

    prompt_lower = prompt.lower()
    if any(w in prompt_lower for w in ['trend', 'over time', 'month', 'growth', 'daily', 'history']):
        return "line"

    if date_cols:
        return "line"

    if categorical_cols and len(categorical_cols) >= 1:
        # Low cardinality → pie; high cardinality → bar
        cat = categorical_cols[0]
        if cat.get("unique_count", 10) <= 6:
            return "pie"
        return "bar"

    return "bar"
