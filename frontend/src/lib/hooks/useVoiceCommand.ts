// hooks/useVoiceCommand.ts
'use client'

import { useState, useRef } from 'react'
import { vapiService } from '@/lib/vapi'
import { sendVoiceCommand } from '@/lib/pipelineApi'
import { BlockType } from '../../../types/pipeline'

export type VoiceStatus = 'idle' | 'listening' | 'thinking' | 'speaking'

export function useVoiceCommand(
  userId: string | null,
  workspaceId: string,
  onWorkflowCreated: (blockTypes: BlockType[]) => void
) {
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle')
  const isProcessingRef = useRef(false)

  const handleVoiceCommand = async () => {
    if (!userId) {
      alert('⏳ Please wait, loading user information...')
      return
    }

    // Toggle: If active, stop immediately
    if (voiceStatus !== 'idle') {
      console.log('User cancelled voice command')
      isProcessingRef.current = false
      vapiService.stopConversation()
      setVoiceStatus('idle')
      return
    }

    try {
      isProcessingRef.current = false
      setVoiceStatus('listening')

      await vapiService.startConversation(
        // onTranscript
        async (transcript: string) => {
          console.log('User said:', transcript)
          
          // Check for cancellation keywords
          const cancelKeywords = ['never mind', 'nevermind', 'cancel', 'stop', 'forget it', 'no thanks']
          const transcriptLower = transcript.toLowerCase()
          
          if (cancelKeywords.some(keyword => transcriptLower.includes(keyword))) {
            console.log('👋 User cancelled gracefully')
            vapiService.stopConversation()
            setVoiceStatus('idle')
            isProcessingRef.current = false
            return
          }

          // Prevent duplicate processing
          if (isProcessingRef.current) {
            console.log('⏭Already processing, skipping...')
            return
          }

          isProcessingRef.current = true
          setVoiceStatus('thinking')

          try {
            const data = await sendVoiceCommand(userId, workspaceId, transcript)

            // Check if user cancelled while processing
            if (!isProcessingRef.current) {
              console.log('Cancelled during processing')
              return
            }

            console.log('Received workflow:', data)

            // Create workflow from template
            if (data.blocks && data.blocks.length > 0) {
              // Simply cast to BlockType[] - backend already ensures these are valid
              const blockTypes = data.blocks.map((block: any) => block.type) as BlockType[]
              
              console.log('Creating workflow:', blockTypes)
              onWorkflowCreated(blockTypes)
              
              setVoiceStatus('speaking')
            } else {
              vapiService.stopConversation()
              setVoiceStatus('idle')
              isProcessingRef.current = false
            }

          } catch (error: any) {
            console.error('Voice command error:', error)
            
            if (isProcessingRef.current) {
              alert(`Failed to process: ${error.message}`)
            }
            
            vapiService.stopConversation()
            setVoiceStatus('idle')
            isProcessingRef.current = false
          }
        },
        // onError
        (error: Error) => {
          console.error('Vapi error:', error)
          
          if (isProcessingRef.current) {
            alert(`Voice error: ${error.message}`)
          }
          
          setVoiceStatus('idle')
          isProcessingRef.current = false
        },
        // onStatusChange
        (status) => {
          console.log('Vapi status changed to:', status)
          if (status === 'idle') {
            console.log('Vapi conversation ended naturally')
            setVoiceStatus('idle')
            isProcessingRef.current = false
          }
        }
      )
    } catch (error: any) {
      console.error('Failed to start voice:', error)
      alert(`Failed to start voice: ${error.message}`)
      setVoiceStatus('idle')
      isProcessingRef.current = false
    }
  }

  return {
    voiceStatus,
    handleVoiceCommand
  }
}