// src/components/pipeline/Blocks.tsx
'use client';
import React, { useState, useEffect, memo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { BlockData, isConditionBlock } from '../../../types/pipeline';
import { cn } from '@/lib/utils';
import { BLOCK_DEFINITIONS } from '@/lib/blocks/blockDefinitions';
import { BlockModalManager } from './modals/BlockModalManager';
import { createClient } from '@/lib/supabase/client';

interface BlockProps {
  data: BlockData;
  isDragging?: boolean;
  onDelete?: (id: string) => void;
  onUpdate?: (id: string, data: Partial<BlockData>) => void;
  className?: string;
  style?: React.CSSProperties;
  onOpenPanel?: (blockId: string) => void;
  isSelected?: boolean;
  workspaceId?: string;
}

const BlockComponent = ({ data, isDragging, onDelete, onUpdate, className, style, onOpenPanel, isSelected, workspaceId }: BlockProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // CHECK FOR OAUTH RETURN
  useEffect(() => {
    // Only check for Gmail integration blocks
    if (data.type !== 'integration-gmail') return;
    
    const checkOAuthReturn = async () => {
      // Check if we just returned from OAuth
      const oauthFlag = localStorage.getItem('gmail_oauth_return');
      if (!oauthFlag) return;
      
      console.log('🔄 Block detected OAuth return, checking connection...');
      
      // Only remove flag once to prevent multiple blocks from checking
      const blockCheckKey = `gmail_oauth_checked_${data.id}`;
      if (localStorage.getItem(blockCheckKey)) return;
      localStorage.setItem(blockCheckKey, 'true');
      
      // Remove the main flag
      localStorage.removeItem('gmail_oauth_return');
      
      // Wait for backend
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      try {
        const { data: credentials } = await supabase
          .from('user_oauth_credentials')
          .select('*')
          .eq('provider', 'gmail')
          .maybeSingle();
        
        if (credentials && data.description !== 'Connected') {
          console.log('✅ Gmail connected! Updating block:', data.id);
          onUpdate?.(data.id, { description: 'Connected' });
          
          // Clean up check key after successful update
          setTimeout(() => {
            localStorage.removeItem(blockCheckKey);
          }, 1000);
        }
      } catch (error) {
        console.error('Error checking Gmail:', error);
        localStorage.removeItem(blockCheckKey);
      }
    };
    
    checkOAuthReturn();
  }, [data.type, data.id, data.description, onUpdate]);
  
  const blockDef = BLOCK_DEFINITIONS.find(b => b.type === data.type);
  
  if (!blockDef) {
    return (
      <div className="w-72 p-4 bg-red-50 border-2 border-red-200 rounded-2xl text-center">
        <p className="text-sm text-red-600 font-semibold">Unknown block type: {data.type}</p>
      </div>
    );
  }

  const Icon = blockDef.icon;
  const isCondition = isConditionBlock(data.type);

  const handleBlockClick = useCallback((e: React.MouseEvent) => {
    if (isDragging) return;
    setIsModalOpen(true);
    if (onOpenPanel) {
      onOpenPanel(data.id);
    }
  }, [isDragging, data.id, onOpenPanel]);

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    if (onOpenPanel) {
      onOpenPanel('');
    }
  }, [onOpenPanel]);

  const handleModalSave = useCallback((updatedData: Partial<BlockData>) => {
    if (onUpdate) {
      onUpdate(data.id, updatedData);
    }
    setIsModalOpen(false);
  }, [data.id, onUpdate]);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(data.id);
  }, [data.id, onDelete]);

  return (
    <>
      <motion.div
        layout
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        whileHover={{ y: -2, scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        style={style}
        onClick={handleBlockClick}
        data-block-id={data.id}
        className={cn(
          "relative w-72 p-4 rounded-2xl border bg-white shadow-sm transition-all duration-200 group select-none",
          isDragging && "opacity-40 shadow-2xl scale-105 rotate-2 cursor-grabbing",
          !isDragging && "cursor-pointer hover:shadow-md",
          isCondition && "border-2 w-75 border-orange-200 bg-gradient-to-br from-white to-violet-50",
          className,
          isSelected && "shadow-xl border-2 border-red-300",
        )}
      >
        {/* Puzzle Notches - Top (Input) */}
        <div className="absolute -top-[12px] left-1/2 -translate-x-1/2 w-12 h-6 flex items-center justify-center overflow-hidden z-20 pointer-events-none">
          <div className={cn(
            "w-8 h-8 border rounded-full -mt-4 shadow-inner",
            isCondition ? "bg-white" : "bg-white"
          )} />
        </div>

        {/* Puzzle Notches - Bottom (Output) */}
        <div className="absolute -bottom-[12px] left-1/2 -translate-x-1/2 w-12 h-6 flex items-center justify-center overflow-hidden z-20 pointer-events-none">
          <div className={cn(
            "w-8 h-8 border rounded-full mb-[-16px] group-hover:bg-white transition-colors",
            isCondition ? "bg-[#fafafa]" : "bg-[#fafafa]"
          )} />
        </div>

        <div className="flex items-start gap-3 relative z-10">
          <div className={cn(
            "p-2.5 rounded-xl shrink-0 transition-transform group-hover:scale-110 shadow-sm",
            `bg-gradient-to-br ${blockDef.gradient} text-white`
          )}>
            <Icon size={20} strokeWidth={2.5} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <h4 className="text-sm font-bold text-slate-900 truncate tracking-tight">
                {data.title}
              </h4>
              {onDelete && !data.isSystemGenerated && (
                <button
                  onClick={handleDelete}
                  className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 hover:text-red-500 rounded-lg text-slate-400 transition-all active:scale-90"
                >
                  <X size={14} strokeWidth={3} />
                </button>
              )}
            </div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
              {data.description || blockDef.description}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Modal */}
      <BlockModalManager
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSave={handleModalSave}
        blockData={data}
        workspaceId={workspaceId || ''}
      />
    </>
  );
}

// Memoize to prevent unnecessary re-renders
export const Block = memo(BlockComponent, (prevProps, nextProps) => {
  // Only re-render if these props change
  return (
    prevProps.data.id === nextProps.data.id &&
    prevProps.data.title === nextProps.data.title &&
    prevProps.data.description === nextProps.data.description &&
    prevProps.isDragging === nextProps.isDragging &&
    prevProps.isSelected === nextProps.isSelected
  );
});