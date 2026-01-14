// src/lib/hooks/usePipelineStore.ts
import { create } from 'zustand'
import { BlockData, BlockType, isConditionBlock } from '../../../types/pipeline'
import { BLOCK_DEFINITIONS } from '../blocks/blockDefinitions'

interface PipelineState {
  blocks: BlockData[]
  zoom: number
  offset: { x: number; y: number }
  history: BlockData[][]
  historyIndex: number
  isInitializing: boolean
  placeholderIndex: number | null // NEW: Track where placeholder is
  
  setBlocks: (blocks: BlockData[], skipHistory?: boolean) => void
  addBlock: (type: BlockType, index?: number) => void
  addPlaceholder: (index: number) => void // NEW
  removePlaceholder: () => void // NEW
  replacePlaceholder: (type: BlockType) => void // NEW
  removeBlock: (id: string) => void
  setZoom: (zoom: number) => void
  setOffset: (offset: { x: number; y: number }) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
}

const MAX_HISTORY = 50

const generateId = () => `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

const PLACEHOLDER_BLOCK: BlockData = {
  id: 'placeholder-temp',
  type: 'placeholder' as any,
  title: 'Placeholder',
  description: 'Choose a block',
  isSystemGenerated: true,
}

export const usePipelineStore = create<PipelineState>((set, get) => ({
  blocks: [],
  zoom: 1,
  offset: { x: 0, y: 0 },
  history: [[]],
  historyIndex: 0,
  canUndo: false,
  canRedo: false,
  isInitializing: false,
  placeholderIndex: null,

  setBlocks: (blocks, skipHistory = false) => {
    if (skipHistory) {
      set({ blocks, isInitializing: false })
    } else {
      const { history, historyIndex } = get()
      const newHistory = [...history.slice(0, historyIndex + 1), blocks].slice(-MAX_HISTORY)
      
      set({
        blocks,
        history: newHistory,
        historyIndex: newHistory.length - 1,
        canUndo: newHistory.length > 1,
        canRedo: false,
      })
    }
  },

  addPlaceholder: (index) => {
    const { blocks } = get()
    const newBlocks = [...blocks]
    newBlocks.splice(index, 0, PLACEHOLDER_BLOCK)
    
    set({
      blocks: newBlocks,
      placeholderIndex: index,
    })
  },

  removePlaceholder: () => {
    const { blocks, placeholderIndex } = get()
    if (placeholderIndex === null) return
    
    const newBlocks = blocks.filter(b => b.id !== 'placeholder-temp')
    
    set({
      blocks: newBlocks,
      placeholderIndex: null,
    })
  },

  replacePlaceholder: (type) => {
    const { blocks, placeholderIndex, history, historyIndex } = get()
    if (placeholderIndex === null) return
    
    const blockDef = BLOCK_DEFINITIONS.find(b => b.type === type)
    let newBlocks = [...blocks]
    
    // Remove placeholder
    const indexOfPlaceholder = newBlocks.findIndex(b => b.id === 'placeholder-temp')
    if (indexOfPlaceholder === -1) return
    
    newBlocks = newBlocks.filter(b => b.id !== 'placeholder-temp')
    
    // If it's a condition block, add TWO blocks at the placeholder position
    if (blockDef?.isCondition) {
      const conditionId = generateId()
      
      const conditionBlock: BlockData = {
        id: conditionId,
        type,
        title: blockDef.label,
        description: blockDef.description,
      }
      
      const endMarker: BlockData = {
        id: `${conditionId}-end`,
        type: 'condition-end-marker' as any,
        title: `End of ${blockDef.label}`,
        description: 'Paths merge here',
        isSystemGenerated: true,
        parentConditionId: conditionId,
      }
      
      newBlocks.splice(indexOfPlaceholder, 0, conditionBlock, endMarker)
    } else {
      // Normal block
      const newBlock: BlockData = {
        id: generateId(),
        type,
        title: blockDef?.label || type,
        description: blockDef?.description || 'Configure this block',
      }
      
      newBlocks.splice(indexOfPlaceholder, 0, newBlock)
    }
    
    const newHistory = [...history.slice(0, historyIndex + 1), newBlocks].slice(-MAX_HISTORY)
    
    set({
      blocks: newBlocks,
      placeholderIndex: null,
      history: newHistory,
      historyIndex: newHistory.length - 1,
      canUndo: true,
      canRedo: false,
    })
  },

  addBlock: (type, index) => {
    const { blocks, history, historyIndex, placeholderIndex } = get()
    
    // If there's a placeholder active, replace it instead
    if (placeholderIndex !== null) {
      get().replacePlaceholder(type)
      return
    }
    
    // Otherwise, normal add behavior
    const blockDef = BLOCK_DEFINITIONS.find(b => b.type === type)
    
    let newBlocks = [...blocks]
    
    if (blockDef?.isCondition) {
      const conditionId = generateId()
      
      const conditionBlock: BlockData = {
        id: conditionId,
        type,
        title: blockDef.label,
        description: blockDef.description,
      }
      
      const endMarker: BlockData = {
        id: `${conditionId}-end`,
        type: 'condition-end-marker' as any,
        title: `End of ${blockDef.label}`,
        description: 'Paths merge here',
        isSystemGenerated: true,
        parentConditionId: conditionId,
      }
      
      if (index !== undefined) {
        newBlocks.splice(index, 0, conditionBlock, endMarker)
      } else {
        newBlocks.push(conditionBlock, endMarker)
      }
    } else {
      const newBlock: BlockData = {
        id: generateId(),
        type,
        title: blockDef?.label || type,
        description: blockDef?.description || 'Configure this block',
      }
      
      if (index !== undefined) {
        newBlocks.splice(index, 0, newBlock)
      } else {
        newBlocks.push(newBlock)
      }
    }
    
    const newHistory = [...history.slice(0, historyIndex + 1), newBlocks].slice(-MAX_HISTORY)
    
    set({
      blocks: newBlocks,
      history: newHistory,
      historyIndex: newHistory.length - 1,
      canUndo: true,
      canRedo: false,
    })
  },

  removeBlock: (id) => {
    const { blocks, history, historyIndex } = get()
    const block = blocks.find(b => b.id === id)
    
    let newBlocks = [...blocks]
    
    if (block && isConditionBlock(block.type)) {
      const endMarkerId = `${block.id}-end`
      newBlocks = blocks.filter(b => b.id !== id && b.id !== endMarkerId)
    }
    else if (block?.type === 'condition-end-marker' && block.parentConditionId) {
      newBlocks = blocks.filter(b => b.id !== id && b.id !== block.parentConditionId)
    }
    else {
      newBlocks = blocks.filter(b => b.id !== id)
    }
    
    const newHistory = [...history.slice(0, historyIndex + 1), newBlocks].slice(-MAX_HISTORY)
    
    set({
      blocks: newBlocks,
      history: newHistory,
      historyIndex: newHistory.length - 1,
      canUndo: true,
      canRedo: false,
    })
  },

  setZoom: (zoom) => set({ zoom: Math.max(0.4, Math.min(2, zoom)) }),
  
  setOffset: (offset) => set({ offset }),

  undo: () => {
    const { history, historyIndex } = get()
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1
      set({
        blocks: history[newIndex],
        historyIndex: newIndex,
        canUndo: newIndex > 0,
        canRedo: true,
      })
    }
  },

  redo: () => {
    const { history, historyIndex } = get()
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1
      set({
        blocks: history[newIndex],
        historyIndex: newIndex,
        canUndo: true,
        canRedo: newIndex < history.length - 1,
      })
    }
  },
}))