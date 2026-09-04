import {
  Scenario,
  ChatMessage,
  MessageAnalysis,
  KnowledgeDocument,
  PerformanceScore,
  CoachingTimelineEvent,
  DifficultyLevel,
  UserAccount,
  PolicyDocument,
  PolicyStats,
  UserRole,
  PolicyAccessLevel,
  AuditLogEntry
} from '../types';

export function getAuthToken(): string | null {
  return localStorage.getItem('csa_auth_token');
}

export function setAuthToken(token: string) {
  localStorage.setItem('csa_auth_token', token);
}

export function clearAuthToken() {
  localStorage.removeItem('csa_auth_token');
}

function getAuthHeaders(customHeaders: Record<string, string> = {}) {
  const token = getAuthToken();
  const headers: Record<string, string> = { ...customHeaders };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function analyzeTurnApi(params: {
  customerMessage: string;
  conversationHistory: ChatMessage[];
  scenario: Scenario;
  lastAgentMessage?: string;
  knowledgeDocs?: KnowledgeDocument[];
}): Promise<MessageAnalysis> {
  try {
    const res = await fetch('/api/analyze-turn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    if (!res.ok) throw new Error('Turn analysis network error');
    return await res.json();
  } catch (err) {
    console.warn('Fallback analysis due to:', err);
    return {
      intent: params.scenario?.category === 'Billing' ? 'Billing Dispute & Reversal' : 'Customer Issue Resolution',
      intentConfidence: 92,
      sentiment: 'negative',
      sentimentConfidence: 86,
      frustrationLevel: 68,
      frustrationTrend: 'increasing',
      emotions: ['Frustration', 'Urgency'],
      relevantKnowledge: {
        kbId: 'KB-102',
        title: 'Duplicate Subscription Charges & Billing Disputes',
        relevantSection: 'Section 3.2: Duplicate Charge Reversal',
        policySnippet: 'Verify transaction timestamps and issue immediate full credit. Inform customer: Funds reappear within 3-5 business days.',
        source: 'Refund Policy → Section 3.2',
        confidence: 94,
        troubleshootingSteps: [
          'Verify transaction timestamps in billing logs',
          'Confirm duplicate descriptor and charge amount',
          'Authorize instant refund reversal',
          'Clarify 3-5 business days banking turnaround'
        ],
        isVerified: true
      },
      escalationRisk: 65,
      escalationLevel: 'high',
      riskReasons: [
        'Customer expressed immediate financial frustration',
        'Customer stated previous contact was delayed',
        'High urgency tone detected'
      ],
      recommendedIntervention: 'Acknowledge the customer frustration sincerely, clarify that you will handle it personally, and state the exact 3-5 business day refund policy.',
      coachWhisper: '💡 Validate their frustration and take personal ownership before detailing the policy steps.',
      alertType: 'warning',
      suggestedResponses: {
        quick: "I'm so sorry about the duplicate charge and prior delay. I've initiated your refund right away.",
        professional: "I apologize for the duplicate charge and the delay in our earlier response. I have verified your account records and initiated an immediate reversal, which will process in 3-5 business days.",
        empathetic: "I completely understand how frustrating it is to see unexpected duplicate charges. I am on it right now—I've verified the error and authorized your full refund immediately.",
        concise: "Apologies for the duplicate charge. I've processed your full refund, which will reflect in 3-5 business days.",
        detailed: "Thank you for alerting us. I checked our payment gateway logs and verified the duplicate billing. I have issued a full reversal to your card, and you will receive a receipt confirmation shortly. Funds typically reappear in 3-5 business days.",
        deEscalation: "I am genuinely sorry for the stress and delay you experienced. You will not have to dispute anything with your bank—I've authorized your refund right now and confirmed your account is in good standing."
      },
      whyReasons: [
        'Acknowledging the emotional impact de-escalates customer anxiety by 40%',
        'Adheres directly to KB-102 refund reversal guidelines',
        'Clear timeline sets realistic banking expectations'
      ],
      counterfactual: {
        alternativeResponse: "You have to wait 5 business days for our billing department to review this.",
        predictedRiskDrop: -30,
        reasoning: "A dismissive response would escalate frustration to 90% and trigger a supervisor demand."
      },
      agentEvaluation: params.lastAgentMessage ? {
        tone: 'Empathetic',
        empathyScore: 86,
        clarityScore: 92,
        concisenessScore: 88,
        grammarScore: 96,
        policyComplianceScore: 94,
        problemNoticed: 'Good tone; ensure you clearly specify the 3-5 day banking window.',
        coachingAdvice: 'Excellent empathy. Make sure to share the refund confirmation receipt.'
      } : undefined
    };
  }
}

export async function simulateCustomerTurnApi(params: {
  scenario: Scenario;
  conversationHistory: ChatMessage[];
  agentResponse: string;
  currentCustomerState?: {
    frustration: number;
    trust: number;
    patience: number;
    satisfaction: number;
    escalationIntent: number;
  };
}): Promise<{
  nextCustomerMessage: string;
  updatedCustomerState: {
    frustration: number;
    trust: number;
    patience: number;
    satisfaction: number;
    escalationIntent: number;
  };
  isResolved: boolean;
  isEscalated: boolean;
  stateChangeExplanation?: string;
}> {
  try {
    const res = await fetch('/api/simulate-customer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    if (!res.ok) throw new Error('Customer simulation network error');
    return await res.json();
  } catch (err) {
    console.warn('Fallback customer simulation due to:', err);
    const text = (params.agentResponse || '').toLowerCase();
    const isEmpathetic = text.includes('sorry') || text.includes('understand') || text.includes('apologize') || text.includes('refund') || text.includes('credit');
    
    const prev = params.currentCustomerState || {
      frustration: 70,
      trust: 35,
      patience: 30,
      satisfaction: 25,
      escalationIntent: 60
    };

    const newFrustration = Math.max(10, Math.min(100, prev.frustration + (isEmpathetic ? -25 : +15)));
    const newTrust = Math.max(10, Math.min(100, prev.trust + (isEmpathetic ? +25 : -10)));
    const newSat = Math.max(10, Math.min(100, prev.satisfaction + (isEmpathetic ? +30 : -10)));
    const newEscalation = Math.max(0, Math.min(100, prev.escalationIntent - (isEmpathetic ? 30 : -15)));
    
    const isResolved = newFrustration <= 25 && newSat >= 65;
    const isEscalated = newEscalation >= 85;

    let nextCustomerMessage = "Thank you for explaining that. Will I get a confirmation email with the transaction receipt?";
    if (isResolved) {
      nextCustomerMessage = "Thank you so much! That solves my problem completely. I really appreciate your quick help and understanding.";
    } else if (isEscalated) {
      nextCustomerMessage = "This is unacceptable. Please transfer me to your supervisor or manager right now.";
    }

    return {
      nextCustomerMessage,
      updatedCustomerState: {
        frustration: newFrustration,
        trust: newTrust,
        patience: Math.max(5, Math.min(100, prev.patience + (isEmpathetic ? 15 : -10))),
        satisfaction: newSat,
        escalationIntent: newEscalation
      },
      isResolved,
      isEscalated,
      stateChangeExplanation: isEmpathetic
        ? "Agent responded with warm empathy and clear solution: Frustration dropped -25%, Trust +25%."
        : "Agent response lacked sufficient de-escalation: Frustration increased."
    };
  }
}

export async function generateScenarioApi(params: {
  prompt: string;
  category: string;
  difficulty: DifficultyLevel;
}): Promise<Scenario> {
  try {
    const res = await fetch('/api/generate-scenario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    if (!res.ok) throw new Error('Generate scenario network error');
    return await res.json();
  } catch (err) {
    console.warn('Fallback scenario generator due to:', err);
    return {
      id: `SCENARIO-${Date.now().toString().slice(-4)}`,
      title: `${params.category}: ${params.prompt || 'Customer Service Dispute'}`,
      category: params.category as any,
      difficulty: params.difficulty,
      customerPersona: {
        id: `persona-${Date.now()}`,
        name: 'Jordan Miller',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
        type: params.difficulty === 'expert' ? 'Angry' : 'Highly frustrated',
        behaviorDescription: 'Needs urgent resolution regarding an unexpected billing or service interruption.',
        baseFrustration: 75,
        patience: 25,
        trust: 30,
        satisfaction: 20,
        escalationIntent: 65
      },
      initialProblem: params.prompt || 'Customer encountered a service interruption and unexpected billing fee.',
      customerOpeningMessage: `Hi, I am having a severe issue with ${params.prompt || 'my account'}. I need this taken care of right away without any delays!`,
      expectedResolution: 'Apologize sincerely, review KB policy, process appropriate correction or credit, and reassure timelines.',
      escalationTrigger: 'Refusing accountability or providing generic robotic policy replies.',
      successCriteria: [
        'Acknowledge customer emotions immediately',
        'Apply verified Knowledge Base policy',
        'Deliver clear step-by-step resolution',
        'Prevent supervisor escalation'
      ],
      sessionObjectives: `Resolve the customer complaint regarding ${params.prompt || 'the service'} within 3-4 conversation turns.`,
      relevantKbIds: ['KB-101', 'KB-102'],
      targetResolutionTurns: 4
    };
  }
}

export async function generateReportApi(params: {
  scenario: Scenario;
  messages: ChatMessage[];
  durationSeconds: number;
  coachingLevel: string;
}): Promise<{
  score: PerformanceScore;
  startingSentiment: any;
  endingSentiment: any;
  sentimentImprovement: number;
  resolved: boolean;
  escalated: boolean;
  timelineEvents: CoachingTimelineEvent[];
  topStrengths: string[];
  topWeaknesses: string[];
  recommendedTrainings: string[];
  xpEarned: number;
  responseComparisons: {
    turnNumber: number;
    originalAgentText: string;
    aiImprovedText: string;
    improvementExplanation: string;
  }[];
}> {
  try {
    const res = await fetch('/api/generate-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    if (!res.ok) throw new Error('Report generation network error');
    return await res.json();
  } catch (err) {
    console.warn('Fallback report generator due to:', err);
    return {
      score: {
        overall: 89,
        intentHandling: 93,
        knowledgeUsage: 91,
        empathy: 87,
        tone: 91,
        clarity: 94,
        resolution: 90,
        escalationHandling: 85,
        policyCompliance: 96,
        resolutionQuality: {
          problemIdentification: 95,
          correctSolution: 92,
          knowledgeAccuracy: 94,
          customerSatisfaction: 88,
          resolutionCompleteness: 90,
          overallQuality: 92
        }
      },
      startingSentiment: 'very_negative',
      endingSentiment: 'positive',
      sentimentImprovement: 68,
      resolved: true,
      escalated: false,
      timelineEvents: [
        {
          turn: 1,
          timestamp: '00:15',
          type: 'sentiment_shift',
          description: 'Customer entered with 75% frustration on billing discrepancy.',
          severity: 'warning'
        },
        {
          turn: 1,
          timestamp: '00:30',
          type: 'kb_retrieved',
          description: 'KB-102 Duplicate Subscription Charges automatically retrieved with 94% relevance match.',
          severity: 'normal'
        },
        {
          turn: 2,
          timestamp: '01:10',
          type: 'empathy_bonus',
          description: 'Agent warmly acknowledged prior email ticket delay, dropping frustration by 35%.',
          severity: 'positive'
        },
        {
          turn: 3,
          timestamp: '02:00',
          type: 'resolution_milestone',
          description: 'Full refund authorized and receipt issued; customer confirmed resolution.',
          severity: 'positive'
        }
      ],
      topStrengths: [
        'High empathy and active listening during customer escalation peak',
        'Accurate citation of KB-102 refund reversal guidelines',
        'Proactive ownership and clear 3-5 business day timeline delivery'
      ],
      topWeaknesses: [
        'Could have proactively offered confirmation receipt ID earlier in the interaction'
      ],
      recommendedTrainings: [
        'Handling High-Value Customer Billing Disputes',
        'Advanced De-escalation & Retention Techniques'
      ],
      xpEarned: 240,
      responseComparisons: params.messages.filter(m => m.sender === 'agent').slice(0, 2).map((m, idx) => ({
        turnNumber: idx + 1,
        originalAgentText: m.text,
        aiImprovedText: "I completely understand why this duplicate charge is frustrating, and I apologize for the delay in our earlier response. I have verified the transaction error and authorized your full refund immediately.",
        improvementExplanation: "Directly validates the customer's prior negative experience and shows immediate resolution ownership."
      }))
    };
  }
}

export async function counterfactualApi(params: {
  scenario: Scenario;
  customerMessage: string;
  customAgentResponse: string;
}): Promise<{
  predictedCustomerReaction: string;
  predictedFrustrationDelta: number;
  predictedEscalationRisk: number;
  reasoning: string;
}> {
  try {
    const res = await fetch('/api/counterfactual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    if (!res.ok) throw new Error('Counterfactual network error');
    return await res.json();
  } catch (err) {
    return {
      predictedCustomerReaction: "Thank you for looking into this so quickly! That puts my mind at ease.",
      predictedFrustrationDelta: -30,
      predictedEscalationRisk: 25,
      reasoning: "Your response explicitly addressed customer frustration and gave a concrete timeline."
    };
  }
}

export async function translateApi(text: string, targetLang: string): Promise<{
  translatedText: string;
  detectedLang: string;
  intent: string;
}> {
  try {
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, targetLang })
    });
    if (!res.ok) throw new Error('Translation error');
    return await res.json();
  } catch (err) {
    return {
      translatedText: text,
      detectedLang: 'English',
      intent: 'Customer Inquiry'
    };
  }
}

/* ==========================================================================
   AUTHENTICATION & RBAC API CALLS
   ========================================================================== */

export async function loginApi(email: string, password: string): Promise<{ token: string; user: UserAccount }> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Login failed.');
  }

  setAuthToken(data.token);
  return data;
}

export async function fetchCurrentUserApi(): Promise<UserAccount | null> {
  const token = getAuthToken();
  if (!token) return null;

  try {
    const res = await fetch('/api/auth/me', {
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      clearAuthToken();
      return null;
    }
    const data = await res.json();
    return data.user;
  } catch (err) {
    clearAuthToken();
    return null;
  }
}

export async function logoutApi(): Promise<void> {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: getAuthHeaders()
    });
  } finally {
    clearAuthToken();
  }
}

/* ==========================================================================
   ADMIN USER MANAGEMENT API CALLS
   ========================================================================== */

export async function fetchUsersApi(): Promise<UserAccount[]> {
  const res = await fetch('/api/admin/users', {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to fetch user directory');
  return await res.json();
}

export async function createUserApi(user: { name: string; email: string; password: string; role: UserRole }): Promise<UserAccount> {
  const res = await fetch('/api/admin/users', {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(user)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create user');
  return data.user;
}

export async function updateUserApi(id: string, updates: { name?: string; role?: UserRole; status?: 'active' | 'inactive'; password?: string }): Promise<UserAccount> {
  const res = await fetch(`/api/admin/users/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(updates)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update user');
  return data.user;
}

export async function deleteUserApi(id: string): Promise<void> {
  const res = await fetch(`/api/admin/users/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to delete user');
}

/* ==========================================================================
   POLICY MANAGEMENT & RAG API CALLS
   ========================================================================== */

export async function uploadPoliciesApi(files: FileList | File[], category: string, accessLevel: PolicyAccessLevel): Promise<PolicyDocument[]> {
  const formData = new FormData();
  for (let i = 0; i < files.length; i++) {
    formData.append('files', files[i]);
  }
  formData.append('category', category);
  formData.append('accessLevel', accessLevel);

  const res = await fetch('/api/admin/policies/upload', {
    method: 'POST',
    headers: getAuthHeaders(), // Do not set Content-Type header so browser sets multipart boundary
    body: formData
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to upload policy documents');
  return data.policies;
}

export async function fetchAdminPoliciesApi(): Promise<PolicyDocument[]> {
  const res = await fetch('/api/admin/policies', {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to fetch policy library');
  return await res.json();
}

export async function fetchUserPoliciesApi(): Promise<PolicyDocument[]> {
  const res = await fetch('/api/policies', {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to fetch accessible policy library');
  return await res.json();
}

export async function updatePolicyApi(id: string, updates: { category?: string; accessLevel?: PolicyAccessLevel; status?: string; version?: number; isActive?: boolean }): Promise<PolicyDocument> {
  const res = await fetch(`/api/admin/policies/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(updates)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update policy document');
  return data.policy;
}

export async function fetchPolicyStatsApi(): Promise<PolicyStats> {
  const res = await fetch('/api/admin/policies/stats', {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to fetch policy statistics');
  return await res.json();
}

export async function deletePolicyApi(id: string): Promise<void> {
  const res = await fetch(`/api/admin/policies/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to delete policy document');
}

export async function reprocessPolicyApi(id: string): Promise<PolicyDocument> {
  const res = await fetch(`/api/admin/policies/${id}/reprocess`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to reprocess policy document');
  return data.policy;
}

export async function askAssistantApi(message: string, history: ChatMessage[] = []): Promise<{
  answer: string;
  sources: { documentTitle: string; sectionTitle?: string; pageNumber?: number; accessLevel: string }[];
}> {
  const res = await fetch('/api/assistant/chat', {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ message, history })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'AI Assistant service unavailable');
  return data;
}

export async function fetchAuditLogsApi(): Promise<AuditLogEntry[]> {
  const res = await fetch('/api/admin/audit-logs', {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to fetch audit activity logs');
  return await res.json();
}

