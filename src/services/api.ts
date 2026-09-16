// ============================================================
// CUSTOMER SUPPORT ASSISTANT
// FRONTEND API SERVICE
// ============================================================

const API_BASE_URL = (
  import.meta.env.VITE_API_URL ||
  "http://localhost:3009"
).replace(/\/+$/, "");

// ============================================================
// STORAGE
// ============================================================

const TOKEN_KEY = "csa_auth_token";
const USER_KEY = "csa_user";

// ============================================================
// TYPES
// ============================================================

export interface BackendUser {
  user_id: number;
  id?: string;
  name: string;
  email: string;
  role: string;
  is_active?: boolean;
  created_at?: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user_id: number;
  name: string;
  email: string;
  role: string;
}

export interface RegisterResponse {
  message: string;
  user_id: number;
  name: string;
  email: string;
  role: string;
}

// ============================================================
// CHAT
// ============================================================

export interface ChatMessage {
  id?: number;
  user_message?: string;
  assistant_message?: string;
  created_at?: string;
}

export interface ChatHistoryResponse {
  session_id: string;
  messages: ChatMessage[];
}

// ============================================================
// SIMULATOR
// ============================================================

export interface SimulatorStartRequest {
  session_label: string;
  persona: string;
  scenario: string;
  initial_emotion: string;
  issue_severity: number;
  patience_level: number;
  expected_resolution: string;
}

export interface SimulatorStartResponse {
  session_id: number;
  conversation_id: number;
  customer_message: string;
  state: any;
  turn: number;
  analysis?: any;
}

export interface SimulatorMessageResponse {
  session_id: number;
  customer_message: string;
  state: any;
  turn: number;
  is_resolved: boolean;
  is_escalated: boolean;
  analysis?: any;
}

export interface SimulatorHistoryResponse {
  session_id: number;
  status: string;
  messages: Array<{
    message_id: number;
    sender_type: string;
    message_text: string;
    message_type: string;
    timestamp: string;
  }>;
}

// ============================================================
// RAG
// ============================================================

export interface RAGResponse {
  question: string;
  answer: string;
  sources: any[];
}

export interface SearchResult {
  chunk_id: string;
  text: string;
  metadata: any;
  distance: number;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
}

// ============================================================
// DOCUMENTS
// ============================================================

export interface Document {
  document_id: number;
  document_name: string;
  document_type: string;
  version: number;
  status: string;
  filename: string;
  uploaded_by: string;
}

export interface DocumentsResponse {
  total_documents: number;
  documents: Document[];
}

export interface DocumentHistoryResponse {
  document_name: string;
  total_versions: number;
  versions: Array<{
    document_id: number;
    version: number;
    status: string;
    filename: string;
    document_type: string;
    uploaded_by: string;
  }>;
}

// ============================================================
// SUPPORT
// ============================================================

export interface SupportRequest {
  issue_type: string;
  message: string;
}

export interface SupportResponse {
  status: string;
  issue_type: string;
  support_response: string;
}

// ============================================================
// USERS
// ============================================================

export interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  role: "admin" | "employee";
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
  password?: string;
  role?: "admin" | "employee";
  is_active?: boolean;
}

export interface AdminUser {
  user_id: number;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface AdminUsersResponse {
  total_users: number;
  users: AdminUser[];
}

// ============================================================
// TOKEN
// ============================================================

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

// ============================================================
// STORED USER
// ============================================================

export function getStoredUser(): BackendUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);

    if (!raw) {
      return null;
    }

    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ============================================================
// SAVE USER
// ============================================================

function saveUser(data: {
  user_id: number;
  name: string;
  email: string;
  role: string;
  is_active?: boolean;
}): BackendUser {
  const user: BackendUser = {
    user_id: data.user_id,
    id: String(data.user_id),
    name: data.name,
    email: data.email,
    role: data.role,
    is_active: data.is_active
  };

  localStorage.setItem(
    USER_KEY,
    JSON.stringify(user)
  );

  return user;
}

// ============================================================
// LOGOUT
// ============================================================

export function logoutApi(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// ============================================================
// HEADERS
// ============================================================

function getHeaders(
  includeJson = true
): HeadersInit {
  const token = getAuthToken();

  const headers: HeadersInit = {};

  if (includeJson) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers["Authorization"] =
      `Bearer ${token}`;
  }

  return headers;
}

// ============================================================
// ERROR HANDLING
// ============================================================

async function getErrorMessage(
  response: Response
): Promise<string> {
  try {
    const data = await response.json();

    if (typeof data?.detail === "string") {
      return data.detail;
    }

    if (typeof data?.message === "string") {
      return data.message;
    }

    if (typeof data?.error === "string") {
      return data.error;
    }

    if (Array.isArray(data?.detail)) {
      return data.detail
        .map((item: any) =>
          item?.msg || "Validation error"
        )
        .join(", ");
    }

    return `API Error: ${response.status}`;
  } catch {
    return `API Error: ${response.status}`;
  }
}

// ============================================================
// GENERIC FETCH
// ============================================================

async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url =
    `${API_BASE_URL}${endpoint}`;

  console.log(
    `[CSA API] ${options.method || "GET"} ${url}`
  );

  let response: Response;

  try {
    response = await fetch(
      url,
      {
        ...options,

        headers: {
          ...getHeaders(
            options.body !== undefined
          ),

          ...(options.headers || {})
        }
      }
    );
  } catch (error) {
    console.error(
      "Backend connection error:",
      error
    );

    throw new Error(
      `Cannot connect to backend at ${API_BASE_URL}`
    );
  }

  if (!response.ok) {
    const message =
      await getErrorMessage(response);

    if (response.status === 401) {
      logoutApi();
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// ============================================================
// BACKEND CONNECTION
// ============================================================

export async function testBackendConnectionApi(): Promise<boolean> {
  try {
    const response =
      await fetch(
        `${API_BASE_URL}/docs`
      );

    return response.ok;
  } catch {
    return false;
  }
}

// ============================================================
// AUTH
// ============================================================

export async function registerApi(
  name: string,
  email: string,
  password: string
): Promise<RegisterResponse> {
  return apiFetch<RegisterResponse>(
    "/auth/register",
    {
      method: "POST",

      body: JSON.stringify({
        name,
        email,
        password
      })
    }
  );
}

export async function loginApi(
  email: string,
  password: string
) {
  const data =
    await apiFetch<LoginResponse>(
      "/auth/login",
      {
        method: "POST",

        body: JSON.stringify({
          email,
          password
        })
      }
    );

  localStorage.setItem(
    TOKEN_KEY,
    data.access_token
  );

  const user = saveUser({
    user_id: data.user_id,
    name: data.name,
    email: data.email,
    role: data.role
  });

  return {
    token: data.access_token,
    user
  };
}

export async function fetchCurrentUserApi() {
  const token = getAuthToken();

  if (!token) {
    return null;
  }

  try {
    const data =
      await apiFetch<{
        user_id: number;
        name: string;
        email: string;
        role: string;
      }>("/auth/me");

    return saveUser(data);
  } catch (error) {
    logoutApi();
    return null;
  }
}

// ============================================================
// CHAT
// ============================================================

export async function askAssistantApi(
  message: string,
  sessionId?: string
) {
  if (!message.trim()) {
    throw new Error(
      "Message cannot be empty."
    );
  }

  const finalSessionId =
    sessionId ||
    `chat-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`;

  return apiFetch<any>(
    "/chat/message",
    {
      method: "POST",

      body: JSON.stringify({
        session_id: finalSessionId,
        message,
        number_of_results: 3
      })
    }
  );
}

export async function getChatHistoryApi(
  sessionId: string
) {
  return apiFetch<ChatHistoryResponse>(
    `/chat/${encodeURIComponent(
      sessionId
    )}/history`
  );
}

// ============================================================
// RAG
// ============================================================

export async function askRAGApi(
  question: string,
  numberOfResults = 3
): Promise<RAGResponse> {
  if (!question.trim()) {
    throw new Error(
      "Question cannot be empty."
    );
  }

  return apiFetch<RAGResponse>(
    "/rag/ask",
    {
      method: "POST",

      body: JSON.stringify({
        question,
        number_of_results:
          numberOfResults
      })
    }
  );
}

// ============================================================
// SEMANTIC SEARCH
// ============================================================

export async function semanticSearchApi(
  query: string,
  numberOfResults = 3
): Promise<SearchResponse> {
  if (!query.trim()) {
    throw new Error(
      "Search query cannot be empty."
    );
  }

  return apiFetch<SearchResponse>(
    "/search/",
    {
      method: "POST",

      body: JSON.stringify({
        query,
        number_of_results:
          numberOfResults
      })
    }
  );
}

// ============================================================
// SIMULATOR
// ============================================================

export async function startSimulatorApi(
  request: SimulatorStartRequest
): Promise<SimulatorStartResponse> {
  return apiFetch<SimulatorStartResponse>(
    "/simulator/start",
    {
      method: "POST",

      body: JSON.stringify({
        session_label:
          request.session_label,

        persona:
          request.persona,

        scenario:
          request.scenario,

        initial_emotion:
          request.initial_emotion,

        issue_severity:
          request.issue_severity,

        patience_level:
          request.patience_level,

        expected_resolution:
          request.expected_resolution
      })
    }
  );
}

export async function sendSimulatorMessageApi(
  sessionId: number,
  agentResponse: string
): Promise<SimulatorMessageResponse> {
  if (!agentResponse.trim()) {
    throw new Error(
      "Agent response cannot be empty."
    );
  }

  return apiFetch<SimulatorMessageResponse>(
    "/simulator/message",
    {
      method: "POST",

      body: JSON.stringify({
        session_id:
          sessionId,

        agent_response:
          agentResponse
      })
    }
  );
}

export async function getSimulatorHistoryApi(
  sessionId: number
): Promise<SimulatorHistoryResponse> {
  return apiFetch<SimulatorHistoryResponse>(
    `/simulator/${sessionId}/history`
  );
}

// ============================================================
// APP COMPATIBILITY - CUSTOMER SIMULATOR
// ============================================================

export async function simulateCustomerTurnApi(
  payload: {
    scenario: any;
    conversationHistory: any[];
    agentResponse: string;
    currentCustomerState?: any;
  }
): Promise<SimulatorMessageResponse> {

  if (!payload?.agentResponse?.trim()) {
    throw new Error(
      "Agent response cannot be empty."
    );
  }

  const sessionId = Number(
    payload?.scenario?.session_id ??
    payload?.scenario?.sessionId ??
    payload?.scenario?.backendSessionId
  );

  if (!sessionId) {
    throw new Error(
      "No backend simulator session is available for this scenario."
    );
  }

  return sendSimulatorMessageApi(
    sessionId,
    payload.agentResponse
  );
}

// ============================================================
// ANALYSIS
// ============================================================

export async function analyzeCustomerMessageApi(
  sessionId: number,
  customerMessage: string
) {
  if (!sessionId) {
    throw new Error(
      "A valid session_id is required."
    );
  }

  if (!customerMessage?.trim()) {
    throw new Error(
      "Customer message cannot be empty."
    );
  }

  return apiFetch<any>(
    "/analysis/analyze",
    {
      method: "POST",

      body: JSON.stringify({
        session_id:
          sessionId,

        customer_message:
          customerMessage
      })
    }
  );
}

// ============================================================
// APP COMPATIBILITY - ANALYZE TURN
// ============================================================

export async function analyzeTurnApi(
  payload: any
) {
  const sessionId =
    Number(
      payload?.session_id ??
      payload?.sessionId ??
      payload?.scenario?.session_id ??
      payload?.scenario?.sessionId ??
      payload?.scenario?.backendSessionId
    );

  const customerMessage =
    payload?.customer_message ??
    payload?.customerMessage ??
    payload?.message ??
    "";

  if (!sessionId) {
    throw new Error(
      "Analysis requires a backend session_id."
    );
  }

  if (!customerMessage?.trim()) {
    throw new Error(
      "Customer message cannot be empty."
    );
  }

  return analyzeCustomerMessageApi(
    sessionId,
    customerMessage
  );
}

export async function getAnalysisHistoryApi(
  sessionId: number
) {
  return apiFetch<any[]>(
    `/analysis/${sessionId}/history`
  );
}

export async function getAnalysisSummaryApi(
  sessionId: number
) {
  return apiFetch<any>(
    `/analysis/${sessionId}/summary`
  );
}

export async function getAnalysisMetricsApi() {
  return apiFetch<any>(
    "/analysis/metrics"
  );
}

export async function getDecisionSupportApi(
  sessionId: number
) {
  return apiFetch<any>(
    `/analysis/${sessionId}/decision-support`
  );
}

export async function createDecisionSupportApi(
  sessionId: number
) {
  return apiFetch<any>(
    `/analysis/${sessionId}/decision-support`,
    {
      method: "POST"
    }
  );
}

// ============================================================
// DOCUMENTS / KNOWLEDGE BASE
// ============================================================

export async function fetchDocumentsApi(): Promise<DocumentsResponse> {
  return apiFetch<DocumentsResponse>(
    "/documents/"
  );
}

export async function fetchAdminPoliciesApi(): Promise<DocumentsResponse> {
  return fetchDocumentsApi();
}

// ============================================================
// DOCUMENT HISTORY
// ============================================================

export async function getDocumentHistoryApi(
  documentName: string
): Promise<DocumentHistoryResponse> {
  return apiFetch<DocumentHistoryResponse>(
    `/documents/history/${encodeURIComponent(
      documentName
    )}`
  );
}

// ============================================================
// UPLOAD DOCUMENT
// ============================================================

export async function uploadDocumentApi(
  file: File,
  documentName: string,
  documentType:
    | "policy"
    | "faq"
    | "support"
) {
  if (
    file.type !== "application/pdf"
  ) {
    throw new Error(
      "Only PDF files are allowed."
    );
  }

  if (!documentName.trim()) {
    throw new Error(
      "Document name cannot be empty."
    );
  }

  const token =
    getAuthToken();

  const formData =
    new FormData();

  formData.append(
    "file",
    file
  );

  formData.append(
    "document_name",
    documentName
  );

  formData.append(
    "document_type",
    documentType
  );

  const response =
    await fetch(
      `${API_BASE_URL}/documents/upload`,
      {
        method: "POST",

        headers: {
          ...(token
            ? {
                Authorization:
                  `Bearer ${token}`
              }
            : {})
        },

        body: formData
      }
    );

  if (!response.ok) {
    const message =
      await getErrorMessage(
        response
      );

    if (response.status === 401) {
      logoutApi();
    }

    throw new Error(message);
  }

  return response.json();
}

// ============================================================
// DELETE POLICY
// ============================================================

export async function deletePolicyApi(
  policyId: number | string
) {
  console.warn(
    "deletePolicyApi requested, but backend has no delete endpoint.",
    policyId
  );

  throw new Error(
    "Delete policy is not supported by the current backend."
  );
}

// ============================================================
// LIVE SUPPORT
// ============================================================

export async function submitSupportRequestApi(
  issueType: string,
  message: string
): Promise<SupportResponse> {
  return apiFetch<SupportResponse>(
    "/support/",
    {
      method: "POST",

      body: JSON.stringify({
        issue_type:
          issueType,

        message
      })
    }
  );
}

// ============================================================
// USER MANAGEMENT
// ============================================================

export async function fetchAdminUsersApi(): Promise<AdminUsersResponse> {
  return apiFetch<AdminUsersResponse>(
    "/users/"
  );
}

export async function fetchUsersApi(): Promise<AdminUsersResponse> {
  return fetchAdminUsersApi();
}

// ============================================================
// CREATE USER
// ============================================================

export async function createUserApi(
  request: CreateUserRequest
) {
  return apiFetch<any>(
    "/users/",
    {
      method: "POST",

      body: JSON.stringify({
        name:
          request.name,

        email:
          request.email,

        password:
          request.password,

        role:
          request.role
      })
    }
  );
}

// ============================================================
// UPDATE USER
// ============================================================

export async function updateUserApi(
  userId: number | string,
  data: UpdateUserRequest
) {
  console.warn(
    "updateUserApi called, but backend has no update endpoint.",
    {
      userId,
      data
    }
  );

  throw new Error(
    "Update user is not supported by the current backend."
  );
}

// ============================================================
// DELETE USER
// ============================================================

export async function deleteUserApi(
  userId: number | string
) {
  console.warn(
    "deleteUserApi called, but backend has no delete endpoint.",
    userId
  );

  throw new Error(
    "Delete user is not supported by the current backend."
  );
}

// ============================================================
// REPORT
// ============================================================

export async function getSessionReportDataApi(
  sessionId: number
) {
  const [
    summary,
    history,
    decisionSupport
  ] = await Promise.all([
    getAnalysisSummaryApi(
      sessionId
    ),

    getAnalysisHistoryApi(
      sessionId
    ),

    getDecisionSupportApi(
      sessionId
    )
  ]);

  return {
    summary,
    history,
    decisionSupport
  };
}

export async function generateReportApi(
  payload: any
) {
  const sessionId =
    Number(
      payload?.session_id ??
      payload?.sessionId ??
      payload?.scenario?.session_id ??
      payload?.scenario?.sessionId ??
      payload?.scenario?.backendSessionId
    );

  if (!sessionId) {
    throw new Error(
      "A valid backend session_id is required to generate the report."
    );
  }

  return getSessionReportDataApi(
    sessionId
  );
}

// ============================================================
// FUTURE / NOT IMPLEMENTED
// ============================================================

export async function counterfactualApi(
  _payload: any
) {
  throw new Error(
    "Counterfactual analysis is not currently exposed by the backend."
  );
}

export async function translateApi(
  _payload: any
) {
  throw new Error(
    "Translation API is not currently exposed by the backend."
  );
}

export async function fetchAuditLogsApi() {
  throw new Error(
    "Audit log API is not currently exposed by the backend."
  );
}

// ============================================================
// POLICY STATISTICS
// ============================================================

export async function fetchPolicyStatsApi() {
  const response =
    await fetchDocumentsApi();

  const documents =
    response?.documents || [];

  const policies =
    documents.filter(
      (doc) =>
        doc.document_type === "policy"
    );

  const faqs =
    documents.filter(
      (doc) =>
        doc.document_type === "faq"
    );

  const supportDocuments =
    documents.filter(
      (doc) =>
        doc.document_type === "support"
    );

  const activeDocuments =
    documents.filter(
      (doc) =>
        doc.status === "active"
    );

  const archivedDocuments =
    documents.filter(
      (doc) =>
        doc.status === "archived"
    );

  return {
    total:
      documents.length,

    total_documents:
      documents.length,

    policies:
      policies.length,

    faqs:
      faqs.length,

    support:
      supportDocuments.length,

    support_documents:
      supportDocuments.length,

    active:
      activeDocuments.length,

    archived:
      archivedDocuments.length
  };
}

// ============================================================
// REPROCESS POLICY
// ============================================================

export async function reprocessPolicyApi(
  policyId: number | string
) {
  console.warn(
    "reprocessPolicyApi requested, but the current backend does not expose a reprocess endpoint.",
    policyId
  );

  throw new Error(
    "Policy reprocessing is not currently supported by the backend."
  );
}

// ============================================================
// UPDATE POLICY
// ============================================================

export async function updatePolicyApi(
  policyId: number | string,
  data: any
) {
  console.warn(
    "updatePolicyApi called.",
    {
      policyId,
      data
    }
  );

  throw new Error(
    "Policy update is not currently supported by the backend. Upload a new PDF version instead."
  );
}

// ============================================================
// AI SCENARIO GENERATION
// ============================================================

export async function generateScenarioApi(
  payload: {
    prompt: string;
    category: string;
    difficulty: string;
  }
) {
  console.warn(
    "generateScenarioApi requested, but the current backend does not expose a scenario generation endpoint.",
    payload
  );

  throw new Error(
    "AI scenario generation is not currently supported by the backend."
  );
}

// ============================================================
// EXPORT
// ============================================================

export {
  API_BASE_URL
};