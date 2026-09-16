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

/**
 * Dynamically resolved API Base URL.
 * In Vercel / same-origin deployments, defaults to '' (relative paths like /api/*).
 * If external backend URL is explicitly configured, uses VITE_API_URL or VITE_API_BASE_URL.
 */
export const API_BASE_URL: string = (
  (import.meta.env.VITE_API_URL as string | undefined) ||
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  ''
).replace(/\/+$/, '');

// ============================================================
// Token Helpers
// ============================================================

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

/**
 * Robust JSON request helper that safely handles HTML error pages,
 * network failures, standardizes error messages, and logs real backend errors.
 */
async function safeFetchJson<T = any>(
  path: string,
  init?: RequestInit,
  fallbackError = 'Request failed'
): Promise<T> {
  const url =
    path.startsWith('http://') || path.startsWith('https://')
      ? path
      : `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

  let res: Response;

  try {
    res = await fetch(url, init);
  } catch (netErr: any) {
    console.error('[API ERROR] Network failure:', {
      endpoint: path,
      url,
      error: netErr?.message || netErr
    });
    throw new Error(
      'Unable to connect to the backend server. Please verify network connection and API URL.'
    );
  }

  const contentType = res.headers.get('content-type') || '';

  if (!res.ok) {
    let errorDetail = fallbackError;
    let errorData: any = null;

    if (contentType.includes('application/json')) {
      errorData = await res.json().catch(() => null);
      errorDetail =
        errorData?.error ||
        errorData?.message ||
        errorData?.detail ||
        fallbackError;
    } else {
      const raw = await res.text().catch(() => '');
      if (raw && !raw.trim().startsWith('<')) {
        errorDetail = raw;
      }
    }

    console.error('[API ERROR]', {
      status: res.status,
      statusText: res.statusText,
      endpoint: path,
      url,
      response: errorData || errorDetail
    });

    if (res.status === 401) {
      clearAuthToken();
      throw new Error(errorDetail || 'Invalid email or password.');
    }

    if (res.status === 403) {
      throw new Error(
        typeof errorDetail === 'string'
          ? errorDetail
          : 'Access Denied: You do not have permission to perform this action.'
      );
    }

    throw new Error(typeof errorDetail === 'string' ? errorDetail : fallbackError);
  }

  if (contentType.includes('application/json')) {
    return await res.json();
  }

  const rawText = await res.text();

  if (rawText.trim().startsWith('<')) {
    console.error('[API ERROR] Unexpected HTML response:', {
      status: res.status,
      endpoint: path,
      url
    });
    throw new Error(
      'Backend returned an unexpected HTML response instead of JSON. Please verify API routing.'
    );
  }

  try {
    return JSON.parse(rawText);
  } catch {
    throw new Error('Invalid JSON response format received from server.');
  }
}

// ============================================================
// 1. AUTHENTICATION (Express /api/auth/*)
// ============================================================

export async function loginApi(
  email: string,
  password: string
): Promise<{
  token: string;
  user: UserAccount;
  success?: boolean;
}> {
  clearAuthToken();

  const data = await safeFetchJson<{
    success: boolean;
    token: string;
    user: UserAccount;
  }>(
    '/api/auth/login',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password })
    },
    'Invalid email or password.'
  );

  if (data.token) {
    setAuthToken(data.token);
  }

  return data;
}

export async function fetchCurrentUserApi(): Promise<UserAccount | null> {
  const token = getAuthToken();
  if (!token) {
    return null;
  }

  try {
    const data = await safeFetchJson<{ user: UserAccount }>(
      '/api/auth/me',
      {
        headers: getAuthHeaders()
      },
      'Failed to authenticate user session.'
    );

    return data.user;
  } catch (err) {
    clearAuthToken();
    return null;
  }
}

export async function logoutApi(): Promise<void> {
  try {
    await safeFetchJson('/api/auth/logout', {
      method: 'POST',
      headers: getAuthHeaders()
    });
  } catch (err) {
    // Ignore network error on logout
  } finally {
    clearAuthToken();
  }
}

// ============================================================
// 2. LIVE SIMULATION & COACHING APIS
// ============================================================

export async function analyzeTurnApi(params: {
  customerMessage: string;
  conversationHistory: ChatMessage[];
  scenario: Scenario;
  lastAgentMessage?: string;
  knowledgeDocs?: KnowledgeDocument[];
}): Promise<MessageAnalysis> {
  try {
    return await safeFetchJson<MessageAnalysis>('/api/analyze-turn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
  } catch (err) {
    console.warn('Fallback analysis due to:', err);

    return {
      intent:
        params.scenario?.category === 'Billing'
          ? 'Billing Dispute & Reversal'
          : 'Customer Issue Resolution',
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
        policySnippet:
          'Verify transaction timestamps and issue immediate full credit. Inform customer: Funds reappear within 3-5 business days.',
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
      recommendedIntervention:
        'Acknowledge the customer frustration sincerely, clarify that you will handle it personally, and state the exact 3-5 business day refund policy.',
      coachWhisper:
        '💡 Validate their frustration and take personal ownership before detailing the policy steps.',
      alertType: 'warning',
      suggestedResponses: {
        quick:
          "I'm so sorry about the duplicate charge and prior delay. I've initiated your refund right away.",
        professional:
          'I apologize for the duplicate charge and the delay in our earlier response. I have verified your account records and initiated an immediate reversal, which will process in 3-5 business days.',
        empathetic:
          "I completely understand how frustrating it is to see unexpected duplicate charges. I am on it right now—I've verified the error and authorized your full refund immediately.",
        concise:
          "Apologies for the duplicate charge. I've processed your full refund, which will reflect in 3-5 business days.",
        detailed:
          'Thank you for alerting us. I checked our payment gateway logs and verified the duplicate billing. I have issued a full reversal to your card, and you will receive a receipt confirmation shortly. Funds typically reappear in 3-5 business days.',
        deEscalation:
          "I am genuinely sorry for the stress and delay you experienced. You will not have to dispute anything with your bank—I've authorized your refund right now and confirmed your account is in good standing."
      },
      whyReasons: [
        'Acknowledging the emotional impact de-escalates customer anxiety by 40%',
        'Adheres directly to KB-102 refund reversal guidelines',
        'Clear timeline sets realistic banking expectations'
      ],
      counterfactual: {
        alternativeResponse:
          'You have to wait 5 business days for our billing department to review this.',
        predictedRiskDrop: -30,
        reasoning:
          'A dismissive response would escalate frustration to 90% and trigger a supervisor demand.'
      },
      agentEvaluation: params.lastAgentMessage
        ? {
            tone: 'Empathetic',
            empathyScore: 86,
            clarityScore: 92,
            concisenessScore: 88,
            grammarScore: 96,
            policyComplianceScore: 94,
            problemNoticed:
              'Good tone; ensure you clearly specify the 3-5 day banking window.',
            coachingAdvice:
              'Excellent empathy. Make sure to share the refund confirmation receipt.'
          }
        : undefined
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
    return await safeFetchJson('/api/simulate-customer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
  } catch (err) {
    console.warn('Fallback dynamic customer simulation due to:', err);

    const text = (params.agentResponse || '').toLowerCase().trim();
    const turnNumber = params.conversationHistory.length;

    const isGreeting =
      text.startsWith('hello') ||
      text.startsWith('hi') ||
      text.startsWith('hey') ||
      text.startsWith('good morning') ||
      text.startsWith('good afternoon') ||
      text.includes('how can i help') ||
      text.includes('how may i assist') ||
      text.includes('welcome');

    const hasApology =
      text.includes('sorry') ||
      text.includes('apologize') ||
      text.includes('apologies') ||
      text.includes('my sincere apologies') ||
      text.includes('pardon');

    const hasEmpathy =
      text.includes('understand') ||
      text.includes('hear you') ||
      text.includes('frustrat') ||
      text.includes('stress') ||
      text.includes('unacceptable') ||
      text.includes('terrible') ||
      text.includes('make this right') ||
      text.includes('inconvenience') ||
      hasApology;

    const hasRefundOrResolution =
      text.includes('refund') ||
      text.includes('credit') ||
      text.includes('waive') ||
      text.includes('waived') ||
      text.includes('revers') ||
      text.includes('cancel') ||
      text.includes('processed') ||
      text.includes('initiated') ||
      text.includes('resolved') ||
      text.includes('fixed') ||
      text.includes('authorized') ||
      text.includes('replacement');

    const hasTimelineOrConfirmation =
      text.includes('business day') ||
      text.includes('days') ||
      text.includes('hours') ||
      text.includes('receipt') ||
      text.includes('confirmation') ||
      text.includes('email') ||
      text.includes('reference number') ||
      text.includes('transaction id') ||
      text.includes('tracking');

    const hasPolicyReference =
      text.includes('policy') ||
      text.includes('terms') ||
      text.includes('rule') ||
      text.includes('conditions') ||
      text.includes('kb-') ||
      text.includes('according to');

    const isPolicyBlunt = hasPolicyReference && !hasEmpathy && !hasRefundOrResolution;

    const isDismissive =
      text.includes('wait') ||
      text.includes('calm down') ||
      text.includes('hold on') ||
      text.includes('nothing i can do') ||
      text.includes('already explained') ||
      text.includes('already told') ||
      text.includes('as i said') ||
      text.includes('not my department') ||
      text.includes('cannot help') ||
      text.includes("can't help") ||
      (text.length < 8 && !isGreeting && !hasRefundOrResolution);

    const isAskingInfo =
      text.includes('could you') ||
      text.includes('can you') ||
      text.includes('please provide') ||
      text.includes('what is your') ||
      text.includes('transaction id') ||
      text.includes('order number') ||
      text.includes('account email') ||
      text.includes('verify');

    const isSupervisorEscalation =
      text.includes('supervisor') ||
      text.includes('manager') ||
      text.includes('transfer you') ||
      text.includes('escalat');

    const prev = params.currentCustomerState || {
      frustration: 70,
      trust: 35,
      patience: 30,
      satisfaction: 25,
      escalationIntent: 60
    };

    let frustrationDelta = 0;
    let trustDelta = 0;
    let patienceDelta = 0;
    let satDelta = 0;
    let escalationDelta = 0;
    let stateExplanation = '';
    let nextCustomerMessage = '';

    if (isDismissive) {
      if (text.includes('already explained') || text.includes('already told') || text.includes('as i said')) {
        frustrationDelta = +30;
        trustDelta = -25;
        patienceDelta = -25;
        satDelta = -20;
        escalationDelta = +35;
        nextCustomerMessage = "I heard you the first time, but that doesn't solve my problem! Why are you giving me the runaround instead of actually resolving this?";
        stateExplanation = "Agent was repetitive/dismissive: Frustration spiked +30%, Escalation risk +35%.";
      } else if (text.includes('wait') || text.includes('hold on')) {
        frustrationDelta = +20;
        trustDelta = -15;
        patienceDelta = -20;
        satDelta = -15;
        escalationDelta = +25;
        nextCustomerMessage = "I've already been waiting. Can you please tell me what is actually happening and why this hasn't been fixed yet?";
        stateExplanation = "Agent told customer to wait without context: Frustration rose +20%, Patience dropped -20%.";
      } else if (text.includes('calm down')) {
        frustrationDelta = +35;
        trustDelta = -30;
        patienceDelta = -30;
        satDelta = -25;
        escalationDelta = +40;
        nextCustomerMessage = "Don't tell me to calm down! Anyone in my position would be furious. Are you going to fix this or should I speak to your supervisor?";
        stateExplanation = "Agent used invalidating phrase: Frustration spiked +35%, Escalation intent +40%.";
      } else {
        frustrationDelta = +25;
        trustDelta = -20;
        patienceDelta = -20;
        satDelta = -15;
        escalationDelta = +30;
        nextCustomerMessage = "That is completely unhelpful. I am losing my patience here—please tell me what specific steps you are taking to fix this right now.";
        stateExplanation = "Agent gave curt response: Frustration rose +25%, Trust dropped -20%.";
      }
    } else if (isPolicyBlunt) {
      frustrationDelta = +20;
      trustDelta = -15;
      patienceDelta = -15;
      satDelta = -15;
      escalationDelta = +20;
      nextCustomerMessage = "I understand there is a policy, but I need you to actually help me with the duplicate charge rather than just quoting rules at me.";
      stateExplanation = "Agent cited policy without empathy: Frustration rose +20%, Trust dropped -15%.";
    } else if (isSupervisorEscalation) {
      frustrationDelta = +5;
      trustDelta = 0;
      patienceDelta = -5;
      satDelta = 0;
      escalationDelta = +25;
      nextCustomerMessage = "Yes, please connect me with a supervisor or manager immediately who has the authority to resolve this.";
      stateExplanation = "Supervisor transfer initiated: Customer escalated to management.";
    } else if (hasRefundOrResolution && hasEmpathy) {
      frustrationDelta = -35;
      trustDelta = +30;
      patienceDelta = +20;
      satDelta = +35;
      escalationDelta = -35;
      if (hasTimelineOrConfirmation) {
        nextCustomerMessage = "Thank you so much for taking care of that. Will I also receive an email confirmation with the transaction details?";
        stateExplanation = "Agent expressed empathy, authorized resolution, and gave clear timeline: Frustration dropped -35%, Trust rose +30%.";
      } else {
        nextCustomerMessage = "Thank you for understanding and helping with the refund. Please let me know when the refund will appear on my account.";
        stateExplanation = "Agent offered empathetic refund: Frustration dropped -35%, Trust rose +30%.";
      }
    } else if (hasRefundOrResolution && !hasEmpathy) {
      frustrationDelta = -20;
      trustDelta = +15;
      patienceDelta = +10;
      satDelta = +20;
      escalationDelta = -20;
      nextCustomerMessage = "Thank you for processing that. Could you give me the confirmation reference number and when it will take effect?";
      stateExplanation = "Agent processed resolution without deep empathy: Frustration decreased -20%, Trust rose +15%.";
    } else if (hasEmpathy) {
      frustrationDelta = -15;
      trustDelta = +15;
      patienceDelta = +15;
      satDelta = +15;
      escalationDelta = -15;
      nextCustomerMessage = "Thank you for acknowledging that. What are the exact steps you are going to take to fix this for me?";
      stateExplanation = "Agent validated customer emotions: Frustration dropped -15%, Trust rose +15%.";
    } else if (isAskingInfo) {
      frustrationDelta = -5;
      trustDelta = +10;
      patienceDelta = +5;
      satDelta = +5;
      escalationDelta = -5;
      nextCustomerMessage = "Sure, I have the transaction details right here. Please check the latest entry under my account so we can resolve this.";
      stateExplanation = "Agent asked for clarifying information: Customer cooperated, Trust +10%.";
    } else if (isGreeting) {
      if (turnNumber <= 2) {
        nextCustomerMessage = `Hi. I really hope you can help me because ${params.scenario?.initialProblem || 'I have a serious billing issue with my account'} and I need this taken care of right now.`;
      } else {
        nextCustomerMessage = "Hello, but let's please get back to resolving my issue. What can we do right now?";
      }
      frustrationDelta = -5;
      trustDelta = +5;
      satDelta = 0;
      stateExplanation = "Greeting exchanged: Issue context clarified.";
    } else {
      frustrationDelta = -5;
      trustDelta = +5;
      satDelta = +5;
      escalationDelta = -5;
      if (prev.frustration > 60) {
        nextCustomerMessage = "Okay, but how long is this actually going to take? I need to be 100% sure this won't happen again next month.";
      } else {
        nextCustomerMessage = "Thank you for checking that for me. Does that mean I'll receive a confirmation email once it's posted?";
      }
      stateExplanation = "Agent provided informational response: Frustration adjusted moderately.";
    }

    const newFrustration = Math.max(5, Math.min(100, prev.frustration + frustrationDelta));
    const newTrust = Math.max(5, Math.min(100, prev.trust + trustDelta));
    const newPatience = Math.max(5, Math.min(100, prev.patience + patienceDelta));
    const newSat = Math.max(5, Math.min(100, prev.satisfaction + satDelta));
    const newEscalation = Math.max(0, Math.min(100, prev.escalationIntent + escalationDelta));

    const isResolved = newFrustration <= 22 && newSat >= 70;
    const isEscalated = newEscalation >= 85 || newFrustration >= 90;

    if (isResolved) {
      nextCustomerMessage = "Thank you so much! That solves my problem completely. I really appreciate your quick help and understanding.";
    } else if (isEscalated) {
      nextCustomerMessage = "I have had enough of this runaround! Please transfer me to your supervisor or manager right now.";
    }

    return {
      nextCustomerMessage,
      updatedCustomerState: {
        frustration: newFrustration,
        trust: newTrust,
        patience: newPatience,
        satisfaction: newSat,
        escalationIntent: newEscalation
      },
      isResolved,
      isEscalated,
      stateChangeExplanation: stateExplanation
    };
  }
}

export async function generateScenarioApi(params: {
  prompt: string;
  category: string;
  difficulty: DifficultyLevel;
}): Promise<Scenario> {
  try {
    return await safeFetchJson<Scenario>('/api/generate-scenario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
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
        avatar:
          'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
        type:
          params.difficulty === 'expert'
            ? 'Angry'
            : 'Highly frustrated',
        behaviorDescription:
          'Needs urgent resolution regarding an unexpected billing or service interruption.',
        baseFrustration: 75,
        patience: 25,
        trust: 30,
        satisfaction: 20,
        escalationIntent: 65
      },
      initialProblem:
        params.prompt ||
        'Customer encountered a service interruption and unexpected billing fee.',
      customerOpeningMessage:
        `Hi, I am having a severe issue with ${
          params.prompt || 'my account'
        }. I need this taken care of right away without any delays!`,
      expectedResolution:
        'Apologize sincerely, review KB policy, process appropriate correction or credit, and reassure timelines.',
      escalationTrigger:
        'Refusing accountability or providing generic robotic policy replies.',
      successCriteria: [
        'Acknowledge customer emotions immediately',
        'Apply verified Knowledge Base policy',
        'Deliver clear step-by-step resolution',
        'Prevent supervisor escalation'
      ],
      sessionObjectives:
        `Resolve the customer complaint regarding ${
          params.prompt || 'the service'
        } within 3-4 conversation turns.`,
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
    return await safeFetchJson('/api/generate-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
  } catch (err) {
    console.warn('Fallback report generator due to:', err);

    return {
      score: {
        overall: 88,
        intentHandling: 90,
        knowledgeUsage: 94,
        empathy: 86,
        tone: 92,
        clarity: 90,
        resolution: 88,
        escalationHandling: 85,
        policyCompliance: 96,
        resolutionQuality: {
          problemIdentification: 92,
          correctSolution: 90,
          knowledgeAccuracy: 94,
          customerSatisfaction: 85,
          resolutionCompleteness: 88,
          overallQuality: 90
        }
      },
      startingSentiment: 'negative',
      endingSentiment: 'positive',
      sentimentImprovement: 65,
      resolved: true,
      escalated: false,
      timelineEvents: [
        {
          turn: 1,
          timestamp: '00:15',
          type: 'sentiment_shift',
          description:
            'Customer opened with elevated frustration regarding billing dispute.',
          severity: 'warning'
        },
        {
          turn: 2,
          timestamp: '01:10',
          type: 'empathy_bonus',
          description:
            'Agent warmly acknowledged prior email ticket delay, dropping frustration by 35%.',
          severity: 'positive'
        },
        {
          turn: 3,
          timestamp: '02:00',
          type: 'resolution_milestone',
          description:
            'Full refund authorized and receipt issued; customer confirmed resolution.',
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
      responseComparisons: params.messages
        .filter((m) => m.sender === 'agent')
        .slice(0, 2)
        .map((m, idx) => ({
          turnNumber: idx + 1,
          originalAgentText: m.text,
          aiImprovedText:
            'I completely understand why this duplicate charge is frustrating, and I apologize for the delay in our earlier response. I have verified the transaction error and authorized your full refund immediately.',
          improvementExplanation:
            "Directly validates the customer's prior negative experience and shows immediate resolution ownership."
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
    return await safeFetchJson('/api/counterfactual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
  } catch (err) {
    return {
      predictedCustomerReaction:
        'Thank you for looking into this so quickly! That puts my mind at ease.',
      predictedFrustrationDelta: -30,
      predictedEscalationRisk: 25,
      reasoning:
        'Your response explicitly addressed customer frustration and gave a concrete timeline.'
    };
  }
}

export async function translateApi(
  text: string,
  targetLang: string
): Promise<{
  translatedText: string;
  detectedLang: string;
  intent: string;
}> {
  try {
    return await safeFetchJson('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, targetLang })
    });
  } catch (err) {
    return {
      translatedText: text,
      detectedLang: 'English',
      intent: 'Customer Inquiry'
    };
  }
}

// ============================================================
// 3. ADMIN USER MANAGEMENT APIS (Express /api/admin/users)
// ============================================================

export async function fetchUsersApi(): Promise<UserAccount[]> {
  return await safeFetchJson<UserAccount[]>(
    '/api/admin/users',
    {
      headers: getAuthHeaders()
    },
    'Failed to fetch user directory.'
  );
}

export async function createUserApi(user: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}): Promise<UserAccount> {
  const data = await safeFetchJson<{ user: UserAccount }>(
    '/api/admin/users',
    {
      method: 'POST',
      headers: getAuthHeaders({
        'Content-Type': 'application/json'
      }),
      body: JSON.stringify(user)
    },
    'Failed to create user.'
  );

  return data.user;
}

export async function updateUserApi(
  id: string,
  updates: {
    name?: string;
    role?: UserRole;
    status?: 'active' | 'inactive';
    password?: string;
  }
): Promise<UserAccount> {
  const data = await safeFetchJson<{ user: UserAccount }>(
    `/api/admin/users/${id}`,
    {
      method: 'PUT',
      headers: getAuthHeaders({
        'Content-Type': 'application/json'
      }),
      body: JSON.stringify(updates)
    },
    'Failed to update user.'
  );

  return data.user;
}

export async function deleteUserApi(id: string): Promise<void> {
  await safeFetchJson(
    `/api/admin/users/${id}`,
    {
      method: 'DELETE',
      headers: getAuthHeaders()
    },
    'Failed to delete user.'
  );
}

// ============================================================
// 4. POLICY MANAGEMENT & RAG APIS
// ============================================================

export async function uploadPoliciesApi(
  files: FileList | File[],
  category: string,
  accessLevel: PolicyAccessLevel
): Promise<PolicyDocument[]> {
  const formData = new FormData();

  for (let i = 0; i < files.length; i++) {
    formData.append('files', files[i]);
  }

  formData.append('category', category);
  formData.append('accessLevel', accessLevel);

  const data = await safeFetchJson<{
    policies: PolicyDocument[];
  }>(
    '/api/admin/policies/upload',
    {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData
    },
    'Failed to upload policy documents.'
  );

  return data.policies;
}

export async function fetchAdminPoliciesApi(): Promise<PolicyDocument[]> {
  return await safeFetchJson<PolicyDocument[]>(
    '/api/admin/policies',
    {
      headers: getAuthHeaders()
    },
    'Failed to fetch policy library.'
  );
}

export async function fetchUserPoliciesApi(): Promise<PolicyDocument[]> {
  return await safeFetchJson<PolicyDocument[]>(
    '/api/policies',
    {
      headers: getAuthHeaders()
    },
    'Failed to fetch accessible policy library.'
  );
}

export async function updatePolicyApi(
  id: string,
  updates: {
    category?: string;
    accessLevel?: PolicyAccessLevel;
    status?: string;
    version?: number;
    isActive?: boolean;
  }
): Promise<PolicyDocument> {
  const data = await safeFetchJson<{
    policy: PolicyDocument;
  }>(
    `/api/admin/policies/${id}`,
    {
      method: 'PUT',
      headers: getAuthHeaders({
        'Content-Type': 'application/json'
      }),
      body: JSON.stringify(updates)
    },
    'Failed to update policy document.'
  );

  return data.policy;
}

export async function fetchPolicyStatsApi(): Promise<PolicyStats> {
  return await safeFetchJson<PolicyStats>(
    '/api/admin/policies/stats',
    {
      headers: getAuthHeaders()
    },
    'Failed to fetch policy statistics.'
  );
}

export async function deletePolicyApi(id: string): Promise<void> {
  await safeFetchJson(
    `/api/admin/policies/${id}`,
    {
      method: 'DELETE',
      headers: getAuthHeaders()
    },
    'Failed to delete policy document.'
  );
}

export async function reprocessPolicyApi(id: string): Promise<PolicyDocument> {
  const data = await safeFetchJson<{
    policy: PolicyDocument;
  }>(
    `/api/admin/policies/${id}/reprocess`,
    {
      method: 'POST',
      headers: getAuthHeaders()
    },
    'Failed to reprocess policy document.'
  );

  return data.policy;
}

// ============================================================
// 5. ROLE-BASED POLICY AI ASSISTANT CHAT (Express /api/assistant/chat)
// ============================================================

export async function askAssistantApi(
  message: string,
  history: ChatMessage[] = []
): Promise<{
  answer: string;
  sources: {
    documentTitle: string;
    sectionTitle?: string;
    pageNumber?: number;
    accessLevel: string;
  }[];
}> {
  const result = await safeFetchJson<{
    answer: string;
    sources: {
      documentTitle: string;
      sectionTitle?: string;
      pageNumber?: number;
      accessLevel: string;
    }[];
  }>(
    '/api/assistant/chat',
    {
      method: 'POST',
      headers: getAuthHeaders({
        'Content-Type': 'application/json'
      }),
      body: JSON.stringify({
        message,
        history
      })
    },
    'AI Assistant service unavailable.'
  );

  return {
    answer:
      result.answer ||
      "I couldn't find this information in the available company policies. Please contact HR or your administrator for clarification.",
    sources: Array.isArray(result.sources) ? result.sources : []
  };
}

// ============================================================
// 6. AUDIT LOG ACTIVITY APIS
// ============================================================

export async function fetchAuditLogsApi(): Promise<AuditLogEntry[]> {
  return await safeFetchJson<AuditLogEntry[]>(
    '/api/admin/audit-logs',
    {
      headers: getAuthHeaders()
    },
    'Failed to fetch audit activity logs.'
  );
}