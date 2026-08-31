import React from 'react';
import {
  Award,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  RotateCcw,
  BookOpen,
  ArrowRight,
  Download,
  Share2,
  ShieldCheck,
  Zap,
  Flame,
  FileText
} from 'lucide-react';
import { SessionRecord, Scenario } from '../types';

interface PerformanceReportViewProps {
  sessionRecord: SessionRecord;
  scenario: Scenario;
  onPracticeAgain: () => void;
  onGoToDashboard: () => void;
}

export const PerformanceReportView: React.FC<PerformanceReportViewProps> = ({
  sessionRecord,
  scenario,
  onPracticeAgain,
  onGoToDashboard
}) => {
  const { score, timelineEvents, topStrengths, topWeaknesses, recommendedTrainings, responseComparisons, xpEarned } = sessionRecord;

  const getScoreColor = (val: number) => {
    if (val >= 90) return 'text-emerald-400 border-emerald-800 bg-emerald-950/60';
    if (val >= 75) return 'text-sky-400 border-sky-800 bg-sky-950/60';
    if (val >= 60) return 'text-amber-400 border-amber-800 bg-amber-950/60';
    return 'text-rose-400 border-rose-800 bg-rose-950/60';
  };

  const getGrade = (val: number) => {
    if (val >= 95) return 'A+ Exceptional';
    if (val >= 90) return 'A Outstanding';
    if (val >= 80) return 'B Proficient';
    if (val >= 70) return 'C Developing';
    return 'D Needs Practice';
  };

  const handleExportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(sessionRecord, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `AI_Support_Report_${sessionRecord.id}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-8 space-y-8 animate-fadeIn">
      
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl -z-0 pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-950 text-indigo-300 border border-indigo-700/60 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                Session Evaluation Report
              </span>
              <span className="text-xs text-slate-400">ID: {sessionRecord.id}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              {scenario.title}
            </h1>
            <p className="text-xs text-slate-300">
              Agent: <b className="text-white">{sessionRecord.agentName}</b> • Customer: <b className="text-white">{scenario.customerPersona.name}</b> ({scenario.customerPersona.type})
            </p>
          </div>

          {/* Big Score Card */}
          <div className="flex items-center gap-4 bg-slate-800/90 p-4 sm:p-5 rounded-2xl border border-slate-700 shadow-lg">
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-extrabold text-white">
                {score.overall}<span className="text-sm font-normal text-slate-400">/100</span>
              </div>
              <span className="text-xs font-semibold text-emerald-400 block mt-0.5">
                {getGrade(score.overall)}
              </span>
            </div>

            <div className="h-12 w-px bg-slate-700" />

            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-amber-300 font-semibold">
                <Flame className="w-4 h-4 text-amber-400 fill-amber-400" />
                +{xpEarned} XP Earned
              </div>
              <span className="text-[11px] text-slate-400 block">
                Result: {sessionRecord.resolved ? <b className="text-emerald-400">Resolved</b> : <b className="text-rose-400">Escalated</b>}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 pt-6 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              id="btn-report-practice-again"
              onClick={onPracticeAgain}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2 transition shadow-md"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Practice Again
            </button>
            <button
              id="btn-report-dashboard"
              onClick={onGoToDashboard}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
            >
              Back to Dashboard
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-export-report-json"
              onClick={handleExportJson}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              Export Report JSON
            </button>
          </div>
        </div>
      </div>

      {/* 8-Metric Score Breakdown Grid */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Award className="w-4 h-4 text-indigo-400" />
          8-Factor Skill Assessment Breakdown
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Intent Handling', val: score.intentHandling, desc: 'Accuracy in addressing root cause' },
            { label: 'Knowledge & RAG', val: score.knowledgeUsage, desc: 'Policy compliance & zero hallucination' },
            { label: 'Empathy & Validation', val: score.empathy, desc: 'Emotional de-escalation tone' },
            { label: 'Communication Clarity', val: score.clarity, desc: 'Jargon-free structured explanations' },
            { label: 'Tone & Composure', val: score.tone, desc: 'Professional, calm & positive tone' },
            { label: 'Resolution Delivery', val: score.resolution, desc: 'Concrete solution & follow-through' },
            { label: 'Escalation Prevention', val: score.escalationHandling, desc: 'Mitigated risk triggers effectively' },
            { label: 'Policy Adherence', val: score.policyCompliance, desc: 'Protected company SOP guidelines' }
          ].map((item, idx) => (
            <div key={idx} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">{item.label}</span>
                <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getScoreColor(item.val)}`}>
                  {item.val}%
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-sky-400 rounded-full"
                  style={{ width: `${item.val}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Resolution Quality Score & CSAT */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          Resolution Quality & Customer Satisfaction
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
          <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700">
            <span className="text-[11px] text-slate-400 block mb-1">Problem ID</span>
            <span className="font-bold text-white text-base">{score.resolutionQuality.problemIdentification}%</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700">
            <span className="text-[11px] text-slate-400 block mb-1">Correct Solution</span>
            <span className="font-bold text-white text-base">{score.resolutionQuality.correctSolution}%</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700">
            <span className="text-[11px] text-slate-400 block mb-1">Knowledge Accuracy</span>
            <span className="font-bold text-white text-base">{score.resolutionQuality.knowledgeAccuracy}%</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700">
            <span className="text-[11px] text-slate-400 block mb-1">Customer CSAT</span>
            <span className="font-bold text-emerald-400 text-base">{score.resolutionQuality.customerSatisfaction}%</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700">
            <span className="text-[11px] text-slate-400 block mb-1">Completeness</span>
            <span className="font-bold text-white text-base">{score.resolutionQuality.resolutionCompleteness}%</span>
          </div>
        </div>
      </div>

      {/* Before vs After Response Comparisons */}
      {responseComparisons && responseComparisons.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            Before vs. After Response Master Coaching
          </h3>

          <div className="space-y-4">
            {responseComparisons.map((comp, idx) => (
              <div key={idx} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
                  <span>Turn #{comp.turnNumber} Review</span>
                  <span className="text-indigo-400">AI Master Comparison</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {/* Trainee's Original */}
                  <div className="p-3.5 rounded-xl bg-slate-800/90 border border-slate-700 space-y-1">
                    <span className="font-bold text-slate-300 block text-[11px]">Your Original Message:</span>
                    <p className="text-slate-200 italic">"{comp.originalAgentText}"</p>
                  </div>

                  {/* AI Improved Version */}
                  <div className="p-3.5 rounded-xl bg-indigo-950/50 border border-indigo-800/60 space-y-1">
                    <span className="font-bold text-indigo-300 block text-[11px] flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-indigo-400" />
                      AI High-Impact Alternative:
                    </span>
                    <p className="text-indigo-100 italic">"{comp.aiImprovedText}"</p>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-[11px] text-slate-300">
                  <b className="text-indigo-400">Why this improves the outcome: </b>
                  {comp.improvementExplanation}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chronological Coaching Timeline */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Clock className="w-4 h-4 text-sky-400" />
          Chronological AI Coaching Timeline
        </h3>

        <div className="relative pl-6 border-l border-slate-800 space-y-4">
          {timelineEvents.map((evt, idx) => (
            <div key={idx} className="relative">
              <span className={`absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${
                evt.severity === 'positive' ? 'bg-emerald-500' : (evt.severity === 'warning' ? 'bg-amber-500' : 'bg-indigo-500')
              }`} />
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <span className="text-slate-500 font-mono">[{evt.timestamp}]</span>
                <span>Turn {evt.turn}:</span>
                <span className="capitalize text-white">{evt.type.replace('_', ' ')}</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{evt.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Strengths, Weaknesses & Recommended Training */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Strengths */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <h4 className="font-bold text-xs text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Key Strengths
          </h4>
          <ul className="space-y-2 text-xs text-slate-300">
            {topStrengths.map((str, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">•</span>
                <span>{str}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Weaknesses / Growth Areas */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <h4 className="font-bold text-xs text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            Growth Opportunities
          </h4>
          <ul className="space-y-2 text-xs text-slate-300">
            {topWeaknesses.map((w, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">•</span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Recommended Trainings */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <h4 className="font-bold text-xs text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-indigo-400" />
            Recommended Next Trainings
          </h4>
          <ul className="space-y-2 text-xs text-slate-300">
            {recommendedTrainings.map((tr, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-indigo-400 font-bold">•</span>
                <span>{tr}</span>
              </li>
            ))}
          </ul>
        </div>

      </div>

    </div>
  );
};
