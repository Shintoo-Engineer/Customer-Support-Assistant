import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  Eye,
  FileText,
  History,
  RefreshCw,
  Search,
  Upload,
  X,
} from "lucide-react";

// ============================================================
// TYPES - MATCHING YOUR FASTAPI BACKEND
// ============================================================

type DocumentStatus = "active" | "archived" | string;

interface BackendDocument {
  document_id: number;
  document_name: string;
  document_type: string;
  version: number;
  status: DocumentStatus;
  filename: string;
  uploaded_by: string;
}

interface DocumentsResponse {
  total_documents: number;
  documents: BackendDocument[];
}

interface DocumentHistoryResponse {
  document_name: string;
  total_versions: number;
  versions: BackendDocument[];
}

// ============================================================
// API CONFIG
// ============================================================

const API_BASE =
  import.meta.env.VITE_API_URL?.trim() || "http://localhost:3009";

// ============================================================
// AUTH TOKEN
// ============================================================

function getToken(): string | null {
  const possibleKeys = [
    "access_token",
    "token",
    "authToken",
    "jwt_token",
    "jwt",
  ];

  for (const key of possibleKeys) {
    const value = localStorage.getItem(key);

    if (value) {
      return value.replace(/^Bearer\s+/i, "");
    }
  }

  return null;
}

// ============================================================
// API REQUEST HELPER
// ============================================================

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();

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

  const contentType = response.headers.get("content-type") || "";

  let data: any = null;

  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const message =
      typeof data === "object" && data?.detail
        ? data.detail
        : `Request failed with status ${response.status}`;

    throw new Error(message);
  }

  return data as T;
}

// ============================================================
// API FUNCTIONS - ONLY REAL BACKEND ENDPOINTS
// ============================================================

async function fetchDocuments(): Promise<DocumentsResponse> {
  return apiRequest<DocumentsResponse>("/documents/");
}

async function fetchDocumentHistory(
  documentName: string
): Promise<DocumentHistoryResponse> {
  return apiRequest<DocumentHistoryResponse>(
    `/documents/history/${encodeURIComponent(documentName)}`
  );
}

async function uploadDocument(
  file: File,
  documentName: string,
  documentType: string
) {
  const formData = new FormData();

  formData.append("file", file);
  formData.append("document_name", documentName);
  formData.append("document_type", documentType);

  return apiRequest<any>("/documents/upload", {
    method: "POST",
    body: formData,
  });
}

// ============================================================
// COMPONENT
// ============================================================

export const PolicyManagementView: React.FC = () => {
  const [documents, setDocuments] = useState<BackendDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Upload
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentName, setDocumentName] = useState("");
  const [documentType, setDocumentType] = useState("policy");
  const [uploading, setUploading] = useState(false);

  // View
  const [viewDocument, setViewDocument] =
    useState<BackendDocument | null>(null);

  // History
  const [historyDocument, setHistoryDocument] =
    useState<BackendDocument | null>(null);

  const [history, setHistory] = useState<BackendDocument[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ==========================================================
  // LOAD DOCUMENTS
  // ==========================================================

  const loadDocuments = async () => {
    try {
      setError(null);

      const result = await fetchDocuments();

      setDocuments(result.documents || []);
    } catch (err: any) {
      console.error("Document API error:", err);

      setError(
        err?.message ||
          "Unable to load documents. Check backend and authentication."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  // ==========================================================
  // REFRESH
  // ==========================================================

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDocuments();
  };

  // ==========================================================
  // FILTER
  // ==========================================================

  const filteredDocuments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return documents.filter((doc) => {
      const matchesSearch =
        !query ||
        doc.document_name.toLowerCase().includes(query) ||
        doc.filename.toLowerCase().includes(query) ||
        doc.uploaded_by.toLowerCase().includes(query);

      const matchesType =
        typeFilter === "all" ||
        doc.document_type.toLowerCase() === typeFilter;

      const matchesStatus =
        statusFilter === "all" ||
        doc.status.toLowerCase() === statusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [documents, searchQuery, typeFilter, statusFilter]);

  // ==========================================================
  // STATISTICS
  // ==========================================================

  const stats = useMemo(() => {
    return {
      total: documents.length,

      active: documents.filter(
        (doc) => doc.status.toLowerCase() === "active"
      ).length,

      archived: documents.filter(
        (doc) => doc.status.toLowerCase() === "archived"
      ).length,

      policies: documents.filter(
        (doc) => doc.document_type.toLowerCase() === "policy"
      ).length,

      faq: documents.filter(
        (doc) => doc.document_type.toLowerCase() === "faq"
      ).length,

      support: documents.filter(
        (doc) => doc.document_type.toLowerCase() === "support"
      ).length,
    };
  }, [documents]);

  // ==========================================================
  // SELECT FILE
  // ==========================================================

  const handleFileSelect = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (file.type !== "application/pdf") {
      setError("Only PDF files are allowed by the backend.");
      event.target.value = "";
      return;
    }

    setSelectedFile(file);

    if (!documentName) {
      setDocumentName(file.name.replace(/\.pdf$/i, ""));
    }

    setError(null);
  };

  // ==========================================================
  // UPLOAD
  // ==========================================================

  const handleUpload = async (event: React.FormEvent) => {
    event.preventDefault();

    setError(null);
    setSuccess(null);

    if (!selectedFile) {
      setError("Please select a PDF file.");
      return;
    }

    if (!documentName.trim()) {
      setError("Please enter a document name.");
      return;
    }

    if (!["policy", "faq", "support"].includes(documentType)) {
      setError("Document type must be policy, faq, or support.");
      return;
    }

    try {
      setUploading(true);

      await uploadDocument(
        selectedFile,
        documentName.trim(),
        documentType
      );

      setSuccess(
        "Document uploaded and processed successfully."
      );

      setUploadOpen(false);

      setSelectedFile(null);
      setDocumentName("");
      setDocumentType("policy");

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      await loadDocuments();
    } catch (err: any) {
      console.error("Upload error:", err);

      setError(
        err?.message ||
          "Document upload failed."
      );
    } finally {
      setUploading(false);
    }
  };

  // ==========================================================
  // HISTORY
  // ==========================================================

  const handleHistory = async (doc: BackendDocument) => {
    setHistoryDocument(doc);
    setHistory([]);
    setHistoryLoading(true);
    setError(null);

    try {
      const result = await fetchDocumentHistory(
        doc.document_name
      );

      setHistory(result.versions || []);
    } catch (err: any) {
      console.error("History error:", err);

      setError(
        err?.message ||
          "Unable to load document history."
      );
    } finally {
      setHistoryLoading(false);
    }
  };

  // ==========================================================
  // CLEAR MESSAGES
  // ==========================================================

  useEffect(() => {
    if (!success) {
      return;
    }

    const timer = setTimeout(() => {
      setSuccess(null);
    }, 4000);

    return () => clearTimeout(timer);
  }, [success]);

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <div className="min-h-full bg-slate-950 text-white p-4 md:p-6 space-y-6">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="bg-gradient-to-r from-slate-900 to-indigo-950/40 border border-slate-800 rounded-2xl p-6">

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

          <div>
            <div className="flex items-center gap-3">

              <div className="w-11 h-11 rounded-xl bg-indigo-600 flex items-center justify-center">
                <Database className="w-5 h-5" />
              </div>

              <div>
                <h1 className="text-xl font-bold">
                  Policy Knowledge Base
                </h1>

                <p className="text-xs text-slate-400 mt-1">
                  Manage company PDF documents used by the RAG system.
                </p>
              </div>

            </div>
          </div>

          <div className="flex gap-2">

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold hover:bg-slate-700 disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 inline mr-2 ${
                  refreshing ? "animate-spin" : ""
                }`}
              />

              Refresh
            </button>

            <button
              onClick={() => {
                setUploadOpen(true);
                setError(null);
              }}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
            >
              <Upload className="w-4 h-4 inline mr-2" />
              Upload PDF
            </button>

          </div>

        </div>
      </div>

      {/* ======================================================
          SUCCESS
      ====================================================== */}

      {success && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-950/50 border border-emerald-800 text-emerald-300 text-sm">
          <CheckCircle2 className="w-5 h-5" />
          {success}
        </div>
      )}

      {/* ======================================================
          ERROR
      ====================================================== */}

      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-rose-950/50 border border-rose-800 text-rose-300 text-sm">

          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />

          <div className="flex-1">
            {error}

            <div className="text-xs text-rose-400/70 mt-2">
              Backend: {API_BASE}
            </div>
          </div>

          <button
            onClick={() => setError(null)}
            className="text-rose-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>

        </div>
      )}

      {/* ======================================================
          STATISTICS
      ====================================================== */}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

        <StatCard
          title="Total Documents"
          value={stats.total}
          icon={<FileText className="w-5 h-5" />}
        />

        <StatCard
          title="Active"
          value={stats.active}
          icon={<CheckCircle2 className="w-5 h-5" />}
        />

        <StatCard
          title="Archived"
          value={stats.archived}
          icon={<History className="w-5 h-5" />}
        />

        <StatCard
          title="Policies"
          value={stats.policies}
          icon={<Database className="w-5 h-5" />}
        />

      </div>

      {/* ======================================================
          FILTERS
      ====================================================== */}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">

        <div className="flex flex-col md:flex-row gap-3">

          <div className="relative flex-1">

            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-500" />

            <input
              value={searchQuery}
              onChange={(e) =>
                setSearchQuery(e.target.value)
              }
              placeholder="Search documents..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500"
            />

          </div>

          <select
            value={typeFilter}
            onChange={(e) =>
              setTypeFilter(e.target.value)
            }
            className="bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-200 outline-none"
          >
            <option value="all">All Types</option>
            <option value="policy">Policy</option>
            <option value="faq">FAQ</option>
            <option value="support">Support</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value)
            }
            className="bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-200 outline-none"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>

        </div>
      </div>

      {/* ======================================================
          DOCUMENT TABLE
      ====================================================== */}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">

        <div className="px-5 py-4 border-b border-slate-800 flex justify-between items-center">

          <div>
            <h2 className="font-semibold text-white">
              Documents
            </h2>

            <p className="text-xs text-slate-500 mt-1">
              {filteredDocuments.length} document(s)
            </p>
          </div>

          <div className="text-xs text-slate-500">
            RAG Knowledge Base
          </div>

        </div>

        <div className="overflow-x-auto">

          <table className="w-full min-w-[850px]">

            <thead className="bg-slate-950">

              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">

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
                  Actions
                </th>

              </tr>

            </thead>

            <tbody className="divide-y divide-slate-800">

              {loading ? (

                <tr>
                  <td
                    colSpan={6}
                    className="text-center py-14 text-slate-400"
                  >
                    <RefreshCw className="w-5 h-5 animate-spin inline mr-2" />
                    Loading documents...
                  </td>
                </tr>

              ) : filteredDocuments.length === 0 ? (

                <tr>
                  <td
                    colSpan={6}
                    className="text-center py-14"
                  >

                    <FileText className="w-10 h-10 text-slate-700 mx-auto mb-3" />

                    <div className="text-slate-300 font-medium">
                      No documents found
                    </div>

                    <div className="text-xs text-slate-500 mt-1">
                      Upload a PDF to add knowledge to the RAG system.
                    </div>

                  </td>
                </tr>

              ) : (

                filteredDocuments.map((doc) => (

                  <tr
                    key={doc.document_id}
                    className="hover:bg-slate-800/40 transition"
                  >

                    {/* Document */}

                    <td className="px-5 py-4">

                      <div className="flex items-center gap-3">

                        <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-indigo-400" />
                        </div>

                        <div>

                          <div className="font-semibold text-slate-100">
                            {doc.document_name}
                          </div>

                          <div className="text-[11px] text-slate-500 mt-1">
                            {doc.filename}
                          </div>

                        </div>

                      </div>

                    </td>

                    {/* Type */}

                    <td className="px-4 py-4">

                      <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[11px] font-semibold uppercase">
                        {doc.document_type}
                      </span>

                    </td>

                    {/* Version */}

                    <td className="px-4 py-4">

                      <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold">
                        v{doc.version}
                      </span>

                    </td>

                    {/* Status */}

                    <td className="px-4 py-4">

                      {doc.status === "active" ? (

                        <span className="inline-flex items-center gap-1.5 text-emerald-400 text-xs font-medium">
                          <CheckCircle2 className="w-4 h-4" />
                          Active
                        </span>

                      ) : (

                        <span className="inline-flex items-center gap-1.5 text-slate-500 text-xs font-medium">
                          <Clock className="w-4 h-4" />
                          {doc.status}
                        </span>

                      )}

                    </td>

                    {/* Uploaded by */}

                    <td className="px-4 py-4">

                      <span className="text-xs text-slate-400">
                        {doc.uploaded_by}
                      </span>

                    </td>

                    {/* Actions */}

                    <td className="px-4 py-4">

                      <div className="flex justify-end gap-2">

                        <button
                          onClick={() =>
                            setViewDocument(doc)
                          }
                          title="View"
                          className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() =>
                            handleHistory(doc)
                          }
                          title="Version History"
                          className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-sky-400 hover:bg-slate-700"
                        >
                          <History className="w-4 h-4" />
                        </button>

                      </div>

                    </td>

                  </tr>

                ))

              )}

            </tbody>

          </table>

        </div>

      </div>

      {/* ======================================================
          UPLOAD MODAL
      ====================================================== */}

      {uploadOpen && (

        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">

          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl">

            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800">

              <div>

                <h3 className="font-bold text-white">
                  Upload Document
                </h3>

                <p className="text-xs text-slate-500 mt-1">
                  Add a PDF to the RAG knowledge base
                </p>

              </div>

              <button
                onClick={() =>
                  !uploading && setUploadOpen(false)
                }
                disabled={uploading}
                className="text-slate-500 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>

            </div>

            <form
              onSubmit={handleUpload}
              className="p-6 space-y-5"
            >

              {/* File */}

              <div>

                <label className="block text-xs font-medium text-slate-300 mb-2">
                  PDF File
                </label>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleFileSelect}
                  disabled={uploading}
                  className="block w-full text-xs text-slate-400 file:mr-3 file:px-4 file:py-2 file:rounded-lg file:border-0 file:bg-indigo-600 file:text-white file:text-xs hover:file:bg-indigo-500"
                />

                {selectedFile && (
                  <div className="mt-2 text-xs text-emerald-400">
                    Selected: {selectedFile.name}
                  </div>
                )}

              </div>

              {/* Document name */}

              <div>

                <label className="block text-xs font-medium text-slate-300 mb-2">
                  Document Name
                </label>

                <input
                  value={documentName}
                  onChange={(e) =>
                    setDocumentName(e.target.value)
                  }
                  placeholder="Example: Employee Leave Policy"
                  disabled={uploading}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500"
                />

              </div>

              {/* Document type */}

              <div>

                <label className="block text-xs font-medium text-slate-300 mb-2">
                  Document Type
                </label>

                <select
                  value={documentType}
                  onChange={(e) =>
                    setDocumentType(e.target.value)
                  }
                  disabled={uploading}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white outline-none"
                >

                  <option value="policy">
                    Policy
                  </option>

                  <option value="faq">
                    FAQ
                  </option>

                  <option value="support">
                    Support
                  </option>

                </select>

              </div>

              {/* Backend limitations */}

              <div className="p-3 rounded-xl bg-sky-950/30 border border-sky-800/40 text-xs text-sky-300">

                <div className="font-semibold mb-1">
                  Backend upload rules
                </div>

                <ul className="list-disc ml-4 space-y-1 text-sky-400/80">
                  <li>Only PDF files are accepted.</li>
                  <li>Document type: policy, faq, or support.</li>
                  <li>Admin authentication is required.</li>
                  <li>Uploading the same name creates a new version.</li>
                </ul>

              </div>

              {/* Buttons */}

              <div className="flex justify-end gap-3 pt-2">

                <button
                  type="button"
                  onClick={() =>
                    setUploadOpen(false)
                  }
                  disabled={uploading}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={uploading}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold disabled:opacity-50"
                >

                  {uploading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin inline mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 inline mr-2" />
                      Upload & Process
                    </>
                  )}

                </button>

              </div>

            </form>

          </div>

        </div>

      )}

      {/* ======================================================
          VIEW MODAL
      ====================================================== */}

      {viewDocument && (

        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">

          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl">

            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800">

              <h3 className="font-bold text-white">
                Document Details
              </h3>

              <button
                onClick={() =>
                  setViewDocument(null)
                }
                className="text-slate-500 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>

            </div>

            <div className="p-6 space-y-4">

              <Detail
                label="Document ID"
                value={String(viewDocument.document_id)}
              />

              <Detail
                label="Document Name"
                value={viewDocument.document_name}
              />

              <Detail
                label="Filename"
                value={viewDocument.filename}
              />

              <Detail
                label="Type"
                value={viewDocument.document_type}
              />

              <Detail
                label="Version"
                value={`v${viewDocument.version}`}
              />

              <Detail
                label="Status"
                value={viewDocument.status}
              />

              <Detail
                label="Uploaded By"
                value={viewDocument.uploaded_by}
              />

            </div>

          </div>

        </div>

      )}

      {/* ======================================================
          HISTORY MODAL
      ====================================================== */}

      {historyDocument && (

        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">

          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl">

            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800">

              <div>

                <h3 className="font-bold text-white">
                  Version History
                </h3>

                <p className="text-xs text-slate-500 mt-1">
                  {historyDocument.document_name}
                </p>

              </div>

              <button
                onClick={() =>
                  setHistoryDocument(null)
                }
                className="text-slate-500 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>

            </div>

            <div className="p-6">

              {historyLoading ? (

                <div className="text-center py-10 text-slate-400">

                  <RefreshCw className="w-5 h-5 animate-spin inline mr-2" />

                  Loading version history...

                </div>

              ) : history.length === 0 ? (

                <div className="text-center py-10 text-slate-500">
                  No version history found.
                </div>

              ) : (

                <div className="space-y-3">

                  {history.map((version) => (

                    <div
                      key={version.document_id}
                      className="flex items-center justify-between p-4 rounded-xl bg-slate-950 border border-slate-800"
                    >

                      <div>

                        <div className="font-semibold text-white">
                          Version {version.version}
                        </div>

                        <div className="text-xs text-slate-500 mt-1">
                          {version.filename}
                        </div>

                        <div className="text-xs text-slate-600 mt-1">
                          Uploaded by {version.uploaded_by}
                        </div>

                      </div>

                      <span
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                          version.status === "active"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-slate-800 text-slate-500 border border-slate-700"
                        }`}
                      >
                        {version.status}
                      </span>

                    </div>

                  ))}

                </div>

              )}

            </div>

          </div>

        </div>

      )}

    </div>
  );
};

// ============================================================
// SMALL COMPONENTS
// ============================================================

function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">

      <div className="flex items-center justify-between">

        <div>

          <div className="text-2xl font-bold text-white">
            {value}
          </div>

          <div className="text-xs text-slate-500 mt-1">
            {title}
          </div>

        </div>

        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
          {icon}
        </div>

      </div>

    </div>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-slate-950 border border-slate-800">

      <span className="text-xs text-slate-500">
        {label}
      </span>

      <span className="text-xs text-slate-200 text-right break-all">
        {value}
      </span>

    </div>
  );
}

export default PolicyManagementView;