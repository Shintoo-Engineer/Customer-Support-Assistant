import React from 'react';
import {
  Scale,
  X,
  TrendingUp,
  TrendingDown,
  Award,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { SessionRecord } from '../types';

interface SessionComparisonModalProps {
  session1: SessionRecord;
  session2: SessionRecord;
  onClose: () => void;
}

export const SessionComparisonModal: React.FC<SessionComparisonModalProps> = ({
  session1,
  session2,
  onClose
}) => {
  const getDeltaBadge = (v1: number, v2: number, invert = false) => {
    const delta = v2 - v1;
    const isPositive = invert ? delta < 0 : delta > 0;
    if (delta === 0) return <span className="text-slate-400 text-xs font-semibold">0%</span>;

    return (
      <span className={`inline-flex items-center text-xs font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
        {isPositive ? '↑ +' : '↓ '}{delta}%
      </span>
    );
  };

  const metrics = [
    { label: 'Overall Score', v1: session1.score.overall, v2: session2.score.overall },
    { label: 'Intent Handling', v1: session1.score.intentHandling, v2: session2.score.intentHandling },
    { label: 'Knowledge & RAG', v1: session1.score.knowledgeUsage, v2: session2.score.knowledgeUsage },
    { label: 'Empathy & Tone', v1: session1.score.empathy, v2: session2.score.empathy },
    { label: 'Clarity', v1: session1.score.clarity, v2: session2.score.clarity },
    { label: 'Resolution Delivery', v1: session1.score.resolution, v2: session2.score.resolution },
    { label: 'Escalation Handling', v1: session1.score.escalationHandling, v2: session2.score.escalationHandling },
    { label: 'Policy Adherence', v1: session1.score.policyCompliance, v2: session2.score.policyCompliance }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-4xl w-full p-6 space-y-6 shadow-2xl relative max-h-[90vh] overflow-y-auto animate-scaleUp">
        
        <button
          onClick={onClose}
          className="absolute right-5 top-5 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center text-indigo-400">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Historical Session Comparison</h2>
            <p className="text-xs text-slate-400">Side-by-side progression analysis across key coaching dimensions.</p>
          </div>
        </div>

        {/* Sessions Headers */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-slate-800 border border-slate-700 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400">Baseline Session</span>
            <h3 className="font-bold text-xs text-white line-clamp-1">{session1.scenarioTitle}</h3>
            <div className="text-xl font-extrabold text-indigo-300">{session1.score.overall}% Score</div>
          </div>

          <div className="p-4 rounded-2xl bg-indigo-950/60 border border-indigo-700/60 space-y-1">
            <span className="text-[10px] uppercase font-bold text-indigo-400">Latest Session</span>
            <h3 className="font-bold text-xs text-white line-clamp-1">{session2.scenarioTitle}</h3>
            <div className="text-xl font-extrabold text-emerald-400">{session2.score.overall}% Score</div>
          </div>
        </div>

        {/* Metric Deltas Table */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider">Metric Progressions</h4>
          <div className="divide-y divide-slate-800 border border-slate-800 rounded-2xl overflow-hidden bg-slate-850">
            {metrics.map((m, i) => (
              <div key={i} className="p-3.5 flex items-center justify-between text-xs hover:bg-slate-800/50 transition">
                <span className="font-medium text-slate-300 w-1/3">{m.label}</span>
                <div className="flex items-center justify-between w-2/3">
                  <span className="font-semibold text-slate-400">{m.v1}%</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
                  <span className="font-bold text-white">{m.v2}%</span>
                  <div className="w-20 text-right">
                    {getDeltaBadge(m.v1, m.v2)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-800/40 text-xs text-emerald-200">
          <b className="text-emerald-400">AI Growth Summary: </b>
          You demonstrated a {session2.score.overall - session1.score.overall}% overall improvement, showing significant progress in de-escalation composure and policy citation precision.
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
          >
            Close Comparison
          </button>
        </div>

      </div>
    </div>
  );
};
