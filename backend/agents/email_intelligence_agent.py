"""Email Intelligence Agent - Drafts personalized responses and analyzes sentiment"""

from typing import Dict, Any, List
from .base_agent import BaseAgent
import re


class EmailIntelligenceAgent(BaseAgent):
    """
    Autonomous agent that:
    - Drafts personalized email responses
    - Performs sentiment analysis on customer emails
    - Auto-categorizes and prioritizes emails
    - Provides smart follow-up suggestions
    """

    def __init__(self, llm, tools=None, memory=None, redis_client=None):
        super().__init__(
            name="EmailIntelligenceAgent",
            llm=llm,
            tools=tools,
            memory=memory,
            redis_client=redis_client
        )

        self.categories = [
            "support_request",
            "sales_inquiry",
            "demo_request",
            "pricing_question",
            "complaint",
            "feature_request",
            "general_inquiry"
        ]

    async def execute(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """Execute email intelligence workflow"""
        email_data = task.get("email_data", {})

        await self.log_activity("email_received", {"from": email_data.get("from")})

        # OPTIMIZED: Single LLM call for analysis (sentiment + category + priority)
        sentiment, category, priority = await self._analyze_email_single_call(email_data)

        # Step 4: Draft response (needs analysis results — separate call)
        draft_response = await self.draft_response(email_data, sentiment, category)

        # Step 5: Generate follow-up suggestions (batched into draft call via suggest_follow_ups)
        follow_ups = await self.suggest_follow_ups(email_data, category)

        # Publish event
        await self.publish_event("email_processed", {
            "email_id": email_data.get("id"),
            "sentiment": sentiment,
            "category": category,
            "priority": priority
        })

        result = {
            "email_id": email_data.get("id"),
            "sentiment": sentiment,
            "category": category,
            "priority": priority,
            "draft_response": draft_response,
            "follow_up_suggestions": follow_ups,
            "requires_human_review": priority == "high" or sentiment["score"] < 3
        }

        await self.log_activity("email_processed", result)

        return result

    async def _analyze_email_single_call(self, email_data: Dict[str, Any]):
        """
        Hybrid analysis:
        - VADER (rule-based, zero-latency, no rate limit) for sentiment score/label/emotion
        - Single LLM call for category + priority (which require business logic understanding)
        """
        import json
        content = email_data.get("body", "") or ""
        subject = email_data.get("subject", "") or ""
        full_text = f"{subject}. {content}"

        # --- VADER Sentiment (deterministic, no LLM call needed) ---
        try:
            from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
            _vader = SentimentIntensityAnalyzer()
            vs = _vader.polarity_scores(full_text)
            compound = vs["compound"]           # -1.0 … +1.0
            # Map compound → 1-10 score
            vader_score = round((compound + 1) / 2 * 9 + 1)  # 1-10
            vader_score = max(1, min(10, vader_score))
            if compound >= 0.35:
                vader_label, vader_emotion = "positive", "happiness"
            elif compound <= -0.35:
                vader_label, vader_emotion = "negative", "frustration"
            else:
                vader_label, vader_emotion = "neutral", "neutral"
            # Boost emotion if highly positive
            if compound >= 0.6:
                vader_emotion = "excitement"
            elif compound <= -0.6:
                vader_emotion = "anger"
        except Exception:
            vader_score, vader_label, vader_emotion = 5, "neutral", "neutral"

        # --- LLM Call: category + priority + urgency (single call) ---
        combined_prompt = f"""Analyze this CRM email and return ONLY valid JSON:

Subject: {subject}
Body: {content[:600]}

IMPORTANT: if the sender says they are "excited", "happy", "interested" or asks for a "demo" —
that is a POSITIVE sales inquiry, NOT a complaint.

Return exactly this JSON:
{{
  "urgency": "low|medium|high",
  "concerns": ["concern1"],
  "category": "support_request|sales_inquiry|demo_request|pricing_question|complaint|feature_request|general_inquiry",
  "priority": "low|medium|high"
}}"""

        raw = await self.think(combined_prompt)

        try:
            json_match = __import__('re').search(r'\{.*\}', raw, __import__('re').DOTALL)
            parsed = json.loads(json_match.group() if json_match else raw)
        except Exception:
            parsed = {}

        sentiment = {
            "score":    vader_score,
            "label":    vader_label,
            "emotion":  vader_emotion,
            "urgency":  parsed.get("urgency", "medium"),
            "concerns": parsed.get("concerns", []),
        }
        category = parsed.get("category", "general_inquiry")
        if category not in self.categories:
            category = "general_inquiry"
        priority = parsed.get("priority", "medium")

        return sentiment, category, priority

    async def execute_batch(self, emails_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Process multiple emails in ONE single LLM call.
        Returns a list of analysis results.
        """
        if not emails_data:
            return []

        # 1. Run local VADER sentiment on all emails (No API cost/latency)
        vader_results = {}
        from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
        try:
            _vader = SentimentIntensityAnalyzer()
        except:
            _vader = None

        for ed in emails_data:
            eid = str(ed.get("id"))
            text = f"{ed.get('subject', '')}. {ed.get('body', '')}"
            if _vader:
                vs = _vader.polarity_scores(text)
                c = vs["compound"]
                score = max(1, min(10, round((c + 1) / 2 * 9 + 1)))
                if c >= 0.35:
                    lbl, emo = "positive", ("excitement" if c >= 0.6 else "happiness")
                elif c <= -0.35:
                    lbl, emo = "negative", ("anger" if c <= -0.6 else "frustration")
                else:
                    lbl, emo = "neutral", "neutral"
                vader_results[eid] = {"score": score, "label": lbl, "emotion": emo}
            else:
                vader_results[eid] = {"score": 5, "label": "neutral", "emotion": "neutral"}

        # 2. Build one massive prompt for the LLM
        prompt_parts = [
            "Analyze the following list of customer emails. For EACH email, provide exactly ONE JSON object in the output array.",
            "IMPORTANT: A demo request or someone saying they are 'excited' is a POSITIVE 'sales_inquiry' or 'demo_request', NOT a complaint.",
            "Categories allowed: support_request, sales_inquiry, demo_request, pricing_question, complaint, feature_request, general_inquiry",
            "Priorities allowed: low, medium, high",
            "Urgency allowed: low, medium, high\n",
            "EMAILS TO ANALYZE:"
        ]
        
        for i, ed in enumerate(emails_data):
            prompt_parts.append(f"\n--- EMAIL ID: {ed.get('id')} ---")
            prompt_parts.append(f"Subject: {ed.get('subject', '')}")
            prompt_parts.append(f"Body: {ed.get('body', '')[:600]}") # Truncate to save tokens

        prompt_parts.append("\nOUTPUT FORMAT:")
        prompt_parts.append("""Return exactly a JSON array of objects. Example:
[
  {
    "id": "email_id_here",
    "category": "sales_inquiry",
    "priority": "high",
    "urgency": "medium",
    "concerns": ["pricing"],
    "follow_up_suggestions": ["Schedule a demo", "Send pricing sheet"],
    "draft_response": "Hi there, thanks for reaching out! We'd love to..."
  }
]
Return ONLY the JSON array, nothing else.""")

        # 3. Call LLM Once
        raw_response = await self.think("\n".join(prompt_parts), max_tokens=2048)

        # 4. Parse Results
        import json, re
        parsed_array = []
        try:
            json_str = raw_response
            match = re.search(r'\[.*\]', raw_response, re.DOTALL)
            if match:
                json_str = match.group()
            parsed_array = json.loads(json_str)
            if not isinstance(parsed_array, list):
                parsed_array = [parsed_array]
        except Exception as e:
            print(f"[EmailIntelligence] Batch parse failed: {e}")
            parsed_array = []

        # 5. Merge VADER and LLM into final results list
        results = []
        parsed_dict = {str(item.get("id")): item for item in parsed_array if isinstance(item, dict) and item.get("id")}
        
        for ed in emails_data:
            eid = str(ed.get("id"))
            p_data = parsed_dict.get(eid, {})
            v_data = vader_results.get(eid, {})
            
            sentiment = {
                **v_data,
                "urgency": p_data.get("urgency", "medium"),
                "concerns": p_data.get("concerns", [])
            }
            category = p_data.get("category", "general_inquiry")
            if category not in self.categories:
                category = "general_inquiry"
            priority = p_data.get("priority", "medium")
            
            res = {
                "email_id": eid,
                "sentiment": sentiment,
                "category": category,
                "priority": priority,
                "draft_response": p_data.get("draft_response", "Thank you for your message. We will get back to you shortly."),
                "follow_up_suggestions": p_data.get("follow_up_suggestions", ["Follow up in 24 hours"]),
                "requires_human_review": priority == "high" or sentiment["score"] <= 3
            }
            results.append(res)
            # We skip logging activity per email here to avoid spamming the log in batch

        return results

    async def analyze_sentiment(self, email_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze sentiment of email content"""
        content = email_data.get("body", "")
        subject = email_data.get("subject", "")

        sentiment_prompt = f"""
        Analyze the sentiment of this email:

        Subject: {subject}
        Body: {content}

        Provide:
        1. Sentiment score (1-10, where 1=very negative, 10=very positive)
        2. Sentiment label (positive/neutral/negative)
        3. Emotion detected (anger/frustration/happiness/excitement/neutral)
        4. Urgency level (low/medium/high)
        5. Key concerns or pain points

        Return as JSON format.
        """

        sentiment_response = await self.think(sentiment_prompt)

        # Parse sentiment data
        sentiment = {
            "score": self._extract_sentiment_score(sentiment_response),
            "label": self._extract_sentiment_label(sentiment_response),
            "emotion": self._extract_emotion(sentiment_response),
            "urgency": self._extract_urgency(sentiment_response),
            "concerns": self._extract_concerns(sentiment_response)
        }

        return sentiment

    async def categorize_email(self, email_data: Dict[str, Any]) -> str:
        """Categorize email into predefined categories"""
        content = email_data.get("body", "")
        subject = email_data.get("subject", "")

        categorization_prompt = f"""
        Categorize this email into ONE of these categories:
        {', '.join(self.categories)}

        Subject: {subject}
        Body: {content}

        Return ONLY the category name.
        """

        category = await self.think(categorization_prompt)
        category = category.strip().lower()

        # Validate category
        if category not in self.categories:
            category = "general_inquiry"

        return category

    async def determine_priority(
        self,
        email_data: Dict[str, Any],
        sentiment: Dict[str, Any],
        category: str
    ) -> str:
        """Determine email priority (low/medium/high)"""

        # High priority criteria
        if sentiment["urgency"] == "high":
            return "high"

        if sentiment["score"] <= 3:  # Negative sentiment
            return "high"

        if category in ["complaint", "demo_request"]:
            return "high"

        # Check for VIP sender
        sender = email_data.get("from", "")
        if await self._is_vip_sender(sender):
            return "high"

        # Medium priority
        if category in ["pricing_question", "sales_inquiry", "feature_request"]:
            return "medium"

        # Low priority
        return "low"

    async def draft_response(
        self,
        email_data: Dict[str, Any],
        sentiment: Dict[str, Any],
        category: str
    ) -> str:
        """Draft personalized email response AND follow-ups in one combined LLM call."""

        sender_name = email_data.get("from_name", "there")
        content = email_data.get("body", "")
        subject = email_data.get("subject", "")

        # Get context from CRM
        context = await self._get_customer_context(email_data.get("from"))

        response_prompt = f"""You are a CRM assistant. Draft a professional email reply AND suggest 3 follow-up actions.
Return ONLY valid JSON with exactly these two keys:

Original Email:
From: {sender_name}
Subject: {subject}
Body: {content[:500]}

Context:
- Sentiment: {sentiment['label']} (emotion: {sentiment['emotion']}, score: {sentiment['score']}/10)
- Category: {category}
- Customer history: {context}

Guidelines for draft:
- Match tone to sentiment (enthusiastic if positive/excited, empathetic if negative)
- Address the specific request directly
- Provide clear next steps
- Keep it concise (3-4 paragraphs)

Return ONLY this JSON:
{{
  "draft": "<the full email reply as a string, use \\n for line breaks>",
  "follow_ups": ["action 1", "action 2", "action 3"]
}}"""

        raw = await self.think(response_prompt)

        try:
            import json, re
            json_match = re.search(r'\{.*\}', raw, re.DOTALL)
            parsed = json.loads(json_match.group() if json_match else raw)
            self._last_follow_ups = parsed.get("follow_ups", [])
            return parsed.get("draft", raw)
        except Exception:
            self._last_follow_ups = []
            return raw

    async def suggest_follow_ups(
        self,
        email_data: Dict[str, Any],
        category: str
    ) -> List[str]:
        """Return follow-ups pre-generated in draft_response (no extra LLM call)."""
        # Follow-ups are already generated in draft_response to save an LLM call.
        # Fallback rule-based suggestions if draft_response hasn't run yet.
        if hasattr(self, '_last_follow_ups') and self._last_follow_ups:
            result = self._last_follow_ups
            self._last_follow_ups = []
            return result
        fallbacks = {
            "demo_request":     ["Schedule a 30-min demo call", "Send product overview deck", "Connect with Solutions Engineer"],
            "sales_inquiry":    ["Send pricing and case studies", "Schedule discovery call", "Add to sales nurture sequence"],
            "complaint":        ["Escalate to Customer Success", "Apply service credit if applicable", "Schedule immediate call"],
            "pricing_question": ["Send tailored pricing sheet", "Schedule pricing call with AE", "Share ROI calculator"],
            "support_request":  ["Create support ticket", "Loop in technical team", "Schedule troubleshooting call"],
        }
        return fallbacks.get(category, ["Follow up within 24 hours", "Log interaction in CRM", "Review account history"])


    async def _is_vip_sender(self, email: str) -> bool:
        """Check if sender is VIP customer"""
        # Query CRM database for VIP status
        # Placeholder implementation
        vip_domains = ["enterprise.com", "bigclient.com"]
        domain = email.split("@")[-1] if "@" in email else ""
        return domain in vip_domains

    async def _get_customer_context(self, email: str) -> str:
        """Get customer history from CRM — queries real contacts and emails tables."""
        if not email:
            return "No sender email provided"
        try:
            from database.connection import SessionLocal
            from database.models import Contact, Email as EmailModel
            db = SessionLocal()
            try:
                contact = db.query(Contact).filter(Contact.email == email).first()
                if not contact:
                    return f"First-time contact — no record found for {email}"

                # Count past emails
                past_emails = db.query(EmailModel).filter(EmailModel.from_email == email).all()
                email_count = len(past_emails)

                # Get most recent sentiment from past analyzed emails
                analyzed = [e for e in past_emails if (e.extra_metadata or {}).get("agent_analyzed")]
                recent_sentiments = [
                    (e.extra_metadata or {}).get("sentiment", {}).get("label", "unknown")
                    for e in analyzed[-3:]
                ]

                lead_info = f"Lead score: {contact.lead_score}/100 · Status: {contact.lead_status}"
                if email_count == 0:
                    history = "First contact — no previous emails in CRM"
                else:
                    sentiment_summary = ", ".join(recent_sentiments) if recent_sentiments else "not yet analyzed"
                    history = f"{email_count} previous email(s) · Recent sentiments: {sentiment_summary}"

                return f"{lead_info} · {history}"
            finally:
                db.close()
        except Exception as e:
            return f"Context lookup failed: {e}"

    def _extract_sentiment_score(self, text: str) -> int:
        """Extract sentiment score from LLM response"""
        match = re.search(r'score["\s:]+(\d+)', text, re.IGNORECASE)
        if match:
            return int(match.group(1))
        return 5  # Neutral default

    def _extract_sentiment_label(self, text: str) -> str:
        """Extract sentiment label"""
        text_lower = text.lower()
        if "positive" in text_lower:
            return "positive"
        elif "negative" in text_lower:
            return "negative"
        return "neutral"

    def _extract_emotion(self, text: str) -> str:
        """Extract detected emotion"""
        emotions = ["anger", "frustration", "happiness", "excitement", "neutral"]
        text_lower = text.lower()
        for emotion in emotions:
            if emotion in text_lower:
                return emotion
        return "neutral"

    def _extract_urgency(self, text: str) -> str:
        """Extract urgency level"""
        text_lower = text.lower()
        if "high" in text_lower:
            return "high"
        elif "low" in text_lower:
            return "low"
        return "medium"

    def _extract_concerns(self, text: str) -> List[str]:
        """Extract key concerns from analysis"""
        # Simple extraction - look for bullet points or numbered items
        concerns = []
        lines = text.split("\n")
        for line in lines:
            if any(marker in line for marker in ["-", "•", "concern", "pain point"]):
                concern = line.strip().lstrip("-•").strip()
                if concern:
                    concerns.append(concern)
        return concerns[:3]  # Top 3 concerns
