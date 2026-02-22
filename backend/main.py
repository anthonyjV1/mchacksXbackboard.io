from fastapi import FastAPI, HTTPException, Request, Header, Response
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
import re
import secrets
import requests
import asyncio
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlencode
from datetime import datetime, timedelta, timezone
from handlers.gmail_webhook_handler import (
    setup_gmail_watch, 
    stop_gmail_watch, 
    process_gmail_notification
)
from handlers.outlook_webhook_handler import (
    setup_outlook_watch,
    stop_outlook_watch,
    process_outlook_notification
)
from blocks.condition_scheduled_trigger import run_scheduled_trigger

load_dotenv()

app = FastAPI()
executor = ThreadPoolExecutor()

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

# Google OAuth configuration
SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.modify'
]
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")

# Microsoft OAuth configuration
MICROSOFT_SCOPES = [
    'https://graph.microsoft.com/Mail.Read',
    'https://graph.microsoft.com/Mail.ReadWrite',
    'https://graph.microsoft.com/Mail.Send',
    'User.Read',
    'offline_access'
]
MICROSOFT_CLIENT_ID = os.getenv("MICROSOFT_CLIENT_ID")
MICROSOFT_CLIENT_SECRET = os.getenv("MICROSOFT_CLIENT_SECRET")

oauth_states = {}


# AUTH ENDPOINTS

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
    
    oauth_states[state] = {'user_id': user_id, 'redirect_uri': redirect_uri}
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

    user_info_response = requests.get(
    'https://www.googleapis.com/oauth2/v2/userinfo',
    headers={'Authorization': f'Bearer {credentials.token}'}
)
    gmail_email = user_info_response.json().get('email', '') if user_info_response.ok else ''
    
    supabase.table("user_oauth_credentials").upsert({
        "user_id": user_id,
        "provider": "gmail",
        "access_token": credentials.token,
        "refresh_token": credentials.refresh_token,
        "token_expiry": credentials.expiry.isoformat() if credentials.expiry else None,
        "scope": " ".join(SCOPES),
        "email": gmail_email 
    }).execute()
    
    del oauth_states[state]
    return RedirectResponse(frontend_redirect)


@app.get("/auth/outlook")
async def auth_outlook(user_id: str, redirect_uri: str):
    """Initiate Outlook OAuth flow"""
    auth_url = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
    state = secrets.token_urlsafe(32)
    oauth_states[state] = {'user_id': user_id, 'redirect_uri': redirect_uri}
    
    params = {
        'client_id': MICROSOFT_CLIENT_ID,
        'response_type': 'code',
        'redirect_uri': 'http://localhost:8000/auth/outlook/callback',
        'scope': ' '.join(MICROSOFT_SCOPES),
        'state': state,
        'response_mode': 'query',
        'prompt': 'consent'
    }
    
    print(f"Initiating Outlook OAuth for user {user_id}")
    return RedirectResponse(f"{auth_url}?{urlencode(params)}")


@app.get("/auth/outlook/callback")
async def auth_outlook_callback(state: str, code: str):
    """Handle Outlook OAuth callback"""
    if state not in oauth_states:
        raise HTTPException(status_code=400, detail="Invalid state")
    
    user_data = oauth_states.pop(state)
    user_id = user_data['user_id']
    frontend_redirect = user_data['redirect_uri']
    
    print(f"Outlook OAuth callback received for user {user_id}")
    
    response = requests.post(
        "https://login.microsoftonline.com/common/oauth2/v2.0/token",
        data={
            'client_id': MICROSOFT_CLIENT_ID,
            'client_secret': MICROSOFT_CLIENT_SECRET,
            'code': code,
            'redirect_uri': 'http://localhost:8000/auth/outlook/callback',
            'grant_type': 'authorization_code',
            'scope': ' '.join(MICROSOFT_SCOPES)
        }
    )
    
    if not response.ok:
        print(f"Token exchange failed: {response.text}")
        raise HTTPException(status_code=500, detail="Failed to get access token")
    
    tokens = response.json()
    token_expiry = (datetime.now(timezone.utc) + timedelta(seconds=tokens.get('expires_in', 3600))).isoformat()

    me_response = requests.get(
    'https://graph.microsoft.com/v1.0/me',
    headers={'Authorization': f'Bearer {tokens["access_token"]}'}
    )
    outlook_email = ''
    if me_response.ok:
        me_data = me_response.json()
        outlook_email = me_data.get('mail') or me_data.get('userPrincipalName', '')

    
    supabase.table("user_oauth_credentials").upsert({
        "user_id": user_id,
        "provider": "outlook",
        "access_token": tokens['access_token'],
        "refresh_token": tokens.get('refresh_token'),
        "token_expiry": token_expiry,
        "scope": ' '.join(MICROSOFT_SCOPES),
        "email": outlook_email
    }).execute()
    
    print(f"Outlook OAuth complete for user {user_id}")
    return RedirectResponse(frontend_redirect)


# ============================================================================
# HEALTH
# ============================================================================

@app.get("/health")
def health():
    return {"status": "healthy"}


# ============================================================================
# WORKFLOW ENDPOINTS
# ============================================================================

@app.post("/workflows/{workspace_id}/launch")
async def launch_workflow(workspace_id: str, body: LaunchRequest):
    
    blocks = supabase.table("pipeline_blocks")\
        .select("*").eq("workspace_id", workspace_id).execute()
    
    print(f"Found {len(blocks.data)} blocks in workspace {workspace_id}")
    
    has_gmail = any(b['type'] == 'integration-gmail' for b in blocks.data)
    has_outlook = any(b['type'] == 'integration-outlook' for b in blocks.data)
    has_email_trigger = any(b['type'] == 'condition-email-received' for b in blocks.data)
    
    has_action = any(b['type'].startswith('action-') for b in blocks.data)
    if not has_action:
        raise HTTPException(status_code=400, detail="Please add at least one action block (e.g. Reply to Email).")

    if not has_gmail and not has_outlook:
        raise HTTPException(status_code=400, detail="No email integration found. Please add a Gmail or Outlook block.")

    # Check that no condition block is empty (has no actions before its end marker)
    sorted_blocks = sorted(blocks.data, key=lambda b: b['position'])
    condition_blocks = [b for b in sorted_blocks if b['type'] == 'condition-email-received']

    for condition in condition_blocks:
        condition_id = condition['block_id']
        end_marker = next((b for b in sorted_blocks if b['type'] == 'condition-end-marker' and b['parent_condition_id'] == condition_id), None)
        
        if end_marker:
            actions_in_condition = [
                b for b in sorted_blocks 
                if b['type'].startswith('action-')
                and b['position'] > condition['position']
                and b['position'] < end_marker['position']
            ]
            if not actions_in_condition:
                raise HTTPException(status_code=400, detail=f"The '{condition['title']}' block has no actions. Add at least one action block inside it.")
        
    if has_gmail:
        gmail_creds = supabase.table("user_oauth_credentials")\
            .select("*").eq("user_id", body.user_id).eq("provider", "gmail").execute()
        if not gmail_creds.data:
            raise HTTPException(status_code=400, detail="Gmail account not connected. Please connect Gmail first.")
    
    if has_outlook:
        outlook_creds = supabase.table("user_oauth_credentials")\
            .select("*").eq("user_id", body.user_id).eq("provider", "outlook").execute()
        if not outlook_creds.data:
            raise HTTPException(status_code=400, detail="Outlook account not connected. Please connect Outlook first.")
    
    existing = supabase.table("workflow_executions")\
        .select("*").eq("workspace_id", workspace_id).eq("user_id", body.user_id)\
        .in_("status", ["waiting", "active"]).execute()
    
    if existing.data:
        raise HTTPException(status_code=400, detail="Pipeline is already running. Stop it first before launching again.")
    
    result = supabase.table("workflow_executions").insert({
        "workspace_id": workspace_id,
        "user_id": body.user_id,
        "status": "waiting",
        "current_block_index": 0
    }).execute()
    
    execution_id = result.data[0]["id"]
    
    try:
        if has_gmail:
            watch_result = setup_gmail_watch(body.user_id, workspace_id)
            print(f"Gmail webhook active")
            print(f"   History ID: {watch_result['history_id']}")
            print(f"   Expires: {watch_result['expiration']}")
        
        if has_outlook:
            await asyncio.get_event_loop().run_in_executor(
                executor, setup_outlook_watch, body.user_id, workspace_id
            )
            print(f" Outlook webhook active")
        
        has_scheduled_trigger = any(b['type'] == 'condition-scheduled-trigger' for b in blocks.data)
        if has_scheduled_trigger:
            asyncio.create_task(run_scheduled_trigger(body.user_id, workspace_id, execution_id))
            print(f"⏰ Scheduled trigger active")
        
        return {
            "execution_id": execution_id,
            "status": "waiting",
            "message": "Pipeline launched successfully! Email notifications are now active."
        }
    
    except Exception as e:
        supabase.table("workflow_executions").delete().eq("id", execution_id).execute()
        raise HTTPException(status_code=500, detail=f"Failed to set up email notifications: {str(e)}")


@app.post("/workflows/{workspace_id}/stop")
async def stop_workflow(workspace_id: str, body: LaunchRequest):
    
    all_executions = supabase.table("workflow_executions")\
        .select("*").eq("workspace_id", workspace_id).eq("user_id", body.user_id).execute()
    
    active_ids = [
        ex['id'] for ex in all_executions.data 
        if ex['status'] not in ['paused', 'completed', 'failed']
    ]
    
    if not active_ids:
        raise HTTPException(status_code=400, detail="No active pipeline found to stop.")
    
    try:
        stop_gmail_watch(body.user_id, workspace_id)
        print(f" Gmail webhook stopped")
    except Exception as e:
        print(f"Could not stop Gmail webhook: {e}")
    
    try:
        stop_outlook_watch(body.user_id, workspace_id)
        print(f" Outlook webhook stopped")
    except Exception as e:
        print(f"Could not stop Outlook webhook: {e}")
    
    for execution_id in active_ids:
        supabase.table("workflow_executions")\
            .update({"status": "paused"}).eq("id", execution_id).execute()
    
    return {
        "status": "paused",
        "stopped_count": len(active_ids),
        "message": "Pipeline stopped successfully"
    }


@app.get("/workflows/{workspace_id}/status")
async def get_workflow_status(workspace_id: str, user_id: str):
    
    result = supabase.table("workflow_executions")\
        .select("*").eq("workspace_id", workspace_id).eq("user_id", user_id)\
        .in_("status", ["waiting", "active"])\
        .order("created_at", desc=True).limit(1).execute()
    
    if result.data and len(result.data) > 0:
        execution_data = result.data[0]
        
        watch_result = supabase.table("gmail_watches")\
            .select("*").eq("user_id", user_id).eq("workspace_id", workspace_id).execute()
        
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


# BLOCK CONFIG ENDPOINTS

@app.get("/blocks/{block_id}/config")
async def get_block_config(block_id: str, workspace_id: str):
    """Get block configuration"""
    try:
        print(f"Loading config for block {block_id} in workspace {workspace_id}")
        
        result = supabase.table("block_configs")\
            .select("config").eq("workspace_id", workspace_id).eq("block_id", block_id).execute()
        
        if result.data and len(result.data) > 0:
            return {"success": True, "config": result.data[0]["config"]}
        else:
            return {"success": True, "config": None}
    
    except Exception as e:
        print(f"Error loading config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/blocks/{block_id}/config")
async def save_block_config(block_id: str, body: BlockConfig):
    """Save block configuration"""
    supabase.table("block_configs")\
        .delete().eq("workspace_id", body.workspace_id).eq("block_id", block_id).execute()
    
    supabase.table("block_configs").insert({
        "workspace_id": body.workspace_id,
        "block_id": block_id,
        "config": body.config
    }).execute()
    
    return {"success": True, "message": "Configuration saved"}


# WEBHOOK ENDPOINTS

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
                .select("user_id").eq("provider", "gmail").execute()
            
            for cred in creds_result.data:
                user_id = cred['user_id']
                
                watch_result = supabase.table("gmail_watches")\
                    .select("*").eq("user_id", user_id).execute()
                
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


@app.api_route("/webhooks/outlook", methods=["GET", "POST"])
async def outlook_webhook(request: Request):
    """CRITICAL: Must respond to validation in under 5 seconds!"""
    
    validation_token = request.query_params.get('validationToken')
    if validation_token:
        print(f" Validation request - returning token IMMEDIATELY")
        return Response(content=validation_token, media_type="text/plain", status_code=200)
    
    try:
        body = await request.json()
        print(f" Outlook notification received")
        
        client_state = ""
        if 'value' in body and len(body['value']) > 0:
            client_state = body['value'][0].get('clientState', '')
        
        asyncio.create_task(process_outlook_notification(body, client_state))
        return Response(status_code=202)
    
    except Exception as e:
        print(f" Webhook error: {e}")
        return Response(status_code=202)


# VOICE COMMAND ENDPOINT

WORKFLOW_TEMPLATES = [
    {
        "id": "email-reply-automation",
        "name": "Email Reply Automation",
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
    for template in WORKFLOW_TEMPLATES:
        for keyword in template["keywords"]:
            if keyword.lower() in transcript_lower:
                print(f"Matched template '{template['name']}' via keyword '{keyword}'")
                return template
    print("No template match found")
    return None


@app.post("/api/voice-command")
async def handle_voice_command(body: VoiceCommandRequest):
    try:
        matched_template = find_matching_template(body.transcription)
        
        if matched_template:
            return {
                "success": True,
                "blocks": matched_template["blocks"],
                "message": matched_template["message"],
                "source": "template",
                "template_id": matched_template["id"]
            }
        
        print(f"No template match, trying AI generation...")
        
        try:
            thread_id = await backboard_service.create_thread()
        except Exception as backboard_error:
            if "429" in str(backboard_error) or "quota" in str(backboard_error).lower():
                return {
                    "success": True,
                    "blocks": WORKFLOW_TEMPLATES[0]["blocks"],
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
        return {
            "success": True,
            "blocks": WORKFLOW_TEMPLATES[0]["blocks"],
            "message": "I've created a workflow for you!",
            "source": "error-fallback"
        }