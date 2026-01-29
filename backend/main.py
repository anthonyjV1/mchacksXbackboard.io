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
    'https://www.googleapis.com/auth/gmail.modify'  # Needed for push notifications
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
    """
    Launch a workflow - sets up Gmail webhook instead of polling.
    NOW PRODUCTION READY! 🚀
    """
    
    # 1. Validate workflow has email trigger blocks
    blocks = supabase.table("pipeline_blocks")\
        .select("*")\
        .eq("workspace_id", workspace_id)\
        .execute()
    
    print(f"📊 Found {len(blocks.data)} blocks in workspace {workspace_id}")
    
    has_email_trigger = any(
        block['type'] == 'condition-email-received' 
        for block in blocks.data
    )
    
    if not has_email_trigger:
        raise HTTPException(
            status_code=400, 
            detail=f"Workflow must have at least one 'Email Received' condition block."
        )
    
    # 2. Check if Gmail is connected
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
    
    # 3. Check if already running
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
    
    # 4. Create execution record
    result = supabase.table("workflow_executions").insert({
        "workspace_id": workspace_id,
        "user_id": body.user_id,
        "status": "waiting",
        "current_block_index": 0
    }).execute()
    
    execution_id = result.data[0]["id"]
    
    # 5. Set up Gmail webhook (replaces polling!)
    try:
        watch_result = setup_gmail_watch(body.user_id, workspace_id)
        print(f"✅ Gmail webhook set up successfully")
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
        # Rollback execution if webhook setup fails
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
    """Stop a running workflow and disable webhook"""
    
    # Get active executions
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
    
    # Stop Gmail webhook
    try:
        stop_gmail_watch(body.user_id, workspace_id)
        print(f"✅ Gmail webhook stopped")
    except Exception as e:
        print(f"⚠️ Warning: Could not stop Gmail webhook: {e}")
    
    # Update executions to paused
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
    """Get current workflow status"""
    
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
        
        # Check webhook status
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
    """Save block configuration"""
    supabase.table("block_configs").upsert({
        "workspace_id": body.workspace_id,
        "block_id": block_id,
        "config": body.config
    }).execute()
    return {"success": True, "message": "Configuration saved"}


# ============================================================================
# GMAIL WEBHOOK ENDPOINT - This receives notifications from Google Pub/Sub
# ============================================================================

@app.post("/webhooks/gmail")
async def gmail_webhook(request: Request):
    """
    Handle Gmail push notifications from Google Pub/Sub.
    This is called automatically when new emails arrive.
    """
    try:
        # Get the Pub/Sub message
        body = await request.json()
        
        print(f"\n{'='*60}")
        print(f"📬 GMAIL WEBHOOK RECEIVED")
        print(f"{'='*60}")
        
        # Decode the Pub/Sub message
        if 'message' not in body:
            print("⚠️ No message in webhook body")
            return {"status": "ignored"}
        
        message = body['message']
        
        # Decode data
        if 'data' in message:
            decoded_data = base64.b64decode(message['data']).decode('utf-8')
            notification_data = json.loads(decoded_data)
            
            print(f"📧 Notification data: {notification_data}")
            
            email_address = notification_data.get('emailAddress')
            history_id = notification_data.get('historyId')
            
            if not email_address or not history_id:
                print("⚠️ Missing email or history ID")
                return {"status": "ignored"}
            
            # Find user by email
            creds_result = supabase.table("user_oauth_credentials")\
                .select("user_id")\
                .eq("provider", "gmail")\
                .execute()
            
            # Find the matching user (Gmail API doesn't directly give us user_id)
            # We need to check which user's Gmail this belongs to
            for cred in creds_result.data:
                user_id = cred['user_id']
                
                # Check if this user has an active watch
                watch_result = supabase.table("gmail_watches")\
                    .select("*")\
                    .eq("user_id", user_id)\
                    .execute()
                
                if watch_result.data and len(watch_result.data) > 0:
                    print(f"✅ Found matching user: {user_id}")
                    
                    # Process the notification (AWAIT it!)
                    await process_gmail_notification(user_id, history_id)
                    
                    return {"status": "processed"}
            
            print(f"⚠️ No active watch found for email: {email_address}")
            return {"status": "no_active_watch"}
        
        return {"status": "success"}
        
    except Exception as e:
        print(f"❌ Error processing Gmail webhook: {e}")
        import traceback
        traceback.print_exc()
        return {"status": "error", "error": str(e)}


# ============================================================================
# VOICE COMMAND ENDPOINT (Existing - kept as is)
# ============================================================================

WORKFLOW_TEMPLATES = {
    "reply-to-email": {
        "keywords": ["reply", "respond", "answer"],
        "blocks": [
            {
                "type": "integration-gmail",
                "title": "Gmail Integration",
                "description": "Connect your Gmail account"
            },
            {
                "type": "condition-email-received",
                "title": "Email Received",
                "description": "Triggers when new email arrives"
            },
            {
                "type": "action-reply-email",
                "title": "Reply to Email",
                "description": "Send automated reply"
            }
        ],
        "message": "Perfect! I've created your email reply workflow. Just connect your Gmail and you're ready to start!"
    }
}

def detect_template(transcription: str) -> dict | None:
    """Detect which template the user wants based on keywords"""
    transcription_lower = transcription.lower()
    
    for template_name, template_data in WORKFLOW_TEMPLATES.items():
        keywords = template_data["keywords"]
        if any(keyword in transcription_lower for keyword in keywords):
            return template_data
    
    return None

@app.post("/api/voice-command")
async def handle_voice_command(body: VoiceCommandRequest):
    """Handle voice command from Vapi"""
    try:
        print(f"🎤 Voice command received: {body.transcription}")
        
        transcription_clean = body.transcription.strip()
        if len(transcription_clean) < 10:
            return {
                "success": False,
                "message": "Please continue speaking...",
                "source": "incomplete"
            }
        
        template = detect_template(body.transcription)
        
        if template:
            return {
                "success": True,
                "blocks": template["blocks"],
                "message": template["message"],
                "source": "template"
            }
        
        if not any(punct in transcription_clean for punct in ['.', '!', '?']) and len(transcription_clean) < 30:
            return {
                "success": False,
                "message": "Please finish your command...",
                "source": "incomplete"
            }
        
        # Fallback to AI generation with Backboard
        try:
            thread_id = await backboard_service.create_thread()
        except Exception as backboard_error:
            if "429" in str(backboard_error) or "quota" in str(backboard_error).lower():
                return {
                    "success": True,
                    "blocks": WORKFLOW_TEMPLATES["reply-to-email"]["blocks"],
                    "message": "I've created a basic email workflow for you!",
                    "source": "fallback-quota"
                }
            raise
        
        system_context = """You are a workflow automation assistant. Convert voice commands into JSON.

Respond with ONLY this JSON format:
{
    "blocks": [
        {"type": "integration-gmail", "title": "Gmail Integration", "description": "Connect Gmail"},
        {"type": "condition-email-received", "title": "Email Received", "description": "Triggers on new email"},
        {"type": "action-reply-email", "title": "Reply to Email", "description": "Send reply"}
    ],
    "message": "Workflow created! Connect Gmail to get started."
}

Use exact block types and titles from the list provided earlier."""

        try:
            ai_response = await backboard_service.add_message_and_get_reply(
                thread_id=thread_id,
                sender_email=body.user_id,
                subject="Voice Command",
                body=f"{system_context}\n\nUser command: {body.transcription}"
            )
            
            cleaned_response = ai_response.strip()
            if cleaned_response.startswith("```"):
                cleaned_response = re.sub(r'^```json?\s*|\s*```$', '', cleaned_response, flags=re.MULTILINE)
            
            json_match = re.search(r'\{.*\}', cleaned_response, re.DOTALL)
            if json_match:
                workflow_data = json.loads(json_match.group())
                
                return {
                    "success": True,
                    "blocks": workflow_data.get("blocks", []),
                    "message": workflow_data.get("message", "Workflow created!"),
                    "source": "ai",
                    "thread_id": thread_id
                }
            else:
                raise ValueError("Could not parse JSON from AI response")
            
        except Exception:
            return {
                "success": True,
                "blocks": WORKFLOW_TEMPLATES["reply-to-email"]["blocks"],
                "message": "I've created a workflow for you!",
                "source": "fallback"
            }
        
    except Exception as e:
        print(f"❌ Voice command error: {str(e)}")
        return {
            "success": True,
            "blocks": WORKFLOW_TEMPLATES["reply-to-email"]["blocks"],
            "message": "I've created a workflow for you!",
            "source": "fallback"
        }