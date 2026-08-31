import React from 'react';
import {
  Users2,
  TrendingUp,
  AlertTriangle,
  Award,
  BarChart3,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { INITIAL_LEADERBOARD } from '../data/initialData';

export const TeamAnalyticsView: React.FC = () => {
  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8 animate-fadeIn">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">Team Analytics & QA Coaching Insights</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-800">
              Trainer / Manager View
            </span>
          </div>
          <p className="text-xs text-slate-400">Aggregate performance metrics, common team mistakes, and coaching intervention recommendations.</p>
        </div>
      </div>

      {/* Team Aggregates */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
          <span className="text-xs text-slate-400 font-semibold">Team Average Score</span>
          <div className="text-3xl font-extrabold text-white">87.4%</div>
          <span className="text-[11px] text-emerald-400 font-medium">↑ +4.2% vs last month</span>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
          <span className="text-xs text-slate-400 font-semibold">First-Contact Resolution</span>
          <div className="text-3xl font-extrabold text-white">91.2%</div>
          <span className="text-[11px] text-emerald-400 font-medium">↑ +3.5% vs SLA target</span>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
          <span className="text-xs text-slate-400 font-semibold">Average Escalation Rate</span>
          <div className="text-3xl font-extrabold text-amber-400">11.8%</div>
          <span className="text-[11px] text-emerald-400 font-medium">↓ -2.4% risk reduction</span>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
          <span className="text-xs text-slate-400 font-semibold">Policy Adherence</span>
          <div className="text-3xl font-extrabold text-white">96.8%</div>
          <span className="text-[11px] text-emerald-400 font-medium">✓ Zero Hallucination</span>
        </div>
      </div>

      {/* Top Team Weaknesses & AI Recommended Remediation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Common Team Mistakes */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            Top 3 Team Recurring Mistakes
          </h3>

          <div className="space-y-3">
            {[
              {
                mistake: 'Premature Policy Quoting Without Validation',
                freq: '34% of escalated sessions',
                desc: 'Agents quote refund timelines before acknowledging customer emotions or prior delayed tickets.'
              },
              {
                mistake: 'Vague Timeframes for Bank Clearance',
                freq: '26% of billing sessions',
                desc: 'Saying "funds will come soon" instead of stating "3 to 5 business days per KB-101".'
              },
              {
                mistake: 'Unnecessary Return Friction on Damaged Goods',
                freq: '18% of shipping claims',
                desc: 'Asking customers for photo verification on low-value items under $150.'
              }
            ].map((item, i) => (
              <div key={i} className="p-3.5 rounded-2xl bg-slate-850 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-white">{item.mistake}</span>
                  <span className="text-[10px] text-rose-400 font-bold bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800/50">{item.freq}</span>
                </div>
                <p className="text-xs text-slate-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* AI Action Plan */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            Recommended Team Remediation Workshops
          </h3>

          <div className="space-y-3">
            {[
              {
                title: 'High-Frustration Billing De-escalation Clinic',
                scenarios: 'Assigned: SCENARIO-01, SCENARIO-04',
                duration: '45 mins group simulation',
                target: 'Target: Reduce escalation rate to <8%'
              },
              {
                title: 'RAG Knowledge Accuracy & Policy Verification Sprint',
                scenarios: 'Assigned: KB-101, KB-102 SOP Drill',
                duration: '30 mins self-paced',
                target: 'Target: 100% citation compliance'
              }
            ].map((plan, i) => (
              <div key={i} className="p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-800/40 space-y-1.5">
                <h4 className="font-bold text-xs text-indigo-200">{plan.title}</h4>
                <p className="text-[11px] text-slate-400">{plan.scenarios} • {plan.duration}</p>
                <span className="text-[11px] text-emerald-400 font-semibold block">{plan.target}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};
