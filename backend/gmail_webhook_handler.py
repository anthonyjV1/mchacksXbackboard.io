"""
Gmail Webhook Handler - Production-Ready Email Monitoring
FIXED: Automatic token refresh handling
"""
import os
import base64
import json
from datetime import datetime, timedelta
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from google.cloud import pubsub_v1
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_KEY")
)

# Google Cloud Pub/Sub configuration
PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT_ID")
TOPIC_NAME = os.getenv("GMAIL_PUBSUB_TOPIC", "gmail-notifications")


def get_user_gmail_service(user_id: str, force_refresh: bool = False):
    result = supabase.table("user_oauth_credentials")\
        .select("*")\
        .eq("user_id", user_id)\
        .eq("provider", "gmail")\
        .single()\
        .execute()
    
    if not result.data:
        raise Exception(f"No Gmail credentials found for user {user_id}. Please reconnect Gmail.")
    
    creds_data = result.data
    
    # Check if refresh token exists
    if not creds_data.get('refresh_token'):
        raise Exception(f"No refresh token found for user {user_id}. User needs to re-authenticate with Gmail.")
    
    creds = Credentials(
        token=creds_data['access_token'],
        refresh_token=creds_data['refresh_token'],
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.getenv("GOOGLE_CLIENT_ID"),
        client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
        scopes=[
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/gmail.send',
            'https://www.googleapis.com/auth/gmail.modify'
        ]
    )
    
    # Check if token is expired or force refresh
    token_expired = False
    if creds_data.get('token_expiry'):
        try:
            expiry = datetime.fromisoformat(creds_data['token_expiry'].replace('Z', '+00:00'))
            token_expired = datetime.now(expiry.tzinfo) >= expiry
        except:
            token_expired = True
    
    if force_refresh or token_expired or creds.expired:
        print(f"🔄 Refreshing expired token for user {user_id}...")
        try:
            creds.refresh(Request())
            
            # Update stored token
            supabase.table("user_oauth_credentials").update({
                "access_token": creds.token,
                "token_expiry": creds.expiry.isoformat() if creds.expiry else None
            }).eq("user_id", user_id).eq("provider", "gmail").execute()
            
            print(f"Token refreshed successfully for user {user_id}")
        except Exception as refresh_error:
            print(f"Token refresh failed: {refresh_error}")
            raise Exception(
                f"Failed to refresh Gmail token for user {user_id}. "
                f"User needs to reconnect their Gmail account. "
                f"Error: {str(refresh_error)}"
            )
    
    return build('gmail', 'v1', credentials=creds)


def setup_gmail_watch(user_id: str, workspace_id: str):
    try:
        # First, try to get the service (this will refresh token if needed)
        print(f"Setting up Gmail watch for user {user_id}...")
        
        try:
            service = get_user_gmail_service(user_id, force_refresh=True)
        except Exception as token_error:
            # If token refresh fails, provide clear error message
            error_msg = str(token_error)
            if "invalid_grant" in error_msg or "Token has been expired or revoked" in error_msg:
                raise Exception(
                    "Gmail authentication has expired. Please reconnect your Gmail account in the Gmail Integration block."
                )
            raise
        
        # Watch request for Gmail push notifications
        request = {
            'labelIds': ['INBOX'],  # Monitor inbox
            'topicName': f'projects/{PROJECT_ID}/topics/{TOPIC_NAME}'
        }
        
        print(f"Sending watch request to Gmail API...")
        
        # Start watching
        response = service.users().watch(userId='me', body=request).execute()
        
        # Store watch details
        expiration = datetime.fromtimestamp(int(response['expiration']) / 1000)
        
        supabase.table("gmail_watches").upsert({
            "user_id": user_id,
            "workspace_id": workspace_id,
            "history_id": response['historyId'],
            "expiration": expiration.isoformat()
        }).execute()
        
        return {
            "success": True,
            "history_id": response['historyId'],
            "expiration": expiration.isoformat()
        }
        
    except Exception as e:
        print(f"Failed to set up Gmail watch: {e}")
        raise


def stop_gmail_watch(user_id: str, workspace_id: str):
    try:
        service = get_user_gmail_service(user_id)
        
        # Stop watching
        service.users().stop(userId='me').execute()
        
        # Remove from database
        supabase.table("gmail_watches")\
            .delete()\
            .eq("user_id", user_id)\
            .eq("workspace_id", workspace_id)\
            .execute()
        
        print(f"Gmail watch stopped for user {user_id}")
        return {"success": True}
        
    except Exception as e:
        print(f"Failed to stop Gmail watch: {e}")
        # Don't raise - might be already stopped
        return {"success": False, "error": str(e)}


def renew_gmail_watch(user_id: str, workspace_id: str):
    return setup_gmail_watch(user_id, workspace_id)


async def process_gmail_notification(user_id: str, history_id: str):
    try:
        # Get user's Gmail service
        service = get_user_gmail_service(user_id)
        
        # Get stored history ID
        watch_data = supabase.table("gmail_watches")\
            .select("*")\
            .eq("user_id", user_id)\
            .single()\
            .execute()
        
        if not watch_data.data:
            print(f"No watch data found for user {user_id}")
            return
        
        stored_history_id = watch_data.data['history_id']
        workspace_id = watch_data.data['workspace_id']
        
        # Get history of changes since last check
        history = service.users().history().list(
            userId='me',
            startHistoryId=stored_history_id,
            historyTypes=['messageAdded']
        ).execute()
        
        if 'history' not in history:
            print(f"No new messages for user {user_id}")
            return
        
        # Process new messages
        new_messages = []
        for record in history.get('history', []):
            if 'messagesAdded' in record:
                for msg_record in record['messagesAdded']:
                    message = msg_record['message']
                    new_messages.append(message['id'])
        
        print(f"Found {len(new_messages)} new messages for user {user_id}")
        
        # Update stored history ID
        supabase.table("gmail_watches").update({
            "history_id": history_id
        }).eq("user_id", user_id).execute()
        
        # Process each new message (AWAIT each one!)
        for message_id in new_messages:
            await process_new_email(user_id, workspace_id, message_id)
        
    except Exception as e:
        print(f"Error processing Gmail notification: {e}")
        import traceback
        traceback.print_exc()


async def process_new_email(user_id: str, workspace_id: str, message_id: str):
    from blocks.action_reply_email import execute_reply_email
    
    # Check if already processed
    existing = supabase.table("workflow_executions")\
        .select("id")\
        .contains("trigger_data", {"email_id": message_id})\
        .execute()

    if existing.data:
        print(f"Already processed, skipping")
        return

    try:
        service = get_user_gmail_service(user_id)
        
        # Get full email details
        email = service.users().messages().get(
            userId='me',
            id=message_id,
            format='full'
        ).execute()
        
        # Extract email data
        headers = email['payload']['headers']
        subject = next((h['value'] for h in headers if h['name'].lower() == 'subject'), '')
        from_email = next((h['value'] for h in headers if h['name'].lower() == 'from'), '')
        
        # CRITICAL: Get the user's Gmail address to prevent infinite loops
        profile = service.users().getProfile(userId='me').execute()
        user_email = profile['emailAddress']
        
        # FILTER OUT emails sent by the user themselves (prevent catching own replies!)
        if user_email.lower() in from_email.lower():
            print(f"Skipping email from self: {from_email}")
            return
        
        print(f"Processing email from {from_email}: {subject}")
        
        # Get email body
        body = ""
        if 'parts' in email['payload']:
            for part in email['payload']['parts']:
                if part['mimeType'] == 'text/plain' and 'data' in part.get('body', {}):
                    body = base64.urlsafe_b64decode(part['body']['data']).decode('utf-8')
                    break
        elif 'body' in email['payload'] and 'data' in email['payload']['body']:
            body = base64.urlsafe_b64decode(email['payload']['body']['data']).decode('utf-8')
        
        # First, find the email-received condition block in pipeline_blocks
        email_block = supabase.table("pipeline_blocks")\
            .select("block_id, type")\
            .eq("workspace_id", workspace_id)\
            .eq("type", "condition-email-received")\
            .execute()
        
        if not email_block.data or len(email_block.data) == 0:
            print(f"No email-received block found in workspace {workspace_id}")
            return
        
        block_id = email_block.data[0]['block_id']
        print(f"Found email-received block: {block_id}")
        
        # Get the config for this block (if it exists)
        config_result = supabase.table("block_configs")\
            .select("config")\
            .eq("workspace_id", workspace_id)\
            .eq("block_id", block_id)\
            .execute()
        
        # Use config if exists, otherwise empty filters (process all emails)
        if config_result.data and len(config_result.data) > 0:
            email_condition_config = config_result.data[0]['config']
            print(f"Found email condition config: {email_condition_config}")
        else:
            email_condition_config = {}
            print(f"No filters configured - processing all emails")
        
        # Check if email matches conditions
        sender_filter = email_condition_config.get("senderEmail", "")
        subject_filter = email_condition_config.get("subjectContains", "")
        
        # Apply filters
        if sender_filter and sender_filter.lower() not in from_email.lower():
            print(f"Email doesn't match sender filter: {from_email}")
            return
        
        if subject_filter and subject_filter.lower() not in subject.lower():
            print(f"Email doesn't match subject filter: {subject}")
            return
        
        print(f"Email matches all conditions!")
        
        # Get or create workflow execution
        execution_result = supabase.table("workflow_executions")\
            .select("*")\
            .eq("workspace_id", workspace_id)\
            .eq("user_id", user_id)\
            .in_("status", ["waiting", "running"])\
            .execute()
        
        if not execution_result.data:
            # Create new execution
            execution = supabase.table("workflow_executions").insert({
                "workspace_id": workspace_id,
                "user_id": user_id,
                "status": "running",
                "current_block_index": 1
            }).execute()
            execution_id = execution.data[0]["id"]
        else:
            execution_id = execution_result.data[0]["id"]
        
        # Build trigger data
        trigger_data = {
            "email_id": email['id'],
            "thread_id": email['threadId'],
            "subject": subject,
            "from": from_email,
            "body": body
        }
        
        # Update execution with trigger data
        supabase.table("workflow_executions").update({
            "status": "running",
            "trigger_data": trigger_data
        }).eq("id", execution_id).execute()
        
        print(f"Triggering workflow execution {execution_id}")
        
        # Execute action blocks (reply-email, etc.) - AWAIT IT!
        await execute_workflow_blocks(workspace_id, user_id, execution_id, trigger_data)
        
        # Reset to waiting for next email
        supabase.table("workflow_executions").update({
            "status": "waiting"
        }).eq("id", execution_id).execute()
        
        print(f"Workflow executed successfully for email {message_id}")
        
    except Exception as e:
        print(f"Error processing email {message_id}: {e}")
        import traceback
        traceback.print_exc()


async def execute_workflow_blocks(workspace_id: str, user_id: str, execution_id: str, trigger_data: dict):
    from blocks.action_reply_email import execute_reply_email
    
    # Get all blocks for this workspace
    blocks_result = supabase.table("pipeline_blocks")\
        .select("*")\
        .eq("workspace_id", workspace_id)\
        .order("position")\
        .execute()
    
    blocks = blocks_result.data
    print(f"Executing {len(blocks)} blocks in workflow")
    
    # Skip condition blocks, only execute action blocks
    action_blocks = [b for b in blocks if b['type'].startswith('action-')]
    
    print(f"Found {len(action_blocks)} action blocks to execute")
    
    for block in action_blocks:
        block_type = block['type']
        print(f"\nExecuting block: {block['title']} ({block_type})")
        
        if block_type == 'action-reply-email':
            try:
                # Get block config
                config_result = supabase.table("block_configs")\
                    .select("config")\
                    .eq("workspace_id", workspace_id)\
                    .eq("block_id", block['block_id'])\
                    .execute()
                
                config = config_result.data[0]['config'] if config_result.data else {}
                
                # Execute reply action (await it!)
                result = await execute_reply_email(
                    workspace_id=workspace_id,
                    user_id=user_id,
                    trigger_data=trigger_data,
                    config=config
                )
                
                if result.get('status') == 'error':
                    print(f"Block failed: {result.get('error')}")
                else:
                    print(f"Block executed successfully")
                    
            except Exception as e:
                print(f"Exception executing reply-email block: {e}")
                import traceback
                traceback.print_exc()
        
        else:
            print(f"Unknown block type: {block_type}")