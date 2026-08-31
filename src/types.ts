export type InteractionMode = 'simulator' | 'manual' | 'replay';
export type UserRole = 'agent' | 'trainer' | 'admin';
export type CoachingLevel = 'beginner' | 'intermediate' | 'advanced' | 'assessment';
export type DifficultyLevel = 'easy' | 'medium' | 'hard' | 'expert';

export type SentimentType = 'positive' | 'neutral' | 'negative' | 'very_negative';
export type EmotionType = 'Frustration' | 'Anger' | 'Confusion' | 'Anxiety' | 'Satisfaction' | 'Disappointment' | 'Urgency' | 'Relief';
export type EscalationLevel = 'low' | 'moderate' | 'high' | 'critical';

export interface CustomerPersona {
  id: string;
  name: string;
  avatar: string;
  type: 'Calm' | 'Confused' | 'Angry' | 'Impatient' | 'Professional' | 'First-time customer' | 'Technically knowledgeable' | 'Highly frustrated';
  behaviorDescription: string;
  baseFrustration: number; // 0-100
  patience: number; // 0-100
  trust: number; // 0-100
  satisfaction: number; // 0-100
  escalationIntent: number; // 0-100
}

export interface Scenario {
  id: string;
  title: string;
  category: 'Billing' | 'Account' | 'Product' | 'Delivery' | 'Subscription' | 'Technical' | 'Security';
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
}

export interface MessageAnalysis {
  intent: string;
  intentConfidence: number; // 0-100
  sentiment: SentimentType;
  sentimentConfidence: number;
  frustrationLevel: number; // 0-100
  frustrationTrend: 'increasing' | 'decreasing' | 'stable';
  emotions: EmotionType[];
  
  // RAG Knowledge Citation
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

  // Escalation Assessment
  escalationRisk: number; // 0-100
  escalationLevel: EscalationLevel;
  riskReasons: string[];
  recommendedIntervention: string;

  // Real-time Coaching
  coachWhisper?: string;
  alertType?: 'info' | 'warning' | 'critical';
  
  // Suggested responses across styles
  suggestedResponses: {
    quick: string;
    professional: string;
    empathetic: string;
    concise: string;
    detailed: string;
    deEscalation: string;
  };

  // Why this response? reasoning
  whyReasons: string[];

  // Counterfactual preview
  counterfactual?: {
    alternativeResponse: string;
    predictedRiskDrop: number;
    reasoning: string;
  };

  // Evaluation of the Agent's previous response (if turn > 1)
  agentEvaluation?: {
    tone: 'Polite' | 'Empathetic' | 'Professional' | 'Robotic' | 'Defensive' | 'Dismissive';
    empathyScore: number;
    clarityScore: number;
    concisenessScore: number;
    grammarScore: number;
    policyComplianceScore: number;
    problemNoticed?: string;
    coachingAdvice?: string;
  };
}

export interface ChatMessage {
  id: string;
  sender: 'customer' | 'agent' | 'system';
  text: string;
  originalText?: string; // For translated or masked messages
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

export interface KnowledgeDocument {
  id: string;
  title: string;
  category: 'Policies' | 'Billing' | 'Shipping' | 'Technical' | 'Product' | 'Security';
  updatedAt: string;
  chunkCount: number;
  embeddingCount: number;
  status: 'indexed' | 'updating' | 'warning';
  summary: string;
  content: string;
  citationsCount: number;
  conflictWarning?: string;
}

export interface PerformanceScore {
  overall: number; // 0-100
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

export interface CoachingTimelineEvent {
  turn: number;
  timestamp: string;
  type: 'sentiment_shift' | 'kb_retrieved' | 'risk_spike' | 'empathy_bonus' | 'policy_check' | 'resolution_milestone';
  description: string;
  severity: 'normal' | 'positive' | 'warning' | 'critical';
}

export interface SessionRecord {
  id: string;
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
  status: 'active' | 'completed' | 'abandoned';
  messages: ChatMessage[];
  score?: PerformanceScore;
  startingSentiment: SentimentType;
  endingSentiment: SentimentType;
  sentimentImprovement: number; // percentage
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

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'resolution' | 'knowledge' | 'empathy' | 'streak' | 'mastery';
  unlockedAt?: string;
  progress?: number;
  maxProgress?: number;
}

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
  tier: 'Diamond' | 'Platinum' | 'Gold' | 'Silver';
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userName: string;
  action: string;
  category: 'auth' | 'session' | 'knowledge' | 'scenario' | 'report' | 'system';
  details: string;
}

export interface TrainingPlanWeek {
  weekNumber: number;
  title: string;
  focusArea: string;
  assignedScenarios: string[];
  completedScenarios: string[];
  status: 'current' | 'upcoming' | 'completed';
  targetScore: number;
}
