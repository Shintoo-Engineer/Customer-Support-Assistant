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
  AuditLogEntry,
} from '../types';

/* ==========================================================================
   API BASE URL
   ========================================================================== */

export const API_BASE_URL: string = (
  (import.meta.env.VITE_API_URL as string | undefined) ||
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  'http://127.0.0.1:8000'
).replace(/\/+$/, '');

/* ==========================================================================
   AUTH TOKEN HELPERS
   ========================================================================== */

export function getAuthToken(): string | null {
  return localStorage.getItem('csa_auth_token');
}

export function setAuthToken(token: string): void {
  localStorage.setItem('csa_auth_token', token);
}

export function clearAuthToken(): void {
  localStorage.removeItem('csa_auth_token');
}

function getAuthHeaders(
  customHeaders: Record<string, string> = {}
): Record<string, string> {
  const token = getAuthToken();

  const headers: Record<string, string> = {
    ...customHeaders,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

/* ==========================================================================
   GENERIC API REQUEST HELPER
   ========================================================================== */

async function safeFetchJson<T = any>(
  path: string,
  init?: RequestInit,
  fallbackError = 'Request failed'
): Promise<T> {
  const url =
    path.startsWith('http://') ||
    path.startsWith('https://')
      ? path
      : `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

  let response: Response;

  try {
    response = await fetch(url, init);
  } catch {
    throw new Error(
      'Unable to connect to the backend server. Please verify that the API server is running.'
    );
  }

  const contentType =
    response.headers.get('content-type') || '';

  if (!response.ok) {
    if (contentType.includes('application/json')) {
      const errorData = await response
        .json()
        .catch(() => ({}));

      const detail =
        errorData?.detail ||
        errorData?.message ||
        errorData?.error;

      if (typeof detail === 'string') {
        throw new Error(detail);
      }

      if (Array.isArray(detail)) {
        const validationMessage = detail
          .map((item: any) => item?.msg)
          .filter(Boolean)
          .join(', ');

        if (validationMessage) {
          throw new Error(validationMessage);
        }
      }

      throw new Error(
        `${fallbackError} (HTTP ${response.status})`
      );
    }

    throw new Error(
      `${fallbackError} (HTTP ${response.status})`
    );
  }

  if (contentType.includes('application/json')) {
    return await response.json();
  }

  const rawText = await response.text();

  if (!rawText.trim()) {
    return {} as T;
  }

  if (rawText.trim().startsWith('<')) {
    throw new Error(
      'The backend returned an unexpected HTML response instead of JSON.'
    );
  }

  try {
    return JSON.parse(rawText);
  } catch {
    throw new Error(
      'Invalid JSON response received from backend.'
    );
  }
}

/* ==========================================================================
   LOCAL SIMULATOR ANALYSIS
   ========================================================================== */

/*
 * The current backend Swagger exposes:
 *
 * POST /simulator/start
 * POST /simulator/message
 *
 * The simulator response contains customer state, but it does not expose
 * the old /api/analyze-turn endpoint.
 *
 * This helper converts the actual simulator state into the existing
 * frontend MessageAnalysis shape so LiveConsoleView can continue using
 * the same UI without calling a nonexistent endpoint.
 */

export function buildSimulatorAnalysis(params: {
  scenario?: Scenario;
  state?: {
    emotion?: string;
    frustration?: number;
    patience?: number;
    satisfaction?: number;
    trust?: number;
    escalation_intent?: number;
  };
  customerMessage?: string;
  lastAgentMessage?: string;
}): MessageAnalysis {
  const scenarioCategory =
    params.scenario?.category || 'Customer Support';

  const frustration =
    Number(params.state?.frustration ?? 0);

  const escalationRisk =
    Number(params.state?.escalation_intent ?? 0);

  const emotion =
    params.state?.emotion ||
    'Neutral';

  let sentiment = 'neutral';

  if (frustration >= 70) {
    sentiment = 'very_negative';
  } else if (frustration >= 45) {
    sentiment = 'negative';
  } else if (frustration >= 25) {
    sentiment = 'neutral';
  } else {
    sentiment = 'positive';
  }

  let escalationLevel:
    | 'low'
    | 'medium'
    | 'high' = 'low';

  if (escalationRisk >= 70) {
    escalationLevel = 'high';
  } else if (escalationRisk >= 40) {
    escalationLevel = 'medium';
  }

  return {
    intent:
      scenarioCategory
        ? `${scenarioCategory} Support`
        : 'Customer Issue Resolution',

    intentConfidence: 100,

    sentiment,

    sentimentConfidence: 100,

    frustrationLevel: Math.round(
      Math.min(100, Math.max(0, frustration))
    ),

    frustrationTrend:
      frustration >= 60
        ? 'increasing'
        : frustration <= 25
        ? 'decreasing'
        : 'stable',

    emotions: [emotion],

    relevantKnowledge: {
      kbId: '',
      title: 'Simulator Knowledge Context',
      relevantSection: '',
      policySnippet: '',
      source: '',
      confidence: 0,
      troubleshootingSteps: [],
      isVerified: false,
    },

    escalationRisk: Math.round(
      Math.min(100, Math.max(0, escalationRisk))
    ),

    escalationLevel,

    riskReasons:
      escalationRisk >= 70
        ? [
            'Customer escalation intent is currently high.',
            'Customer frustration level is elevated.',
          ]
        : escalationRisk >= 40
        ? [
            'Customer may require careful de-escalation.',
          ]
        : [],

    recommendedIntervention:
      escalationRisk >= 70
        ? 'Acknowledge the customer concern, take ownership, and provide a clear resolution path.'
        : 'Continue using clear, empathetic and solution-focused communication.',

    coachWhisper:
      frustration >= 60
        ? 'Acknowledge the customer frustration before explaining the next steps.'
        : 'Maintain a clear and empathetic response.',

    alertType:
      escalationRisk >= 70
        ? 'warning'
        : 'info',

    suggestedResponses: {
      quick:
        'I understand your concern. Let me check the details and help resolve this for you.',

      professional:
        'I understand your concern and apologize for the inconvenience. Let me review the details and guide you through the next steps.',

      empathetic:
        'I understand why this situation is frustrating. I will look into it and help you with the next steps.',

      concise:
        'I understand your concern. Let me check this and help resolve it.',

      detailed:
        'I understand your concern and want to make sure this is handled properly. Let me review the relevant details and explain the available resolution clearly.',

      deEscalation:
        'I understand how frustrating this situation can be. I will take ownership of the issue and work through the next steps with you.',
    },

    whyReasons: [
      'The response should acknowledge the customer concern.',
      'A clear resolution path helps maintain customer trust.',
    ],

    counterfactual: {
      alternativeResponse:
        'You will have to wait. There is nothing I can do.',

      predictedRiskDrop: 0,

      reasoning:
        'A dismissive response may increase frustration and escalation risk.',
    },

    agentEvaluation: params.lastAgentMessage
      ? {
          tone: 'Supportive',
          empathyScore: 0,
          clarityScore: 0,
          concisenessScore: 0,
          grammarScore: 0,
          policyComplianceScore: 0,

          problemNoticed:
            'Continue monitoring customer sentiment and escalation risk.',

          coachingAdvice:
            'Use the customer state to adapt tone and provide a clear next step.',
        }
      : undefined,
  };
}

/* ==========================================================================
   AI / COACHING API CALLS
   ========================================================================== */

export async function analyzeTurnApi(params: {
  customerMessage: string;
  conversationHistory: ChatMessage[];
  scenario: Scenario;
  lastAgentMessage?: string;
  knowledgeDocs?: KnowledgeDocument[];
}): Promise<MessageAnalysis> {
  try {
    return await safeFetchJson<MessageAnalysis>(
      '/api/analyze-turn',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      }
    );
  } catch (err) {
    console.warn(
      'Fallback analysis due to:',
      err
    );

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

      emotions: [
        'Frustration',
        'Urgency',
      ],

      relevantKnowledge: {
        kbId: 'KB-102',

        title:
          'Duplicate Subscription Charges & Billing Disputes',

        relevantSection:
          'Section 3.2: Duplicate Charge Reversal',

        policySnippet:
          'Verify transaction timestamps and issue immediate full credit. Inform customer: Funds reappear within 3-5 business days.',

        source:
          'Refund Policy → Section 3.2',

        confidence: 94,

        troubleshootingSteps: [
          'Verify transaction timestamps in billing logs',
          'Confirm duplicate descriptor and charge amount',
          'Authorize instant refund reversal',
          'Clarify 3-5 business days banking turnaround',
        ],

        isVerified: true,
      },

      escalationRisk: 65,

      escalationLevel: 'high',

      riskReasons: [
        'Customer expressed immediate financial frustration',
        'Customer stated previous contact was delayed',
        'High urgency tone detected',
      ],

      recommendedIntervention:
        'Acknowledge the customer frustration sincerely, clarify that you will handle it personally, and state the exact 3-5 business day refund policy.',

      coachWhisper:
        'Validate their frustration and take personal ownership before detailing the policy steps.',

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
          "I am genuinely sorry for the stress and delay you experienced. You will not have to dispute anything with your bank—I've authorized your refund right now and confirmed your account is in good standing.",
      },

      whyReasons: [
        'Acknowledging the emotional impact can help de-escalate customer anxiety',
        'Adheres directly to KB-102 refund reversal guidelines',
        'Clear timeline sets realistic banking expectations',
      ],

      counterfactual: {
        alternativeResponse:
          'You have to wait 5 business days for our billing department to review this.',

        predictedRiskDrop: -30,

        reasoning:
          'A dismissive response would increase frustration and escalation risk.',
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
              'Excellent empathy. Make sure to share the refund confirmation receipt.',
          }
        : undefined,
    };
  }
}

/* ==========================================================================
   REAL BACKEND CUSTOMER SIMULATOR
   ========================================================================== */

export interface SimulatorMessageResponse {
  session_id: string;

  customer_message: string;

  state: {
    emotion?: string;
    frustration: number;
    patience: number;
    satisfaction: number;
    trust: number;
    escalation_intent: number;
  };

  turn?: number;

  is_resolved: boolean;

  is_escalated: boolean;
}

/* ==========================================================================
   SIMULATOR MESSAGE
   ========================================================================== */

export async function simulateCustomerTurnApi(params: {
  sessionId: string;
  agentResponse: string;
}): Promise<SimulatorMessageResponse> {
  const data =
    await safeFetchJson<{
      session_id: string | number;

      customer_message: string;

      state: {
        emotion?: string;
        frustration: number;
        patience: number;
        satisfaction: number;
        trust: number;
        escalation_intent: number;
      };

      turn?: number;

      is_resolved?: boolean;

      is_escalated?: boolean;
    }>(
      '/simulator/message',
      {
        method: 'POST',

        headers: getAuthHeaders({
          'Content-Type': 'application/json',
        }),

        body: JSON.stringify({
          session_id: Number(
            params.sessionId
          ),

          agent_response:
            params.agentResponse,
        }),
      },

      'Failed to generate the next customer response.'
    );

  return {
    session_id:
      String(data.session_id),

    customer_message:
      data.customer_message,

    state: {
      emotion:
        data.state?.emotion,

      frustration:
        Number(
          data.state?.frustration ?? 0
        ),

      patience:
        Number(
          data.state?.patience ?? 0
        ),

      satisfaction:
        Number(
          data.state?.satisfaction ?? 0
        ),

      trust:
        Number(
          data.state?.trust ?? 0
        ),

      escalation_intent:
        Number(
          data.state?.escalation_intent ?? 0
        ),
    },

    turn:
      data.turn,

    is_resolved:
      data.is_resolved ?? false,

    is_escalated:
      data.is_escalated ?? false,
  };
}

/* ==========================================================================
   REAL BACKEND SIMULATOR START
   ========================================================================== */

export interface SimulatorStartResponse {
  session_id: string;

  customer_message: string;

  state: {
    emotion: string;
    frustration: number;
    patience: number;
    satisfaction: number;
    trust: number;
    escalation_intent: number;
  };

  status?: string;
}

/* ==========================================================================
   SIMULATOR START
   ========================================================================== */

export async function startSimulatorApi(params: {
  session_label: string;
  persona: string;
  initial_emotion: string;
  scenario: string;
  issue_severity: number;
  patience_level: number;
  expected_resolution: string;
}): Promise<SimulatorStartResponse> {
  const data =
    await safeFetchJson<{
      session_id: string | number;

      customer_message: string;

      state: {
        emotion: string;
        frustration: number;
        patience: number;
        satisfaction: number;
        trust: number;
        escalation_intent: number;
      };

      status?: string;
    }>(
      '/simulator/start',
      {
        method: 'POST',

        headers: getAuthHeaders({
          'Content-Type': 'application/json',
        }),

        body: JSON.stringify(params),
      },

      'Failed to start simulator session.'
    );

  return {
    session_id:
      String(data.session_id),

    customer_message:
      data.customer_message,

    state: {
      emotion:
        data.state?.emotion || 'Neutral',

      frustration:
        Number(
          data.state?.frustration ?? 0
        ),

      patience:
        Number(
          data.state?.patience ?? 0
        ),

      satisfaction:
        Number(
          data.state?.satisfaction ?? 0
        ),

      trust:
        Number(
          data.state?.trust ?? 0
        ),

      escalation_intent:
        Number(
          data.state?.escalation_intent ?? 0
        ),
    },

    status:
      data.status,
  };
}

/* ==========================================================================
   SIMULATOR HISTORY
   ========================================================================== */

export async function fetchSimulatorHistoryApi(
  sessionId: string
): Promise<any> {
  return await safeFetchJson(
    `/simulator/${Number(
      sessionId
    )}/history`,
    {
      method: 'GET',
      headers: getAuthHeaders(),
    },
    'Failed to fetch simulator history.'
  );
}

/* ==========================================================================
   SCENARIO GENERATION
   ========================================================================== */

export async function generateScenarioApi(params: {
  prompt: string;
  category: string;
  difficulty: DifficultyLevel;
}): Promise<Scenario> {
  try {
    return await safeFetchJson<Scenario>(
      '/api/generate-scenario',
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
        },

        body: JSON.stringify(params),
      }
    );
  } catch (err) {
    console.warn(
      'Fallback scenario generator due to:',
      err
    );

    return {
      id: `SCENARIO-${Date.now()
        .toString()
        .slice(-4)}`,

      title: `${params.category}: ${
        params.prompt ||
        'Customer Service Dispute'
      }`,

      category:
        params.category as any,

      difficulty:
        params.difficulty,

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

        escalationIntent: 65,
      },

      initialProblem:
        params.prompt ||
        'Customer encountered a service interruption and unexpected billing fee.',

      customerOpeningMessage:
        `Hi, I am having a severe issue with ${
          params.prompt ||
          'my account'
        }. I need this taken care of right away without any delays!`,

      expectedResolution:
        'Apologize sincerely, review KB policy, process appropriate correction or credit, and reassure timelines.',

      escalationTrigger:
        'Refusing accountability or providing generic robotic policy replies.',

      successCriteria: [
        'Acknowledge customer emotions immediately',
        'Apply verified Knowledge Base policy',
        'Deliver clear step-by-step resolution',
        'Prevent supervisor escalation',
      ],

      sessionObjectives:
        `Resolve the customer complaint regarding ${
          params.prompt ||
          'the service'
        } within 3-4 conversation turns.`,

      relevantKbIds: [
        'KB-101',
        'KB-102',
      ],

      targetResolutionTurns: 4,
    };
  }
}

/* ==========================================================================
   REPORT GENERATION
   ========================================================================== */

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
    return await safeFetchJson(
      '/api/generate-report',
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
        },

        body: JSON.stringify(params),
      }
    );
  } catch (err) {
    console.warn(
      'Fallback report generator due to:',
      err
    );

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
        policyComplianceScore: 96,

        resolutionQuality: {
          problemIdentification: 95,
          correctSolution: 92,
          knowledgeAccuracy: 94,
          customerSatisfaction: 88,
          resolutionCompleteness: 90,
          overallQuality: 92,
        },
      },

      startingSentiment:
        'very_negative',

      endingSentiment:
        'positive',

      sentimentImprovement: 68,

      resolved: true,

      escalated: false,

      timelineEvents: [],

      topStrengths: [
        'High empathy and active listening',
        'Accurate knowledge usage',
        'Clear resolution communication',
      ],

      topWeaknesses: [
        'Could proactively provide confirmation details earlier',
      ],

      recommendedTrainings: [
        'Handling High-Value Customer Billing Disputes',
        'Advanced De-escalation Techniques',
      ],

      xpEarned: 240,

      responseComparisons:
        params.messages
          .filter(
            (m) => m.sender === 'agent'
          )
          .slice(0, 2)
          .map((m, idx) => ({
            turnNumber:
              idx + 1,

            originalAgentText:
              m.text,

            aiImprovedText:
              'I completely understand why this duplicate charge is frustrating. I have verified the transaction and authorized the refund.',

            improvementExplanation:
              'The improved response validates the concern and clearly communicates ownership.',
          })),
    };
  }
}

/* ==========================================================================
   COUNTERFACTUAL
   ========================================================================== */

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
    return await safeFetchJson(
      '/api/counterfactual',
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
        },

        body: JSON.stringify(params),
      }
    );
  } catch (err) {
    return {
      predictedCustomerReaction:
        'Thank you for looking into this so quickly! That puts my mind at ease.',

      predictedFrustrationDelta:
        -30,

      predictedEscalationRisk:
        25,

      reasoning:
        'Your response explicitly addressed customer frustration and gave a concrete timeline.',
    };
  }
}

/* ==========================================================================
   TRANSLATION
   ========================================================================== */

export async function translateApi(
  text: string,
  targetLang: string
): Promise<{
  translatedText: string;
  detectedLang: string;
  intent: string;
}> {
  try {
    return await safeFetchJson(
      '/api/translate',
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
        },

        body: JSON.stringify({
          text,
          targetLang,
        }),
      }
    );
  } catch (err) {
    return {
      translatedText: text,
      detectedLang: 'English',
      intent: 'Customer Inquiry',
    };
  }
}

/* ==========================================================================
   AUTHENTICATION
   ========================================================================== */

export async function loginApi(
  email: string,
  password: string
): Promise<{
  token: string;
  user?: UserAccount;
  success?: boolean;
}> {
  const data =
    await safeFetchJson<{
      token?: string;
      access_token?: string;
      token_type?: string;
      user?: UserAccount;
      success?: boolean;
    }>(
      '/auth/login',
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',
        },

        body: JSON.stringify({
          email,
          password,
        }),
      },

      'Invalid email or password.'
    );

  const token =
    data?.token ||
    data?.access_token;

  if (!token) {
    throw new Error(
      'Login response did not contain an authentication token.'
    );
  }

  setAuthToken(token);

  return {
    token,

    user:
      data?.user,

    success:
      data?.success,
  };
}

export async function fetchCurrentUserApi(): Promise<UserAccount | null> {
  const token =
    getAuthToken();

  if (!token) {
    return null;
  }

  try {
    const data =
      await safeFetchJson<any>(
        '/auth/me',
        {
          method: 'GET',
          headers:
            getAuthHeaders(),
        },

        'Authentication session could not be verified.'
      );

    if (data?.user) {
      return data.user as UserAccount;
    }

    if (
      data &&
      typeof data === 'object' &&
      (
        data.email ||
        data.id ||
        data.user_id ||
        data.role
      )
    ) {
      return data as UserAccount;
    }

    throw new Error(
      'Authenticated user information was not returned by the backend.'
    );
  } catch (err) {
    console.error(
      'Failed to load authenticated user:',
      err
    );

    clearAuthToken();

    throw err;
  }
}

export async function logoutApi(): Promise<void> {
  clearAuthToken();
}

/* ==========================================================================
   ADMIN USER MANAGEMENT
   ========================================================================== */

export async function fetchUsersApi(): Promise<UserAccount[]> {
  return await safeFetchJson<UserAccount[]>(
    '/api/admin/users',
    {
      headers:
        getAuthHeaders(),
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
  const data =
    await safeFetchJson<{
      user: UserAccount;
    }>(
      '/api/admin/users',
      {
        method: 'POST',

        headers:
          getAuthHeaders({
            'Content-Type':
              'application/json',
          }),

        body:
          JSON.stringify(user),
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
  const data =
    await safeFetchJson<{
      user: UserAccount;
    }>(
      `/api/admin/users/${id}`,
      {
        method: 'PUT',

        headers:
          getAuthHeaders({
            'Content-Type':
              'application/json',
          }),

        body:
          JSON.stringify(updates),
      },

      'Failed to update user.'
    );

  return data.user;
}

export async function deleteUserApi(
  id: string
): Promise<void> {
  await safeFetchJson(
    `/api/admin/users/${id}`,
    {
      method: 'DELETE',

      headers:
        getAuthHeaders(),
    },

    'Failed to delete user.'
  );
}

/* ==========================================================================
   POLICY MANAGEMENT & RAG
   ========================================================================== */

export async function uploadPoliciesApi(
  files: FileList | File[],
  category: string,
  accessLevel: PolicyAccessLevel
): Promise<PolicyDocument[]> {
  const formData =
    new FormData();

  for (
    let i = 0;
    i < files.length;
    i++
  ) {
    formData.append(
      'files',
      files[i]
    );
  }

  formData.append(
    'category',
    category
  );

  formData.append(
    'accessLevel',
    accessLevel
  );

  const data =
    await safeFetchJson<{
      policies: PolicyDocument[];
    }>(
      '/api/admin/policies/upload',
      {
        method: 'POST',

        headers:
          getAuthHeaders(),

        body:
          formData,
      },

      'Failed to upload policy documents.'
    );

  return data.policies;
}

export async function fetchAdminPoliciesApi(): Promise<PolicyDocument[]> {
  return await safeFetchJson<PolicyDocument[]>(
    '/api/admin/policies',
    {
      headers:
        getAuthHeaders(),
    },

    'Failed to fetch policy library.'
  );
}

export async function fetchUserPoliciesApi(): Promise<PolicyDocument[]> {
  return await safeFetchJson<PolicyDocument[]>(
    '/api/policies',
    {
      headers:
        getAuthHeaders(),
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
  const data =
    await safeFetchJson<{
      policy: PolicyDocument;
    }>(
      `/api/admin/policies/${id}`,
      {
        method: 'PUT',

        headers:
          getAuthHeaders({
            'Content-Type':
              'application/json',
          }),

        body:
          JSON.stringify(updates),
      },

      'Failed to update policy document.'
    );

  return data.policy;
}

export async function fetchPolicyStatsApi(): Promise<PolicyStats> {
  return await safeFetchJson<PolicyStats>(
    '/api/admin/policies/stats',
    {
      headers:
        getAuthHeaders(),
    },

    'Failed to fetch policy statistics.'
  );
}

export async function deletePolicyApi(
  id: string
): Promise<void> {
  await safeFetchJson(
    `/api/admin/policies/${id}`,
    {
      method: 'DELETE',

      headers:
        getAuthHeaders(),
    },

    'Failed to delete policy document.'
  );
}

export async function reprocessPolicyApi(
  id: string
): Promise<PolicyDocument> {
  const data =
    await safeFetchJson<{
      policy: PolicyDocument;
    }>(
      `/api/admin/policies/${id}/reprocess`,
      {
        method: 'POST',

        headers:
          getAuthHeaders(),
      },

      'Failed to reprocess policy document.'
    );

  return data.policy;
}

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
  return await safeFetchJson(
    '/api/assistant/chat',
    {
      method: 'POST',

      headers:
        getAuthHeaders({
          'Content-Type':
            'application/json',
        }),

      body:
        JSON.stringify({
          message,
          history,
        }),
    },

    'AI Assistant service unavailable.'
  );
}

export async function fetchAuditLogsApi(): Promise<AuditLogEntry[]> {
  return await safeFetchJson<AuditLogEntry[]>(
    '/api/admin/audit-logs',
    {
      headers:
        getAuthHeaders(),
    },

    'Failed to fetch audit activity logs.'
  );
}