import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  User,
  Bot,
  Search,
  Sparkles,
  Mic,
  MicOff,
  ShieldCheck,
  AlertCircle,
  Clock,
  CheckCheck,
  Zap,
  Info
} from 'lucide-react';
import { Scenario, ChatMessage, CoachingLevel } from '../../types';

interface ConversationPanelProps {
  scenario: Scenario;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  isSimulatingCustomer: boolean;
  inputText: string;
  setInputText: (val: string) => void;
  piiMaskingEnabled: boolean;
  onTriggerAiImprove: () => void;
  isImprovingInput: boolean;
  coachingLevel: CoachingLevel;
}

export const ConversationPanel: React.FC<ConversationPanelProps> = ({
  scenario,
  messages,
  onSendMessage,
  isSimulatingCustomer,
  inputText,
  setInputText,
  piiMaskingEnabled,
  onTriggerAiImprove,
  isImprovingInput,
  coachingLevel
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSimulatingCustomer]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSimulatingCustomer) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  // Mask PII helper if enabled
  const maskPii = (text: string) => {
    if (!piiMaskingEnabled) return text;
    return text
      .replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '•••• •••• •••• [CARD]')
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b/g, 'c••••••@domain.com')
      .replace(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, '+1 (•••) •••-••••');
  };

  const filteredMessages = messages.filter((m) =>
    searchQuery ? m.text.toLowerCase().includes(searchQuery.toLowerCase()) : true
  );

  const quickPhrases = [
    "I understand why this is frustrating. Let me help check your details.",
    "I have verified your account and processed an immediate refund.",
    "Let me personally investigate this issue for you right away."
  ];

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
      
      {/* Panel Header / Customer Dossier */}
      <div className="p-3.5 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img
              src={scenario.customerPersona.avatar}
              alt={scenario.customerPersona.name}
              className="w-10 h-10 rounded-full object-cover ring-2 ring-indigo-500/50"
            />
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-white">{scenario.customerPersona.name}</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                {scenario.customerPersona.type}
              </span>
            </div>
            <p className="text-xs text-slate-400">Issue: {scenario.title}</p>
          </div>
        </div>

        {/* Search inside Chat */}
        <div className="relative hidden sm:block">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            id="chat-search-input"
            type="text"
            placeholder="Search transcript..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-3 py-1.5 bg-slate-800/80 border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-44"
          />
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-900/60">
        
        {/* Scenario Objective Banner */}
        <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-800/40 text-xs text-indigo-200 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-white">Target Objective: </span>
            {scenario.sessionObjectives}
          </div>
        </div>

        {filteredMessages.map((msg) => {
          const isCustomer = msg.sender === 'customer';
          return (
            <div
              key={msg.id}
              className={`flex gap-3 ${isCustomer ? 'justify-start' : 'justify-end'}`}
            >
              {isCustomer && (
                <img
                  src={scenario.customerPersona.avatar}
                  alt="Customer"
                  className="w-8 h-8 rounded-full object-cover shrink-0 ring-1 ring-slate-700"
                />
              )}

              <div
                className={`max-w-[82%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                  isCustomer
                    ? 'bg-slate-800 text-slate-100 border border-slate-700/80 rounded-tl-sm'
                    : 'bg-indigo-600 text-white shadow-sm rounded-tr-sm'
                }`}
              >
                {/* Sender Label & Timestamp */}
                <div className="flex items-center justify-between gap-4 mb-1 text-[10px] opacity-75">
                  <span className="font-bold uppercase tracking-wider">
                    {isCustomer ? scenario.customerPersona.name : 'You (Support Agent)'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    {msg.timestamp}
                  </span>
                </div>

                {/* Message Text with PII masking */}
                <p className="whitespace-pre-wrap">{maskPii(msg.text)}</p>

                {/* Customer Emotion Tag inside Bubble */}
                {isCustomer && msg.customerState && (
                  <div className="mt-2 pt-2 border-t border-slate-700/60 flex items-center gap-3 text-[10px] text-slate-400">
                    <span>Frustration: <b className="text-amber-400">{msg.customerState.frustration}%</b></span>
                    <span>Trust: <b className="text-sky-400">{msg.customerState.trust}%</b></span>
                  </div>
                )}
              </div>

              {!isCustomer && (
                <div className="w-8 h-8 rounded-full bg-indigo-700 flex items-center justify-center shrink-0 text-white font-bold text-xs ring-1 ring-indigo-400">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {/* Customer Typing State Indicator */}
        {isSimulatingCustomer && (
          <div className="flex items-center gap-3">
            <img
              src={scenario.customerPersona.avatar}
              alt="Customer"
              className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-700"
            />
            <div className="bg-slate-800 border border-slate-700 px-4 py-2.5 rounded-2xl rounded-tl-sm flex items-center gap-1.5 text-xs text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" />
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.2s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.4s]" />
              <span className="ml-1.5 text-[11px] text-slate-400">{scenario.customerPersona.name} is typing...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick De-escalation Phrases */}
      {coachingLevel !== 'assessment' && (
        <div className="px-3.5 py-2 bg-slate-850/90 border-t border-slate-800 flex items-center gap-2 overflow-x-auto text-[11px]">
          <span className="text-slate-400 whitespace-nowrap font-medium flex items-center gap-1">
            <Zap className="w-3 h-3 text-amber-400" />
            Quick phrases:
          </span>
          {quickPhrases.map((phrase, i) => (
            <button
              key={i}
              id={`quick-phrase-${i}`}
              onClick={() => setInputText(phrase)}
              className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 whitespace-nowrap transition text-[11px]"
            >
              "{phrase.slice(0, 32)}..."
            </button>
          ))}
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleSend} className="p-3 sm:p-3.5 bg-slate-850 border-t border-slate-800">
        <div className="flex flex-col gap-2">
          <textarea
            id="agent-chat-textarea"
            rows={3}
            placeholder="Type your response to the customer..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend(e);
              }
            }}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none leading-relaxed min-h-[75px]"
          />

          {/* Action buttons row */}
          <div className="flex items-center justify-between gap-2">
            
            <div className="flex items-center gap-1 text-[10px] text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="hidden sm:inline">{piiMaskingEnabled ? 'PII Safe' : 'Standard'}</span>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Speech to text simulation */}
              <button
                type="button"
                id="mic-stt-btn"
                onClick={() => setIsRecording(!isRecording)}
                className={`p-2 rounded-lg text-xs transition min-w-[36px] min-h-[36px] flex items-center justify-center ${
                  isRecording
                    ? 'bg-rose-600 text-white animate-pulse'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
                title={isRecording ? 'Listening (Simulated)' : 'Voice Input (STT)'}
              >
                {isRecording ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
              </button>

              {/* AI Polish Button */}
              {coachingLevel !== 'assessment' && (
                <button
                  type="button"
                  id="ai-polish-btn"
                  onClick={onTriggerAiImprove}
                  disabled={isImprovingInput || !inputText.trim()}
                  className="px-2.5 py-1.5 rounded-lg bg-indigo-950/80 border border-indigo-700/60 hover:bg-indigo-900 text-indigo-300 text-xs font-medium flex items-center gap-1 transition disabled:opacity-50 min-h-[36px]"
                  title="Polish with AI (Tone & Clarity)"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="hidden xs:inline">Polish</span>
                </button>
              )}

              {/* Send Button */}
              <button
                type="submit"
                id="agent-send-btn"
                disabled={!inputText.trim() || isSimulatingCustomer}
                className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 min-h-[36px]"
              >
                <span>Send</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </form>

    </div>
  );
};
