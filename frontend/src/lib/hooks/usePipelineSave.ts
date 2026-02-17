// hooks/usePipelineSave.ts
'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BlockData } from '../../../types/pipeline'

export function usePipelineSave(
  blocks: BlockData[],
  workflowId: string,
  isInitialized: boolean
) {
  const supabase = createClient()
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isSaving = useRef(false)
  const lastWorkflowId = useRef<string | null>(null)

  useEffect(() => {
    if (!isInitialized) return

    // Remember which workflow we're saving for so the debounced save
    // callback can validate it's still relevant when it runs.
    lastWorkflowId.current = workflowId
    if (isSaving.current) return

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(async () => {
      if (lastWorkflowId.current !== workflowId) return

      const hasPlaceholder = blocks.some(b => b.type === 'placeholder')
      if (hasPlaceholder) return

      isSaving.current = true
      console.log('Saving', blocks.length, 'blocks...')

      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        
        if (userError || !user) {
          console.error('Auth error:', userError)
          isSaving.current = false
          return
        }

        // Delete existing blocks
        const { error: deleteError } = await supabase
          .from('pipeline_blocks')
          .delete()
          .eq('workspace_id', workflowId)

        if (deleteError) {
          console.error('Delete error:', deleteError)
          isSaving.current = false
          return
        }

        // Clean up orphaned block configs
        // Get current block IDs
        const currentBlockIds = blocks.map(b => b.id)
        
        if (currentBlockIds.length > 0) {
          // Delete configs for blocks that are no longer in the pipeline
          const { error: configDeleteError } = await supabase
            .from('block_configs')
            .delete()
            .eq('workspace_id', workflowId)
            .not('block_id', 'in', `(${currentBlockIds.join(',')})`)
          
          if (configDeleteError) {
            console.warn('Could not delete orphaned configs:', configDeleteError)
            // Continue anyway - not critical
          } else {
            console.log('Cleaned up orphaned block configs')
          }
        } else {
          // No blocks left - delete ALL configs for this workspace
          const { error: configDeleteError } = await supabase
            .from('block_configs')
            .delete()
            .eq('workspace_id', workflowId)
          
          if (configDeleteError) {
            console.warn('Could not delete configs:', configDeleteError)
          } else {
            console.log('Deleted all block configs (no blocks left)')
          }
        }

        // Insert new blocks
        if (blocks.length > 0) {
          const blocksToInsert = blocks.map((block, index) => ({
            workspace_id: workflowId,
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
            console.error('Insert error:', insertError)
            isSaving.current = false
            return
          }

          console.log('Saved successfully')
        }

        // Update workspace timestamp
        const { error: updateError } = await supabase
          .from('workspaces')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', workflowId)

        if (updateError) {
          console.error('Update error:', updateError)
        }

      } catch (error) {
        console.error('Save failed:', error)
      } finally {
        isSaving.current = false
      }
    }, 1000)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [blocks, workflowId, isInitialized, supabase])
}