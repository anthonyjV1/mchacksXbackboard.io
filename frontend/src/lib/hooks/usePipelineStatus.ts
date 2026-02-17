// hooks/usePipelineStatus.ts
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export type PipelineStatus = 'idle' | 'active' | 'launching'

export function usePipelineStatus(workflowId: string) {
  const supabase = createClient()
  const [status, setStatus] = useState<PipelineStatus>('idle')

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        
        const { data: executions, error } = await supabase
          .from('workflow_executions')
          .select('status, id')
          .eq('workspace_id', workflowId)
          .eq('user_id', user.id)
        
        if (error) {
          console.error('Error checking status:', error)
          return
        }
        
        const activeExecution = executions?.find(
          ex => !['paused', 'completed', 'failed'].includes(ex.status)
        )
        
        setStatus(activeExecution ? 'active' : 'idle')
      } catch (error) {
        console.error('Error checking status:', error)
      }
    }
    
    checkStatus()
    const interval = setInterval(checkStatus, 3000)
    return () => clearInterval(interval)
  }, [workflowId, supabase])

  return { status, setStatus }
}