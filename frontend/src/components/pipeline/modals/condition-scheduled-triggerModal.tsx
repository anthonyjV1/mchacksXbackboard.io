'use client';
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Clock, Save, Calendar, Timer, Repeat } from 'lucide-react';
import { BlockData } from '../../../../types/pipeline';

interface ConditionScheduledTriggerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<BlockData>) => void;
  blockData: BlockData;
  workspaceId: string;
}

type ScheduleMode = 'datetime' | 'interval' | 'recurring';

interface ScheduleSettings {
  mode: ScheduleMode;
  // Specific date/time
  datetime: string;
  // Wait interval after launch
  intervalValue: number;
  intervalUnit: 'minutes' | 'hours' | 'days';
  // Recurring
  recurringTime: string;
  recurringDays: number[]; // 0=Sun, 1=Mon, ... 6=Sat
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const defaultSettings: ScheduleSettings = {
  mode: 'interval',
  datetime: '',
  intervalValue: 30,
  intervalUnit: 'minutes',
  recurringTime: '09:00',
  recurringDays: [1, 2, 3, 4, 5],
};

export function ConditionScheduledTriggerModal({
  isOpen,
  onClose,
  onSave,
  blockData,
  workspaceId,
}: ConditionScheduledTriggerModalProps) {
  const [settings, setSettings] = useState<ScheduleSettings>(defaultSettings);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (isOpen && mounted) loadConfig();
  }, [isOpen, mounted, blockData.id]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `http://localhost:8000/blocks/${blockData.id}/config?workspace_id=${workspaceId}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.config) setSettings({ ...defaultSettings, ...data.config });
      }
    } catch (e) {
      console.error('Error loading config:', e);
    }
    setLoading(false);
  };

  const buildDescription = (s: ScheduleSettings): string => {
    if (s.mode === 'datetime') {
      if (!s.datetime) return 'At a specific time';
      const d = new Date(s.datetime);
      return `At ${d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`;
    }
    if (s.mode === 'interval') {
      return `${s.intervalValue} ${s.intervalUnit} after launch`;
    }
    if (s.mode === 'recurring') {
      const days = s.recurringDays.sort().map(d => DAY_LABELS[d]).join(', ');
      return `Every ${days || 'day'} at ${s.recurringTime}`;
    }
    return 'Scheduled';
  };

  const handleSave = async () => {
    try {
      await fetch(
        `http://localhost:8000/blocks/${blockData.id}/config?workspace_id=${workspaceId}`,
        { method: 'DELETE', headers: { 'Content-Type': 'application/json' } }
      );
      const res = await fetch(`http://localhost:8000/blocks/${blockData.id}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId, config: settings }),
      });
      if (!res.ok) throw new Error('Failed to save');
      onSave({ title: blockData.title, description: buildDescription(settings) });
      onClose();
    } catch (e) {
      alert('Failed to save configuration: ' + e);
    }
  };

  const toggleDay = (day: number) => {
    setSettings(s => ({
      ...s,
      recurringDays: s.recurringDays.includes(day)
        ? s.recurringDays.filter(d => d !== day)
        : [...s.recurringDays, day],
    }));
  };

  if (!isOpen || !mounted) return null;

  const modeTab = (mode: ScheduleMode, icon: React.ReactNode, label: string) => (
    <button
      onClick={() => setSettings(s => ({ ...s, mode }))}
      className={`flex-1 flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-xs font-semibold transition-all ${
        settings.mode === mode
          ? 'bg-purple-600 text-white shadow-md shadow-purple-200'
          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
      }`}
    >
      {icon}
      {label}
    </button>
  );

  const modalContent = (
    <>
      <div className="fixed inset-0 bg-black/10 z-[100]" onClick={onClose} />
      <div className="fixed top-20 right-6 bottom-24 w-[420px] bg-white shadow-2xl rounded-2xl z-[101] flex flex-col animate-in slide-in-from-right duration-300 border border-slate-200">

        {/* Header */}
        <div className="p-6 border-b border-slate-200 shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-400 to-pink-500 text-white shadow-lg">
                <Clock size={22} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Scheduled Trigger</h2>
                <p className="text-sm text-slate-500 mt-0.5">Configure when this workflow runs</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <X size={20} className="text-slate-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
            </div>
          ) : (
            <>
              {/* Mode selector */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">Schedule Type</label>
                <div className="flex gap-2">
                  {modeTab('datetime', <Calendar size={16} />, 'Specific Date')}
                  {modeTab('interval', <Timer size={16} />, 'Wait Interval')}
                  {modeTab('recurring', <Repeat size={16} />, 'Recurring')}
                </div>
              </div>

              {/* Specific Date/Time */}
              {settings.mode === 'datetime' && (
                <div className="space-y-4">
                  <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl">
                    <p className="text-xs text-purple-700 font-medium mb-3">
                      Run the workflow once at a specific date and time.
                    </p>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      value={settings.datetime}
                      onChange={e => setSettings(s => ({ ...s, datetime: e.target.value }))}
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-sm"
                    />
                  </div>
                </div>
              )}

              {/* Wait Interval */}
              {settings.mode === 'interval' && (
                <div className="space-y-4">
                  <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl">
                    <p className="text-xs text-purple-700 font-medium mb-3">
                      Wait a set amount of time after the pipeline launches, then run.
                    </p>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Wait Duration
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={1}
                        value={settings.intervalValue}
                        onChange={e => setSettings(s => ({ ...s, intervalValue: parseInt(e.target.value) || 1 }))}
                        className="flex-1 px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-sm"
                      />
                      <select
                        value={settings.intervalUnit}
                        onChange={e => setSettings(s => ({ ...s, intervalUnit: e.target.value as any }))}
                        className="px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-sm bg-white"
                      >
                        <option value="minutes">Minutes</option>
                        <option value="hours">Hours</option>
                        <option value="days">Days</option>
                      </select>
                    </div>
                  </div>

                  {/* Preview */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2">
                    <Clock size={14} className="text-slate-400" />
                    <p className="text-xs text-slate-600">
                      Runs <span className="font-semibold text-slate-800">{settings.intervalValue} {settings.intervalUnit}</span> after you launch the pipeline
                    </p>
                  </div>
                </div>
              )}

              {/* Recurring */}
              {settings.mode === 'recurring' && (
                <div className="space-y-4">
                  <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl space-y-4">
                    <p className="text-xs text-purple-700 font-medium">
                      Run the workflow repeatedly on a schedule.
                    </p>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Time of Day</label>
                      <input
                        type="time"
                        value={settings.recurringTime}
                        onChange={e => setSettings(s => ({ ...s, recurringTime: e.target.value }))}
                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Days of Week</label>
                      <div className="flex gap-1.5">
                        {DAY_LABELS.map((label, i) => (
                          <button
                            key={i}
                            onClick={() => toggleDay(i)}
                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                              settings.recurringDays.includes(i)
                                ? 'bg-purple-600 text-white shadow-sm'
                                : 'bg-white border border-slate-200 text-slate-500 hover:border-purple-300'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Preview */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2">
                    <Repeat size={14} className="text-slate-400" />
                    <p className="text-xs text-slate-600">
                      {settings.recurringDays.length === 0
                        ? 'Select at least one day'
                        : <>Runs every <span className="font-semibold text-slate-800">
                            {settings.recurringDays.sort().map(d => DAY_LABELS[d]).join(', ')}
                          </span> at <span className="font-semibold text-slate-800">{settings.recurringTime}</span></>
                      }
                    </p>
                  </div>
                </div>
              )}

              {/* Info box */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <p className="text-xs text-slate-500 leading-relaxed">
                  <span className="font-semibold text-slate-700">Note:</span> The schedule starts when you launch the pipeline and stops when you stop it.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
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
              disabled={loading || (settings.mode === 'recurring' && settings.recurringDays.length === 0)}
              className="flex-1 px-4 py-3 text-sm font-semibold text-white bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-xl transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save size={16} />
              Save Schedule
            </button>
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(modalContent, document.body);
}