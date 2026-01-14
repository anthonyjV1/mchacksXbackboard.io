"""
Action block: Reply to email with AI-generated response using Backboard.io
This maintains conversation memory across email threads.
"""
import os
import hashlib
from supabase import create_client
from dotenv import load_dotenv
from services.backboard_service import backboard_service
from blocks.condition_email_received import get_user_gmail_service
import base64
from email.mime.text import MIMEText

load_dotenv()

supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_KEY")
)

import re

def strip_memory_annotations(text: str) -> str:
    """
    Remove Backboard-style memory annotations like [Memory 1], [Memory 2], etc.
    """
    # Remove [Memory X] tags
    text = re.sub(r"\[Memory\s*\d+\]", "", text)

    # Clean up double spaces left behind
    text = re.sub(r"\s{2,}", " ", text)

    return text.strip()


def generate_conversation_key(gmail_thread_id: str, in_reply_to: str = None, sender: str = None, subject: str = None) -> str:
    """
    Generate a unique key for this email conversation.
    Priority: Gmail thread ID > In-Reply-To header > fallback hash
    """
    if gmail_thread_id:
        return f"gmail_{gmail_thread_id}"
    
    if in_reply_to:
        return f"reply_{in_reply_to}"
    
    # Fallback: hash sender + normalized subject
    normalized_subject = subject.lower().replace("re:", "").replace("fwd:", "").strip() if subject else ""
    key_string = f"{sender}_{normalized_subject}"
    hash_value = hashlib.md5(key_string.encode()).hexdigest()[:16]
    return f"hash_{hash_value}"


async def get_or_create_backboard_thread(
    conversation_key: str,
    workspace_id: str,
    user_id: str,
    sender_email: str
) -> str:
    """
    Get existing Backboard thread or create new one.
    This ensures conversation continuity.
    """
    # Check if we already have a thread for this conversation
    result = supabase.table("email_conversations")\
        .select("backboard_thread_id")\
        .eq("conversation_key", conversation_key)\
        .execute()  # CHANGED: Remove .maybe_single()
    
    # CHANGED: Check if data exists and has length
    if result.data and len(result.data) > 0:
        print(f"📝 Using existing Backboard thread: {result.data[0]['backboard_thread_id']}")
        return result.data[0]["backboard_thread_id"]
    
    # Create new thread
    print(f"🆕 Creating new Backboard thread for conversation: {conversation_key}")
    thread_id = await backboard_service.create_thread()
    
    # Store it
    supabase.table("email_conversations").insert({
        "conversation_key": conversation_key,
        "backboard_thread_id": thread_id,
        "workspace_id": workspace_id,
        "user_id": user_id,
        "sender_email": sender_email
    }).execute()
    
    return thread_id

def send_gmail_reply(user_id: str, to_email: str, subject: str, body: str, thread_id: str = None):
    """
    Send email reply via Gmail API.
    Uses the same Gmail service as the condition block.
    """
    service = get_user_gmail_service(user_id)
    
    # Create email message
    message = MIMEText(body)
    message['to'] = to_email
    message['subject'] = f"Re: {subject}" if not subject.startswith("Re:") else subject
    
    # If replying in thread, add thread ID
    raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode()
    
    send_params = {
        'userId': 'me',
        'body': {'raw': raw_message}
    }
    
    if thread_id:
        send_params['body']['threadId'] = thread_id
    
    result = service.users().messages().send(**send_params).execute()
    print(f"✅ Email sent: {result['id']}")
    return result


async def execute_reply_email(
    workspace_id: str,
    user_id: str,
    trigger_data: dict,
    config: dict
) -> dict:
    """
    Main execution function for reply-email action.
    
    Args:
        workspace_id: Workspace ID
        user_id: User ID  
        trigger_data: Data from email trigger (email_id, from, subject, etc.)
        config: Block configuration (custom instructions, etc.)
    
    Returns:
        Result dict with status and reply info
    """
    try:
        # Extract email data from trigger
        sender_email = trigger_data.get("from", "")
        subject = trigger_data.get("subject", "")
        body = trigger_data.get("body", "")
        gmail_thread_id = trigger_data.get("thread_id")
        
        print(f"📧 Processing email from {sender_email}: {subject}")
        
        # Generate conversation key
        conversation_key = generate_conversation_key(
            gmail_thread_id=gmail_thread_id,
            sender=sender_email,
            subject=subject
        )
        
        # Get or create Backboard thread
        backboard_thread_id = await get_or_create_backboard_thread(
            conversation_key=conversation_key,
            workspace_id=workspace_id,
            user_id=user_id,
            sender_email=sender_email
        )
        
        # Get AI reply from Backboard
        print(f"🤖 Getting AI response from Backboard...")
        ai_reply = await backboard_service.add_message_and_get_reply(
            thread_id=backboard_thread_id,
            sender_email=sender_email,
            subject=subject,
            body=body
        )

        ai_reply = strip_memory_annotations(ai_reply)
        
        print(f"✅ AI generated reply: {ai_reply[:100]}...")
        
        # Send the reply via Gmail
        send_gmail_reply(
            user_id=user_id,
            to_email=sender_email,
            subject=subject,
            body=ai_reply,
            thread_id=gmail_thread_id
        )
        
        return {
            "status": "success",
            "reply_sent": True,
            "to": sender_email,
            "conversation_key": conversation_key,
            "backboard_thread_id": backboard_thread_id
        }
        
    except Exception as e:
        print(f"❌ Error in reply_email action: {e}")
        import traceback
        traceback.print_exc()
        return {
            "status": "error",
            "error": str(e)
        }