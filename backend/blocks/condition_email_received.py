"""
Condition block: Email received
Polls Gmail and triggers workflow when matching email arrives.
NOW ALSO EXECUTES SUBSEQUENT BLOCKS (like reply-email).
"""
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
        scopes=['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send']
    )
    
    if creds.expired and creds.refresh_token:
        from google.auth.transport.requests import Request
        creds.refresh(Request())
        
        supabase.table("user_oauth_credentials").update({
            "access_token": creds.token,
            "token_expiry": creds.expiry.isoformat() if creds.expiry else None
        }).eq("user_id", user_id).eq("provider", "gmail").execute()
    
    return build('gmail', 'v1', credentials=creds)


def check_for_emails(workspace_id: str, user_id: str, execution_id: str):
    """Poll Gmail for new emails matching conditions"""
    
    # 1. Get block config
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
    
    # 3. Get Gmail service
    try:
        service = get_user_gmail_service(user_id)
    except Exception as e:
        print(f"❌ Failed to get Gmail service: {e}")
        return
    
    # 4. Build query
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
    
    # 6. Check for new emails
    new_emails = []
    for msg in messages:
        if last_checked_id and msg['id'] == last_checked_id:
            break
        new_emails.append(msg)
    
    if new_emails:
        print(f"✅ Found {len(new_emails)} new emails for workspace {workspace_id}")
        
        # Get full email details
        email = service.users().messages().get(
            userId='me',
            id=new_emails[0]['id'],
            format='full'
        ).execute()
        
        # Extract email data
        headers = email['payload']['headers']
        subject = next((h['value'] for h in headers if h['name'].lower() == 'subject'), '')
        from_email = next((h['value'] for h in headers if h['name'].lower() == 'from'), '')
        
        # Get email body
        body = ""
        if 'parts' in email['payload']:
            for part in email['payload']['parts']:
                if part['mimeType'] == 'text/plain':
                    import base64
                    body = base64.urlsafe_b64decode(part['body']['data']).decode('utf-8')
                    break
        elif 'body' in email['payload'] and 'data' in email['payload']['body']:
            import base64
            body = base64.urlsafe_b64decode(email['payload']['body']['data']).decode('utf-8')
        
        trigger_data = {
            "email_id": email['id'],
            "thread_id": email['threadId'],
            "subject": subject,
            "from": from_email,
            "body": body
        }
        
        # Update execution
        supabase.table("workflow_executions").update({
            "status": "running",
            "trigger_data": trigger_data,
            "current_block_index": 1
        }).eq("id", execution_id).execute()
        
        # Update last checked
        supabase.table("email_check_state").upsert({
            "workspace_id": workspace_id,
            "user_id": user_id,
            "last_checked_email_id": new_emails[0]['id']
        }).execute()
        
        # NOW EXECUTE NEXT BLOCKS
        execute_workflow_blocks(workspace_id, user_id, execution_id, trigger_data)
        
        print(f"🚀 Workflow {execution_id} triggered and executed!")
    else:
        print(f"⏳ No new emails for workspace {workspace_id}")


def execute_workflow_blocks(workspace_id: str, user_id: str, execution_id: str, trigger_data: dict):
    """
    Execute all blocks in the workflow after email trigger.
    This is where we call action blocks like reply-email.
    """
    import asyncio
    from blocks.action_reply_email import execute_reply_email
    
    # Get all blocks for this workspace
    blocks_result = supabase.table("pipeline_blocks")\
        .select("*")\
        .eq("workspace_id", workspace_id)\
        .order("position")\
        .execute()
    
    blocks = blocks_result.data
    print(f"📋 Executing {len(blocks)} blocks in workflow")
    
    # Skip the first block (email-received condition)
    action_blocks = [b for b in blocks if b['type'] != 'condition-email-received']
    
    print(f"🎯 Found {len(action_blocks)} action blocks to execute")
    for block in action_blocks:
        print(f"   - {block['title']} ({block['type']})")
    
    for block in action_blocks:
        block_type = block['type']
        print(f"\n{'='*60}")
        print(f"▶️ Executing block: {block['title']} ({block_type})")
        print(f"   Block ID: {block['block_id']}")
        print(f"{'='*60}\n")
        
        if block_type == 'action-reply-email':
            try:
                # Get block config
                print(f"📝 Fetching config for block {block['block_id']}...")
                config_result = supabase.table("block_configs")\
                    .select("config")\
                    .eq("workspace_id", workspace_id)\
                    .eq("block_id", block['block_id'])\
                    .execute()
                
                print(f"📊 Config result: {config_result.data}")
                
                config = config_result.data[0]['config'] if (config_result.data and len(config_result.data) > 0) else {}
                print(f"⚙️ Using config: {config}")
                
                # Execute reply action (async)
                print(f"🚀 Calling execute_reply_email...")
                print(f"   workspace_id: {workspace_id}")
                print(f"   user_id: {user_id}")
                print(f"   trigger_data: {trigger_data}")
                
                result = asyncio.run(execute_reply_email(
                    workspace_id=workspace_id,
                    user_id=user_id,
                    trigger_data=trigger_data,
                    config=config
                ))
                
                print(f"✅ Block executed with result: {result}")
                
                if result.get('status') == 'error':
                    print(f"❌ BLOCK FAILED: {result.get('error')}")
                else:
                    print(f"✅ BLOCK SUCCESS!")
                    
            except Exception as e:
                print(f"❌ EXCEPTION executing reply-email block: {e}")
                import traceback
                traceback.print_exc()
        
        else:
            print(f"⚠️ Unknown block type: {block_type} - skipping")
    
    # FIXED: Set back to "waiting" to continue polling for more emails
    supabase.table("workflow_executions").update({
        "status": "waiting"
    }).eq("id", execution_id).execute()
    
    print(f"\n🎉 Workflow {execution_id} processed email! Continuing to monitor...\n")