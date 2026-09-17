import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  UserCheck,
  Bot,
  BookOpen,
  PlayCircle,
  FileText,
  Search,
  RefreshCw,
  CheckCircle2,
  Clock,
  X,
  AlertTriangle,
  Database,
  ShieldCheck,
} from "lucide-react";

import { AiAssistantView } from "./AiAssistantView";

// ============================================================
// BACKEND CONFIG
// ============================================================

const API_BASE =
  (import.meta.env.VITE_API_URL || "http://localhost:3009").replace(
    /\/+$/,
    ""
  );

// ============================================================
// TYPES - MATCH YOUR FASTAPI BACKEND
// ============================================================

interface BackendDocument {
  document_id: number;
  document_name: string;
  document_type: string;
  version: number;
  status: string;
  filename: string;
  uploaded_by: string;
}

interface DocumentsResponse {
  total_documents: number;
  documents: BackendDocument[];
}

interface EmployeeDashboardViewProps {
  user: {
    id?: number;
    user_id?: number;
    name?: string;
    email?: string;
    role?: string;
  };

  onOpenLiveConsole?: () => void;
}

// ============================================================
// AUTH TOKEN
// ============================================================

function getAuthToken(): string | null {
  const keys = [
    "access_token",
    "token",
    "authToken",
    "jwt_token",
    "jwt",
  ];

  for (const key of keys) {
    const value = localStorage.getItem(key);

    if (value) {
      return value.replace(/^Bearer\s+/i, "");
    }
  }

  return null;
}

// ============================================================
// API REQUEST
// ============================================================

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();

  const headers = new Headers(options.headers);

  headers.set("Accept", "application/json");

  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const contentType =
    response.headers.get("content-type") || "";

  let data: any;

  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    let message = `Backend request failed (${response.status})`;

    if (data && typeof data === "object" && data.detail) {
      message = data.detail;
    } else if (typeof data === "string" && data.trim()) {
      message = data;
    }

    throw new Error(message);
  }

  return data as T;
}

// ============================================================
// GET DOCUMENTS
// ============================================================

async function fetchEmployeeDocuments(): Promise<DocumentsResponse> {
  return apiRequest<DocumentsResponse>("/documents/");
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export const EmployeeDashboardView: React.FC<
  EmployeeDashboardViewProps
> = ({ user, onOpenLiveConsole }) => {
  // ----------------------------------------------------------
  // Tabs
  // ----------------------------------------------------------

  const [activeTab, setActiveTab] = useState<
    "overview" | "policies" | "assistant"
  >("overview");

  // ----------------------------------------------------------
  // User
  // ----------------------------------------------------------

  const displayName =
    user?.name?.trim() || "Employee";

  const userRole =
    user?.role || "employee";

  // ----------------------------------------------------------
  // Documents
  // ----------------------------------------------------------

  const [documents, setDocuments] = useState<
    BackendDocument[]
  >([]);

  const [loadingDocuments, setLoadingDocuments] =
    useState(false);

  const [documentError, setDocumentError] =
    useState<string | null>(null);

  const [searchQuery, setSearchQuery] =
    useState("");

  const [selectedDocument, setSelectedDocument] =
    useState<BackendDocument | null>(null);

  // ==========================================================
  // LOAD DOCUMENTS
  // ==========================================================

  const loadDocuments = useCallback(async () => {
    setLoadingDocuments(true);
    setDocumentError(null);

    try {
      const result =
        await fetchEmployeeDocuments();

      console.log(
        "Employee /documents/ response:",
        result
      );

      setDocuments(
        Array.isArray(result?.documents)
          ? result.documents
          : []
      );
    } catch (error: any) {
      console.error(
        "Employee document loading failed:",
        error
      );

      setDocuments([]);

      setDocumentError(
        error?.message ||
          "Unable to load company documents."
      );
    } finally {
      setLoadingDocuments(false);
    }
  }, []);

  // ==========================================================
  // INITIAL LOAD
  // ==========================================================

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // ==========================================================
  // FILTER
  // ==========================================================

  const filteredDocuments = useMemo(() => {
    const query =
      searchQuery.trim().toLowerCase();

    if (!query) {
      return documents;
    }

    return documents.filter((document) => {
      return (
        document.document_name
          .toLowerCase()
          .includes(query) ||

        document.document_type
          .toLowerCase()
          .includes(query) ||

        document.filename
          .toLowerCase()
          .includes(query)
      );
    });
  }, [documents, searchQuery]);

  // ==========================================================
  // STATISTICS
  // ==========================================================

  const totalDocuments =
    documents.length;

  const activeDocuments =
    documents.filter(
      (document) =>
        document.status === "active"
    ).length;

  const policyDocuments =
    documents.filter(
      (document) =>
        document.document_type === "policy"
    ).length;

  const faqDocuments =
    documents.filter(
      (document) =>
        document.document_type === "faq"
    ).length;

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="space-y-6">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/80 border border-slate-800 p-6 rounded-2xl">

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">

          <div>

            <div className="flex items-center gap-2">

              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">

                <UserCheck className="w-3.5 h-3.5" />

                EMPLOYEE SUPPORT DASHBOARD

              </span>

            </div>

            <h1 className="text-2xl font-bold text-white mt-2">

              Welcome back, {displayName}

            </h1>

            <p className="text-xs text-slate-400 mt-1 max-w-2xl">

              Access company documents, use the AI Policy
              Assistant, and practice customer support
              scenarios.

            </p>

          </div>

          {/* =================================================
              TABS
          ================================================= */}

          <div className="flex flex-wrap items-center gap-1 bg-slate-950/80 p-1.5 rounded-xl border border-slate-800">

            <button
              onClick={() =>
                setActiveTab("overview")
              }
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
                activeTab === "overview"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Dashboard
            </button>

            <button
              onClick={() => {
                setActiveTab("policies");
                loadDocuments();
              }}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
                activeTab === "policies"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Company Policies
            </button>

            <button
              onClick={() =>
                setActiveTab("assistant")
              }
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
                activeTab === "assistant"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              AI Assistant
            </button>

          </div>

        </div>

      </div>

      {/* =====================================================
          ERROR
      ===================================================== */}

      {documentError && (

        <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-800 flex items-start gap-3">

          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />

          <div className="flex-1">

            <div className="text-sm font-semibold text-rose-300">
              Unable to load company documents
            </div>

            <div className="text-xs text-rose-400/80 mt-1">
              {documentError}
            </div>

            <div className="text-[10px] text-slate-500 mt-2">
              Backend: {API_BASE}
            </div>

          </div>

          <button
            onClick={loadDocuments}
            className="px-3 py-1.5 rounded-lg bg-rose-900/50 hover:bg-rose-900 text-rose-200 text-xs font-semibold"
          >
            Retry
          </button>

        </div>

      )}

      {/* =====================================================
          OVERVIEW
      ===================================================== */}

      {activeTab === "overview" && (

        <div className="space-y-6">

          {/* =================================================
              KPI CARDS
          ================================================= */}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

            {/* Documents */}

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">

              <div className="flex items-center justify-between">

                <div>

                  <div className="text-xs text-slate-500">
                    Company Documents
                  </div>

                  <div className="text-2xl font-bold text-white mt-1">
                    {totalDocuments}
                  </div>

                </div>

                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-indigo-400" />
                </div>

              </div>

            </div>

            {/* Active */}

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">

              <div className="flex items-center justify-between">

                <div>

                  <div className="text-xs text-slate-500">
                    Active Documents
                  </div>

                  <div className="text-2xl font-bold text-emerald-400 mt-1">
                    {activeDocuments}
                  </div>

                </div>

                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                </div>

              </div>

            </div>

            {/* Policies */}

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">

              <div className="flex items-center justify-between">

                <div>

                  <div className="text-xs text-slate-500">
                    Policies
                  </div>

                  <div className="text-2xl font-bold text-sky-400 mt-1">
                    {policyDocuments}
                  </div>

                </div>

                <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-sky-400" />
                </div>

              </div>

            </div>

            {/* FAQ */}

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">

              <div className="flex items-center justify-between">

                <div>

                  <div className="text-xs text-slate-500">
                    FAQs
                  </div>

                  <div className="text-2xl font-bold text-violet-400 mt-1">
                    {faqDocuments}
                  </div>

                </div>

                <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
                  <Database className="w-5 h-5 text-violet-400" />
                </div>

              </div>

            </div>

          </div>

          {/* =================================================
              ACTION CARDS
          ================================================= */}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

            {/* AI Assistant */}

            <button
              onClick={() =>
                setActiveTab("assistant")
              }
              className="text-left bg-slate-900 border border-slate-800 hover:border-indigo-500/60 p-6 rounded-2xl transition group"
            >

              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-4 group-hover:scale-105 transition">

                <Bot className="w-6 h-6" />

              </div>

              <h3 className="font-bold text-white">
                AI Policy Assistant
              </h3>

              <p className="text-xs text-slate-400 mt-2">
                Ask questions about company policies
                and retrieve answers from the RAG knowledge base.
              </p>

            </button>

            {/* Policies */}

            <button
              onClick={() =>
                setActiveTab("policies")
              }
              className="text-left bg-slate-900 border border-slate-800 hover:border-sky-500/60 p-6 rounded-2xl transition group"
            >

              <div className="w-12 h-12 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-400 mb-4 group-hover:scale-105 transition">

                <BookOpen className="w-6 h-6" />

              </div>

              <h3 className="font-bold text-white">
                Company Policies
              </h3>

              <p className="text-xs text-slate-400 mt-2">
                Browse the company documents currently
                available to your authenticated account.
              </p>

            </button>

            {/* Simulator */}

            <button
              onClick={onOpenLiveConsole}
              className="text-left bg-slate-900 border border-slate-800 hover:border-emerald-500/60 p-6 rounded-2xl transition group"
            >

              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-4 group-hover:scale-105 transition">

                <PlayCircle className="w-6 h-6" />

              </div>

              <h3 className="font-bold text-white">
                Customer Support Simulator
              </h3>

              <p className="text-xs text-slate-400 mt-2">
                Practice customer interactions and
                improve support responses.
              </p>

            </button>

          </div>

        </div>

      )}

      {/* =====================================================
          POLICIES TAB
      ===================================================== */}

      {activeTab === "policies" && (

        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">

          {/* Header */}

          <div className="p-5 border-b border-slate-800">

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

              <div>

                <h2 className="text-lg font-bold text-white flex items-center gap-2">

                  <BookOpen className="w-5 h-5 text-sky-400" />

                  Company Policies

                </h2>

                <p className="text-xs text-slate-500 mt-1">
                  Documents available through the FastAPI backend.
                </p>

              </div>

              <div className="flex gap-2">

                {/* Search */}

                <div className="relative">

                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />

                  <input
                    value={searchQuery}
                    onChange={(e) =>
                      setSearchQuery(e.target.value)
                    }
                    placeholder="Search..."
                    className="w-56 bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-indigo-500"
                  />

                </div>

                {/* Refresh */}

                <button
                  onClick={loadDocuments}
                  disabled={loadingDocuments}
                  className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white disabled:opacity-50"
                  title="Refresh"
                >

                  <RefreshCw
                    className={`w-4 h-4 ${
                      loadingDocuments
                        ? "animate-spin"
                        : ""
                    }`}
                  />

                </button>

              </div>

            </div>

          </div>

          {/* Table */}

          <div className="overflow-x-auto">

            <table className="w-full text-left">

              <thead className="bg-slate-950">

                <tr className="text-[11px] uppercase tracking-wider text-slate-500">

                  <th className="px-5 py-4">
                    Document
                  </th>

                  <th className="px-4 py-4">
                    Type
                  </th>

                  <th className="px-4 py-4">
                    Version
                  </th>

                  <th className="px-4 py-4">
                    Status
                  </th>

                  <th className="px-4 py-4">
                    Uploaded By
                  </th>

                  <th className="px-4 py-4 text-right">
                    Action
                  </th>

                </tr>

              </thead>

              <tbody className="divide-y divide-slate-800">

                {/* Loading */}

                {loadingDocuments && (

                  <tr>

                    <td
                      colSpan={6}
                      className="py-12 text-center text-slate-400 text-xs"
                    >

                      <RefreshCw className="w-5 h-5 animate-spin inline mr-2 text-indigo-400" />

                      Loading company documents...

                    </td>

                  </tr>

                )}

                {/* Empty */}

                {!loadingDocuments &&
                  filteredDocuments.length === 0 && (

                  <tr>

                    <td
                      colSpan={6}
                      className="py-12 text-center"
                    >

                      <FileText className="w-9 h-9 text-slate-700 mx-auto mb-3" />

                      <div className="text-sm text-slate-400">
                        No documents found.
                      </div>

                      <div className="text-[11px] text-slate-600 mt-1">
                        Ask an administrator to upload company documents.
                      </div>

                    </td>

                  </tr>

                )}

                {/* Documents */}

                {!loadingDocuments &&
                  filteredDocuments.length > 0 &&
                  filteredDocuments.map((document) => (

                    <tr
                      key={document.document_id}
                      className="hover:bg-slate-800/40 transition"
                    >

                      {/* Name */}

                      <td className="px-5 py-4">

                        <div className="flex items-center gap-3">

                          <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center">

                            <FileText className="w-4 h-4 text-sky-400" />

                          </div>

                          <div>

                            <div className="font-semibold text-white text-xs">
                              {document.document_name}
                            </div>

                            <div className="text-[10px] text-slate-600 mt-1">
                              {document.filename}
                            </div>

                          </div>

                        </div>

                      </td>

                      {/* Type */}

                      <td className="px-4 py-4">

                        <span className="px-2 py-1 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] font-semibold uppercase">

                          {document.document_type}

                        </span>

                      </td>

                      {/* Version */}

                      <td className="px-4 py-4">

                        <span className="text-xs text-slate-300">
                          v{document.version}
                        </span>

                      </td>

                      {/* Status */}

                      <td className="px-4 py-4">

                        {document.status === "active" ? (

                          <span className="inline-flex items-center gap-1 text-emerald-400 text-[11px]">

                            <CheckCircle2 className="w-3.5 h-3.5" />

                            Active

                          </span>

                        ) : (

                          <span className="inline-flex items-center gap-1 text-slate-500 text-[11px]">

                            <Clock className="w-3.5 h-3.5" />

                            {document.status}

                          </span>

                        )}

                      </td>

                      {/* Uploaded By */}

                      <td className="px-4 py-4">

                        <span className="text-xs text-slate-400">
                          {document.uploaded_by}
                        </span>

                      </td>

                      {/* Action */}

                      <td className="px-4 py-4 text-right">

                        <button
                          onClick={() =>
                            setSelectedDocument(document)
                          }
                          className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
                        >
                          View
                        </button>

                      </td>

                    </tr>

                  ))}

              </tbody>

            </table>

          </div>

        </div>

      )}

      {/* =====================================================
          AI ASSISTANT
      ===================================================== */}

      {activeTab === "assistant" && (

        <AiAssistantView
          userRole={userRole}
          userName={displayName}
        />

      )}

      {/* =====================================================
          DOCUMENT DETAILS MODAL
      ===================================================== */}

      {selectedDocument && (

        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">

          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl">

            <div className="p-5 border-b border-slate-800 flex items-center justify-between">

              <div>

                <h3 className="font-bold text-white">
                  Document Details
                </h3>

                <p className="text-xs text-slate-500 mt-1">
                  Company knowledge base document
                </p>

              </div>

              <button
                onClick={() =>
                  setSelectedDocument(null)
                }
                className="text-slate-500 hover:text-white"
              >

                <X className="w-5 h-5" />

              </button>

            </div>

            <div className="p-5 space-y-3">

              <DetailRow
                label="Document ID"
                value={String(
                  selectedDocument.document_id
                )}
              />

              <DetailRow
                label="Document Name"
                value={
                  selectedDocument.document_name
                }
              />

              <DetailRow
                label="Filename"
                value={
                  selectedDocument.filename
                }
              />

              <DetailRow
                label="Document Type"
                value={
                  selectedDocument.document_type
                }
              />

              <DetailRow
                label="Version"
                value={`v${selectedDocument.version}`}
              />

              <DetailRow
                label="Status"
                value={
                  selectedDocument.status
                }
              />

              <DetailRow
                label="Uploaded By"
                value={
                  selectedDocument.uploaded_by
                }
              />

            </div>

          </div>

        </div>

      )}

    </div>
  );
};

// ============================================================
// DETAIL ROW
// ============================================================

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 bg-slate-950 border border-slate-800 rounded-xl p-3">

      <span className="text-xs text-slate-500">
        {label}
      </span>

      <span className="text-xs text-slate-200 text-right break-all">
        {value}
      </span>

    </div>
  );
}

export default EmployeeDashboardView;