import React, { useState } from 'react';
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  HelpCircle,
  Check,
  RefreshCw,
  Zap,
  ArrowRight,
  MessageSquare,
  Shield,
  Lightbulb,
  Lock,
  ChevronDown,
  ChevronUp,
  BrainCircuit
} from 'lucide-react';
import { MessageAnalysis, CoachingLevel } from '../../types';

interface CoachingPanelProps {
  analysis?: MessageAnalysis;
  onUseSuggestion: (text: string) => void;
  onGenerateAlternative: () => void;
  isAnalyzing: boolean;
  coachingLevel: CoachingLevel;
}

type ResponseMode = 'empathetic' | 'professional' | 'quick' | 'concise' | 'detailed' | 'deEscalation';

export const CoachingPanel: React.FC<CoachingPanelProps> = ({
  analysis,
  onUseSuggestion,
  onGenerateAlternative,
  isAnalyzing,
  coachingLevel
}) => {
  const [selectedMode, setSelectedMode] = useState<ResponseMode>('empathetic');
  const [showWhyDrawer, setShowWhyDrawer] = useState(false);
  const [showCounterfactual, setShowCounterfactual] = useState(false);
  const [copiedMode, setCopiedMode] = useState<string | null>(null);

  if (coachingLevel === 'assessment') {
    return (
      <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-2xl p-6 items-center justify-center text-center shadow-lg">
        <div className="w-14 h-14 rounded-2xl bg-amber-950/60 border border-amber-800/60 flex items-center justify-center text-amber-400 mb-4">
          <Lock className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-white mb-2">Assessment Mode Active</h3>
        <p className="text-xs text-slate-400 max-w-sm leading-relaxed mb-4">
          Live AI response suggestions and real-time hints are hidden during blind assessment tests to evaluate your genuine unassisted customer support skills.
        </p>
        <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-slate-300 max-w-xs">
          A comprehensive 8-metric AI Performance Report will be generated automatically after the session is completed.
        </div>
      </div>
    );
  }

  const currentSuggestion = analysis?.suggestedResponses?.[selectedMode] ||
    "I understand why this is frustrating. Let me check your account details immediately and resolve this for you.";

  const handleCopySuggestion = (text: string, mode: string) => {
    onUseSuggestion(text);
    setCopiedMode(mode);
    setTimeout(() => setCopiedMode(null), 2000);
  };

  const getFrustrationColor = (level: number) => {
    if (level < 35) return 'text-emerald-400 bg-emerald-950/60 border-emerald-800/60';
    if (level < 65) return 'text-amber-400 bg-amber-950/60 border-amber-800/60';
    return 'text-rose-400 bg-rose-950/60 border-rose-800/60';
  };

  const getTrendIcon = (trend?: 'increasing' | 'decreasing' | 'stable') => {
    if (trend === 'increasing') return <TrendingUp className="w-3.5 h-3.5 text-rose-400" />;
    if (trend === 'decreasing') return <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />;
    return <Minus className="w-3.5 h-3.5 text-slate-400" />;
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
      
      {/* Header */}
      <div className="p-3.5 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BrainCircuit className="w-4 h-4 text-indigo-400" />
          <span className="font-semibold text-xs uppercase tracking-wider text-slate-200">Panel 2 — AI Real-Time Coaching</span>
        </div>
        {isAnalyzing && (
          <span className="flex items-center gap-1.5 text-[11px] text-indigo-400 font-medium animate-pulse">
            <RefreshCw className="w-3 h-3 animate-spin" />
            Analyzing turn...
          </span>
        )}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-900/60 text-xs">

        {/* Real-time Customer Intelligence (Intent + Sentiment + Frustration) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          
          {/* Intent Card */}
          <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700">
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
              <span>Customer Intent</span>
              <span className="text-indigo-400 font-semibold">{analysis?.intentConfidence || 94}% match</span>
            </div>
            <p className="font-bold text-white text-xs truncate">
              {analysis?.intent || 'Billing Discrepancy & Refund'}
            </p>
          </div>

          {/* Frustration & Sentiment Meter */}
          <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700">
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
              <span>Frustration Level</span>
              <div className="flex items-center gap-1">
                {getTrendIcon(analysis?.frustrationTrend)}
                <span className="capitalize font-medium text-slate-300">{analysis?.frustrationTrend || 'increasing'}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getFrustrationColor(analysis?.frustrationLevel || 72)}`}>
                {analysis?.frustrationLevel || 72}%
              </span>
              <span className="text-[11px] text-slate-400 capitalize">
                Sentiment: <b className="text-rose-300">{analysis?.sentiment || 'Negative'}</b>
              </span>
            </div>
          </div>

        </div>

        {/* Customer Emotions */}
        {analysis?.emotions && analysis.emotions.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-slate-400 font-medium">Emotions:</span>
            {analysis.emotions.map((emotion, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-950/40 text-rose-300 border border-rose-800/40"
              >
                {emotion}
              </span>
            ))}
          </div>
        )}

        {/* Real-time Coach Whisper Alert */}
        {analysis?.coachWhisper && (
          <div className="p-3 rounded-xl bg-indigo-950/50 border border-indigo-700/60 text-xs text-indigo-100 flex items-start gap-2.5">
            <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 animate-bounce" />
            <div>
              <span className="font-semibold text-indigo-300 uppercase tracking-wider text-[10px] block mb-0.5">Coach Whisper</span>
              <p className="text-xs leading-relaxed">{analysis.coachWhisper}</p>
            </div>
          </div>
        )}

        {/* Suggested Response Generator (Modes & Text) */}
        <div className="p-3.5 rounded-xl bg-slate-800/90 border border-slate-700 space-y-3">
          
          {/* Header & Modes tabs */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Recommended Responses</span>
            </div>
            <button
              id="coaching-refresh-suggestions"
              onClick={onGenerateAlternative}
              className="text-[11px] text-slate-400 hover:text-indigo-400 flex items-center gap-1 transition"
            >
              <RefreshCw className="w-3 h-3" />
              Regenerate
            </button>
          </div>

          {/* Response Style Switcher Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px]">
            {(
              [
                { id: 'empathetic', label: 'Empathetic' },
                { id: 'professional', label: 'Professional' },
                { id: 'deEscalation', label: 'De-escalation' },
                { id: 'quick', label: 'Quick' },
                { id: 'concise', label: 'Concise' },
                { id: 'detailed', label: 'Detailed' }
              ] as { id: ResponseMode; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                id={`suggestion-tab-${tab.id}`}
                onClick={() => setSelectedMode(tab.id)}
                className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition ${
                  selectedMode === tab.id
                    ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                    : 'bg-slate-700/60 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Current Suggestion Box */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-700/80 text-xs text-slate-200 leading-relaxed relative">
            <p className="italic">"{currentSuggestion}"</p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-1">
            <button
              id="btn-why-this-response"
              onClick={() => setShowWhyDrawer(!showWhyDrawer)}
              className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium transition"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Why this response?</span>
              {showWhyDrawer ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            <button
              id="btn-use-suggestion"
              onClick={() => handleCopySuggestion(currentSuggestion, selectedMode)}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
            >
              {copiedMode === selectedMode ? <Check className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
              <span>{copiedMode === selectedMode ? 'Applied to Input!' : 'Use Suggestion'}</span>
            </button>
          </div>

          {/* "Why This Response?" Explanations */}
          {showWhyDrawer && analysis?.whyReasons && (
            <div className="p-3 rounded-lg bg-slate-950/80 border border-indigo-900/50 text-[11px] text-slate-300 space-y-1.5 animate-fadeIn">
              <span className="font-semibold text-indigo-300 text-xs block mb-1">AI Reasoning Breakdown:</span>
              {analysis.whyReasons.map((reason, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <span className="text-indigo-400 font-bold">•</span>
                  <span>{reason}</span>
                </div>
              ))}
            </div>
          )}

        </div>

        {/* Counterfactual Coaching Preview */}
        {analysis?.counterfactual && (
          <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-xs text-amber-300">
                <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                <span>Counterfactual Coaching</span>
              </div>
              <button
                id="btn-toggle-counterfactual"
                onClick={() => setShowCounterfactual(!showCounterfactual)}
                className="text-[11px] text-slate-400 hover:text-slate-200"
              >
                {showCounterfactual ? 'Hide' : 'What if you said something else?'}
              </button>
            </div>

            {showCounterfactual && (
              <div className="p-2.5 rounded-lg bg-slate-900 border border-amber-900/40 text-[11px] text-slate-300 space-y-2">
                <div>
                  <span className="text-rose-400 font-semibold">Poor Example: </span>
                  <span className="italic">"{analysis.counterfactual.alternativeResponse}"</span>
                </div>
                <div className="p-2 rounded bg-rose-950/30 border border-rose-800/40 text-rose-200">
                  <b>Predicted Risk Impact:</b> Frustration would rise by {Math.abs(analysis.counterfactual.predictedRiskDrop)}%. {analysis.counterfactual.reasoning}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Agent Turn Evaluation (If available) */}
        {analysis?.agentEvaluation && (
          <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold text-white">
              <span>Your Previous Turn Evaluation</span>
              <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700 text-[10px]">
                Tone: {analysis.agentEvaluation.tone}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-700/60">
                <span className="text-slate-400 block">Empathy</span>
                <span className="font-bold text-white text-xs">{analysis.agentEvaluation.empathyScore}%</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-700/60">
                <span className="text-slate-400 block">Clarity</span>
                <span className="font-bold text-white text-xs">{analysis.agentEvaluation.clarityScore}%</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-700/60">
                <span className="text-slate-400 block">Policy</span>
                <span className="font-bold text-white text-xs">{analysis.agentEvaluation.policyComplianceScore}%</span>
              </div>
            </div>

            {analysis.agentEvaluation.problemNoticed && (
              <p className="text-[11px] text-amber-300 leading-tight">
                <b>Feedback:</b> {analysis.agentEvaluation.problemNoticed}
              </p>
            )}
          </div>
        )}

      </div>

    </div>
  );
};
