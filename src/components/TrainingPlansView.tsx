import React, { useState } from 'react';
import {
  GraduationCap,
  Sparkles,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowRight,
  BookOpen,
  Target,
  BarChart2,
  RefreshCw
} from 'lucide-react';
import { AgentProfile, TrainingPlanWeek, Scenario } from '../types';
import { INITIAL_TRAINING_PLANS } from '../data/initialData';

interface TrainingPlansViewProps {
  userProfile: AgentProfile;
  scenarios: Scenario[];
  onStartScenario: (scenario: Scenario) => void;
}

export const TrainingPlansView: React.FC<TrainingPlansViewProps> = ({
  userProfile,
  scenarios,
  onStartScenario
}) => {
  const [plans, setPlans] = useState<TrainingPlanWeek[]>(INITIAL_TRAINING_PLANS);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);

  const handleGenerateNextPlan = () => {
    setIsGeneratingPlan(true);
    setTimeout(() => {
      setIsGeneratingPlan(false);
      alert("✨ AI Coaching Engine generated an updated personalized 4-week curriculum based on your latest de-escalation metrics!");
    }, 1200);
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8 animate-fadeIn">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">Personalized AI Coaching & Training Plans</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-800">
              Adaptive Curriculum
            </span>
          </div>
          <p className="text-xs text-slate-400">Tailored multi-week learning paths generated automatically to target your specific skill gaps.</p>
        </div>

        <button
          onClick={handleGenerateNextPlan}
          disabled={isGeneratingPlan}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2 shadow-md transition disabled:opacity-50"
        >
          {isGeneratingPlan ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          <span>Regenerate AI Plan</span>
        </button>
      </div>

      {/* Skill Gap Analysis Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Target className="w-4 h-4 text-emerald-400" />
          Current Skill Mastery & AI Priority Targets
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Policy Adherence', score: userProfile.skills.policyCompliance, priority: 'Mastered' },
            { label: 'Knowledge Retrieval', score: userProfile.skills.knowledge, priority: 'High' },
            { label: 'Communication', score: userProfile.skills.communication, priority: 'High' },
            { label: 'Problem Solving', score: userProfile.skills.problemSolving, priority: 'Medium' },
            { label: 'Empathy & Validation', score: userProfile.skills.empathy, priority: 'Target Focus' },
            { label: 'De-escalation', score: userProfile.skills.deEscalation, priority: 'Priority #1' }
          ].map((item, i) => (
            <div key={i} className="p-3.5 rounded-2xl bg-slate-850 border border-slate-850 space-y-1.5 text-center">
              <span className="text-[11px] text-slate-400 block truncate">{item.label}</span>
              <div className="text-lg font-bold text-white">{item.score}%</div>
              <span className={`px-2 py-0.5 rounded text-[9px] font-bold block ${
                item.score < 80 ? 'bg-rose-950 text-rose-300 border border-rose-800' : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
              }`}>
                {item.priority}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 4-Week Curriculum Timeline */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Calendar className="w-4 h-4 text-indigo-400" />
          4-Week Mastery Pathway
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {plans.map((week) => {
            const isCurrent = week.status === 'current';
            return (
              <div
                key={week.weekNumber}
                className={`p-6 rounded-3xl border transition space-y-4 ${
                  isCurrent
                    ? 'bg-slate-900 border-indigo-500 shadow-xl ring-1 ring-indigo-500/30'
                    : 'bg-slate-900/80 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    isCurrent ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                  }`}>
                    Week {week.weekNumber}
                  </span>
                  <span className="text-xs text-slate-400">Target Score: <b className="text-white">{week.targetScore}%+</b></span>
                </div>

                <div>
                  <h4 className="text-base font-bold text-white">{week.title}</h4>
                  <p className="text-xs text-indigo-300 mt-1">Focus: {week.focusArea}</p>
                </div>

                {/* Assigned Scenarios */}
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-400 block">Assigned Practice Scenarios:</span>
                  <div className="space-y-1.5">
                    {week.assignedScenarios.map((scenId) => {
                      const scen = scenarios.find((s) => s.id === scenId) || scenarios[0];
                      const isDone = week.completedScenarios.includes(scenId);
                      return (
                        <div
                          key={scenId}
                          className="p-3 rounded-xl bg-slate-850 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-2 truncate">
                            {isDone ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            ) : (
                              <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                            )}
                            <span className={`truncate ${isDone ? 'text-slate-400 line-through' : 'text-slate-200 font-medium'}`}>
                              {scen?.title || scenId}
                            </span>
                          </div>

                          <button
                            onClick={() => onStartScenario(scen)}
                            className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] shrink-0 transition"
                          >
                            {isDone ? 'Retry' : 'Practice'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};
