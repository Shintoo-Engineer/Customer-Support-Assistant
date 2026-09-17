import React from 'react';

interface Props {
  onStartSimulation: () => void;
  activeSessionId: number | null;
  onResumeSession?: () => void;
}

export const Home: React.FC<Props> = ({
  onStartSimulation,
  activeSessionId,
  onResumeSession,
}) => {
  return (
    <div className="max-w-2xl mx-auto py-16 px-4">
      {/* Hero Section */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
          Customer Support Assistant
        </h1>

        <p className="mt-3 text-base text-slate-600 leading-relaxed max-w-lg mx-auto">
          AI-powered customer support simulation with realistic customer behavior, sentiment analysis, and knowledge base recommendations.
        </p>

        {/* Action Buttons - Cleanly Centered */}
        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            onClick={onStartSimulation}
            className="px-6 py-2.5 rounded-md bg-slate-900 text-white font-medium hover:bg-slate-800 transition cursor-pointer text-sm shadow-xs"
          >
            Start New Simulation
          </button>

          {activeSessionId && onResumeSession && (
            <button
              onClick={onResumeSession}
              className="px-5 py-2.5 rounded-md border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition cursor-pointer text-sm"
            >
              Resume Session #{activeSessionId}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;
