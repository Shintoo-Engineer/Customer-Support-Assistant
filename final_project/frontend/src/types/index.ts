/**
 * TypeScript Interfaces & Enums matching exact backend Pydantic models in RAG-Pipeline-backend.
 */

// ==========================================
// Task 3: Customer Simulator Enums & Types
// ==========================================

export type PersonaType = 'calm' | 'confused' | 'frustrated' | 'angry' | 'impatient' | 'polite';

export type ScenarioType = 'refund' | 'delayed_order' | 'payment_failure' | 'account_issue' | 'cancellation';

export interface CustomerState {
  frustration: number; // 0 to 100
  trust: number;       // 0 to 100
  patience: number;    // 0 to 100
  satisfaction: number;// 0 to 100
  escalation_intent: number; // 0 to 100
}

export interface SimulatorStartRequest {
  session_label: string;
  persona: PersonaType;
  scenario: ScenarioType;
  initial_emotion: string;
  issue_severity: number;  // 1 to 5
  patience_level: number;  // 1 to 5
  expected_resolution: string;
}

export interface SimulatorMessageRequest {
  session_id: number;
  agent_response: string;
}

export interface SupportTurnRequest {
  session_id: number;
  agent_response: string;
}

export interface DialogueMessage {
  message_id?: number;
  sender_type: 'Customer' | 'Support Agent' | 'AI' | string;
  message_text: string;
  message_type?: string;
  timestamp?: string;
}

export interface SimulatorHistoryResponse {
  session_id: number;
  status: string;
  messages: DialogueMessage[];
}

// ==========================================
// Task 4: Intent & Sentiment Analysis Enums & Types
// ==========================================

export type CustomerIntent =
  | 'refund'
  | 'cancellation'
  | 'delivery_issue'
  | 'payment_issue'
  | 'account_issue'
  | 'complaint'
  | 'return_exchange'
  | 'general_inquiry';

export type CustomerEmotion =
  | 'happy'
  | 'neutral'
  | 'confused'
  | 'worried'
  | 'frustrated'
  | 'angry'
  | 'satisfied';

export type CustomerSentiment = 'positive' | 'neutral' | 'negative';

export type SatisfactionTrend = 'improving' | 'declining' | 'stable';

export type EscalationRisk = 'low' | 'medium' | 'high';

export interface AnalysisResponse {
  intent: CustomerIntent;
  emotion: CustomerEmotion;
  sentiment: CustomerSentiment;
  frustration_level: number; // 0 to 10
  satisfaction_trend: SatisfactionTrend;
  escalation_risk: EscalationRisk;
  confidence: number;        // 0.0 to 1.0
  session_id?: number | null;
  conversation_id?: number | null;
  message_id?: number | null;
  turn_number?: number | null;
  analysis_source?: string;
  analysis_timestamp?: string | null;
}

export interface TurnAnalysis {
  turn: number;
  intent: CustomerIntent;
  emotion: CustomerEmotion;
  sentiment: CustomerSentiment;
  frustration_level: number;
  satisfaction_trend: SatisfactionTrend;
  escalation_risk: EscalationRisk;
  confidence: number;
  analysis_source?: string | null;
  timestamp?: string | null;
}

export interface SessionAnalysisSummary {
  session_id: number;
  dominant_intent: CustomerIntent;
  latest_emotion: CustomerEmotion;
  latest_sentiment: CustomerSentiment;
  current_frustration: number;
  current_escalation_risk: EscalationRisk;
  overall_satisfaction_direction: SatisfactionTrend;
  average_confidence: number;
  turn_count: number;
}

export interface ResponseEvaluation {
  clarity: number;
  empathy: number;
  relevance: number;
  professionalism: number;
  notes?: string | null;
}

export type EscalationRiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';

export interface EscalationRiskMonitorResult {
  risk_score: number;
  risk_level: EscalationRiskLevel;
  risk_reasoning: string;
  risk_indicators: string[];
  contributing_factors: string[];
}

export interface DecisionSupportResult {
  priority: 'low' | 'medium' | 'high' | 'critical';
  recommended_tone: 'empathetic' | 'reassuring' | 'clarifying' | 'apologetic' | 'professional' | 'calm' | 'firm';
  recommended_action: 'resolve' | 'clarify' | 'apologize_and_resolve' | 'provide_status' | 'provide_instructions' | 'offer_options' | 'escalate';
  escalation_recommended: boolean;
  risk_flags: string[];
  customer_needs: string[];
  rationale: string;
  confidence: number;
  session_id?: number | null;
  turn_number?: number | null;
  suggested_response?: string;
  coaching_tips?: string[];
  response_evaluation?: ResponseEvaluation;
  escalation_monitor?: EscalationRiskMonitorResult;
  escalation_alert?: EscalationAlert;
}

export interface EscalationAlert {
  active: boolean;
  alert_level: EscalationRiskLevel;
  risk_score: number;
  threshold: number;
  indicators: string[];
  reasoning: string;
  recommended_action: string;
}

export interface AnalysisMetrics {
  total_analyses: number;
  gemini_analyses: number;
  fallback_analyses: number;
  validation_failures: number;
  analysis_failures: number;
  persistence_failures: number;
  total_latency_ms: number;
}

// ==========================================
// Task 5: Knowledge Recommendation Enums & Types
// ==========================================

export interface KnowledgeRecommendation {
  title: string;
  content: string;
  source: string;
  document_type: string;
  relevance_score: number;
}

export interface KnowledgeRecommendationRequest {
  query: string;
  session_id?: number | null;
  conversation_id?: number | null;
  conversation_history?: Array<{ sender_type: string; message_text: string }>;
  analysis?: Record<string, any> | null;
}

export interface KnowledgeRecommendationResult {
  query: string;
  recommendations: KnowledgeRecommendation[];
  no_relevant_information: boolean;
  contextual_query?: string | null;
  session_id?: number | null;
}

// ==========================================
// Integrated Turn Response (Unified Task 3 -> 4 -> 5)
// ==========================================

export interface IntegratedTurnResponse {
  session_id: number;
  conversation_id: number;
  customer_message: string;
  state: CustomerState;
  turn: number;
  is_resolved?: boolean;
  is_escalated?: boolean;
  analysis?: AnalysisResponse;
  recommendations: KnowledgeRecommendation[];
  no_relevant_information: boolean;
  contextual_query?: string | null;
  knowledge_recommendations?: KnowledgeRecommendationResult;
}

// ==========================================
// Task 2: Search & RAG Enums & Types
// ==========================================

export interface SearchChunk {
  chunk_id: string;
  text: string;
  metadata: Record<string, any>;
  distance: number;
}

export interface SearchResponse {
  query: string;
  results: SearchChunk[];
}

export interface RAGResponse {
  question: string;
  answer: string;
  sources: Array<Record<string, any> | string>;
}

export interface SupportTicketResponse {
  status: string;
  issue_type: string;
  support_response: string;
}

// ==========================================
// Authentication & User Management Types
// ==========================================

export interface AuthUser {
  user_id: number;
  name: string;
  email: string;
  role: 'admin' | 'employee' | 'customer' | string;
}

export interface LoginResponse extends AuthUser {
  access_token: string;
  token_type: string;
}

export interface UserRecord {
  user_id: number;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface UsersListResponse {
  total_users: number;
  users: UserRecord[];
}

