import React, { useEffect, useState } from 'react';
import { simulatorApi } from '../api/simulatorApi';
import type { DialogueMessage } from '../types';
import { MessagesSquare, RefreshCw, User, Headphones, Clock } from 'lucide-react';

interface Props {
  sessionId: number;
}

export const ConversationHistory: React.FC<Props> = ({ sessionId }) => {
  const [messages, setMessages] = useState<DialogueMessage[]>([]);
  const [status, setStatus] = useState<string>('In Progress');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await simulatorApi.getHistory(sessionId);
      setMessages(data.messages || []);
      setStatus(data.status || 'In Progress');
    } catch (err: any) {
      setError(err.message || 'Failed to fetch conversation history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [sessionId]);

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <MessagesSquare className="w-5 h-5 text-indigo-600" />
            <span>Session #{sessionId} Conversation History</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Status: <span className="font-semibold text-slate-700 capitalize">{status}</span> • Total Messages:{' '}
            <span className="font-semibold text-slate-700">{messages.length}</span>
          </p>
        </div>

        <button
          onClick={fetchHistory}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 mb-6">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-xs text-slate-500">
          <RefreshCw className="w-5 h-5 animate-spin text-indigo-600 mx-auto mb-2" />
          <span>Loading dialogue history from database...</span>
        </div>
      ) : messages.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-xs text-slate-500">
          No dialogue messages recorded for this session yet.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="divide-y divide-slate-100">
            {messages.map((msg, idx) => {
              const isCustomer = msg.sender_type === 'Customer';

              return (
                <div key={idx} className="p-4 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          isCustomer
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-indigo-100 text-indigo-800'
                        }`}
                      >
                        {isCustomer ? <User className="w-3.5 h-3.5" /> : <Headphones className="w-3.5 h-3.5" />}
                      </div>
                      <span className="font-semibold text-xs text-slate-800">
                        {msg.sender_type}
                      </span>
                      <span className="text-3xs font-mono text-slate-400">
                        Message #{idx + 1}
                      </span>
                    </div>

                    {msg.timestamp && (
                      <div className="flex items-center gap-1 text-2xs text-slate-400 font-mono">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap pl-8">
                    {msg.message_text}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
