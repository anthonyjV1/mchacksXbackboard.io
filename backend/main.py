from fastapi import FastAPI, HTTPException, Request, Header
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from supabase import create_client
import os
import json
import base64
from pydantic import BaseModel
from dotenv import load_dotenv
from services.backboard_service import backboard_service
from gmail_webhook_handler import (
    setup_gmail_watch, 
    stop_gmail_watch, 
    process_gmail_notification
)
import re

load_dotenv()

app = FastAPI()

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

class LaunchRequest(BaseModel):
    user_id: str

class BlockConfig(BaseModel):
    workspace_id: str
    config: dict

class VoiceCommandRequest(BaseModel):
    user_id: str
    workspace_id: str
    transcription: str

supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_KEY")
)

# OAuth configuration
SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.modify'
]
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")

oauth_states = {}

@app.get("/auth/gmail")
async def auth_gmail(user_id: str, redirect_uri: str):
    """Initiate Gmail OAuth flow"""
    client_config = {
        "web": {
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": ["http://localhost:8000/auth/gmail/callback"]
        }
    }
    
    flow = Flow.from_client_config(
        client_config,
        scopes=SCOPES,
        redirect_uri="http://localhost:8000/auth/gmail/callback"
    )
    
    authorization_url, state = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true',
        prompt='consent'
    )
    
    oauth_states[state] = {
        'user_id': user_id,
        'redirect_uri': redirect_uri
    }
    
    return RedirectResponse(authorization_url)

@app.get("/auth/gmail/callback")
async def auth_gmail_callback(state: str, code: str):
    """Handle Gmail OAuth callback"""
    if state not in oauth_states:
        raise HTTPException(status_code=400, detail="Invalid state")
    
    user_data = oauth_states[state]
    user_id = user_data['user_id']
    frontend_redirect = user_data['redirect_uri']
    
    client_config = {
        "web": {
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": ["http://localhost:8000/auth/gmail/callback"]
        }
    }
    
    flow = Flow.from_client_config(
        client_config,
        scopes=SCOPES,
        state=state,
        redirect_uri="http://localhost:8000/auth/gmail/callback"
    )
    
    flow.fetch_token(code=code)
    credentials = flow.credentials
    
    supabase.table("user_oauth_credentials").upsert({
        "user_id": user_id,
        "provider": "gmail",
        "access_token": credentials.token,
        "refresh_token": credentials.refresh_token,
        "token_expiry": credentials.expiry.isoformat() if credentials.expiry else None,
        "scope": " ".join(SCOPES)
    }).execute()
    
    del oauth_states[state]
    
    return RedirectResponse(frontend_redirect)

@app.get("/health")
def health():
    return {"status": "healthy"}

@app.post("/workflows/{workspace_id}/launch")
async def launch_workflow(workspace_id: str, body: LaunchRequest):
    
    blocks = supabase.table("pipeline_blocks")\
        .select("*")\
        .eq("workspace_id", workspace_id)\
        .execute()
    
    print(f"Found {len(blocks.data)} blocks in workspace {workspace_id}")
    
    has_email_trigger = any(
        block['type'] == 'condition-email-received' 
        for block in blocks.data
    )
    
    if not has_email_trigger:
        raise HTTPException(
            status_code=400, 
            detail=f"Workflow must have at least one 'Email Received' condition block."
        )
    
    gmail_creds = supabase.table("user_oauth_credentials")\
        .select("*")\
        .eq("user_id", body.user_id)\
        .eq("provider", "gmail")\
        .execute()
    
    if not gmail_creds.data:
        raise HTTPException(
            status_code=400,
            detail="Gmail account not connected. Please connect Gmail first."
        )
    
    existing = supabase.table("workflow_executions")\
        .select("*")\
        .eq("workspace_id", workspace_id)\
        .eq("user_id", body.user_id)\
        .in_("status", ["waiting", "active"])\
        .execute()
    
    if existing.data:
        raise HTTPException(
            status_code=400,
            detail="Pipeline is already running. Stop it first before launching again."
        )
    
    result = supabase.table("workflow_executions").insert({
        "workspace_id": workspace_id,
        "user_id": body.user_id,
        "status": "waiting",
        "current_block_index": 0
    }).execute()
    
    execution_id = result.data[0]["id"]
    
    try:
        watch_result = setup_gmail_watch(body.user_id, workspace_id)
        print(f"   Gmail webhook set up successfully")
        print(f"   Execution ID: {execution_id}")
        print(f"   History ID: {watch_result['history_id']}")
        print(f"   Expires: {watch_result['expiration']}")
        
        return {
            "execution_id": execution_id,
            "status": "waiting",
            "message": "Pipeline launched successfully! Email notifications are now active.",
            "webhook": {
                "active": True,
                "history_id": watch_result['history_id'],
                "expires_at": watch_result['expiration']
            }
        }
    except Exception as e:
        supabase.table("workflow_executions")\
            .delete()\
            .eq("id", execution_id)\
            .execute()
        
        raise HTTPException(
            status_code=500,
            detail=f"Failed to set up email notifications: {str(e)}"
        )

@app.post("/workflows/{workspace_id}/stop")
async def stop_workflow(workspace_id: str, body: LaunchRequest):
    
    all_executions = supabase.table("workflow_executions")\
        .select("*")\
        .eq("workspace_id", workspace_id)\
        .eq("user_id", body.user_id)\
        .execute()
    
    active_ids = [
        ex['id'] for ex in all_executions.data 
        if ex['status'] not in ['paused', 'completed', 'failed']
    ]
    
    if not active_ids:
        raise HTTPException(
            status_code=400,
            detail="No active pipeline found to stop."
        )
    
    try:
        stop_gmail_watch(body.user_id, workspace_id)
        print(f"Gmail webhook stopped")
    except Exception as e:
        print(f"Could not stop Gmail webhook: {e}")
    
    for execution_id in active_ids:
        supabase.table("workflow_executions")\
            .update({"status": "paused"})\
            .eq("id", execution_id)\
            .execute()
    
    return {
        "status": "paused",
        "stopped_count": len(active_ids),
        "message": "Pipeline stopped successfully"
    }

@app.get("/workflows/{workspace_id}/status")
async def get_workflow_status(workspace_id: str, user_id: str):
    
    result = supabase.table("workflow_executions")\
        .select("*")\
        .eq("workspace_id", workspace_id)\
        .eq("user_id", user_id)\
        .in_("status", ["waiting", "active"])\
        .order("created_at", desc=True)\
        .limit(1)\
        .execute()
    
    if result.data and len(result.data) > 0:
        execution_data = result.data[0]
        
        watch_result = supabase.table("gmail_watches")\
            .select("*")\
            .eq("user_id", user_id)\
            .eq("workspace_id", workspace_id)\
            .execute()
        
        webhook_active = watch_result.data and len(watch_result.data) > 0
        
        return {
            "status": "active",
            "execution": execution_data,
            "webhook": {
                "active": webhook_active,
                "expires_at": watch_result.data[0].get("expiration") if webhook_active else None
            }
        }
    else:
        return {"status": "idle"}

@app.post("/blocks/{block_id}/config")
async def save_block_config(block_id: str, body: BlockConfig):
    supabase.table("block_configs").upsert({
        "workspace_id": body.workspace_id,
        "block_id": block_id,
        "config": body.config
    }).execute()
    return {"success": True, "message": "Configuration saved"}

@app.post("/webhooks/gmail")
async def gmail_webhook(request: Request):
    try:
        body = await request.json()
        
        print(f"\n{'='*60}")
        print(f"GMAIL WEBHOOK RECEIVED")
        print(f"{'='*60}")
        
        if 'message' not in body:
            print("No message in webhook body")
            return {"status": "ignored"}
        
        message = body['message']
        
        if 'data' in message:
            decoded_data = base64.b64decode(message['data']).decode('utf-8')
            notification_data = json.loads(decoded_data)
            
            print(f"Notification data: {notification_data}")
            
            email_address = notification_data.get('emailAddress')
            history_id = notification_data.get('historyId')
            
            if not email_address or not history_id:
                print("Missing email or history ID")
                return {"status": "ignored"}
            
            creds_result = supabase.table("user_oauth_credentials")\
                .select("user_id")\
                .eq("provider", "gmail")\
                .execute()
            
            for cred in creds_result.data:
                user_id = cred['user_id']
                
                watch_result = supabase.table("gmail_watches")\
                    .select("*")\
                    .eq("user_id", user_id)\
                    .execute()
                
                if watch_result.data and len(watch_result.data) > 0:
                    print(f"Found matching user: {user_id}")
                    await process_gmail_notification(user_id, history_id)
                    return {"status": "processed"}
    
            return {"status": "no_active_watch"}
        
        return {"status": "success"}
        
    except Exception as e:
        print(f"Error processing Gmail webhook: {e}")
        import traceback
        traceback.print_exc()
        return {"status": "error", "error": str(e)}

# ============================================================================
# VOICE COMMAND ENDPOINT - Enhanced template matching
# ============================================================================

# Define templates directly in backend for better matching
WORKFLOW_TEMPLATES = [
    {
        "id": "email-reply-automation",
        "name": "Email Reply Automation",
        # Use word stems to match variations like reply/replies/replied/replying
        "keywords": ["repl", "respond", "answer", "auto reply", "automatic"],
        "blocks": [
            {"type": "integration-gmail", "title": "Gmail Integration", "description": "Connect Gmail"},
            {"type": "condition-email-received", "title": "Email Received", "description": "Trigger"},
            {"type": "action-reply-email", "title": "Reply to Email", "description": "Action"}
        ],
        "message": "Perfect! I've created an email reply automation for you. Just connect your Gmail and set up your reply message!"
    },
    {
        "id": "email-sender",
        "name": "Email Sender",
        "keywords": ["send email", "send message", "email someone", "forward", "send an email", " send "],
        "blocks": [
            {"type": "integration-gmail", "title": "Gmail Integration", "description": "Connect Gmail"},
            {"type": "condition-email-received", "title": "Email Received", "description": "Trigger"},
            {"type": "action-send-email", "title": "Send Email", "description": "Action"}
        ],
        "message": "Awesome! I've set up an email sender workflow for you. Connect Gmail and configure who you want to send emails to."
    }
]

def find_matching_template(transcript: str):
    transcript_lower = transcript.lower()
    
    # Check each template's keywords
    for template in WORKFLOW_TEMPLATES:
        print(f"  Checking template: {template['name']}")
        for keyword in template["keywords"]:
            keyword_lower = keyword.lower()
            print(f"    Checking keyword: '{keyword}' → '{keyword_lower}' in transcript?", keyword_lower in transcript_lower)
            if keyword_lower in transcript_lower:
                print(f"Matched template '{template['name']}' via keyword '{keyword}'")
                return template
    
    print("No template match found")
    return None

@app.post("/api/voice-command")
async def handle_voice_command(body: VoiceCommandRequest):
    """
    Handle voice command - Template matching with AI fallback
    """
    try:
        # Try template matching first
        matched_template = find_matching_template(body.transcription)
        
        if matched_template:
            print(f"Using template: {matched_template['name']}")
            return {
                "success": True,
                "blocks": matched_template["blocks"],
                "message": matched_template["message"],
                "source": "template",
                "template_id": matched_template["id"]
            }
        
        # If no template match, try AI generation
        print(f"No template match, trying AI generation...")
        
        try:
            thread_id = await backboard_service.create_thread()
        except Exception as backboard_error:
            if "429" in str(backboard_error) or "quota" in str(backboard_error).lower():
                # Return a basic fallback
                return {
                    "success": True,
                    "blocks": WORKFLOW_TEMPLATES[0]["blocks"],  # Use first template as fallback
                    "message": "I've created a workflow for you!",
                    "source": "fallback-quota"
                }
            raise
        
        system_context = f"""You are a friendly workflow automation assistant.

The user said: "{body.transcription}"

Respond with ONLY valid JSON (no markdown, no code blocks):
{{
    "blocks": [
        {{"type": "integration-gmail", "title": "Gmail Integration", "description": "Connect Gmail"}},
        {{"type": "condition-email-received", "title": "Email Received", "description": "Trigger"}},
        {{"type": "action-send-email", "title": "Send Email", "description": "Action"}}
    ],
    "message": "Brief friendly confirmation message"
}}

Use these exact block types:
- integration-gmail
- condition-email-received  
- action-reply-email (for replying to emails)
- action-send-email (for sending new emails)

Choose action-reply-email when the user wants to respond/reply to emails.
Choose action-send-email when the user wants to send/forward emails."""

        try:
            ai_response = await backboard_service.add_message_and_get_reply(
                thread_id=thread_id,
                sender_email=body.user_id,
                subject="Voice Command",
                body=system_context
            )
            
            cleaned = ai_response.strip()
            if cleaned.startswith("```"):
                cleaned = re.sub(r'^```json?\s*|\s*```$', '', cleaned, flags=re.MULTILINE)
            
            json_match = re.search(r'\{.*\}', cleaned, re.DOTALL)
            if json_match:
                workflow_data = json.loads(json_match.group())
                return {
                    "success": True,
                    "blocks": workflow_data.get("blocks", []),
                    "message": workflow_data.get("message", "Workflow created!"),
                    "source": "ai",
                    "thread_id": thread_id
                }
            
        except Exception as e:
            print(f"AI generation failed: {e}")
        
        # Final fallback - use first template
        print(f"Using fallback template")
        return {
            "success": True,
            "blocks": WORKFLOW_TEMPLATES[0]["blocks"],
            "message": "I've created a workflow for you!",
            "source": "fallback"
        }
        
    except Exception as e:
        print(f"Voice command error: {str(e)}")
        import traceback
        traceback.print_exc()
        
        # Always return something - use first template
        return {
            "success": True,
            "blocks": WORKFLOW_TEMPLATES[0]["blocks"],
            "message": "I've created a workflow for you!",
            "source": "error-fallback"
        }