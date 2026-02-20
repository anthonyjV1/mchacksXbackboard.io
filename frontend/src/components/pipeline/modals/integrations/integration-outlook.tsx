// frontend/src/components/pipeline/modals/integrations/integration-outlook.tsx
'use client';
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Mail, CheckCircle, AlertCircle } from 'lucide-react';
import { BlockData } from '../../../../../types/pipeline';
import { createClient } from '@/lib/supabase/client';

interface IntegrationOutlookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<BlockData>) => void;
  blockData: BlockData;
  workspaceId: string;
}

export function IntegrationOutlookModal({
  isOpen,
  onClose,
  onSave,
  blockData,
  workspaceId
}: IntegrationOutlookModalProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState('');
  const [mounted, setMounted] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen && mounted) {
      checkOutlookConnection();
    }
  }, [isOpen, mounted]);

  const checkOutlookConnection = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_oauth_credentials')
        .select('*')
        .eq('user_id', user.id)
        .eq('provider', 'outlook')
        .maybeSingle();

      if (data && !error) {
        setIsConnected(true);
        setUserEmail(user.email || '');
        
        if (blockData.description !== 'Connected') {
          onSave({
            title: blockData.title,
            description: 'Connected'
          });
        }
      } else if (error) {
        console.error('Error checking Outlook connection:', error);
      }
    } catch (error) {
      console.error('Error checking Outlook connection:', error);
    }
    
    setLoading(false);
  };

  const handleConnectOutlook = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('Please sign in first');
      return;
    }

    // Set flag before leaving for OAuth
    localStorage.setItem('outlook_oauth_return', 'true');

    const redirectUrl = `${window.location.origin}/dashboard/${workspaceId}`;
    const oauthUrl = `http://localhost:8000/auth/outlook?user_id=${user.id}&redirect_uri=${encodeURIComponent(redirectUrl)}`;
    
    window.location.href = oauthUrl;
  };

  const handleDisconnect = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const confirmed = confirm('Are you sure you want to disconnect your Outlook account? Your workflows using Outlook triggers will stop working.');
    if (!confirmed) return;

    try {
      await supabase
        .from('user_oauth_credentials')
        .delete()
        .eq('user_id', user.id)
        .eq('provider', 'outlook');

      setIsConnected(false);
      setUserEmail('');
      
      onSave({
        description: 'Not connected'
      });
      
      onClose();
    } catch (error) {
      console.error('Error disconnecting Outlook:', error);
      alert('Failed to disconnect Outlook');
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
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-400 to-cyan-500 text-white shadow-lg">
                <Mail size={22} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Outlook Integration
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  Connect your Microsoft account to use Outlook email triggers
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
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : isConnected ? (
            <div className="space-y-6">
              <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <CheckCircle size={20} className="text-green-600 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-green-900 mb-1">
                      Outlook Connected
                    </p>
                    <p className="text-sm text-green-700">
                      {userEmail}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-900">
                  What you can do:
                </h3>
                <ul className="space-y-2 text-sm text-slate-600">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>Trigger workflows when you receive emails</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>Filter emails by sender, subject, or attachments</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>Automatically process incoming Outlook emails</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={handleDisconnect}
                className="w-full px-4 py-3 text-sm font-semibold text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 rounded-xl transition-colors"
              >
                Disconnect Outlook
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-900">
                  Why connect Outlook?
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Connect your Microsoft Outlook account to create workflows that automatically respond to incoming emails, process attachments, and more.
                </p>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <p className="text-xs font-semibold text-slate-700 mb-2">
                  What we'll access:
                </p>
                <ul className="space-y-1.5 text-xs text-slate-600">
                  <li className="flex items-start gap-2">
                    <span className="text-slate-400 mt-0.5">•</span>
                    <span>Read your email messages and metadata</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-slate-400 mt-0.5">•</span>
                    <span>Send and create draft emails</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-slate-400 mt-0.5">•</span>
                    <span>Check for new emails to trigger workflows</span>
                  </li>
                </ul>
                <p className="text-xs text-slate-500 mt-3">
                  We will never access emails or send messages without explicit actions you configure.
                </p>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="flex gap-2">
                  <AlertCircle size={16} className="text-blue-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-blue-900 mb-1">
                      Secure & Private
                    </p>
                    <p className="text-xs text-blue-700 leading-relaxed">
                      Your credentials are encrypted and stored securely. You can disconnect at any time.
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleConnectOutlook}
                className="w-full px-4 py-3 text-sm font-semibold text-white bg-gradient-to-r from-blue-400 to-cyan-500 hover:from-blue-500 hover:to-cyan-600 rounded-xl transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2"
              >
                <Mail size={16} />
                Connect Outlook Account
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );

  return createPortal(modalContent, document.body);
}