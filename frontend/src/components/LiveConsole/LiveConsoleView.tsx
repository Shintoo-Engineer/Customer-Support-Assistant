import React, { useEffect, useRef } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Send,
  Sparkles,
  UserRound,
  Bot,
  AlertTriangle,
  BrainCircuit,
  MessageSquare,
} from 'lucide-react';

import {
  Scenario,
  ChatMessage,
  MessageAnalysis,
  CoachingLevel,
  KnowledgeDocument,
} from '../../types';

interface LiveConsoleViewProps {
  scenario: Scenario;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  isSimulatingCustomer: boolean;
  analysis?: MessageAnalysis;
  isAnalyzing: boolean;
  coachingLevel: CoachingLevel;
  onFinishSession: () => void;
  onRestartSession: () => void;
  onSelectAnotherScenario: () => void;
  piiMaskingEnabled: boolean;
  onTriggerAiImprove: () => void;
  isImprovingInput: boolean;
  inputText: string;
  setInputText: (val: string) => void;
  onOpenFullKb?: (kbId: string) => void;
  knowledgeDocs: KnowledgeDocument[];
}

export const LiveConsoleView: React.FC<LiveConsoleViewProps> = ({
  scenario,
  messages,
  onSendMessage,
  isSimulatingCustomer,
  analysis,
  isAnalyzing,
  onFinishSession,
  onSelectAnotherScenario,
  inputText,
  setInputText,
}) => {
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    });
  }, [messages]);

  const handleSend = () => {
    const trimmed = inputText.trim();

    if (!trimmed || isSimulatingCustomer) {
      return;
    }

    onSendMessage(trimmed);
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  /**
   * Read a value from MessageAnalysis.
   *
   * The simulator analysis uses:
   * - emotions
   * - frustrationLevel
   * - escalationRisk
   *
   * Older/local analysis objects may still use:
   * - emotion
   * - frustration
   *
   * We support both so the UI remains compatible with the existing
   * scenario/manual flows as well.
   */
  const getValue = (key: string): unknown => {
    if (!analysis) {
      return undefined;
    }

    return (analysis as unknown as Record<string, unknown>)[key];
  };

  /*
   * Score
   *
   * The current simulator backend does NOT return an overall coaching
   * score. Therefore we do not calculate or invent one here.
   */
  const overallScore = getValue('overallScore');

  const score =
    typeof overallScore === 'number'
      ? Math.max(0, Math.min(100, Math.round(overallScore)))
      : null;

  /*
   * Intent
   */
  const intent =
    getValue('intent') ??
    getValue('predictedIntent') ??
    getValue('customerIntent');

  /*
   * Sentiment
   */
  const sentiment =
    getValue('sentiment') ??
    getValue('predictedSentiment');

  /*
   * Emotion
   *
   * MessageAnalysis uses `emotions`.
   *
   * Example:
   * emotions: ["frustrated"]
   *
   * Older analysis objects may contain `emotion` or `customerEmotion`.
   */
  const emotions = getValue('emotions');

  const emotion =
    getValue('emotion') ??
    getValue('customerEmotion') ??
    (Array.isArray(emotions) && emotions.length > 0
      ? emotions[emotions.length - 1]
      : undefined);

  /*
   * Frustration
   *
   * MessageAnalysis uses `frustrationLevel`.
   *
   * The simulator backend returns `state.frustration`,
   * which is mapped into `frustrationLevel`.
   *
   * We also keep `frustration` as a fallback for compatibility.
   */
  const frustration =
    getValue('frustrationLevel') ??
    getValue('frustration');

  /*
   * Escalation
   *
   * MessageAnalysis uses `escalationRisk`.
   *
   * This is already working in the current UI because the backend
   * simulator state is being mapped to this field.
   */
  const escalationRisk =
    getValue('escalationRisk') ??
    getValue('escalation_risk') ??
    getValue('escalationIntent');

  /*
   * Recommended response
   */
  const recommendedResponse =
    getValue('recommendedResponse') ??
    getValue('suggestedResponse') ??
    getValue('responseSuggestion');

  const formatValue = (value: unknown): string => {
    if (value === undefined || value === null || value === '') {
      return '—';
    }

    if (typeof value === 'number') {
      return `${Math.round(value)}`;
    }

    if (Array.isArray(value)) {
      return value.length > 0 ? value.join(', ') : '—';
    }

    return String(value);
  };

  const getRiskClass = (value: unknown) => {
    if (typeof value !== 'number') {
      return 'text-slate-500';
    }

    if (value >= 70) {
      return 'text-red-600';
    }

    if (value >= 40) {
      return 'text-amber-600';
    }

    return 'text-emerald-600';
  };

  return (
    <div className="h-[calc(100vh-4rem)] bg-slate-50 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-16 shrink-0 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onSelectAnotherScenario}
            className="w-9 h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600 transition"
            title="Back to simulator setup"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-semibold text-slate-900 truncate">
                Customer Support Assistant
              </h1>

              <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-medium border border-emerald-100">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Live
              </span>
            </div>

            <p className="text-xs text-slate-500 truncate mt-0.5">
              {scenario.title}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {score !== null && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-[11px] text-slate-500">
                Score
              </span>

              <span className="text-sm font-semibold text-slate-900">
                {score}/100
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={onFinishSession}
            className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-medium transition"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Finish Session</span>
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 min-h-0 max-w-5xl w-full mx-auto px-3 sm:px-5 py-4 flex flex-col gap-3">
        {/* Conversation */}
        <section className="flex-1 min-h-0 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
          {/* Conversation header */}
          <div className="px-4 sm:px-5 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-slate-500" />

              <span className="text-sm font-semibold text-slate-800">
                Live Conversation
              </span>
            </div>

            <span className="text-[11px] text-slate-400">
              {messages.length} message
              {messages.length === 1 ? '' : 's'}
            </span>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-5 space-y-5">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center max-w-sm">
                  <div className="w-11 h-11 rounded-full bg-slate-100 mx-auto mb-3 flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-slate-400" />
                  </div>

                  <p className="text-sm font-medium text-slate-700">
                    Waiting for the conversation to start
                  </p>

                  <p className="text-xs text-slate-400 mt-1">
                    The AI customer message will appear here.
                  </p>
                </div>
              </div>
            ) : (
              messages.map((message, index) => {
                const isAgent = message.sender === 'agent';

                return (
                  <div
                    key={`${message.sender}-${index}`}
                    className={`flex ${
                      isAgent ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`flex gap-2.5 max-w-[88%] sm:max-w-[72%] ${
                        isAgent
                          ? 'flex-row-reverse'
                          : 'flex-row'
                      }`}
                    >
                      {/* Avatar */}
                      <div
                        className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center ${
                          isAgent
                            ? 'bg-slate-900 text-white'
                            : 'bg-indigo-50 text-indigo-600'
                        }`}
                      >
                        {isAgent ? (
                          <UserRound className="w-4 h-4" />
                        ) : (
                          <Bot className="w-4 h-4" />
                        )}
                      </div>

                      {/* Bubble */}
                      <div
                        className={`flex flex-col ${
                          isAgent
                            ? 'items-end'
                            : 'items-start'
                        }`}
                      >
                        <span className="text-[11px] text-slate-400 mb-1 px-1">
                          {isAgent
                            ? 'You · Support Agent'
                            : 'AI Customer'}
                        </span>

                        <div
                          className={`px-3.5 py-2.5 rounded-2xl text-sm leading-6 ${
                            isAgent
                              ? 'bg-slate-900 text-white rounded-tr-md'
                              : 'bg-slate-100 text-slate-800 rounded-tl-md'
                          }`}
                        >
                          {message.text}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {isSimulatingCustomer && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Bot className="w-4 h-4" />
                  </div>

                  <div className="px-3.5 py-2.5 rounded-2xl rounded-tl-md bg-slate-100">
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" />

                      <span
                        className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
                        style={{ animationDelay: '120ms' }}
                      />

                      <span
                        className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
                        style={{ animationDelay: '240ms' }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-slate-100 p-3 sm:p-4 shrink-0">
            <div className="flex items-end gap-2">
              <textarea
                value={inputText}
                onChange={(event) =>
                  setInputText(event.target.value)
                }
                onKeyDown={handleKeyDown}
                disabled={isSimulatingCustomer}
                rows={2}
                placeholder={
                  isSimulatingCustomer
                    ? 'AI customer is responding...'
                    : 'Type your response to the customer...'
                }
                className="flex-1 resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-slate-400 focus:bg-white transition disabled:opacity-60"
              />

              <button
                type="button"
                onClick={handleSend}
                disabled={
                  !inputText.trim() ||
                  isSimulatingCustomer
                }
                className="h-10 px-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-medium flex items-center gap-1.5 transition shrink-0"
              >
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">
                  Send
                </span>
              </button>
            </div>

            <p className="text-[10px] text-slate-400 mt-1.5 px-1">
              Press Enter to send · Shift + Enter for a new line
            </p>
          </div>
        </section>

        {/* Compact Task 4 Analysis */}
        <section className="shrink-0 bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100">
            <div className="flex items-center gap-2">
              <BrainCircuit className="w-4 h-4 text-indigo-500" />

              <span className="text-sm font-semibold text-slate-800">
                Live Analysis
              </span>

              {isAnalyzing && (
                <span className="text-[10px] text-indigo-500">
                  Updating...
                </span>
              )}
            </div>

            <Sparkles className="w-4 h-4 text-slate-300" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-slate-100">
            {/* Intent */}
            <div className="px-3 py-2.5">
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">
                Intent
              </p>

              <p className="text-xs font-medium text-slate-700 truncate mt-1">
                {formatValue(intent)}
              </p>
            </div>

            {/* Sentiment */}
            <div className="px-3 py-2.5">
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">
                Sentiment
              </p>

              <p className="text-xs font-medium text-slate-700 truncate mt-1">
                {formatValue(sentiment)}
              </p>
            </div>

            {/* Emotion */}
            <div className="px-3 py-2.5">
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">
                Emotion
              </p>

              <p className="text-xs font-medium text-slate-700 truncate mt-1">
                {formatValue(emotion)}
              </p>
            </div>

            {/* Frustration */}
            <div className="px-3 py-2.5">
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">
                Frustration
              </p>

              <p className="text-xs font-medium text-slate-700 mt-1">
                {formatValue(frustration)}
                {typeof frustration === 'number' ? '%' : ''}
              </p>
            </div>

            {/* Escalation */}
            <div className="px-3 py-2.5">
              <div className="flex items-center gap-1">
                <p className="text-[10px] text-slate-400 uppercase tracking-wide">
                  Escalation
                </p>

                {typeof escalationRisk === 'number' &&
                  escalationRisk >= 70 && (
                    <AlertTriangle className="w-3 h-3 text-red-500" />
                  )}
              </div>

              <p
                className={`text-xs font-semibold mt-1 ${getRiskClass(
                  escalationRisk
                )}`}
              >
                {formatValue(escalationRisk)}
                {typeof escalationRisk === 'number'
                  ? '%'
                  : ''}
              </p>
            </div>

            {/* Score */}
            <div className="px-3 py-2.5">
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">
                Score
              </p>

              <p className="text-xs font-semibold text-slate-800 mt-1">
                {score !== null ? `${score}/100` : '—'}
              </p>
            </div>
          </div>

          {recommendedResponse !== undefined &&
            recommendedResponse !== null &&
            String(recommendedResponse).trim() !== '' && (
              <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/70">
                <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">
                  Recommended Response
                </p>

                <p className="text-xs sm:text-sm text-slate-700 leading-5">
                  {String(recommendedResponse)}
                </p>
              </div>
            )}
        </section>
      </main>
    </div>
  );
};