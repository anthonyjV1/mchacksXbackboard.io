from celery import Celery
from celery.schedules import crontab
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

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
    
    supabase = create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_KEY")
    )
    
    try:
        # Check if execution still exists
        result = supabase.table("workflow_executions")\
            .select("status")\
            .eq("id", execution_id)\
            .maybe_single()\
            .execute()
        
        if not result.data:
            print(f"⏹️ Execution {execution_id} not found. Stopping polling.")
            return
            
        status = result.data['status']
        print(f"📊 Execution {execution_id} status: {status}")
        
        # Stop polling if paused, completed, or failed
        if status in ['paused', 'completed', 'failed']:
            print(f"⏹️ Execution {execution_id} is {status}. Stopping polling.")
            return
        
        # Check for matching emails
        print(f"📧 Checking for emails (execution: {execution_id})")
        check_for_emails(workspace_id, user_id, execution_id)
        
        # Re-schedule this task to run again in 30 seconds
        poll_single_execution.apply_async(
            args=[workspace_id, user_id, execution_id],
            countdown=30
        )
        print(f"⏰ Scheduled next poll in 30 seconds for execution {execution_id}")
        
    except Exception as e:
        print(f"❌ Error in email polling: {e}")
        import traceback
        traceback.print_exc()
        
        # Still re-schedule even on error (with status check)
        try:
            result = supabase.table("workflow_executions")\
                .select("status")\
                .eq("id", execution_id)\
                .maybe_single()\
                .execute()
            
            if result.data and result.data['status'] not in ['paused', 'completed', 'failed']:
                poll_single_execution.apply_async(
                    args=[workspace_id, user_id, execution_id],
                    countdown=30
                )
                print(f"⏰ Re-scheduled despite error for execution {execution_id}")
        except Exception as retry_error:
            print(f"❌ Could not re-schedule: {retry_error}")


@celery.task
def start_email_polling(workspace_id: str, user_id: str, execution_id: str):
    """Initialize email polling - kicks off the recurring task"""
    print(f"🚀 Starting email polling for execution {execution_id}")
    
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
    
    supabase = create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_KEY")
    )
    
    # Get all workflows that are active (not paused, completed, or failed)
    result = supabase.table("workflow_executions")\
        .select("*")\
        .neq("status", "paused")\
        .neq("status", "completed")\
        .neq("status", "failed")\
        .execute()
    
    print(f"🔍 Beat check: Found {len(result.data)} active workflows")
    
    # Re-trigger polling for any that might have stopped
    for execution in result.data:
        workspace_id = execution['workspace_id']
        user_id = execution['user_id']
        execution_id = execution['id']
        
        print(f"🔄 Ensuring polling for execution {execution_id}")
        poll_single_execution.apply_async(
            args=[workspace_id, user_id, execution_id],
            countdown=0
        )