// ============================================================
// CUSTOMER SUPPORT ASSISTANT
// FRONTEND API SERVICE
// Backend: FastAPI @ http://localhost:3009
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
  role: "admin" | "employee" | "customer" | string;
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

export interface ChatResponse {
  session_id?: string;
  user_message?: string;
  assistant_message?: string;
  answer?: string;
  sources?: any[];
  [key: string]: any;
}

// ============================================================
// RAG
// ============================================================

export interface RAGSource {
  chunk_id?: string;
  text?: string;
  metadata?: any;
  distance?: number;
  [key: string]: any;
}

export interface RAGResponse {
  question: string;
  answer: string;
  sources: RAGSource[];
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

export interface SimulatorMessageRequest {
  session_id: number;
  agent_response: string;
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

export interface SimulatorHistoryMessage {
  message_id: number;
  sender_type: string;
  message_text: string;
  message_type: string;
  timestamp: string;
}

export interface SimulatorHistoryResponse {
  session_id: number;
  status: string;
  messages: SimulatorHistoryMessage[];
}

// ============================================================
// ANALYSIS
// ============================================================

export interface AnalysisRequest {
  session_id: number;
  customer_message: string;
}

export interface AnalysisResponse {
  [key: string]: any;
}

export interface AnalysisHistoryResponse {
  [key: string]: any;
}

export interface AnalysisSummaryResponse {
  [key: string]: any;
}

export interface DecisionSupportResponse {
  [key: string]: any;
}

// ============================================================
// DOCUMENTS
// ============================================================

export type DocumentType =
  | "policy"
  | "faq"
  | "support";

export interface Document {
  document_id: number;
  document_name: string;
  document_type: DocumentType | string;
  version: number;
  status: string;
  filename: string;
  uploaded_by: string;
}

export interface DocumentsResponse {
  total_documents: number;
  documents: Document[];
}

export interface DocumentVersion {
  document_id: number;
  version: number;
  status: string;
  filename: string;
  document_type: string;
  uploaded_by: string;
}

export interface DocumentHistoryResponse {
  document_name: string;
  total_versions: number;
  versions: DocumentVersion[];
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

export type ManagedUserRole =
  | "admin"
  | "employee";

export interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  role: ManagedUserRole;
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

    return JSON.parse(raw) as BackendUser;
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
    is_active: data.is_active,
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

  const headers: Record<string, string> = {};

  if (includeJson) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
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
        .map(
          (item: any) =>
            item?.msg ||
            item?.message ||
            "Validation error"
        )
        .join(", ");
    }

    return `API Error: ${response.status}`;
  } catch {
    return `API Error: ${response.status}`;
  }
}

// ============================================================
// GENERIC API FETCH
// ============================================================

async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  console.log(
    `[CSA API] ${options.method || "GET"} ${url}`
  );

  let response: Response;

  try {
    response = await fetch(url, {
      ...options,
      headers: {
        ...getHeaders(
          options.body !== undefined
        ),
        ...(options.headers || {}),
      },
    });
  } catch (error) {
    console.error(
      "[CSA API] Backend connection error:",
      error
    );

    throw new Error(
      `Cannot connect to backend at ${API_BASE_URL}. Make sure FastAPI is running on port 3009.`
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

  const contentType =
    response.headers.get("content-type");

  if (
    !contentType?.includes(
      "application/json"
    )
  ) {
    return (await response.text()) as T;
  }

  return response.json();
}

// ============================================================
// BACKEND CONNECTION
// ============================================================

export async function testBackendConnectionApi(): Promise<boolean> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/docs`
    );

    return response.ok;
  } catch {
    return false;
  }
}

// ============================================================
// AUTH - REGISTER
// ============================================================

export async function registerApi(
  name: string,
  email: string,
  password: string
): Promise<RegisterResponse> {
  if (!name.trim()) {
    throw new Error("Name is required.");
  }

  if (!email.trim()) {
    throw new Error("Email is required.");
  }

  if (!password) {
    throw new Error("Password is required.");
  }

  return apiFetch<RegisterResponse>(
    "/auth/register",
    {
      method: "POST",
      body: JSON.stringify({
        name: name.trim(),
        email: email.trim(),
        password,
      }),
    }
  );
}

// ============================================================
// AUTH - LOGIN
// ============================================================

export async function loginApi(
  email: string,
  password: string
): Promise<{
  token: string;
  user: BackendUser;
}> {
  if (!email.trim()) {
    throw new Error("Email is required.");
  }

  if (!password) {
    throw new Error("Password is required.");
  }

  const data =
    await apiFetch<LoginResponse>(
      "/auth/login",
      {
        method: "POST",
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
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
    role: data.role,
  });

  return {
    token: data.access_token,
    user,
  };
}

// ============================================================
// AUTH - CURRENT USER
// ============================================================

export async function fetchCurrentUserApi(): Promise<BackendUser | null> {
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
        is_active?: boolean;
        created_at?: string;
      }>("/auth/me");

    return saveUser(data);
  } catch {
    logoutApi();
    return null;
  }
}

// ============================================================
// POLICY AI ASSISTANT
// IMPORTANT:
// Uses /rag/ask instead of /chat/message.
// /chat/message currently returns HTTP 422.
// ============================================================

export async function askAssistantApi(
  message: string,
  sessionId?: string
): Promise<ChatResponse> {
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

  console.log(
    "[CSA RAG] Asking:",
    message.trim()
  );

  const ragResponse =
    await apiFetch<RAGResponse>(
      "/rag/ask",
      {
        method: "POST",
        body: JSON.stringify({
          question: message.trim(),
          number_of_results: 3,
        }),
      }
    );

  console.log(
    "[CSA RAG] Response:",
    ragResponse
  );

  return {
    session_id: finalSessionId,
    user_message: message.trim(),
    assistant_message:
      ragResponse.answer,
    answer: ragResponse.answer,
    sources:
      ragResponse.sources || [],
  };
}

// ============================================================
// CHAT HISTORY
// ============================================================

export async function getChatHistoryApi(
  sessionId: string
): Promise<ChatHistoryResponse> {
  if (!sessionId.trim()) {
    throw new Error(
      "Chat session ID is required."
    );
  }

  return apiFetch<ChatHistoryResponse>(
    `/chat/${encodeURIComponent(
      sessionId
    )}/history`
  );
}

// ============================================================
// RAG DIRECT
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
        question: question.trim(),
        number_of_results:
          numberOfResults,
      }),
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
        query: query.trim(),
        number_of_results:
          numberOfResults,
      }),
    }
  );
}

// ============================================================
// SIMULATOR - START
// ============================================================

export async function startSimulatorApi(
  request: SimulatorStartRequest
): Promise<SimulatorStartResponse> {
  if (!request.session_label?.trim()) {
    throw new Error(
      "Session label is required."
    );
  }

  if (!request.persona?.trim()) {
    throw new Error(
      "Customer persona is required."
    );
  }

  if (!request.scenario?.trim()) {
    throw new Error(
      "Scenario is required."
    );
  }

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
          request.expected_resolution,
      }),
    }
  );
}

// ============================================================
// SIMULATOR - SEND AGENT RESPONSE
// ============================================================

export async function sendSimulatorMessageApi(
  sessionId: number,
  agentResponse: string
): Promise<SimulatorMessageResponse> {
  if (!sessionId) {
    throw new Error(
      "A valid simulator session ID is required."
    );
  }

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
        session_id: sessionId,
        agent_response:
          agentResponse.trim(),
      }),
    }
  );
}

// ============================================================
// SIMULATOR - HISTORY
// ============================================================

export async function getSimulatorHistoryApi(
  sessionId: number
): Promise<SimulatorHistoryResponse> {
  if (!sessionId) {
    throw new Error(
      "A valid simulator session ID is required."
    );
  }

  return apiFetch<SimulatorHistoryResponse>(
    `/simulator/${sessionId}/history`
  );
}

// ============================================================
// ANALYSIS
// ============================================================

export async function analyzeCustomerMessageApi(
  sessionId: number,
  customerMessage: string
): Promise<AnalysisResponse> {
  if (!sessionId) {
    throw new Error(
      "A valid session ID is required."
    );
  }

  if (!customerMessage?.trim()) {
    throw new Error(
      "Customer message cannot be empty."
    );
  }

  return apiFetch<AnalysisResponse>(
    "/analysis/analyze",
    {
      method: "POST",
      body: JSON.stringify({
        session_id: sessionId,
        customer_message:
          customerMessage.trim(),
      }),
    }
  );
}

// ============================================================
// ANALYSIS HISTORY
// ============================================================

export async function getAnalysisHistoryApi(
  sessionId: number
): Promise<any> {
  if (!sessionId) {
    throw new Error(
      "A valid session ID is required."
    );
  }

  return apiFetch<any>(
    `/analysis/${sessionId}/history`
  );
}

// ============================================================
// ANALYSIS SUMMARY
// ============================================================

export async function getAnalysisSummaryApi(
  sessionId: number
): Promise<AnalysisSummaryResponse> {
  if (!sessionId) {
    throw new Error(
      "A valid session ID is required."
    );
  }

  return apiFetch<AnalysisSummaryResponse>(
    `/analysis/${sessionId}/summary`
  );
}

// ============================================================
// ANALYSIS METRICS
// ============================================================

export async function getAnalysisMetricsApi(): Promise<any> {
  return apiFetch<any>(
    "/analysis/metrics"
  );
}

// ============================================================
// DECISION SUPPORT - GET
// ============================================================

export async function getDecisionSupportApi(
  sessionId: number
): Promise<DecisionSupportResponse> {
  if (!sessionId) {
    throw new Error(
      "A valid session ID is required."
    );
  }

  return apiFetch<DecisionSupportResponse>(
    `/analysis/${sessionId}/decision-support`
  );
}

// ============================================================
// DECISION SUPPORT - CREATE
// ============================================================

export async function createDecisionSupportApi(
  sessionId: number
): Promise<DecisionSupportResponse> {
  if (!sessionId) {
    throw new Error(
      "A valid session ID is required."
    );
  }

  return apiFetch<DecisionSupportResponse>(
    `/analysis/${sessionId}/decision-support`,
    {
      method: "POST",
    }
  );
}

// ============================================================
// DOCUMENTS
// ============================================================

export async function fetchDocumentsApi(): Promise<DocumentsResponse> {
  return apiFetch<DocumentsResponse>(
    "/documents/"
  );
}

// ============================================================
// ADMIN POLICIES
// ============================================================

export async function fetchAdminPoliciesApi(): Promise<DocumentsResponse> {
  return fetchDocumentsApi();
}

// ============================================================
// DOCUMENT HISTORY
// ============================================================

export async function getDocumentHistoryApi(
  documentName: string
): Promise<DocumentHistoryResponse> {
  if (!documentName.trim()) {
    throw new Error(
      "Document name is required."
    );
  }

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
  documentType: DocumentType
): Promise<any> {
  if (!file) {
    throw new Error(
      "PDF file is required."
    );
  }

  if (
    file.type !== "application/pdf" &&
    !file.name
      .toLowerCase()
      .endsWith(".pdf")
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

  const token = getAuthToken();

  const formData = new FormData();

  formData.append(
    "file",
    file
  );

  formData.append(
    "document_name",
    documentName.trim()
  );

  formData.append(
    "document_type",
    documentType
  );

  let response: Response;

  try {
    response = await fetch(
      `${API_BASE_URL}/documents/upload`,
      {
        method: "POST",
        headers: {
          ...(token
            ? {
                Authorization:
                  `Bearer ${token}`,
              }
            : {}),
        },
        body: formData,
      }
    );
  } catch {
    throw new Error(
      `Cannot connect to backend at ${API_BASE_URL}.`
    );
  }

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
// SUPPORT
// ============================================================

export async function submitSupportRequestApi(
  issueType: string,
  message: string
): Promise<SupportResponse> {
  if (!issueType.trim()) {
    throw new Error(
      "Issue type is required."
    );
  }

  if (!message.trim()) {
    throw new Error(
      "Support message cannot be empty."
    );
  }

  return apiFetch<SupportResponse>(
    "/support/",
    {
      method: "POST",
      body: JSON.stringify({
        issue_type:
          issueType.trim(),
        message:
          message.trim(),
      }),
    }
  );
}

// ============================================================
// USERS - LIST
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
// USERS - CREATE
// ============================================================

export async function createUserApi(
  request: CreateUserRequest
): Promise<any> {
  if (!request.name.trim()) {
    throw new Error(
      "Name is required."
    );
  }

  if (!request.email.trim()) {
    throw new Error(
      "Email is required."
    );
  }

  if (!request.password) {
    throw new Error(
      "Password is required."
    );
  }

  return apiFetch<any>(
    "/users/",
    {
      method: "POST",
      body: JSON.stringify({
        name:
          request.name.trim(),
        email:
          request.email.trim(),
        password:
          request.password,
        role:
          request.role,
      }),
    }
  );
}

// ============================================================
// REPORT DATA
// ============================================================

export async function getSessionReportDataApi(
  sessionId: number
) {
  if (!sessionId) {
    throw new Error(
      "A valid session ID is required."
    );
  }

  const [
    summary,
    history,
    decisionSupport,
  ] = await Promise.all([
    getAnalysisSummaryApi(
      sessionId
    ),
    getAnalysisHistoryApi(
      sessionId
    ),
    getDecisionSupportApi(
      sessionId
    ),
  ]);

  return {
    summary,
    history,
    decisionSupport,
  };
}

// ============================================================
// AUDIT LOGS - BACKWARD COMPATIBILITY
// ============================================================

export async function fetchAuditLogsApi(): Promise<any[]> {
  console.warn(
    "[CSA API] Audit log endpoint is not currently exposed by the backend."
  );

  return [];
}

// ============================================================
// USER MANAGEMENT - BACKWARD COMPATIBILITY
// ============================================================

export interface UpdateUserRequest {
  name?: string;
  email?: string;
  password?: string;
  role?: "admin" | "employee";
  is_active?: boolean;
}

export async function updateUserApi(
  userId: number | string,
  data: UpdateUserRequest
): Promise<any> {
  console.warn(
    "[CSA API] updateUserApi requested, but the current backend does not expose an update-user endpoint.",
    {
      userId,
      data,
    }
  );

  throw new Error(
    "User update is not currently supported by the backend."
  );
}

export async function deleteUserApi(
  userId: number | string
): Promise<any> {
  console.warn(
    "[CSA API] deleteUserApi requested, but the current backend does not expose a delete-user endpoint.",
    userId
  );

  throw new Error(
    "User deletion is not currently supported by the backend."
  );
}

// ============================================================
// EXPORT
// ============================================================

export {
  API_BASE_URL,
};