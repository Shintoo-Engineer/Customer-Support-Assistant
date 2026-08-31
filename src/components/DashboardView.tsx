import React from 'react';
import {
  Play,
  Award,
  TrendingUp,
  Flame,
  CheckCircle,
  AlertTriangle,
  Clock,
  ArrowRight,
  Sparkles,
  BarChart3,
  Bot,
  Zap,
  Target,
  FileSearch,
  Scale
} from 'lucide-react';
import {
  AgentProfile,
  Scenario,
  SessionRecord
} from '../types';

interface DashboardViewProps {
  userProfile: AgentProfile;
  scenarios: Scenario[];
  onStartScenario: (scenario: Scenario) => void;
  onViewReport: (session: SessionRecord) => void;
  onOpenQuickManual: () => void;
  onOpenReplayMode: () => void;
  onOpenCompareSessions: (session1: SessionRecord, session2: SessionRecord) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  userProfile,
  scenarios,
  onStartScenario,
  onViewReport,
  onOpenQuickManual,
  onOpenReplayMode,
  onOpenCompareSessions
}) => {
  const dailyScenario = scenarios[0] || {
    id: 'SCENARIO-01',
    title: 'Duplicate Subscription Charge Dispute',
    category: 'Billing',
    difficulty: 'hard',
    customerPersona: { name: 'Marcus Vance', type: 'Highly frustrated' },
    sessionObjectives: 'De-escalate customer and process duplicate charge refund under KB-102.'
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8 animate-fadeIn">
      
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/70 to-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-950 text-indigo-300 border border-indigo-700/60 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                Coaching Readiness: 94%
              </span>
              <span className="text-xs text-slate-400">Level {userProfile.level} Support Professional</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Welcome back, {userProfile.name}
            </h1>
            <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
              Practice real-time customer de-escalation, test policy knowledge with zero hallucination, and receive instant AI coaching on every turn.
            </p>
          </div>

          {/* Quick Action Hub */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              id="dash-start-daily-btn"
              onClick={() => onStartScenario(dailyScenario as Scenario)}
              className="px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Start Daily Challenge</span>
            </button>

            <button
              id="dash-manual-btn"
              onClick={onOpenQuickManual}
              className="px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition flex items-center gap-1.5"
            >
              <FileSearch className="w-4 h-4 text-indigo-400" />
              <span>Analyze Message</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Total Sessions', val: userProfile.totalSessions, icon: Target, trend: '+4 this week', color: 'text-indigo-400' },
          { label: 'Average Score', val: `${userProfile.averageScore}%`, icon: Award, trend: '+3% vs last month', color: 'text-emerald-400' },
          { label: 'Resolution Rate', val: `${userProfile.resolutionRate}%`, icon: CheckCircle, trend: 'Top 5% in team', color: 'text-sky-400' },
          { label: 'Avg CSAT Score', val: `${userProfile.avgCsat}%`, icon: Sparkles, trend: '+6% improvement', color: 'text-amber-400' },
          { label: 'Escalation Rate', val: `${userProfile.escalationRate}%`, icon: AlertTriangle, trend: '-4% risk reduction', color: 'text-emerald-400' },
          { label: 'Active Streak', val: `${userProfile.streakDays} Days`, icon: Flame, trend: 'Fire badge active', color: 'text-amber-400' }
        ].map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div key={idx} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">{kpi.label}</span>
                <Icon className={`w-4 h-4 ${kpi.color}`} />
              </div>
              <div className="text-xl font-bold text-white tracking-tight">{kpi.val}</div>
              <span className="text-[10px] text-slate-400 block">{kpi.trend}</span>
            </div>
          );
        })}
      </div>

      {/* Recommended Challenge & Skill Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Recommended Daily Scenario (7 Cols) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Recommended Daily Practice</h3>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-950 text-rose-300 border border-rose-800">
              Hard Difficulty
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="font-bold text-sm text-white">{dailyScenario.title}</h4>
                <p className="text-xs text-slate-400 mt-0.5">Category: {dailyScenario.category}</p>
              </div>
              <span className="text-xs font-bold text-amber-300 bg-amber-950/60 px-2 py-1 rounded border border-amber-800/60">
                +240 XP
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              <b>Objective: </b>{dailyScenario.sessionObjectives}
            </p>

            <div className="pt-2 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">Target Resolution: 4 turns or less</span>
              <button
                id="btn-launch-daily-scenario"
                onClick={() => onStartScenario(dailyScenario as Scenario)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition"
              >
                <span>Start Simulation</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Skill Mastery Snapshot (5 Cols) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Skill Mastery Profile</h3>
            </div>
            <span className="text-xs text-slate-400">Aggregate: 89%</span>
          </div>

          <div className="space-y-3">
            {[
              { skill: 'Communication Clarity', score: userProfile.skills.communication },
              { skill: 'Policy & KB Adherence', score: userProfile.skills.policyCompliance },
              { skill: 'Knowledge Retrieval', score: userProfile.skills.knowledge },
              { skill: 'Problem Solving', score: userProfile.skills.problemSolving },
              { skill: 'Empathy & Validation', score: userProfile.skills.empathy },
              { skill: 'De-escalation Under Stress', score: userProfile.skills.deEscalation }
            ].map((s, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300">{s.skill}</span>
                  <span className="font-bold text-white">{s.score}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full"
                    style={{ width: `${s.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Recent Sessions History Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Recent Practice Sessions</h3>
          </div>
          {userProfile.recentSessions.length >= 2 && (
            <button
              id="btn-compare-recent-sessions"
              onClick={() => onOpenCompareSessions(userProfile.recentSessions[0], userProfile.recentSessions[1])}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-indigo-300 font-medium border border-slate-700 flex items-center gap-1.5 transition"
            >
              <Scale className="w-3.5 h-3.5" />
              <span>Compare Last 2 Sessions</span>
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="pb-3 font-semibold">Scenario Title</th>
                <th className="pb-3 font-semibold">Mode</th>
                <th className="pb-3 font-semibold">Score</th>
                <th className="pb-3 font-semibold">Outcome</th>
                <th className="pb-3 font-semibold">XP</th>
                <th className="pb-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {userProfile.recentSessions.map((session) => (
                <tr key={session.id} className="hover:bg-slate-800/40 transition">
                  <td className="py-3.5 font-medium text-white">
                    {session.scenarioTitle}
                  </td>
                  <td className="py-3.5 capitalize text-slate-400">
                    {session.mode}
                  </td>
                  <td className="py-3.5">
                    <span className="font-bold text-emerald-400">{session.score.overall}%</span>
                  </td>
                  <td className="py-3.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      session.resolved ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800'
                    }`}>
                      {session.resolved ? 'Resolved' : 'Escalated'}
                    </span>
                  </td>
                  <td className="py-3.5 text-amber-300 font-medium">
                    +{session.xpEarned} XP
                  </td>
                  <td className="py-3.5 text-right">
                    <button
                      id={`btn-view-report-${session.id}`}
                      onClick={() => onViewReport(session)}
                      className="px-3 py-1 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-white font-medium transition"
                    >
                      View Report
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
