import React from 'react';
import type { ActiveTab } from './Navbar';

interface Props {
  onStartSimulation: () => void;
  activeSessionId: number | null;
  onResumeSession?: () => void;
  onNavigate?: (tab: ActiveTab) => void;
}

export const Home: React.FC<Props> = ({
  onStartSimulation,
  activeSessionId,
  onResumeSession,
  onNavigate,
}) => {
  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-16">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <h1 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">
          Support Agent Dashboard
        </h1>
        <p className="mt-4 text-base text-slate-600 leading-relaxed max-w-2xl mx-auto">
          Welcome to the AI-powered Customer Support Assistant. Choose a mode below to begin handling simulated customer inquiries, test the RAG knowledge pipeline, or review historical interactions.
        </p>
      </div>

      {/* 3 Modes Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-7xl mx-auto">
        {/* Simulator Mode */}
        <div 
          onClick={onStartSimulation}
          className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between cursor-pointer text-center group"
        >
          <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">Simulator</h3>
          <p className="text-sm text-slate-500">Practice with realistic AI customers.</p>
        </div>

        {/* Manual Mode */}
        <div 
          onClick={() => onNavigate && onNavigate('support-console')}
          className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between cursor-pointer text-center group"
        >
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">Manual</h3>
          <p className="text-sm text-slate-500">Handle support cases manually.</p>
        </div>

        {/* Replay Mode */}
        <div 
          onClick={() => onNavigate && onNavigate('conversations')}
          className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between cursor-pointer text-center group"
        >
          <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">Replay</h3>
          <p className="text-sm text-slate-500">Review past conversations and logs.</p>
        </div>
      </div>
      
      {activeSessionId && onResumeSession && (
        <div className="mt-12 text-center">
          <button
            onClick={onResumeSession}
            className="px-5 py-2.5 rounded-md border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition cursor-pointer text-sm"
          >
            Resume Session #{activeSessionId}
          </button>
        </div>
      )}
    </div>
  );
};

export default Home;
