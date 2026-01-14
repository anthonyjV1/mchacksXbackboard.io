// src/components/pipeline/PipelineRail.tsx
'use client';

import React, { useState } from 'react';
import { Reorder, motion, AnimatePresence } from 'framer-motion';
import { Block } from './Blocks';
import { ConditionEndMarker } from './ConditionBlocks';
import { PlaceholderBlock } from './PlaceholderBlock';
import { BlockData } from '../../../types/pipeline';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PipelineRailProps {
  blocks: BlockData[];
  onReorder: (newBlocks: BlockData[]) => void;
  onRemove: (id: string) => void;
  onAddPlaceholder: (index: number) => void;
  onRemovePlaceholder: () => void;
  onUpdateBlock?: (id: string, data: Partial<BlockData>) => void;
  onOpenPanel?: (blockId: string) => void;
  selectedBlockId?: string;
  workspaceId?: string; 
}

export function PipelineRail({ blocks, onReorder, onRemove, onAddPlaceholder, onRemovePlaceholder, onUpdateBlock, onOpenPanel, selectedBlockId, workspaceId }: PipelineRailProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  return (
    <div 
      className="flex flex-col items-center py-32 min-h-screen"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* The Central Rail Line */}
      <div className="absolute top-0 bottom-0 w-1 bg-slate-100 left-1/2 -translate-x-1/2 pointer-events-none" />

      <Reorder.Group
        axis="y"
        values={blocks}
        onReorder={onReorder}
        className="flex flex-col items-center relative z-10"
      >
        <AnimatePresence mode="popLayout">
          {blocks.map((block, index) => (
            <div key={block.id} className="contents">
              {/* Insert Gap */}
              <div className="group/gap relative w-72 h-8 flex items-center justify-center -my-4 z-30">
                <motion.div 
                  initial={{ scale: 0, opacity: 0 }}
                  whileHover={{ scale: 1, opacity: 1 }}
                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                >
                  <div className="w-full h-[2px] bg-blue-400/30 blur-sm" />
                </motion.div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddPlaceholder(index);
                  }}
                  className="w-8 h-8 rounded-full bg-white border-2 border-slate-100 shadow-sm flex items-center justify-center opacity-0 group-hover/gap:opacity-100 transition-all hover:scale-125 hover:border-blue-400 hover:text-blue-500 active:scale-90 z-40"
                >
                  <Plus size={16} strokeWidth={3} />
                </button>
              </div>

              {/* Wrap EVERYTHING in Reorder.Item - including placeholder */}
              <Reorder.Item
                value={block}
                id={block.id}
                onDragStart={() => setActiveId(block.id)}
                onDragEnd={() => setActiveId(null)}
                // Disable dragging for placeholder
                dragListener={block.type !== 'placeholder'}
                className={cn(
                  "relative z-20 transition-all duration-300",
                  activeId && activeId !== block.id ? "opacity-30 blur-[1px] scale-95" : ""
                )}
              >
                {block.type === 'placeholder' ? (
                  <PlaceholderBlock 
                    onCancel={onRemovePlaceholder}
                    isDragging={activeId === block.id}
                  />
                ) : block.type === 'condition-end-marker' ? (
                  <ConditionEndMarker 
                    conditionName={block.title.replace('End of ', '')}
                    blockId={block.id}
                    isDragging={activeId === block.id}
                    onDelete={onRemove}
                  />
                ) : (
                  <Block 
                    data={block} 
                    isDragging={activeId === block.id}
                    onDelete={onRemove}
                    onUpdate={onUpdateBlock}
                    onOpenPanel={onOpenPanel}
                    isSelected={selectedBlockId === block.id}
                    workspaceId={workspaceId}
                  />
                )}
              </Reorder.Item>
            </div>
          ))}
        </AnimatePresence>
      </Reorder.Group>

      {/* End of rail add button */}
      <motion.button
        layout
        whileHover={{ scale: 1.02, y: -2 }}
        whileTap={{ scale: 0.98 }}
        onClick={(e) => {
          e.stopPropagation();
          onAddPlaceholder(blocks.length);
        }}
        className="mt-8 w-72 h-16 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center gap-3 text-slate-400 hover:border-blue-200 hover:text-blue-500 hover:bg-blue-50/30 transition-all group bg-white/50 backdrop-blur-sm relative z-10"
      >
        <div className="p-1.5 rounded-lg border-2 border-slate-100 group-hover:border-blue-200 transition-colors">
          <Plus size={18} strokeWidth={3} />
        </div>
        <span className="text-sm font-bold tracking-tight">Add Step</span>
      </motion.button>
    </div>
  );
}