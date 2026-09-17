import api from './client';
import type {
  AnalysisResponse,
  TurnAnalysis,
  SessionAnalysisSummary,
  DecisionSupportResult,
  AnalysisMetrics,
} from '../types';

export const analysisApi = {
  /**
   * Directly analyzes a customer message in session context.
   */
  analyzeMessage: (sessionId: number, customerMessage: string) => {
    return api.post<AnalysisResponse>('/analysis/analyze', {
      session_id: sessionId,
      customer_message: customerMessage,
    });
  },

  /**
   * Retrieves turn-by-turn historical analysis progression.
   */
  getAnalysisHistory: (sessionId: number) => {
    return api.get<TurnAnalysis[]>(`/analysis/${sessionId}/history`);
  },

  /**
   * Retrieves aggregated session analysis summary.
   */
  getSessionSummary: (sessionId: number) => {
    return api.get<SessionAnalysisSummary>(`/analysis/${sessionId}/summary`);
  },

  /**
   * Retrieves deterministic downstream decision-support recommendations.
   */
  getDecisionSupport: (sessionId: number) => {
    return api.get<DecisionSupportResult>(`/analysis/${sessionId}/decision-support`);
  },

  /**
   * Retrieves operational metrics of the analysis engine.
   */
  getMetrics: () => {
    return api.get<AnalysisMetrics>('/analysis/metrics');
  },
};
