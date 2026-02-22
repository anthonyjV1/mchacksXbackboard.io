import os
from supabase import create_client
from dotenv import load_dotenv
import asyncio
from datetime import datetime, timedelta, timezone

load_dotenv()
supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_KEY")
)

async def run_scheduled_trigger(user_id: str, workspace_id: str, execution_id: str):
    from blocks.workflow_executor import execute_workflow_blocks

    # Load config
    blocks = supabase.table("pipeline_blocks").select("*")\
        .eq("workspace_id", workspace_id)\
        .eq("type", "condition-scheduled-trigger").execute()
    
    if not blocks.data:
        return
    
    block_id = blocks.data[0]['block_id']
    config_result = supabase.table("block_configs").select("config")\
        .eq("workspace_id", workspace_id).eq("block_id", block_id).execute()
    
    if not config_result.data:
        return
    
    config = config_result.data[0]['config']
    mode = config.get('mode', 'interval')

    async def is_still_active():
        result = supabase.table("workflow_executions").select("status")\
            .eq("id", execution_id).execute()
        return result.data and result.data[0]['status'] not in ['paused', 'completed', 'failed']

    async def fire():
        print(f"⏰ Scheduled trigger firing for workspace {workspace_id}")
        trigger_data = {"provider": "scheduled", "triggered_at": datetime.now(timezone.utc).isoformat()}
        await execute_workflow_blocks(workspace_id, user_id, trigger_data)

    if mode == 'interval':
        value = config.get('intervalValue', 30)
        unit = config.get('intervalUnit', 'minutes')
        seconds = value * {'minutes': 60, 'hours': 3600, 'days': 86400}[unit]
        await asyncio.sleep(seconds)
        if await is_still_active():
            await fire()

    elif mode == 'datetime':
        target = datetime.fromisoformat(config.get('datetime', ''))
        target = target.replace(tzinfo=timezone.utc) if target.tzinfo is None else target
        wait_seconds = (target - datetime.now(timezone.utc)).total_seconds()
        if wait_seconds > 0:
            await asyncio.sleep(wait_seconds)
        if await is_still_active():
            await fire()

    elif mode == 'recurring':
        recurring_time = config.get('recurringTime', '09:00')
        recurring_days = config.get('recurringDays', [1,2,3,4,5])
        hour, minute = map(int, recurring_time.split(':'))

        while await is_still_active():
            now = datetime.now(timezone.utc)
            # Find next matching day/time
            for days_ahead in range(8):
                candidate = now + timedelta(days=days_ahead)
                if candidate.weekday() in [d if d > 0 else 6 for d in recurring_days]:
                    next_run = candidate.replace(hour=hour, minute=minute, second=0, microsecond=0)
                    if next_run > now:
                        wait_seconds = (next_run - now).total_seconds()
                        await asyncio.sleep(wait_seconds)
                        if await is_still_active():
                            await fire()
                        break
            else:
                await asyncio.sleep(3600)  # fallback check every hour