"""
Action block: Reply to email with AI-generated response using Backboard.io
FEATURES:
- Custom instructions override default prompt
- Draft mode: creates Gmail draft instead of auto-sending (REPLACES old drafts)
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
    text = re.sub(r"\[Memory\s*\d+\]", "", text)
    text = re.sub(r"\s{2,}", " ", text)
    return text.strip()


def get_user_gmail_service(user_id: str):
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
    # Check if we already have a thread for this conversation
    result = supabase.table("email_conversations")\
        .select("backboard_thread_id")\
        .eq("conversation_key", conversation_key)\
        .execute()
    
    if result.data and len(result.data) > 0:
        print(f"Using existing Backboard thread: {result.data[0]['backboard_thread_id']}")
        return result.data[0]["backboard_thread_id"]
    
    # Create new thread
    print(f"Creating new Backboard thread for conversation: {conversation_key}")
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
    service = get_user_gmail_service(user_id)
    
    # CRITICAL: Delete any existing drafts in this thread first
    if thread_id:
        print(f"Checking for existing drafts in thread {thread_id}...")
        
        try:
            # Get all drafts
            drafts_response = service.users().drafts().list(userId='me').execute()
            
            if 'drafts' in drafts_response:
                deleted_count = 0
                for draft_item in drafts_response['drafts']:
                    try:
                        # Get full draft details
                        draft_detail = service.users().drafts().get(
                            userId='me',
                            id=draft_item['id']
                        ).execute()
                        
                        # Check if this draft is in our thread
                        draft_thread_id = draft_detail.get('message', {}).get('threadId')
                        
                        if draft_thread_id == thread_id:
                            print(f"🗑️  Deleting old draft {draft_item['id']} (will replace with new one)")
                            
                            service.users().drafts().delete(
                                userId='me',
                                id=draft_item['id']
                            ).execute()
                            
                            deleted_count += 1
                    
                    except Exception as e:
                        print(f"Could not process draft {draft_item['id']}: {e}")
                        continue
                
                if deleted_count > 0:
                    print(f"Deleted {deleted_count} old draft(s) from this thread")
                else:
                    print(f"No existing drafts found in this thread")
        
        except Exception as e:
            print(f"   Could not list/delete old drafts: {e}")
            print(f"   Continuing to create new draft anyway...")
    
    # NOW: Create the new draft
    message = MIMEText(body)
    message['to'] = to_email
    message['subject'] = f"Re: {subject}" if not subject.startswith("Re:") else subject
    
    # Encode message
    raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode()
    
    draft_body = {
        'message': {
            'raw': raw_message
        }
    }
    
    # Add thread ID if replying in thread
    if thread_id:
        draft_body['message']['threadId'] = thread_id
    
    result = service.users().drafts().create(
        userId='me',
        body=draft_body
    ).execute()
    
    print(f"New draft created: {result['id']}")
    if thread_id:
        print(f"   This is now the ONLY draft in thread {thread_id}")
    return result


def send_gmail_reply(user_id: str, to_email: str, subject: str, body: str, thread_id: str = None):
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
    print(f"Email sent: {result['id']}")
    return result


async def execute_reply_email(
    workspace_id: str,
    user_id: str,
    trigger_data: dict,
    config: dict
) -> dict:
    try:
        # Extract email data from trigger
        sender_email = trigger_data.get("from", "")
        subject = trigger_data.get("subject", "")
        body = trigger_data.get("body", "")
        gmail_thread_id = trigger_data.get("thread_id")

        # Generate conversation key for memory continuity (per sender)
        conversation_key = generate_conversation_key(
            gmail_thread_id=gmail_thread_id,
            sender=sender_email,
            subject=subject
        )
        
        # CRITICAL: Decide if we should reply to this email
        should_reply, decision_reason = await backboard_service.should_reply_to_email(
            sender_email=sender_email,
            subject=subject,
            body=body
        )
        
        print(f"Decision: {decision_reason}")
        
        if not should_reply:
            print(f"Skipping reply - not needed for this email type")
            return {
                "status": "skipped",
                "reason": decision_reason,
                "to": sender_email
            }
        
        print(f"Reply needed - proceeding with AI response")
        
        # Get or create Backboard thread (maintains conversation memory)
        backboard_thread_id = await get_or_create_backboard_thread(
            conversation_key=conversation_key,
            workspace_id=workspace_id,
            user_id=user_id,
            sender_email=sender_email
        )
        
        print(f"Backboard thread ID: {backboard_thread_id}")
        
        # Get custom instructions from config
        custom_instructions = config.get("customInstructions", "").strip()
        draft_mode = config.get("draftMode", True)  # Default to draft mode (safer)
        
        # Build message content for AI
        # CRITICAL: Custom instructions MUST override ALL default behavior
        if custom_instructions:
            print(f"Using custom instructions (HIGHEST PRIORITY - overrides ALL defaults)")
            
            # Format with MAXIMUM EMPHASIS so AI CANNOT ignore it
            message_content = f"""!!!CRITICAL INSTRUCTIONS - ABSOLUTE PRIORITY - MUST FOLLOW EXACTLY!!!

{custom_instructions}

!!!END CRITICAL INSTRUCTIONS!!!

These instructions above are MANDATORY and override ALL other behaviors, rules, or defaults.
You MUST follow them EXACTLY as written. Do not deviate or modify them in any way.

Now respond to this customer email:

{body}"""
        else:
            print(f"Using default AI behavior")
            # Just send the email body
            message_content = body.strip()
        
        
        ai_reply = await backboard_service.add_message_and_get_reply(
            thread_id=backboard_thread_id,
            sender_email=sender_email,
            subject=subject,
            body=message_content
        )
        
        # Clean up memory annotations
        ai_reply = strip_memory_annotations(ai_reply)
        
        # GUARANTEE CUSTOM INSTRUCTIONS ARE FOLLOWED
        # If custom instructions exist, check if AI followed them
        if custom_instructions:
            print(f"Verifying custom instructions were followed...")
            
            # Check for signature/sign-off requirements
            instruction_lower = custom_instructions.lower()
            has_signature_requirement = any(keyword in instruction_lower for keyword in [
                'end with', 
                'sign off', 
                'signature', 
                'best regards',
                'sincerely',
                'regards,',
                'finish with',
                'conclude with'
            ])
            
            if has_signature_requirement:
                print(f"Custom instructions require signature/sign-off")
                
                # Try to extract the exact signature text from instructions
                signature_lines = []
                
                # Look for patterns like "end with:" or "sign off with:"
                import re
                
                # Pattern 1: "end with: [signature text]"
                pattern1 = re.search(r'(?:end|finish|conclude|sign off)(?:\s+every email)?\s+with:\s*(.+?)(?:\n\n|$)', custom_instructions, re.IGNORECASE | re.DOTALL)
                if pattern1:
                    signature_lines = [line.strip() for line in pattern1.group(1).strip().split('\n') if line.strip()]
                
                # Pattern 2: Look for quoted text after these keywords
                if not signature_lines:
                    pattern2 = re.search(r'(?:end|finish|conclude|sign off).*?["\'](.+?)["\']', custom_instructions, re.IGNORECASE | re.DOTALL)
                    if pattern2:
                        signature_lines = [pattern2.group(1).strip()]
                
                # Pattern 3: Look for lines that look like signatures (contain "regards" or names)
                if not signature_lines:
                    lines = custom_instructions.split('\n')
                    for i, line in enumerate(lines):
                        if any(keyword in line.lower() for keyword in ['regards', 'sincerely', 'best']):
                            # Take this line and a few lines after
                            signature_lines = [l.strip() for l in lines[i:min(i+4, len(lines))] if l.strip()]
                            break
                
                if signature_lines:
                    expected_signature = '\n'.join(signature_lines)
                    print(f"Extracted expected signature:\n{expected_signature}")
                    
                    # Check if AI included the signature (fuzzy match - allow for minor variations)
                    signature_found = False
                    for line in signature_lines:
                        if line in ai_reply:
                            signature_found = True
                            break
                    
                    if not signature_found:
                        print(f"AI FORGOT SIGNATURE! Force-appending it...")
                        # Ensure proper spacing and append
                        if not ai_reply.endswith('\n'):
                            ai_reply += '\n'
                        ai_reply += '\n' + expected_signature
                        print(f"Signature appended successfully")
                    else:
                        print(f"AI correctly included signature")
                else:
                    print(f"Could not extract exact signature text from instructions")
        
        print(f"   AI generated reply ({len(ai_reply)} chars)")
        print(f"   Preview: {ai_reply[:100]}...")
        
        # DRAFT MODE or AUTO-SEND based on config
        if draft_mode:
            print(f"Draft mode enabled - creating draft (safer)")
            
            # Create draft instead of sending (REPLACES old drafts automatically)
            draft_result = create_gmail_draft(
                user_id=user_id,
                to_email=sender_email,
                subject=subject,
                body=ai_reply,
                thread_id=gmail_thread_id
            )
            
            print(f"Draft created successfully! User can review and send.\n")
            
            return {
                "status": "draft_created",
                "draft_id": draft_result['id'],
                "to": sender_email,
                "conversation_key": conversation_key,
                "backboard_thread_id": backboard_thread_id,
                "reply_length": len(ai_reply)
            }
        else:
            print(f"Auto-send mode enabled - sending immediately")
            
            # Send the reply via Gmail immediately
            send_gmail_reply(
                user_id=user_id,
                to_email=sender_email,
                subject=subject,
                body=ai_reply,
                thread_id=gmail_thread_id
            )
            
            print(f"Reply sent successfully!\n")
            
            return {
                "status": "success",
                "reply_sent": True,
                "to": sender_email,
                "conversation_key": conversation_key,
                "backboard_thread_id": backboard_thread_id,
                "reply_length": len(ai_reply)
            }
        
    except Exception as e:
        print(f"Error in reply_email action: {e}")
        import traceback
        traceback.print_exc()
        return {
            "status": "error",
            "error": str(e)
        }