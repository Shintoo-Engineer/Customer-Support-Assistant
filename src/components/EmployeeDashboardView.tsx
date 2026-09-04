import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  Bot,
  BookOpen,
  PlayCircle,
  FileText,
  Lock,
  Sparkles,
  Download,
  Search,
  CheckCircle2
} from 'lucide-react';
import { AiAssistantView } from './AiAssistantView';
import { UserAccount, PolicyDocument } from '../types';
import { fetchUserPoliciesApi } from '../services/api';

interface EmployeeDashboardViewProps {
  user: UserAccount;
  onOpenLiveConsole?: () => void;
}

export const EmployeeDashboardView: React.FC<EmployeeDashboardViewProps> = ({
  user,
  onOpenLiveConsole
}) => {
  const [activeEmpTab, setActiveEmpTab] = useState<'overview' | 'policies' | 'assistant'>('overview');
  const [userPolicies, setUserPolicies] = useState<PolicyDocument[]>([]);
  const [loadingPolicies, setLoadingPolicies] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadUserPolicies = async () => {
    setLoadingPolicies(true);
    try {
      const data = await fetchUserPoliciesApi();
      setUserPolicies(data);
    } catch (e) {
      console.warn('Failed to load user policies');
    } finally {
      setLoadingPolicies(false);
    }
  };

  useEffect(() => {
    loadUserPolicies();
  }, []);

  const filteredPolicies = userPolicies.filter(p =>
    p.originalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/80 border border-slate-800 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5" />
              EMPLOYEE SUPPORT DASHBOARD
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">Welcome back, {user.name}</h1>
          <p className="text-xs text-slate-400 mt-1">
            Access company HR policies, practice customer support simulation, and get instant cited policy answers.
          </p>
        </div>

        {/* Action Tabs */}
        <div className="flex items-center gap-2 bg-slate-950/80 p-1.5 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveEmpTab('overview')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeEmpTab === 'overview' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Dashboard Overview
          </button>
          <button
            onClick={() => { setActiveEmpTab('policies'); loadUserPolicies(); }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeEmpTab === 'policies' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Company Policies
          </button>
          <button
            onClick={() => setActiveEmpTab('assistant')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeEmpTab === 'assistant' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            AI Policy Chat
          </button>
        </div>
      </div>

      {activeEmpTab === 'overview' && (
        <div className="space-y-6">
          {/* Employee KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                <span>Customer Support Practice</span>
                <PlayCircle className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-2xl font-bold text-white">Live Simulator</div>
              <div className="text-[11px] text-slate-400 mt-1">Real-Time Sentiment & De-escalation</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                <span>Company Policies</span>
                <BookOpen className="w-4 h-4 text-sky-400" />
              </div>
              <div className="text-2xl font-bold text-white">Verified RAG Library</div>
              <div className="text-[11px] text-sky-300 mt-1">Leave, IT Security & HR Documents</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                <span>AI Policy Assistant</span>
                <Bot className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-emerald-400">Cited Answers</div>
              <div className="text-[11px] text-slate-400 mt-1">Strict Anti-Hallucination</div>
            </div>
          </div>

          {/* Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div
              onClick={() => setActiveEmpTab('assistant')}
              className="bg-slate-900 border border-slate-800 hover:border-indigo-500/50 p-6 rounded-2xl cursor-pointer transition group"
            >
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-4 group-hover:scale-110 transition">
                <Bot className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Ask Policy AI Assistant</h3>
              <p className="text-xs text-slate-400 mt-1">
                Ask questions about leave policies, working hours, IT security rules, or company guidelines with exact citations.
              </p>
            </div>

            <div
              onClick={onOpenLiveConsole}
              className="bg-slate-900 border border-slate-800 hover:border-sky-500/50 p-6 rounded-2xl cursor-pointer transition group"
            >
              <div className="w-12 h-12 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center mb-4 group-hover:scale-110 transition">
                <PlayCircle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Customer Support Simulator</h3>
              <p className="text-xs text-slate-400 mt-1">
                Practice handling customer support disputes with real-time emotion analysis and coaching whispers.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Accessible Policies Library */}
      {activeEmpTab === 'policies' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-sky-400" />
              Company Policy Documents (Employee Accessible)
            </h2>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search policy titles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800 text-[11px]">
                <tr>
                  <th className="px-4 py-3">Document Title</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Access Permission</th>
                  <th className="px-4 py-3">Version</th>
                  <th className="px-4 py-3 text-right">Download</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {loadingPolicies ? (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-slate-400">Loading accessible company policies...</td>
                  </tr>
                ) : filteredPolicies.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-slate-400">No policy documents found.</td>
                  </tr>
                ) : (
                  filteredPolicies.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-800/50">
                      <td className="px-4 py-3 font-semibold text-white flex items-center gap-2">
                        <FileText className="w-4 h-4 text-sky-400 shrink-0" />
                        <span>{p.originalName}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 font-semibold border border-slate-700">
                          {p.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-indigo-400 font-semibold text-[11px]">
                        {p.accessLevel}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        Version {p.version}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <a
                          href={`/api/policies/download/${p.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition shadow-sm"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeEmpTab === 'assistant' && (
        <AiAssistantView userRole={user.role} userName={user.name} />
      )}
    </div>
  );
};
