from celery import Celery
from celery.schedules import crontab
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

# Add the backend directory to Python path
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

celery = Celery(
    'workflow_engine',
    broker=os.getenv('REDIS_URL'),
    backend=os.getenv('REDIS_URL')
)

celery.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
)

@celery.task
def poll_single_execution(workspace_id: str, user_id: str, execution_id: str):
    """Poll once for emails - this task will re-schedule itself"""
    from blocks.condition_email_received import check_for_emails
    from supabase import create_client
    
    print(f"\n{'='*60}")
    print(f"⏰ [{datetime.now().isoformat()}] POLL TRIGGERED")
    print(f"   Execution ID: {execution_id}")
    print(f"   Workspace ID: {workspace_id}")
    print(f"{'='*60}\n")
    
    supabase = create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_KEY")
    )
    
    try:
        # Check if execution still exists
        print(f"🔍 Checking execution status in DB...")
        result = supabase.table("workflow_executions")\
            .select("status")\
            .eq("id", execution_id)\
            .execute()
        
        print(f"📊 DB Response: {result.data}")
        
        if not result.data or len(result.data) == 0:
            print(f"⏹️ Execution {execution_id} not found. Stopping polling.")
            return
            
        status = result.data[0]['status']
        print(f"✅ Execution {execution_id} status: {status}")
        
        # Stop polling if paused, completed, or failed
        if status in ['paused', 'completed', 'failed']:
            print(f"⏹️ Execution {execution_id} is {status}. Stopping polling.")
            return
        
        # Check for matching emails
        print(f"📧 Calling check_for_emails()...")
        check_for_emails(workspace_id, user_id, execution_id)
        print(f"✅ check_for_emails() completed")
        
        # Re-schedule this task to run again in 30 seconds
        print(f"⏰ Scheduling next poll in 30 seconds...")
        poll_single_execution.apply_async(
            args=[workspace_id, user_id, execution_id],
            countdown=30
        )
        print(f"✅ Next poll scheduled for execution {execution_id}")
        
    except Exception as e:
        print(f"❌ ERROR in email polling: {e}")
        import traceback
        traceback.print_exc()
        
        # Still re-schedule even on error (with status check)
        try:
            print(f"🔄 Attempting to re-schedule despite error...")
            result = supabase.table("workflow_executions")\
                .select("status")\
                .eq("id", execution_id)\
                .execute()
            
            if result.data and len(result.data) > 0 and result.data[0]['status'] not in ['paused', 'completed', 'failed']:
                poll_single_execution.apply_async(
                    args=[workspace_id, user_id, execution_id],
                    countdown=30
                )
                print(f"⏰ Re-scheduled despite error for execution {execution_id}")
            else:
                print(f"⏹️ Not re-scheduling - execution status is {result.data[0]['status'] if result.data else 'not found'}")
        except Exception as retry_error:
            print(f"❌ Could not re-schedule: {retry_error}")
            traceback.print_exc()


@celery.task
def start_email_polling(workspace_id: str, user_id: str, execution_id: str):
    """Initialize email polling - kicks off the recurring task"""
    print(f"\n{'='*60}")
    print(f"🚀 STARTING EMAIL POLLING")
    print(f"   Execution ID: {execution_id}")
    print(f"   Workspace ID: {workspace_id}")
    print(f"   User ID: {user_id}")
    print(f"{'='*60}\n")
    
    # Immediately trigger the first poll
    poll_single_execution.apply_async(
        args=[workspace_id, user_id, execution_id],
        countdown=0  # Start immediately
    )
    
    return f"Polling started for execution {execution_id}"


# Schedule periodic check for workflows that might have been missed
celery.conf.beat_schedule = {
    'check-all-active-workflows': {
        'task': 'celery_app.check_all_workflows',
        'schedule': crontab(minute='*/5'),  # Every 5 minutes as backup
    },
}

@celery.task
def check_all_workflows():
    """Backup scheduler - ensures no workflows are missed"""
    from supabase import create_client
    
    print(f"\n{'='*60}")
    print(f"🔍 BACKUP SCHEDULER RUNNING at {datetime.now().isoformat()}")
    print(f"{'='*60}\n")
    
    supabase = create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_KEY")
    )
    
    # Get all workflows that are active (waiting or active status only)
    result = supabase.table("workflow_executions")\
        .select("*")\
        .in_("status", ["waiting", "active"])\
        .execute()
    
    print(f"🔍 Beat check: Found {len(result.data)} active workflows")
    
    if len(result.data) == 0:
        print("✅ No active workflows to check")
        return
    
    # Re-trigger polling for any that might have stopped
    for execution in result.data:
        workspace_id = execution['workspace_id']
        user_id = execution['user_id']
        execution_id = execution['id']
        
        print(f"🔄 Ensuring polling for execution {execution_id} (status: {execution['status']})")
        poll_single_execution.apply_async(
            args=[workspace_id, user_id, execution_id],
            countdown=0
        )