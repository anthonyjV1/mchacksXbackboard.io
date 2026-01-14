"""
Backboard.io integration service for AI email responses with memory.
Uses the official Backboard SDK.
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
    
    async def create_assistant(
        self, 
        name: str,
        system_prompt: str = "You are a helpful assistant that responds to customer emails professionally and courteously."
    ) -> str:
        """
        Create a new Backboard assistant. 
        DO THIS ONCE manually and store the ID in env vars.
        """
        assistant = await self.client.create_assistant(
            name=name,
            system_prompt=system_prompt
        )
        return assistant.assistant_id
    
    async def create_thread(self) -> str:
        """
        Create a new conversation thread.
        Each email thread gets ONE Backboard thread.
        """
        if not self.assistant_id:
            raise ValueError("BACKBOARD_ASSISTANT_ID not configured")
        
        thread = await self.client.create_thread(self.assistant_id)
        # FIXED: Always return as string
        return str(thread.thread_id)
    
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
        # BETTER: Just send the email body, let the assistant know it's from a customer
        message_content = f"Customer email:\n\n{body}"
        
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