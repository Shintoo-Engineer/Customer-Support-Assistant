import React, { useState } from 'react';
import {
  GraduationCap,
  Users,
  Bot,
  Sparkles,
  BookOpen,
  CheckCircle2,
  BarChart3,
  Award,
  PlayCircle,
  Clock
} from 'lucide-react';
import { AiAssistantView } from './AiAssistantView';
import { UserAccount } from '../types';

interface TrainerDashboardViewProps {
  user: UserAccount;
  onOpenLiveConsole?: () => void;
  onOpenScenarios?: () => void;
}

export const TrainerDashboardView: React.FC<TrainerDashboardViewProps> = ({
  user,
  onOpenLiveConsole,
  onOpenScenarios
}) => {
  const [activeTrainerTab, setActiveTrainerTab] = useState<'overview' | 'employees' | 'assistant'>('overview');

  const assignedEmployees = [
    { id: 'usr-employee-1', name: 'Alex Rivera', email: 'employee@example.com', score: '92%', status: 'Active', scenariosCompleted: 14 },
    { id: 'usr-employee-2', name: 'Priya Sharma', email: 'priya@example.com', score: '88%', status: 'Active', scenariosCompleted: 11 },
    { id: 'usr-employee-3', name: 'David Chen', email: 'david@example.com', score: '85%', status: 'Active', scenariosCompleted: 9 }
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/80 border border-slate-800 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
              <GraduationCap className="w-3.5 h-3.5" />
              TRAINER DASHBOARD
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">Welcome back, {user.name}</h1>
          <p className="text-xs text-slate-400 mt-1">
            Evaluate employee practice transcripts, guide training scenarios, and access company & training policies.
          </p>
        </div>

        {/* Action Tabs */}
        <div className="flex items-center gap-2 bg-slate-950/80 p-1.5 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTrainerTab('overview')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTrainerTab === 'overview' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Trainer Overview
          </button>
          <button
            onClick={() => setActiveTrainerTab('employees')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTrainerTab === 'employees' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Assigned Employees
          </button>
          <button
            onClick={() => setActiveTrainerTab('assistant')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTrainerTab === 'assistant' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Policy Assistant
          </button>
        </div>
      </div>

      {activeTrainerTab === 'overview' && (
        <div className="space-y-6">
          {/* Trainer KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                <span>Assigned Employees</span>
                <Users className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-bold text-white">3 Support Reps</div>
              <div className="text-[11px] text-emerald-400 mt-1">Average CSAT Score: 90%</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                <span>Practice Simulator</span>
                <Bot className="w-4 h-4 text-sky-400" />
              </div>
              <div className="text-2xl font-bold text-white">Interactive Console</div>
              <div className="text-[11px] text-slate-400 mt-1">Real-Time AI Coaching Whispers</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                <span>Scenarios Created</span>
                <Sparkles className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-2xl font-bold text-white">AI Scenario Generator</div>
              <div className="text-[11px] text-indigo-300 mt-1">Custom Difficulty & Personas</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                <span>Trainer Policy RAG</span>
                <BookOpen className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-emerald-400">Trainer Access</div>
              <div className="text-[11px] text-slate-400 mt-1">Includes Trainer & Employee Policies</div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div
              onClick={onOpenLiveConsole}
              className="bg-slate-900 border border-slate-800 hover:border-amber-500/50 p-6 rounded-2xl cursor-pointer transition group"
            >
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-4 group-hover:scale-110 transition">
                <PlayCircle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Launch Practice Console</h3>
              <p className="text-xs text-slate-400 mt-1">
                Conduct live support simulation, test customer de-escalation skills, and evaluate AI coaching whispers.
              </p>
            </div>

            <div
              onClick={onOpenScenarios}
              className="bg-slate-900 border border-slate-800 hover:border-indigo-500/50 p-6 rounded-2xl cursor-pointer transition group"
            >
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-4 group-hover:scale-110 transition">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Scenario Generator & Library</h3>
              <p className="text-xs text-slate-400 mt-1">
                Generate custom customer support dispute scenarios with specified difficulty levels and personas.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTrainerTab === 'employees' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-400" />
            Assigned Employees
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800 text-[11px]">
                <tr>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Avg Coaching Score</th>
                  <th className="px-4 py-3">Scenarios Completed</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {assignedEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-800/50">
                    <td className="px-4 py-3 font-semibold text-white">{emp.name}</td>
                    <td className="px-4 py-3 text-slate-400">{emp.email}</td>
                    <td className="px-4 py-3 font-bold text-amber-400">{emp.score}</td>
                    <td className="px-4 py-3 text-slate-300">{emp.scenariosCompleted} sessions</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {emp.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTrainerTab === 'assistant' && (
        <AiAssistantView userRole={user.role} userName={user.name} />
      )}
    </div>
  );
};
