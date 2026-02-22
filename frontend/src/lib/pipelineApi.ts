// lib/pipelineApi.ts
import { BlockData } from '../../types/pipeline'

const API_BASE = 'http://localhost:8000'

export async function launchPipeline(workflowId: string, userId: string) {
  const response = await fetch(`${API_BASE}/workflows/${workflowId}/launch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId })
  })
  
  const data = await response.json()
  
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to launch pipeline')
  }
  
  return data
}

export async function stopPipeline(workflowId: string, userId: string) {
  const response = await fetch(`${API_BASE}/workflows/${workflowId}/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId })
  })
  
  const data = await response.json()
  
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to stop pipeline')
  }
  
  return data
}

export async function sendVoiceCommand(
  userId: string,
  workspaceId: string,
  transcription: string
) {
  const response = await fetch(`${API_BASE}/api/voice-command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      workspace_id: workspaceId,
      transcription
    })
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.detail || 'Failed to process command')
  }

  return data
}

export function validatePipelineLaunch(blocks: BlockData[]): string | null {
  if (blocks.length === 0) {
    return 'Please add some blocks to your pipeline first'
  }

  const hasEmailIntegration = blocks.some(b => 
    b.type === 'integration-gmail' || b.type === 'integration-outlook'
  )
  if (!hasEmailIntegration) {
    return 'Pipeline must have either Gmail or Outlook integration block'
  }

  const hasAction = blocks.some(b => b.type.startsWith('action-'))
  if (!hasAction) {
    return 'Please add at least one action block (e.g. Reply to Email)'
  }

  // If there's a condition block, make sure it's not empty
  const sortedBlocks = [...blocks].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  const conditionBlocks = sortedBlocks.filter(b => b.type === 'condition-email-received')
  
  for (const condition of conditionBlocks) {
    const endMarker = sortedBlocks.find(b => 
      b.type === 'condition-end-marker' && b.parentConditionId === condition.id
    )
    if (endMarker) {
      const conditionPos = condition.position ?? 0
      const endPos = endMarker.position ?? 999
      const actionsInside = sortedBlocks.filter(b => 
        b.type.startsWith('action-') && 
        (b.position ?? 0) > conditionPos && 
        (b.position ?? 0) < endPos
      )
      if (actionsInside.length === 0) {
        return `'${condition.title}' block is empty — add at least one action inside it`
      }
    }
  }

  return null
}