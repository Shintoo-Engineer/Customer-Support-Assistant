import React, { useEffect, useState } from 'react';
import { analysisApi } from '../api/analysisApi';
import type { SessionAnalysisSummary, TurnAnalysis } from '../types';

interface Props {
  sessionId: number;
  onBackToConsole: () => void;
  onNewSimulation: () => void;
}

export const SessionSummaryView: React.FC<Props> = ({
  sessionId,
  onBackToConsole,
  onNewSimulation,
}) => {
  const [summary, setSummary] = useState<SessionAnalysisSummary | null>(null);
  const [turnHistory, setTurnHistory] = useState<TurnAnalysis[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [sumData, historyData] = await Promise.all([
          analysisApi.getSessionSummary(sessionId),
          analysisApi.getAnalysisHistory(sessionId),
        ]);
        setSummary(sumData);
        setTurnHistory(historyData);
      } catch (err: any) {
        setError(err.message || 'Failed to load session summary.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [sessionId]);

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Session #{sessionId} Summary
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Backend aggregated session metrics and turn-by-turn trajectory.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onBackToConsole}
            className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-medium transition cursor-pointer"
          >
            Back to Support Console
          </button>
          <button
            onClick={onNewSimulation}
            className="px-3 py-1.5 rounded bg-slate-900 text-white hover:bg-slate-800 text-xs font-medium transition cursor-pointer"
          >
            New Simulation
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-xs text-slate-500 py-8 text-center">Loading session summary...</p>
      ) : summary ? (
        <div className="space-y-6">
          {/* Summary metrics card */}
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
              Overall Session Performance
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div className="bg-slate-50 p-3 rounded border border-slate-100">
                <span className="text-slate-500 block text-2xs">Total Turns</span>
                <span className="text-base font-bold text-slate-900 mt-1 block">
                  {summary.turn_count}
                </span>
              </div>

              <div className="bg-slate-50 p-3 rounded border border-slate-100">
                <span className="text-slate-500 block text-2xs">Current Frustration</span>
                <span className="text-base font-bold text-slate-900 mt-1 block">
                  {summary.current_frustration !== null && summary.current_frustration !== undefined
                    ? `${summary.current_frustration}/10`
                    : 'N/A'}
                </span>
              </div>

              <div className="bg-slate-50 p-3 rounded border border-slate-100">
                <span className="text-slate-500 block text-2xs">Satisfaction Trend</span>
                <span className="text-base font-bold text-slate-900 capitalize mt-1 block">
                  {summary.overall_satisfaction_direction || 'Stable'}
                </span>
              </div>

              <div className="bg-slate-50 p-3 rounded border border-slate-100">
                <span className="text-slate-500 block text-2xs">Latest Emotion</span>
                <span className="text-base font-bold text-slate-900 capitalize mt-1 block">
                  {summary.latest_emotion || 'Neutral'}
                </span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-500">Dominant Intent:</span>{' '}
                <strong className="text-slate-900 capitalize">{summary.dominant_intent || 'General'}</strong>
              </div>
              <div>
                <span className="text-slate-500">Escalation Risk:</span>{' '}
                <strong className="text-slate-900 capitalize">{summary.current_escalation_risk || 'Low'}</strong>
              </div>
            </div>
          </div>

          {/* Turn History Table */}
          {turnHistory.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-lg p-5">
              <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                Turn-by-Turn Progression
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 text-2xs uppercase">
                      <th className="py-2 px-2">Turn</th>
                      <th className="py-2 px-2">Intent</th>
                      <th className="py-2 px-2">Emotion</th>
                      <th className="py-2 px-2">Frustration</th>
                      <th className="py-2 px-2">Escalation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {turnHistory.map((t) => (
                      <tr key={t.turn}>
                        <td className="py-2 px-2 font-semibold">#{t.turn}</td>
                        <td className="py-2 px-2 capitalize">{t.intent}</td>
                        <td className="py-2 px-2 capitalize">{t.emotion}</td>
                        <td className="py-2 px-2">{t.frustration_level}/10</td>
                        <td className="py-2 px-2 capitalize">{t.escalation_risk}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-slate-400 py-8 text-center">
          No summary data found for this session.
        </p>
      )}
    </div>
  );
};

export default SessionSummaryView;
