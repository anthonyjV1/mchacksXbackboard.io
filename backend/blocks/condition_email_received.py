#backend/blocks/condition_email_received.py
import os
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_KEY")
)

def get_user_gmail_service(user_id: str):
    """Get Gmail service for specific user"""
    # Fetch user's OAuth credentials
    result = supabase.table("user_oauth_credentials")\
        .select("*")\
        .eq("user_id", user_id)\
        .eq("provider", "gmail")\
        .single()\
        .execute()
    
    if not result.data:
        raise Exception(f"No Gmail credentials found for user {user_id}")
    
    creds_data = result.data
    
    # Create credentials object
    creds = Credentials(
        token=creds_data['access_token'],
        refresh_token=creds_data['refresh_token'],
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.getenv("GOOGLE_CLIENT_ID"),
        client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
        scopes=['https://www.googleapis.com/auth/gmail.readonly']
    )
    
    # Refresh if expired
    if creds.expired and creds.refresh_token:
        from google.auth.transport.requests import Request
        creds.refresh(Request())
        
        # Update stored token
        supabase.table("user_oauth_credentials").update({
            "access_token": creds.token,
            "token_expiry": creds.expiry.isoformat() if creds.expiry else None
        }).eq("user_id", user_id).eq("provider", "gmail").execute()
    
    return build('gmail', 'v1', credentials=creds)

def check_for_emails(workspace_id: str, user_id: str, execution_id: str):
    """Poll Gmail for new emails matching conditions"""
    
    # 1. Get block config (email filters)
    config_result = supabase.table("block_configs")\
        .select("config")\
        .eq("workspace_id", workspace_id)\
        .execute()
    
    if not config_result.data:
        print(f"No config found for workspace {workspace_id}")
        return
    
    config = config_result.data[0]["config"]
    sender_email = config.get("senderEmail", "")
    subject_contains = config.get("subjectContains", "")
    
    # 2. Get last checked email ID
    state_result = supabase.table("email_check_state")\
        .select("last_checked_email_id")\
        .eq("workspace_id", workspace_id)\
        .execute()
    
    last_checked_id = state_result.data[0]["last_checked_email_id"] if state_result.data else None
    
    # Get user's Gmail service
    try:
        service = get_user_gmail_service(user_id)
    except Exception as e:
        print(f"❌ Failed to get Gmail service: {e}")
        return
    
    # 4. Build Gmail query
    query = []
    if sender_email:
        query.append(f"from:{sender_email}")
    if subject_contains:
        query.append(f"subject:{subject_contains}")
    
    query_string = " ".join(query) if query else "is:unread"
    
    # 5. Search for emails
    results = service.users().messages().list(
        userId='me',
        q=query_string,
        maxResults=10
    ).execute()
    
    messages = results.get('messages', [])
    
    # 6. Check if we found NEW emails (after last_checked_id)
    new_emails = []
    for msg in messages:
        if last_checked_id and msg['id'] == last_checked_id:
            break  # We've reached emails we already saw
        new_emails.append(msg)
    
    if new_emails:
        # EMAIL FOUND! Trigger workflow continuation
        print(f"✅ Found {len(new_emails)} new emails for workspace {workspace_id}")
        
        # Get full email details
        email = service.users().messages().get(
            userId='me',
            id=new_emails[0]['id']
        ).execute()
        
        # Update execution status
        supabase.table("workflow_executions").update({
            "status": "running",
            "trigger_data": {
                "email_id": email['id'],
                "subject": next((h['value'] for h in email['payload']['headers'] if h['name'] == 'Subject'), ''),
                "from": next((h['value'] for h in email['payload']['headers'] if h['name'] == 'From'), ''),
            },
            "current_block_index": 1  # Move to next block
        }).eq("id", execution_id).execute()
        
        # Update last checked
        supabase.table("email_check_state").upsert({
            "workspace_id": workspace_id,
            "user_id": user_id,
            "last_checked_email_id": new_emails[0]['id']
        }).execute()
        
        # TODO: Execute next blocks in pipeline
        print(f"🚀 Workflow {execution_id} triggered!")
    else:
        print(f"⏳ No new emails for workspace {workspace_id}")