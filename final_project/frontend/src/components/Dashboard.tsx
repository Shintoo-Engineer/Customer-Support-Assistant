import React, { useEffect, useState } from 'react';
import type { IntegratedTurnResponse, SimulatorStartRequest, AnalysisMetrics } from '../types';
import { analysisApi } from '../api/analysisApi';
import { EmotionBadge, SentimentBadge, EscalationRiskBadge } from './EmotionBadge';
import { FrustrationMeter } from './FrustrationMeter';
import {
  PlayCircle,
  Headphones,
  Brain,
  Database,
  Bot,
  Activity,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

interface Props {
  activeSession: IntegratedTurnResponse | null;
  sessionConfig: SimulatorStartRequest | null;
  onNavigate: (tab: any) => void;
  backendOnline: boolean;
}

export const Dashboard: React.FC<Props> = ({
  activeSession,
  sessionConfig,
  onNavigate,
  backendOnline,
}) => {
  const [metrics, setMetrics] = useState<AnalysisMetrics | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const m = await analysisApi.getMetrics();
        setMetrics(m);
      } catch {
        // Silently skip if metrics not loaded
      }
    };

    fetchMetrics();
  }, [activeSession]);

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Hero Welcome Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden">
        <div className="max-w-2xl relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-200 text-xs font-medium border border-indigo-400/30">
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Coaching & Support Assistant System</span>
            </div>
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${backendOnline ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30' : 'bg-amber-500/20 text-amber-200 border-amber-400/30'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${backendOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
              <span>{backendOnline ? 'Backend Online' : 'Backend Connecting...'}</span>
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Customer Support Assistant
          </h1>
          <p className="mt-2 text-sm text-indigo-100/80 leading-relaxed">
            An integrated multi-agent system combining RAG knowledge base retrieval (Task 2), realistic customer
            simulation (Task 3), real-time sentiment analysis (Task 4), and context-aware policy recommendations (Task 5).
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {activeSession ? (
              <button
                onClick={() => onNavigate('support-console')}
                className="px-5 py-2.5 rounded-xl bg-white text-indigo-900 hover:bg-indigo-50 font-semibold text-xs flex items-center gap-2 shadow-xs cursor-pointer transition-colors"
              >
                <Headphones className="w-4 h-4 text-indigo-600" />
                <span>Resume Active Session #{activeSession.session_id}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={() => onNavigate('new-simulation')}
                className="px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-semibold text-xs flex items-center gap-2 shadow-xs cursor-pointer transition-colors"
              >
                <PlayCircle className="w-4 h-4" />
                <span>Start New Simulation</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              onClick={() => onNavigate('knowledge-search')}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium cursor-pointer transition-colors border border-white/10"
            >
              Explore Knowledge Base
            </button>
          </div>
        </div>
      </div>

      {/* Active Session Card OR Callout */}
      <div>
        <h2 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
          <Activity className="w-4 h-4 text-indigo-600" />
          <span>Active Simulation Session</span>
        </h2>

        {activeSession ? (
          <div className="bg-white rounded-xl border border-indigo-200 p-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                  #{activeSession.session_id}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 text-sm">
                      {sessionConfig?.session_label || `Session #${activeSession.session_id}`}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-2xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Turn {activeSession.turn}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Scenario:{' '}
                    <span className="font-semibold text-slate-700 capitalize">
                      {sessionConfig?.scenario || 'Active'}
                    </span>{' '}
                    • Persona:{' '}
                    <span className="font-semibold text-slate-700 capitalize">
                      {sessionConfig?.persona || 'Active'}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onNavigate('support-console')}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Headphones className="w-3.5 h-3.5" />
                  <span>Open Support Console</span>
                </button>
                <button
                  onClick={() => onNavigate('session-summary')}
                  className="px-3 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-medium cursor-pointer"
                >
                  Summary
                </button>
              </div>
            </div>

            {/* Turn Metrics Overview */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
              <div>
                <span className="text-2xs font-semibold text-slate-400 block mb-1">Current Emotion</span>
                <EmotionBadge emotion={activeSession.analysis?.emotion} />
              </div>
              <div>
                <span className="text-2xs font-semibold text-slate-400 block mb-1">Sentiment Polarity</span>
                <SentimentBadge sentiment={activeSession.analysis?.sentiment} />
              </div>
              <div>
                <span className="text-2xs font-semibold text-slate-400 block mb-1">Escalation Risk</span>
                <EscalationRiskBadge risk={activeSession.analysis?.escalation_risk} />
              </div>
              <div>
                <span className="text-2xs font-semibold text-slate-400 block mb-1">Knowledge Recs</span>
                <span className="text-xs font-mono font-bold text-indigo-700">
                  {activeSession.recommendations?.length || 0} articles available
                </span>
              </div>
            </div>

            {activeSession.analysis && (
              <div className="mt-4 pt-4 border-t border-slate-100 max-w-sm">
                <FrustrationMeter level={activeSession.analysis.frustration_level} />
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center shadow-xs">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Headphones className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-sm text-slate-800">No active conversation</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Launch a simulation to test customer persona behaviors, multidimensional sentiment analysis, and knowledge retrieval.
            </p>
            <button
              onClick={() => onNavigate('new-simulation')}
              className="mt-4 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs inline-flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <PlayCircle className="w-4 h-4" />
              <span>Start New Simulation</span>
            </button>
          </div>
        )}
      </div>

      {/* Task Architecture Cards */}
      <div>
        <h2 className="text-base font-bold text-slate-900 mb-3">System Architecture & Capabilities</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center mb-3">
              <Database className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-xs text-slate-800">Task 2: RAG Pipeline</h3>
            <p className="text-2xs text-slate-500 mt-1 leading-relaxed">
              Vector ingestion of PDF policies and support FAQs into ChromaDB with all-MiniLM-L6-v2 embeddings.
            </p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center mb-3">
              <Bot className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-xs text-slate-800">Task 3: Customer Simulator</h3>
            <p className="text-2xs text-slate-500 mt-1 leading-relaxed">
              Autonomous customer agent simulating realistic emotional personas across 5 support scenarios.
            </p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center mb-3">
              <Brain className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-xs text-slate-800">Task 4: Sentiment Analysis</h3>
            <p className="text-2xs text-slate-500 mt-1 leading-relaxed">
              Real-time classification of intent, emotion, sentiment, frustration [0-10], and supervisor risk.
            </p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center mb-3">
              <Sparkles className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-xs text-slate-800">Task 5: Knowledge Agent</h3>
            <p className="text-2xs text-slate-500 mt-1 leading-relaxed">
              Context-aware recommendation engine synthesizing conversation history to retrieve bounded articles.
            </p>
          </div>
        </div>
      </div>

      {/* Backend Operational Metrics (from actual GET /analysis/metrics) */}
      {metrics && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-indigo-600" />
              <span>Live Analysis Engine Metrics (Backend Telemetry)</span>
            </h3>
            <span className="text-3xs text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              Operational
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-slate-400 text-2xs block">Total Message Analyses</span>
              <span className="font-mono text-base font-bold text-slate-800">{metrics.total_analyses}</span>
            </div>
            <div>
              <span className="text-slate-400 text-2xs block">Deterministic Fallbacks</span>
              <span className="font-mono text-base font-bold text-indigo-600">{metrics.fallback_analyses}</span>
            </div>
            <div>
              <span className="text-slate-400 text-2xs block">Validation Failures</span>
              <span className="font-mono text-base font-bold text-slate-800">{metrics.validation_failures}</span>
            </div>
            <div>
              <span className="text-slate-400 text-2xs block">Mean Engine Latency</span>
              <span className="font-mono text-base font-bold text-slate-800">
                {metrics.total_analyses > 0
                  ? `${Math.round(metrics.total_latency_ms / metrics.total_analyses)} ms`
                  : '0 ms'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
