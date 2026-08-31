import React, { useState } from 'react';
import {
  BookOpen,
  Search,
  Plus,
  ShieldCheck,
  AlertTriangle,
  FileText,
  Sparkles,
  Layers,
  Clock,
  CheckCircle2,
  ExternalLink,
  X,
  UploadCloud,
  Database
} from 'lucide-react';
import { KnowledgeDocument, UserRole } from '../types';

interface KnowledgeBaseViewProps {
  documents: KnowledgeDocument[];
  onAddDocument: (doc: KnowledgeDocument) => void;
  userRole: UserRole;
}

export const KnowledgeBaseView: React.FC<KnowledgeBaseViewProps> = ({
  documents,
  onAddDocument,
  userRole
}) => {
  const [selectedDoc, setSelectedDoc] = useState<KnowledgeDocument>(documents[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);

  // New Doc Form State
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Policies');
  const [newSummary, setNewSummary] = useState('');
  const [newContent, setNewContent] = useState('');

  const categories = ['All', 'Policies', 'Billing', 'Shipping', 'Security', 'Technical'];

  const filteredDocs = documents.filter((doc) => {
    const matchCat = selectedCategory === 'All' || doc.category === selectedCategory;
    const matchSearch =
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.summary.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  const handleCreateDoc = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    const newDoc: KnowledgeDocument = {
      id: `KB-${Math.floor(100 + Math.random() * 900)}`,
      title: newTitle,
      category: newCategory,
      updatedAt: new Date().toISOString().split('T')[0],
      chunkCount: Math.ceil(newContent.length / 300),
      embeddingCount: Math.ceil(newContent.length / 100),
      status: 'indexed',
      citationsCount: 0,
      summary: newSummary || newContent.slice(0, 120),
      content: newContent
    };

    onAddDocument(newDoc);
    setSelectedDoc(newDoc);
    setShowAddModal(false);
    setNewTitle('');
    setNewSummary('');
    setNewContent('');
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 animate-fadeIn">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">RAG Knowledge Base & Verification</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              Zero Hallucination Guard
            </span>
          </div>
          <p className="text-xs text-slate-400">Indexed standard operating procedures, policies, and troubleshooting scripts retrieved by the AI Coach.</p>
        </div>

        <button
          id="btn-open-add-kb"
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2 shadow-md transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add Knowledge Document</span>
        </button>
      </div>

      {/* Health & Quality Monitor Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-2.5 sm:gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-950/80 border border-emerald-800/60 flex items-center justify-center text-emerald-400 shrink-0">
            <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <span className="text-[10px] sm:text-[11px] text-slate-400 block">Knowledge Quality</span>
            <span className="text-sm sm:text-base font-bold text-white">98.4% Accuracy</span>
          </div>
        </div>

        <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-2.5 sm:gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-950/80 border border-indigo-800/60 flex items-center justify-center text-indigo-400 shrink-0">
            <Database className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <span className="text-[10px] sm:text-[11px] text-slate-400 block">Vector Index</span>
            <span className="text-sm sm:text-base font-bold text-white">{documents.reduce((acc, d) => acc + d.chunkCount, 0)} Chunks</span>
          </div>
        </div>

        <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-2.5 sm:gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-950/80 border border-amber-800/60 flex items-center justify-center text-amber-400 shrink-0">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <span className="text-[10px] sm:text-[11px] text-slate-400 block">Live Citations</span>
            <span className="text-sm sm:text-base font-bold text-white">{documents.reduce((acc, d) => acc + d.citationsCount, 0)} Citations</span>
          </div>
        </div>

        <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-2.5 sm:gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-sky-950/80 border border-sky-800/60 flex items-center justify-center text-sky-400 shrink-0">
            <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <span className="text-[10px] sm:text-[11px] text-slate-400 block">Conflict Status</span>
            <span className="text-sm sm:text-base font-bold text-emerald-400">0 Conflicts</span>
          </div>
        </div>
      </div>

      {/* Main 2-Column Split: Document Browser + Document Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Documents List (4 Cols) */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-3xl p-4 space-y-4">
          
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              id="kb-search-input"
              type="text"
              placeholder="Search knowledge..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px]">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setSelectedCategory(c)}
                className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition ${
                  selectedCategory === c
                    ? 'bg-indigo-600 text-white font-semibold'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Doc Cards */}
          <div className="space-y-2 overflow-y-auto max-h-[580px] pr-1">
            {filteredDocs.map((doc) => {
              const isSelected = selectedDoc?.id === doc.id;
              return (
                <button
                  key={doc.id}
                  id={`kb-item-${doc.id}`}
                  onClick={() => {
                    setSelectedDoc(doc);
                    // On mobile, scroll to document reader smoothly
                    const readerElem = document.getElementById('kb-document-reader');
                    if (readerElem && window.innerWidth < 1024) {
                      readerElem.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                  className={`w-full text-left p-3 rounded-2xl border transition ${
                    isSelected
                      ? 'bg-indigo-950/60 border-indigo-600 text-white shadow-md'
                      : 'bg-slate-800/60 border-slate-700/70 text-slate-300 hover:bg-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono text-indigo-400 font-bold">{doc.id}</span>
                    <span className="text-[10px] text-slate-400">{doc.category}</span>
                  </div>
                  <h4 className="font-bold text-xs text-white line-clamp-1">{doc.title}</h4>
                  <p className="text-[11px] text-slate-400 line-clamp-2 mt-1 leading-snug">{doc.summary}</p>
                </button>
              );
            })}
          </div>

        </div>

        {/* Right Column: Active Document Reader & Citations (8 Cols) */}
        <div id="kb-document-reader" className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 space-y-5 sm:space-y-6">
          {selectedDoc ? (
            <>
              {/* Doc Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4 pb-4 border-b border-slate-800">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-950 text-indigo-300 border border-indigo-800">
                      {selectedDoc.id}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                      {selectedDoc.category}
                    </span>
                    <span className="text-[11px] text-slate-400">Updated: {selectedDoc.updatedAt}</span>
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold text-white">{selectedDoc.title}</h2>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span>Citations: <b className="text-indigo-300">{selectedDoc.citationsCount}</b></span>
                  <span>Chunks: <b className="text-sky-300">{selectedDoc.chunkCount}</b></span>
                </div>
              </div>

              {/* Summary */}
              <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700 text-xs text-slate-200">
                <span className="font-bold text-indigo-300 uppercase tracking-wider text-[10px] block mb-1">
                  Executive Policy Summary
                </span>
                <p className="leading-relaxed">{selectedDoc.summary}</p>
              </div>

              {/* Full Content Viewer */}
              <div className="space-y-2">
                <span className="font-bold text-xs uppercase tracking-wider text-slate-400 block">
                  Official Standard Operating Procedure Content
                </span>
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs font-mono text-slate-200 whitespace-pre-wrap leading-relaxed max-h-[420px] overflow-y-auto">
                  {selectedDoc.content}
                </div>
              </div>
            </>
          ) : (
            <div className="h-96 flex items-center justify-center text-slate-500 text-xs">
              Select a knowledge document from the left to read.
            </div>
          )}
        </div>

      </div>

      {/* Add New Document Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleCreateDoc} className="bg-slate-900 border border-slate-700 rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-2xl relative animate-scaleUp">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="absolute right-4 top-4 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-indigo-400" />
              Add SOP Document to Knowledge Base
            </h2>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-200">Document Title:</label>
              <input
                type="text"
                required
                placeholder="E.g. VIP Priority Escalation & Refund Authority Guidelines"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-200">Category:</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="Policies">Policies</option>
                <option value="Billing">Billing</option>
                <option value="Shipping">Shipping</option>
                <option value="Security">Security</option>
                <option value="Technical">Technical</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-200">Short Summary:</label>
              <input
                type="text"
                placeholder="Brief 1-sentence overview..."
                value={newSummary}
                onChange={(e) => setNewSummary(e.target.value)}
                className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-200">Full Policy Content (SOP text):</label>
              <textarea
                rows={5}
                required
                placeholder="Paste the full standard operating procedure, steps, and rules here..."
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono resize-none"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md transition"
              >
                Save & Index Document
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};
