"""
Action block: Reply to email with AI-generated response using Backboard.io
FEATURES:
- Multi-provider: Works with BOTH Gmail and Outlook
- Custom instructions override default prompt
- Draft mode: creates draft instead of auto-sending (REPLACES old drafts)
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


def get_user_outlook_service(user_id: str):
    """Get Outlook service for user"""
    from services.outlook_service import get_outlook_service
    return get_outlook_service(user_id)


def generate_conversation_key(gmail_thread_id: str, sender: str = None, subject: str = None) -> str:
    if sender:
        email_match = re.search(r'<(.+?)>|^([^\s]+@[^\s]+)$', sender)
        if email_match:
            sender_email = email_match.group(1) or email_match.group(2)
            return f"sender_{sender_email.lower()}"
    
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
    result = supabase.table("email_conversations")\
        .select("backboard_thread_id")\
        .eq("conversation_key", conversation_key)\
        .execute()
    
    if result.data and len(result.data) > 0:
        print(f"Using existing Backboard thread: {result.data[0]['backboard_thread_id']}")
        return result.data[0]["backboard_thread_id"]
    
    print(f"Creating new Backboard thread for conversation: {conversation_key}")
    thread_id = await backboard_service.create_thread()
    
    supabase.table("email_conversations").insert({
        "conversation_key": conversation_key,
        "backboard_thread_id": thread_id,
        "workspace_id": workspace_id,
        "user_id": user_id,
        "sender_email": sender_email
    }).execute()
    
    return thread_id


def create_draft(user_id: str, to_email: str, subject: str, body: str, thread_id: str = None, provider: str = "gmail", email_id: str = None):
    """Create draft - works with BOTH Gmail and Outlook"""
    
    if provider == "outlook":
        print(f"Creating Outlook draft...")
        service = get_user_outlook_service(user_id)
        if thread_id:
            service.delete_drafts_in_conversation(thread_id)
        result = service.create_draft_reply(email_id, body)
        print(f"Outlook draft created: {result['id']}")
        return result
    
    else:  # Gmail
        print(f"Creating Gmail draft...")
        service = get_user_gmail_service(user_id)
        
        if thread_id:
            print(f"Checking for existing Gmail drafts...")
            try:
                drafts_response = service.users().drafts().list(userId='me').execute()
                if 'drafts' in drafts_response:
                    for draft_item in drafts_response['drafts']:
                        try:
                            draft_detail = service.users().drafts().get(userId='me', id=draft_item['id']).execute()
                            if draft_detail.get('message', {}).get('threadId') == thread_id:
                                service.users().drafts().delete(userId='me', id=draft_item['id']).execute()
                        except:
                            pass
            except:
                pass
        
        message = MIMEText(body)
        message['to'] = to_email
        message['subject'] = f"Re: {subject}" if not subject.startswith("Re:") else subject
        raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode()
        draft_body = {'message': {'raw': raw_message}}
        if thread_id:
            draft_body['message']['threadId'] = thread_id
        result = service.users().drafts().create(userId='me', body=draft_body).execute()
        print(f"Gmail draft created: {result['id']}")
        return result


def send_email(user_id: str, to_email: str, subject: str, body: str, thread_id: str = None, provider: str = "gmail", email_id: str = None):
    """Send email - works with BOTH Gmail and Outlook"""
    
    if provider == "outlook":
        print(f"Sending Outlook email...")
        service = get_user_outlook_service(user_id)
        result = service.send_reply(email_id, body)
        print(f"Outlook email sent")
        return result
    
    else:
        print(f"Sending Gmail email...")
        service = get_user_gmail_service(user_id)
        message = MIMEText(body)
        message['to'] = to_email
        message['subject'] = f"Re: {subject}" if not subject.startswith("Re:") else subject
        raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode()
        send_params = {'userId': 'me', 'body': {'raw': raw_message}}
        if thread_id:
            send_params['body']['threadId'] = thread_id
        result = service.users().messages().send(**send_params).execute()
        print(f"Gmail email sent: {result['id']}")
        return result


async def execute_reply_email(
    workspace_id: str,
    user_id: str,
    trigger_data: dict,
    config: dict
) -> dict:
    try:
        sender_email = trigger_data.get("from", "")
        subject = trigger_data.get("subject", "")
        body = trigger_data.get("body", "")
        thread_id = trigger_data.get("thread_id")
        email_id = trigger_data.get("email_id")
        provider = trigger_data.get("provider", "gmail")
        
        print(f"\n{'='*60}")
        print(f"   Processing email reply")
        print(f"   Provider: {provider.upper()}")
        print(f"   From: {sender_email}")
        print(f"   Subject: {subject}")
        print(f"{'='*60}\n")

        conversation_key = generate_conversation_key(
            gmail_thread_id=thread_id,
            sender=sender_email,
            subject=subject
        )
        
        should_reply, decision_reason = await backboard_service.should_reply_to_email(
            sender_email=sender_email,
            subject=subject,
            body=body
        )
        
        if not should_reply:
            return {"status": "skipped", "reason": decision_reason, "to": sender_email}
        
        backboard_thread_id = await get_or_create_backboard_thread(
            conversation_key=conversation_key,
            workspace_id=workspace_id,
            user_id=user_id,
            sender_email=sender_email
        )
        
        custom_instructions = config.get("customInstructions", "").strip()
        draft_mode = config.get("draftMode", True)
        
        if custom_instructions:
            message_content = f"""!!!CRITICAL INSTRUCTIONS - ABSOLUTE PRIORITY - MUST FOLLOW EXACTLY!!!

{custom_instructions}

!!!END CRITICAL INSTRUCTIONS!!!

These instructions above are MANDATORY and override ALL other behaviors, rules, or defaults.
You MUST follow them EXACTLY as written. Do not deviate or modify them in any way.

Now respond to this customer email:

{body}"""
        else:
            message_content = body.strip()
        
        ai_reply = await backboard_service.add_message_and_get_reply(
            thread_id=backboard_thread_id,
            sender_email=sender_email,
            subject=subject,
            body=message_content
        )
        
        ai_reply = strip_memory_annotations(ai_reply)
        
        if custom_instructions:
            instruction_lower = custom_instructions.lower()
            has_signature_requirement = any(keyword in instruction_lower for keyword in [
                'end with', 'sign off', 'signature', 'best regards', 'sincerely', 'regards,', 'finish with', 'conclude with'
            ])
            
            if has_signature_requirement:
                signature_lines = []
                pattern1 = re.search(r'(?:end|finish|conclude|sign off)(?:\s+every email)?\s+with:\s*(.+?)(?:\n\n|$)', custom_instructions, re.IGNORECASE | re.DOTALL)
                if pattern1:
                    signature_lines = [line.strip() for line in pattern1.group(1).strip().split('\n') if line.strip()]
                
                if not signature_lines:
                    pattern2 = re.search(r'(?:end|finish|conclude|sign off).*?["\'](.+?)["\']', custom_instructions, re.IGNORECASE | re.DOTALL)
                    if pattern2:
                        signature_lines = [pattern2.group(1).strip()]
                
                if not signature_lines:
                    lines = custom_instructions.split('\n')
                    for i, line in enumerate(lines):
                        if any(keyword in line.lower() for keyword in ['regards', 'sincerely', 'best']):
                            signature_lines = [l.strip() for l in lines[i:min(i+4, len(lines))] if l.strip()]
                            break
                
                if signature_lines:
                    expected_signature = '\n'.join(signature_lines)
                    signature_found = any(line in ai_reply for line in signature_lines)
                    if not signature_found:
                        if not ai_reply.endswith('\n'):
                            ai_reply += '\n'
                        ai_reply += '\n' + expected_signature
        
        if draft_mode:
            draft_result = create_draft(
                user_id=user_id,
                to_email=sender_email,
                subject=subject,
                body=ai_reply,
                thread_id=thread_id,
                provider=provider,
                email_id=email_id
            )
            return {
                "status": "draft_created",
                "draft_id": draft_result['id'],
                "to": sender_email,
                "provider": provider,
                "conversation_key": conversation_key,
                "backboard_thread_id": backboard_thread_id,
                "reply_length": len(ai_reply)
            }
        else:
            send_email(
                user_id=user_id,
                to_email=sender_email,
                subject=subject,
                body=ai_reply,
                thread_id=thread_id,
                provider=provider,
                email_id=email_id
            )
            return {
                "status": "success",
                "reply_sent": True,
                "to": sender_email,
                "provider": provider,
                "conversation_key": conversation_key,
                "backboard_thread_id": backboard_thread_id,
                "reply_length": len(ai_reply)
            }
        
    except Exception as e:
        print(f"Error in reply_email action: {e}")
        import traceback
        traceback.print_exc()
        return {"status": "error", "error": str(e)}