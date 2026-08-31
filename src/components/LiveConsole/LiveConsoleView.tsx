import React, { useState, useEffect } from 'react';
import {
  Play,
  RotateCcw,
  CheckCircle,
  Clock,
  Sparkles,
  Sliders,
  AlertTriangle,
  Flame,
  Zap,
  ArrowRight,
  ShieldCheck,
  Award,
  MessageSquare,
  BrainCircuit,
  BookOpen,
  ChevronLeft
} from 'lucide-react';
import {
  Scenario,
  ChatMessage,
  MessageAnalysis,
  CoachingLevel,
  KnowledgeDocument
} from '../../types';
import { ConversationPanel } from './ConversationPanel';
import { CoachingPanel } from './CoachingPanel';
import { KnowledgeRiskPanel } from './KnowledgeRiskPanel';

interface LiveConsoleViewProps {
  scenario: Scenario;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  isSimulatingCustomer: boolean;
  analysis?: MessageAnalysis;
  isAnalyzing: boolean;
  coachingLevel: CoachingLevel;
  onFinishSession: () => void;
  onRestartSession: () => void;
  onSelectAnotherScenario: () => void;
  piiMaskingEnabled: boolean;
  onTriggerAiImprove: () => void;
  isImprovingInput: boolean;
  inputText: string;
  setInputText: (val: string) => void;
  onOpenFullKb?: (kbId: string) => void;
  knowledgeDocs: KnowledgeDocument[];
}

type MobileActiveTab = 'chat' | 'coaching' | 'knowledge';

export const LiveConsoleView: React.FC<LiveConsoleViewProps> = ({
  scenario,
  messages,
  onSendMessage,
  isSimulatingCustomer,
  analysis,
  isAnalyzing,
  coachingLevel,
  onFinishSession,
  onRestartSession,
  onSelectAnotherScenario,
  piiMaskingEnabled,
  onTriggerAiImprove,
  isImprovingInput,
  inputText,
  setInputText,
  onOpenFullKb,
  knowledgeDocs
}) => {
  const [seconds, setSeconds] = useState(0);
  const [isActiveTimer, setIsActiveTimer] = useState(true);
  const [mobileTab, setMobileTab] = useState<MobileActiveTab>('chat');

  // Timer counter
  useEffect(() => {
    let interval: any = null;
    if (isActiveTimer) {
      interval = setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActiveTimer]);

  const formatTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const agentTurnsCount = messages.filter((m) => m.sender === 'agent').length;

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
    <div className="flex flex-col h-[calc(100vh-4rem)] p-3 sm:p-5 lg:p-6 space-y-3 sm:space-y-4 max-w-[1600px] mx-auto overflow-hidden">
      
      {/* Top Session Control Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-md shrink-0">
        
        {/* Scenario Details & Switcher */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <button
            id="btn-switch-scenario"
            onClick={onSelectAnotherScenario}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 border border-slate-700 transition flex items-center gap-1 shrink-0"
            title="Choose a different scenario"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Change</span>
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <h2 className="font-bold text-xs sm:text-sm text-white tracking-tight truncate">{scenario.title}</h2>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getDifficultyBadge(scenario.difficulty)}`}>
                {scenario.difficulty}
              </span>
              <span className="hidden md:inline px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                {scenario.category}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400 truncate">
              Customer: <b className="text-slate-200">{scenario.customerPersona.name}</b> ({scenario.customerPersona.type})
            </p>
          </div>
        </div>

        {/* Center Session Metrics (Timer & Turn Counter) */}
        <div className="flex items-center justify-between sm:justify-center gap-3 bg-slate-850 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl border border-slate-800 text-xs">
          <div className="flex items-center gap-1.5 text-slate-300">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span className="font-mono font-bold text-white">{formatTime(seconds)}</span>
          </div>
          <div className="h-3.5 w-px bg-slate-700" />
          <div className="flex items-center gap-1.5 text-slate-300">
            <span>Turns:</span>
            <span className="font-bold text-white">{agentTurnsCount}/{scenario.targetResolutionTurns || 4}</span>
          </div>
          <div className="hidden sm:block h-3.5 w-px bg-slate-700" />
          <div className="hidden sm:flex items-center gap-1.5">
            <span className="text-slate-400">Target:</span>
            <span className="text-emerald-400 font-semibold">&lt;25% Frustration</span>
          </div>
        </div>

        {/* Right Session Action Buttons */}
        <div className="flex items-center gap-2 justify-end">
          
          <button
            id="btn-restart-session"
            onClick={onRestartSession}
            className="px-2.5 sm:px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 hover:text-white font-medium flex items-center gap-1.5 transition min-h-[38px]"
            title="Restart current scenario from the beginning"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Restart</span>
          </button>

          <button
            id="btn-finish-session-report"
            onClick={onFinishSession}
            className="px-3 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md flex items-center gap-1.5 sm:gap-2 transition ring-1 ring-white/20 min-h-[38px]"
          >
            <Award className="w-4 h-4 shrink-0" />
            <span>Finish Session</span>
          </button>

        </div>

      </div>

      {/* Mobile & Tablet Segmented Panel Switcher (< lg screens) */}
      <div className="lg:hidden flex items-center bg-slate-900 border border-slate-800 p-1 rounded-xl shrink-0 gap-1 text-xs">
        <button
          id="mobile-tab-chat"
          onClick={() => setMobileTab('chat')}
          className={`flex-1 py-2 px-2 rounded-lg font-medium flex items-center justify-center gap-1.5 transition ${
            mobileTab === 'chat'
              ? 'bg-indigo-600 text-white shadow-sm font-semibold'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Chat ({messages.length})</span>
        </button>

        <button
          id="mobile-tab-coaching"
          onClick={() => setMobileTab('coaching')}
          className={`flex-1 py-2 px-2 rounded-lg font-medium flex items-center justify-center gap-1.5 transition ${
            mobileTab === 'coaching'
              ? 'bg-indigo-600 text-white shadow-sm font-semibold'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <BrainCircuit className="w-3.5 h-3.5" />
          <span>AI Coach</span>
          {analysis && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          )}
        </button>

        <button
          id="mobile-tab-knowledge"
          onClick={() => setMobileTab('knowledge')}
          className={`flex-1 py-2 px-2 rounded-lg font-medium flex items-center justify-center gap-1.5 transition ${
            mobileTab === 'knowledge'
              ? 'bg-indigo-600 text-white shadow-sm font-semibold'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Knowledge & Risk</span>
          {analysis?.escalationRisk && (
            <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
              analysis.escalationRisk > 60 ? 'bg-rose-950 text-rose-300' : 'bg-slate-800 text-slate-300'
            }`}>
              {analysis.escalationRisk}%
            </span>
          )}
        </button>
      </div>

      {/* Main Panels Layout Container */}
      {/* Desktop (lg+): 3-column side-by-side grid */}
      {/* Mobile/Tablet (< lg): Active panel based on segmented switcher */}
      <div className="flex-1 min-h-0">
        
        {/* Desktop View (lg+) */}
        <div className="hidden lg:grid grid-cols-12 gap-4 h-full">
          {/* Panel 1: Live Conversation (5 Cols) */}
          <div className="lg:col-span-5 h-full">
            <ConversationPanel
              scenario={scenario}
              messages={messages}
              onSendMessage={onSendMessage}
              isSimulatingCustomer={isSimulatingCustomer}
              inputText={inputText}
              setInputText={setInputText}
              piiMaskingEnabled={piiMaskingEnabled}
              onTriggerAiImprove={onTriggerAiImprove}
              isImprovingInput={isImprovingInput}
              coachingLevel={coachingLevel}
            />
          </div>

          {/* Panel 2: Real-time AI Coaching (4 Cols) */}
          <div className="lg:col-span-4 h-full">
            <CoachingPanel
              analysis={analysis}
              onUseSuggestion={(text) => setInputText(text)}
              onGenerateAlternative={() => onSendMessage(inputText || 'generate alternatives')}
              isAnalyzing={isAnalyzing}
              coachingLevel={coachingLevel}
            />
          </div>

          {/* Panel 3: Knowledge & Risk Guard (3 Cols) */}
          <div className="lg:col-span-3 h-full">
            <KnowledgeRiskPanel
              analysis={analysis}
              coachingLevel={coachingLevel}
              onOpenFullKb={onOpenFullKb}
            />
          </div>
        </div>

        {/* Mobile & Tablet (< lg) Single Active Panel */}
        <div className="lg:hidden h-full">
          {mobileTab === 'chat' && (
            <div className="h-full">
              <ConversationPanel
                scenario={scenario}
                messages={messages}
                onSendMessage={onSendMessage}
                isSimulatingCustomer={isSimulatingCustomer}
                inputText={inputText}
                setInputText={setInputText}
                piiMaskingEnabled={piiMaskingEnabled}
                onTriggerAiImprove={onTriggerAiImprove}
                isImprovingInput={isImprovingInput}
                coachingLevel={coachingLevel}
              />
            </div>
          )}

          {mobileTab === 'coaching' && (
            <div className="h-full">
              <CoachingPanel
                analysis={analysis}
                onUseSuggestion={(text) => {
                  setInputText(text);
                  setMobileTab('chat');
                }}
                onGenerateAlternative={() => onSendMessage(inputText || 'generate alternatives')}
                isAnalyzing={isAnalyzing}
                coachingLevel={coachingLevel}
              />
            </div>
          )}

          {mobileTab === 'knowledge' && (
            <div className="h-full">
              <KnowledgeRiskPanel
                analysis={analysis}
                coachingLevel={coachingLevel}
                onOpenFullKb={onOpenFullKb}
              />
            </div>
          )}
        </div>

      </div>

    </div>
  );
};

