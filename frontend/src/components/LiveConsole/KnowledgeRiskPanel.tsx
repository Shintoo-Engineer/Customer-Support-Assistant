import React, { useState } from 'react';
import {
  BookOpen,
  ShieldCheck,
  AlertTriangle,
  CheckSquare,
  Square,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Info,
  ShieldAlert,
  ArrowUpRight,
  FileText
} from 'lucide-react';
import { MessageAnalysis, CoachingLevel } from '../../types';

interface KnowledgeRiskPanelProps {
  analysis?: MessageAnalysis;
  coachingLevel: CoachingLevel;
  onOpenFullKb?: (kbId: string) => void;
}

export const KnowledgeRiskPanel: React.FC<KnowledgeRiskPanelProps> = ({
  analysis,
  coachingLevel,
  onOpenFullKb
}) => {
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({});

  const toggleStep = (index: number) => {
    setCompletedSteps(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const risk = analysis?.escalationRisk || 65;
  const riskLevel = analysis?.escalationLevel || 'high';

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low':
        return {
          badge: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60',
          bar: 'bg-emerald-500',
          text: 'text-emerald-400'
        };
      case 'moderate':
        return {
          badge: 'bg-amber-950/80 text-amber-300 border-amber-700/60',
          bar: 'bg-amber-500',
          text: 'text-amber-400'
        };
      case 'high':
        return {
          badge: 'bg-rose-950/80 text-rose-300 border-rose-700/60',
          bar: 'bg-rose-500',
          text: 'text-rose-400'
        };
      case 'critical':
        return {
          badge: 'bg-rose-900 text-white border-rose-500 animate-pulse',
          bar: 'bg-rose-600',
          text: 'text-rose-500'
        };
      default:
        return {
          badge: 'bg-slate-800 text-slate-300 border-slate-700',
          bar: 'bg-indigo-500',
          text: 'text-indigo-400'
        };
    }
  };

  const riskTheme = getRiskColor(riskLevel);

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
      
      {/* Header */}
      <div className="p-3.5 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-emerald-400" />
          <span className="font-semibold text-xs uppercase tracking-wider text-slate-200">Panel 3 — Knowledge & Risk</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-[10px] font-semibold">
          <ShieldCheck className="w-3 h-3 text-emerald-400" />
          <span>Verified RAG</span>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-900/60 text-xs">
        
        {/* RAG Knowledge Retrieval Card */}
        <div className="p-3.5 rounded-xl bg-slate-800/90 border border-slate-700 space-y-3">
          
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
              Retrieved Knowledge (RAG)
            </span>
            <span className="text-[10px] font-bold text-indigo-400 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-800/50">
              {analysis?.relevantKnowledge?.confidence || 94}% Relevance
            </span>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-white text-xs">
                {analysis?.relevantKnowledge?.title || 'Duplicate Subscription Charges & Billing Disputes'}
              </h4>
              <span className="text-[10px] text-slate-400 font-mono">
                {analysis?.relevantKnowledge?.kbId || 'KB-102'}
              </span>
            </div>
            
            {/* Citation Source */}
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Source: {analysis?.relevantKnowledge?.source || 'Refund Policy → Section 3.2'}</span>
            </div>
          </div>

          {/* Excerpt */}
          <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-700/80 text-[11px] text-slate-300 leading-relaxed italic">
            "{analysis?.relevantKnowledge?.policySnippet || 'When duplicate charges occur due to gateway sync issues, verify both transaction IDs and issue immediate full credit. Inform customer: Funds reappear within 3-5 business days.'}"
          </div>

          {/* Step-by-step resolution checklist */}
          {analysis?.relevantKnowledge?.troubleshootingSteps && (
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-semibold text-slate-300 block">Required SOP Checklist:</span>
              {analysis.relevantKnowledge.troubleshootingSteps.map((step, idx) => {
                const isChecked = !!completedSteps[idx];
                return (
                  <button
                    key={idx}
                    id={`sop-step-${idx}`}
                    onClick={() => toggleStep(idx)}
                    className={`w-full text-left p-2 rounded-lg text-[11px] flex items-start gap-2 border transition ${
                      isChecked
                        ? 'bg-emerald-950/30 border-emerald-800/40 text-slate-300 line-through'
                        : 'bg-slate-900/70 border-slate-700/60 text-slate-200 hover:border-slate-600'
                    }`}
                  >
                    {isChecked ? (
                      <CheckSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                    )}
                    <span>{step}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Open Full Article Button */}
          {onOpenFullKb && (
            <button
              id="open-full-kb-btn"
              onClick={() => onOpenFullKb(analysis?.relevantKnowledge?.kbId || 'KB-102')}
              className="w-full py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-[11px] font-medium flex items-center justify-center gap-1.5 transition"
            >
              <span>Read Full KB Document</span>
              <ArrowUpRight className="w-3 h-3 text-slate-400" />
            </button>
          )}

        </div>

        {/* Escalation Risk Monitor */}
        <div className="p-3.5 rounded-xl bg-slate-800/90 border border-slate-700 space-y-3">
          
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              Escalation Risk Monitor
            </span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${riskTheme.badge}`}>
              {riskLevel} Risk
            </span>
          </div>

          {/* Risk Gauge Bar */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-slate-200">Escalation Probability</span>
              <span className={`font-bold ${riskTheme.text}`}>{risk}%</span>
            </div>
            <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-700">
              <div
                className={`h-full rounded-full transition-all duration-500 ${riskTheme.bar}`}
                style={{ width: `${risk}%` }}
              />
            </div>
          </div>

          {/* Why is customer at risk? (Bullet reasons) */}
          {analysis?.riskReasons && analysis.riskReasons.length > 0 && (
            <div className="p-2.5 rounded-lg bg-slate-900/80 border border-rose-950/60 text-[11px] space-y-1.5">
              <span className="font-semibold text-rose-300 block">Risk Triggers Detected:</span>
              {analysis.riskReasons.map((reason, i) => (
                <div key={i} className="flex items-start gap-1.5 text-slate-300">
                  <span className="text-rose-400 font-bold">•</span>
                  <span>{reason}</span>
                </div>
              ))}
            </div>
          )}

          {/* Recommended Intervention */}
          {analysis?.recommendedIntervention && (
            <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-800/50 text-[11px] text-amber-200 space-y-1">
              <span className="font-bold text-amber-300 block uppercase tracking-wider text-[10px]">
                Recommended Intervention:
              </span>
              <p className="leading-relaxed">{analysis.recommendedIntervention}</p>
            </div>
          )}

        </div>

      </div>

    </div>
  );
};
