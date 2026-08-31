import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  Filter,
  Sliders,
  CheckCircle,
  AlertCircle,
  Database,
  Lock,
  RefreshCw,
  Key
} from 'lucide-react';
import { AuditLogEntry } from '../types';
import { INITIAL_AUDIT_LOGS } from '../data/initialData';

interface AdminAuditViewProps {
  piiMaskingEnabled: boolean;
  onTogglePiiMasking: () => void;
}

export const AdminAuditView: React.FC<AdminAuditViewProps> = ({
  piiMaskingEnabled,
  onTogglePiiMasking
}) => {
  const [logs, setLogs] = useState<AuditLogEntry[]>(INITIAL_AUDIT_LOGS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const categories = ['All', 'session', 'knowledge', 'scenario', 'system'];

  const filteredLogs = logs.filter((log) => {
    const matchCat = selectedCategory === 'All' || log.category === selectedCategory;
    const matchSearch =
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.userName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8 animate-fadeIn">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">System Administration & Audit Logs</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-800">
              Admin Console
            </span>
          </div>
          <p className="text-xs text-slate-400">Manage security settings, PII auto-masking rules, and track real-time audit logs across the platform.</p>
        </div>
      </div>

      {/* Security & System Controls Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* PII Masking Control */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">PII Masking Protection</h3>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              piiMaskingEnabled ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-slate-800 text-slate-400'
            }`}>
              {piiMaskingEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Automatically masks Credit Card PANs, Email addresses, and Phone Numbers in simulated and live conversation turns before AI processing.
          </p>
          <button
            id="admin-toggle-pii"
            onClick={onTogglePiiMasking}
            className={`w-full py-2 rounded-xl text-xs font-bold border transition ${
              piiMaskingEnabled
                ? 'bg-rose-950/60 border-rose-800/60 text-rose-300 hover:bg-rose-900/60'
                : 'bg-emerald-600 border-emerald-500 text-white hover:bg-emerald-500'
            }`}
          >
            {piiMaskingEnabled ? 'Disable PII Masking' : 'Enable PII Masking'}
          </button>
        </div>

        {/* AI Model Status */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Key className="w-5 h-5 text-indigo-400" />
              <h3 className="text-sm font-bold text-white">Gemini 3.7 Flash Engine</h3>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-800">
              Active
            </span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Server-side Multi-Agent pipeline orchestrating Turn Analysis, RAG Semantic Lookup, Risk Prediction, and Dynamic Emotional State Simulation.
          </p>
          <div className="p-2.5 rounded-xl bg-slate-850 border border-slate-800 text-[11px] text-slate-300">
            Latency: <b>~280ms</b> • Grounding: <b>Verified KB</b>
          </div>
        </div>

        {/* Access Control / RBAC */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-amber-400" />
              <h3 className="text-sm font-bold text-white">Role-Based Access (RBAC)</h3>
            </div>
            <span className="text-xs text-slate-400">3 Roles</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Configure agent practice consoles, trainer scenario authoring tools, and manager QA analytical reports.
          </p>
          <div className="p-2.5 rounded-xl bg-slate-850 border border-slate-800 text-[11px] text-slate-300">
            Active: <b>Alex Morgan (Agent / Admin)</b>
          </div>
        </div>

      </div>

      {/* Audit Logs Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-indigo-400" />
            System Audit & Event Logs
          </h3>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search audit logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-indigo-500 capitalize"
            >
              {categories.map((c) => (
                <option key={c} value={c} className="capitalize">{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="pb-3 font-semibold">Timestamp</th>
                <th className="pb-3 font-semibold">User / Source</th>
                <th className="pb-3 font-semibold">Action</th>
                <th className="pb-3 font-semibold">Category</th>
                <th className="pb-3 font-semibold">Event Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-800/40 transition">
                  <td className="py-3 text-slate-400 whitespace-nowrap">
                    {log.timestamp}
                  </td>
                  <td className="py-3 text-slate-200 whitespace-nowrap">
                    {log.userName}
                  </td>
                  <td className="py-3 font-bold text-white whitespace-nowrap">
                    {log.action}
                  </td>
                  <td className="py-3 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded text-[10px] font-sans font-semibold bg-slate-800 text-slate-300 border border-slate-700 capitalize">
                      {log.category}
                    </span>
                  </td>
                  <td className="py-3 text-slate-400 font-sans text-xs">
                    {log.details}
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
