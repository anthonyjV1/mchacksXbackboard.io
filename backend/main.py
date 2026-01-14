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