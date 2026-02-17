// hooks/useGmailSync.ts
'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BlockData } from '../../../types/pipeline'

export function useGmailSync(
  blocks: BlockData[],
  workflowId: string,
  userId: string | null,
  isInitialized: boolean,
  onBlocksUpdate: (blocks: BlockData[]) => void
) {
  const supabase = createClient()
  const previousBlocksRef = useRef<BlockData[]>([])

  // Detect Gmail block deletion and disconnect
  useEffect(() => {
    const checkGmailBlockDeleted = async () => {
      if (!userId || !isInitialized) return

      const previousGmailBlock = previousBlocksRef.current.find(b => b.type === 'integration-gmail')
      const currentGmailBlock = blocks.find(b => b.type === 'integration-gmail')

      if (previousGmailBlock && !currentGmailBlock) {
        console.log('🔌 Gmail integration block deleted - disconnecting Gmail')
        
        try {
          const { error } = await supabase
            .from('user_oauth_credentials')
            .delete()
            .eq('user_id', userId)
            .eq('provider', 'gmail')

          if (error) {
            console.error('Error disconnecting Gmail:', error)
          } else {
            console.log('Gmail disconnected successfully')
          }
        } catch (error) {
          console.error('Error disconnecting Gmail:', error)
        }
      }

      previousBlocksRef.current = [...blocks]
    }

    checkGmailBlockDeleted()
  }, [blocks, userId, supabase, isInitialized])

  // Sync Gmail connection status on load
  useEffect(() => {
    const syncGmailStatus = async () => {
      if (!userId || !isInitialized) return

      const gmailBlock = blocks.find(b => b.type === 'integration-gmail')
      if (!gmailBlock) return

      console.log('Checking Gmail connection status on load...')

      try {
        const { data, error } = await supabase
          .from('user_oauth_credentials')
          .select('*')
          .eq('user_id', userId)
          .eq('provider', 'gmail')
          .maybeSingle()

        const isConnected = data && !error
        const currentDescription = gmailBlock.description || ''
        const expectedDescription = isConnected ? 'Connected' : 'Not connected'

        if (currentDescription !== expectedDescription) {
          console.log(`📝 Updating Gmail block: ${currentDescription} → ${expectedDescription}`)
          
          const updatedBlocks = blocks.map(block =>
            block.id === gmailBlock.id
              ? { ...block, description: expectedDescription }
              : block
          )
          onBlocksUpdate(updatedBlocks)
        } else {
          console.log('Gmail block status already correct:', expectedDescription)
        }
      } catch (error) {
        console.error('Error checking Gmail status:', error)
      }
    }

    const timer = setTimeout(syncGmailStatus, 500)
    return () => clearTimeout(timer)
  }, [workflowId, userId, blocks, supabase, isInitialized, onBlocksUpdate])
}