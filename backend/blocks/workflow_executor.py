from supabase import create_client
import os
from dotenv import load_dotenv
from blocks.action_reply_email import execute_reply_email
from blocks.action_send_email import execute_send_email

load_dotenv()
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

async def execute_workflow_blocks(workspace_id: str, user_id: str, trigger_data: dict):

    blocks_result = supabase.table("pipeline_blocks")\
        .select("*").eq("workspace_id", workspace_id).order("position").execute()

    for block in blocks_result.data:
        if not block['type'].startswith('action-'):
            continue

        print(f"[{block['position']}] {block['title']} ({block['type']})")

        config_result = supabase.table("block_configs").select("config")\
            .eq("workspace_id", workspace_id).eq("block_id", block['block_id']).execute()
        config = config_result.data[0]['config'] if config_result.data else {}

        try:
            if block['type'] == 'action-reply-email':
                result = await execute_reply_email(workspace_id, user_id, trigger_data, config)
            elif block['type'] == 'action-send-email':
                result = await execute_send_email(workspace_id, user_id, trigger_data, config)
            else:
                print(f" Unknown block type: {block['type']}")
                continue

            print(f"{'Good' if result.get('status') != 'error' else 'Bad'} {result.get('status')}")

        except Exception as e:
            print(f" {block['type']} failed: {e}")
            import traceback
            traceback.print_exc()