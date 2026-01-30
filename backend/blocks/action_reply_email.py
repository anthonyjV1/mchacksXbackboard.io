"""
Action block: Reply to email with AI-generated response using Backboard.io
FEATURES:
- Custom instructions override default prompt
- Draft mode: creates Gmail draft instead of auto-sending
- Smart reply decision (filters automated emails)
- Per-sender conversation memory
"""
import os
import hashlib
import re
from supabase import create_client
from dotenv import load_dotenv
from services.backboard_service import backboard_service
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
import base64
from email.mime.text import MIMEText

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
                'https://www.googleapis.com/auth/gmail.send',
                'https://www.googleapis.com/auth/gmail.modify']
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
    """
    # Use sender email as the primary key (each sender = separate conversation)
    if sender:
        # Extract just the email address (remove name if present)
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
    """Get existing Backboard thread or create new one for conversation continuity"""
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


def create_gmail_draft(user_id: str, to_email: str, subject: str, body: str, thread_id: str = None):
    """Create draft, replacing any existing drafts in this thread"""
    service = get_user_gmail_service(user_id)
    
    # FIRST: Delete existing drafts in this thread
    if thread_id:
        print(f"🗑️ Checking for existing drafts in thread {thread_id}...")
        
        try:
            # List all drafts
            drafts = service.users().drafts().list(userId='me').execute()
            
            # Find drafts in this thread
            if 'drafts' in drafts:
                for draft in drafts['drafts']:
                    draft_detail = service.users().drafts().get(
                        userId='me',
                        id=draft['id']
                    ).execute()
                    
                    draft_thread_id = draft_detail.get('message', {}).get('threadId')
                    
                    if draft_thread_id == thread_id:
                        print(f"🗑️ Deleting old draft: {draft['id']}")
                        service.users().drafts().delete(
                            userId='me',
                            id=draft['id']
                        ).execute()
        except Exception as e:
            print(f"⚠️ Could not delete old drafts: {e}")
    
    # NOW: Create the new draft
    message = MIMEText(body)
    message['to'] = to_email
    message['subject'] = f"Re: {subject}" if not subject.startswith("Re:") else subject
    
    raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode()
    
    draft_body = {
        'message': {
            'raw': raw_message
        }
    }
    
    if thread_id:
        draft_body['message']['threadId'] = thread_id
    
    result = service.users().drafts().create(
        userId='me',
        body=draft_body
    ).execute()
    
    print(f"📝 New draft created: {result['id']}")
    return result


def send_gmail_reply(user_id: str, to_email: str, subject: str, body: str, thread_id: str = None):
    """Send email reply via Gmail API immediately"""
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
    
    Features:
    - Checks if reply is needed (filters automated emails)
    - Uses custom instructions with priority over defaults
    - Creates draft OR sends automatically based on config
    - Maintains per-sender conversation memory
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
        print(f"{'='*60}\n")
        
        # Generate conversation key for memory continuity (per sender)
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
        custom_instructions = config.get("customInstructions", "").strip()
        draft_mode = config.get("draftMode", True)  # Default to draft mode (safer)
        
        # Build message content for AI
        # PRIORITY: Custom instructions override default behavior
        if custom_instructions:
            print(f"⚙️ Using custom instructions (priority override)")
            # Prepend custom instructions to give them priority
            message_content = f"""IMPORTANT INSTRUCTIONS (HIGHEST PRIORITY):
{custom_instructions}

Customer email:
{body}"""
        else:
            print(f"📝 Using default AI behavior")
            # Just send the email body
            message_content = body.strip()
        
        # Get AI reply from Backboard
        print(f"🤖 Requesting AI response from Backboard...")
        
        ai_reply = await backboard_service.add_message_and_get_reply(
            thread_id=backboard_thread_id,
            sender_email=sender_email,
            subject=subject,
            body=message_content
        )
        
        # Clean up memory annotations
        ai_reply = strip_memory_annotations(ai_reply)
        
        print(f"✅ AI generated reply ({len(ai_reply)} chars)")
        print(f"   Preview: {ai_reply[:100]}...")
        
        # DRAFT MODE or AUTO-SEND based on config
        if draft_mode:
            print(f"📝 Draft mode enabled - creating draft (safer)")
            
            # Create draft instead of sending
            draft_result = create_gmail_draft(
                user_id=user_id,
                to_email=sender_email,
                subject=subject,
                body=ai_reply,
                thread_id=gmail_thread_id
            )
            
            print(f"✅ Draft created successfully! User can review and send.\n")
            
            return {
                "status": "draft_created",
                "draft_id": draft_result['id'],
                "to": sender_email,
                "conversation_key": conversation_key,
                "backboard_thread_id": backboard_thread_id,
                "reply_length": len(ai_reply)
            }
        else:
            print(f"📤 Auto-send mode enabled - sending immediately")
            
            # Send the reply via Gmail immediately
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