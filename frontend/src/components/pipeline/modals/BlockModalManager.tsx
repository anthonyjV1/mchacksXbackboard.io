// src/components/pipeline/modals/BlockModalManager.tsx
'use client';
import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { BlockData } from '../../../../types/pipeline';
import { ConditionEmailReceivedModal } from './condition-email-receivedModal';
import { IntegrationGmailModal } from './integrations/integration-gmail';
import { ActionReplyEmailModal } from './actions/action-reply-email';
// Import other modals as you create them

interface BlockModalManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<BlockData>) => void;
  blockData: BlockData;
  workspaceId: string;
}

export function BlockModalManager({ isOpen, onClose, onSave, blockData, workspaceId}: BlockModalManagerProps) {
  if (!isOpen) return null;

  // Route to the appropriate modal based on block type
  switch (blockData.type) {
    case 'condition-email-received':
      return (
        <ConditionEmailReceivedModal
          isOpen={isOpen}
          onClose={onClose}
          onSave={onSave}
          blockData={blockData}
          workspaceId={workspaceId}
        />
      );
    
    case 'integration-gmail':
      return (
        <IntegrationGmailModal
          isOpen={isOpen}
          onClose={onClose}
          onSave={onSave}
          blockData={blockData}
          workspaceId={workspaceId}
        />
      );
    
    case 'action-reply-email':
      return (
        <ActionReplyEmailModal
          isOpen={isOpen}
          onClose={onClose}
          onSave={onSave}
          blockData={blockData}
          workspaceId={workspaceId}
        />
      );
    
    // Add more cases as you create more modals
    // case 'trigger-email-received':
    //   return <TriggerEmailReceivedModal ... />;
    // case 'action-send-email':
    //   return <ActionSendEmailModal ... />;
    
    default:
      // Fallback generic modal for blocks without specific modals
      return (
        <GenericBlockModal
          isOpen={isOpen}
          onClose={onClose}
          onSave={onSave}
          blockData={blockData}
          workspaceId={workspaceId}
        />
      );
  }
}

// Generic fallback modal
function GenericBlockModal({ isOpen, onClose, onSave, blockData }: BlockModalManagerProps) {
  if (!isOpen) return null;
  
  const modalContent = (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/10 z-[100] transition-opacity duration-300"
        onClick={onClose}
      />
      
      {/* Slide-in Panel */}
      <div className="fixed top-20 right-6 bottom-24 w-[420px] bg-white shadow-2xl rounded-2xl z-[101] flex flex-col animate-in slide-in-from-right duration-300 border border-slate-200">
        <div className="p-6 border-b border-slate-200 shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">
              Configure {blockData.title}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X size={20} className="text-slate-400" />
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          <p className="text-sm text-slate-600">
            Settings for this block type are not yet configured.
          </p>
        </div>
        
        <div className="p-6 border-t border-slate-200 bg-slate-50 shrink-0">
          <button
            onClick={onClose}
            className="w-full px-4 py-3 text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </>
  );

  return createPortal(modalContent, document.body);
}