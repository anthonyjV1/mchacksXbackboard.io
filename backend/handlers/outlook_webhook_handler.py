#/handlers/outlook_webhook_handler.py
import os
import base64
from supabase import create_client
from dotenv import load_dotenv
from services.outlook_service import get_outlook_service
from blocks.action_reply_email import execute_reply_email
from datetime import datetime, timedelta, timezone

load_dotenv()

supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_KEY")
)

def setup_outlook_watch(user_id: str, workspace_id: str):
    """
    Set up Outlook webhook for new emails
    Microsoft Graph subscriptions expire after max 3 days
    """
    
    print(f" Setting up Outlook watch for user {user_id}...")
    
    try:
        service = get_outlook_service(user_id)
        
        # Create webhook subscription
        # NOTE: For production, use your actual domain. For local dev, use ngrok.
        notification_url = os.getenv("OUTLOOK_WEBHOOK_URL", "https://your-domain.com/webhooks/outlook")
        
        subscription = {
            'changeType': 'created',
            'notificationUrl': notification_url,
            'resource': '/me/mailFolders/inbox/messages',
            'expirationDateTime': (datetime.now(timezone.utc) + timedelta(days=2)).strftime('%Y-%m-%dT%H:%M:%S') + 'Z',
            'clientState': os.getenv("OUTLOOK_CLIENT_STATE", "secretClientState")  # Secret for validation
        }
        
        print(f" Creating subscription with:")
        print(f"   URL: {notification_url}")
        print(f"   Resource: {subscription['resource']}")
        print(f"   Expiration: {subscription['expirationDateTime']}")
        print(f"   Full subscription: {subscription}")
        
        result = service._make_request('POST', '/subscriptions', json=subscription)
        print(f" Subscription result: {result}")
        
        supabase.table("outlook_watches").upsert({
            "user_id": user_id,
            "workspace_id": workspace_id,
            "subscription_id": result['id'],
            "expiration": result['expirationDateTime'],
            "client_state": subscription['clientState']  # add this
        }, on_conflict="user_id,workspace_id").execute()
        
        print(f" Outlook webhook set up successfully")
        print(f"   Subscription ID: {result['id']}")
        print(f"   Expires: {result['expirationDateTime']}")
        
        return result
    
    except Exception as e:
        print(f" Error setting up Outlook watch: {e}")
        import traceback
        traceback.print_exc()
        raise

def stop_outlook_watch(user_id: str, workspace_id: str):
    """Stop Outlook webhook and delete subscription"""
    
    print(f" Stopping Outlook watch for user {user_id}...")
    
    try:
        # Get subscription from database
        watch = supabase.table("outlook_watches")\
            .select("*")\
            .eq("user_id", user_id)\
            .eq("workspace_id", workspace_id)\
            .execute()
        
        if not watch.data:
            print(f" No Outlook watch found")
            return
        
        subscription_id = watch.data[0]['subscription_id']
        
        # Delete subscription from Microsoft
        service = get_outlook_service(user_id)
        service._make_request('DELETE', f'/subscriptions/{subscription_id}')
        
        # Delete from database
        supabase.table("outlook_watches")\
            .delete()\
            .eq("user_id", user_id)\
            .eq("workspace_id", workspace_id)\
            .execute()
        
        print(f" Outlook webhook stopped and deleted")
    
    except Exception as e:
        print(f" Error stopping Outlook watch: {e}")
        import traceback
        traceback.print_exc()

async def process_outlook_notification(notification_data: dict, client_state: str):
    """
    Process Outlook webhook notification from Microsoft Graph
    
    Microsoft sends:
    {
      "value": [{
        "subscriptionId": "...",
        "clientState": "...",
        "resource": "Users('user-id')/Messages('message-id')",
        "resourceData": {
          "@odata.type": "#Microsoft.Graph.Message",
          "@odata.id": "Users('user-id')/Messages('message-id')",
          "id": "message-id"
        }
      }]
    }
    """
    
    try:
        for item in notification_data.get('value', []):
            # Validate client state for security
            item_client_state = item.get('clientState', '')
            expected_client_state = os.getenv("OUTLOOK_CLIENT_STATE", "secretClientState")
            
            if item_client_state != expected_client_state:
                print(f" Invalid client state: {item_client_state}")
                continue
            
            subscription_id = item['subscriptionId']
            
            # Find which user this subscription belongs to
            watch = supabase.table("outlook_watches")\
                .select("*")\
                .eq("subscription_id", subscription_id)\
                .execute()
            
            if not watch.data:
                continue
            
            user_id = watch.data[0]['user_id']
            workspace_id = watch.data[0]['workspace_id']
            
            # Extract message ID
            resource_data = item.get('resourceData', {})
            message_id = resource_data.get('id')
            
            if not message_id:
                continue
            
            print(f"  New Outlook email: {message_id}")
            print(f"   User: {user_id}")
            print(f"   Workspace: {workspace_id}")
            
            # Process the email
            await process_new_outlook_email(user_id, workspace_id, message_id)
    
    except Exception as e:
        print(f" Error processing Outlook notification: {e}")
        import traceback
        traceback.print_exc()

async def process_new_outlook_email(user_id: str, workspace_id: str, message_id: str):
    """
    Process a new Outlook email - check conditions and trigger workflow
    This is called when a new email arrives via webhook
    """
    
    try:
        service = get_outlook_service(user_id)
        
        # Get message details from Microsoft Graph
        message = service.get_message(message_id)
        
        # Extract email data
        subject = message.get('subject', '')
        from_data = message.get('from', {}).get('emailAddress', {})
        from_email = from_data.get('address', '')
        from_name = from_data.get('name', '')
        
        # Get body (prefer text over HTML)
        body_data = message.get('body', {})
        body = body_data.get('content', '')
        
        # Get user's email to prevent self-replies
        user_email = service.get_user_email()
        
        # CRITICAL: Filter out emails from self
        if user_email.lower() == from_email.lower():
            print(f" Skipping email from self: {from_email}")
            return
        
        print(f" Processing Outlook email from {from_email}: {subject}")
        
        # Check for attachments
        has_attachments = message.get('hasAttachments', False)
        print(f" Has attachments: {has_attachments}")
        
        # Find email-received condition block
        email_block = supabase.table("pipeline_blocks")\
            .select("block_id, type")\
            .eq("workspace_id", workspace_id)\
            .eq("type", "condition-email-received")\
            .execute()
        
        if not email_block.data or len(email_block.data) == 0:
            print(f" No email-received block found in workspace {workspace_id}")
            return
        
        block_id = email_block.data[0]['block_id']
        print(f" Found email-received block: {block_id}")
        
        # Get the config for this block
        config_result = supabase.table("block_configs")\
            .select("config")\
            .eq("workspace_id", workspace_id)\
            .eq("block_id", block_id)\
            .execute()
        
        email_condition_config = config_result.data[0]['config'] if config_result.data else {}
        
        print(f" Checking filters:")
        
        # Apply filters (same as Gmail)
        sender_filter = email_condition_config.get("senderEmail", "")
        subject_filter = email_condition_config.get("subjectContains", "")
        attachment_required = email_condition_config.get("hasAttachment", False)
        
        print(f"   Sender filter: '{sender_filter}' (empty = any)")
        print(f"   Subject filter: '{subject_filter}' (empty = any)")
        print(f"   Attachment required: {attachment_required}")
        
        if sender_filter and sender_filter.lower() not in from_email.lower():
            print(f" Email doesn't match sender filter")
            print(f"   Expected: {sender_filter}")
            print(f"   Got: {from_email}")
            return
        
        if subject_filter and subject_filter.lower() not in subject.lower():
            print(f" Email doesn't match subject filter")
            print(f"   Expected keyword: '{subject_filter}'")
            print(f"   Got subject: '{subject}'")
            return
        
        if attachment_required and not has_attachments:
            print(f" Email doesn't have required attachment")
            return
        
        print(f" Email matches all conditions!")
        
        # Build trigger data with provider info
        trigger_data = {
            "email_id": message_id,
            "thread_id": message.get('conversationId'),  # Outlook uses conversationId
            "subject": subject,
            "from": f"{from_name} <{from_email}>" if from_name else from_email,
            "body": body,
            "provider": "outlook"  # CRITICAL: Mark as Outlook so reply action knows which API to use
        }
        
        print(f" Triggering workflow for Outlook email")
        
        # Execute workflow blocks (reply-email action will detect provider)
        await execute_reply_email(
            workspace_id=workspace_id,
            user_id=user_id,
            trigger_data=trigger_data,
            config={}  # Config loaded inside execute_reply_email
        )
        
    except Exception as e:
        print(f" Error processing Outlook email: {e}")
        import traceback
        traceback.print_exc()