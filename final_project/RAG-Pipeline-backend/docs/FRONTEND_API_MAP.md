# Frontend API Map — Customer Support Assistant

This document specifies the exact REST API contracts implemented by the `RAG-Pipeline-backend` FastAPI server and serves as the single source of truth for the React + TypeScript frontend application.

---

## 1. Authentication & User Management API Contracts

| Feature | Method | Endpoint | Auth Required | Role Required | Request Body / Params | Response Structure | Error Behaviors | Frontend Usage |
|---|---|---|---|---|---|---|---|---|
| **User Login** | `POST` | `/auth/login` | No | Any | `LoginRequest`:<br>• `email: EmailStr`<br>• `password: str` | `200 OK`:<br>• `access_token: str`<br>• `token_type: "bearer"`<br>• `user_id: int`<br>• `name: str`<br>• `email: str`<br>• `role: str` | `401`: Invalid email or password<br>`403`: Inactive account | `Login.tsx`<br>Authenticates credentials, stores JWT in localStorage, redirects based on backend `role`. |
| **Verify Current User** | `GET` | `/auth/me` | Bearer Token | Any | Header: `Authorization: Bearer <token>` | `200 OK`:<br>• `user_id: int`<br>• `name: str`<br>• `email: str`<br>• `role: str` | `401`: Expired or invalid token | `App.tsx`<br>Restores authenticated session on page refresh. |
| **Register Customer** | `POST` | `/auth/register` | No | Public | `RegisterRequest`:<br>• `name: str`<br>• `email: EmailStr`<br>• `password: str` (min 8) | `201 Created`:<br>• `message: str`<br>• `user_id: int`<br>• `name: str`<br>• `email: str`<br>• `role: "customer"` | `400`: Validation error<br>`409`: Email already exists | Public customer self-registration. |
| **List Registered Users** | `GET` | `/users/` | Bearer Token | `admin` | Header: `Authorization: Bearer <token>` | `200 OK`:<br>• `total_users: int`<br>• `users: List[{ user_id, name, email, role, is_active, created_at }]` | `401`: Unauthorized<br>`403`: Forbidden for non-admins | `AdminPanel.tsx`<br>Displays real database user records in admin view. |
| **Create Admin / Employee** | `POST` | `/users/` | Bearer Token | `admin` | `CreateUserRequest`:<br>• `name: str`<br>• `email: EmailStr`<br>• `password: str`<br>• `role: "admin" \| "employee"` | `201 Created`:<br>• `message: str`<br>• `user_id: int`<br>• `name: str`<br>• `email: str`<br>• `role: str` | `400`: Validation error<br>`403`: Forbidden for non-admins<br>`409`: Email already registered | `AdminPanel.tsx`<br>Admin creates new privileged users. |

---

## 2. Core Application & Task Simulation API Contracts

| Feature | Task | Method | Endpoint | Auth | Request Body / Params | Response Structure | Error Behaviors | Frontend Usage |
|---|---|---|---|---|---|---|---|---|
| **Start Simulator Session** | Task 3 (+ Task 4 & 5 Turn 1) | `POST` | `/simulator/start` | Optional | `SimulatorStartRequest`:<br>• `session_label: str`<br>• `persona: str`<br>• `scenario: str`<br>• `initial_emotion: str`<br>• `issue_severity: int` (1-5)<br>• `patience_level: int` (1-5)<br>• `expected_resolution: str` | `200 OK`:<br>• `session_id: int`<br>• `conversation_id: int`<br>• `customer_message: str`<br>• `state: dict`<br>• `turn: int`<br>• `analysis: AnalysisResponse`<br>• `recommendations: List[KnowledgeRecommendation]`<br>• `no_relevant_information: bool`<br>• `contextual_query: str` | `400`: Invalid scenario or persona | `NewSimulation.tsx`, `Home.tsx` (Quick Start). Initializes customer session. |
| **Send Support Turn (Unified Loop)** | Task 5 Phase 3 (+ Task 3 & 4) | `POST` | `/support/turn` | Optional | `SupportTurnRequest`:<br>• `session_id: int`<br>• `agent_response: str` | `200 OK`:<br>• `session_id: int`<br>• `conversation_id: int`<br>• `customer_message: str`<br>• `state: dict`<br>• `turn: int`<br>• `is_resolved: bool`<br>• `is_escalated: bool`<br>• `analysis: AnalysisResponse`<br>• `recommendations: List[KnowledgeRecommendation]`<br>• `no_relevant_information: bool`<br>• `contextual_query: str` | `400`: Empty agent response<br>`404`: Session not found | `SupportConsole.tsx`<br>Sends agent reply, generates customer next message, updates Task 4 emotion, updates Task 5 recommendations. |
| **Next Customer Message** | Task 3 | `POST` | `/simulator/message` | Optional | `SimulatorMessageRequest`:<br>• `session_id: int`<br>• `agent_response: str` | `200 OK` (Same schema as `/support/turn`) | `400`: Empty text<br>`404`: Not found | Alternative Task 3 simulator turn generator. |
| **Get Conversation History** | Task 3 | `GET` | `/simulator/{session_id}/history` | Optional | Path: `session_id: int` | `200 OK`:<br>• `session_id: int`<br>• `status: str`<br>• `messages: List[{ message_id, sender_type, message_text, message_type, timestamp }]` | `404`: Session not found | `SupportConsole.tsx`, `Conversations.tsx`. Loads dialogue history. |
| **Analyze Customer Message** | Task 4 | `POST` | `/analysis/analyze` | Optional | `AnalysisRequest`:<br>• `session_id: int`<br>• `customer_message: str` | `200 OK` (`AnalysisResponse`):<br>• `intent: str`<br>• `emotion: str`<br>• `sentiment: str`<br>• `frustration_level: int` [0-10]<br>• `satisfaction_trend: str`<br>• `escalation_risk: str`<br>• `confidence: float` [0.0-1.0] | `400`: Empty message<br>`404`: Not found | Standalone live re-analysis panel. |
| **Get Session Analysis History** | Task 4 | `GET` | `/analysis/{session_id}/history` | Optional | Path: `session_id: int` | `200 OK`:<br>`List[TurnAnalysis]`:<br>• `turn: int`<br>• `intent: str`<br>• `emotion: str`<br>• `sentiment: str`<br>• `frustration_level: int`<br>• `satisfaction_trend: str`<br>• `escalation_risk: str`<br>• `confidence: float`<br>• `timestamp: str` | `404`: Session not found | History progression view. |
| **Get Session Analysis Summary** | Task 4 | `GET` | `/analysis/{session_id}/summary` | Optional | Path: `session_id: int` | `200 OK` (`SessionAnalysisSummary`):<br>• `session_id: int`<br>• `dominant_intent: str`<br>• `latest_emotion: str`<br>• `latest_sentiment: str`<br>• `current_frustration: int`<br>• `current_escalation_risk: str`<br>• `overall_satisfaction_direction: str`<br>• `average_confidence: float`<br>• `turn_count: int` | `404`: Session not found | `SessionSummaryView.tsx`. High-level session recap. |
| **Get Decision Support** | Task 4 Phase 6 | `GET` / `POST` | `/analysis/{session_id}/decision-support` | Optional | Path: `session_id: int` | `200 OK` (`DecisionSupportResult`):<br>• `priority: str` (low/med/high/critical)<br>• `recommended_tone: str`<br>• `recommended_action: str`<br>• `escalation_recommended: bool`<br>• `risk_flags: List[str]`<br>• `customer_needs: List[str]`<br>• `rationale: str`<br>• `confidence: float` | `404`: Session not found | `SupportConsole.tsx`. Downstream decision support. |
| **Recommend Knowledge** | Task 5 | `POST` | `/knowledge/recommend` | Optional | `KnowledgeRecommendationRequest`:<br>• `query: str`<br>• `session_id?: int`<br>• `conversation_id?: int` | `200 OK` (`KnowledgeRecommendationResult`):<br>• `query: str`<br>• `recommendations: List[KnowledgeRecommendation]`<br>  - `title: str`<br>  - `content: str`<br>  - `source: str`<br>  - `document_type: str`<br>  - `relevance_score: float`<br>• `no_relevant_information: bool`<br>• `contextual_query: str` | `400`: Empty query | `SupportConsole.tsx`. ChromaDB RAG recommendation. |
| **Semantic Search** | Task 2 | `POST` | `/search/` | Optional | `SearchRequest`:<br>• `query: str`<br>• `number_of_results: int = 3` | `200 OK`:<br>• `query: str`<br>• `results: List[{ chunk_id, text, metadata, distance }]` | `400`: Empty query | Direct vector similarity search in ChromaDB. |
| **Ask RAG Question** | Task 2 | `POST` | `/rag/ask` | Optional | `RAGRequest`:<br>• `question: str`<br>• `number_of_results: int = 3` | `200 OK`:<br>• `question: str`<br>• `answer: str`<br>• `sources: List[str]` | `400`: Empty question | Direct RAG question answering assistant. |
| **Live Support Ticket** | Core | `POST` | `/support/` | Optional | `SupportRequest`:<br>• `issue_type: str`<br>• `message: str` | `200 OK` (`SupportResponse`):<br>• `status: str`<br>• `issue_type: str`<br>• `support_response: str` | `400`: Empty message | Live support ticket submission. |

---

## 3. Strict Domain Enums (Backend Source of Truth)

### Customer Personas (Task 3):
- `calm`: Measured, balanced vocabulary, cooperative.
- `confused`: Hesitant, questioning sentences, ellipsis, uncertainty.
- `frustrated`: Exasperated, tense tone, rhetorical questions, mentions wasted time.
- `angry`: Aggressive, clipped sentences, demands immediate action, escalation threats.
- `impatient`: Rushed, brief, cuts straight to the point, dislikes small talk.
- `polite`: Warm, courteous, respectful pleasantries.

### Support Scenarios (Task 3):
- `refund`: Subscription renewal or unauthorized charge refund request.
- `delayed_order`: Delivery SLA breached, tracking exception.
- `payment_failure`: 3D-Secure timeout or credit card decline at checkout.
- `account_issue`: Two-factor authentication lockout and access restoration.
- `cancellation`: Subscription plan termination and auto-renewal opt-out.

### Intents (Task 4):
`refund`, `cancellation`, `delivery_issue`, `payment_issue`, `account_issue`, `complaint`, `return_exchange`, `general_inquiry`.

### Emotions (Task 4):
`happy`, `neutral`, `confused`, `worried`, `frustrated`, `angry`, `satisfied`.

### Sentiments (Task 4):
`positive`, `neutral`, `negative`.

### Satisfaction Trends (Task 4):
`improving`, `declining`, `stable`.

### Escalation Risks (Task 4):
`low`, `medium`, `high`.

### Decision Priorities (Task 4 Phase 6):
`low`, `medium`, `high`, `critical`.
