"""
Backboard.io integration service for AI email responses with memory.
NOW WITH: Smart reply decision - AI decides if response is needed.
"""
import os
from backboard import BackboardClient
from dotenv import load_dotenv

load_dotenv()

BACKBOARD_API_KEY = os.getenv("BACKBOARD_API_KEY")

class BackboardService:
    """Service for interacting with Backboard.io API"""
    
    def __init__(self):
        self.api_key = BACKBOARD_API_KEY
        self.assistant_id = os.getenv("BACKBOARD_ASSISTANT_ID")
        
        if not self.api_key:
            raise ValueError("BACKBOARD_API_KEY not found in environment")
        
        # Initialize the official SDK client
        self.client = BackboardClient(api_key=self.api_key)
    
    async def create_thread(self) -> str:
        """
        Create a new conversation thread.
        Each email thread gets ONE Backboard thread.
        """
        if not self.assistant_id:
            raise ValueError("BACKBOARD_ASSISTANT_ID not configured")
        
        thread = await self.client.create_thread(self.assistant_id)
        return str(thread.thread_id)
    
    async def should_reply_to_email(
        self,
        sender_email: str,
        subject: str,
        body: str
    ) -> tuple[bool, str]:
        """
        Decide if this email warrants a response.
        
        Returns:
            (should_reply: bool, reason: str)
        """
        # Create a temporary thread just for this decision
        temp_thread = await self.create_thread()
        
        decision_prompt = f"""You are an email assistant deciding if an email needs a response.

Analyze this email and decide: Should I reply?

From: {sender_email}
Subject: {subject}
Body: {body}

ONLY reply YES if:
- It's a direct question to me
- It requires action or acknowledgment from me
- It's a conversation I'm actively having with this person

DO NOT reply (say NO) if:
- It's automated (newsletters, notifications, receipts, login links, confirmations)
- It's from a no-reply address
- It's clearly not meant for me (forwarded emails, CC'd, system emails)
- It's just FYI/informational
- It's a marketing/promotional email
- It's a login link, password reset, verification code

Respond with ONLY:
YES - [brief reason]
or
NO - [brief reason]

Examples:
- "Sign in to Backboard.io" → NO - automated login link
- "Click here to verify" → NO - automated verification
- "Hey, can you send me that report?" → YES - direct request
- "Thanks for your help!" → YES - acknowledges assistance, brief reply appropriate
- "Newsletter: Top 10 tips" → NO - marketing email"""

        response = await self.client.add_message(
            thread_id=temp_thread,
            content=decision_prompt,
            memory="Off",  # No memory needed for this decision
            stream=False
        )
        
        decision = response.content.strip()
        
        # Parse the response
        if decision.upper().startswith("YES"):
            return (True, decision)
        else:
            return (False, decision)
    
    async def add_message_and_get_reply(
        self, 
        thread_id: str, 
        sender_email: str,
        subject: str,
        body: str
    ) -> str:
        """
        Add user's email to the thread and get AI reply.
        """
        # Just send the body - keep it natural
        message_content = body.strip()
        
        # Use the official SDK
        response = await self.client.add_message(
            thread_id=thread_id,
            content=message_content,
            memory="Auto",
            stream=False
        )
        
        return response.content


# Singleton instance
backboard_service = BackboardService()