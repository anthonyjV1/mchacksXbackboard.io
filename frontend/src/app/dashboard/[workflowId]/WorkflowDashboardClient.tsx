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

// Hooks
import { usePipelineSave } from '@/lib/hooks/usePipelineSave'
import { useGmailSync } from '@/lib/hooks/useGmailSync'
import { usePipelineStatus } from '@/lib/hooks/usePipelineStatus'
import { useVoiceCommand } from '@/lib/hooks/useVoiceCommand'

// API
import { launchPipeline, stopPipeline, validatePipelineLaunch } from '@/lib/pipelineApi'

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
  const isInitialized = useRef(false)
  
  const [selectedBlockId, setSelectedBlockId] = useState<string>('')
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const offsetBeforePanel = useRef<{ x: number; y: number } | null>(null)
  const [userId, setUserId] = useState<string>('')
  
  const store = usePipelineStore()
  
  // Custom hooks
  const { status: pipelineStatus, setStatus: setPipelineStatus } = usePipelineStatus(workflow.id)
  
  const { voiceStatus, handleVoiceCommand } = useVoiceCommand(
    userId,
    workflow.id,
    (blockTypes) => store.createWorkflowFromTemplate(blockTypes)
  )
  
  usePipelineSave(store.blocks, workflow.id, isInitialized.current)
  
  useGmailSync(
    store.blocks,
    workflow.id,
    userId,
    isInitialized.current,
    (blocks) => store.setBlocks(blocks)
  )

  // Get user ID
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserId(user.id)
    }
    getUser()
  }, [supabase])

  // Load workspace blocks
  useEffect(() => {
    if (lastWorkflowId.current !== workflow.id) {
      console.log('Loading workspace:', workflow.id)
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
        console.log('Loaded blocks:', formattedBlocks)
        store.setBlocks(formattedBlocks, true)
      } else {
        console.log('Empty workspace')
        store.setBlocks([], true)
      }
      
      isInitialized.current = true
    }
  }, [workflow.id, initialBlocks, store])

  // Panel management
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

  // Pipeline actions
  const handleLaunchPipeline = async () => {
    if (!userId) {
      alert('⏳ Please wait, loading user information...')
      return
    }

    const validationError = validatePipelineLaunch(store.blocks)
    if (validationError) {
      alert(`${validationError}`)
      return
    }

    setPipelineStatus('launching')
    
    try {
      console.log('Launching pipeline with user_id:', userId)
      
      const data = await launchPipeline(workflow.id, userId)
      
      console.log('Pipeline launched:', data)
      setPipelineStatus('active')
      alert('Pipeline is now active and monitoring for emails!')
    } catch (error: any) {
      console.error('Launch failed:', error)
      
      let errorMessage = error.message
      if (errorMessage.includes('Gmail')) {
        errorMessage += '\n\nPlease connect your Gmail account first by adding a Gmail integration block.'
      }
      
      alert(`Failed to launch:\n\n${errorMessage}`)
      setPipelineStatus('idle')
    }
  }

  const handleStopPipeline = async () => {
    if (!userId) return
    
    try {
      const data = await stopPipeline(workflow.id, userId)
      
      console.log('⏹Pipeline stopped:', data)
      setPipelineStatus('idle')
      alert('Pipeline stopped successfully')
    } catch (error: any) {
      console.error('Stop failed:', error)
      alert(`Failed to stop: ${error.message}`)
    }
  }

  // Helper function
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