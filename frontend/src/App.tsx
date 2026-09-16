import React, {
  useState,
  useEffect,
  useCallback,
} from 'react';

import {
  LayoutDashboard,
  Headphones,
  Sparkles,
  BookOpen,
  BarChart3,
} from 'lucide-react';

import { Navbar } from './components/Navbar';

import {
  Sidebar,
  ActiveTab,
} from './components/Sidebar';

import {
  LiveConsoleView,
} from './components/LiveConsole/LiveConsoleView';

import {
  ScenariosView,
} from './components/ScenariosView';

import {
  KnowledgeBaseView,
} from './components/KnowledgeBaseView';

import {
  ReplayModeView,
} from './components/ReplayModeView';

import {
  ManualModeModal,
} from './components/ManualModeModal';

import {
  LoginView,
} from './components/LoginView';

import {
  PolicyManagementView,
} from './components/PolicyManagementView';

import {
  SimulatorSetupView,
} from './components/SimulatorSetupView';

import {
  InteractionMode,
  UserRole,
  UserAccount,
  CoachingLevel,
  Scenario,
  ChatMessage,
  MessageAnalysis,
  KnowledgeDocument,
  AgentProfile,
  DifficultyLevel,
} from './types';

import {
  INITIAL_SCENARIOS,
  INITIAL_KNOWLEDGE_DOCS,
  INITIAL_USER_PROFILE,
} from './data/initialData';

import {
  analyzeTurnApi,
  buildSimulatorAnalysis,
  simulateCustomerTurnApi,
  startSimulatorApi,
  generateScenarioApi,
  fetchCurrentUserApi,
  logoutApi,
} from './services/api';

export default function App() {
  // ============================================================
  // AUTHENTICATION
  // ============================================================

  const [currentUser, setCurrentUser] =
    useState<UserAccount | null>(null);

  const [isAuthLoading, setIsAuthLoading] =
    useState(true);

  const normalizeUserRole = (
    role: string
  ): UserRole => {
    const normalizedRole =
      role.trim().toLowerCase();

    if (normalizedRole === 'admin') {
      return 'admin' as UserRole;
    }

    if (normalizedRole === 'employee') {
      return 'employee' as UserRole;
    }

    return 'user' as UserRole;
  };

  const applyAuthenticatedUser = (
    user: UserAccount
  ) => {
    const normalizedRole =
      normalizeUserRole(
        String(user.role)
      );

    const normalizedUser = {
      ...user,
      role: normalizedRole,
    } as UserAccount;

    setCurrentUser(
      normalizedUser
    );

    setUserRole(
      normalizedRole
    );
  };

  // ============================================================
  // APPLICATION STATE
  // ============================================================

  const [activeTab, setActiveTab] =
    useState<ActiveTab>(
      'dashboard'
    );

  const [currentMode, setCurrentMode] =
    useState<InteractionMode>(
      'simulator'
    );

  const [userRole, setUserRole] =
    useState<UserRole>(
      'user' as UserRole
    );

  const [coachingLevel, setCoachingLevel] =
    useState<CoachingLevel>(
      'beginner'
    );

  const [piiMaskingEnabled, setPiiMaskingEnabled] =
    useState(true);

  const [activeLanguage, setActiveLanguage] =
    useState('English');

  const [isMobileMenuOpen, setIsMobileMenuOpen] =
    useState(false);

  // ============================================================
  // SIMULATOR CONFIGURATION
  // ============================================================

  const [simulatorConfig, setSimulatorConfig] =
    useState<{
      session_label: string;
      persona: string;
      initial_emotion: string;
      scenario: string;
      issue_severity: number;
      patience_level: number;
      expected_resolution: string;
    } | null>(null);

  // ============================================================
  // REAL BACKEND SIMULATOR SESSION
  // ============================================================

  const [simulatorSessionId, setSimulatorSessionId] =
    useState<string | null>(null);

  // ============================================================
  // AUTH SESSION RESTORE
  // ============================================================

  useEffect(() => {
    fetchCurrentUserApi()
      .then((user) => {
        if (user) {
          applyAuthenticatedUser(
            user
          );
        }

        setIsAuthLoading(
          false
        );
      })
      .catch(() => {
        setCurrentUser(null);

        setIsAuthLoading(
          false
        );
      });
  }, []);

  // ============================================================
  // LOGIN
  // ============================================================

  const handleLoginSuccess = (
    user: UserAccount
  ) => {
    applyAuthenticatedUser(
      user
    );

    setActiveTab(
      'dashboard'
    );

    setCurrentMode(
      'simulator'
    );

    setIsMobileMenuOpen(
      false
    );
  };

  // ============================================================
  // LOGOUT
  // ============================================================

  const handleLogout = async () => {
    await logoutApi();

    setCurrentUser(null);

    setActiveTab(
      'dashboard'
    );

    setCurrentMode(
      'simulator'
    );

    setIsMobileMenuOpen(
      false
    );

    setSimulatorConfig(
      null
    );

    setSimulatorSessionId(
      null
    );

    setMessages([]);

    setCurrentAnalysis(
      undefined
    );

    setHasActiveSession(
      false
    );
  };

  // ============================================================
  // DATA
  // ============================================================

  const [scenarios, setScenarios] =
    useState<Scenario[]>(
      INITIAL_SCENARIOS
    );

  const [knowledgeDocs, setKnowledgeDocs] =
    useState<KnowledgeDocument[]>(
      INITIAL_KNOWLEDGE_DOCS
    );

  const [userProfile, setUserProfile] =
    useState<AgentProfile>(
      INITIAL_USER_PROFILE
    );

  // ============================================================
  // ACTIVE SESSION
  // ============================================================

  const [activeScenario, setActiveScenario] =
    useState<Scenario>(
      INITIAL_SCENARIOS[0]
    );

  const [messages, setMessages] =
    useState<ChatMessage[]>(
      []
    );

  const [currentAnalysis, setCurrentAnalysis] =
    useState<
      MessageAnalysis | undefined
    >(undefined);

  const [isAnalyzing, setIsAnalyzing] =
    useState(false);

  const [isSimulatingCustomer, setIsSimulatingCustomer] =
    useState(false);

  const [inputText, setInputText] =
    useState('');

  const [isImprovingInput, setIsImprovingInput] =
    useState(false);

  const [sessionStartTime, setSessionStartTime] =
    useState<number>(
      Date.now()
    );

  const [hasActiveSession, setHasActiveSession] =
    useState(false);

  const [isManualModalOpen, setIsManualModalOpen] =
    useState(false);

  // ============================================================
  // START EXISTING SCENARIO SESSION
  // ============================================================

  const handleStartScenario = useCallback(
    (scenario: Scenario) => {
      setActiveScenario(
        scenario
      );

      const openingMsg: ChatMessage = {
        id: `msg-${Date.now()}-cust-0`,

        sender: 'customer',

        text:
          scenario.customerOpeningMessage,

        timestamp:
          new Date().toLocaleTimeString(
            [],
            {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }
          ),

        customerState: {
          frustration:
            scenario.customerPersona
              .baseFrustration,

          trust:
            scenario.customerPersona
              .trust,

          patience:
            scenario.customerPersona
              .patience,

          satisfaction:
            scenario.customerPersona
              .satisfaction,

          escalationIntent:
            scenario.customerPersona
              .escalationIntent,
        },
      };

      setMessages([
        openingMsg,
      ]);

      setInputText('');

      setSessionStartTime(
        Date.now()
      );

      setHasActiveSession(
        true
      );

      /*
       * This is the existing local scenario flow.
       * It does not create a backend simulator session.
       */
      setSimulatorSessionId(
        null
      );

      setActiveTab(
        'live_console'
      );

      setCurrentMode(
        'simulator'
      );

      setIsAnalyzing(
        true
      );

      analyzeTurnApi({
        customerMessage:
          scenario.customerOpeningMessage,

        conversationHistory: [
          openingMsg,
        ],

        scenario,

        knowledgeDocs,
      })
        .then((analysis) => {
          setCurrentAnalysis(
            analysis
          );
        })
        .catch((error) => {
          console.error(
            'Initial turn analysis failed:',
            error
          );
        })
        .finally(() => {
          setIsAnalyzing(
            false
          );
        });
    },
    [knowledgeDocs]
  );

  // ============================================================
  // START CONFIGURED REAL BACKEND SIMULATOR
  // ============================================================

  const handleStartConfiguredSimulation =
    async (
      config: {
        session_label?: string;
        persona: string;
        initial_emotion: string;
        scenario: string;
        issue_severity: number;
        patience_level: number;
        expected_resolution: string;
      }
    ) => {
      const backendConfig = {
        session_label:
          config.session_label ||
          `Simulator-${Date.now()}`,

        persona:
          config.persona,

        initial_emotion:
          config.initial_emotion,

        scenario:
          config.scenario,

        issue_severity:
          config.issue_severity,

        patience_level:
          config.patience_level,

        expected_resolution:
          config.expected_resolution,
      };

      setSimulatorConfig(
        backendConfig
      );

      setSimulatorSessionId(
        null
      );

      setMessages([]);

      setCurrentAnalysis(
        undefined
      );

      setIsSimulatingCustomer(
        true
      );

      setIsAnalyzing(
        false
      );

      try {
        /*
         * REAL BACKEND:
         *
         * POST /simulator/start
         */

        const result =
          await startSimulatorApi(
            backendConfig
          );

        console.log(
          'Simulator session started:',
          result
        );

        setSimulatorSessionId(
          result.session_id
        );

        /*
         * The actual backend response contains:
         *
         * customer_message
         * state.frustration
         * state.trust
         * state.patience
         * state.satisfaction
         * state.escalation_intent
         *
         * We use those values directly.
         */

        const openingMsg: ChatMessage = {
          id: `msg-${Date.now()}-cust-0`,

          sender: 'customer',

          text:
            result.customer_message,

          timestamp:
            new Date().toLocaleTimeString(
              [],
              {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              }
            ),

          customerState: {
            frustration:
              result.state.frustration,

            trust:
              result.state.trust,

            patience:
              result.state.patience,

            satisfaction:
              result.state.satisfaction,

            escalationIntent:
              result.state
                .escalation_intent,
          },
        };

        setMessages([
          openingMsg,
        ]);

        setInputText('');

        setSessionStartTime(
          Date.now()
        );

        setHasActiveSession(
          true
        );

        const matchedScenario =
          scenarios.find(
            (item) =>
              item.id
                .toLowerCase()
                .includes(
                  config.scenario
                    .toLowerCase()
                ) ||
              item.title
                .toLowerCase()
                .includes(
                  config.scenario
                    .toLowerCase()
                )
          );

        if (matchedScenario) {
          setActiveScenario(
            matchedScenario
          );
        }

        const scenarioForAnalysis =
          matchedScenario ||
          activeScenario;

        /*
         * IMPORTANT:
         *
         * We do NOT call:
         *
         * POST /api/analyze-turn
         *
         * because that endpoint does not exist
         * in the current backend Swagger.
         *
         * The simulator state itself is used to
         * populate the existing Live Analysis UI.
         */

        const analysis =
          buildSimulatorAnalysis({
            scenario:
              scenarioForAnalysis,

            state: {
              emotion:
                result.state.emotion,

              frustration:
                result.state.frustration,

              patience:
                result.state.patience,

              satisfaction:
                result.state.satisfaction,

              trust:
                result.state.trust,

              escalation_intent:
                result.state
                  .escalation_intent,
            },

            customerMessage:
              result.customer_message,
          });

        setCurrentAnalysis(
          analysis
        );

        setCurrentMode(
          'simulator'
        );

        setActiveTab(
          'live_console'
        );
      } catch (error) {
        console.error(
          'Failed to start simulator session:',
          error
        );

        const message =
          error instanceof Error
            ? error.message
            : 'Failed to start simulator session.';

        window.alert(
          message
        );
      } finally {
        setIsSimulatingCustomer(
          false
        );

        setIsAnalyzing(
          false
        );
      }
    };

  // ============================================================
  // LIVE CONVERSATION
  // ============================================================

  const handleSendMessage = async (
    text: string
  ) => {
    if (
      !text.trim() ||
      isSimulatingCustomer
    ) {
      return;
    }

    if (!simulatorSessionId) {
      console.error(
        'Cannot send simulator response: no active backend simulator session.'
      );

      window.alert(
        'The simulator session is not active. Please start a new simulation.'
      );

      return;
    }

    const trimmedText =
      text.trim();

    const agentMsg: ChatMessage = {
      id: `msg-${Date.now()}-agent`,

      sender: 'agent',

      text:
        trimmedText,

      timestamp:
        new Date().toLocaleTimeString(
          [],
          {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }
        ),
    };

    const updatedHistory = [
      ...messages,
      agentMsg,
    ];

    setMessages(
      updatedHistory
    );

    setInputText('');

    setIsSimulatingCustomer(
      true
    );

    try {
      /*
       * REAL BACKEND:
       *
       * POST /simulator/message
       *
       * {
       *   "session_id": 6,
       *   "agent_response": "..."
       * }
       *
       * This matches the current Swagger contract.
       */

      const simResult =
        await simulateCustomerTurnApi({
          sessionId:
            simulatorSessionId,

          agentResponse:
            trimmedText,
        });

      const nextCustMsg: ChatMessage = {
        id: `msg-${Date.now()}-cust`,

        sender: 'customer',

        text:
          simResult.customer_message,

        timestamp:
          new Date().toLocaleTimeString(
            [],
            {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }
          ),

        customerState: {
          frustration:
            simResult.state
              .frustration,

          trust:
            simResult.state
              .trust,

          patience:
            simResult.state
              .patience,

          satisfaction:
            simResult.state
              .satisfaction,

          escalationIntent:
            simResult.state
              .escalation_intent,
        },
      };

      const fullHistory = [
        ...updatedHistory,
        nextCustMsg,
      ];

      setMessages(
        fullHistory
      );

      /*
       * No /api/analyze-turn call here.
       *
       * /simulator/message already gives us
       * the updated simulator state.
       */

      const analysis =
        buildSimulatorAnalysis({
          scenario:
            activeScenario,

          state: {
            emotion:
              simResult.state
                .emotion,

            frustration:
              simResult.state
                .frustration,

            patience:
              simResult.state
                .patience,

            satisfaction:
              simResult.state
                .satisfaction,

            trust:
              simResult.state
                .trust,

            escalation_intent:
              simResult.state
                .escalation_intent,
          },

          customerMessage:
            simResult.customer_message,

          lastAgentMessage:
            trimmedText,
        });

      setCurrentAnalysis(
        analysis
      );

      /*
       * Backend session status.
       *
       * We do not fabricate another customer
       * message or make another API request.
       */

      if (
        simResult.is_resolved ||
        simResult.is_escalated
      ) {
        console.log(
          'Simulator session state:',
          {
            resolved:
              simResult.is_resolved,

            escalated:
              simResult.is_escalated,

            turn:
              simResult.turn,
          }
        );
      }
    } catch (error) {
      console.error(
        'Error during customer simulation turn:',
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : 'Failed to generate the next customer response.';

      window.alert(
        message
      );
    } finally {
      setIsSimulatingCustomer(
        false
      );

      setIsAnalyzing(
        false
      );
    }
  };

  // ============================================================
  // AI RESPONSE IMPROVEMENT
  // ============================================================

  const handleTriggerAiImprove =
    async () => {
      if (!inputText.trim()) {
        return;
      }

      setIsImprovingInput(
        true
      );

      try {
        if (
          currentAnalysis
            ?.suggestedResponses
            ?.empathetic
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
      } finally {
        setIsImprovingInput(
          false
        );
      }
    };

  // ============================================================
  // FINISH SESSION
  // ============================================================

  const handleFinishSession =
    async () => {
      setHasActiveSession(
        false
      );

      setSimulatorSessionId(
        null
      );

      setSimulatorConfig(
        null
      );

      setMessages([]);

      setCurrentAnalysis(
        undefined
      );

      setInputText('');

      setActiveTab(
        'dashboard'
      );
    };

  // ============================================================
  // AI SCENARIO GENERATION
  // ============================================================

  const handleGenerateAiScenario =
    async (
      prompt: string,
      category: string,
      difficulty: DifficultyLevel
    ): Promise<Scenario | null> => {
      return await generateScenarioApi({
        prompt,
        category,
        difficulty,
      });
    };

  // ============================================================
  // MANUAL MODE
  // ============================================================

  const handleAnalyzeManualMessage =
    async (
      msg: string
    ): Promise<MessageAnalysis | null> => {
      return await analyzeTurnApi({
        customerMessage:
          msg,

        conversationHistory:
          [],

        scenario:
          activeScenario,

        knowledgeDocs,
      });
    };

  // ============================================================
  // ROLE AUTHORIZATION
  // ============================================================

  const isTabAuthorized = (
    role: UserRole,
    tab: ActiveTab
  ): boolean => {
    const normalizedRole =
      String(role).toLowerCase();

    if (
      normalizedRole === 'admin'
    ) {
      return true;
    }

    if (
      normalizedRole === 'employee'
    ) {
      return [
        'dashboard',
        'simulator_setup',
        'live_console',
        'replay',
        'knowledge_base',
      ].includes(tab);
    }

    if (
      normalizedRole === 'user'
    ) {
      return [
        'dashboard',
        'simulator_setup',
        'live_console',
        'replay',
      ].includes(tab);
    }

    return false;
  };

  // ============================================================
  // MODE CARDS
  // ============================================================

  const renderModeCards = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      <button
        type="button"
        onClick={() => {
          setCurrentMode(
            'simulator'
          );

          setActiveTab(
            'simulator_setup'
          );

          setSimulatorConfig(
            null
          );

          setSimulatorSessionId(
            null
          );
        }}
        className="text-left p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500/50 transition"
      >
        <div className="w-11 h-11 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-5">
          <Headphones className="w-5 h-5" />
        </div>

        <h2 className="text-lg font-bold text-white">
          Simulator
        </h2>

        <p className="text-sm text-slate-400 mt-2">
          Practice with an AI-generated customer
          conversation.
        </p>

        <span className="inline-block mt-5 text-xs font-semibold text-indigo-400">
          Start Simulator →
        </span>
      </button>

      <button
        type="button"
        onClick={() => {
          setCurrentMode(
            'manual'
          );

          setIsManualModalOpen(
            true
          );
        }}
        className="text-left p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-emerald-500/50 transition"
      >
        <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-5">
          <Sparkles className="w-5 h-5" />
        </div>

        <h2 className="text-lg font-bold text-white">
          Manual Mode
        </h2>

        <p className="text-sm text-slate-400 mt-2">
          Enter a customer message and receive
          AI guidance.
        </p>

        <span className="inline-block mt-5 text-xs font-semibold text-emerald-400">
          Open Manual Mode →
        </span>
      </button>

      <button
        type="button"
        onClick={() => {
          setCurrentMode(
            'replay'
          );

          setActiveTab(
            'replay'
          );
        }}
        className="text-left p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-amber-500/50 transition"
      >
        <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-5">
          <BarChart3 className="w-5 h-5" />
        </div>

        <h2 className="text-lg font-bold text-white">
          Replay
        </h2>

        <p className="text-sm text-slate-400 mt-2">
          Review support conversations and coaching
          results.
        </p>

        <span className="inline-block mt-5 text-xs font-semibold text-amber-400">
          Open Replay →
        </span>
      </button>
    </div>
  );

  // ============================================================
  // LOADING
  // ============================================================

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 animate-pulse mx-auto flex items-center justify-center font-bold text-lg">
            CSA
          </div>

          <p className="text-xs text-slate-400">
            Loading system session...
          </p>
        </div>
      </div>
    );
  }

  // ============================================================
  // LOGIN
  // ============================================================

  if (!currentUser) {
    return (
      <LoginView
        onLoginSuccess={
          handleLoginSuccess
        }
      />
    );
  }

  const currentRole =
    String(
      currentUser.role
    ).toLowerCase();

  // ============================================================
  // MAIN APPLICATION
  // ============================================================

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      <Navbar
        currentMode={
          currentMode
        }
        onSelectMode={
          setCurrentMode
        }
        userRole={
          currentUser.role
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
            (previous) =>
              !previous
          )
        }
        activeLanguage={
          activeLanguage
        }
        onChangeLanguage={
          setActiveLanguage
        }
        onOpenQuickManual={() =>
          setIsManualModalOpen(
            true
          )
        }
        isMobileMenuOpen={
          isMobileMenuOpen
        }
        onToggleMobileMenu={() =>
          setIsMobileMenuOpen(
            (previous) =>
              !previous
          )
        }
        currentUser={
          currentUser
        }
        onLogout={
          handleLogout
        }
      />

      <div className="flex-1 flex overflow-hidden max-w-7xl w-full mx-auto px-0 sm:px-4 lg:px-8 py-0 sm:py-4 gap-4">
        {currentRole !== 'user' && (
          <Sidebar
            activeTab={
              activeTab
            }
            onSelectTab={(tab) => {
              if (
                tab ===
                'manual_mode'
              ) {
                setCurrentMode(
                  'manual'
                );

                setIsManualModalOpen(
                  true
                );
              } else {
                setActiveTab(
                  tab
                );

                if (
                  tab ===
                  'simulator_setup'
                ) {
                  setCurrentMode(
                    'simulator'
                  );
                }

                if (
                  tab ===
                  'replay'
                ) {
                  setCurrentMode(
                    'replay'
                  );
                }
              }

              setIsMobileMenuOpen(
                false
              );
            }}
            userRole={
              currentUser.role
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
              setIsMobileMenuOpen(
                false
              )
            }
          />
        )}

        <main className="flex-1 overflow-y-auto bg-slate-950/90 rounded-2xl">
          {!isTabAuthorized(
            currentUser.role,
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
                Your account does not have
                permission to view this section.
              </p>

              <button
                type="button"
                onClick={() =>
                  setActiveTab(
                    'dashboard'
                  )
                }
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-500 transition"
              >
                Return to Dashboard
              </button>
            </div>
          ) : (
            <>
              {activeTab ===
                'dashboard' && (
                <div className="p-6 sm:p-8 space-y-8">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-indigo-400 font-semibold">
                      Customer Support Assistant
                    </p>

                    <h1 className="text-3xl font-bold text-white mt-2">
                      Welcome,{' '}
                      {currentUser.name ||
                        currentUser.email}
                    </h1>

                    <p className="text-sm text-slate-400 mt-2">
                      Choose a support mode to
                      continue.
                    </p>
                  </div>

                  {renderModeCards()}

                  {currentRole ===
                    'employee' && (
                    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center shrink-0">
                          <BookOpen className="w-5 h-5" />
                        </div>

                        <div>
                          <h3 className="font-semibold text-white">
                            Knowledge Base
                            Access
                          </h3>

                          <p className="text-sm text-slate-400 mt-1">
                            You can read support
                            knowledge and policies.
                            Document management is
                            restricted to administrators.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {currentRole ===
                    'admin' && (
                    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
                          <BookOpen className="w-5 h-5" />
                        </div>

                        <div>
                          <h3 className="font-semibold text-white">
                            Knowledge Base
                            Management
                          </h3>

                          <p className="text-sm text-slate-400 mt-1">
                            You have full access to
                            knowledge documents,
                            uploads, management and
                            document history.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab ===
                'simulator_setup' && (
                <SimulatorSetupView
                  onBack={() =>
                    setActiveTab(
                      'dashboard'
                    )
                  }
                  onStartSimulation={
                    handleStartConfiguredSimulation
                  }
                />
              )}

              {activeTab ===
                'live_console' && (
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

                  onSelectAnotherScenario={() => {
                    setSimulatorSessionId(
                      null
                    );

                    setHasActiveSession(
                      false
                    );

                    setMessages(
                      []
                    );

                    setCurrentAnalysis(
                      undefined
                    );

                    setActiveTab(
                      'simulator_setup'
                    );
                  }}

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
                      'knowledge_base'
                    )
                  }

                  knowledgeDocs={
                    knowledgeDocs
                  }
                />
              )}

              {activeTab ===
                'scenarios' && (
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
                    setScenarios(
                      (previous) => [
                        newScenario,
                        ...previous,
                      ]
                    );

                    handleStartScenario(
                      newScenario
                    );
                  }}

                  userRole={
                    currentUser.role
                  }

                  onGenerateAiScenario={
                    handleGenerateAiScenario
                  }
                />
              )}

              {activeTab ===
                'knowledge_base' &&
                currentRole ===
                  'admin' && (
                  <PolicyManagementView />
                )}

              {activeTab ===
                'knowledge_base' &&
                currentRole ===
                  'employee' && (
                  <KnowledgeBaseView
                    documents={
                      knowledgeDocs
                    }
                  />
                )}

              {activeTab ===
                'replay' && (
                <ReplayModeView />
              )}
            </>
          )}
        </main>
      </div>

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

      {currentRole !==
        'user' && (
        <nav
          aria-label="Mobile Navigation"
          className="sm:hidden bg-slate-900 border-t border-slate-800 px-2 py-1.5 flex items-center justify-around z-30 shrink-0 shadow-xl"
        >
          <button
            type="button"
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
              activeTab ===
              'dashboard'
                ? 'text-indigo-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 mb-0.5" />

            <span>
              Home
            </span>
          </button>

          <button
            type="button"
            id="mob-nav-simulator"
            onClick={() => {
              setActiveTab(
                'simulator_setup'
              );

              setCurrentMode(
                'simulator'
              );

              setIsMobileMenuOpen(
                false
              );
            }}
            className={`flex flex-col items-center justify-center p-1.5 rounded-lg transition text-[10px] min-w-[56px] ${
              activeTab ===
              'simulator_setup'
                ? 'text-indigo-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Headphones className="w-4 h-4 mb-0.5" />

            <span>
              Simulator
            </span>
          </button>

          <button
            type="button"
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
              activeTab ===
              'live_console'
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

          <button
            type="button"
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
              activeTab ===
              'knowledge_base'
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
      )}
    </div>
  );
}