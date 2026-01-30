// frontend/src/components/pipeline/modals/actions/action-reply-email.tsx
'use client';
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Reply, Sparkles, FileEdit, Send, AlertTriangle } from 'lucide-react';
import { BlockData } from '../../../../../types/pipeline';
import { createClient } from '@/lib/supabase/client';

interface ActionReplyEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<BlockData>) => void;
  blockData: BlockData;
  workspaceId: string;
}

export function ActionReplyEmailModal({
  isOpen,
  onClose,
  onSave,
  blockData,
  workspaceId
}: ActionReplyEmailModalProps) {
  const [customInstructions, setCustomInstructions] = useState('');
  const [draftMode, setDraftMode] = useState(true); // Default: enabled (safer)
  const [showWarning, setShowWarning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen && mounted) {
      loadConfig();
    }
  }, [isOpen, mounted]);

  const loadConfig = async () => {
    setLoading(true);
    
    try {
      const { data } = await supabase
        .from('block_configs')
        .select('config')
        .eq('workspace_id', workspaceId)
        .eq('block_id', blockData.id)
        .maybeSingle();
      
      if (data?.config) {
        setCustomInstructions(data.config.customInstructions || '');
        // Default to draft mode if not explicitly set
        setDraftMode(data.config.draftMode !== undefined ? data.config.draftMode : true);
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
    
    setLoading(false);
  };

  const handleDraftModeToggle = () => {
    if (draftMode) {
      // Turning OFF draft mode (enabling auto-send) - show warning
      setShowWarning(true);
    } else {
      // Turning ON draft mode - safe, no warning
      setDraftMode(true);
      setShowWarning(false);
    }
  };

  const confirmDisableDraftMode = () => {
    setDraftMode(false);
    setShowWarning(false);
  };

  const handleSave = async () => {
    setSaving(true);
    
    try {
      // Save to block_configs table
      const { error } = await supabase
        .from('block_configs')
        .upsert({
          workspace_id: workspaceId,
          block_id: blockData.id,
          config: {
            customInstructions,
            draftMode
          }
        });
      
      if (error) throw error;
      
      // Update block description to reflect mode
      let description = draftMode ? 'AI reply (Draft Mode)' : 'AI auto-reply';
      if (customInstructions) {
        description = draftMode 
          ? 'AI reply with custom instructions (Draft)' 
          : 'AI auto-reply with custom instructions';
      }
      
      onSave({
        description
      });
      
      onClose();
    } catch (error) {
      console.error('Error saving config:', error);
      alert('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <>
      <div 
        className="fixed inset-0 bg-black/10 z-[100] transition-opacity duration-300"
        onClick={onClose}
      />
      
      <div 
        className="fixed top-20 right-6 bottom-24 w-[460px] bg-white shadow-2xl rounded-2xl z-[101] flex flex-col animate-in slide-in-from-right duration-300 border border-slate-200"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-200 shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-400 to-teal-500 text-white shadow-lg">
                <Reply size={22} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  AI Reply to Email
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  Configure how AI responds to emails
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
            </div>
          ) : (
            <>
              {/* Draft Mode Toggle */}
              <div className="space-y-3">
                <label className="flex items-center justify-between cursor-pointer group">
                  <div className="flex items-center gap-3">
                    {draftMode ? (
                      <FileEdit size={20} className="text-blue-600" />
                    ) : (
                      <Send size={20} className="text-orange-600" />
                    )}
                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        {draftMode ? 'Draft Mode' : 'Auto-Send Mode'}
                      </div>
                      <div className="text-xs text-slate-500">
                        {draftMode 
                          ? 'Creates draft for review before sending'
                          : 'Automatically sends replies'}
                      </div>
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={draftMode}
                      onChange={handleDraftModeToggle}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-cyan-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </div>
                </label>

                {draftMode ? (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs text-blue-800">
                      ✓ Safer option: AI creates a draft. You review and send when ready.
                    </p>
                  </div>
                ) : (
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg flex gap-2">
                    <AlertTriangle size={16} className="text-orange-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-orange-800">
                      Auto-send enabled: AI will send replies immediately without your review.
                    </p>
                  </div>
                )}
              </div>

              {/* Backboard Info */}
              <div className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 rounded-xl">
                <div className="flex gap-2">
                  <Sparkles size={18} className="text-cyan-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-teal-900 mb-1">
                      Powered by Backboard.io
                    </p>
                    <p className="text-xs text-cyan-700 leading-relaxed">
                      AI maintains conversation memory per sender. Each person gets their own isolated context.
                    </p>
                  </div>
                </div>
              </div>

              {/* Custom Instructions */}
              <div className="space-y-3">
                <label className="block">
                  <span className="text-sm font-semibold text-slate-900 mb-2 block">
                    Custom Instructions (Optional)
                  </span>
                  <textarea
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    placeholder="e.g., Always be friendly and include our support link. Keep responses to 5-7 sentences."
                    rows={6}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none font-mono"
                  />
                  <p className="text-xs text-slate-500 mt-1.5">
                    These instructions <strong>override</strong> the default AI behavior. Be specific!
                  </p>
                </label>
              </div>

              {/* How it works */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <p className="text-xs font-semibold text-slate-700 mb-2">
                  How it works:
                </p>
                <ul className="space-y-1.5 text-xs text-slate-600">
                  <li className="flex items-start gap-2">
                    <span className="text-slate-400 mt-0.5">1.</span>
                    <span>Email arrives matching your trigger conditions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-slate-400 mt-0.5">2.</span>
                    <span>AI decides if response is needed (filters out automated emails)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-slate-400 mt-0.5">3.</span>
                    <span>AI generates reply using conversation context + your instructions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-slate-400 mt-0.5">4.</span>
                    <span>{draftMode ? 'Draft saved to Gmail for your review' : 'Reply sent automatically'}</span>
                  </li>
                </ul>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 bg-slate-50 shrink-0 space-y-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full px-4 py-3 text-sm font-semibold text-white bg-gradient-to-r from-cyan-400 to-teal-500 hover:from-cyan-500 hover:to-teal-600 rounded-xl transition-all shadow-sm hover:shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              <>
                <Reply size={16} />
                Save Configuration
              </>
            )}
          </button>
          <button
            onClick={onClose}
            className="w-full px-4 py-3 text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Warning Modal */}
      {showWarning && (
        <div 
          className="fixed inset-0 bg-black/40 z-[102] flex items-center justify-center p-4"
          onClick={() => setShowWarning(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <AlertTriangle size={24} className="text-orange-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-lg">
                  Disable Draft Mode?
                </h3>
                <p className="text-sm text-slate-600 mt-1">
                  AI will automatically send replies without your review.
                </p>
              </div>
            </div>

            <div className="space-y-2 text-sm text-slate-700 bg-slate-50 p-4 rounded-lg">
              <p className="font-semibold">⚠️ Risks:</p>
              <ul className="space-y-1 ml-4 list-disc text-xs">
                <li>No chance to review before sending</li>
                <li>Potential for AI errors or inappropriate responses</li>
                <li>Can't edit or add personal touches</li>
                <li>Replies sent even if AI misunderstands context</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowWarning(false)}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDisableDraftMode}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors"
              >
                Enable Auto-Send
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  return createPortal(modalContent, document.body);
}