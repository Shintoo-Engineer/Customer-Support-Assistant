# Customer Support Assistant - Frontend

A modern, responsive, and clean **React + TypeScript** web application providing an intuitive user interface for the **Customer Support Assistant** AI platform.

The frontend connects directly to the real **RAG-Pipeline-backend** FastAPI server and demonstrates the complete integration of:
- **Task 2**: Semantic Vector Search & Retrieval-Augmented Generation (RAG)
- **Task 3**: Customer Simulator Agent (Dynamic persona selection, initial emotional state, and turn-by-turn state evolution)
- **Task 4**: Intent & Sentiment Analysis Agent (Real-time emotion badges, sentiment trends, 0-10 frustration gauge, escalation risk, and agent decision support)
- **Task 5**: Knowledge Recommendation Agent (Context-aware policy & troubleshooting recommendations with source attribution and response insertion)
- **Analytics & History**: Turn-by-turn conversation viewer and multi-turn session progression summary

---

## Features

### 1. Unified Dashboard
- Live backend connectivity monitor (http://localhost:8000).
- Active session resume banner with one-click access to the current training session.
- High-level architecture visualization detailing Task 2 through Task 5.
- Global telemetry metrics (total analyzed interactions, dominant intents, average frustration).

### 2. New Simulation Configuration (Task 3)
- **6 Customer Personas**: Calm, Confused, Frustrated, Angry, Impatient, Polite.
- **5 Real-World Scenarios**: Refund Request, Delayed Order, Payment Failure, Account Access Issue, Subscription Cancellation.
- **Customizable Dynamics**: Issue Severity slider (1-5), Customer Patience level (1-5), and Target Expected Resolution.
- Instant initialization calling POST /simulator/start to generate an authentic opening message and initial customer state.

### 3. Support Console (Primary 3-Column Workspace)
- **Column 1 — Customer State & Profile**:
  - Live customer metadata (Scenario, Persona, Turn counter, Ticket ID).
  - 5 dynamic state gauges (0-100%): Frustration, Trust, Patience, Satisfaction, Escalation Intent.
- **Column 2 — Interactive Conversation Thread**:
  - Turn-by-turn chat history with clear visual separation between customer complaints and support agent replies.
  - Quick-reply text area with auto-insert support from knowledge recommendations.
  - End session and escalate actions.
- **Column 3 — AI Sentiment Insights & Knowledge Recommendations**:
  - **Task 4 Real-Time Insights**: Detected Intent, Emotion Badge, Sentiment Badge, Frustration Gauge (0 to 10), Satisfaction Direction, and Escalation Warning.
  - **Task 4 Phase 6 Decision Support**: Recommended immediate actions for the support agent based on customer frustration and escalation risk.
  - **Task 5 Knowledge Recommendations**: Ranked recommendations retrieved from ChromaDB vector store with match percentage, source document title, chunk IDs, and a **" Use in Reply\** button.

### 4. Conversation History
- Complete chronological audit log of all customer and agent dialogue turns (GET /simulator/{session_id}/history).
- Formatted timestamps and sender roles.

### 5. Session Analysis Summary
- Post-session performance report (GET /analysis/{session_id}/summary).
- Average frustration, dominant emotion, resolution trajectory, and turn-by-turn progression table (GET /analysis/{session_id}/history).

### 6. Knowledge Base Explorer (Task 2 & Task 5 Standalone)
- **Context-Aware Recommendations**: Test query recommendations (POST /knowledge/recommend) with boundary rejection for irrelevant queries.
- **Semantic Vector Search**: Query raw ChromaDB embeddings (POST /search/).
- **RAG Q&A Engine**: Query the backend RAG pipeline (POST /rag/ask) with retrieved context citations.

---

## Tech Stack

- **Framework**: React 19 + TypeScript (Strict mode)
- **Build Tool**: Vite 8
- **Styling**: Tailwind CSS v4
- **Icons**: Lucide React
- **HTTP Client**: Centralized native etch client with friendly error handling

---

## Project Structure

`
frontend/
+-- .env # Environment config (VITE_API_BASE_URL=http://localhost:8000)
+-- .env.example # Template environment file
+-- index.html # HTML entry point
+-- package.json # Dependencies & scripts
+-- tsconfig.json # TypeScript configuration
+-- tsconfig.app.json # App compiler options (verbatimModuleSyntax enabled)
+-- vite.config.ts # Vite configuration with Tailwind CSS plugin
+-- src/
¦ +-- main.tsx # Application bootstrap
¦ +-- App.tsx # Main application shell with tab routing & session persistence
¦ +-- index.css # Tailwind styles & theme variables
¦ +-- types/
¦ ¦ +-- index.ts # TypeScript interfaces matching backend Pydantic models
¦ +-- api/
¦ ¦ +-- client.ts # Centralized HTTP request client with error handling
¦ ¦ +-- simulatorApi.ts # Task 3 Simulator API calls
¦ ¦ +-- supportApi.ts # Task 5 Phase 3 Support Orchestration API calls
¦ ¦ +-- analysisApi.ts # Task 4 Intent & Sentiment Analysis API calls
¦ ¦ +-- knowledgeApi.ts # Task 5 Knowledge Recommendation API calls
¦ ¦ +-- searchApi.ts # Task 2 Semantic Search & RAG API calls
¦ +-- components/
¦ +-- Navbar.tsx # Responsive header with session badge and backend status
¦ +-- Dashboard.tsx # System overview and quick navigation
¦ +-- NewSimulation.tsx # Scenario and persona selection form
¦ +-- SupportConsole.tsx # 3-column live agent workspace
¦ +-- ConversationHistory.tsx # Audit log dialogue viewer
¦ +-- SessionSummaryView.tsx # Analytics progression summary
¦ +-- KnowledgeExplorer.tsx # Task 2 Search & RAG explorer
¦ +-- EmotionBadge.tsx # Color-coded emotion & sentiment badges
¦ +-- FrustrationMeter.tsx # Visual 0-10 frustration bar
¦ +-- RecommendationCard.tsx # Task 5 recommendation card with source citation
¦ +-- DecisionSupportCard.tsx # Task 4 agent decision coaching card
`

---

## Getting Started

### Prerequisites
1. **Node.js**: v18.0.0 or later (v26 LTS recommended)
2. **Python Backend**: Ensure the FastAPI server in RAG-Pipeline-backend is running on http://localhost:8000.

### Starting the Backend
In a separate terminal:
`ash
cd C:\Users\shrushti\Customer-Support-Assistant\RAG-Pipeline-backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
`

### Installation
In the rontend directory:
`ash
cd C:\Users\shrushti\Customer-Support-Assistant\frontend
npm install
`

### Running in Development Mode
`ash
npm run dev
`
The application will start at:
`
http://localhost:5173
`

### Building for Production
`ash
npm run build
`
Creates an optimized production build in rontend/dist/.

---

## API Integration Map

| Frontend View | Action / Event | Backend Endpoint | Method |
|---|---|---|---|
| Navbar / Dashboard | Health Check | / | GET |
| New Simulation | Launch Session | /simulator/start | POST |
| Support Console | Agent Replies | /support/turn | POST |
| Support Console | Load Chat History | /simulator/{id}/history | GET |
| Support Console | Coaching Advice | /analysis/decision-support/{id} | GET |
| Conversation History | View All Messages | /simulator/{id}/history | GET |
| Session Summary | Overall Performance | /analysis/{id}/summary | GET |
| Session Summary | Turn Progression | /analysis/{id}/history | GET |
| Knowledge Base | Policy Recommendations | /knowledge/recommend | POST |
| Knowledge Base | Semantic Search | /search/ | POST |
| Knowledge Base | RAG Question Answering | /rag/ask | POST |

---

## Demo & Verification Flow

1. **Dashboard**: Verify the green **Backend Connected** indicator is visible.
2. **Launch Simulation**: Click **New Simulation**, select **Scenario: Refund Request**, **Persona: Frustrated**, **Severity: 4**, **Patience: 3**, and click **Start Customer Simulation**.
3. **Console View**: You will be redirected to the **Support Console**. Observe:
 - The opening customer complaint generated by the simulator.
 - Initial emotional state in the left panel (Frustration: 85, Patience: 30, Trust: 30).
 - Real-time Task 4 analysis on the right panel (Intent: efund, Emotion: rustrated or ngry, Frustration Level: 9/10, Escalation Risk: High).
 - Task 5 recommendations (e.g., *Refund & Return Policy*, *Customer Support FAQ*) with relevance scores.
4. **Interact**: Click **\Use in Reply\** on a relevant policy card or type an apologetic response, then click **Send Response**.
5. **State Progression**: Observe the next customer message, updated state metrics, and updated recommendations.
6. **Review Summary**: Click **View Session Summary** in the top navigation or banner to review the session's overall satisfaction trend and turn progression.
