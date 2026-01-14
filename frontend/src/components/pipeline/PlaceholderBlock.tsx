import React from 'react';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlaceholderBlockProps {
  onCancel: () => void;
  isDragging?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function PlaceholderBlock({ onCancel, isDragging, className, style }: PlaceholderBlockProps) {
  const handleCancel = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onCancel();
  };

  return (
    <motion.div
      layout
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ 
        scale: 1, 
        opacity: 1,
      }}
      exit={{ scale: 0.9, opacity: 0 }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      style={style}
      className={cn(
        "relative w-72 h-28 rounded-2xl border-2 border-dashed bg-gradient-to-br from-orange-50 via-purple-50 to-pink-50 select-none group cursor-default",
        "border-orange-300 shadow-lg",
        isDragging && "opacity-40",
        className
      )}
    >
      {/* Animated glow */}
      <div className="absolute inset-0 rounded-2xl overflow-hidden">
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-blue-400/20 via-purple-400/20 to-pink-400/20"
          animate={{
            x: ['-100%', '100%'],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "linear"
          }}
        />
      </div>

      {/* Top connector */}
      <div className="absolute -top-[12px] left-1/2 -translate-x-1/2 w-12 h-6 flex items-center justify-center overflow-hidden z-20 pointer-events-none">
        <div className="w-8 h-8 bg-white border-1 rounded-full -mt-4" />
      </div>

      {/* Bottom connector */}
      <div className="absolute -bottom-[12px] left-1/2 -translate-x-1/2 w-12 h-6 flex items-center justify-center overflow-hidden z-20 pointer-events-none">
        <div className="w-8 h-8 bg-[#fafafa] border rounded-full mb-[-16px]" />
      </div>

      <div className="relative h-full flex flex-col items-center justify-center gap-2 p-4 z-10">
        <motion.div
          animate={{
            rotate: [0, 360],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="p-3 rounded-2xl bg-gradient-to-br from-orange-400 to-purple-500 shadow-lg"
        >
          <Plus className="w-6 h-6 text-white" strokeWidth={2.5} />
        </motion.div>

        <div className="text-center">
          <p className="text-sm font-bold text-slate-700 mb-1">
            Choose a block from sidebar
          </p>
        </div>

        {/* Cancel button with proper event handling and pointer-events */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleCancel}
          onMouseDown={(e) => e.stopPropagation()} // Prevent drag from starting
          className="absolute top-2 right-2 w-6 h-6 rounded-lg bg-white/80 backdrop-blur-sm border border-slate-200 flex items-center justify-center hover:bg-red-50 hover:border-red-300 hover:text-red-500 text-slate-400 transition-all pointer-events-auto z-50"
        >
          <Plus className="w-3 h-3 rotate-45" strokeWidth={3} />
        </motion.button>

        {/* Pulse animation around border */}
        <motion.div
          className="absolute inset-0 rounded-2xl border-2 border-purple-400 pointer-events-none"
          animate={{
            opacity: [0.3, 0.6, 0.3],
            scale: [0.98, 1, 0.98],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </div>
    </motion.div>
  );
}