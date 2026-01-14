"""
ONE-TIME SETUP SCRIPT
Run this once to create your Backboard assistant.
Then add the assistant_id to your .env file.
"""
import asyncio
from services.backboard_service import BackboardService

async def setup_assistant():
    service = BackboardService()
    
    print("Creating Backboard assistant...")
    print("This will create an AI assistant for handling email responses.\n")
    
    assistant_id = await service.create_assistant(
        name="Email AI Assistant",
        llm_provider="anthropic",  # Using Claude
        llm_model_name="claude-sonnet-4-20250514"  # Sonnet 4
    )
    
    print(f"\n✅ Assistant created successfully!")
    print(f"\n📋 Add this to your .env file:")
    print(f"BACKBOARD_ASSISTANT_ID={assistant_id}")
    print(f"\n💡 You only need to do this once.")
    print(f"\nNext steps:")
    print(f"1. Add the BACKBOARD_ASSISTANT_ID to your .env file")
    print(f"2. Restart your backend server")
    print(f"3. Test the email reply workflow!")

if __name__ == "__main__":
    asyncio.run(setup_assistant())