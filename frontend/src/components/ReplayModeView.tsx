import React, { useState } from 'react';
import {
  RotateCcw,
  Sparkles,
  Play,
  CheckCircle2,
  AlertTriangle,
  User,
  ArrowRight,
  Clock,
  BookOpen,
  Award
} from 'lucide-react';
import { INITIAL_REPLAY_SESSIONS } from '../data/initialData';

export const ReplayModeView: React.FC = () => {
  const [selectedCaseIdx, setSelectedCaseIdx] = useState(0);
  const [currentTurnIdx, setCurrentTurnIdx] = useState(0);
  const [userDraft, setUserDraft] = useState('');
  const [isRevealed, setIsRevealed] = useState(false);

  const currentCase = INITIAL_REPLAY_SESSIONS[selectedCaseIdx] || INITIAL_REPLAY_SESSIONS[0];
  const currentTurn = currentCase.turns[currentTurnIdx] || currentCase.turns[0];

  const handleSubmitTurn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userDraft.trim()) return;
    setIsRevealed(true);
  };

  const handleNextTurn = () => {
    if (currentTurnIdx + 1 < currentCase.turns.length) {
      setCurrentTurnIdx(currentTurnIdx + 1);
      setUserDraft('');
      setIsRevealed(false);
    } else {
      // Completed case
      alert("🎉 Replay Training Completed! You've mastered this historical case.");
      setCurrentTurnIdx(0);
      setUserDraft('');
      setIsRevealed(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 animate-fadeIn">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">Replay Training & "What Would You Do?" Mode</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-800">
              Interactive Case Study
            </span>
          </div>
          <p className="text-xs text-slate-400">Step through real past escalated cases. Formulate your response, analyze the original agent mistakes, and study AI master patterns.</p>
        </div>

        {/* Case Switcher */}
        <div className="flex items-center gap-2">
          {INITIAL_REPLAY_SESSIONS.map((c, i) => (
            <button
              key={c.id}
              onClick={() => {
                setSelectedCaseIdx(i);
                setCurrentTurnIdx(0);
                setUserDraft('');
                setIsRevealed(false);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                selectedCaseIdx === i
                  ? 'bg-indigo-600 border-indigo-500 text-white shadow-md'
                  : 'bg-slate-850 border-slate-700 text-slate-300 hover:bg-slate-800'
              }`}
            >
              Case #{i + 1}: {c.category}
            </button>
          ))}
        </div>
      </div>

      {/* Case Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
            {currentCase.title}
          </span>
          <span className="text-xs text-slate-400">
            Turn {currentTurnIdx + 1} of {currentCase.turns.length}
          </span>
        </div>
        <p className="text-xs text-slate-300">
          Customer: <b className="text-white">{currentCase.customerName}</b> • Difficulty: <b className="capitalize text-amber-400">{currentCase.difficulty}</b>
        </p>
      </div>

      {/* Customer Message Bubble */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center font-bold text-white text-xs border border-slate-700">
            {currentCase.customerName.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <span className="font-bold text-xs text-white">{currentCase.customerName}</span>
            <span className="text-[10px] text-rose-400 block">Severe Frustration Detected</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-800/90 border border-slate-700 text-sm text-slate-100 font-medium leading-relaxed">
          "{currentTurn.customerMessage}"
        </div>
      </div>

      {/* Trainee Response Input */}
      {!isRevealed ? (
        <form onSubmit={handleSubmitTurn} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
          <label className="text-xs font-bold text-white uppercase tracking-wider block">
            Your Turn: What Would You Say to This Customer?
          </label>
          <textarea
            rows={4}
            required
            placeholder="Type your empathetic, de-escalating response..."
            value={userDraft}
            onChange={(e) => setUserDraft(e.target.value)}
            className="w-full p-3.5 bg-slate-800 border border-slate-700 rounded-2xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none leading-relaxed"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!userDraft.trim()}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2 shadow-md transition disabled:opacity-50"
            >
              <span>Submit & Compare with Master Strategy</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      ) : (
        /* Revealed Side-by-Side Analysis */
        <div className="space-y-6 animate-fadeIn">
          
          {/* 3-Way Comparison Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* 1. Trainee Draft */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-indigo-700/60 space-y-2">
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider block">
                1. Your Draft
              </span>
              <p className="text-xs text-slate-200 italic leading-relaxed">"{userDraft}"</p>
              <div className="mt-2 pt-2 border-t border-slate-800 text-[11px] text-emerald-300">
                ✓ Submitted for evaluation
              </div>
            </div>

            {/* 2. Original Historic Flawed Response */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-rose-800/60 space-y-2">
              <span className="text-xs font-bold text-rose-400 uppercase tracking-wider block flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                2. Original Agent Mistake
              </span>
              <p className="text-xs text-slate-300 italic leading-relaxed">"{currentTurn.originalAgentResponse}"</p>
              <div className="mt-2 pt-2 border-t border-slate-800 text-[11px] text-rose-300">
                <b>Why it failed:</b> {currentTurn.criticism}
              </div>
            </div>

            {/* 3. AI Master Response */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-emerald-700/60 space-y-2">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                3. AI Master De-escalation
              </span>
              <p className="text-xs text-emerald-100 italic leading-relaxed">"{currentTurn.improvedResponse}"</p>
              <div className="mt-2 pt-2 border-t border-slate-800 text-[11px] text-emerald-300">
                ✓ Full ownership, warm empathy, zero friction
              </div>
            </div>

          </div>

          {/* Action to proceed to next turn */}
          <div className="flex justify-end">
            <button
              onClick={handleNextTurn}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg transition"
            >
              <span>{currentTurnIdx + 1 < currentCase.turns.length ? 'Continue to Next Turn' : 'Finish Case Study'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

        </div>
      )}

    </div>
  );
};
