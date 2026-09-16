import React, { useState } from 'react';
import {
  Sparkles,
  Search,
  Filter,
  Play,
  Plus,
  Bot,
  User,
  ShieldAlert,
  CheckCircle2,
  Flame,
  X,
  RefreshCw,
  Sliders
} from 'lucide-react';
import { Scenario, DifficultyLevel, UserRole } from '../types';

interface ScenariosViewProps {
  scenarios: Scenario[];
  onStartScenario: (scenario: Scenario) => void;
  onAddNewScenario: (scenario: Scenario) => void;
  userRole: UserRole;
  onGenerateAiScenario: (prompt: string, category: string, difficulty: DifficultyLevel) => Promise<Scenario | null>;
}

export const ScenariosView: React.FC<ScenariosViewProps> = ({
  scenarios,
  onStartScenario,
  onAddNewScenario,
  userRole,
  onGenerateAiScenario
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedScenarioForModal, setSelectedScenarioForModal] = useState<Scenario | null>(null);

  // AI Generator Modal state
  const [showAiGenModal, setShowAiGenModal] = useState(false);
  const [genPrompt, setGenPrompt] = useState('');
  const [genCategory, setGenCategory] = useState('Billing');
  const [genDifficulty, setGenDifficulty] = useState<DifficultyLevel>('hard');
  const [isGenerating, setIsGenerating] = useState(false);

  const categories = ['All', 'Billing', 'Product', 'Shipping', 'Security', 'Subscription', 'Technical'];
  const difficulties = ['All', 'easy', 'medium', 'hard', 'expert'];

  const filteredScenarios = scenarios.filter((s) => {
    const matchCat = selectedCategory === 'All' || s.category === selectedCategory;
    const matchDiff = selectedDifficulty === 'All' || s.difficulty === selectedDifficulty;
    const matchSearch =
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.customerPersona.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.initialProblem.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchDiff && matchSearch;
  });

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!genPrompt.trim()) return;
    setIsGenerating(true);
    try {
      const newScen = await onGenerateAiScenario(genPrompt, genCategory, genDifficulty);
      if (newScen) {
        onAddNewScenario(newScen);
        setShowAiGenModal(false);
        setGenPrompt('');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const getDifficultyBadge = (diff: string) => {
    switch (diff) {
      case 'easy':
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60';
      case 'medium':
        return 'bg-amber-950/80 text-amber-300 border-amber-800/60';
      case 'hard':
        return 'bg-rose-950/80 text-rose-300 border-rose-800/60';
      case 'expert':
        return 'bg-purple-950/80 text-purple-300 border-purple-800/60';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 animate-fadeIn">
      
      {/* Header & Generator Trigger */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Support Scenario Library</h1>
          <p className="text-xs text-slate-400">Practice simulated customer interactions across diverse difficulty levels and emotions.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-open-ai-generator"
            onClick={() => setShowAiGenModal(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white text-xs font-bold flex items-center gap-2 shadow-md transition"
          >
            <Sparkles className="w-4 h-4 text-white" />
            <span>AI Scenario Generator</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              id="scenario-search-input"
              type="text"
              placeholder="Search scenarios by title, customer name, issue..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Difficulty Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Difficulty:</span>
            <select
              id="scenario-difficulty-filter"
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500 capitalize"
            >
              {difficulties.map((d) => (
                <option key={d} value={d} className="capitalize">{d}</option>
              ))}
            </select>
          </div>

        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-750 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Scenarios Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredScenarios.map((scen) => (
          <div
            key={scen.id}
            className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 flex flex-col justify-between space-y-4 transition shadow-lg hover:shadow-indigo-500/5 group"
          >
            <div className="space-y-3">
              {/* Category & Difficulty */}
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                  {scen.category}
                </span>
                <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase border ${getDifficultyBadge(scen.difficulty)}`}>
                  {scen.difficulty}
                </span>
              </div>

              {/* Title & Customer Persona */}
              <div>
                <h3 className="font-bold text-sm text-white group-hover:text-indigo-300 transition line-clamp-1">
                  {scen.title}
                </h3>
                <div className="flex items-center gap-2.5 mt-2">
                  <img
                    src={scen.customerPersona.avatar}
                    alt={scen.customerPersona.name}
                    className="w-7 h-7 rounded-full object-cover ring-1 ring-slate-700"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-200 block">{scen.customerPersona.name}</span>
                    <span className="text-[10px] text-slate-400">{scen.customerPersona.type}</span>
                  </div>
                </div>
              </div>

              {/* Problem Excerpt */}
              <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                {scen.initialProblem}
              </p>

              {/* Opening Message Preview */}
              <div className="p-2.5 rounded-lg bg-slate-800/70 border border-slate-700/60 text-[11px] text-slate-300 italic line-clamp-2">
                "{scen.customerOpeningMessage}"
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
              <button
                id={`btn-view-details-${scen.id}`}
                onClick={() => setSelectedScenarioForModal(scen)}
                className="text-xs text-slate-400 hover:text-indigo-400 font-medium transition"
              >
                View Details
              </button>

              <button
                id={`btn-launch-scen-${scen.id}`}
                onClick={() => onStartScenario(scen)}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Practice</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Scenario Details Modal */}
      {selectedScenarioForModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative animate-scaleUp">
            <button
              onClick={() => setSelectedScenarioForModal(null)}
              className="absolute right-4 top-4 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1">
              <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase border ${getDifficultyBadge(selectedScenarioForModal.difficulty)}`}>
                {selectedScenarioForModal.difficulty}
              </span>
              <h2 className="text-lg font-bold text-white mt-1">{selectedScenarioForModal.title}</h2>
              <p className="text-xs text-slate-400">Category: {selectedScenarioForModal.category}</p>
            </div>

            {/* Persona card */}
            <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center gap-3">
              <img
                src={selectedScenarioForModal.customerPersona.avatar}
                alt="Persona"
                className="w-12 h-12 rounded-full object-cover ring-2 ring-indigo-500/50"
              />
              <div className="text-xs">
                <span className="font-bold text-white text-sm">{selectedScenarioForModal.customerPersona.name}</span>
                <p className="text-slate-400">{selectedScenarioForModal.customerPersona.behaviorDescription}</p>
                <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-300">
                  <span>Base Frustration: <b className="text-rose-400">{selectedScenarioForModal.customerPersona.baseFrustration}%</b></span>
                  <span>Patience: <b className="text-amber-400">{selectedScenarioForModal.customerPersona.patience}%</b></span>
                </div>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-300">
              <span className="font-bold text-white block">Success Criteria:</span>
              <ul className="space-y-1 pl-1">
                {selectedScenarioForModal.successCriteria.map((crit, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{crit}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-800/40 text-xs text-rose-200">
              <b className="text-rose-400">Escalation Trigger: </b>
              {selectedScenarioForModal.escalationTrigger}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setSelectedScenarioForModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Close
              </button>
              <button
                onClick={() => {
                  onStartScenario(selectedScenarioForModal);
                  setSelectedScenarioForModal(null);
                }}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Launch Practice Session</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Scenario Generator Modal */}
      {showAiGenModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleGenerate} className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative animate-scaleUp">
            <button
              type="button"
              onClick={() => setShowAiGenModal(false)}
              className="absolute right-4 top-4 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center text-indigo-400">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">AI Support Scenario Generator</h2>
                <p className="text-xs text-slate-400">Powered by Gemini 3.7 Flash</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-200">Describe the customer scenario:</label>
              <textarea
                id="ai-scen-prompt-input"
                rows={3}
                required
                placeholder="E.g., Customer whose high-tier annual plan auto-renewed without their knowledge, now demanding an emergency chargeback and threatening to blast on social media..."
                value={genPrompt}
                onChange={(e) => setGenPrompt(e.target.value)}
                className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-200">Category:</label>
                <select
                  id="ai-scen-category"
                  value={genCategory}
                  onChange={(e) => setGenCategory(e.target.value)}
                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="Billing">Billing</option>
                  <option value="Product">Product</option>
                  <option value="Shipping">Shipping</option>
                  <option value="Security">Security</option>
                  <option value="Subscription">Subscription</option>
                  <option value="Technical">Technical</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-200">Difficulty:</label>
                <select
                  id="ai-scen-difficulty"
                  value={genDifficulty}
                  onChange={(e) => setGenDifficulty(e.target.value as DifficultyLevel)}
                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="easy">Easy (Friendly)</option>
                  <option value="medium">Medium (Impatient)</option>
                  <option value="hard">Hard (Highly Frustrated)</option>
                  <option value="expert">Expert (Hostile & Urgent)</option>
                </select>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowAiGenModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                id="btn-submit-ai-scenario"
                disabled={isGenerating || !genPrompt.trim()}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2 shadow-md transition disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Generating Scenario...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Generate Scenario</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};
