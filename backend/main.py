from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from supabase import create_client
import os
import json
from pydantic import BaseModel
from dotenv import load_dotenv
from services.backboard_service import backboard_service
import re

load_dotenv()

app = FastAPI()

# FIXED CORS - Must be configured BEFORE any routes
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",  # Add other ports if needed
    ],
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods (GET, POST, PUT, DELETE, etc.)
    allow_headers=["*"],  # Allows all headers
    expose_headers=["*"],
    max_age=3600,  # Cache preflight requests for 1 hour
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
SCOPES = ['https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send']
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
    """Launch a workflow - validates and starts email polling"""
    
    # 1. Check if workflow has email trigger blocks
    blocks = supabase.table("pipeline_blocks")\
        .select("*")\
        .eq("workspace_id", workspace_id)\
        .execute()
    
    print(f"📊 Found {len(blocks.data)} blocks in workspace {workspace_id}")
    print(f"📊 Block types: {[block['type'] for block in blocks.data]}")
    
    has_email_trigger = any(
        block['type'] == 'condition-email-received' 
        for block in blocks.data
    )
    
    if not has_email_trigger:
        raise HTTPException(
            status_code=400, 
            detail=f"Workflow must have at least one 'Email Received' condition block. Found blocks: {[block['type'] for block in blocks.data]}"
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
            detail="Gmail account not connected. Please connect Gmail first using the Gmail Integration block."
        )
    
    # 3. Check if already running (ignore paused/completed/failed)
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
    
    # 4. Create execution record with 'waiting' status
    result = supabase.table("workflow_executions").insert({
        "workspace_id": workspace_id,
        "user_id": body.user_id,
        "status": "waiting",  # Use 'waiting' since that's what the DB constraint allows
        "current_block_index": 0
    }).execute()
    
    execution_id = result.data[0]["id"]
    
    # 5. Start email polling task
    from celery_app import start_email_polling
    task = start_email_polling.delay(workspace_id, body.user_id, execution_id)
    
    print(f"✅ Started polling task {task.id} for execution {execution_id}")
    
    return {
        "execution_id": execution_id, 
        "status": "waiting",  # Match what we're actually storing
        "task_id": task.id,
        "message": "Pipeline launched successfully. Monitoring emails every 30 seconds..."
    }

@app.post("/workflows/{workspace_id}/stop")
async def stop_workflow(workspace_id: str, body: LaunchRequest):
    """Stop a running workflow"""
    
    # Get all executions first
    all_executions = supabase.table("workflow_executions")\
        .select("*")\
        .eq("workspace_id", workspace_id)\
        .eq("user_id", body.user_id)\
        .execute()
    
    print(f"🔍 Found {len(all_executions.data)} total executions")
    for ex in all_executions.data:
        print(f"  - {ex['id']}: status={ex['status']}")
    
    # Filter to only active ones
    active_ids = [
        ex['id'] for ex in all_executions.data 
        if ex['status'] not in ['paused', 'completed', 'failed']
    ]
    
    if not active_ids:
        raise HTTPException(
            status_code=400,
            detail=f"No active pipeline found to stop. All executions are already stopped/completed."
        )
    
    print(f"🎯 Updating {len(active_ids)} active execution(s) to paused")
    
    # Update each active execution to paused
    for execution_id in active_ids:
        supabase.table("workflow_executions")\
            .update({"status": "paused"})\
            .eq("id", execution_id)\
            .execute()
    
    print(f"⏹️ Successfully paused {len(active_ids)} execution(s)")
    
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
        .maybeSingle()\
        .execute()
    
    if result.data:
        return {"status": "active", "execution": result.data}
    else:
        return {"status": "idle"}

@app.post("/blocks/{block_id}/config")
async def save_block_config(block_id: str, body: BlockConfig):
    """Save block configuration - does NOT start execution"""
    supabase.table("block_configs").upsert({
        "workspace_id": body.workspace_id,
        "block_id": block_id,
        "config": body.config
    }).execute()
    return {"success": True, "message": "Configuration saved"}



#BACKBOARD ENDPOINT
# Add these imports at the top with your other imports
from services.backboard_service import backboard_service
import re

# Add this Pydantic model with your other models (after LaunchRequest, BlockConfig)
class VoiceCommandRequest(BaseModel):
    user_id: str
    workspace_id: str
    transcription: str

# WORKFLOW TEMPLATES - Define your pre-built workflows here
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
    },
    "payment-notification": {
        "keywords": ["payment", "stripe", "charge", "transaction"],
        "blocks": [
            {
                "type": "integration-stripe",
                "title": "Stripe Integration",
                "description": "Connect your Stripe account"
            },
            {
                "type": "condition-payment-success",
                "title": "Payment Success",
                "description": "Triggers when payment succeeds"
            },
            {
                "type": "integration-slack",
                "title": "Slack Integration",
                "description": "Connect your Slack workspace"
            },
            {
                "type": "action-alert-team",
                "title": "Alert Team",
                "description": "Notify team in Slack"
            }
        ],
        "message": "Got it! I've set up your payment notification workflow. Connect Stripe and Slack to get started!"
    }
}

def detect_template(transcription: str) -> dict | None:
    """
    Detect which template the user wants based on keywords in their voice command.
    Returns the template dict or None if no match.
    """
    transcription_lower = transcription.lower()
    
    for template_name, template_data in WORKFLOW_TEMPLATES.items():
        keywords = template_data["keywords"]
        # Check if ANY of the keywords appear in the transcription
        if any(keyword in transcription_lower for keyword in keywords):
            print(f"✅ Detected template: {template_name}")
            return template_data
    
    print("⚠️ No template detected")
    return None

# Add this endpoint anywhere after your /workflows endpoints
@app.post("/api/voice-command")
async def handle_voice_command(body: VoiceCommandRequest):
    """
    Handle voice command from Vapi:
    1. Receive transcribed text
    2. Detect which template user wants
    3. Return pre-built blocks to create
    """
    try:
        print(f"🎤 Voice command received: {body.transcription}")
        
        # Skip very short/incomplete transcriptions (VAPI sends incremental updates)
        transcription_clean = body.transcription.strip()
        if len(transcription_clean) < 10:
            print("⏭️ Skipping incomplete transcription (too short)")
            return {
                "success": False,
                "message": "Please continue speaking...",
                "source": "incomplete"
            }
        
        # First, try to match against templates
        template = detect_template(body.transcription)
        
        if template:
            # Return the pre-built template
            print(f"✅ Using template: {template.get('message', 'Template matched')}")
            return {
                "success": True,
                "blocks": template["blocks"],
                "message": template["message"],
                "source": "template"
            }
        
        # If no template match, check if transcription seems complete
        # VAPI often sends partial transcriptions - only use Backboard for complete sentences
        if not any(punct in transcription_clean for punct in ['.', '!', '?']) and len(transcription_clean) < 30:
            print("⏭️ Skipping incomplete transcription (no punctuation, too short)")
            return {
                "success": False,
                "message": "Please finish your command...",
                "source": "incomplete"
            }
        
        # If no template match, fall back to AI generation with Backboard
        print("🤖 No template match, using Backboard AI...")
        
        # Create a new Backboard thread for this command
        try:
            thread_id = await backboard_service.create_thread()
        except Exception as backboard_error:
            error_msg = str(backboard_error)
            print(f"❌ Backboard error: {error_msg}")
            
            # If it's a quota/rate limit error, return fallback template
            if "429" in error_msg or "quota" in error_msg.lower() or "rate limit" in error_msg.lower():
                print("⚠️ Backboard quota/rate limit hit, using fallback template")
                return {
                    "success": True,
                    "blocks": WORKFLOW_TEMPLATES["reply-to-email"]["blocks"],
                    "message": "I've created a basic email workflow for you. Connect Gmail to get started!",
                    "source": "fallback-quota"
                }
            # Re-raise other errors
            raise
        
        # Simplified system prompt focused on block generation
        system_context = """You are a workflow automation assistant. Convert the user's voice command into a JSON structure.

Respond with ONLY this JSON format (no markdown, no extra text):
{
    "blocks": [
        {"type": "integration-gmail", "title": "Gmail Integration", "description": "Connect Gmail"},
        {"type": "condition-email-received", "title": "Email Received", "description": "Triggers on new email"},
        {"type": "action-reply-email", "title": "Reply to Email", "description": "Send reply"}
    ],
    "message": "I've created your workflow! Connect Gmail to get started."
}

IMPORTANT - Use these EXACT block types and titles:
- integration-gmail with title "Gmail Integration"
- condition-email-received with title "Email Received" (NOT "When Email Received")
- action-reply-email with title "Reply to Email"
- integration-slack with title "Slack Integration"
- integration-stripe with title "Stripe Integration"
- condition-payment-success with title "Payment Success"
- action-send-email with title "Send Email"
- action-alert-team with title "Alert Team"

Rules:
1. Start with integration block (gmail, slack, etc)
2. Then add condition/trigger block
3. End with action blocks
4. Keep it simple - 3-4 blocks max
5. Use exact titles from list above"""

        # Get AI response from Backboard
        try:
            ai_response = await backboard_service.add_message_and_get_reply(
                thread_id=thread_id,
                sender_email=body.user_id,
                subject="Voice Command",
                body=f"{system_context}\n\nUser command: {body.transcription}"
            )
            
            print(f"🤖 Backboard response: {ai_response[:200]}...")
        except Exception as backboard_error:
            error_msg = str(backboard_error)
            print(f"❌ Backboard API error: {error_msg}")
            
            # If it's a quota/rate limit error, return fallback template
            if "429" in error_msg or "quota" in error_msg.lower() or "rate limit" in error_msg.lower():
                print("⚠️ Backboard quota/rate limit hit, using fallback template")
                return {
                    "success": True,
                    "blocks": WORKFLOW_TEMPLATES["reply-to-email"]["blocks"],
                    "message": "I've created a basic email workflow for you. Connect Gmail to get started!",
                    "source": "fallback-quota"
                }
            # Re-raise other errors
            raise
        
        # Try to parse JSON from response
        import json
        
        # Remove markdown code blocks if present
        cleaned_response = ai_response.strip()
        if cleaned_response.startswith("```"):
            cleaned_response = re.sub(r'^```json?\s*|\s*```$', '', cleaned_response, flags=re.MULTILINE)
        
        # Extract JSON from response
        json_match = re.search(r'\{.*\}', cleaned_response, re.DOTALL)
        if json_match:
            workflow_data = json.loads(json_match.group())
            print(f"✅ Parsed workflow: {len(workflow_data.get('blocks', []))} blocks")
            
            return {
                "success": True,
                "blocks": workflow_data.get("blocks", []),
                "message": workflow_data.get("message", "Workflow created!"),
                "source": "ai",
                "thread_id": thread_id
            }
        else:
            raise ValueError("Could not parse JSON from AI response")
        
    except json.JSONDecodeError as e:
        print(f"❌ JSON parsing error: {str(e)}")
        # Return fallback template
        return {
            "success": True,
            "blocks": WORKFLOW_TEMPLATES["reply-to-email"]["blocks"],
            "message": "I've created a basic email workflow for you. Connect Gmail to get started!",
            "source": "fallback"
        }
    except Exception as e:
        print(f"❌ Voice command error: {str(e)}")
        # Return fallback instead of error
        return {
            "success": True,
            "blocks": WORKFLOW_TEMPLATES["reply-to-email"]["blocks"],
            "message": "I've created a workflow for you. Connect Gmail to get started!",
            "source": "fallback"
        }