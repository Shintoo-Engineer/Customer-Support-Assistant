import React, {
  useState,
  useEffect,
  useCallback,
} from "react";

import {
  LayoutDashboard,
  Headphones,
  Sparkles,
  BookOpen,
  GraduationCap,
} from "lucide-react";

import { Navbar } from "./components/Navbar";
import {
  Sidebar,
  ActiveTab,
} from "./components/Sidebar";

import { LiveConsoleView } from "./components/LiveConsole/LiveConsoleView";
import { ScenariosView } from "./components/ScenariosView";
import { KnowledgeBaseView } from "./components/KnowledgeBaseView";
import { ReplayModeView } from "./components/ReplayModeView";
import { ManualModeModal } from "./components/ManualModeModal";
import { PerformanceReportView } from "./components/PerformanceReportView";
import { TrainingPlansView } from "./components/TrainingPlansView";
import { TeamAnalyticsView } from "./components/TeamAnalyticsView";
import { AdminAuditView } from "./components/AdminAuditView";
import { SessionComparisonModal } from "./components/SessionComparisonModal";

import { LoginView } from "./components/LoginView";
import { UserManagementView } from "./components/UserManagementView";
import { PolicyManagementView } from "./components/PolicyManagementView";
import { AiAssistantView } from "./components/AiAssistantView";
import { AdminDashboardView } from "./components/AdminDashboardView";
import { EmployeeDashboardView } from "./components/EmployeeDashboardView";

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
  DifficultyLevel,
} from "./types";

import {
  INITIAL_SCENARIOS,
  INITIAL_KNOWLEDGE_DOCS,
  INITIAL_USER_PROFILE,
} from "./data/initialData";

import {
  fetchCurrentUserApi,
  logoutApi,
  startSimulatorApi,
  sendSimulatorMessageApi,
  analyzeCustomerMessageApi,
  getAnalysisSummaryApi,
  getAnalysisHistoryApi,
  getDecisionSupportApi,
  getSimulatorHistoryApi,
  fetchDocumentsApi,
} from "./services/api";

export default function App() {
  // =========================================================
  // AUTHENTICATION
  // =========================================================

  const [currentUser, setCurrentUser] =
    useState<UserAccount | null>(null);

  const [isAuthLoading, setIsAuthLoading] =
    useState(true);

  const safeUserRole: UserRole =
    currentUser?.role === "admin"
      ? "admin"
      : currentUser?.role === "customer"
      ? "customer"
      : "employee";

  // =========================================================
  // GLOBAL NAVIGATION
  // =========================================================

  const [activeTab, setActiveTab] =
    useState<ActiveTab>("dashboard");

  const [currentMode, setCurrentMode] =
    useState<InteractionMode>("simulator");

  const [userRole, setUserRole] =
    useState<UserRole>("employee");

  const [coachingLevel, setCoachingLevel] =
    useState<CoachingLevel>("beginner");

  const [piiMaskingEnabled, setPiiMaskingEnabled] =
    useState(true);

  const [activeLanguage, setActiveLanguage] =
    useState("English");

  const [isMobileMenuOpen, setIsMobileMenuOpen] =
    useState(false);

  // =========================================================
  // DATA
  // =========================================================

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
    useState("");

  const [isImprovingInput, setIsImprovingInput] =
    useState(false);

  const [sessionStartTime, setSessionStartTime] =
    useState<number>(Date.now());

  const [hasActiveSession, setHasActiveSession] =
    useState(false);

  // =========================================================
  // REAL BACKEND SESSION ID
  // =========================================================

  const [backendSessionId, setBackendSessionId] =
    useState<number | null>(null);

  // =========================================================
  // SESSION STATUS
  // =========================================================

  const [sessionResolved, setSessionResolved] =
    useState(false);

  const [sessionEscalated, setSessionEscalated] =
    useState(false);

  // =========================================================
  // ERROR / STATUS
  // =========================================================

  const [sessionError, setSessionError] =
    useState<string | null>(null);

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
  // LOAD CURRENT USER
  // =========================================================

  useEffect(() => {
    let mounted = true;

    const loadUser = async () => {
      try {
        const user =
          await fetchCurrentUserApi();

        if (!mounted) return;

        if (user) {
          setCurrentUser(
            user as UserAccount
          );

          const role =
            user.role === "admin"
              ? "admin"
              : user.role === "customer"
              ? "customer"
              : "employee";

          setUserRole(role);
        } else {
          setCurrentUser(null);
          setUserRole("employee");
        }
      } catch (error) {
        console.error(
          "Failed to load current user:",
          error
        );

        if (mounted) {
          setCurrentUser(null);
          setUserRole("employee");
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
  // LOAD KNOWLEDGE DOCUMENTS
  // =========================================================

  useEffect(() => {
    if (!currentUser) return;

    const loadDocuments = async () => {
      try {
        const response =
          await fetchDocumentsApi();

        if (
          response &&
          Array.isArray(
            response.documents
          )
        ) {
          console.log(
            "[CSA] Knowledge documents loaded:",
            response.documents.length
          );
        }
      } catch (error) {
        console.warn(
          "[CSA] Knowledge documents could not be loaded:",
          error
        );
      }
    };

    loadDocuments();
  }, [currentUser]);

  // =========================================================
  // LOGOUT
  // =========================================================

  const handleLogout = () => {
    logoutApi();

    setCurrentUser(null);
    setUserRole("employee");
    setActiveTab("dashboard");
    setCurrentMode("simulator");

    setHasActiveSession(false);
    setBackendSessionId(null);

    setMessages([]);
    setCurrentAnalysis(undefined);

    setSessionResolved(false);
    setSessionEscalated(false);
    setSessionError(null);

    setActiveReportSession(null);
  };

  // =========================================================
  // CONVERT BACKEND STATE TO FRONTEND STATE
  // =========================================================

  const mapCustomerState = (
    state: any,
    fallback?: any
  ) => {
    const source =
      state || fallback || {};

    return {
      frustration:
        Number(
          source.frustration ??
            source.frustration_level ??
            source.frustrationLevel ??
            0
        ),

      trust:
        Number(
          source.trust ??
            source.trust_level ??
            source.trustLevel ??
            50
        ),

      patience:
        Number(
          source.patience ??
            source.patience_level ??
            source.patienceLevel ??
            50
        ),

      satisfaction:
        Number(
          source.satisfaction ??
            source.satisfaction_level ??
            source.satisfactionLevel ??
            50
        ),

      escalationIntent:
        Number(
          source.escalationIntent ??
            source.escalation_intent ??
            0
        ),
    };
  };

  // =========================================================
  // CREATE CUSTOMER MESSAGE
  // =========================================================

  const createCustomerMessage = (
    text: string,
    state?: any,
    idSuffix = "customer"
  ): ChatMessage => {
    return {
      id:
        `msg-${Date.now()}-${idSuffix}`,

      sender: "customer",

      text,

      timestamp:
        new Date().toLocaleTimeString(
          [],
          {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }
        ),

      customerState:
        mapCustomerState(state),
    };
  };

  // =========================================================
  // CREATE AGENT MESSAGE
  // =========================================================

  const createAgentMessage = (
    text: string
  ): ChatMessage => {
    return {
      id:
        `msg-${Date.now()}-agent`,

      sender: "agent",

      text,

      timestamp:
        new Date().toLocaleTimeString(
          [],
          {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }
        ),
    };
  };

  // =========================================================
  // START REAL SIMULATOR SESSION
  // =========================================================

  const handleStartScenario =
    useCallback(
      async (
        scenario: Scenario
      ) => {
        if (!scenario) {
          console.error(
            "Cannot start scenario."
          );
          return;
        }

        setSessionError(null);
        setIsAnalyzing(true);

        try {
          // -------------------------------------------------
          // 1. CREATE REAL BACKEND SESSION
          // -------------------------------------------------

          const result =
            await startSimulatorApi({
              session_label:
                `${scenario.title} - ${
                  currentUser?.name ||
                  "Employee"
                }`,

              persona:
                scenario.customerPersona?.name ||
                "Customer",

              scenario:
                scenario.initialProblem ||
                scenario.title,

              initial_emotion:
                scenario.customerPersona?.type ||
                "neutral",

              issue_severity:
                Math.max(
                  1,
                  Math.min(
                    10,
                    Math.round(
                      (scenario.customerPersona
                        ?.baseFrustration ??
                        50) /
                        10
                    )
                  )
                ),

              patience_level:
                scenario.customerPersona
                  ?.patience ??
                50,

              expected_resolution:
                scenario.expectedResolution ||
                "",
            });

          // -------------------------------------------------
          // 2. STORE BACKEND SESSION ID
          // -------------------------------------------------

          setBackendSessionId(
            result.session_id
          );

          // Keep it inside active scenario too.
          const scenarioWithSession:
            Scenario = {
              ...scenario,
              backendSessionId:
                result.session_id,
              session_id:
                result.session_id,
              sessionId:
                result.session_id,
            };

          setActiveScenario(
            scenarioWithSession
          );

          // -------------------------------------------------
          // 3. CREATE FIRST CUSTOMER MESSAGE
          // -------------------------------------------------

          const openingText =
            result.customer_message ||
            scenario.customerOpeningMessage ||
            "Hello, I need help with an issue.";

          const openingMsg =
            createCustomerMessage(
              openingText,
              result.state,
              "opening"
            );

          setMessages([
            openingMsg,
          ]);

          setInputText("");

          setCurrentAnalysis(
            result.analysis as
              | MessageAnalysis
              | undefined
          );

          setSessionResolved(false);
          setSessionEscalated(false);

          setSessionStartTime(
            Date.now()
          );

          setHasActiveSession(true);

          setActiveTab(
            "live_console"
          );

          setCurrentMode(
            "simulator"
          );

          // -------------------------------------------------
          // 4. ANALYZE FIRST CUSTOMER MESSAGE
          // -------------------------------------------------

          try {
            const analysis =
              await analyzeCustomerMessageApi(
                result.session_id,
                openingText
              );

            setCurrentAnalysis(
              analysis as MessageAnalysis
            );
          } catch (analysisError) {
            console.warn(
              "Initial analysis failed:",
              analysisError
            );
          }
        } catch (error: any) {
          console.error(
            "Failed to start simulator:",
            error
          );

          setSessionError(
            error?.message ||
              "Unable to start simulator session."
          );

          setHasActiveSession(false);
          setBackendSessionId(null);
        } finally {
          setIsAnalyzing(false);
        }
      },
      [currentUser]
    );

  // =========================================================
  // SEND AGENT RESPONSE
  // =========================================================

  const handleSendMessage =
    async (
      text: string
    ) => {
      if (
        !text.trim() ||
        isSimulatingCustomer ||
        !backendSessionId
      ) {
        return;
      }

      const cleanText =
        text.trim();

      setSessionError(null);

      const agentMsg =
        createAgentMessage(
          cleanText
        );

      const updatedHistory = [
        ...messages,
        agentMsg,
      ];

      setMessages(
        updatedHistory
      );

      setInputText("");

      setIsSimulatingCustomer(
        true
      );

      try {
        // -------------------------------------------------
        // 1. SEND RESPONSE TO REAL CUSTOMER SIMULATOR
        // -------------------------------------------------

        const result =
          await sendSimulatorMessageApi(
            backendSessionId,
            cleanText
          );

        // -------------------------------------------------
        // 2. UPDATE SESSION STATUS
        // -------------------------------------------------

        setSessionResolved(
          Boolean(
            result.is_resolved
          )
        );

        setSessionEscalated(
          Boolean(
            result.is_escalated
          )
        );

        // -------------------------------------------------
        // 3. ADD CUSTOMER RESPONSE
        // -------------------------------------------------

        if (
          result.customer_message
        ) {
          const customerMsg =
            createCustomerMessage(
              result.customer_message,
              result.state,
              "response"
            );

          const fullHistory = [
            ...updatedHistory,
            customerMsg,
          ];

          setMessages(
            fullHistory
          );

          // ------------------------------------------------
          // 4. ANALYZE CUSTOMER MESSAGE
          // ------------------------------------------------

          setIsAnalyzing(true);

          try {
            const analysis =
              await analyzeCustomerMessageApi(
                backendSessionId,
                result.customer_message
              );

            setCurrentAnalysis(
              analysis as MessageAnalysis
            );
          } catch (analysisError) {
            console.warn(
              "Turn analysis failed:",
              analysisError
            );
          } finally {
            setIsAnalyzing(
              false
            );
          }
        }

        // -------------------------------------------------
        // 5. STOP IF RESOLVED / ESCALATED
        // -------------------------------------------------

        if (
          result.is_resolved ||
          result.is_escalated
        ) {
          console.log(
            "[CSA] Session status:",
            {
              resolved:
                result.is_resolved,

              escalated:
                result.is_escalated,
            }
          );
        }
      } catch (error: any) {
        console.error(
          "Error during simulator turn:",
          error
        );

        setSessionError(
          error?.message ||
            "Unable to process the customer response."
        );

        // Roll back optimistic agent message
        setMessages(
          messages
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
        const suggested =
          currentAnalysis
            ?.suggestedResponses
            ?.empathetic;

        if (suggested) {
          setInputText(
            suggested
          );
        } else if (
          currentAnalysis
            ?.suggestedResponses
            ?.professional
        ) {
          setInputText(
            currentAnalysis
              .suggestedResponses
              .professional
          );
        } else {
          setInputText(
            inputText.trim()
          );
        }
      } catch (error) {
        console.error(
          "AI improve error:",
          error
        );
      } finally {
        setIsImprovingInput(
          false
        );
      }
    };

  // =========================================================
  // FINISH SESSION
  // =========================================================

  const handleFinishSession =
    async () => {
      if (
        !backendSessionId ||
        !activeScenario
      ) {
        setSessionError(
          "No active backend session is available."
        );

        return;
      }

      setSessionError(null);
      setIsAnalyzing(true);

      try {
        // -------------------------------------------------
        // FETCH REAL BACKEND REPORT DATA
        // -------------------------------------------------

        const [
          summary,
          history,
          decisionSupport,
        ] = await Promise.all([
          getAnalysisSummaryApi(
            backendSessionId
          ),

          getAnalysisHistoryApi(
            backendSessionId
          ),

          getDecisionSupportApi(
            backendSessionId
          ),
        ]);

        const duration =
          Math.max(
            0,
            Math.round(
              (Date.now() -
                sessionStartTime) /
                1000
            )
          );

        // -------------------------------------------------
        // BUILD FRONTEND REPORT RECORD
        // -------------------------------------------------

        const summaryAny =
          summary as any;

        const overallScore =
          Number(
            summaryAny?.overall_score ??
              summaryAny?.overallScore ??
              summaryAny?.score ??
              0
          );

        const resolved =
          Boolean(
            summaryAny?.resolved ??
              sessionResolved
          );

        const escalated =
          Boolean(
            summaryAny?.escalated ??
              sessionEscalated
          );

        const newRecord:
          SessionRecord = {
            id:
              `backend-session-${backendSessionId}`,

            agentId:
              userProfile.id,

            agentName:
              currentUser?.name ||
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
              "completed",

            messages,

            score:
              {
                overall:
                  overallScore,

                intentHandling:
                  Number(
                    summaryAny?.intent_handling ??
                      summaryAny?.intentHandling ??
                      0
                  ),

                knowledgeUsage:
                  Number(
                    summaryAny?.knowledge_usage ??
                      summaryAny?.knowledgeUsage ??
                      0
                  ),

                empathy:
                  Number(
                    summaryAny?.empathy ??
                      0
                  ),

                tone:
                  Number(
                    summaryAny?.tone ??
                      0
                  ),

                clarity:
                  Number(
                    summaryAny?.clarity ??
                      0
                  ),

                resolution:
                  Number(
                    summaryAny?.resolution ??
                      0
                  ),

                escalationHandling:
                  Number(
                    summaryAny?.escalation_handling ??
                      summaryAny?.escalationHandling ??
                      0
                  ),

                policyCompliance:
                  Number(
                    summaryAny?.policy_compliance ??
                      summaryAny?.policyCompliance ??
                      0
                  ),

                resolutionQuality:
                  {
                    problemIdentification:
                      Number(
                        summaryAny?.problem_identification ??
                          0
                      ),

                    correctSolution:
                      Number(
                        summaryAny?.correct_solution ??
                          0
                      ),

                    knowledgeAccuracy:
                      Number(
                        summaryAny?.knowledge_accuracy ??
                          0
                      ),

                    customerSatisfaction:
                      Number(
                        summaryAny?.customer_satisfaction ??
                          0
                      ),

                    resolutionCompleteness:
                      Number(
                        summaryAny?.resolution_completeness ??
                          0
                      ),

                    overallQuality:
                      Number(
                        summaryAny?.overall_quality ??
                          overallScore
                      ),
                  },
              },

            startingSentiment:
              "neutral",

            endingSentiment:
              resolved
                ? "positive"
                : escalated
                ? "very_negative"
                : "neutral",

            sentimentImprovement:
              Number(
                summaryAny?.sentiment_improvement ??
                  0
              ),

            resolved,

            escalated,

            timelineEvents:
              [],

            topWeaknesses:
              Array.isArray(
                summaryAny?.top_weaknesses
              )
                ? summaryAny.top_weaknesses
                : [],

            topStrengths:
              Array.isArray(
                summaryAny?.top_strengths
              )
                ? summaryAny.top_strengths
                : [],

            recommendedTrainings:
              Array.isArray(
                summaryAny?.recommended_trainings
              )
                ? summaryAny.recommended_trainings
                : [],

            xpEarned:
              Number(
                summaryAny?.xp_earned ??
                  0
              ),

            responseComparisons:
              [],
          };

        // -------------------------------------------------
        // UPDATE LOCAL PROFILE
        // -------------------------------------------------

        setUserProfile(
          (previous) => {
            const previousCount =
              previous.totalSessions;

            const newScore =
              overallScore;

            const updatedAverage =
              previousCount === 0
                ? newScore
                : Math.round(
                    (
                      previous.averageScore *
                        previousCount +
                      newScore
                    ) /
                      (previousCount + 1)
                  );

            return {
              ...previous,

              xp:
                previous.xp +
                newRecord.xpEarned,

              totalSessions:
                previous.totalSessions +
                1,

              averageScore:
                updatedAverage,

              recentSessions:
                [
                  newRecord,
                  ...previous.recentSessions,
                ],
            };
          }
        );

        // -------------------------------------------------
        // OPEN REPORT
        // -------------------------------------------------

        setActiveReportSession(
          newRecord
        );

        setHasActiveSession(
          false
        );

        setActiveTab(
          "reports"
        );

        console.log(
          "[CSA] Session report:",
          {
            summary,
            history,
            decisionSupport,
          }
        );
      } catch (error: any) {
        console.error(
          "Failed to finish session:",
          error
        );

        setSessionError(
          error?.message ||
            "Unable to generate session report."
        );
      } finally {
        setIsAnalyzing(
          false
        );
      }
    };

  // =========================================================
  // RESTART SESSION
  // =========================================================

  const handleRestartSession =
    async () => {
      await handleStartScenario(
        activeScenario
      );
    };

  // =========================================================
  // MANUAL ANALYSIS
  // =========================================================

  const handleAnalyzeManualMessage =
    async (
      msg: string
    ): Promise<MessageAnalysis | null> => {
      if (!msg.trim()) {
        return null;
      }

      try {
        /*
         * The backend analysis endpoint requires a real
         * simulator session_id.
         *
         * If a live session exists, analyze against it.
         * Otherwise manual analysis cannot be sent to the
         * current backend contract.
         */

        if (!backendSessionId) {
          throw new Error(
            "Start a simulator session before using backend analysis."
          );
        }

        const result =
          await analyzeCustomerMessageApi(
            backendSessionId,
            msg
          );

        return result as MessageAnalysis;
      } catch (error) {
        console.error(
          "Manual message analysis failed:",
          error
        );

        return null;
      }
    };

  // =========================================================
  // AI SCENARIO GENERATION
  // =========================================================

  const handleGenerateAiScenario =
    async (
      _prompt: string,
      _category: string,
      _difficulty: DifficultyLevel
    ): Promise<Scenario | null> => {
      /*
       * No scenario-generation endpoint currently exists
       * in the FastAPI backend.
       *
       * Returning null prevents fake AI scenarios.
       */

      console.warn(
        "[CSA] AI scenario generation is not available in the current backend."
      );

      return null;
    };

  // =========================================================
  // AUTHORIZATION
  // =========================================================

  const isTabAuthorized =
    (
      role: UserRole,
      tab: ActiveTab
    ): boolean => {
      // Admin
      if (role === "admin") {
        return true;
      }

      // Customer only needs support functionality.
      if (role === "customer") {
        return [
          "dashboard",
          "ai_assistant",
        ].includes(tab);
      }

      // Employee
      if (role === "employee") {
        return ![
          "user_management",
          "policy_management",
          "team_analytics",
          "admin_audit",
        ].includes(tab);
      }

      return false;
    };

  // =========================================================
  // AUTH LOADING
  // =========================================================

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

  // =========================================================
  // LOGIN
  // =========================================================

  if (!currentUser) {
    return (
      <LoginView
        onLoginSuccess={(user) => {
          if (!user) {
            return;
          }

          setCurrentUser(
            user
          );

          const role =
            user.role === "admin"
              ? "admin"
              : user.role === "customer"
              ? "customer"
              : "employee";

          setUserRole(role);

          setActiveTab(
            "dashboard"
          );
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

      {/* =====================================================
          WORKSPACE
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
              tab === "manual_mode"
            ) {
              setIsManualModalOpen(
                true
              );
            } else {
              setActiveTab(
                tab
              );
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
            setIsMobileMenuOpen(
              false
            )
          }
        />

        {/* ===================================================
            MAIN CONTENT
        =================================================== */}

        <main className="flex-1 overflow-y-auto bg-slate-950/90 rounded-2xl">

          {/* SESSION ERROR */}
          {sessionError && (
            <div className="mx-4 mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
              <div className="font-semibold">
                Session error
              </div>

              <div className="text-xs mt-1 opacity-80">
                {sessionError}
              </div>

              <button
                onClick={() =>
                  setSessionError(
                    null
                  )
                }
                className="mt-2 text-xs underline"
              >
                Dismiss
              </button>
            </div>
          )}

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
                    "dashboard"
                  )
                }
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-500 transition"
              >
                Return to Dashboard
              </button>
            </div>
          ) : (
            <>
              {/* =================================================
                  DASHBOARD
              ================================================= */}

              {activeTab ===
                "dashboard" && (
                safeUserRole ===
                "admin" ? (
                  <AdminDashboardView
                    user={
                      currentUser
                    }
                  />
                ) : (
                  <EmployeeDashboardView
                    user={
                      currentUser
                    }
                    onOpenLiveConsole={() =>
                      setActiveTab(
                        "live_console"
                      )
                    }
                  />
                )
              )}

              {/* =================================================
                  USER MANAGEMENT
              ================================================= */}

              {activeTab ===
                "user_management" && (
                <UserManagementView />
              )}

              {/* =================================================
                  POLICY MANAGEMENT
              ================================================= */}

              {activeTab ===
                "policy_management" && (
                <PolicyManagementView />
              )}

              {/* =================================================
                  AI ASSISTANT
              ================================================= */}

              {activeTab ===
                "ai_assistant" && (
                <AiAssistantView
                  userRole={
                    safeUserRole
                  }
                  userName={
                    currentUser.name ??
                    "User"
                  }
                />
              )}

              {/* =================================================
                  LIVE CONSOLE
              ================================================= */}

              {activeTab ===
                "live_console" && (
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

                  onRestartSession={
                    handleRestartSession
                  }

                  onSelectAnotherScenario={() =>
                    setActiveTab(
                      "scenarios"
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
                      "ai_assistant"
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

              {activeTab ===
                "scenarios" && (
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

              {activeTab ===
                "knowledge_base" && (
                <KnowledgeBaseView />
              )}

              {/* =================================================
                  REPLAY
              ================================================= */}

              {activeTab ===
                "replay" && (
                <ReplayModeView />
              )}

              {/* =================================================
                  REPORTS
              ================================================= */}

              {activeTab ===
                "reports" &&
                activeReportSession && (
                  <PerformanceReportView
                    sessionRecord={
                      activeReportSession
                    }

                    scenario={
                      scenarios.find(
                        (scenario) =>
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
                        "dashboard"
                      )
                    }
                  />
                )}

              {/* =================================================
                  REPORT FALLBACK
              ================================================= */}

              {activeTab ===
                "reports" &&
                !activeReportSession &&
                userProfile
                  .recentSessions
                  .length >
                  0 && (
                  <PerformanceReportView
                    sessionRecord={
                      userProfile
                        .recentSessions[0]
                    }

                    scenario={
                      scenarios.find(
                        (scenario) =>
                          scenario.id ===
                          userProfile
                            .recentSessions[0]
                            .scenarioId
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
                        "dashboard"
                      )
                    }
                  />
                )}

              {/* =================================================
                  TRAINING PLANS
              ================================================= */}

              {activeTab ===
                "training_plans" && (
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

              {activeTab ===
                "team_analytics" && (
                <TeamAnalyticsView />
              )}

              {/* =================================================
                  ADMIN AUDIT
              ================================================= */}

              {activeTab ===
                "admin_audit" && (
                <AdminAuditView
                  piiMaskingEnabled={
                    piiMaskingEnabled
                  }

                  onTogglePiiMasking={() =>
                    setPiiMaskingEnabled(
                      (previous) =>
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
          MANUAL MODE
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

        {/* HOME */}

        <button
          id="mob-nav-dashboard"
          onClick={() => {
            setActiveTab(
              "dashboard"
            );

            setIsMobileMenuOpen(
              false
            );
          }}

          className={`flex flex-col items-center justify-center p-1.5 rounded-lg transition text-[10px] min-w-[56px] ${
            activeTab ===
            "dashboard"
              ? "text-indigo-400 font-bold"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <LayoutDashboard className="w-4 h-4 mb-0.5" />

          <span>
            Home
          </span>
        </button>

        {/* PRACTICE */}

        <button
          id="mob-nav-live-console"
          onClick={() => {
            setActiveTab(
              "live_console"
            );

            setIsMobileMenuOpen(
              false
            );
          }}

          className={`flex flex-col items-center justify-center p-1.5 rounded-lg transition text-[10px] min-w-[56px] relative ${
            activeTab ===
            "live_console"
              ? "text-indigo-400 font-bold"
              : "text-slate-400 hover:text-slate-200"
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
              "scenarios"
            );

            setIsMobileMenuOpen(
              false
            );
          }}

          className={`flex flex-col items-center justify-center p-1.5 rounded-lg transition text-[10px] min-w-[56px] ${
            activeTab ===
            "scenarios"
              ? "text-indigo-400 font-bold"
              : "text-slate-400 hover:text-slate-200"
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
              "training_plans"
            );

            setIsMobileMenuOpen(
              false
            );
          }}

          className={`flex flex-col items-center justify-center p-1.5 rounded-lg transition text-[10px] min-w-[56px] ${
            activeTab ===
            "training_plans"
              ? "text-indigo-400 font-bold"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <GraduationCap className="w-4 h-4 mb-0.5" />

          <span>
            Plans
          </span>
        </button>

        {/* KNOWLEDGE */}

        <button
          id="mob-nav-kb"
          onClick={() => {
            setActiveTab(
              "knowledge_base"
            );

            setIsMobileMenuOpen(
              false
            );
          }}

          className={`flex flex-col items-center justify-center p-1.5 rounded-lg transition text-[10px] min-w-[56px] ${
            activeTab ===
            "knowledge_base"
              ? "text-indigo-400 font-bold"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <BookOpen className="w-4 h-4 mb-0.5" />

          <span>
            Knowledge
          </span>
        </button>
      </nav>
    </div>
  );
}