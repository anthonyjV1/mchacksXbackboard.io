// frontend/src/components/pipeline/modals/actions/action-reply-email.tsx
'use client';
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Reply, Sparkles } from 'lucide-react';
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
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
    
    setLoading(false);
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
            customInstructions
          }
        });
      
      if (error) throw error;
      
      // Update block description
      const description = customInstructions 
        ? 'AI reply with custom instructions'
        : 'AI-powered email reply';
      
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
        className="fixed top-20 right-6 bottom-24 w-[420px] bg-white shadow-2xl rounded-2xl z-[101] flex flex-col animate-in slide-in-from-right duration-300 border border-slate-200"
      >
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
                  Automatically respond with AI-generated replies
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

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
            </div>
          ) : (
            <>
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="flex gap-2">
                  <Sparkles size={18} className="text-cyan-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-teal-900 mb-1">
                      Powered by Backboard.io
                    </p>
                    <p className="text-xs text-cyan-700 leading-relaxed">
                      AI maintains conversation memory across email threads. It remembers 
                      past interactions and context automatically.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <label className="block">
                  <span className="text-sm font-semibold text-slate-900 mb-2 block">
                    Custom Instructions (Optional)
                  </span>
                  <textarea
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    placeholder="e.g., Always be friendly and professional. Include our support link at the end of every email."
                    rows={6}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
                  />
                  <p className="text-xs text-slate-500 mt-1.5">
                    Add specific instructions for how the AI should respond
                  </p>
                </label>
              </div>

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
                    <span>AI analyzes the email and conversation history</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-slate-400 mt-0.5">3.</span>
                    <span>Generates contextual reply based on your instructions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-slate-400 mt-0.5">4.</span>
                    <span>Reply is sent automatically via Gmail</span>
                  </li>
                </ul>
              </div>
            </>
          )}
        </div>

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
    </>
  );

  return createPortal(modalContent, document.body);
}