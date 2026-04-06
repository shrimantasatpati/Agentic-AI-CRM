"""
WebSearchTool — CRM-native tool for agent use via use_tool()
Uses DuckDuckGo Instant Answer API (no API key required).
Called by LeadQualificationAgent and SalesPipelineAgent for company enrichment.
"""

import httpx
import json
from typing import Any


class WebSearchTool:
    """
    Lightweight web search tool compatible with BaseAgent.use_tool().
    Queries DuckDuckGo Instant Answer API — free, no API key needed.
    Falls back to a structured placeholder when offline.
    """

    name = "web_search"

    async def arun(self, company: str = "", query: str = "", **kwargs: Any) -> dict:
        """
        Search the web for company/query context.
        Returns structured dict with: summary, source, related_topics.
        """
        search_term = query or company
        if not search_term:
            return {"summary": "No search term provided", "source": None, "related_topics": []}

        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                response = await client.get(
                    "https://api.duckduckgo.com/",
                    params={
                        "q": search_term,
                        "format": "json",
                        "no_html": "1",
                        "skip_disambig": "1",
                    },
                    headers={"User-Agent": "AI-CRM/1.0"},
                )
                if response.status_code != 200:
                    return self._fallback(search_term)

                data = response.json()

                # Extract best available answer
                abstract = data.get("Abstract") or data.get("Answer") or ""
                source   = data.get("AbstractURL") or data.get("AbstractSource") or ""

                # Related topics (first 5)
                related = [
                    t.get("Text", "")
                    for t in data.get("RelatedTopics", [])[:5]
                    if isinstance(t, dict) and t.get("Text")
                ]

                if not abstract and not related:
                    return self._fallback(search_term)

                return {
                    "summary": abstract or f"Related information found for: {search_term}",
                    "source": source,
                    "related_topics": related,
                    "raw_query": search_term,
                }

        except Exception as e:
            print(f"[WebSearchTool] Search failed for '{search_term}': {e}")
            return self._fallback(search_term)

    def _fallback(self, term: str) -> dict:
        """Return a graceful fallback when search is unavailable."""
        return {
            "summary": f"Web search unavailable for '{term}' — agent will rely on CRM data only.",
            "source": None,
            "related_topics": [],
            "raw_query": term,
        }
