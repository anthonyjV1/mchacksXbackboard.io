// Toolbar.tsx
'use client';
import React from 'react';
import { 
  Undo2, 
  Redo2, 
  Plus, 
  Minus, 
  Maximize, 
  Share2,
  Mic,
  MicOff
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
  onVoiceCommand: () => void;
  voiceStatus: 'idle' | 'listening' | 'thinking' | 'speaking';
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
  onVoiceCommand,
  voiceStatus
}: ToolbarProps) {
  const isVoiceActive = voiceStatus !== 'idle';

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
          whileTap={{ scale: 0.9 }}
          onClick={onVoiceCommand}
          className={cn(
            "p-2 rounded-xl transition-all relative",
            isVoiceActive 
              ? "bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-200" 
              : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
          )}
          title={
            voiceStatus === 'idle' ? 'Start Voice Command' :
            voiceStatus === 'listening' ? 'Stop Listening...' :
            voiceStatus === 'thinking' ? 'Stop Processing...' :
            'Stop Speaking...'
          }
        >
          {isVoiceActive ? (
            <>
              <MicOff size={18} className="animate-pulse" />
              {voiceStatus === 'listening' && (
                <motion.span
                  className="absolute inset-0 rounded-xl bg-red-400"
                  animate={{ opacity: [0.3, 0.1, 0.3] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              )}
            </>
          ) : (
            <Mic size={18} />
          )}
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