import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Upload,
  FolderPlus,
  ShieldCheck,
  Eye,
  Download,
  RefreshCw,
  Trash2,
  Edit,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  X,
  Lock,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Database,
  FileCheck,
  TrendingUp,
  AlertCircle,
  ChevronRight
} from 'lucide-react';
import { PolicyDocument, PolicyAccessLevel, PolicyStats } from '../types';
import {
  fetchAdminPoliciesApi,
  fetchPolicyStatsApi,
  uploadPoliciesApi,
  deletePolicyApi,
  reprocessPolicyApi,
  updatePolicyApi
} from '../services/api';

// Step-by-step upload pipeline stages
const PIPELINE_STEPS = [
  { key: 'upload',     label: 'Uploading PDF...',             pct: 10 },
  { key: 'read',       label: 'Reading PDF...',               pct: 25 },
  { key: 'extract',    label: 'Extracting text...',           pct: 45 },
  { key: 'chunks',     label: 'Creating knowledge chunks...', pct: 62 },
  { key: 'embed',      label: 'Generating embeddings...',     pct: 78 },
  { key: 'index',      label: 'Indexing document...',         pct: 90 },
  { key: 'done',       label: 'Completed ✓',                  pct: 100 }
];

export const PolicyManagementView: React.FC = () => {
  const [policies, setPolicies] = useState<PolicyDocument[]>([]);
  const [stats, setStats] = useState<PolicyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [accessFilter, setAccessFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Upload Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadCategory, setUploadCategory] = useState<string>('General');
  const [uploadAccessLevel, setUploadAccessLevel] = useState<PolicyAccessLevel>('EMPLOYEE');
  const [isUploading, setIsUploading] = useState(false);
  const [pipelineStep, setPipelineStep] = useState<number>(-1);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // View / Edit / Delete Modal State
  const [viewingPolicy, setViewingPolicy] = useState<PolicyDocument | null>(null);
  const [editingPolicy, setEditingPolicy] = useState<PolicyDocument | null>(null);
  const [deletingPolicy, setDeletingPolicy] = useState<PolicyDocument | null>(null);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, s] = await Promise.all([fetchAdminPoliciesApi(), fetchPolicyStatsApi()]);
      setPolicies(data);
      setStats(s);
    } catch (err: any) {
      setError(err.message || 'Failed to load policy library.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFiles(Array.from(e.target.files));
      setUploadError(null);
    }
  };

  const runPipeline = async (): Promise<void> => {
    for (let i = 0; i < PIPELINE_STEPS.length - 1; i++) {
      setPipelineStep(i);
      await new Promise(r => setTimeout(r, 550 + Math.random() * 300));
    }
  };

  const handleStartUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFiles.length === 0) {
      setUploadError('Please select at least one file or folder to upload.');
      return;
    }
    setIsUploading(true);
    setUploadError(null);
    setPipelineStep(0);

    // Kick off animated pipeline stages in parallel with the real upload
    const pipelinePromise = runPipeline();

    try {
      await uploadPoliciesApi(selectedFiles, uploadCategory, uploadAccessLevel);
      await pipelinePromise; // ensure animation finished
      setPipelineStep(PIPELINE_STEPS.length - 1); // 'Completed ✓'
      await new Promise(r => setTimeout(r, 700));
      setIsUploadModalOpen(false);
      setSelectedFiles([]);
      setPipelineStep(-1);
      await loadData();
    } catch (err: any) {
      setUploadError(err.message || 'Failed to process document upload.');
      setPipelineStep(-1);
    } finally {
      setIsUploading(false);
    }
  };

  const handleToggleActive = async (p: PolicyDocument) => {
    setTogglingId(p.id);
    try {
      await updatePolicyApi(p.id, { isActive: !p.isActive });
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to toggle policy status.');
    } finally {
      setTogglingId(null);
    }
  };

  const handleReprocess = async (id: string) => {
    setReprocessingId(id);
    try {
      await reprocessPolicyApi(id);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Reprocessing failed.');
    } finally {
      setReprocessingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deletingPolicy) return;
    try {
      await deletePolicyApi(deletingPolicy.id);
      setDeletingPolicy(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Deletion failed.');
    }
  };

  const handleUpdateAccessLevel = async (newAccessLevel: PolicyAccessLevel) => {
    if (!editingPolicy) return;
    try {
      await updatePolicyApi(editingPolicy.id, { accessLevel: newAccessLevel });
      setEditingPolicy(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update access level.');
    }
  };

  const filteredPolicies = policies.filter(p => {
    const matchesSearch = p.originalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
    const matchesAccess = accessFilter === 'all' || p.accessLevel === accessFilter;
    const matchesStatus = statusFilter === 'all'
      || (statusFilter === 'active' && p.isActive)
      || (statusFilter === 'inactive' && !p.isActive)
      || (statusFilter === p.status);
    return matchesSearch && matchesCategory && matchesAccess && matchesStatus;
  });

  const currentPipelineStep = pipelineStep >= 0 && pipelineStep < PIPELINE_STEPS.length
    ? PIPELINE_STEPS[pipelineStep]
    : null;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/30 border border-slate-800 p-6 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <Database className="w-6 h-6 text-sky-400" />
            <h1 className="text-xl font-bold text-white">Policy Knowledge Base</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Upload PDF policy documents to feed the AI RAG engine. Configure role-based access & versioning.
          </p>
        </div>

        <button
          onClick={() => {
            setSelectedFiles([]);
            setUploadError(null);
            setPipelineStep(-1);
            setIsUploadModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 transition shadow-lg shadow-sky-500/20 shrink-0"
        >
          <Upload className="w-4 h-4" />
          <span>Upload Policies / Folder</span>
        </button>
      </div>

      {/* KPI Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: 'Total Policies',
              value: stats.total,
              icon: <FileText className="w-5 h-5" />,
              color: 'from-slate-800 to-slate-800',
              textColor: 'text-slate-200',
              iconColor: 'text-sky-400',
              border: 'border-slate-700'
            },
            {
              label: 'Active',
              value: stats.active,
              icon: <CheckCircle2 className="w-5 h-5" />,
              color: 'from-emerald-950/40 to-slate-900',
              textColor: 'text-emerald-300',
              iconColor: 'text-emerald-400',
              border: 'border-emerald-800/40'
            },
            {
              label: 'Processing',
              value: stats.processing,
              icon: <Clock className="w-5 h-5" />,
              color: 'from-amber-950/40 to-slate-900',
              textColor: 'text-amber-300',
              iconColor: 'text-amber-400',
              border: 'border-amber-800/40'
            },
            {
              label: 'Failed',
              value: stats.failed,
              icon: <AlertCircle className="w-5 h-5" />,
              color: 'from-rose-950/40 to-slate-900',
              textColor: 'text-rose-300',
              iconColor: 'text-rose-400',
              border: 'border-rose-800/40'
            }
          ].map((kpi) => (
            <div
              key={kpi.label}
              className={`bg-gradient-to-br ${kpi.color} border ${kpi.border} rounded-2xl p-4 flex items-center gap-3`}
            >
              <div className={`${kpi.iconColor}`}>{kpi.icon}</div>
              <div>
                <div className={`text-2xl font-bold ${kpi.textColor}`}>{kpi.value}</div>
                <div className="text-[11px] text-slate-500">{kpi.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Controls: Search, Category, Role, Status Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search by title or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {[
            {
              label: 'Category',
              value: categoryFilter,
              onChange: setCategoryFilter,
              options: [
                ['all', 'All Categories'],
                ['HR', 'HR'], ['IT', 'IT'], ['Finance', 'Finance'],
                ['Security', 'Security'], ['Training', 'Training'],
                ['Returns', 'Returns'], ['Refunds', 'Refunds'],
                ['Shipping', 'Shipping'], ['Warranty', 'Warranty'],
                ['Privacy', 'Privacy'], ['Billing', 'Billing'],
                ['Customer Service', 'Customer Service'],
                ['General', 'General']
              ]
            },
            {
              label: 'Access',
              value: accessFilter,
              onChange: setAccessFilter,
              options: [['all','All Roles'], ['PUBLIC','PUBLIC'], ['EMPLOYEE','EMPLOYEE'], ['TRAINER','TRAINER'], ['ADMIN','ADMIN']]
            },
            {
              label: 'Status',
              value: statusFilter,
              onChange: setStatusFilter,
              options: [['all','All Status'], ['active','Active'], ['inactive','Inactive'], ['processing','Processing'], ['failed','Failed']]
            }
          ].map(f => (
            <div key={f.label} className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400">{f.label}:</span>
              <select
                value={f.value}
                onChange={(e) => f.onChange(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                {f.options.map(([val, lbl]) => (
                  <option key={val} value={val}>{lbl}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-950/60 border border-rose-800 rounded-xl text-xs text-rose-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Policy Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 uppercase font-semibold border-b border-slate-800 text-[11px] tracking-wider">
              <tr>
                <th className="px-5 py-4">Document</th>
                <th className="px-4 py-4">Category</th>
                <th className="px-4 py-4">Access</th>
                <th className="px-4 py-4">Version</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4">Active</th>
                <th className="px-4 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400">
                    <Sparkles className="w-5 h-5 text-sky-400 animate-spin inline mr-2" />
                    Loading policy knowledge base...
                  </td>
                </tr>
              ) : filteredPolicies.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400">
                    No policy documents found. Click <b>Upload Policies</b> to add company documents.
                  </td>
                </tr>
              ) : (
                filteredPolicies.map((p) => (
                  <tr
                    key={p.id}
                    className={`hover:bg-slate-800/30 transition ${!p.isActive ? 'opacity-60' : ''}`}
                  >
                    {/* Document */}
                    <td className="px-5 py-4 font-medium text-white">
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-[10px] font-bold border ${
                          p.isActive
                            ? 'bg-slate-800 border-slate-700 text-sky-400'
                            : 'bg-slate-900 border-slate-800 text-slate-600'
                        }`}>
                          {p.originalName.split('.').pop()?.toUpperCase() || 'DOC'}
                        </div>
                        <div>
                          <div className={`font-semibold ${p.isActive ? 'text-slate-100' : 'text-slate-500 line-through'}`}>
                            {p.originalName}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                            <span>{Math.round(p.size / 1024)} KB</span>
                            <span>•</span>
                            <span>{p.chunkCount} chunks</span>
                            <span>•</span>
                            <span>by {p.uploadedBy}</span>
                            <span>•</span>
                            <span>{new Date(p.uploadedAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="px-4 py-4">
                      <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                        {p.category}
                      </span>
                    </td>

                    {/* Access Level */}
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                        p.accessLevel === 'ADMIN'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : p.accessLevel === 'TRAINER'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : p.accessLevel === 'EMPLOYEE'
                          ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        <Lock className="w-3 h-3" />
                        {p.accessLevel}
                      </span>
                    </td>

                    {/* Version Badge */}
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                        p.version > 1
                          ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}>
                        v{p.version}
                        {p.version > 1 && <TrendingUp className="w-3 h-3 ml-0.5" />}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-4">
                      {p.status === 'indexed' && p.isActive && (
                        <span className="inline-flex items-center gap-1.5 text-emerald-400 text-[11px] font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Indexed
                        </span>
                      )}
                      {p.status === 'inactive' || (!p.isActive && p.status !== 'failed') ? (
                        <span className="inline-flex items-center gap-1.5 text-slate-500 text-[11px] font-medium">
                          <X className="w-3.5 h-3.5" /> Inactive
                        </span>
                      ) : null}
                      {p.status === 'processing' && (
                        <span className="inline-flex items-center gap-1.5 text-amber-400 text-[11px] font-medium">
                          <Clock className="w-3.5 h-3.5 animate-spin" /> Processing
                        </span>
                      )}
                      {p.status === 'failed' && (
                        <span className="inline-flex items-center gap-1.5 text-rose-400 text-[11px] font-medium">
                          <AlertTriangle className="w-3.5 h-3.5" /> Failed
                        </span>
                      )}
                    </td>

                    {/* Active Toggle */}
                    <td className="px-4 py-4">
                      <button
                        onClick={() => handleToggleActive(p)}
                        disabled={togglingId === p.id}
                        title={p.isActive ? 'Click to deactivate (remove from AI knowledge base)' : 'Click to activate (add to AI knowledge base)'}
                        className={`flex items-center gap-1.5 transition ${
                          togglingId === p.id ? 'opacity-50 cursor-wait' : 'hover:opacity-80 cursor-pointer'
                        }`}
                      >
                        {p.isActive
                          ? <ToggleRight className="w-6 h-6 text-emerald-400" />
                          : <ToggleLeft className="w-6 h-6 text-slate-600" />
                        }
                        <span className={`text-[11px] font-semibold ${p.isActive ? 'text-emerald-400' : 'text-slate-600'}`}>
                          {p.isActive ? 'On' : 'Off'}
                        </span>
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-4 text-right space-x-1">
                      <button
                        onClick={() => setViewingPolicy(p)}
                        className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition"
                        title="View Policy Summary"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      <a
                        href={`/api/policies/download/${p.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition inline-block"
                        title="Download Document"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>

                      <button
                        onClick={() => setEditingPolicy(p)}
                        className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition"
                        title="Change Access Level"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleReprocess(p.id)}
                        disabled={reprocessingId === p.id}
                        className="p-1.5 rounded-lg bg-slate-800 text-sky-400 hover:bg-slate-700 transition disabled:opacity-50"
                        title="Re-extract & Reprocess Document"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${reprocessingId === p.id ? 'animate-spin' : ''}`} />
                      </button>

                      <button
                        onClick={() => setDeletingPolicy(p)}
                        className="p-1.5 rounded-lg bg-rose-950/60 text-rose-400 hover:bg-rose-900/60 transition"
                        title="Delete Document"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ======================== UPLOAD MODAL ======================== */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl relative">
            <button
              onClick={() => !isUploading && setIsUploadModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white disabled:cursor-not-allowed"
              disabled={isUploading}
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
              <Upload className="w-5 h-5 text-sky-400" />
              Upload Company Policy Documents
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Select PDF, DOCX, DOC, TXT, CSV or XLSX files. Multiple files and folders are supported.
            </p>

            {uploadError && (
              <div className="mb-4 p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-xs text-rose-300">
                {uploadError}
              </div>
            )}

            <form onSubmit={handleStartUpload} className="space-y-4 text-xs">
              {/* Drop Zone */}
              <div className="border-2 border-dashed border-slate-700 hover:border-sky-500/60 rounded-2xl p-6 text-center bg-slate-950/50 transition">
                <FolderPlus className="w-10 h-10 text-sky-400 mx-auto mb-2" />
                <p className="font-semibold text-slate-200 text-xs">
                  {selectedFiles.length > 0
                    ? `${selectedFiles.length} file(s) selected`
                    : 'Choose policy files or entire folder'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">PDF, DOCX, DOC, TXT, CSV, XLSX</p>

                <div className="flex justify-center gap-3 mt-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.docx,.doc,.txt,.csv,.xlsx"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <input
                    ref={folderInputRef}
                    type="file"
                    // @ts-ignore
                    webkitdirectory="true"
                    directory="true"
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 disabled:opacity-50"
                  >
                    Select Files
                  </button>

                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={() => folderInputRef.current?.click()}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 text-xs font-medium border border-sky-700/50 disabled:opacity-50"
                  >
                    Select Folder
                  </button>
                </div>
              </div>

              {/* Selected Files Preview */}
              {selectedFiles.length > 0 && (
                <div className="max-h-28 overflow-y-auto bg-slate-950 p-2.5 rounded-xl border border-slate-800 space-y-1 font-mono text-[11px] text-slate-300">
                  {selectedFiles.slice(0, 5).map((f, i) => (
                    <div key={i} className="flex justify-between items-center">
                      <span className="truncate max-w-[280px]">{f.name}</span>
                      <span className="text-slate-500">{Math.round(f.size / 1024)} KB</span>
                    </div>
                  ))}
                  {selectedFiles.length > 5 && (
                    <div className="text-slate-500 italic">+ {selectedFiles.length - 5} more files</div>
                  )}
                </div>
              )}

              {/* Metadata Inputs */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Document Category</label>
                  <select
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value)}
                    className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-100"
                  >
                    <option value="HR">HR Policies</option>
                    <option value="IT">IT &amp; Systems</option>
                    <option value="Finance">Finance &amp; Billing</option>
                    <option value="Security">Security &amp; Compliance</option>
                    <option value="Training">Training &amp; Onboarding</option>
                    <option value="Returns">Returns Policy</option>
                    <option value="Refunds">Refunds Policy</option>
                    <option value="Shipping">Shipping Policy</option>
                    <option value="Warranty">Warranty Policy</option>
                    <option value="Privacy">Privacy Policy</option>
                    <option value="Billing">Billing Policy</option>
                    <option value="Customer Service">Customer Service</option>
                    <option value="General">General Company</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1">Role Access Restriction</label>
                  <select
                    value={uploadAccessLevel}
                    onChange={(e) => setUploadAccessLevel(e.target.value as PolicyAccessLevel)}
                    className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-100"
                  >
                    <option value="PUBLIC">PUBLIC (All Users + Customers)</option>
                    <option value="EMPLOYEE">EMPLOYEE (Employee &amp; Above)</option>
                    <option value="TRAINER">TRAINER (Trainer &amp; Admin)</option>
                    <option value="ADMIN">ADMIN ONLY (Restricted)</option>
                  </select>
                </div>
              </div>

              {/* Step-by-Step Processing Pipeline Progress */}
              {currentPipelineStep && (
                <div className="p-4 bg-indigo-950/40 border border-indigo-800/50 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between text-xs text-indigo-300 font-semibold">
                    <span>AI Processing Pipeline</span>
                    <Sparkles className="w-4 h-4 text-sky-400 animate-spin" />
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-sky-500 to-indigo-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${currentPipelineStep.pct}%` }}
                    />
                  </div>

                  {/* Step Breadcrumb */}
                  <div className="flex flex-wrap items-center gap-1">
                    {PIPELINE_STEPS.map((step, idx) => {
                      const stepIndex = PIPELINE_STEPS.indexOf(currentPipelineStep);
                      const isDone = idx < stepIndex;
                      const isCurrent = idx === stepIndex;
                      return (
                        <React.Fragment key={step.key}>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium transition-all ${
                            isDone ? 'text-emerald-400' :
                            isCurrent ? 'text-sky-300 font-bold' :
                            'text-slate-600'
                          }`}>
                            {step.label}
                          </span>
                          {idx < PIPELINE_STEPS.length - 1 && (
                            <ChevronRight className={`w-3 h-3 ${isDone ? 'text-emerald-700' : 'text-slate-700'}`} />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>

                  <div className="text-[11px] text-slate-300 italic flex items-center gap-1.5">
                    {pipelineStep === PIPELINE_STEPS.length - 1
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      : <Clock className="w-3.5 h-3.5 text-sky-400 animate-spin" />
                    }
                    <span>{currentPipelineStep.label}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading || selectedFiles.length === 0}
                  className="px-4 py-2 rounded-xl bg-sky-600 text-white font-semibold hover:bg-sky-500 shadow-lg shadow-sky-600/20 text-xs disabled:opacity-50"
                >
                  {isUploading ? 'Processing...' : 'Upload & Generate RAG Knowledge'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================== VIEW MODAL ======================== */}
      {viewingPolicy && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl relative">
            <button
              onClick={() => setViewingPolicy(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-base font-bold text-white mb-1">{viewingPolicy.originalName}</h3>
            <div className="flex flex-wrap items-center gap-2 mb-4 text-xs text-slate-400">
              <span className="px-2 py-0.5 rounded bg-slate-800">{viewingPolicy.category}</span>
              <span>•</span>
              <span className="text-indigo-400">Access: {viewingPolicy.accessLevel}</span>
              <span>•</span>
              <span className="text-sky-400">v{viewingPolicy.version}</span>
              <span>•</span>
              <span>{viewingPolicy.chunkCount} Chunks</span>
              <span>•</span>
              <span className={viewingPolicy.isActive ? 'text-emerald-400' : 'text-slate-500'}>
                {viewingPolicy.isActive ? '✓ Active in AI' : '⊘ Inactive'}
              </span>
            </div>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs text-slate-300 max-h-60 overflow-y-auto font-mono whitespace-pre-wrap">
              {viewingPolicy.extractedTextSnippet || viewingPolicy.summary || 'No text snippet available.'}
            </div>
          </div>
        </div>
      )}

      {/* ======================== EDIT ACCESS LEVEL MODAL ======================== */}
      {editingPolicy && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-2xl p-6 shadow-2xl text-center space-y-4">
            <h3 className="text-base font-bold text-white">Update Access Level</h3>
            <p className="text-xs text-slate-400">
              Select who can search and access <b>{editingPolicy.originalName}</b> in the AI Knowledge Base:
            </p>
            <div className="space-y-2 text-xs">
              {(['PUBLIC', 'EMPLOYEE', 'TRAINER', 'ADMIN'] as PolicyAccessLevel[]).map((level) => (
                <button
                  key={level}
                  onClick={() => handleUpdateAccessLevel(level)}
                  className={`w-full py-2.5 px-4 rounded-xl border text-left font-semibold flex items-center justify-between ${
                    editingPolicy.accessLevel === level
                      ? 'bg-sky-600/20 border-sky-500 text-sky-300'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span>{level}</span>
                  {editingPolicy.accessLevel === level && <CheckCircle2 className="w-4 h-4 text-sky-400" />}
                </button>
              ))}
            </div>
            <button
              onClick={() => setEditingPolicy(null)}
              className="mt-2 text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ======================== DELETE CONFIRMATION MODAL ======================== */}
      {deletingPolicy && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-2xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 mx-auto flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Delete Document?</h3>
              <p className="text-xs text-slate-400 mt-1">
                Are you sure you want to delete <b>{deletingPolicy.originalName}</b>? This will also remove its indexed vector chunks from the AI Knowledge Base.
              </p>
            </div>
            <div className="flex justify-center gap-3 pt-2">
              <button
                onClick={() => setDeletingPolicy(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-500 shadow-lg shadow-rose-600/25"
              >
                Delete Policy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
