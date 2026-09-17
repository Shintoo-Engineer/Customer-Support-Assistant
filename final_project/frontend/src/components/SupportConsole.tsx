import React, { useState, useEffect, useRef } from 'react';
import type {
  IntegratedTurnResponse,
  DialogueMessage,
  KnowledgeRecommendation,
  DecisionSupportResult,
} from '../types';
import { supportApi } from '../api/supportApi';
import { simulatorApi } from '../api/simulatorApi';
import { analysisApi } from '../api/analysisApi';

interface Props {
  initialTurnData: IntegratedTurnResponse;
  onNavigateToSummary?: () => void;
  onTurnUpdate?: (updatedData: IntegratedTurnResponse) => void;
}

export const SupportConsole: React.FC<Props> = ({
  initialTurnData,
  onNavigateToSummary,
  onTurnUpdate,
}) => {
  const [sessionData, setSessionData] = useState<IntegratedTurnResponse>(initialTurnData);
  const [messages, setMessages] = useState<DialogueMessage[]>([]);
  const [agentInput, setAgentInput] = useState<string>('');
  const [loadingTurn, setLoadingTurn] = useState<boolean>(false);
  const [turnError, setTurnError] = useState<string | null>(null);
  const [decisionSupport, setDecisionSupport] = useState<DecisionSupportResult | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Sync state when initialTurnData prop changes
  useEffect(() => {
    setSessionData(initialTurnData);
  }, [initialTurnData]);

  // Load message history from backend on initial mount
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const history = await simulatorApi.getHistory(sessionData.session_id);
        if (history && history.messages && history.messages.length > 0) {
          setMessages(history.messages);
        } else {
          setMessages([
            {
              sender_type: 'Customer',
              message_text: sessionData.customer_message,
              timestamp: new Date().toISOString(),
            },
          ]);
        }
      } catch {
        setMessages([
          {
            sender_type: 'Customer',
            message_text: sessionData.customer_message,
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    };

    fetchHistory();
  }, [sessionData.session_id]);

  // Fetch Decision Support recommendations
  useEffect(() => {
    const fetchDecisionSupport = async () => {
      try {
        const ds = await analysisApi.getDecisionSupport(sessionData.session_id);
        setDecisionSupport(ds);
      } catch {
        // Graceful isolation
      }
    };

    if (sessionData.session_id) {
      fetchDecisionSupport();
    }
  }, [sessionData.session_id, sessionData.turn]);

  // Scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loadingTurn]);

  // Handle agent response submission
  const handleSendResponse = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = agentInput.trim();
    if (!text || loadingTurn) return;

    setAgentInput('');
    setTurnError(null);

    // Optimistically show agent message
    const tempAgentMsg: DialogueMessage = {
      sender_type: 'Support Agent',
      message_text: text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempAgentMsg]);
    setLoadingTurn(true);

    try {
      const result = await supportApi.processTurn({
        session_id: sessionData.session_id,
        agent_response: text,
      });

      setSessionData(result);
      onTurnUpdate?.(result);

      // Append customer message from backend
      const newCustomerMsg: DialogueMessage = {
        sender_type: 'Customer',
        message_text: result.customer_message,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, newCustomerMsg]);
    } catch (err: any) {
      setTurnError(err.message || 'Failed to submit response to backend.');
    } finally {
      setLoadingTurn(false);
    }
  };

  const handleInsertText = (snippet: string) => {
    setAgentInput((prev) => (prev ? prev + '\n\n' + snippet : snippet));
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSendResponse();
    }
  };

  const analysis = sessionData.analysis;
  const recommendations: KnowledgeRecommendation[] = sessionData.recommendations || [];

  return (
    <div className="max-w-7xl mx-auto py-6 px-4">
      {/* Session Top Bar - Clean uniform alignment */}
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200 gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="font-bold text-slate-900 text-sm sm:text-base">
            Session #{sessionData.session_id}
          </span>
          <span className="text-2xs px-2.5 py-1 rounded bg-slate-100 text-slate-700 font-semibold uppercase tracking-wider">
            Turn {sessionData.turn}
          </span>
          {sessionData.is_resolved && (
            <span className="text-2xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold uppercase tracking-wider border border-emerald-200">
              Resolved
            </span>
          )}
          {sessionData.is_escalated && (
            <span className="text-2xs px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-semibold uppercase tracking-wider border border-rose-200">
              Escalated
            </span>
          )}
        </div>

        {onNavigateToSummary && (
          <button
            onClick={onNavigateToSummary}
            className="h-8 px-3 rounded-md border border-slate-300 hover:bg-slate-50 text-xs font-medium text-slate-700 transition cursor-pointer inline-flex items-center gap-1 shrink-0"
          >
            <span>View Summary</span>
            <span>→</span>
          </button>
        )}
      </div>

      {turnError && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded">
          {turnError}
        </div>
      )}

      {/* Main 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: CONVERSATION (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg flex flex-col h-[650px] shadow-xs">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 rounded-t-lg flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Dialogue Stream
            </h2>
            <span className="text-2xs text-slate-400">
              {messages.length} messages
            </span>
          </div>

          {/* Messages list */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5">
            {messages.map((msg, idx) => {
              const isCustomer = msg.sender_type.toLowerCase().includes('customer');
              return (
                <div
                  key={idx}
                  className={`flex flex-col ${isCustomer ? 'items-start' : 'items-end'}`}
                >
                  <span className="text-2xs font-semibold text-slate-400 mb-1 px-1">
                    {msg.sender_type}
                  </span>
                  <div
                    className={`max-w-[85%] rounded-lg px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed ${
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

            {loadingTurn && (
              <div className="flex items-start">
                <div className="bg-slate-100 text-slate-500 text-xs px-3.5 py-2 rounded-lg italic flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-ping" />
                  <span>Customer is responding...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Response Input Box with Clean Aligned Action Toolbar */}
          <div className="p-3.5 border-t border-slate-200 bg-slate-50 rounded-b-lg">
            <form onSubmit={handleSendResponse} className="space-y-2.5">
              <textarea
                ref={inputRef}
                value={agentInput}
                onChange={(e) => setAgentInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type support response to customer... (Press Ctrl+Enter to send)"
                rows={3}
                disabled={loadingTurn}
                className="w-full border border-slate-300 rounded-md p-2.5 text-xs sm:text-sm bg-white focus:outline-none focus:ring-1 focus:ring-slate-500 focus:border-slate-500 resize-none shadow-2xs"
              />
              <div className="flex items-center justify-between pt-0.5">
                <span className="text-2xs text-slate-400">
                  Tip: Use recommendation snippets or press Ctrl+Enter
                </span>
                <button
                  type="submit"
                  disabled={!agentInput.trim() || loadingTurn}
                  className="h-8 px-4 rounded-md bg-slate-900 text-white font-medium hover:bg-slate-800 transition text-xs cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-xs disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                  {loadingTurn ? 'Sending...' : 'Send Response →'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* RIGHT COLUMN: DECISION SUPPORT + ANALYSIS + KNOWLEDGE (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* TASK 4 PHASE 6 DECISION SUPPORT (If Available) */}
          {decisionSupport && (
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
                <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  AI Decision Support
                </h2>
                <span
                  className={`text-2xs font-bold uppercase px-2 py-0.5 rounded ${
                    decisionSupport.priority === 'critical'
                      ? 'bg-rose-100 text-rose-800 border border-rose-200'
                      : decisionSupport.priority === 'high'
                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  }`}
                >
                  {decisionSupport.priority} Priority
                </span>
              </div>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-slate-500 block text-2xs uppercase font-semibold">Recommended Tone</span>
                  <span className="font-medium text-slate-800 capitalize">{decisionSupport.recommended_tone}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-2xs uppercase font-semibold">Recommended Action</span>
                  <span className="font-medium text-slate-900">{decisionSupport.recommended_action}</span>
                </div>
                {decisionSupport.rationale && (
                  <p className="text-2xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-100 leading-relaxed">
                    {decisionSupport.rationale}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* TASK 4 ANALYSIS */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider pb-2 mb-3 border-b border-slate-100">
              Task 4 Analysis
            </h2>

            {analysis ? (
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">Intent</span>
                  <span className="font-semibold text-slate-900 capitalize">
                    {analysis.intent || '—'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">Emotion</span>
                  <span className="font-semibold text-slate-900 capitalize">
                    {analysis.emotion || '—'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">Sentiment</span>
                  <span className="font-semibold text-slate-900 capitalize">
                    {analysis.sentiment || '—'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">Frustration</span>
                  <span className="font-semibold text-slate-900">
                    {analysis.frustration_level !== undefined ? `${analysis.frustration_level}/10` : '—'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">Satisfaction Trend</span>
                  <span className="font-semibold text-slate-900 capitalize">
                    {analysis.satisfaction_trend || '—'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">Escalation Risk</span>
                  <span className="font-semibold text-slate-900 capitalize">
                    {analysis.escalation_risk || '—'}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Confidence</span>
                  <span className="font-semibold text-slate-900">
                    {analysis.confidence !== undefined ? analysis.confidence.toFixed(2) : '—'}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400">No analysis available.</p>
            )}
          </div>

          {/* TASK 5 KNOWLEDGE RECOMMENDATIONS */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
              <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Knowledge Recommendations (Task 5)
              </h2>
              <span className="text-2xs text-slate-400">
                {recommendations.length} results
              </span>
            </div>

            {recommendations.length > 0 ? (
              <div className="space-y-3">
                {recommendations.map((rec, i) => (
                  <div key={i} className="border border-slate-200 rounded-lg p-3 text-xs bg-slate-50/70">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold text-slate-900">{rec.title}</div>
                      {rec.relevance_score !== undefined && (
                        <span className="text-2xs bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-mono shrink-0">
                          {rec.relevance_score.toFixed(2)}
                        </span>
                      )}
                    </div>

                    <div className="text-2xs text-slate-500 mt-1 space-x-2">
                      {rec.source && <span>Source: {rec.source}</span>}
                      {rec.document_type && <span>Type: {rec.document_type}</span>}
                    </div>

                    {rec.content && (
                      <p className="mt-2 text-slate-700 leading-relaxed text-2xs sm:text-xs bg-white p-2 rounded border border-slate-200">
                        {rec.content.length > 180 ? rec.content.slice(0, 180) + '...' : rec.content}
                      </p>
                    )}

                    <div className="mt-2.5 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleInsertText(rec.content || rec.title)}
                        className="h-7 px-2.5 inline-flex items-center justify-center gap-1 text-2xs text-slate-700 hover:text-slate-900 font-medium rounded border border-slate-300 bg-white hover:bg-slate-100 transition shadow-2xs cursor-pointer"
                      >
                        <span>+ Use in Reply</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 py-4 text-center">
                No relevant knowledge found for this message.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupportConsole;
