// ============================================================
// CUSTOMER SUPPORT ASSISTANT
// FRONTEND TYPE DEFINITIONS
// Aligned with FastAPI backend
// ============================================================

// ============================================================
// AUTHENTICATION & ROLES
// ============================================================

export type UserRole =
  | 'admin'
  | 'employee'
  | 'customer';

export type InteractionMode =
  | 'simulator'
  | 'manual'
  | 'replay';

export type CoachingLevel =
  | 'beginner'
  | 'intermediate'
  | 'advanced'
  | 'assessment';

export type DifficultyLevel =
  | 'easy'
  | 'medium'
  | 'hard'
  | 'expert';


// ============================================================
// BACKEND USER
// ============================================================

export interface BackendUser {
  user_id: number;
  name: string;
  email: string;
  role: UserRole;
}


// ============================================================
// FRONTEND USER ACCOUNT
// ============================================================

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: UserRole;

  status:
    | 'active'
    | 'inactive';

  createdAt: string;

  lastLogin?: string;
}


// ============================================================
// POLICY / DOCUMENT ACCESS
// ============================================================

/*
 * Backend currently supports:
 *
 * - admin
 * - employee
 * - customer
 *
 * The backend does NOT define trainer access.
 *
 * These levels are retained for compatibility with
 * existing UI components, but TRAINER is removed.
 */

export type PolicyAccessLevel =
  | 'PUBLIC'
  | 'EMPLOYEE'
  | 'ADMIN';


// ============================================================
// DOCUMENT TYPES
// ============================================================

export type BackendDocumentType =
  | 'policy'
  | 'faq'
  | 'support';

export type DocumentStatus =
  | 'active'
  | 'archived';


// ============================================================
// BACKEND DOCUMENT
// ============================================================

export interface BackendDocument {
  document_id: number;

  document_name: string;

  document_type:
    | 'policy'
    | 'faq'
    | 'support';

  version: number;

  status: string;

  filename: string;

  uploaded_by: string;
}


// ============================================================
// POLICY DOCUMENT - FRONTEND REPRESENTATION
// ============================================================

export interface PolicyDocument {
  id: string;

  filename: string;

  originalName: string;

  category:
    | 'HR'
    | 'IT'
    | 'Finance'
    | 'General'
    | 'Training'
    | 'Security'
    | 'Returns'
    | 'Refunds'
    | 'Shipping'
    | 'Warranty'
    | 'Privacy'
    | 'Billing'
    | 'Customer Service';

  accessLevel:
    | 'PUBLIC'
    | 'EMPLOYEE'
    | 'ADMIN';

  mimeType: string;

  size: number;

  uploadedBy: string;

  uploadedAt: string;

  status:
    | 'indexed'
    | 'processing'
    | 'failed'
    | 'inactive';

  version: number;

  isActive: boolean;

  chunkCount: number;

  summary?: string;

  extractedTextSnippet?: string;

  processingError?: string;
}


// ============================================================
// POLICY STATISTICS
// ============================================================

export interface PolicyStats {
  total: number;

  active: number;

  processing: number;

  failed: number;
}


// ============================================================
// POLICY CHUNK
// ============================================================

export interface PolicyChunk {
  id: string;

  documentId: string;

  documentTitle: string;

  category: string;

  accessLevel:
    | 'PUBLIC'
    | 'EMPLOYEE'
    | 'ADMIN';

  chunkText: string;

  chunkIndex: number;

  sectionTitle?: string;

  pageNumber?: number;
}


// ============================================================
// SENTIMENT
// ============================================================

export type SentimentType =
  | 'positive'
  | 'neutral'
  | 'negative'
  | 'very_negative';


// ============================================================
// EMOTION
// ============================================================

export type EmotionType =
  | 'Frustration'
  | 'Anger'
  | 'Confusion'
  | 'Anxiety'
  | 'Satisfaction'
  | 'Disappointment'
  | 'Urgency'
  | 'Relief';


// ============================================================
// ESCALATION
// ============================================================

export type EscalationLevel =
  | 'low'
  | 'moderate'
  | 'high'
  | 'critical';


// ============================================================
// CUSTOMER PERSONA
// ============================================================

export interface CustomerPersona {
  id: string;

  name: string;

  avatar: string;

  type:
    | 'Calm'
    | 'Confused'
    | 'Angry'
    | 'Impatient'
    | 'Professional'
    | 'First-time customer'
    | 'Technically knowledgeable'
    | 'Highly frustrated';

  behaviorDescription: string;

  baseFrustration: number;

  patience: number;

  trust: number;

  satisfaction: number;

  escalationIntent: number;
}


// ============================================================
// SCENARIO
// ============================================================

export interface Scenario {
  id: string;

  title: string;

  category:
    | 'Billing'
    | 'Account'
    | 'Product'
    | 'Delivery'
    | 'Subscription'
    | 'Technical'
    | 'Security';

  difficulty: DifficultyLevel;

  customerPersona: CustomerPersona;

  initialProblem: string;

  customerOpeningMessage: string;

  expectedResolution: string;

  escalationTrigger: string;

  successCriteria: string[];

  sessionObjectives: string;

  relevantKbIds: string[];

  targetResolutionTurns: number;

  /*
   * Backend simulator session.
   *
   * These fields are intentionally optional because
   * a scenario does not have a backend session until
   * /simulator/start is called.
   */

  backendSessionId?: number;

  session_id?: number;

  sessionId?: number;
}


// ============================================================
// BACKEND SIMULATOR STATE
// ============================================================

export interface SimulatorCustomerState {
  frustration: number;

  trust: number;

  patience: number;

  satisfaction: number;

  escalation_intent: number;

  /*
   * Some backend responses may use camelCase.
   * Keep optional compatibility fields.
   */

  escalationIntent?: number;
}


// ============================================================
// SIMULATOR START RESPONSE
// ============================================================

export interface SimulatorStartResponse {
  session_id: number;

  conversation_id: number;

  customer_message: string;

  state: SimulatorCustomerState;

  turn: number;

  analysis?: unknown;
}


// ============================================================
// SIMULATOR MESSAGE RESPONSE
// ============================================================

export interface SimulatorMessageResponse {
  session_id: number;

  customer_message: string;

  state: SimulatorCustomerState;

  turn: number;

  is_resolved: boolean;

  is_escalated: boolean;

  analysis?: unknown;
}


// ============================================================
// SIMULATOR HISTORY MESSAGE
// ============================================================

export interface SimulatorHistoryMessage {
  message_id: number;

  sender_type: string;

  message_text: string;

  message_type: string;

  timestamp: string;
}


// ============================================================
// SIMULATOR HISTORY
// ============================================================

export interface SimulatorHistoryResponse {
  session_id: number;

  status: string;

  messages: SimulatorHistoryMessage[];
}


// ============================================================
// MESSAGE ANALYSIS
// ============================================================

export interface MessageAnalysis {
  intent: string;

  intentConfidence: number;

  sentiment: SentimentType;

  sentimentConfidence: number;

  frustrationLevel: number;

  frustrationTrend:
    | 'increasing'
    | 'decreasing'
    | 'stable';

  emotions: EmotionType[];

  // ==========================================================
  // RAG KNOWLEDGE
  // ==========================================================

  relevantKnowledge?: {
    kbId: string;

    title: string;

    relevantSection: string;

    policySnippet: string;

    source: string;

    confidence: number;

    troubleshootingSteps: string[];

    isVerified: boolean;
  };

  // ==========================================================
  // ESCALATION
  // ==========================================================

  escalationRisk: number;

  escalationLevel: EscalationLevel;

  riskReasons: string[];

  recommendedIntervention: string;

  // ==========================================================
  // REAL-TIME COACHING
  // ==========================================================

  coachWhisper?: string;

  alertType?:
    | 'info'
    | 'warning'
    | 'critical';

  // ==========================================================
  // SUGGESTED RESPONSES
  // ==========================================================

  suggestedResponses: {
    quick: string;

    professional: string;

    empathetic: string;

    concise: string;

    detailed: string;

    deEscalation: string;
  };

  // ==========================================================
  // REASONING
  // ==========================================================

  whyReasons: string[];

  // ==========================================================
  // COUNTERFACTUAL
  // ==========================================================

  counterfactual?: {
    alternativeResponse: string;

    predictedRiskDrop: number;

    reasoning: string;
  };

  // ==========================================================
  // AGENT EVALUATION
  // ==========================================================

  agentEvaluation?: {
    tone:
      | 'Polite'
      | 'Empathetic'
      | 'Professional'
      | 'Robotic'
      | 'Defensive'
      | 'Dismissive';

    empathyScore: number;

    clarityScore: number;

    concisenessScore: number;

    grammarScore: number;

    policyComplianceScore: number;

    problemNoticed?: string;

    coachingAdvice?: string;
  };
}


// ============================================================
// CHAT MESSAGE
// ============================================================

export interface ChatMessage {
  id: string;

  sender:
    | 'customer'
    | 'agent'
    | 'system';

  text: string;

  originalText?: string;

  timestamp: string;

  analysis?: MessageAnalysis;

  customerState?: {
    frustration: number;

    trust: number;

    patience: number;

    satisfaction: number;

    escalationIntent: number;
  };
}


// ============================================================
// BACKEND CHAT MESSAGE
// ============================================================

export interface BackendChatMessage {
  id: number;

  user_message: string;

  assistant_message: string;

  created_at: string;
}


// ============================================================
// BACKEND CHAT HISTORY
// ============================================================

export interface BackendChatHistory {
  session_id: string;

  messages: BackendChatMessage[];
}


// ============================================================
// KNOWLEDGE DOCUMENT
// ============================================================

export interface KnowledgeDocument {
  id: string;

  title: string;

  category:
    | 'Policies'
    | 'Billing'
    | 'Shipping'
    | 'Technical'
    | 'Product'
    | 'Security';

  updatedAt: string;

  chunkCount: number;

  embeddingCount: number;

  status:
    | 'indexed'
    | 'updating'
    | 'warning';

  summary: string;

  content: string;

  citationsCount: number;

  conflictWarning?: string;
}


// ============================================================
// RAG SOURCE
// ============================================================

export interface RAGSource {
  chunk_id?: string;

  text?: string;

  metadata?: Record<string, unknown>;

  distance?: number;

  title?: string;

  source?: string;
}


// ============================================================
// RAG RESPONSE
// ============================================================

export interface RAGResponse {
  question: string;

  answer: string;

  sources: RAGSource[];
}


// ============================================================
// SEMANTIC SEARCH RESULT
// ============================================================

export interface SearchResult {
  chunk_id: string;

  text: string;

  metadata: Record<string, unknown>;

  distance: number;
}


// ============================================================
// SEMANTIC SEARCH RESPONSE
// ============================================================

export interface SearchResponse {
  query: string;

  results: SearchResult[];
}


// ============================================================
// PERFORMANCE SCORE
// ============================================================

export interface PerformanceScore {
  overall: number;

  intentHandling: number;

  knowledgeUsage: number;

  empathy: number;

  tone: number;

  clarity: number;

  resolution: number;

  escalationHandling: number;

  policyCompliance: number;

  resolutionQuality: {
    problemIdentification: number;

    correctSolution: number;

    knowledgeAccuracy: number;

    customerSatisfaction: number;

    resolutionCompleteness: number;

    overallQuality: number;
  };
}


// ============================================================
// COACHING TIMELINE
// ============================================================

export interface CoachingTimelineEvent {
  turn: number;

  timestamp: string;

  type:
    | 'sentiment_shift'
    | 'kb_retrieved'
    | 'risk_spike'
    | 'empathy_bonus'
    | 'policy_check'
    | 'resolution_milestone';

  description: string;

  severity:
    | 'normal'
    | 'positive'
    | 'warning'
    | 'critical';
}


// ============================================================
// SESSION RECORD
// ============================================================

export interface SessionRecord {
  id: string;

  /*
   * Backend simulator session ID.
   */
  backendSessionId?: number;

  agentName: string;

  agentId: string;

  scenarioId: string;

  scenarioTitle: string;

  mode: InteractionMode;

  coachingLevel: CoachingLevel;

  difficulty: DifficultyLevel;

  startTime: string;

  endTime?: string;

  durationSeconds: number;

  status:
    | 'active'
    | 'completed'
    | 'abandoned';

  messages: ChatMessage[];

  score?: PerformanceScore;

  startingSentiment: SentimentType;

  endingSentiment: SentimentType;

  sentimentImprovement: number;

  resolved: boolean;

  escalated: boolean;

  timelineEvents: CoachingTimelineEvent[];

  topWeaknesses: string[];

  topStrengths: string[];

  recommendedTrainings: string[];

  xpEarned: number;

  responseComparisons: {
    turnNumber: number;

    originalAgentText: string;

    aiImprovedText: string;

    improvementExplanation: string;
  }[];
}


// ============================================================
// AGENT PROFILE
// ============================================================

export interface AgentProfile {
  id: string;

  name: string;

  email: string;

  role: UserRole;

  avatar: string;

  level: number;

  xp: number;

  xpToNextLevel: number;

  streakDays: number;

  totalSessions: number;

  averageScore: number;

  resolutionRate: number;

  avgCsat: number;

  escalationRate: number;

  avgResponseQuality: number;

  skills: {
    communication: number;

    empathy: number;

    knowledge: number;

    problemSolving: number;

    deEscalation: number;

    policyCompliance: number;
  };

  badges: Badge[];

  recentSessions: SessionRecord[];
}


// ============================================================
// BADGE
// ============================================================

export interface Badge {
  id: string;

  name: string;

  description: string;

  icon: string;

  category:
    | 'resolution'
    | 'knowledge'
    | 'empathy'
    | 'streak'
    | 'mastery';

  unlockedAt?: string;

  progress?: number;

  maxProgress?: number;
}


// ============================================================
// LEADERBOARD
// ============================================================

export interface LeaderboardEntry {
  rank: number;

  agentId: string;

  agentName: string;

  avatar: string;

  score: number;

  sessionsCompleted: number;

  resolutionRate: number;

  escalationRate: number;

  streakDays: number;

  tier:
    | 'Diamond'
    | 'Platinum'
    | 'Gold'
    | 'Silver';
}


// ============================================================
// AUDIT LOG
// ============================================================

export interface AuditLogEntry {
  id: string;

  timestamp: string;

  userName: string;

  userEmail?: string;

  userRole?: UserRole;

  action: string;

  category:
    | 'auth'
    | 'session'
    | 'knowledge'
    | 'scenario'
    | 'report'
    | 'system'
    | 'policy'
    | 'user';

  details: string;

  resource?: string;
}


// ============================================================
// TRAINING PLAN
// ============================================================

export interface TrainingPlanWeek {
  weekNumber: number;

  title: string;

  focusArea: string;

  assignedScenarios: string[];

  completedScenarios: string[];

  status:
    | 'current'
    | 'upcoming'
    | 'completed';

  targetScore: number;
}


// ============================================================
// BACKEND USER MANAGEMENT
// ============================================================

export interface AdminUser {
  user_id: number;

  name: string;

  email: string;

  role:
    | 'admin'
    | 'employee'
    | 'customer';

  is_active: boolean;

  created_at: string;
}


// ============================================================
// CREATE ADMIN / EMPLOYEE
// ============================================================

export interface CreateUserRequest {
  name: string;

  email: string;

  password: string;

  role:
    | 'admin'
    | 'employee';
}


// ============================================================
// SUPPORT REQUEST
// ============================================================

export interface SupportRequest {
  issue_type: string;

  message: string;
}


// ============================================================
// SUPPORT RESPONSE
// ============================================================

export interface SupportResponse {
  status: string;

  issue_type: string;

  support_response: string;
}


// ============================================================
// ANALYSIS API TYPES
// ============================================================

export interface AnalysisRequest {
  session_id: number;

  customer_message: string;
}


// ============================================================
// ANALYSIS SUMMARY
//
// The exact backend schema can evolve, so fields that are
// likely to be derived are optional.
// ============================================================

export interface SessionAnalysisSummary {
  session_id?: number;

  total_turns?: number;

  average_frustration?: number;

  starting_sentiment?: string;

  ending_sentiment?: string;

  sentiment_trend?: string;

  escalation_risk?: number;

  escalation_level?: EscalationLevel;

  resolved?: boolean;

  escalated?: boolean;

  [key: string]: unknown;
}


// ============================================================
// DECISION SUPPORT
// ============================================================

export interface DecisionSupportResult {
  session_id?: number;

  recommendation?: string;

  recommended_action?: string;

  escalation_required?: boolean;

  risk_level?: string;

  reasons?: string[];

  [key: string]: unknown;
}


// ============================================================
// APP SESSION STATE
// ============================================================

export interface ActiveBackendSession {
  sessionId: number;

  conversationId?: number;

  scenarioId?: string;

  startedAt: string;

  status:
    | 'active'
    | 'completed'
    | 'abandoned';
}


// ============================================================
// API DOCUMENT LIST RESPONSE
// ============================================================

export interface DocumentsResponse {
  total_documents: number;

  documents: BackendDocument[];
}


// ============================================================
// DOCUMENT HISTORY
// ============================================================

export interface DocumentHistoryVersion {
  document_id: number;

  version: number;

  status: string;

  filename: string;

  document_type:
    | 'policy'
    | 'faq'
    | 'support';

  uploaded_by: string;
}


export interface DocumentHistoryResponse {
  document_name: string;

  total_versions: number;

  versions: DocumentHistoryVersion[];
}


// ============================================================
// FILE UPLOAD
// ============================================================

export type UploadDocumentType =
  | 'policy'
  | 'faq'
  | 'support';


// ============================================================
// API CONNECTION STATE
// ============================================================

export type ApiConnectionStatus =
  | 'connected'
  | 'disconnected'
  | 'checking';


// ============================================================
// VITE ENVIRONMENT
// ============================================================

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;

  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}