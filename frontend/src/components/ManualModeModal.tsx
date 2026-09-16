import React, { useState } from 'react';
import {
  FileSearch,
  Sparkles,
  Send,
  X,
  RefreshCw,
  Copy,
  Check,
  ShieldCheck,
  AlertTriangle,
  TrendingUp,
  BookOpen
} from 'lucide-react';
import { MessageAnalysis } from '../types';

interface ManualModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAnalyzeMessage: (customerMessage: string) => Promise<MessageAnalysis | null>;
}

export const ManualModeModal: React.FC<ManualModeModalProps> = ({
  isOpen,
  onClose,
  onAnalyzeMessage
}) => {
  const [inputText, setInputText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<MessageAnalysis | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    setIsAnalyzing(true);
    try {
      const res = await onAnalyzeMessage(inputText.trim());
      setAnalysisResult(res);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const sampleMessages = [
    "I was charged twice on my card for $49 and your email team ignored me. I want a refund now or I'm calling my bank!",
    "My package arrived completely crushed and the item is cracked. My wedding event is in 2 days. What can you do right now?",
    "I'm locked out of my corporate account and have a board presentation in 20 minutes. Unlock my access immediately!"
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-4xl w-full p-6 space-y-6 shadow-2xl relative max-h-[90vh] overflow-y-auto animate-scaleUp">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center text-indigo-400">
            <FileSearch className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Manual Mode — Message Analysis & Instant Coaching</h2>
            <p className="text-xs text-slate-400">Paste any real customer message or support ticket to get intent, sentiment, risk, and 6 response variations.</p>
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleAnalyze} className="space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-200">Customer Message / Ticket Text:</label>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400">Quick test:</span>
                {sampleMessages.map((msg, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setInputText(msg)}
                    className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-indigo-300 hover:bg-slate-750 border border-slate-700"
                  >
                    Sample #{i + 1}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              rows={3}
              required
              placeholder="Paste raw customer message here..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="w-full p-3.5 bg-slate-800 border border-slate-700 rounded-2xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none leading-relaxed"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isAnalyzing || !inputText.trim()}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2 shadow-md transition disabled:opacity-50"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Analyzing with Multi-Agent Pipeline...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Analyze Message</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Analysis Results Display */}
        {analysisResult && (
          <div className="space-y-6 pt-4 border-t border-slate-800 animate-fadeIn">
            
            {/* Real-time Intel Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-xs">
                <span className="text-slate-400 block text-[10px]">Detected Intent</span>
                <span className="font-bold text-white text-xs">{analysisResult.intent}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-xs">
                <span className="text-slate-400 block text-[10px]">Frustration Level</span>
                <span className="font-bold text-rose-400 text-xs">{analysisResult.frustrationLevel}%</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-xs">
                <span className="text-slate-400 block text-[10px]">Escalation Risk</span>
                <span className="font-bold text-amber-400 text-xs">{analysisResult.escalationRisk}% ({analysisResult.escalationLevel})</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-xs">
                <span className="text-slate-400 block text-[10px]">Retrieved RAG</span>
                <span className="font-bold text-emerald-400 text-xs">{analysisResult.relevantKnowledge?.kbId || 'KB-102'}</span>
              </div>
            </div>

            {/* Coach Whisper */}
            {analysisResult.coachWhisper && (
              <div className="p-3.5 rounded-2xl bg-indigo-950/50 border border-indigo-700/60 text-xs text-indigo-100 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-indigo-300 block text-[11px] mb-0.5">Coach Directive:</span>
                  <p>{analysisResult.coachWhisper}</p>
                </div>
              </div>
            )}

            {/* Suggested Responses (6 Variations) */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Multi-Style Recommended Responses
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { key: 'empathetic', label: 'Empathetic & Emotional Validation', text: analysisResult.suggestedResponses.empathetic },
                  { key: 'professional', label: 'Formal & Professional', text: analysisResult.suggestedResponses.professional },
                  { key: 'deEscalation', label: 'High-Impact De-escalation', text: analysisResult.suggestedResponses.deEscalation },
                  { key: 'concise', label: 'Concise & Direct', text: analysisResult.suggestedResponses.concise }
                ].map((item) => (
                  <div key={item.key} className="p-3.5 rounded-2xl bg-slate-800 border border-slate-700 space-y-2 flex flex-col justify-between">
                    <div>
                      <span className="font-bold text-indigo-300 text-[11px] block">{item.label}</span>
                      <p className="text-xs text-slate-200 mt-1 italic leading-relaxed">"{item.text}"</p>
                    </div>
                    <div className="flex justify-end pt-1">
                      <button
                        onClick={() => handleCopy(item.text, item.key)}
                        className="px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-[11px] font-medium flex items-center gap-1 transition"
                      >
                        {copiedKey === item.key ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedKey === item.key ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
