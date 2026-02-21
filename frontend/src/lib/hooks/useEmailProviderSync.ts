'use client'
import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BlockData } from '../../../types/pipeline'

export function useEmailProviderSync(
  blocks: BlockData[],
  workflowId: string,
  userId: string | null,
  isInitialized: boolean,
  onBlocksUpdate: (blocks: BlockData[]) => void
) {
  const supabase = createClient()
  const previousBlocksRef = useRef<BlockData[]>([])
  const syncedRef = useRef(false)

  // Detect integration block deletion and disconnect
  useEffect(() => {
    const checkBlocksDeleted = async () => {
      if (!userId || !isInitialized) return

      for (const provider of ['gmail', 'outlook']) {
        const blockType = `integration-${provider}`
        const previousBlock = previousBlocksRef.current.find(b => b.type === blockType)
        const currentBlock = blocks.find(b => b.type === blockType)

        if (previousBlock && !currentBlock) {
          console.log(`🔌 ${provider} block deleted - disconnecting`)
          await supabase.from('user_oauth_credentials')
            .delete()
            .eq('user_id', userId)
            .eq('provider', provider)
        }
      }

      previousBlocksRef.current = [...blocks]
    }

    checkBlocksDeleted()
  }, [blocks, userId, isInitialized])

  // Sync connection status on load - only once per workflowId
  useEffect(() => {
    syncedRef.current = false
  }, [workflowId])

  useEffect(() => {
    const syncStatuses = async () => {
      if (!userId || !isInitialized || syncedRef.current) return

      const integrationBlocks = blocks.filter(b => 
        b.type === 'integration-gmail' || b.type === 'integration-outlook'
      )
      if (integrationBlocks.length === 0) return

      syncedRef.current = true

      let needsUpdate = false
      const updatedBlocks = [...blocks]

      for (const block of integrationBlocks) {
        const provider = block.type === 'integration-gmail' ? 'gmail' : 'outlook'
        
        const { data, error } = await supabase
          .from('user_oauth_credentials')
          .select('*')
          .eq('user_id', userId)
          .eq('provider', provider)
          .maybeSingle()

        const expectedDescription = data && !error ? 'Connected' : 'Not connected'
        
        if (block.description !== expectedDescription) {
          const idx = updatedBlocks.findIndex(b => b.id === block.id)
          updatedBlocks[idx] = { ...updatedBlocks[idx], description: expectedDescription }
          needsUpdate = true
        }
      }

      if (needsUpdate) {
        onBlocksUpdate(updatedBlocks)
      }
    }

    const timer = setTimeout(syncStatuses, 500)
    return () => clearTimeout(timer)
  }, [workflowId, userId, isInitialized])
}