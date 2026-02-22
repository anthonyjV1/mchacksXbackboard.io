// frontend/src/components/pipeline/modals/actions/action-send-email.tsx
'use client';
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, Mail, Plus, Trash2, Sparkles, AlertCircle } from 'lucide-react';
import { BlockData } from '../../../../../types/pipeline';
import { createClient } from '@/lib/supabase/client';

interface ActionSendEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<BlockData>) => void;
  blockData: BlockData;
  workspaceId: string;
}

export function ActionSendEmailModal({
  isOpen,
  onClose,
  onSave,
  blockData,
  workspaceId
}: ActionSendEmailModalProps) {
  const [recipients, setRecipients] = useState<string[]>(['']);
  const [subject, setSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [usePersonalization, setUsePersonalization] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen && mounted) {
      loadConfig();
    }
  }, [isOpen, mounted, blockData.id, workspaceId]);

  const loadConfig = async () => {
    setLoading(true);
    
    console.log('🔍 Loading send email config...');
    
    try {
      const response = await fetch(
        `http://localhost:8000/blocks/${blockData.id}/config?workspace_id=${workspaceId}`
      );
      
      if (response.ok) {
        const data = await response.json();
        console.log('Loaded config:', data);
        
        if (data.config) {
          setRecipients(data.config.recipients || ['']);
          setSubject(data.config.subject || '');
          setEmailBody(data.config.emailBody || '');
          setUsePersonalization(data.config.usePersonalization || false);
        }
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
    
    setLoading(false);
  };

  const handleAddRecipient = () => {
    setRecipients([...recipients, '']);
  };

  const handleRemoveRecipient = (index: number) => {
    if (recipients.length > 1) {
      setRecipients(recipients.filter((_, i) => i !== index));
    }
  };

  const handleRecipientChange = (index: number, value: string) => {
    const newRecipients = [...recipients];
    newRecipients[index] = value;
    setRecipients(newRecipients);
  };

  const handleSave = async () => {
    setSaving(true);
    
    console.log('Saving send email config...');
    
    try {
      // Filter out empty recipients
      const validRecipients = recipients.filter(r => r.trim());
      
      if (validRecipients.length === 0) {
        alert('Please add at least one recipient');
        setSaving(false);
        return;
      }
      
      if (!subject.trim()) {
        alert('Please enter a subject');
        setSaving(false);
        return;
      }
      
      if (!emailBody.trim()) {
        alert('Please enter email content');
        setSaving(false);
        return;
      }
      
      // Delete old configs
      await fetch(
        `http://localhost:8000/blocks/${blockData.id}/config?workspace_id=${workspaceId}`,
        { method: 'DELETE' }
      );
      
      // Save new config
      const response = await fetch(`http://localhost:8000/blocks/${blockData.id}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          config: {
            recipients: validRecipients,
            subject,
            emailBody,
            usePersonalization
          }
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to save config');
      }
      
      console.log('Config saved successfully');
      
      // Update block description
      const recipientCount = validRecipients.length;
      const description = recipientCount === 1 
        ? `To: ${validRecipients[0]}`
        : `To: ${recipientCount} recipients`;
      
      onSave({
        title: blockData.title,
        description: description
      });
      
      onClose();
    } catch (error) {
      console.error(' Error saving config:', error);
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
        className="fixed top-20 right-6 bottom-24 w-[520px] bg-white shadow-2xl rounded-2xl z-[101] flex flex-col animate-in slide-in-from-right duration-300 border border-slate-200"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-200 shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 text-white shadow-lg">
                <Send size={22} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Send Email
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  Configure automated email sending
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
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <>
              {/* Recipients */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-semibold text-slate-900">
                    Recipients
                  </label>
                  <button
                    onClick={handleAddRecipient}
                    className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    <Plus size={14} />
                    Add Recipient
                  </button>
                </div>
                
                <div className="space-y-2">
                  {recipients.map((recipient, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="email"
                        value={recipient}
                        onChange={(e) => handleRecipientChange(index, e.target.value)}
                        placeholder="recipient@example.com"
                        className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      {recipients.length > 1 && (
                        <button
                          onClick={() => handleRemoveRecipient(index)}
                          className="p-2 hover:bg-red-50 text-red-500 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                
                <p className="text-xs text-slate-500">
                  Add one or more email addresses to send to
                </p>
              </div>

              {/* Subject */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-900">
                  Subject Line
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g., Your Weekly Update"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Personalization Toggle */}
              <div className="p-4 bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-xl">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={usePersonalization}
                    onChange={(e) => setUsePersonalization(e.target.checked)}
                    className="mt-0.5 w-5 h-5 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Sparkles size={16} className="text-purple-600" />
                      <span className="text-sm font-semibold text-purple-900">
                        AI Personalization
                      </span>
                      <span className="px-2 py-0.5 text-xs font-bold bg-purple-200 text-purple-700 rounded">
                        COMING SOON
                      </span>
                    </div>
                    <p className="text-xs text-purple-700 mt-1">
                      Use AI to personalize emails with recipient data from web scraping
                    </p>
                  </div>
                </label>
              </div>

              {/* Email Body */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-900">
                  Email Content
                </label>
                <textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  placeholder="Write your email content here...

You can use variables (coming soon):
- {{name}} - Recipient's name
- {{company}} - Company name
- {{role}} - Job title"
                  rows={12}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono"
                />
                <p className="text-xs text-slate-500">
                  This email will be sent to all recipients
                </p>
              </div>

              {/* Info Box */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="flex gap-2">
                  <AlertCircle size={16} className="text-blue-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-blue-900 mb-1">
                      How it works
                    </p>
                    <ul className="space-y-1 text-xs text-blue-700">
                      <li>• Emails are sent when the workflow is triggered</li>
                      <li>• Works with both Gmail and Outlook</li>
                      <li>• Emails are sent from your connected account</li>
                    </ul>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 bg-slate-50 shrink-0 space-y-2">
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="w-full px-4 py-3 text-sm font-semibold text-white bg-gradient-to-r from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700 rounded-xl transition-all shadow-sm hover:shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              <>
                <Send size={16} />
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