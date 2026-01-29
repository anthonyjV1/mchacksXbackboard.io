"""
Action block: Reply to email with AI-generated response using Backboard.io
Updated for webhook system - cleaner and more reliable
"""
import os
import hashlib
from supabase import create_client
from dotenv import load_dotenv
from services.backboard_service import backboard_service
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
import base64
from email.mime.text import MIMEText
import re

load_dotenv()

supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_KEY")
)

def strip_memory_annotations(text: str) -> str:
    """Remove Backboard-style memory annotations like [Memory 1], [Memory 2]"""
    text = re.sub(r"\[Memory\s*\d+\]", "", text)
    text = re.sub(r"\s{2,}", " ", text)
    return text.strip()


def get_user_gmail_service(user_id: str):
    """Get Gmail service for specific user"""
    result = supabase.table("user_oauth_credentials")\
        .select("*")\
        .eq("user_id", user_id)\
        .eq("provider", "gmail")\
        .single()\
        .execute()
    
    if not result.data:
        raise Exception(f"No Gmail credentials found for user {user_id}")
    
    creds_data = result.data
    
    creds = Credentials(
        token=creds_data['access_token'],
        refresh_token=creds_data['refresh_token'],
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.getenv("GOOGLE_CLIENT_ID"),
        client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
        scopes=['https://www.googleapis.com/auth/gmail.readonly', 
                'https://www.googleapis.com/auth/gmail.send']
    )
    
    if creds.expired and creds.refresh_token:
        from google.auth.transport.requests import Request
        creds.refresh(Request())
        
        supabase.table("user_oauth_credentials").update({
            "access_token": creds.token,
            "token_expiry": creds.expiry.isoformat() if creds.expiry else None
        }).eq("user_id", user_id).eq("provider", "gmail").execute()
    
    return build('gmail', 'v1', credentials=creds)


def generate_conversation_key(gmail_thread_id: str, sender: str = None, subject: str = None) -> str:
    """
    Generate a unique key for this email conversation.
    Each unique sender gets their own Backboard thread (separate memory).
    This prevents mixing up conversations from different people.
    """
    # Use sender email as the primary key (each sender = separate conversation)
    # Gmail thread ID is NOT reliable because multiple people can be in one thread
    if sender:
        # Extract just the email address (remove name if present)
        # e.g., "John Doe <john@example.com>" -> "john@example.com"
        import re
        email_match = re.search(r'<(.+?)>|^([^\s]+@[^\s]+)$', sender)
        if email_match:
            sender_email = email_match.group(1) or email_match.group(2)
            return f"sender_{sender_email.lower()}"
    
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
        .execute()
    
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
    """
    service = get_user_gmail_service(user_id)
    
    # Create email message
    message = MIMEText(body)
    message['to'] = to_email
    message['subject'] = f"Re: {subject}" if not subject.startswith("Re:") else subject
    
    # Encode message
    raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode()
    
    send_params = {
        'userId': 'me',
        'body': {'raw': raw_message}
    }
    
    # Keep in same thread if provided
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
    
    This is called by the webhook handler when a new email arrives.
    
    Args:
        workspace_id: Workspace ID
        user_id: User ID  
        trigger_data: Data from email trigger (email_id, from, subject, body, thread_id)
        config: Block configuration (customInstructions, etc.)
    
    Returns:
        Result dict with status and reply info
    """
    try:
        # Extract email data from trigger
        sender_email = trigger_data.get("from", "")
        subject = trigger_data.get("subject", "")
        body = trigger_data.get("body", "")
        gmail_thread_id = trigger_data.get("thread_id")
        
        print(f"\n{'='*60}")
        print(f"📧 Processing email reply")
        print(f"   From: {sender_email}")
        print(f"   Subject: {subject}")
        print(f"   Thread ID: {gmail_thread_id}")
        print(f"{'='*60}\n")
        
        # Generate conversation key for memory continuity
        conversation_key = generate_conversation_key(
            gmail_thread_id=gmail_thread_id,
            sender=sender_email,
            subject=subject
        )
        
        print(f"🔑 Conversation key: {conversation_key}")
        
        # CRITICAL: Decide if we should reply to this email
        print(f"🤔 Checking if reply is needed...")
        should_reply, decision_reason = await backboard_service.should_reply_to_email(
            sender_email=sender_email,
            subject=subject,
            body=body
        )
        
        print(f"📊 Decision: {decision_reason}")
        
        if not should_reply:
            print(f"⏭️ Skipping reply - not needed for this email type")
            return {
                "status": "skipped",
                "reason": decision_reason,
                "to": sender_email
            }
        
        print(f"✅ Reply needed - proceeding with AI response")
        
        # Get or create Backboard thread (maintains conversation memory)
        backboard_thread_id = await get_or_create_backboard_thread(
            conversation_key=conversation_key,
            workspace_id=workspace_id,
            user_id=user_id,
            sender_email=sender_email
        )
        
        print(f"🧠 Backboard thread ID: {backboard_thread_id}")
        
        # Get custom instructions from config
        custom_instructions = config.get("customInstructions", "")
        
        # Build system context for AI
        system_context = ""
        if custom_instructions:
            system_context = f"IMPORTANT INSTRUCTIONS: {custom_instructions}\n\n"
        
        # Get AI reply from Backboard
        print(f"🤖 Requesting AI response from Backboard...")
        
        ai_reply = await backboard_service.add_message_and_get_reply(
            thread_id=backboard_thread_id,
            sender_email=sender_email,
            subject=subject,
            body=f"{system_context}{body}"
        )
        
        # Clean up memory annotations
        ai_reply = strip_memory_annotations(ai_reply)
        
        print(f"✅ AI generated reply ({len(ai_reply)} chars)")
        print(f"   Preview: {ai_reply[:100]}...")
        
        # Send the reply via Gmail
        print(f"📤 Sending reply via Gmail...")
        
        send_gmail_reply(
            user_id=user_id,
            to_email=sender_email,
            subject=subject,
            body=ai_reply,
            thread_id=gmail_thread_id
        )
        
        print(f"✅ Reply sent successfully!\n")
        
        return {
            "status": "success",
            "reply_sent": True,
            "to": sender_email,
            "conversation_key": conversation_key,
            "backboard_thread_id": backboard_thread_id,
            "reply_length": len(ai_reply)
        }
        
    except Exception as e:
        print(f"❌ Error in reply_email action: {e}")
        import traceback
        traceback.print_exc()
        return {
            "status": "error",
            "error": str(e)
        }