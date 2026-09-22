import React from 'react';
import type { DecisionSupportResult } from '../types';
import { Sparkles, AlertOctagon, ShieldAlert, ArrowRight } from 'lucide-react';

interface Props {
  decision?: DecisionSupportResult | null;
  onApplyAction?: (actionText: string) => void;
}

export const DecisionSupportCard: React.FC<Props> = ({ decision, onApplyAction }) => {
  if (!decision) return null;

  const priorityColor: Record<string, string> = {
    low: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    medium: 'bg-blue-100 text-blue-800 border-blue-300',
    high: 'bg-amber-100 text-amber-800 border-amber-300',
    critical: 'bg-red-100 text-red-800 border-red-300',
  };

  return (
    <div className="border border-indigo-100 rounded-xl p-4 bg-gradient-to-br from-indigo-50/50 to-white shadow-xs">
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-indigo-100/70">
        <div className="flex items-center gap-1.5 text-indigo-900 font-semibold text-sm">
          <Sparkles className="w-4 h-4 text-indigo-600" />
          <span>AI Decision Support</span>
        </div>
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider border ${
            priorityColor[decision.priority] || 'bg-slate-100 text-slate-700'
          }`}
        >
          {decision.priority} Priority
        </span>
      </div>

      {/* Escalation Warning Banner */}
      {decision.escalation_recommended && (
        <div className="mt-2.5 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-800 flex items-start gap-2 text-xs">
          <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Supervisor Escalation Recommended:</span> Customer is at imminent dispute risk. Prioritize supervisor takeover or immediate policy exception.
          </div>
        </div>
      )}

      {/* Grid of Tone & Action */}
      <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
        <div className="p-2 rounded-lg bg-white border border-slate-200/80">
          <span className="text-slate-400 uppercase text-3xs font-semibold block">Recommended Tone</span>
          <span className="font-semibold text-slate-800 capitalize mt-0.5 block">{decision.recommended_tone}</span>
        </div>
        <div className="p-2 rounded-lg bg-white border border-slate-200/80">
          <span className="text-slate-400 uppercase text-3xs font-semibold block">Recommended Action</span>
          <span className="font-semibold text-slate-800 capitalize mt-0.5 block">{decision.recommended_action.replace(/_/g, ' ')}</span>
        </div>
      </div>

      {/* Suggested Response */}
      {decision.suggested_response && (
        <div className="mt-3 bg-indigo-600/5 rounded-lg p-3 border border-indigo-100">
          <span className="text-indigo-700 uppercase text-[10px] font-bold block mb-1">Suggested Response</span>
          <p className="text-xs text-slate-800 italic leading-relaxed">
            "{decision.suggested_response}"
          </p>

          {/* Evaluation Metrics */}
          {decision.response_evaluation && (
            <div className="mt-2.5 flex flex-wrap gap-1.5 text-[9px] uppercase font-bold tracking-wide">
              <span className="px-1.5 py-0.5 bg-white border border-indigo-200 text-indigo-700 rounded-sm">Clarity {Math.round(decision.response_evaluation.clarity * 100)}%</span>
              <span className="px-1.5 py-0.5 bg-white border border-indigo-200 text-indigo-700 rounded-sm">Empathy {Math.round(decision.response_evaluation.empathy * 100)}%</span>
              <span className="px-1.5 py-0.5 bg-white border border-indigo-200 text-indigo-700 rounded-sm">Relevance {Math.round(decision.response_evaluation.relevance * 100)}%</span>
              <span className="px-1.5 py-0.5 bg-white border border-indigo-200 text-indigo-700 rounded-sm">Pro {Math.round(decision.response_evaluation.professionalism * 100)}%</span>
            </div>
          )}
        </div>
      )}

      {/* Coaching Tips */}
      {decision.coaching_tips && decision.coaching_tips.length > 0 ? (
        <div className="mt-3 text-xs bg-white/70 rounded-lg p-2.5 border border-slate-200/60 leading-relaxed">
          <span className="font-semibold text-slate-700 block mb-1 uppercase text-[10px]">Coaching Tips:</span>
          <ul className="space-y-1.5">
            {decision.coaching_tips.map((tip, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="text-amber-500 shrink-0 mt-[1px]">💡</span>
                <span className="text-slate-700">{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="mt-2.5 text-xs text-slate-600 bg-white/70 rounded-lg p-2.5 border border-slate-200/60 leading-relaxed">
          <span className="font-semibold text-slate-700 block mb-0.5">Rationale:</span>
          {decision.rationale}
        </div>
      )}

      {/* Task 6 Phase 2: Escalation Risk Monitor */}
      {decision.escalation_monitor && (
        <div className="mt-3 bg-slate-50 rounded-lg p-3 border border-slate-200 relative">
          <span className="absolute -top-2.5 left-3 px-1.5 bg-slate-50 text-slate-600 text-[10px] font-bold uppercase tracking-wider rounded-sm border border-slate-200 border-b-0">Escalation Monitor</span>
          
          <div className="flex items-center justify-between mt-1 mb-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-800">{Math.round(decision.escalation_monitor.risk_score)}</span>
              <span className="text-[10px] text-slate-500 font-bold uppercase">/ 100</span>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
              decision.escalation_monitor.risk_level === 'Critical' ? 'bg-red-100 text-red-800 border-red-200' :
              decision.escalation_monitor.risk_level === 'High' ? 'bg-orange-100 text-orange-800 border-orange-200' :
              decision.escalation_monitor.risk_level === 'Medium' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
              'bg-emerald-100 text-emerald-800 border-emerald-200'
            }`}>
              {decision.escalation_monitor.risk_level} Risk
            </span>
          </div>

          {decision.escalation_monitor.risk_indicators.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {decision.escalation_monitor.risk_indicators.map((ind: string, i: number) => (
                <span key={i} className="px-1.5 py-0.5 bg-white border border-slate-200 text-slate-600 rounded text-[9px] font-bold uppercase">{ind}</span>
              ))}
            </div>
          )}

          <p className="text-[11px] text-slate-700 leading-relaxed border-t border-slate-100 pt-2">
            <span className="font-semibold text-slate-900 block mb-0.5">Reasoning:</span>
            {decision.escalation_monitor.risk_reasoning}
          </p>
        </div>
      )}

      {/* Task 6 Phase 3: Escalation Alert */}
      {decision.escalation_alert && decision.escalation_alert.active && (
        <div className={`mt-3 rounded-lg p-3 border-2 ${
          decision.escalation_alert.alert_level === 'Critical'
            ? 'bg-red-50 border-red-400 shadow-md shadow-red-100'
            : 'bg-orange-50 border-orange-300'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">
              {decision.escalation_alert.alert_level === 'Critical' ? '🚨' : '⚠️'}
            </span>
            <span className={`text-xs font-black uppercase tracking-wider ${
              decision.escalation_alert.alert_level === 'Critical' ? 'text-red-800' : 'text-orange-800'
            }`}>
              Escalation Alert — {decision.escalation_alert.alert_level} Risk
            </span>
            <span className={`ml-auto text-xs font-bold ${
              decision.escalation_alert.alert_level === 'Critical' ? 'text-red-700' : 'text-orange-700'
            }`}>
              {Math.round(decision.escalation_alert.risk_score)}/100
            </span>
          </div>

          {decision.escalation_alert.recommended_action && (
            <div className={`p-2 rounded text-[11px] leading-relaxed ${
              decision.escalation_alert.alert_level === 'Critical'
                ? 'bg-red-100 border border-red-200 text-red-900'
                : 'bg-orange-100 border border-orange-200 text-orange-900'
            }`}>
              <span className="font-bold block mb-0.5">Recommended Action:</span>
              {decision.escalation_alert.recommended_action}
            </div>
          )}
        </div>
      )}

      {/* Risk flags */}
      {decision.risk_flags && decision.risk_flags.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-2xs text-slate-400 font-medium">Flags:</span>
          {decision.risk_flags.map((flag, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-red-50 text-red-700 border border-red-200"
            >
              <AlertOctagon className="w-3 h-3" />
              {flag}
            </span>
          ))}
        </div>
      )}

      {onApplyAction && (
        <button
          type="button"
          onClick={() => onApplyAction(decision.suggested_response || "")}
          className="mt-3 w-full py-2 px-3 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
        >
          <span>Use Suggested Response</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
