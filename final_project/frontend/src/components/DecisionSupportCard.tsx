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

      {/* Rationale */}
      <div className="mt-2.5 text-xs text-slate-600 bg-white/70 rounded-lg p-2.5 border border-slate-200/60 leading-relaxed">
        <span className="font-semibold text-slate-700 block mb-0.5">Rationale:</span>
        {decision.rationale}
      </div>

      {/* Risk flags */}
      {decision.risk_flags && decision.risk_flags.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-2xs text-slate-400 font-medium">Flags:</span>
          {decision.risk_flags.map((flag, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-medium bg-red-50 text-red-700 border border-red-200"
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
          onClick={() => {
            const action = decision.recommended_action;
            let text = "I understand your concern. Let me resolve this for you immediately.";
            if (action === "escalate") {
              text = "I completely understand your frustration. I am escalating this ticket to my supervisor who will assist you immediately.";
            } else if (action === "apologize_and_resolve") {
              text = "I sincerely apologize for the inconvenience. Let me resolve this for you right away.";
            } else if (action === "provide_status") {
              text = "Let me check the exact status of your request and get right back to you.";
            } else if (action === "clarify") {
              text = "Could you please provide a little more detail so I can accurately resolve this for you?";
            } else if (action === "offer_options") {
              text = "I want to make this right. Let me offer you a few options to resolve this.";
            } else if (action === "provide_instructions") {
              text = "I can certainly help you with that. Here are the step-by-step instructions.";
            }
            onApplyAction(text);
          }}
          className="mt-3 w-full py-1.5 px-3 rounded-lg text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <span>Use Suggested Tone in Reply</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
