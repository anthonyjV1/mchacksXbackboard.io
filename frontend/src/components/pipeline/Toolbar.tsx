// Toolbar.tsx
'use client';
import React, { useState } from 'react';
import { 
  Undo2, 
  Redo2, 
  Plus, 
  Minus, 
  Maximize, 
  Download,
  Share2,
  MousePointer2,
  Mic,
  MicOff,
  Loader2
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ToolbarProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onVoiceCommand?: (transcript: string) => void;
}

export function Toolbar({ 
  zoom, 
  onZoomIn, 
  onZoomOut, 
  onResetZoom, 
  undo, 
  redo, 
  canUndo, 
  canRedo,
  onVoiceCommand
}: ToolbarProps) {
  const [voiceStatus, setVoiceStatus] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');

  const handleMicClick = () => {
    if (voiceStatus !== 'idle') {
      // Already active, do nothing
      return;
    }
    // Trigger voice command via parent component
    onVoiceCommand?.('');
  };

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 p-1.5 bg-white border shadow-xl rounded-2xl z-40">
      <div className="flex items-center gap-1 px-1 border-r">
        <ToolbarButton 
          icon={Undo2} 
          onClick={undo} 
          disabled={!canUndo} 
          tooltip="Undo (Ctrl+Z)"
        />
        <ToolbarButton 
          icon={Redo2} 
          onClick={redo} 
          disabled={!canRedo} 
          tooltip="Redo (Ctrl+Y)"
        />
      </div>

      <div className="flex items-center gap-1 px-1 border-r">
        <ToolbarButton 
          icon={Minus} 
          onClick={onZoomOut} 
          tooltip="Zoom Out"
        />
        <div className="w-12 text-center text-[11px] font-bold text-slate-500 tabular-nums">
          {Math.round(zoom * 100)}%
        </div>
        <ToolbarButton 
          icon={Plus} 
          onClick={onZoomIn} 
          tooltip="Zoom In"
        />
        <ToolbarButton 
          icon={Maximize} 
          onClick={onResetZoom} 
          tooltip="Reset View"
        />
      </div>

      {/* Voice Command Button */}
      <div className="flex items-center gap-1 px-1 border-r">
        <motion.button
          whileTap={{ scale: voiceStatus === 'idle' ? 0.9 : 1 }}
          onClick={handleMicClick}
          disabled={voiceStatus !== 'idle'}
          className={cn(
            "p-2 rounded-xl transition-all relative",
            voiceStatus === 'idle' && "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
            voiceStatus === 'listening' && "text-red-500 bg-red-50",
            voiceStatus === 'thinking' && "text-blue-500 bg-blue-50",
            voiceStatus === 'speaking' && "text-green-500 bg-green-50"
          )}
          title={
            voiceStatus === 'idle' ? 'Voice Command' :
            voiceStatus === 'listening' ? 'Listening...' :
            voiceStatus === 'thinking' ? 'Processing...' :
            'Assistant speaking...'
          }
        >
          {voiceStatus === 'idle' && <Mic size={18} />}
          {voiceStatus === 'listening' && (
            <>
              <Mic size={18} />
              <motion.span
                className="absolute inset-0 rounded-xl bg-red-500"
                animate={{ opacity: [0.3, 0.1, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            </>
          )}
          {voiceStatus === 'thinking' && <Loader2 size={18} className="animate-spin" />}
          {voiceStatus === 'speaking' && <Mic size={18} />}
        </motion.button>
      </div>

      <div className="flex items-center gap-1 px-1">
        <button className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors active:scale-95 shadow-sm">
          <Share2 size={14} />
          Publish
        </button>
      </div>
    </div>
  );
}

function ToolbarButton({ 
  icon: Icon, 
  onClick, 
  disabled, 
  className,
  tooltip
}: { 
  icon: any; 
  onClick?: () => void; 
  disabled?: boolean;
  className?: string;
  tooltip?: string;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "p-2 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all disabled:opacity-30 disabled:hover:bg-transparent",
        className
      )}
      title={tooltip}
    >
      <Icon size={18} />
    </motion.button>
  );
}