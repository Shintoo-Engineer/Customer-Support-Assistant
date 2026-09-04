import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Send,
  User,
  Sparkles,
  BookOpen,
  ShieldCheck,
  GraduationCap,
  UserCheck,
  FileText,
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import { UserRole, ChatMessage } from '../types';
import { askAssistantApi } from '../services/api';

interface AiAssistantViewProps {
  userRole: UserRole;
  userName: string;
}

interface AssistantMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  sources?: { documentTitle: string; sectionTitle?: string; pageNumber?: number; accessLevel: string }[];
}

export const AiAssistantView: React.FC<AiAssistantViewProps> = ({ userRole, userName }) => {
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: 'welcome-msg',
      sender: 'assistant',
      text: `Hello ${userName}! I am your official Policy Knowledge Assistant. Ask me anything about company HR policies, leave rules, IT guidelines, or operating procedures accessible to your ${userRole.toUpperCase()} role.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      sources: []
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const sampleQuestions = [
    "What is the company's annual leave policy?",
    "What are the IT password security rules?",
    "How does sick leave approval work?",
    "What is the maternity leave entitlement?"
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isAsking]);

  const handleSend = async (textToSend?: string) => {
    const query = textToSend || inputText;
    if (!query.trim() || isAsking) return;

    const userMsg: AssistantMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsAsking(true);

    try {
      // Map history for API
      const history = messages.map(m => ({
        id: m.id,
        sender: m.sender === 'user' ? 'agent' : 'system',
        text: m.text,
        timestamp: m.timestamp
      })) as ChatMessage[];

      const result = await askAssistantApi(query.trim(), history);

      const assistantMsg: AssistantMessage = {
        id: `asst-${Date.now()}`,
        sender: 'assistant',
        text: result.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sources: result.sources
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: AssistantMessage = {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        text: err.message || "I couldn't find this information in the available company policies. Please contact HR or your administrator for clarification.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sources: []
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      {/* Assistant Header */}
      <div className="bg-slate-950 border-b border-slate-800 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/20">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-white text-base">Policy AI Assistant (RAG)</h2>
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                userRole === 'admin' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                userRole === 'trainer' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
              }`}>
                {userRole === 'admin' && <ShieldCheck className="w-3 h-3" />}
                {userRole === 'trainer' && <GraduationCap className="w-3 h-3" />}
                {userRole === 'employee' && <UserCheck className="w-3 h-3" />}
                <span>{userRole} Filter</span>
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Retrieves company policies filtered by server-side role access control
            </p>
          </div>
        </div>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-950/40">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex items-start gap-3 ${m.sender === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs ${
              m.sender === 'user'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800 text-sky-400 border border-slate-700'
            }`}>
              {m.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>

            <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 text-xs ${
              m.sender === 'user'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-900 border border-slate-800 text-slate-200 shadow-md'
            }`}>
              <div className="whitespace-pre-wrap leading-relaxed">{m.text}</div>

              {/* RAG Sources Citations */}
              {m.sources && m.sources.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-800 space-y-1.5">
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    <BookOpen className="w-3.5 h-3.5 text-sky-400" />
                    <span>Verified Policy Citations & Sources:</span>
                  </div>
                  <div className="space-y-1 font-mono text-[11px]">
                    {m.sources.map((s, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-slate-300 bg-slate-950/60 px-2.5 py-1.5 rounded-lg border border-slate-800">
                        <FileText className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        <span className="font-semibold text-slate-200">{s.documentTitle}</span>
                        <span className="text-slate-500">•</span>
                        <span className="text-slate-400">{s.sectionTitle}</span>
                        <span className="text-slate-500">•</span>
                        <span className="text-slate-400">Page {s.pageNumber}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className={`mt-2 text-[10px] text-right ${m.sender === 'user' ? 'text-indigo-200' : 'text-slate-500'}`}>
                {m.timestamp}
              </div>
            </div>
          </div>
        ))}

        {isAsking && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-slate-800 text-sky-400 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 animate-bounce" />
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xs text-slate-400 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-sky-400 animate-spin" />
              <span>Searching policy knowledge base & generating cited answer...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Questions */}
      <div className="px-4 py-2 bg-slate-950 border-t border-slate-800 flex items-center gap-2 overflow-x-auto text-xs">
        <span className="text-[11px] font-medium text-slate-400 shrink-0 flex items-center gap-1">
          <HelpCircle className="w-3.5 h-3.5 text-sky-400" />
          Quick Questions:
        </span>
        {sampleQuestions.map((q, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(q)}
            className="px-3 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-full shrink-0 text-[11px] transition"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={`Ask about company policies (${userRole} access level)...`}
          className="flex-1 px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || isAsking}
          className="p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition shadow-lg shadow-indigo-600/25 disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
