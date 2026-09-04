import React, { useState } from 'react';
import {
  ShieldCheck,
  Users,
  FileText,
  Activity,
  Bot,
  Layers,
  CheckCircle2,
  Lock,
  Clock,
  Sparkles,
  Search,
  Server
} from 'lucide-react';
import { UserManagementView } from './UserManagementView';
import { PolicyManagementView } from './PolicyManagementView';
import { AiAssistantView } from './AiAssistantView';
import { UserAccount, AuditLogEntry } from '../types';
import { fetchAuditLogsApi } from '../services/api';

interface AdminDashboardViewProps {
  user: UserAccount;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({ user }) => {
  const [activeAdminTab, setActiveAdminTab] = useState<'overview' | 'users' | 'policies' | 'assistant' | 'audit'>('overview');
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const loadAuditLogs = async () => {
    setLoadingAudit(true);
    try {
      const logs = await fetchAuditLogsApi();
      setAuditLogs(logs);
    } catch (e) {
      console.warn('Failed to load audit logs');
    } finally {
      setLoadingAudit(false);
    }
  };

  const handleSelectTab = (tab: 'overview' | 'users' | 'policies' | 'assistant' | 'audit') => {
    setActiveAdminTab(tab);
    if (tab === 'audit') {
      loadAuditLogs();
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/80 border border-slate-800 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              SYSTEM ADMIN CONTROL CENTER
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">Welcome back, {user.name}</h1>
          <p className="text-xs text-slate-400 mt-1">
            Complete system administration authority: User Management, Policy Uploads & RAG Knowledge Base, System Audit Logs.
          </p>
        </div>

        {/* Quick Admin Action Nav Tabs */}
        <div className="flex flex-wrap items-center gap-2 bg-slate-950/80 p-1.5 rounded-xl border border-slate-800">
          <button
            onClick={() => handleSelectTab('overview')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeAdminTab === 'overview' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Overview KPI
          </button>
          <button
            onClick={() => handleSelectTab('users')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeAdminTab === 'users' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Manage Users
          </button>
          <button
            onClick={() => handleSelectTab('policies')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeAdminTab === 'policies' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Policy Uploads (RAG)
          </button>
          <button
            onClick={() => handleSelectTab('assistant')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeAdminTab === 'assistant' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            AI Policy Chat
          </button>
          <button
            onClick={() => handleSelectTab('audit')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeAdminTab === 'audit' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Audit Logs
          </button>
        </div>
      </div>

      {/* Overview Dashboard Tab */}
      {activeAdminTab === 'overview' && (
        <div className="space-y-6">
          {/* KPI Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                <span>System Role Access</span>
                <ShieldCheck className="w-4 h-4 text-rose-400" />
              </div>
              <div className="text-2xl font-bold text-white">Full Admin</div>
              <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>All Permissions Granted</span>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                <span>User Management</span>
                <Users className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-2xl font-bold text-white">Active Users</div>
              <div className="text-[11px] text-indigo-300 mt-1">Admin, Trainer, Employee accounts</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                <span>Policy Knowledge Base</span>
                <FileText className="w-4 h-4 text-sky-400" />
              </div>
              <div className="text-2xl font-bold text-white">Multi-File RAG</div>
              <div className="text-[11px] text-sky-300 mt-1">Role-Filtered Chunk Retrieval</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                <span>System Status</span>
                <Server className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-emerald-400">Operational</div>
              <div className="text-[11px] text-slate-400 mt-1">JWT Auth & REST API Active</div>
            </div>
          </div>

          {/* Admin Control Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div
              onClick={() => handleSelectTab('users')}
              className="bg-slate-900 border border-slate-800 hover:border-indigo-500/50 p-6 rounded-2xl cursor-pointer transition group"
            >
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-4 group-hover:scale-110 transition">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">User Directory & Roles</h3>
              <p className="text-xs text-slate-400 mt-1">
                Add new users, assign system roles (Admin, Trainer, Employee), update passwords, or deactivate accounts.
              </p>
            </div>

            <div
              onClick={() => handleSelectTab('policies')}
              className="bg-slate-900 border border-slate-800 hover:border-sky-500/50 p-6 rounded-2xl cursor-pointer transition group"
            >
              <div className="w-12 h-12 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center mb-4 group-hover:scale-110 transition">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Policy Knowledge Base</h3>
              <p className="text-xs text-slate-400 mt-1">
                Upload company policy documents & folders, extract text, chunk knowledge vectors, and assign role access levels.
              </p>
            </div>

            <div
              onClick={() => handleSelectTab('assistant')}
              className="bg-slate-900 border border-slate-800 hover:border-emerald-500/50 p-6 rounded-2xl cursor-pointer transition group"
            >
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-110 transition">
                <Bot className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">AI Policy Assistant</h3>
              <p className="text-xs text-slate-400 mt-1">
                Test policy-backed RAG Q&A retrieval with anti-hallucination guardrails and source document citations.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeAdminTab === 'users' && <UserManagementView />}
      {activeAdminTab === 'policies' && <PolicyManagementView />}
      {activeAdminTab === 'assistant' && <AiAssistantView userRole={user.role} userName={user.name} />}

      {/* Audit Logs Tab */}
      {activeAdminTab === 'audit' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-400" />
              System Activity & Audit Trail
            </h2>
            <button
              onClick={loadAuditLogs}
              className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs hover:bg-slate-700"
            >
              Refresh Logs
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800 text-[11px]">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {loadingAudit ? (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-slate-400">Loading audit log events...</td>
                  </tr>
                ) : auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-slate-400">No activity logged yet.</td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/50">
                      <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-semibold text-white">
                        {log.userName}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-indigo-300 border border-slate-700">
                          {log.userRole?.toUpperCase() || 'SYSTEM'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sky-400 font-mono font-medium">
                        {log.action}
                      </td>
                      <td className="px-4 py-3 text-slate-300 max-w-md truncate">
                        {log.details}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
