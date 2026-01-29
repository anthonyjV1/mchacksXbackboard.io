// src/components/pipeline/modals/condition-email-receivedModal.tsx
'use client';
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Mail, Filter, Save } from 'lucide-react';
import { BlockData } from '../../../../types/pipeline';

interface ConditionEmailReceivedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<BlockData>) => void;
  blockData: BlockData;
  workspaceId: string;
}

export function ConditionEmailReceivedModal({
  isOpen,
  onClose,
  onSave,
  blockData,
  workspaceId
}: ConditionEmailReceivedModalProps) {
  const [settings, setSettings] = useState({
    senderEmail: '',
    subjectContains: '',
    hasAttachment: false,
  });

  // In ConditionEmailReceivedModal, update handleSave:
  const handleSave = async () => {
    // Save to backend
    await fetch(`http://localhost:8000/blocks/${blockData.id}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: workspaceId, // Pass this as prop
        config: settings
      })
    })
    
    onSave({
      title: blockData.title,
      description: settings.senderEmail 
        ? `From: ${settings.senderEmail}` 
        : blockData.description
    })
    onClose()
  }

  

  if (!isOpen) return null;

  console.log('ConditionEmailReceivedModal rendering, isOpen:', isOpen);

  const modalContent = (
    <>
      {/* Subtle backdrop */}
      <div 
        className="fixed inset-0 bg-black/10 z-[100] transition-opacity duration-300"
        onClick={onClose}
      />
      
      {/* Slide-in Panel - fixed to viewport */}
      <div 
        className="fixed top-20 right-6 bottom-24 w-[420px] bg-white shadow-2xl rounded-2xl z-[101] flex flex-col animate-in slide-in-from-right duration-300 border border-slate-200"
      >
        
        {/* Header */}
        <div className="p-6 border-b border-slate-200 shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg">
                <Mail size={22} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Email Received
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  Configure email condition settings
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors -mt-1 -mr-1"
            >
              <X size={20} className="text-slate-400" />
            </button>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Sender Email Field */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Sender Email Address
            </label>
            <input
              type="email"
              value={settings.senderEmail}
              onChange={(e) => setSettings({ ...settings, senderEmail: e.target.value })}
              placeholder="example@domain.com"
              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm"
            />
            <p className="text-xs text-slate-500 mt-2">
              Leave empty to trigger on emails from any sender
            </p>
          </div>

          {/* Subject Contains Field */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Subject Contains
            </label>
            <input
              type="text"
              value={settings.subjectContains}
              onChange={(e) => setSettings({ ...settings, subjectContains: e.target.value })}
              placeholder="Enter keywords..."
              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm"
            />
            <p className="text-xs text-slate-500 mt-2">
              Filter emails by subject line keywords
            </p>
          </div>

          {/* Has Attachment Toggle */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">
              Attachment Requirements
            </label>
            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <input
                type="checkbox"
                id="hasAttachment"
                checked={settings.hasAttachment}
                onChange={(e) => setSettings({ ...settings, hasAttachment: e.target.checked })}
                className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="hasAttachment" className="text-sm font-medium text-slate-700 cursor-pointer flex-1">
                Email must have an attachment
              </label>
            </div>
          </div>

          {/* Info Box */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex gap-2">
              <Filter size={16} className="text-blue-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-blue-900 mb-1">
                  Filter Logic
                </p>
                <p className="text-xs text-blue-700 leading-relaxed">
                  All conditions you set must be met for this block to trigger. Leave fields empty to skip that condition.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer - Fixed */}
        <div className="p-6 border-t border-slate-200 bg-slate-50 shrink-0">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-3 text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-xl transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2"
            >
              <Save size={16} />
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(modalContent, document.body);
}