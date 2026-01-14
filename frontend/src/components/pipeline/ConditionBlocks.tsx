// src/components/pipeline/ConditionBlocks.tsx
'use client';
import React from 'react';
import { motion } from 'framer-motion';
import { MoveRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConditionEndMarkerProps {
  conditionName: string;
  onDelete?: (id: string) => void;
  blockId: string;
  isDragging?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function ConditionEndMarker({ 
  conditionName, 
  onDelete,
  blockId,
  isDragging,
  className, 
  style 
}: ConditionEndMarkerProps) {
  return (
    <motion.div
      layout
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      whileHover={{ y: -2, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      style={style}
      className={cn(
        "relative w-75 p-2 rounded-2xl border-2 border-dashed border-orange-300 bg-gradient-to-r from-blue-50/50 via-white to-blue-50/50 select-none shadow-sm group",
        isDragging && "opacity-40 shadow-2xl scale-105 rotate-2 cursor-grabbing",
        !isDragging && "cursor-grab",
        className
      )}
    >
      {/* Top connector */}
      <div className="absolute -top-[12px] left-1/2 -translate-x-1/2 w-12 h-6 flex items-center justify-center overflow-hidden z-20 pointer-events-none">
        <div className="w-8 h-8 bg-white border-1 rounded-full -mt-4" />
      </div>

      {/* Bottom connector */}
      <div className="absolute -bottom-[12px] left-1/2 -translate-x-1/2 w-12 h-6 flex items-center justify-center overflow-hidden z-20 pointer-events-none">
        <div className="w-8 h-8 bg-[#fafafa] border rounded-full mb-[-16px]" />
      </div>

      <div className="relative flex items-center justify-between h-full gap-3">
        <div className="flex items-center gap-3 flex-1">
          <div className="p-2 rounded-xl bg-gradient-to-br from-orange-100 to-orange-200 border border-orange-200 shadow-sm group-hover:scale-110 transition-transform">
            <MoveRight className="w-4 h-4 text-purple-600" strokeWidth={2.5} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-purple-900 truncate">
              End of {conditionName}
            </p>
          </div>
        </div>

        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(blockId);
            }}
            className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 hover:text-red-500 rounded-lg text-slate-400 transition-all active:scale-90"
          >
            <X size={14} strokeWidth={3} />
          </button>
        )}
      </div>
    </motion.div>
  );
}