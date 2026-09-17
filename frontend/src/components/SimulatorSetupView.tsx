import React, { useState } from 'react';

interface SimulatorSetupViewProps {
  onBack: () => void;
  onStartSimulation: (config: {
    session_label: string;
    persona: string;
    initial_emotion: string;
    scenario: string;
    issue_severity: number;
    patience_level: number;
    expected_resolution: string;
  }) => void;
}

const PERSONAS = [
  { value: 'calm', label: 'Calm' },
  { value: 'confused', label: 'Confused' },
  { value: 'frustrated', label: 'Frustrated' },
  { value: 'angry', label: 'Angry' },
  { value: 'impatient', label: 'Impatient' },
  { value: 'polite', label: 'Polite' },
];

const EMOTIONS = [
  { value: 'calm', label: 'Calm' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'confused', label: 'Confused' },
  { value: 'worried', label: 'Worried' },
  { value: 'frustrated', label: 'Frustrated' },
  { value: 'angry', label: 'Angry' },
  { value: 'satisfied', label: 'Satisfied' },
];

const SCENARIOS = [
  { value: 'refund', label: 'Refund Request' },
  { value: 'delayed_order', label: 'Delayed Order' },
  { value: 'payment_failure', label: 'Payment Failure' },
  { value: 'account_issue', label: 'Account Issue' },
  { value: 'cancellation', label: 'Cancellation' },
];

export function SimulatorSetupView({
  onBack,
  onStartSimulation,
}: SimulatorSetupViewProps) {
  const [sessionLabel, setSessionLabel] = useState('');
  const [persona, setPersona] = useState('calm');
  const [initialEmotion, setInitialEmotion] = useState('calm');
  const [scenario, setScenario] = useState('refund');
  const [issueSeverity, setIssueSeverity] = useState(3);
  const [patienceLevel, setPatienceLevel] = useState(70);
  const [expectedResolution, setExpectedResolution] = useState('');

  const handleStart = () => {
    const trimmedSessionLabel = sessionLabel.trim();
    const trimmedExpectedResolution =
      expectedResolution.trim();

    if (!trimmedSessionLabel) {
      return;
    }

    onStartSimulation({
      session_label: trimmedSessionLabel,
      persona,
      initial_emotion: initialEmotion,
      scenario,
      issue_severity: issueSeverity,
      patience_level: patienceLevel,
      expected_resolution: trimmedExpectedResolution,
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <button
          type="button"
          onClick={onBack}
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-400 transition hover:text-white"
        >
          <span aria-hidden="true">←</span>
          Back
        </button>

        <div className="mb-8">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-indigo-400">
            Simulator Mode
          </p>

          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Customer Profile
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
            Configure the customer before starting the simulation. The AI will
            generate realistic customer responses based on the selected persona,
            scenario, emotional state, severity, and patience level.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl sm:p-7">
          <div className="mb-7">
            <h2 className="text-lg font-semibold text-white">
              Session Setup
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              Define how the simulated customer should behave during the
              conversation.
            </p>
          </div>

          <div className="space-y-6">
            <div>
              <label
                htmlFor="session-label"
                className="mb-2 block text-sm font-medium text-slate-200"
              >
                Session Label
              </label>

              <input
                id="session-label"
                type="text"
                value={sessionLabel}
                onChange={(event) =>
                  setSessionLabel(event.target.value)
                }
                placeholder="Example: Refund Practice Session"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />

              <p className="mt-2 text-xs text-slate-500">
                Give this simulation a name so the session can be identified
                later.
              </p>
            </div>

            <div>
              <label
                htmlFor="customer-persona"
                className="mb-2 block text-sm font-medium text-slate-200"
              >
                Customer Persona
              </label>

              <select
                id="customer-persona"
                value={persona}
                onChange={(event) =>
                  setPersona(event.target.value)
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              >
                {PERSONAS.map((item) => (
                  <option
                    key={item.value}
                    value={item.value}
                  >
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="initial-emotion"
                className="mb-2 block text-sm font-medium text-slate-200"
              >
                Initial Emotion
              </label>

              <select
                id="initial-emotion"
                value={initialEmotion}
                onChange={(event) =>
                  setInitialEmotion(event.target.value)
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              >
                {EMOTIONS.map((item) => (
                  <option
                    key={item.value}
                    value={item.value}
                  >
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="customer-scenario"
                className="mb-2 block text-sm font-medium text-slate-200"
              >
                Customer Scenario
              </label>

              <select
                id="customer-scenario"
                value={scenario}
                onChange={(event) =>
                  setScenario(event.target.value)
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              >
                {SCENARIOS.map((item) => (
                  <option
                    key={item.value}
                    value={item.value}
                  >
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label
                  htmlFor="issue-severity"
                  className="text-sm font-medium text-slate-200"
                >
                  Issue Severity
                </label>

                <span className="text-sm font-semibold text-indigo-400">
                  {issueSeverity} / 5
                </span>
              </div>

              <input
                id="issue-severity"
                type="range"
                min="1"
                max="5"
                step="1"
                value={issueSeverity}
                onChange={(event) =>
                  setIssueSeverity(
                    Number(event.target.value)
                  )
                }
                className="w-full accent-indigo-500"
              />

              <div className="mt-1 flex justify-between text-xs text-slate-500">
                <span>Low</span>
                <span>High</span>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label
                  htmlFor="patience-level"
                  className="text-sm font-medium text-slate-200"
                >
                  Patience Level
                </label>

                <span className="text-sm font-semibold text-indigo-400">
                  {patienceLevel} / 100
                </span>
              </div>

              <input
                id="patience-level"
                type="range"
                min="0"
                max="100"
                step="1"
                value={patienceLevel}
                onChange={(event) =>
                  setPatienceLevel(
                    Number(event.target.value)
                  )
                }
                className="w-full accent-indigo-500"
              />

              <div className="mt-1 flex justify-between text-xs text-slate-500">
                <span>Impatient</span>
                <span>Patient</span>
              </div>
            </div>

            <div>
              <label
                htmlFor="expected-resolution"
                className="mb-2 block text-sm font-medium text-slate-200"
              >
                Expected Resolution
              </label>

              <textarea
                id="expected-resolution"
                value={expectedResolution}
                onChange={(event) =>
                  setExpectedResolution(
                    event.target.value
                  )
                }
                rows={4}
                placeholder="Example: Customer expects the refund to be processed and wants confirmation of the refund timeline."
                className="w-full resize-none rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleStart}
                disabled={!sessionLabel.trim()}
                className="w-full rounded-xl bg-indigo-600 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-950/30 transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900"
              >
                Start Simulation
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}