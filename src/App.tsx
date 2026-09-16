import React, { useState, useEffect, useCallback } from 'react';

import {
  LayoutDashboard,
  Headphones,
  Sparkles,
  BookOpen,
  GraduationCap
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

  // =========================================================
  // AUTHENTICATION
  // =========================================================

  const [currentUser, setCurrentUser] =
    useState<UserAccount | null>(null);

  const [isAuthLoading, setIsAuthLoading] =
    useState(true);

  // Always have a safe role value.
  // This prevents the UI from crashing if backend/demo
  // authentication temporarily returns an incomplete user.
  const safeUserRole: UserRole =
    currentUser?.role ?? 'employee';


  // =========================================================
  // GLOBAL NAVIGATION
  // =========================================================

  const [activeTab, setActiveTab] =
    useState<ActiveTab>('dashboard');

  const [currentMode, setCurrentMode] =
    useState<InteractionMode>('simulator');

  const [userRole, setUserRole] =
    useState<UserRole>('employee');

  const [coachingLevel, setCoachingLevel] =
    useState<CoachingLevel>('beginner');

  const [piiMaskingEnabled, setPiiMaskingEnabled] =
    useState(true);

  const [activeLanguage, setActiveLanguage] =
    useState('English');

  const [isMobileMenuOpen, setIsMobileMenuOpen] =
    useState(false);


  // =========================================================
  // CHECK EXISTING LOGIN SESSION
  // =========================================================

  useEffect(() => {

    let mounted = true;

    const loadUser = async () => {

      try {

        const user = await fetchCurrentUserApi();

        if (!mounted) return;

        if (user) {

          setCurrentUser(user);

          // Protect against undefined role.
          setUserRole(user.role ?? 'employee');

        } else {

          setCurrentUser(null);
          setUserRole('employee');

        }

      } catch (error) {

        console.error(
          'Failed to load current user:',
          error
        );

        if (mounted) {
          setCurrentUser(null);
          setUserRole('employee');
        }

      } finally {

        if (mounted) {
          setIsAuthLoading(false);
        }

      }
    };

    loadUser();

    return () => {
      mounted = false;
    };

  }, []);


  // =========================================================
  // LOGOUT
  // =========================================================

  const handleLogout = async () => {

    try {

      await logoutApi();

    } catch (error) {

      console.error(
        'Logout error:',
        error
      );

    } finally {

      setCurrentUser(null);
      setUserRole('employee');
      setActiveTab('dashboard');
      setCurrentMode('simulator');
      setHasActiveSession(false);
      setMessages([]);
      setCurrentAnalysis(undefined);
      setActiveReportSession(null);
    }

  };


  // =========================================================
  // DATA
  // =========================================================

  const [scenarios, setScenarios] =
    useState<Scenario[]>(INITIAL_SCENARIOS);

  const [knowledgeDocs, setKnowledgeDocs] =
    useState<KnowledgeDocument[]>(
      INITIAL_KNOWLEDGE_DOCS
    );

  const [userProfile, setUserProfile] =
    useState<AgentProfile>(
      INITIAL_USER_PROFILE
    );


  // =========================================================
  // ACTIVE SESSION
  // =========================================================

  const [activeScenario, setActiveScenario] =
    useState<Scenario>(
      INITIAL_SCENARIOS[0]
    );

  const [messages, setMessages] =
    useState<ChatMessage[]>([]);

  const [currentAnalysis, setCurrentAnalysis] =
    useState<MessageAnalysis | undefined>(
      undefined
    );

  const [isAnalyzing, setIsAnalyzing] =
    useState(false);

  const [isSimulatingCustomer, setIsSimulatingCustomer] =
    useState(false);

  const [inputText, setInputText] =
    useState('');

  const [isImprovingInput, setIsImprovingInput] =
    useState(false);

  const [sessionStartTime, setSessionStartTime] =
    useState<number>(Date.now());

  const [hasActiveSession, setHasActiveSession] =
    useState(false);


  // =========================================================
  // REPORT / MODALS
  // =========================================================

  const [activeReportSession, setActiveReportSession] =
    useState<SessionRecord | null>(null);

  const [comparisonPair, setComparisonPair] =
    useState<{
      s1: SessionRecord;
      s2: SessionRecord;
    } | null>(null);

  const [isManualModalOpen, setIsManualModalOpen] =
    useState(false);


  // =========================================================
  // START SCENARIO
  // =========================================================

  const handleStartScenario = useCallback(
    async (scenario: Scenario) => {

      if (!scenario) {
        console.error(
          'Cannot start scenario: scenario is undefined.'
        );
        return;
      }

      setActiveScenario(scenario);

      const openingMsg: ChatMessage = {

        id: `msg-${Date.now()}-cust-0`,

        sender: 'customer',

        text: scenario.customerOpeningMessage,

        timestamp:
          new Date().toLocaleTimeString(
            [],
            {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            }
          ),

        customerState: {

          frustration:
            scenario.customerPersona?.baseFrustration ?? 0,

          trust:
            scenario.customerPersona?.trust ?? 50,

          patience:
            scenario.customerPersona?.patience ?? 50,

          satisfaction:
            scenario.customerPersona?.satisfaction ?? 50,

          escalationIntent:
            scenario.customerPersona?.escalationIntent ?? 0

        }

      };

      setMessages([openingMsg]);

      setInputText('');

      setCurrentAnalysis(undefined);

      setSessionStartTime(Date.now());

      setHasActiveSession(true);

      setActiveTab('live_console');

      setCurrentMode('simulator');


      // =====================================================
      // INITIAL AI ANALYSIS
      // =====================================================

      setIsAnalyzing(true);

      try {

        const analysis =
          await analyzeTurnApi({

            customerMessage:
              scenario.customerOpeningMessage,

            conversationHistory:
              [openingMsg],

            scenario,

            knowledgeDocs

          });

        setCurrentAnalysis(analysis);

      } catch (error) {

        console.error(
          'Initial scenario analysis failed:',
          error
        );

      } finally {

        setIsAnalyzing(false);

      }

    },
    [knowledgeDocs]
  );


  // =========================================================
  // SEND AGENT MESSAGE
  // =========================================================

  const handleSendMessage =
    async (text: string) => {

      if (
        !text.trim() ||
        isSimulatingCustomer
      ) {
        return;
      }

      const cleanText =
        text.trim();

      const agentMsg: ChatMessage = {

        id:
          `msg-${Date.now()}-agent`,

        sender:
          'agent',

        text:
          cleanText,

        timestamp:
          new Date().toLocaleTimeString(
            [],
            {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            }
          )

      };

      const updatedHistory =
        [
          ...messages,
          agentMsg
        ];

      setMessages(updatedHistory);

      setInputText('');

      setIsSimulatingCustomer(true);


      try {

        const customerMessages =
          messages.filter(
            message =>
              message.sender === 'customer'
          );

        const lastCustomerMsg =
          customerMessages[
            customerMessages.length - 1
          ];


        // ===================================================
        // CUSTOMER SIMULATOR
        // ===================================================

        const simResult =
          await simulateCustomerTurnApi({

            scenario:
              activeScenario,

            conversationHistory:
              updatedHistory,

            agentResponse:
              cleanText,

            currentCustomerState:
              lastCustomerMsg?.customerState

          });


        if (
          !simResult ||
          !simResult.nextCustomerMessage
        ) {

          throw new Error(
            'Customer simulator returned an invalid response.'
          );

        }


        const nextCustMsg: ChatMessage = {

          id:
            `msg-${Date.now()}-cust`,

          sender:
            'customer',

          text:
            simResult.nextCustomerMessage,

          timestamp:
            new Date().toLocaleTimeString(
              [],
              {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
              }
            ),

          customerState:
            simResult.updatedCustomerState

        };


        const fullHistory =
          [
            ...updatedHistory,
            nextCustMsg
          ];

        setMessages(fullHistory);


        // ===================================================
        // AI ANALYSIS
        // ===================================================

        setIsAnalyzing(true);

        const analysis =
          await analyzeTurnApi({

            customerMessage:
              simResult.nextCustomerMessage,

            conversationHistory:
              fullHistory,

            scenario:
              activeScenario,

            lastAgentMessage:
              cleanText,

            knowledgeDocs

          });

        setCurrentAnalysis(analysis);


        // ===================================================
        // SESSION STATE
        // ===================================================

        if (
          simResult.isResolved ||
          simResult.isEscalated
        ) {

          console.log(
            'Session state:',
            {
              resolved:
                simResult.isResolved,

              escalated:
                simResult.isEscalated
            }
          );

        }

      } catch (error) {

        console.error(
          'Error during customer simulation:',
          error
        );

      } finally {

        setIsSimulatingCustomer(false);

        setIsAnalyzing(false);

      }

    };


  // =========================================================
  // AI IMPROVE RESPONSE
  // =========================================================

  const handleTriggerAiImprove =
    async () => {

      if (!inputText.trim()) {
        return;
      }

      setIsImprovingInput(true);

      try {

        if (
          currentAnalysis?.suggestedResponses?.empathetic
        ) {

          setInputText(
            currentAnalysis
              .suggestedResponses
              .empathetic
          );

        } else {

          setInputText(
            'I understand why this is frustrating, and I apologize for the inconvenience. Let me personally investigate this issue and resolve it for you right now.'
          );

        }

      } catch (error) {

        console.error(
          'AI improve error:',
          error
        );

      } finally {

        setIsImprovingInput(false);

      }

    };


  // =========================================================
  // FINISH SESSION
  // =========================================================

  const handleFinishSession =
    async () => {

      if (!activeScenario) {
        return;
      }

      try {

        const duration =
          Math.max(
            30,
            Math.round(
              (Date.now() -
                sessionStartTime) /
                1000
            )
          );


        const reportData =
          await generateReportApi({

            scenario:
              activeScenario,

            messages,

            durationSeconds:
              duration,

            coachingLevel

          });


        if (!reportData) {

          throw new Error(
            'Report generation returned no data.'
          );

        }


        const newRecord: SessionRecord = {

          id:
            `sess-${Date.now()
              .toString()
              .slice(-4)}`,

          agentId:
            userProfile.id,

          agentName:
            userProfile.name,

          scenarioId:
            activeScenario.id,

          scenarioTitle:
            activeScenario.title,

          mode:
            currentMode,

          coachingLevel,

          difficulty:
            activeScenario.difficulty,

          startTime:
            new Date(
              sessionStartTime
            ).toISOString(),

          endTime:
            new Date().toISOString(),

          durationSeconds:
            duration,

          status:
            'completed',

          messages,

          score:
            reportData.score,

          startingSentiment:
            reportData.startingSentiment,

          endingSentiment:
            reportData.endingSentiment,

          sentimentImprovement:
            reportData.sentimentImprovement,

          resolved:
            reportData.resolved,

          escalated:
            reportData.escalated,

          timelineEvents:
            reportData.timelineEvents,

          topStrengths:
            reportData.topStrengths,

          topWeaknesses:
            reportData.topWeaknesses,

          recommendedTrainings:
            reportData.recommendedTrainings,

          xpEarned:
            reportData.xpEarned,

          responseComparisons:
            reportData.responseComparisons

        };


        // ===================================================
        // UPDATE LOCAL PROFILE
        // ===================================================

        setUserProfile(prev => ({

          ...prev,

          xp:
            prev.xp +
            (reportData.xpEarned ?? 0),

          totalSessions:
            prev.totalSessions + 1,

          averageScore:
            Math.round(
              (
                prev.averageScore *
                  prev.totalSessions +
                (reportData.score?.overall ?? 0)
              ) /
                (prev.totalSessions + 1)
            ),

          recentSessions:
            [
              newRecord,
              ...prev.recentSessions
            ]

        }));


        setActiveReportSession(
          newRecord
        );

        setHasActiveSession(false);

        setActiveTab('reports');

      } catch (error) {

        console.error(
          'Failed to finish session:',
          error
        );

      }

    };


  // =========================================================
  // AI SCENARIO GENERATOR
  // =========================================================

  const handleGenerateAiScenario =
    async (
      prompt: string,
      category: string,
      difficulty: DifficultyLevel
    ): Promise<Scenario | null> => {

      try {

        return await generateScenarioApi({

          prompt,

          category,

          difficulty

        });

      } catch (error) {

        console.error(
          'Scenario generation failed:',
          error
        );

        return null;

      }

    };


  // =========================================================
  // MANUAL MESSAGE ANALYSIS
  // =========================================================

  const handleAnalyzeManualMessage =
    async (
      msg: string
    ): Promise<MessageAnalysis | null> => {

      try {

        return await analyzeTurnApi({

          customerMessage:
            msg,

          conversationHistory:
            [],

          scenario:
            activeScenario,

          knowledgeDocs

        });

      } catch (error) {

        console.error(
          'Manual message analysis failed:',
          error
        );

        return null;

      }

    };


  // =========================================================
  // ROLE AUTHORIZATION
  // =========================================================

  const isTabAuthorized =
    (
      role: UserRole,
      tab: ActiveTab
    ): boolean => {

      if (role === 'admin') {
        return true;
      }

      if (role === 'trainer') {

        return ![
          'user_management',
          'policy_management',
          'admin_audit'
        ].includes(tab);

      }

      if (role === 'employee') {

        return ![
          'user_management',
          'policy_management',
          'team_analytics',
          'admin_audit'
        ].includes(tab);

      }

      return false;

    };


  // =========================================================
  // AUTH LOADING SCREEN
  // =========================================================

  if (isAuthLoading) {

    return (

      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">

        <div className="text-center space-y-3">

          <div className="w-12 h-12 rounded-2xl bg-indigo-600 animate-pulse mx-auto flex items-center justify-center font-bold text-lg">

            CSA

          </div>

          <p className="text-xs text-slate-400">

            Loading system session & role permissions...

          </p>

        </div>

      </div>

    );

  }


  // =========================================================
  // LOGIN SCREEN
  // =========================================================

  if (!currentUser) {

    return (

      <LoginView

        onLoginSuccess={(user) => {

          if (!user) {
            return;
          }

          setCurrentUser(user);

          setUserRole(
            user.role ?? 'employee'
          );

          setActiveTab('dashboard');

        }}

      />

    );

  }


  // =========================================================
  // MAIN APPLICATION
  // =========================================================

  return (

    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">


      {/* =====================================================
          NAVBAR
      ===================================================== */}

      <Navbar

        currentMode={
          currentMode
        }

        onSelectMode={
          setCurrentMode
        }

        userRole={
          safeUserRole
        }

        onChangeRole={
          setUserRole
        }

        coachingLevel={
          coachingLevel
        }

        onChangeCoachingLevel={
          setCoachingLevel
        }

        userProfile={
          userProfile
        }

        piiMaskingEnabled={
          piiMaskingEnabled
        }

        onTogglePiiMasking={() =>
          setPiiMaskingEnabled(
            previous => !previous
          )
        }

        activeLanguage={
          activeLanguage
        }

        onChangeLanguage={
          setActiveLanguage
        }

        onOpenQuickManual={() =>
          setIsManualModalOpen(true)
        }

        isMobileMenuOpen={
          isMobileMenuOpen
        }

        onToggleMobileMenu={() =>
          setIsMobileMenuOpen(
            previous => !previous
          )
        }

        currentUser={
          currentUser
        }

        onLogout={
          handleLogout
        }

      />


      {/* =====================================================
          MAIN WORKSPACE
      ===================================================== */}

      <div className="flex-1 flex overflow-hidden max-w-7xl w-full mx-auto px-0 sm:px-4 lg:px-8 py-0 sm:py-4 gap-4">


        {/* ===================================================
            SIDEBAR
        =================================================== */}

        <Sidebar

          activeTab={
            activeTab
          }

          onSelectTab={(tab) => {

            if (
              tab === 'manual_mode'
            ) {

              setIsManualModalOpen(
                true
              );

            } else {

              setActiveTab(tab);

            }

            setIsMobileMenuOpen(
              false
            );

          }}

          userRole={
            safeUserRole
          }

          activeScenarioTitle={
            activeScenario?.title
          }

          hasActiveSession={
            hasActiveSession
          }

          isMobileOpen={
            isMobileMenuOpen
          }

          onCloseMobile={() =>
            setIsMobileMenuOpen(false)
          }

        />


        {/* ===================================================
            MAIN CONTENT
        =================================================== */}

        <main className="flex-1 overflow-y-auto bg-slate-950/90 rounded-2xl">

          {!isTabAuthorized(
            safeUserRole,
            activeTab
          ) ? (

            <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-2xl max-w-md mx-auto my-12 space-y-4 shadow-2xl">

              <div className="w-16 h-16 bg-rose-500/10 text-rose-400 rounded-2xl flex items-center justify-center mx-auto border border-rose-500/20 font-bold text-xl">

                403

              </div>

              <h2 className="text-xl font-bold text-white">

                Access Forbidden

              </h2>

              <p className="text-xs text-slate-400">

                Your account role (

                <b>
                  {String(
                    safeUserRole
                  ).toUpperCase()}
                </b>

                ) does not have permission to view this section.

              </p>

              <button

                onClick={() =>
                  setActiveTab(
                    'dashboard'
                  )
                }

                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-500 transition"

              >

                Return to Role Dashboard

              </button>

            </div>

          ) : (

            <>


              {/* =================================================
                  DASHBOARD
              ================================================= */}

              {activeTab === 'dashboard' && (

                safeUserRole === 'admin' ? (

                  <AdminDashboardView
                    user={currentUser}
                  />

                ) : safeUserRole === 'trainer' ? (

                  <TrainerDashboardView

                    user={
                      currentUser
                    }

                    onOpenLiveConsole={() =>
                      setActiveTab(
                        'live_console'
                      )
                    }

                    onOpenScenarios={() =>
                      setActiveTab(
                        'scenarios'
                      )
                    }

                  />

                ) : (

                  <EmployeeDashboardView

                    user={
                      currentUser
                    }

                    onOpenLiveConsole={() =>
                      setActiveTab(
                        'live_console'
                      )
                    }

                  />

                )

              )}


              {/* =================================================
                  USER MANAGEMENT
              ================================================= */}

              {activeTab === 'user_management' && (

                <UserManagementView />

              )}


              {/* =================================================
                  POLICY MANAGEMENT
              ================================================= */}

              {activeTab === 'policy_management' && (

                <PolicyManagementView />

              )}


              {/* =================================================
                  AI ASSISTANT
              ================================================= */}

              {activeTab === 'ai_assistant' && (

                <AiAssistantView

                  userRole={
                    safeUserRole
                  }

                  userName={
                    currentUser.name ?? 'User'
                  }

                />

              )}


              {/* =================================================
                  LIVE CONSOLE
              ================================================= */}

              {activeTab === 'live_console' && (

                <LiveConsoleView

                  scenario={
                    activeScenario
                  }

                  messages={
                    messages
                  }

                  onSendMessage={
                    handleSendMessage
                  }

                  isSimulatingCustomer={
                    isSimulatingCustomer
                  }

                  analysis={
                    currentAnalysis
                  }

                  isAnalyzing={
                    isAnalyzing
                  }

                  coachingLevel={
                    coachingLevel
                  }

                  onFinishSession={
                    handleFinishSession
                  }

                  onRestartSession={() =>
                    handleStartScenario(
                      activeScenario
                    )
                  }

                  onSelectAnotherScenario={() =>
                    setActiveTab(
                      'scenarios'
                    )
                  }

                  piiMaskingEnabled={
                    piiMaskingEnabled
                  }

                  onTriggerAiImprove={
                    handleTriggerAiImprove
                  }

                  isImprovingInput={
                    isImprovingInput
                  }

                  inputText={
                    inputText
                  }

                  setInputText={
                    setInputText
                  }

                  onOpenFullKb={() =>
                    setActiveTab(
                      'ai_assistant'
                    )
                  }

                  knowledgeDocs={
                    knowledgeDocs
                  }

                />

              )}


              {/* =================================================
                  SCENARIOS
              ================================================= */}

              {activeTab === 'scenarios' && (

                <ScenariosView

                  scenarios={
                    scenarios
                  }

                  onStartScenario={
                    handleStartScenario
                  }

                  onAddNewScenario={(
                    newScenario
                  ) => {

                    if (!newScenario) {
                      return;
                    }

                    setScenarios(
                      previous => [
                        newScenario,
                        ...previous
                      ]
                    );

                    handleStartScenario(
                      newScenario
                    );

                  }}

                  userRole={
                    safeUserRole
                  }

                  onGenerateAiScenario={
                    handleGenerateAiScenario
                  }

                />

              )}


              {/* =================================================
                  KNOWLEDGE BASE
              ================================================= */}

              {activeTab === 'knowledge_base' && (

                safeUserRole === 'admin' ? (

                  <PolicyManagementView />

                ) : (

                  <AiAssistantView

                    userRole={
                      safeUserRole
                    }

                    userName={
                      currentUser.name ?? 'User'
                    }

                  />

                )

              )}


              {/* =================================================
                  REPLAY
              ================================================= */}

              {activeTab === 'replay' && (

                <ReplayModeView />

              )}


              {/* =================================================
                  PERFORMANCE REPORT
              ================================================= */}

              {activeTab === 'reports' &&
                activeReportSession && (

                <PerformanceReportView

                  sessionRecord={
                    activeReportSession
                  }

                  scenario={
                    scenarios.find(
                      scenario =>
                        scenario.id ===
                        activeReportSession.scenarioId
                    ) ||
                    activeScenario
                  }

                  onPracticeAgain={() =>
                    handleStartScenario(
                      activeScenario
                    )
                  }

                  onGoToDashboard={() =>
                    setActiveTab(
                      'dashboard'
                    )
                  }

                />

              )}


              {activeTab === 'reports' &&
                !activeReportSession &&
                userProfile.recentSessions.length > 0 && (

                <PerformanceReportView

                  sessionRecord={
                    userProfile.recentSessions[0]
                  }

                  scenario={
                    scenarios.find(
                      scenario =>
                        scenario.id ===
                        userProfile.recentSessions[0].scenarioId
                    ) ||
                    activeScenario
                  }

                  onPracticeAgain={() =>
                    handleStartScenario(
                      activeScenario
                    )
                  }

                  onGoToDashboard={() =>
                    setActiveTab(
                      'dashboard'
                    )
                  }

                />

              )}


              {/* =================================================
                  TRAINING PLANS
              ================================================= */}

              {activeTab === 'training_plans' && (

                <TrainingPlansView

                  userProfile={
                    userProfile
                  }

                  scenarios={
                    scenarios
                  }

                  onStartScenario={
                    handleStartScenario
                  }

                />

              )}


              {/* =================================================
                  TEAM ANALYTICS
              ================================================= */}

              {activeTab === 'team_analytics' && (

                <TeamAnalyticsView />

              )}


              {/* =================================================
                  ADMIN AUDIT
              ================================================= */}

              {activeTab === 'admin_audit' && (

                <AdminAuditView

                  piiMaskingEnabled={
                    piiMaskingEnabled
                  }

                  onTogglePiiMasking={() =>
                    setPiiMaskingEnabled(
                      previous =>
                        !previous
                    )
                  }

                />

              )}

            </>

          )}

        </main>

      </div>


      {/* =======================================================
          MANUAL MODE MODAL
      ======================================================= */}

      <ManualModeModal

        isOpen={
          isManualModalOpen
        }

        onClose={() =>
          setIsManualModalOpen(
            false
          )
        }

        onAnalyzeMessage={
          handleAnalyzeManualMessage
        }

      />


      {/* =======================================================
          SESSION COMPARISON
      ======================================================= */}

      {comparisonPair && (

        <SessionComparisonModal

          session1={
            comparisonPair.s1
          }

          session2={
            comparisonPair.s2
          }

          onClose={() =>
            setComparisonPair(
              null
            )
          }

        />

      )}


      {/* =======================================================
          MOBILE NAVIGATION
      ======================================================= */}

      <nav

        aria-label="Mobile Navigation"

        className="sm:hidden bg-slate-900 border-t border-slate-800 px-2 py-1.5 flex items-center justify-around z-30 shrink-0 shadow-xl"

      >


        {/* DASHBOARD */}

        <button

          id="mob-nav-dashboard"

          onClick={() => {

            setActiveTab(
              'dashboard'
            );

            setIsMobileMenuOpen(
              false
            );

          }}

          className={`flex flex-col items-center justify-center p-1.5 rounded-lg transition text-[10px] min-w-[56px] ${
            activeTab === 'dashboard'
              ? 'text-indigo-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}

        >

          <LayoutDashboard className="w-4 h-4 mb-0.5" />

          <span>
            Home
          </span>

        </button>


        {/* LIVE CONSOLE */}

        <button

          id="mob-nav-live-console"

          onClick={() => {

            setActiveTab(
              'live_console'
            );

            setIsMobileMenuOpen(
              false
            );

          }}

          className={`flex flex-col items-center justify-center p-1.5 rounded-lg transition text-[10px] min-w-[56px] relative ${
            activeTab === 'live_console'
              ? 'text-indigo-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}

        >

          {hasActiveSession && (

            <span className="absolute top-1 right-3 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />

          )}

          <Headphones className="w-4 h-4 mb-0.5" />

          <span>
            Practice
          </span>

        </button>


        {/* SCENARIOS */}

        <button

          id="mob-nav-scenarios"

          onClick={() => {

            setActiveTab(
              'scenarios'
            );

            setIsMobileMenuOpen(
              false
            );

          }}

          className={`flex flex-col items-center justify-center p-1.5 rounded-lg transition text-[10px] min-w-[56px] ${
            activeTab === 'scenarios'
              ? 'text-indigo-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}

        >

          <Sparkles className="w-4 h-4 mb-0.5" />

          <span>
            Scenarios
          </span>

        </button>


        {/* TRAINING */}

        <button

          id="mob-nav-training"

          onClick={() => {

            setActiveTab(
              'training_plans'
            );

            setIsMobileMenuOpen(
              false
            );

          }}

          className={`flex flex-col items-center justify-center p-1.5 rounded-lg transition text-[10px] min-w-[56px] ${
            activeTab === 'training_plans'
              ? 'text-indigo-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}

        >

          <GraduationCap className="w-4 h-4 mb-0.5" />

          <span>
            Plans
          </span>

        </button>


        {/* KNOWLEDGE BASE */}

        <button

          id="mob-nav-kb"

          onClick={() => {

            setActiveTab(
              'knowledge_base'
            );

            setIsMobileMenuOpen(
              false
            );

          }}

          className={`flex flex-col items-center justify-center p-1.5 rounded-lg transition text-[10px] min-w-[56px] ${
            activeTab === 'knowledge_base'
              ? 'text-indigo-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}

        >

          <BookOpen className="w-4 h-4 mb-0.5" />

          <span>
            RAG KB
          </span>

        </button>

      </nav>

    </div>

  );

}