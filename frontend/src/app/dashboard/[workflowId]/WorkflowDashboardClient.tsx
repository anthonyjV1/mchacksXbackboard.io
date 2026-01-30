'use client'

import React, { useEffect, useRef, useState } from 'react'
import { usePipelineStore } from '@/lib/hooks/usePipelineStore'
import { BlockData } from '../../../../types/pipeline'
import { Canvas } from '@/components/pipeline/Canvas'
import { Sidebar } from '@/components/pipeline/Sidebar'
import { PipelineRail } from '@/components/pipeline/PipelineRail'
import { Toolbar } from '@/components/pipeline/Toolbar'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { Play, Square, Loader2 } from 'lucide-react'
import { vapiService } from '@/lib/vapi'

interface WorkflowDashboardClientProps {
  workflow: {
    id: string
    title?: string
    updated_at?: string
    [key: string]: any
  }
  initialBlocks: any[]
}

export default function WorkflowDashboardClient({ 
  workflow, 
  initialBlocks 
}: WorkflowDashboardClientProps) {
  const supabase = createClient()
  const lastWorkflowId = useRef<string | null>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isSaving = useRef(false)
  const isInitialized = useRef(false)
  const [selectedBlockId, setSelectedBlockId] = useState<string>('')
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const offsetBeforePanel = useRef<{ x: number; y: number } | null>(null)
  const [userId, setUserId] = useState<string>('')
  const [pipelineStatus, setPipelineStatus] = useState<'idle' | 'active' | 'launching'>('idle')
  const [voiceStatus, setVoiceStatus] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle')
  const isProcessingRef = useRef(false) // Prevent duplicate processing
  
  const store = usePipelineStore()

  const handleOpenPanel = (blockId: string) => {
    if (blockId) {
      offsetBeforePanel.current = { ...store.offset }
      setSelectedBlockId(blockId)
      setIsPanelOpen(true)
      
      setTimeout(() => {
        const blockElement = document.querySelector(`[data-block-id="${blockId}"]`)
        if (blockElement && offsetBeforePanel.current) {
          const rect = blockElement.getBoundingClientRect()
          const viewportCenterX = window.innerWidth / 2
          const blockCenterX = rect.left + rect.width / 2
          const targetCenterX = viewportCenterX - 80
          const offsetNeeded = targetCenterX - blockCenterX
          
          store.setOffset({
            x: offsetBeforePanel.current.x + offsetNeeded,
            y: offsetBeforePanel.current.y
          })
        }
      }, 50)
    } else {
      if (offsetBeforePanel.current) {
        store.setOffset(offsetBeforePanel.current)
        offsetBeforePanel.current = null
      }
      setIsPanelOpen(false)
      setSelectedBlockId('')
    }
  }

  const handleUpdateBlock = (id: string, data: Partial<BlockData>) => {
    const updatedBlocks = store.blocks.map(block => 
      block.id === id ? { ...block, ...data } : block
    )
    store.setBlocks(updatedBlocks)
  }

  // Smooth voice handler with graceful cancellation
  const handleVoiceCommand = async () => {
    if (!userId) {
      alert('Please wait, loading user information...')
      return
    }

    // Toggle: If active, stop immediately and cleanly
    if (voiceStatus !== 'idle') {
      console.log('🛑 User cancelled voice command')
      isProcessingRef.current = false
      vapiService.stopConversation()
      setVoiceStatus('idle')
      return
    }

    try {
      isProcessingRef.current = false
      setVoiceStatus('listening')

      await vapiService.startConversation(
        // onTranscript - when user finishes speaking
        async (transcript: string) => {
          console.log('🎤 User said:', transcript)
          
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
            console.log('⏭️ Already processing, skipping...')
            return
          }

          isProcessingRef.current = true
          setVoiceStatus('thinking')

          try {
            // Send to backend
            const response = await fetch('http://localhost:8000/api/voice-command', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                user_id: userId,
                workspace_id: workflow.id,
                transcription: transcript
              })
            })

            const data = await response.json()

            // Check if user cancelled while we were processing
            if (!isProcessingRef.current) {
              console.log('🚫 Cancelled during processing')
              return
            }

            if (!response.ok) {
              throw new Error(data.detail || 'Failed to process command')
            }

            console.log('✅ Received workflow:', data)

            // Create workflow from template
            if (data.blocks && data.blocks.length > 0) {
              const blockTypes = data.blocks.map((block: any) => block.type)
              console.log('🎯 Creating workflow:', blockTypes)
              store.createWorkflowFromTemplate(blockTypes)
              
              setVoiceStatus('speaking')
              
              // Let Vapi finish speaking naturally - it will trigger onStatusChange when done
            } else {
              // No blocks generated
              vapiService.stopConversation()
              setVoiceStatus('idle')
              isProcessingRef.current = false
            }

          } catch (error: any) {
            console.error('❌ Voice command error:', error)
            
            // Don't show alert if user cancelled
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
          console.error('❌ Vapi error:', error)
          
          // Only show error if not a user cancellation
          if (isProcessingRef.current) {
            alert(`Voice error: ${error.message}`)
          }
          
          setVoiceStatus('idle')
          isProcessingRef.current = false
        },
        // onStatusChange - automatically reset when Vapi finishes
        (status) => {
          console.log('📊 Vapi status changed to:', status)
          // When Vapi conversation naturally ends (after speaking), reset everything
          if (status === 'idle') {
            console.log('✅ Vapi conversation ended naturally - resetting to idle')
            setVoiceStatus('idle')
            isProcessingRef.current = false
          }
        }
      )
    } catch (error: any) {
      console.error('❌ Failed to start voice:', error)
      alert(`Failed to start voice: ${error.message}`)
      setVoiceStatus('idle')
      isProcessingRef.current = false
    }
  }

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserId(user.id)
    }
    getUser()
  }, [])

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        
        const { data: executions, error } = await supabase
          .from('workflow_executions')
          .select('status, id')
          .eq('workspace_id', workflow.id)
          .eq('user_id', user.id)
        
        if (error) {
          console.error('Error checking status:', error)
          return
        }
        
        const activeExecution = executions?.find(
          ex => !['paused', 'completed', 'failed'].includes(ex.status)
        )
        
        setPipelineStatus(activeExecution ? 'active' : 'idle')
      } catch (error) {
        console.error('Error checking status:', error)
      }
    }
    
    checkStatus()
    const interval = setInterval(checkStatus, 3000)
    return () => clearInterval(interval)
  }, [workflow.id, supabase])

  useEffect(() => {
    if (lastWorkflowId.current !== workflow.id) {
      console.log('🔄 Loading workspace:', workflow.id)
      lastWorkflowId.current = workflow.id
      isInitialized.current = false

      if (initialBlocks.length > 0) {
        const formattedBlocks = initialBlocks.map(block => ({
          id: block.block_id,
          type: block.type,
          title: block.title,
          description: block.description,
          isSystemGenerated: block.is_system_generated || false,
          parentConditionId: block.parent_condition_id || undefined,
        }))
        console.log('✅ Loaded blocks:', formattedBlocks)
        store.setBlocks(formattedBlocks, true)
      } else {
        console.log('📭 Empty workspace')
        store.setBlocks([], true)
      }
      
      isInitialized.current = true
    }
  }, [workflow.id, initialBlocks])

  useEffect(() => {
    if (!isInitialized.current) return
    if (isSaving.current) return

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(async () => {
      if (lastWorkflowId.current !== workflow.id) return

      const hasPlaceholder = store.blocks.some(b => b.type === 'placeholder')
      if (hasPlaceholder) return

      isSaving.current = true
      console.log('💾 Saving', store.blocks.length, 'blocks...')

      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        
        if (userError || !user) {
          console.error('❌ Auth error:', userError)
          isSaving.current = false
          return
        }

        const { error: deleteError } = await supabase
          .from('pipeline_blocks')
          .delete()
          .eq('workspace_id', workflow.id)

        if (deleteError) {
          console.error('❌ Delete error:', deleteError)
          isSaving.current = false
          return
        }

        if (store.blocks.length > 0) {
          const blocksToInsert = store.blocks.map((block, index) => ({
            workspace_id: workflow.id,
            user_id: user.id,
            block_id: block.id,
            type: block.type,
            title: block.title,
            description: block.description || null,
            position: index,
            is_system_generated: block.isSystemGenerated || false,
            parent_condition_id: block.parentConditionId || null,
          }))

          const { error: insertError } = await supabase
            .from('pipeline_blocks')
            .insert(blocksToInsert)

          if (insertError) {
            console.error('❌ Insert error:', insertError)
            isSaving.current = false
            return
          }

          console.log('✅ Saved successfully')
        }

        const { error: updateError } = await supabase
          .from('workspaces')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', workflow.id)

        if (updateError) {
          console.error('❌ Update error:', updateError)
        }

      } catch (error) {
        console.error('❌ Save failed:', error)
      } finally {
        isSaving.current = false
      }
    }, 1000)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [store.blocks, workflow.id, supabase])

  const getLastEditedText = () => {
    if (!workflow.updated_at) return 'Never edited'
    
    const updatedAt = new Date(workflow.updated_at)
    const now = new Date()
    const diffMs = now.getTime() - updatedAt.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
    
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  }

  const handleLaunchPipeline = async () => {
    if (!userId) {
      alert('❌ Please wait, loading user information...')
      return
    }

    if (store.blocks.length === 0) {
      alert('❌ Please add some blocks to your pipeline first')
      return
    }

    const hasEmailTrigger = store.blocks.some(b => b.type === 'condition-email-received')
    if (!hasEmailTrigger) {
      alert('❌ Pipeline must have at least one "Email Received" block')
      return
    }

    setPipelineStatus('launching')
    
    try {
      console.log('🚀 Launching pipeline with user_id:', userId)
      
      const response = await fetch(`http://localhost:8000/workflows/${workflow.id}/launch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
      })
      
      const data = await response.json()
      console.log('Response:', data)
      
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to launch pipeline')
      }
      
      console.log('✅ Pipeline launched:', data)
      setPipelineStatus('active')
      alert('✅ Pipeline is now active and monitoring for emails!')
    } catch (error: any) {
      console.error('❌ Launch failed:', error)
      
      let errorMessage = error.message
      if (errorMessage.includes('Gmail')) {
        errorMessage += '\n\nPlease connect your Gmail account first by adding a Gmail integration block.'
      }
      
      alert(`❌ Failed to launch:\n\n${errorMessage}`)
      setPipelineStatus('idle')
    }
  }

  const handleStopPipeline = async () => {
    if (!userId) return;
    
    try {
      const response = await fetch(`http://localhost:8000/workflows/${workflow.id}/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to stop pipeline')
      }
      
      console.log('⏹️ Pipeline stopped:', data)
      setPipelineStatus('idle')
      alert('✅ Pipeline stopped successfully')
    } catch (error: any) {
      console.error('❌ Stop failed:', error)
      alert(`❌ Failed to stop: ${error.message}`)
    }
  }

  return (
    <main className="flex h-screen w-full bg-white selection:bg-slate-200 overflow-hidden">
      <Sidebar onAddBlock={(type) => store.addBlock(type)} />
      
      <div className="relative flex-1 h-full">
        <Canvas
          zoom={store.zoom}
          offset={store.offset}
          onOffsetChange={store.setOffset}
          onZoomChange={store.setZoom}
          disabled={isPanelOpen}
        >
          <PipelineRail
            blocks={store.blocks}
            onReorder={(blocks) => store.setBlocks(blocks)}
            onRemove={store.removeBlock}
            onAddPlaceholder={store.addPlaceholder}
            onRemovePlaceholder={store.removePlaceholder}
            onUpdateBlock={handleUpdateBlock}
            onOpenPanel={handleOpenPanel}
            selectedBlockId={selectedBlockId}
            workspaceId={workflow.id}
          />
        </Canvas>

        <Toolbar
          zoom={store.zoom}
          onZoomIn={() => store.setZoom(store.zoom + 0.1)}
          onZoomOut={() => store.setZoom(store.zoom - 0.1)}
          onResetZoom={() => {
            store.setZoom(1)
            store.setOffset({ x: 0, y: 0 })
          }}
          undo={store.undo}
          redo={store.redo}
          canUndo={store.canUndo}
          canRedo={store.canRedo}
          onVoiceCommand={handleVoiceCommand}
          voiceStatus={voiceStatus}
        />

        <div className="absolute top-6 left-6 right-6 flex items-center justify-between pointer-events-none">
          <motion.div 
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="flex flex-col"
          >
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {workflow.title || 'Customer Onboarding Flow'}
            </h1>
            <div className="flex items-center gap-2">
              <p className="text-xs text-slate-500 font-medium">
                Last edited {getLastEditedText()}
              </p>
              {pipelineStatus === 'active' && (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-green-600">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  Active
                </span>
              )}
              {voiceStatus !== 'idle' && (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-red-600">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  {voiceStatus === 'listening' ? 'Listening...' : 
                   voiceStatus === 'thinking' ? 'Processing...' : 
                   'Speaking...'}
                </span>
              )}
            </div>
          </motion.div>

          <div className="flex items-center gap-2 pointer-events-auto">
            <div className="flex -space-x-2 mr-4">
              {[1, 2, 3].map((i) => (
                <div 
                  key={i}
                  className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600 shadow-sm"
                  title={`User ${i}`}
                >
                  U{i}
                </div>
              ))}
            </div>
            
            {pipelineStatus === 'idle' ? (
              <button 
                onClick={handleLaunchPipeline}
                disabled={store.blocks.length === 0}
                className="h-10 px-5 bg-slate-900 text-white shadow-lg shadow-slate-200 rounded-xl text-sm font-bold hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Play size={16} />
                Launch Pipeline
              </button>
            ) : pipelineStatus === 'launching' ? (
              <button 
                disabled
                className="h-10 px-5 bg-slate-900 text-white shadow-lg shadow-slate-200 rounded-xl text-sm font-bold flex items-center gap-2 opacity-70"
              >
                <Loader2 size={16} className="animate-spin" />
                Launching...
              </button>
            ) : (
              <button 
                onClick={handleStopPipeline}
                className="h-10 px-5 bg-red-600 text-white shadow-lg shadow-red-200 rounded-xl text-sm font-bold hover:bg-red-700 transition-all active:scale-95 flex items-center gap-2"
              >
                <Square size={16} />
                Stop Pipeline
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}