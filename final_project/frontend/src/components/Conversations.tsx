import React, { useState, useEffect } from 'react';
import { simulatorApi } from '../api/simulatorApi';
import type { DialogueMessage } from '../types';

interface Props {
  onOpenSession?: (sessionId: number) => void;
}

interface SavedSessionInfo {
  sessionId: number;
  scenario?: string;
  persona?: string;
  createdAt: string;
}

const SESSIONS_STORAGE_KEY = 'csa_saved_sessions';

export const Conversations: React.FC<Props> = ({ onOpenSession }) => {
  const [sessions, setSessions] = useState<SavedSessionInfo[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [sessionMessages, setSessionMessages] = useState<DialogueMessage[]>([]);
  const [sessionStatus, setSessionStatus] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [manualIdInput, setManualIdInput] = useState<string>('');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SESSIONS_STORAGE_KEY);
      if (stored) {
        setSessions(JSON.parse(stored));
      }
    } catch {
      // Ignore
    }
  }, []);

  const handleOpenSession = async (sid: number) => {
    setSelectedSessionId(sid);
    setLoading(true);
    setError(null);
    try {
      const data = await simulatorApi.getHistory(sid);
      setSessionMessages(data.messages || []);
      setSessionStatus(data.status || 'Active');
    } catch (err: any) {
      setError(err.message || `Failed to load history for Session #${sid}`);
      setSessionMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const handleManualLookup = (e: React.FormEvent) => {
    e.preventDefault();
    const id = parseInt(manualIdInput.trim(), 10);
    if (!isNaN(id)) {
      handleOpenSession(id);
    }
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Conversations</h1>
          <p className="text-xs text-slate-500 mt-1">
            View previous simulation sessions and audit dialogue records.
          </p>
        </div>

        <form onSubmit={handleManualLookup} className="flex items-center gap-2">
          <input
            type="number"
            placeholder="Session ID"
            value={manualIdInput}
            onChange={(e) => setManualIdInput(e.target.value)}
            className="border border-slate-300 rounded px-2.5 py-1.5 text-xs w-36 bg-white focus:outline-none focus:border-slate-500"
          />
          <button
            type="submit"
            className="px-3 py-1.5 rounded bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition cursor-pointer"
          >
            Open
          </button>
        </form>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-4">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider pb-2 mb-3 border-b border-slate-100">
            Recent Sessions
          </h2>

          {sessions.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">
              No conversations found.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {sessions.map((s) => (
                <div
                  key={s.sessionId}
                  className={`py-2.5 flex items-center justify-between gap-2 ${
                    selectedSessionId === s.sessionId ? 'bg-slate-50 -mx-2 px-2 rounded' : ''
                  }`}
                >
                  <div className="text-xs">
                    <div className="font-semibold text-slate-900">
                      Session #{s.sessionId}
                    </div>
                    <div className="text-2xs text-slate-500">
                      {s.scenario || 'General'}
                    </div>
                  </div>

                  <button
                    onClick={() => handleOpenSession(s.sessionId)}
                    className="text-xs px-2.5 py-1 rounded border border-slate-300 text-slate-700 hover:bg-slate-100 font-medium transition cursor-pointer"
                  >
                    Open
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              {selectedSessionId ? `Session #${selectedSessionId} Dialogue` : 'Dialogue History'}
            </h2>
            {selectedSessionId && (
              <span className="text-2xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 capitalize">
                {sessionStatus || 'Active'}
              </span>
            )}
          </div>

          {loading ? (
            <p className="text-xs text-slate-500 py-6 text-center">Loading dialogue messages...</p>
          ) : selectedSessionId ? (
            sessionMessages.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                No messages recorded for this session yet.
              </p>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {sessionMessages.map((msg, i) => {
                  const isCustomer = msg.sender_type.toLowerCase().includes('customer');
                  return (
                    <div key={i} className="text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-slate-700">{msg.sender_type}</span>
                        {msg.timestamp && (
                          <span className="text-2xs text-slate-400">
                            {new Date(msg.timestamp).toLocaleTimeString()}
                          </span>
                        )}
                      </div>
                      <div
                        className={`p-2.5 rounded text-xs leading-relaxed ${
                          isCustomer
                            ? 'bg-slate-100 text-slate-900 border border-slate-200'
                            : 'bg-slate-900 text-white'
                        }`}
                      >
                        {msg.message_text}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <p className="text-xs text-slate-400 py-6 text-center">
              Select a session or enter a Session ID to view history.
            </p>
          )}

          {selectedSessionId && onOpenSession && (
            <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => onOpenSession(selectedSessionId)}
                className="text-xs px-3 py-1.5 rounded bg-slate-900 text-white font-medium hover:bg-slate-800 transition cursor-pointer"
              >
                Load into Support Console
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Conversations;
