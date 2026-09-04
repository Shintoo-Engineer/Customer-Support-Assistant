import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard,
  Headphones,
  Sparkles,
  BookOpen,
  GraduationCap,
  BarChart3
} from 'lucide-react';
import { Navbar } from './components/Navbar';
import { Sidebar, ActiveTab } from './components/Sidebar';
import { LiveConsoleView } from './components/LiveConsole/LiveConsoleView';
import { ScenariosView } from './components/ScenariosView';
import { KnowledgeBaseView } from './components/KnowledgeBaseView';
import { ReplayModeView } from './components/ReplayModeView';
import { ManualModeModal } from './components/ManualModeModal';
import { PerformanceReportView } from './components/PerformanceReportView';
import { TrainingPlansView } from './components/TrainingPlansView';
import { LeaderboardView } from './components/LeaderboardView';
import { TeamAnalyticsView } from './components/TeamAnalyticsView';
import { AdminAuditView } from './components/AdminAuditView';
import { SessionComparisonModal } from './components/SessionComparisonModal';

import { LoginView } from './components/LoginView';
import { UserManagementView } from './components/UserManagementView';
import { PolicyManagementView } from './components/PolicyManagementView';
import { AiAssistantView } from './components/AiAssistantView';
import { AdminDashboardView } from './components/AdminDashboardView';
import { TrainerDashboardView } from './components/TrainerDashboardView';
import { EmployeeDashboardView } from './components/EmployeeDashboardView';

import {
  InteractionMode,
  UserRole,
  UserAccount,
  CoachingLevel,
  Scenario,
  ChatMessage,
  MessageAnalysis,
  SessionRecord,
  KnowledgeDocument,
  AgentProfile,
  DifficultyLevel
} from './types';

import {
  INITIAL_SCENARIOS,
  INITIAL_KNOWLEDGE_DOCS,
  INITIAL_USER_PROFILE
} from './data/initialData';

import {
  analyzeTurnApi,
  simulateCustomerTurnApi,
  generateScenarioApi,
  generateReportApi,
  fetchCurrentUserApi,
  logoutApi
} from './services/api';

export default function App() {
  // Authentication & Current User State
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Global Navigation & Session State
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [currentMode, setCurrentMode] = useState<InteractionMode>('simulator');
  const [userRole, setUserRole] = useState<UserRole>('employee');
  const [coachingLevel, setCoachingLevel] = useState<CoachingLevel>('beginner');
  const [piiMaskingEnabled, setPiiMaskingEnabled] = useState(true);
  const [activeLanguage, setActiveLanguage] = useState('English');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    fetchCurrentUserApi().then((user) => {
      if (user) {
        setCurrentUser(user);
        setUserRole(user.role);
      }
      setIsAuthLoading(false);
    }).catch(() => setIsAuthLoading(false));
  }, []);

  const handleLogout = async () => {
    await logoutApi();
    setCurrentUser(null);
    setActiveTab('dashboard');
  };

  // Datasets
  const [scenarios, setScenarios] = useState<Scenario[]>(INITIAL_SCENARIOS);
  const [knowledgeDocs, setKnowledgeDocs] = useState<KnowledgeDocument[]>(INITIAL_KNOWLEDGE_DOCS);
  const [userProfile, setUserProfile] = useState<AgentProfile>(INITIAL_USER_PROFILE);

  // Active Practice Simulation State
  const [activeScenario, setActiveScenario] = useState<Scenario>(INITIAL_SCENARIOS[0]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentAnalysis, setCurrentAnalysis] = useState<MessageAnalysis | undefined>(undefined);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSimulatingCustomer, setIsSimulatingCustomer] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isImprovingInput, setIsImprovingInput] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<number>(Date.now());
  const [hasActiveSession, setHasActiveSession] = useState(false);

  // Completed Report & Comparison State
  const [activeReportSession, setActiveReportSession] = useState<SessionRecord | null>(null);
  const [comparisonPair, setComparisonPair] = useState<{ s1: SessionRecord; s2: SessionRecord } | null>(null);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);

  // Initialize a new simulation scenario
  const handleStartScenario = useCallback((scenario: Scenario) => {
    setActiveScenario(scenario);
    const openingMsg: ChatMessage = {
      id: `msg-${Date.now()}-cust-0`,
      sender: 'customer',
      text: scenario.customerOpeningMessage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      customerState: {
        frustration: scenario.customerPersona.baseFrustration,
        trust: scenario.customerPersona.trust,
        patience: scenario.customerPersona.patience,
        satisfaction: scenario.customerPersona.satisfaction,
        escalationIntent: scenario.customerPersona.escalationIntent
      }
    };

    setMessages([openingMsg]);
    setInputText('');
    setSessionStartTime(Date.now());
    setHasActiveSession(true);
    setActiveTab('live_console');
    setCurrentMode('simulator');

    // Trigger initial turn analysis
    setIsAnalyzing(true);
    analyzeTurnApi({
      customerMessage: scenario.customerOpeningMessage,
      conversationHistory: [openingMsg],
      scenario,
      knowledgeDocs
    }).then((analysis) => {
      setCurrentAnalysis(analysis);
      setIsAnalyzing(false);
    }).catch(() => setIsAnalyzing(false));
  }, [knowledgeDocs]);

  // Handle agent sending a message in live console
  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isSimulatingCustomer) return;

    const agentMsg: ChatMessage = {
      id: `msg-${Date.now()}-agent`,
      sender: 'agent',
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };

    const updatedHistory = [...messages, agentMsg];
    setMessages(updatedHistory);
    setInputText('');

    // Simulate customer turn and emotional state transition
    setIsSimulatingCustomer(true);
    try {
      const lastCustomerMsg = messages.filter(m => m.sender === 'customer').slice(-1)[0];
      const simResult = await simulateCustomerTurnApi({
        scenario: activeScenario,
        conversationHistory: updatedHistory,
        agentResponse: text,
        currentCustomerState: lastCustomerMsg?.customerState
      });

      const nextCustMsg: ChatMessage = {
        id: `msg-${Date.now()}-cust`,
        sender: 'customer',
        text: simResult.nextCustomerMessage,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        customerState: simResult.updatedCustomerState
      };

      const fullHistory = [...updatedHistory, nextCustMsg];
      setMessages(fullHistory);

      // Trigger AI Coaching turn analysis on the new customer turn
      setIsAnalyzing(true);
      const analysis = await analyzeTurnApi({
        customerMessage: simResult.nextCustomerMessage,
        conversationHistory: fullHistory,
        scenario: activeScenario,
        lastAgentMessage: text,
        knowledgeDocs
      });
      setCurrentAnalysis(analysis);

      // If customer is satisfied/resolved or escalated, automatically show subtle prompt
      if (simResult.isResolved) {
        // Issue resolved
      }
    } catch (err) {
      console.error('Error during customer simulation turn:', err);
    } finally {
      setIsSimulatingCustomer(false);
      setIsAnalyzing(false);
    }
  };

  // AI Polish / Improve button
  const handleTriggerAiImprove = async () => {
    if (!inputText.trim()) return;
    setIsImprovingInput(true);
    try {
      if (currentAnalysis?.suggestedResponses?.empathetic) {
        setInputText(currentAnalysis.suggestedResponses.empathetic);
      } else {
        setInputText(`I understand why this is frustrating, and I apologize for the inconvenience. Let me personally investigate this issue and resolve it for you right now.`);
      }
    } finally {
      setIsImprovingInput(false);
    }
  };

  // Finish session & generate comprehensive AI report
  const handleFinishSession = async () => {
    const duration = Math.max(30, Math.round((Date.now() - sessionStartTime) / 1000));
    const reportData = await generateReportApi({
      scenario: activeScenario,
      messages,
      durationSeconds: duration,
      coachingLevel
    });

    const newRecord: SessionRecord = {
      id: `sess-${Date.now().toString().slice(-4)}`,
      agentId: userProfile.id,
      agentName: userProfile.name,
      scenarioId: activeScenario.id,
      scenarioTitle: activeScenario.title,
      mode: currentMode,
      coachingLevel,
      difficulty: activeScenario.difficulty,
      startTime: new Date(sessionStartTime).toISOString(),
      endTime: new Date().toISOString(),
      durationSeconds: duration,
      status: 'completed',
      messages,
      score: reportData.score,
      startingSentiment: reportData.startingSentiment,
      endingSentiment: reportData.endingSentiment,
      sentimentImprovement: reportData.sentimentImprovement,
      resolved: reportData.resolved,
      escalated: reportData.escalated,
      timelineEvents: reportData.timelineEvents,
      topStrengths: reportData.topStrengths,
      topWeaknesses: reportData.topWeaknesses,
      recommendedTrainings: reportData.recommendedTrainings,
      xpEarned: reportData.xpEarned,
      responseComparisons: reportData.responseComparisons
    };

    // Update user profile gamification stats
    setUserProfile(prev => ({
      ...prev,
      xp: prev.xp + reportData.xpEarned,
      totalSessions: prev.totalSessions + 1,
      averageScore: Math.round((prev.averageScore * prev.totalSessions + reportData.score.overall) / (prev.totalSessions + 1)),
      recentSessions: [newRecord, ...prev.recentSessions]
    }));

    setActiveReportSession(newRecord);
    setHasActiveSession(false);
    setActiveTab('reports');
  };

  // AI Scenario Generator API trigger
  const handleGenerateAiScenario = async (prompt: string, category: string, difficulty: DifficultyLevel): Promise<Scenario | null> => {
    return await generateScenarioApi({ prompt, category, difficulty });
  };

  // Manual Message Analysis API trigger
  const handleAnalyzeManualMessage = async (msg: string): Promise<MessageAnalysis | null> => {
    return await analyzeTurnApi({
      customerMessage: msg,
      conversationHistory: [],
      scenario: activeScenario,
      knowledgeDocs
    });
  };
  // Tab authorization check helper
  const isTabAuthorized = (role: UserRole, tab: ActiveTab): boolean => {
    if (role === 'admin') return true;
    if (role === 'trainer') {
      return !['user_management', 'policy_management', 'admin_audit'].includes(tab);
    }
    if (role === 'employee') {
      return !['user_management', 'policy_management', 'team_analytics', 'admin_audit'].includes(tab);
    }
    return false;
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 animate-pulse mx-auto flex items-center justify-center font-bold text-lg">
            CSA
          </div>
          <p className="text-xs text-slate-400">Loading system session & role permissions...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <LoginView
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setUserRole(user.role);
          setActiveTab('dashboard');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      
      {/* Top Application Header */}
      <Navbar
        currentMode={currentMode}
        onSelectMode={setCurrentMode}
        userRole={currentUser.role}
        onChangeRole={setUserRole}
        coachingLevel={coachingLevel}
        onChangeCoachingLevel={setCoachingLevel}
        userProfile={userProfile}
        piiMaskingEnabled={piiMaskingEnabled}
        onTogglePiiMasking={() => setPiiMaskingEnabled(!piiMaskingEnabled)}
        activeLanguage={activeLanguage}
        onChangeLanguage={setActiveLanguage}
        onOpenQuickManual={() => setIsManualModalOpen(true)}
        isMobileMenuOpen={isMobileMenuOpen}
        onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Main Workspace Layout (Sidebar + Stage) */}
      <div className="flex-1 flex overflow-hidden max-w-7xl w-full mx-auto px-0 sm:px-4 lg:px-8 py-0 sm:py-4 gap-4">
        
        {/* Left Vertical Navigation Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={(tab) => {
            if (tab === 'manual_mode') {
              setIsManualModalOpen(true);
            } else {
              setActiveTab(tab);
            }
            setIsMobileMenuOpen(false);
          }}
          userRole={currentUser.role}
          activeScenarioTitle={activeScenario?.title}
          hasActiveSession={hasActiveSession}
          isMobileOpen={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
        />

        {/* Center Main Stage Content */}
        <main className="flex-1 overflow-y-auto bg-slate-950/90 rounded-2xl">
          {!isTabAuthorized(currentUser.role, activeTab) ? (
            <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-2xl max-w-md mx-auto my-12 space-y-4 shadow-2xl">
              <div className="w-16 h-16 bg-rose-500/10 text-rose-400 rounded-2xl flex items-center justify-center mx-auto border border-rose-500/20 font-bold text-xl">
                403
              </div>
              <h2 className="text-xl font-bold text-white">Access Forbidden</h2>
              <p className="text-xs text-slate-400">
                Your account role (<b>{currentUser.role.toUpperCase()}</b>) does not have permission to view this section.
              </p>
              <button
                onClick={() => setActiveTab('dashboard')}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-500 transition"
              >
                Return to Role Dashboard
              </button>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                currentUser.role === 'admin' ? (
                  <AdminDashboardView user={currentUser} />
                ) : currentUser.role === 'trainer' ? (
                  <TrainerDashboardView
                    user={currentUser}
                    onOpenLiveConsole={() => setActiveTab('live_console')}
                    onOpenScenarios={() => setActiveTab('scenarios')}
                  />
                ) : (
                  <EmployeeDashboardView
                    user={currentUser}
                    onOpenLiveConsole={() => setActiveTab('live_console')}
                  />
                )
              )}

              {activeTab === 'user_management' && <UserManagementView />}

              {activeTab === 'policy_management' && <PolicyManagementView />}

              {activeTab === 'ai_assistant' && (
                <AiAssistantView userRole={currentUser.role} userName={currentUser.name} />
              )}

              {activeTab === 'live_console' && (
                <LiveConsoleView
                  scenario={activeScenario}
                  messages={messages}
                  onSendMessage={handleSendMessage}
                  isSimulatingCustomer={isSimulatingCustomer}
                  analysis={currentAnalysis}
                  isAnalyzing={isAnalyzing}
                  coachingLevel={coachingLevel}
                  onFinishSession={handleFinishSession}
                  onRestartSession={() => handleStartScenario(activeScenario)}
                  onSelectAnotherScenario={() => setActiveTab('scenarios')}
                  piiMaskingEnabled={piiMaskingEnabled}
                  onTriggerAiImprove={handleTriggerAiImprove}
                  isImprovingInput={isImprovingInput}
                  inputText={inputText}
                  setInputText={setInputText}
                  onOpenFullKb={() => setActiveTab('ai_assistant')}
                  knowledgeDocs={knowledgeDocs}
                />
              )}

              {activeTab === 'scenarios' && (
                <ScenariosView
                  scenarios={scenarios}
                  onStartScenario={handleStartScenario}
                  onAddNewScenario={(newScen) => {
                    setScenarios(prev => [newScen, ...prev]);
                    handleStartScenario(newScen);
                  }}
                  userRole={currentUser.role}
                  onGenerateAiScenario={handleGenerateAiScenario}
                />
              )}

              {activeTab === 'knowledge_base' && (
                currentUser.role === 'admin' ? (
                  <PolicyManagementView />
                ) : (
                  <AiAssistantView userRole={currentUser.role} userName={currentUser.name} />
                )
              )}

              {activeTab === 'replay' && <ReplayModeView />}

              {activeTab === 'reports' && activeReportSession && (
                <PerformanceReportView
                  sessionRecord={activeReportSession}
                  scenario={scenarios.find(s => s.id === activeReportSession.scenarioId) || activeScenario}
                  onPracticeAgain={() => handleStartScenario(activeScenario)}
                  onGoToDashboard={() => setActiveTab('dashboard')}
                />
              )}

              {activeTab === 'reports' && !activeReportSession && userProfile.recentSessions.length > 0 && (
                <PerformanceReportView
                  sessionRecord={userProfile.recentSessions[0]}
                  scenario={scenarios.find(s => s.id === userProfile.recentSessions[0].scenarioId) || activeScenario}
                  onPracticeAgain={() => handleStartScenario(activeScenario)}
                  onGoToDashboard={() => setActiveTab('dashboard')}
                />
              )}

              {activeTab === 'training_plans' && (
                <TrainingPlansView
                  userProfile={userProfile}
                  scenarios={scenarios}
                  onStartScenario={handleStartScenario}
                />
              )}

              {activeTab === 'team_analytics' && <TeamAnalyticsView />}

              {activeTab === 'admin_audit' && (
                <AdminAuditView
                  piiMaskingEnabled={piiMaskingEnabled}
                  onTogglePiiMasking={() => setPiiMaskingEnabled(!piiMaskingEnabled)}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Manual Mode Modal */}
      <ManualModeModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        onAnalyzeMessage={handleAnalyzeManualMessage}
      />

      {/* Session Comparison Modal */}
      {comparisonPair && (
        <SessionComparisonModal
          session1={comparisonPair.s1}
          session2={comparisonPair.s2}
          onClose={() => setComparisonPair(null)}
        />
      )}

      {/* Mobile Bottom Quick Navigation Bar (phones only) */}
      <nav aria-label="Mobile Navigation" className="sm:hidden bg-slate-900 border-t border-slate-800 px-2 py-1.5 flex items-center justify-around z-30 shrink-0 shadow-xl">
        <button
          id="mob-nav-dashboard"
          onClick={() => {
            setActiveTab('dashboard');
            setIsMobileMenuOpen(false);
          }}
          className={`flex flex-col items-center justify-center p-1.5 rounded-lg transition text-[10px] min-w-[56px] ${
            activeTab === 'dashboard' ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <LayoutDashboard className="w-4 h-4 mb-0.5" />
          <span>Home</span>
        </button>

        <button
          id="mob-nav-live-console"
          onClick={() => {
            setActiveTab('live_console');
            setIsMobileMenuOpen(false);
          }}
          className={`flex flex-col items-center justify-center p-1.5 rounded-lg transition text-[10px] min-w-[56px] relative ${
            activeTab === 'live_console' ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {hasActiveSession && (
            <span className="absolute top-1 right-3 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          )}
          <Headphones className="w-4 h-4 mb-0.5" />
          <span>Practice</span>
        </button>

        <button
          id="mob-nav-scenarios"
          onClick={() => {
            setActiveTab('scenarios');
            setIsMobileMenuOpen(false);
          }}
          className={`flex flex-col items-center justify-center p-1.5 rounded-lg transition text-[10px] min-w-[56px] ${
            activeTab === 'scenarios' ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-4 h-4 mb-0.5" />
          <span>Scenarios</span>
        </button>

        <button
          id="mob-nav-training"
          onClick={() => {
            setActiveTab('training_plans');
            setIsMobileMenuOpen(false);
          }}
          className={`flex flex-col items-center justify-center p-1.5 rounded-lg transition text-[10px] min-w-[56px] ${
            activeTab === 'training_plans' ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <GraduationCap className="w-4 h-4 mb-0.5" />
          <span>Plans</span>
        </button>

        <button
          id="mob-nav-kb"
          onClick={() => {
            setActiveTab('knowledge_base');
            setIsMobileMenuOpen(false);
          }}
          className={`flex flex-col items-center justify-center p-1.5 rounded-lg transition text-[10px] min-w-[56px] ${
            activeTab === 'knowledge_base' ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <BookOpen className="w-4 h-4 mb-0.5" />
          <span>RAG KB</span>
        </button>
      </nav>

    </div>
  );
}
