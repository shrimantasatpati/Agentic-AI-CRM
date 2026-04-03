"""Meeting Scheduler Agent - Smart calendar management and scheduling"""

from typing import Dict, Any, List
from .base_agent import BaseAgent
from datetime import datetime, timedelta
import json


class MeetingSchedulerAgent(BaseAgent):
    """
    Autonomous agent that:
    - Smart calendar management
    - Context-aware scheduling
    - Automatic meeting prep
    - Follow-up task creation
    """

    def __init__(self, llm, tools=None, memory=None, redis_client=None):
        super().__init__(
            name="MeetingSchedulerAgent",
            llm=llm,
            tools=tools,
            memory=memory,
            redis_client=redis_client
        )

        self.meeting_types = {
            "discovery": 30,
            "demo": 60,
            "follow_up": 30,
            "executive_review": 90,
            "training": 120,
            "general": 30
        }

    async def execute(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """Execute meeting scheduler workflow"""
        action = task.get("action", "schedule")

        if action == "schedule":
            return await self.schedule_meeting(task)
        elif action == "prepare":
            return await self.prepare_meeting(task.get("meeting_id"))
        elif action == "suggest_times":
            return await self.suggest_meeting_times(task)
        elif action == "create_followup":
            return await self.create_followup_tasks(task.get("meeting_id"))
        else:
            return {"error": "Unknown action"}

    async def schedule_meeting(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Schedule a new meeting intelligently"""
        await self.log_activity("scheduling_meeting", {"type": request.get("meeting_type")})

        # Extract meeting details
        meeting_type = request.get("meeting_type", "general")
        attendees = request.get("attendees", [])
        subject = request.get("subject", "")
        preferred_time = request.get("preferred_time")

        # Determine optimal duration
        duration = self.meeting_types.get(meeting_type, 30)

        # Find available time slots
        available_slots = await self.find_available_slots(
            attendees,
            duration,
            preferred_time
        )

        # Get context from CRM
        context = await self._get_meeting_context(attendees, meeting_type)

        # Select best time slot
        best_slot = await self.select_best_slot(available_slots, context)

        # Create meeting prep
        prep_materials = await self.create_meeting_prep(
            meeting_type,
            attendees,
            context
        )

        # Generate agenda
        agenda = await self.generate_agenda(meeting_type, context)

        meeting = {
            "meeting_id": self._generate_meeting_id(),
            "type": meeting_type,
            "subject": subject,
            "duration_minutes": duration,
            "scheduled_time": best_slot,
            "attendees": attendees,
            "agenda": agenda,
            "prep_materials": prep_materials,
            "location": "Google Meet (auto-generated)",
            "context": context
        }

        # Publish event
        await self.publish_event("meeting_scheduled", {
            "meeting_id": meeting["meeting_id"],
            "type": meeting_type,
            "time": best_slot
        })

        await self.log_activity("meeting_scheduled", meeting)

        return meeting

    async def find_available_slots(
        self,
        attendees: List[str],
        duration: int,
        preferred_time: str = None
    ) -> List[str]:
        """Find available time slots for all attendees"""

        # Get calendars for all attendees
        calendars = await self._get_calendars(attendees)

        # Find common free slots
        slots = []
        current_time = datetime.now()

        # Search next 14 days
        for day_offset in range(14):
            check_date = current_time + timedelta(days=day_offset)

            # Skip weekends
            if check_date.weekday() >= 5:
                continue

            # Check business hours (9 AM - 5 PM)
            for hour in range(9, 17):
                slot_start = check_date.replace(hour=hour, minute=0, second=0, microsecond=0)
                slot_end = slot_start + timedelta(minutes=duration)

                # Check if slot is free for all attendees
                if await self._is_slot_available(slot_start, slot_end, calendars):
                    slots.append(slot_start.isoformat())

                if len(slots) >= 5:  # Limit to 5 options
                    break

            if len(slots) >= 5:
                break

        return slots

    async def select_best_slot(
        self,
        available_slots: List[str],
        context: Dict[str, Any]
    ) -> str:
        """Select the best time slot based on context"""

        if not available_slots:
            # Return next business day at 10 AM as fallback
            tomorrow = datetime.now() + timedelta(days=1)
            while tomorrow.weekday() >= 5:
                tomorrow += timedelta(days=1)
            return tomorrow.replace(hour=10, minute=0).isoformat()

        selection_prompt = f"""
        Select the best meeting time from these options:

        Available Slots:
        {chr(10).join([f"{i+1}. {slot}" for i, slot in enumerate(available_slots)])}

        Context:
        - Meeting Type: {context.get('meeting_type')}
        - Customer Timezone: {context.get('timezone', 'Unknown')}
        - Deal Stage: {context.get('deal_stage', 'Unknown')}
        - Priority: {context.get('priority', 'medium')}

        Selection criteria:
        - Earlier is better for high priority
        - Mid-morning (10-11 AM) is ideal for demos
        - Avoid Monday mornings and Friday afternoons
        - Consider timezone (if international, suggest afternoon local time)

        Return ONLY the number (1-{len(available_slots)}) of the best slot.
        """

        selection = await self.think(selection_prompt)
        slot_index = self._extract_number(selection, default=1) - 1

        if 0 <= slot_index < len(available_slots):
            return available_slots[slot_index]

        return available_slots[0]  # Default to first slot

    async def generate_agenda(
        self,
        meeting_type: str,
        context: Dict[str, Any]
    ) -> List[str]:
        """Generate meeting agenda based on type and context"""

        agenda_prompt = f"""
        Create a meeting agenda for a {meeting_type} meeting.

        Context:
        - Company: {context.get('company')}
        - Contact: {context.get('contact_name')}
        - Deal Stage: {context.get('deal_stage')}
        - Previous Interactions: {context.get('previous_meetings', 0)}
        - Key Topics: {context.get('topics', [])}

        Generate 4-6 agenda items with time allocations.
        Format: "Duration (min) - Topic"
        """

        agenda_text = await self.think(agenda_prompt)

        # Parse agenda items
        agenda_items = [
            line.strip() for line in agenda_text.split("\n")
            if line.strip() and any(c.isalpha() for c in line)
        ]

        return agenda_items

    async def create_meeting_prep(
        self,
        meeting_type: str,
        attendees: List[str],
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Create meeting preparation materials"""

        prep_prompt = f"""
        Create meeting prep materials for a {meeting_type} meeting.

        Attendees: {', '.join(attendees)}
        Context: {json.dumps(context, indent=2)}

        Provide:
        1. Key talking points (3-5 bullets)
        2. Questions to ask
        3. Success criteria for this meeting
        4. Potential objections and responses
        5. Resources to bring/share

        Return as structured text.
        """

        prep_text = await self.think(prep_prompt)

        return {
            "prep_notes": prep_text,
            "account_info": context,
            "previous_interactions": context.get("interaction_history", []),
            "recommended_collateral": self._get_collateral(meeting_type),
            "success_criteria": [
                "Understand customer's pain points",
                "Demonstrate value proposition",
                "Secure next steps commitment"
            ]
        }

    async def prepare_meeting(self, meeting_id: str) -> Dict[str, Any]:
        """Prepare for upcoming meeting"""

        meeting_data = await self._get_meeting_data(meeting_id)

        # Pull latest CRM data
        context = await self._get_meeting_context(
            meeting_data.get("attendees", []),
            meeting_data.get("type")
        )

        # Create briefing
        briefing = await self._create_meeting_briefing(meeting_data, context)

        # Set reminders
        await self._set_meeting_reminders(meeting_id)

        prep = {
            "meeting_id": meeting_id,
            "briefing": briefing,
            "attendees_info": context.get("attendees_details", []),
            "recent_activity": context.get("recent_activity", []),
            "recommended_agenda": meeting_data.get("agenda", []),
            "reminders_set": True
        }

        await self.log_activity("meeting_prepared", {"meeting_id": meeting_id})

        return prep

    async def create_followup_tasks(self, meeting_id: str) -> List[Dict[str, Any]]:
        """Create follow-up tasks after meeting"""

        meeting_data = await self._get_meeting_data(meeting_id)

        tasks_prompt = f"""
        Create follow-up tasks after this meeting:

        Meeting Type: {meeting_data.get('type')}
        Attendees: {meeting_data.get('attendees')}
        Notes: {meeting_data.get('notes', 'No notes')}

        Generate 3-5 specific follow-up tasks with:
        - Task description
        - Assignee (sales rep or team member)
        - Due date (days from now)
        - Priority

        Return as structured list.
        """

        tasks_text = await self.think(tasks_prompt)

        # Default tasks based on meeting type
        tasks = []

        if meeting_data.get("type") == "demo":
            tasks.append({
                "task": "Send demo recording and resources",
                "assignee": "sales_rep",
                "due_days": 1,
                "priority": "high"
            })
            tasks.append({
                "task": "Schedule follow-up call",
                "assignee": "sales_rep",
                "due_days": 3,
                "priority": "medium"
            })

        elif meeting_data.get("type") == "discovery":
            tasks.append({
                "task": "Send discovery recap email",
                "assignee": "sales_rep",
                "due_days": 1,
                "priority": "high"
            })
            tasks.append({
                "task": "Create custom proposal",
                "assignee": "sales_rep",
                "due_days": 5,
                "priority": "high"
            })

        # Publish event
        await self.publish_event("followup_tasks_created", {
            "meeting_id": meeting_id,
            "task_count": len(tasks)
        })

        return tasks

    async def suggest_meeting_times(self, request: Dict[str, Any]) -> List[str]:
        """Suggest optimal meeting times"""

        attendees = request.get("attendees", [])
        duration = request.get("duration", 30)

        slots = await self.find_available_slots(attendees, duration)

        return slots

    async def _get_calendars(self, attendees: List[str]) -> Dict[str, Any]:
        """Get calendar data for attendees"""
        # Placeholder - would integrate with Google Calendar API
        return {}

    async def _is_slot_available(
        self,
        start: datetime,
        end: datetime,
        calendars: Dict[str, Any]
    ) -> bool:
        """Check if time slot is available"""
        # Placeholder - would check actual calendars
        # For now, assume all business hours are available
        return True

    async def _get_meeting_context(
        self,
        attendees: List[str],
        meeting_type: str
    ) -> Dict[str, Any]:
        """Get CRM context for meeting"""
        # Placeholder - would query CRM
        return {
            "company": "Acme Corp",
            "contact_name": attendees[0] if attendees else "Unknown",
            "deal_stage": "proposal",
            "meeting_type": meeting_type,
            "timezone": "America/New_York",
            "priority": "high",
            "topics": ["product demo", "pricing"],
            "previous_meetings": 2,
            "interaction_history": []
        }

    async def _get_meeting_data(self, meeting_id: str) -> Dict[str, Any]:
        """Get meeting data from database"""
        # Placeholder
        return {
            "id": meeting_id,
            "type": "demo",
            "attendees": ["john@acme.com"],
            "agenda": ["Intro", "Demo", "Q&A"],
            "notes": ""
        }

    async def _create_meeting_briefing(
        self,
        meeting_data: Dict[str, Any],
        context: Dict[str, Any]
    ) -> str:
        """Create meeting briefing document"""
        briefing = f"""
MEETING BRIEFING

Type: {meeting_data.get('type')}
Time: {meeting_data.get('scheduled_time')}
Duration: {meeting_data.get('duration_minutes')} minutes

ATTENDEES
{chr(10).join([f"- {a}" for a in meeting_data.get('attendees', [])])}

CONTEXT
Company: {context.get('company')}
Deal Stage: {context.get('deal_stage')}
Previous Meetings: {context.get('previous_meetings', 0)}

AGENDA
{chr(10).join([f"{i+1}. {item}" for i, item in enumerate(meeting_data.get('agenda', []))])}

SUCCESS CRITERIA
- Understand customer needs
- Demonstrate value
- Secure next steps
"""
        return briefing

    async def _set_meeting_reminders(self, meeting_id: str):
        """Set meeting reminders"""
        # Would integrate with calendar/notification system
        pass

    def _get_collateral(self, meeting_type: str) -> List[str]:
        """Get recommended collateral for meeting type"""
        collateral_map = {
            "discovery": ["Case studies", "Product overview"],
            "demo": ["Demo script", "Trial signup link"],
            "executive_review": ["ROI calculator", "Success metrics"],
            "training": ["Training materials", "Documentation"]
        }
        return collateral_map.get(meeting_type, [])

    def _generate_meeting_id(self) -> str:
        """Generate unique meeting ID"""
        import uuid
        return f"mtg_{uuid.uuid4().hex[:8]}"

    def _extract_number(self, text: str, default: int = 0) -> int:
        """Extract first number from text"""
        import re
        match = re.search(r'\b(\d+)\b', text)
        if match:
            return int(match.group(1))
        return default
