import React, { useState } from 'react';
import { knowledgeApi } from '../api/knowledgeApi';
import { searchApi } from '../api/searchApi';
import type { KnowledgeRecommendation, SearchChunk, RAGResponse } from '../types';
import { RecommendationCard } from './RecommendationCard';
import {
  Search,
  BookOpen,
  Sparkles,
  AlertCircle,
  CheckCircle,
  Loader2,
  Database,
} from 'lucide-react';

export const KnowledgeExplorer: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'recommend' | 'search' | 'rag'>('recommend');
  const [query, setQuery] = useState<string>('How do I request a refund under the current policy?');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Results
  const [recommendations, setRecommendations] = useState<KnowledgeRecommendation[]>([]);
  const [noRelevantInfo, setNoRelevantInfo] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<SearchChunk[]>([]);
  const [ragResult, setRagResult] = useState<RAGResponse | null>(null);

  const handleQuery = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim() || loading) return;

    setLoading(true);
    setError(null);

    try {
      if (activeSubTab === 'recommend') {
        const res = await knowledgeApi.getRecommendations({ query: query.trim() });
        setRecommendations(res.recommendations || []);
        setNoRelevantInfo(res.no_relevant_information || false);
      } else if (activeSubTab === 'search') {
        const res = await searchApi.semanticSearch(query.trim(), 4);
        setSearchResults(res.results || []);
      } else if (activeSubTab === 'rag') {
        const res = await searchApi.askRAG(query.trim(), 3);
        setRagResult(res);
      }
    } catch (err: any) {
      setError(err.message || 'Operation failed. Please verify backend connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6">
      {/* Title */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Database className="w-5 h-5 text-indigo-600" />
          <span>Knowledge Base & Retrieval (Task 2 & Task 5)</span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Directly test vector semantic search against ChromaDB, ask RAG questions, or test Task 5 recommendation relevance thresholds.
        </p>
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 mb-6 text-xs font-semibold">
        <button
          onClick={() => {
            setActiveSubTab('recommend');
            setError(null);
          }}
          className={`pb-3 px-2 flex items-center gap-1.5 cursor-pointer border-b-2 transition-colors ${
            activeSubTab === 'recommend'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Task 5: Knowledge Recommendations</span>
        </button>

        <button
          onClick={() => {
            setActiveSubTab('search');
            setError(null);
          }}
          className={`pb-3 px-2 flex items-center gap-1.5 cursor-pointer border-b-2 transition-colors ${
            activeSubTab === 'search'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Search className="w-4 h-4" />
          <span>Task 2: Semantic Vector Search</span>
        </button>

        <button
          onClick={() => {
            setActiveSubTab('rag');
            setError(null);
          }}
          className={`pb-3 px-2 flex items-center gap-1.5 cursor-pointer border-b-2 transition-colors ${
            activeSubTab === 'rag'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Task 2: Direct RAG Q&A</span>
        </button>
      </div>

      {/* Query Bar */}
      <form onSubmit={handleQuery} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs mb-6">
        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
          {activeSubTab === 'rag'
            ? 'Ask RAG Knowledge Question:'
            : activeSubTab === 'search'
            ? 'Semantic Vector Search Query:'
            : 'Customer Support Query:'}
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type your inquiry or policy query..."
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs sm:text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-medium text-xs flex items-center gap-1.5 cursor-pointer transition-colors shrink-0"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span>Execute</span>
          </button>
        </div>

        {/* Quick Suggest Buttons */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-2xs text-slate-500">
          <span className="font-semibold text-slate-400">Sample Queries:</span>
          <button
            type="button"
            onClick={() => setQuery('How do I request a refund under the current policy?')}
            className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
          >
            Refund Policy
          </button>
          <button
            type="button"
            onClick={() => setQuery('My credit card was declined at checkout with error code')}
            className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
          >
            Payment Error
          </button>
          <button
            type="button"
            onClick={() => setQuery('How do I reset my password if I lost 2FA?')}
            className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
          >
            Account Reset
          </button>
          <button
            type="button"
            onClick={() => setQuery('What is the recommended baking temperature for homemade sourdough bread?')}
            className="px-2 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 cursor-pointer"
            title="Tests safe out-of-domain rejection"
          >
            Out-of-Domain Boundary Test
          </button>
        </div>
      </form>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 mb-6 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Results Container */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mx-auto mb-2" />
          <span>Searching vector index in ChromaDB...</span>
        </div>
      ) : activeSubTab === 'recommend' ? (
        <div>
          {noRelevantInfo ? (
            <div className="p-8 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-center">
              <CheckCircle className="w-6 h-6 text-amber-600 mx-auto mb-2" />
              <h3 className="font-semibold text-sm">Boundary Rejection Confirmed</h3>
              <p className="text-xs mt-1 text-amber-700">
                "No relevant knowledge was found for this customer query."
              </p>
              <p className="text-2xs text-amber-600 mt-2">
                All chunks fell below the 0.38 relevance score threshold, safely preventing hallucination.
              </p>
            </div>
          ) : recommendations.length > 0 ? (
            <div className="space-y-3">
              <div className="text-xs text-slate-500 font-medium">
                Retrieved {recommendations.length} recommendations sorted by relevance score:
              </div>
              {recommendations.map((rec, idx) => (
                <RecommendationCard key={idx} recommendation={rec} />
              ))}
            </div>
          ) : (
            <div className="p-10 text-center text-xs text-slate-400 bg-white rounded-xl border border-slate-200">
              Enter a customer query above and click Execute to test Task 5 recommendations.
            </div>
          )}
        </div>
      ) : activeSubTab === 'search' ? (
        <div>
          {searchResults.length > 0 ? (
            <div className="space-y-3">
              <div className="text-xs text-slate-500 font-medium">
                Retrieved {searchResults.length} document chunks from ChromaDB:
              </div>
              {searchResults.map((chunk, idx) => (
                <div key={idx} className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-mono font-semibold text-indigo-700">{chunk.chunk_id}</span>
                    <span className="text-2xs font-mono text-slate-400">
                      Distance: {chunk.distance.toFixed(4)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{chunk.text}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-10 text-center text-xs text-slate-400 bg-white rounded-xl border border-slate-200">
              Execute a search to view raw ChromaDB chunks and vector distances.
            </div>
          )}
        </div>
      ) : (
        <div>
          {ragResult ? (
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div>
                <span className="text-2xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Question
                </span>
                <p className="text-sm font-semibold text-slate-800">{ragResult.question}</p>
              </div>

              <div>
                <span className="text-2xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Generated RAG Answer (Task 2)
                </span>
                <div className="p-3.5 rounded-lg bg-indigo-50/50 border border-indigo-100 text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
                  {ragResult.answer}
                </div>
              </div>

              {ragResult.sources && ragResult.sources.length > 0 && (
                <div>
                  <span className="text-2xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                    Retrieved Knowledge Sources
                  </span>
                  <ul className="text-xs text-slate-600 list-disc list-inside space-y-1 font-mono">
                    {ragResult.sources.map((src, i) => (
                      <li key={i}>{typeof src === 'string' ? src : JSON.stringify(src)}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="p-10 text-center text-xs text-slate-400 bg-white rounded-xl border border-slate-200">
              Submit a support question to test the complete Task 2 RAG synthesis pipeline.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
