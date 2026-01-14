# test_backboard.py
import asyncio
import os
from dotenv import load_dotenv
from services.backboard_service import backboard_service

load_dotenv()

async def test_backboard():
    print("🧪 Testing Backboard API...")
    print(f"Assistant ID: {backboard_service.assistant_id}")
    print(f"API Key: {backboard_service.api_key[:10]}...")
    
    try:
        # Test 1: Create a new thread
        print("\n1️⃣ Creating new thread...")
        thread_id = await backboard_service.create_thread()
        print(f"✅ Thread created: {thread_id}")
        
        # Test 2: Send a message
        print("\n2️⃣ Sending test message...")
        reply = await backboard_service.add_message_and_get_reply(
            thread_id=thread_id,
            sender_email="test@example.com",
            subject="Test Email",
            body="This is a test message. Please reply with 'Hello!'"
        )
        print(f"✅ Got reply: {reply}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_backboard())