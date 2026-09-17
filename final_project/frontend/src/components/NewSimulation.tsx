import React, { useState } from 'react';
import type { PersonaType, ScenarioType, SimulatorStartRequest, IntegratedTurnResponse } from '../types';
import { simulatorApi } from '../api/simulatorApi';

interface Props {
  onSessionStarted: (data: IntegratedTurnResponse, config: SimulatorStartRequest) => void;
}

const PERSONA_OPTIONS: Array<{ value: PersonaType; label: string }> = [
  { value: 'frustrated', label: 'Frustrated' },
  { value: 'angry', label: 'Angry' },
  { value: 'calm', label: 'Calm' },
  { value: 'confused', label: 'Confused' },
  { value: 'impatient', label: 'Impatient' },
  { value: 'polite', label: 'Polite' },
];

const SCENARIO_OPTIONS: Array<{ value: ScenarioType; label: string }> = [
  { value: 'refund', label: 'Refund Request' },
  { value: 'delayed_order', label: 'Delayed Order / Delivery' },
  { value: 'payment_failure', label: 'Payment Failure' },
  { value: 'account_issue', label: 'Account / Login Issue' },
  { value: 'cancellation', label: 'Subscription Cancellation' },
];

export const NewSimulation: React.FC<Props> = ({ onSessionStarted }) => {
  const [persona, setPersona] = useState<PersonaType>('frustrated');
  const [scenario, setScenario] = useState<ScenarioType>('refund');
  const [initialEmotion, setInitialEmotion] = useState<string>('frustrated');
  const [issueSeverity, setIssueSeverity] = useState<number>(4);
  const [patienceLevel, setPatienceLevel] = useState<number>(3);
  const [expectedResolution, setExpectedResolution] = useState<string>('Full refund issued to original payment method');
  const [sessionLabel, setSessionLabel] = useState<string>('Support Simulation');

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload: SimulatorStartRequest = {
      session_label: sessionLabel.trim() || `Session - ${scenario}`,
      persona,
      scenario,
      initial_emotion: initialEmotion || 'frustrated',
      issue_severity: Number(issueSeverity) || 3,
      patience_level: Number(patienceLevel) || 3,
      expected_resolution: expectedResolution.trim() || 'Issue resolution',
    };

    try {
      const result = await simulatorApi.startSession(payload);
      onSessionStarted(result, payload);
    } catch (err: any) {
      setError(err.message || 'Failed to start simulation. Please ensure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-10 px-4">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">New Simulation</h1>
        <p className="text-xs text-slate-500 mt-1">
          Configure a customer scenario to begin support simulation.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        {/* Required: Scenario */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Scenario <span className="text-rose-500">*</span>
          </label>
          <select
            value={scenario}
            onChange={(e) => setScenario(e.target.value as ScenarioType)}
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:border-slate-500"
            required
          >
            {SCENARIO_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Required: Persona */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Persona <span className="text-rose-500">*</span>
          </label>
          <select
            value={persona}
            onChange={(e) => {
              const val = e.target.value as PersonaType;
              setPersona(val);
              setInitialEmotion(val);
            }}
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:border-slate-500"
            required
          >
            {PERSONA_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Optional: Initial Emotion */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Initial Emotion
            </label>
            <select
              value={initialEmotion}
              onChange={(e) => setInitialEmotion(e.target.value)}
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:border-slate-500"
            >
              <option value="frustrated">Frustrated</option>
              <option value="angry">Angry</option>
              <option value="confused">Confused</option>
              <option value="anxious">Anxious</option>
              <option value="neutral">Neutral</option>
              <option value="happy">Happy</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Severity (1–5)
            </label>
            <input
              type="number"
              min={1}
              max={5}
              value={issueSeverity}
              onChange={(e) => setIssueSeverity(Number(e.target.value))}
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:border-slate-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Patience (1–5)
            </label>
            <input
              type="number"
              min={1}
              max={5}
              value={patienceLevel}
              onChange={(e) => setPatienceLevel(Number(e.target.value))}
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:border-slate-500"
            />
          </div>
        </div>

        {/* Optional: Expected Resolution */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Expected Resolution
          </label>
          <input
            type="text"
            value={expectedResolution}
            onChange={(e) => setExpectedResolution(e.target.value)}
            placeholder="e.g. Issue full refund"
            className="w-full border border-slate-300 rounded px-3 py-1.5 text-xs bg-white focus:outline-none focus:border-slate-500"
          />
        </div>

        {/* Optional: Session Label */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Session Label
          </label>
          <input
            type="text"
            value={sessionLabel}
            onChange={(e) => setSessionLabel(e.target.value)}
            placeholder="e.g. Support Practice Session"
            className="w-full border border-slate-300 rounded px-3 py-1.5 text-xs bg-white focus:outline-none focus:border-slate-500"
          />
        </div>

        {/* Submit */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded bg-slate-900 text-white font-medium hover:bg-slate-800 transition text-sm cursor-pointer disabled:bg-slate-400"
          >
            {loading ? 'Starting Simulation...' : 'Start Simulation'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default NewSimulation;
