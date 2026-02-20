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

  // Check for email integration (Gmail OR Outlook)
  const hasEmailIntegration = blocks.some(b => 
    b.type === 'integration-gmail' || b.type === 'integration-outlook'
  )
  
  if (!hasEmailIntegration) {
    return 'Pipeline must have either Gmail or Outlook integration block'
  }

  // Check for email trigger
  const hasEmailTrigger = blocks.some(b => b.type === 'condition-email-received')
  if (!hasEmailTrigger) {
    return 'Pipeline must have at least one "Email Received" block'
  }

  return null // Valid
}