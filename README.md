# Customer Support Assistant – Role-Based Access + Admin Policy Knowledge Base

> **Role-Based Customer Support & Employee Assistant System with Admin Policy RAG Engine, Multi-File/Folder Uploads, Anti-Hallucination Guardrails & Cited Q&A**

---

## 🔐 Role-Based Access Control (RBAC) & Accounts

The application supports three distinct user roles with strict JWT-based server authentication and backend authorization:

### 1. 🛡️ ADMIN (`admin`)
* Full system access & control center
* User Management: Create, edit, assign roles, activate/deactivate, or delete users
* Policy Management: Drag-and-drop single/multi-file or entire folder uploads (PDF, DOCX, DOC, TXT, CSV, XLSX)
* Access Level Configuration: Set document permissions (`PUBLIC`, `EMPLOYEE`, `TRAINER`, `ADMIN`)
* RAG Processing: Reprocess documents, manage chunking, and view extracted text
* View immutable system activity Audit Logs
* AI Policy Assistant Q&A

### 2. 🎓 TRAINER (`trainer`)
* Access Trainer Dashboard & Assigned Employee List
* Create custom AI customer practice scenarios with specified difficulty levels & personas
* Launch Interactive Practice Simulator & Live Console
* AI Policy Assistant Q&A (access to `PUBLIC`, `EMPLOYEE`, and `TRAINER` policies)
* Restricted from Admin Dashboard, User Management, and Policy File Uploads/Deletions (HTTP 403 Forbidden enforced)

### 3. 👤 EMPLOYEE (`employee`)
* Access Employee Dashboard & Practice Console
* Search & download employee-accessible company policy documents
* Ask AI Policy Assistant questions with verified source citations
* Restricted from Admin Dashboard, User Management, Policy Management, and System Settings (HTTP 403 Forbidden enforced)

---

## 🔑 Demo Credentials for Testing

| Role | Email | Password | Allowed Access |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@example.com` | `Admin123!` | Admin Dashboard, User Management, Policy Uploads (RAG), Audit Logs, AI Assistant |
| **Trainer** | `trainer@example.com` | `Trainer123!` | Trainer Dashboard, Assigned Employees, Scenarios, Practice Console, AI Assistant |
| **Employee** | `employee@example.com` | `Employee123!` | Employee Dashboard, Support Simulator, Policy Library, AI Assistant |

---

## 📁 Admin Policy Upload & Document RAG Pipeline

1. **Multi-File & Folder Batch Upload**: Admin selects files or an entire folder (`webkitdirectory`).
2. **Text Extraction & Cleaning**: Automatically parses text from PDF, DOCX, TXT, CSV, XLSX formats.
3. **Chunking & Indexing**: Segments extracted text into ~500-character vector chunks with section metadata.
4. **Role Access Restriction**: Chunks inherit policy access levels (`PUBLIC`, `EMPLOYEE`, `TRAINER`, `ADMIN`).
5. **Anti-Hallucination Guardrail**: If requested information is absent in company policies, AI responds:
   > *"I couldn't find this information in the available company policies. Please contact HR or your administrator for clarification."*
6. **Source Citations**: AI responses include verified source citations (`Document Title — Section — Page Number`).
* Assign training activities.

### 🤖 AI System

AI is the intelligence layer of the application.

It performs tasks such as:

* Customer simulation.
* Intent detection.
* Sentiment analysis.
* Knowledge retrieval.
* Response generation.
* Coaching.
* Escalation prediction.
* Performance evaluation.

---

# ✨ Key Features

## 1. Customer Simulator

The AI behaves like a real customer based on:

* Customer persona
* Problem scenario
* Difficulty level
* Conversation history
* Agent responses

The customer can be:

* Calm
* Confused
* Impatient
* Frustrated
* Angry
* Highly demanding

The simulator dynamically changes its behavior based on how the agent responds.

---

## 2. Manual Message Mode

Agents can enter or paste a customer message.

The system analyzes the message and provides:

* Customer intent
* Sentiment
* Emotion
* Frustration level
* Relevant knowledge
* Suggested response
* Escalation risk

---

## 3. Replay Training Mode

Agents can practice using previously recorded support conversations.

Features include:

* Step-by-step transcript replay
* Original response review
* Alternative response generation
* AI evaluation
* Improved response suggestions

---

## 4. Real-Time AI Coaching

The assistant provides guidance during the interaction.

Example:

> 💡 **Coach:** Acknowledge the customer's frustration before explaining the refund policy.

It can evaluate:

* Tone
* Empathy
* Clarity
* Professionalism
* Conciseness
* Grammar
* Policy adherence

---

## 5. RAG-Powered Knowledge Base

The application uses **Retrieval-Augmented Generation (RAG)** to retrieve relevant information from company documents.

Supported knowledge sources can include:

* FAQs
* Refund policies
* Product documentation
* Troubleshooting guides
* Shipping policies
* Internal support documents

### RAG Pipeline

```text
Company Documents
       ↓
Text Extraction
       ↓
Document Chunking
       ↓
Embeddings
       ↓
Vector Database
       ↓
Semantic Search
       ↓
Relevant Knowledge
       ↓
AI Response
```

The system can provide the source of the recommendation to reduce hallucination.

---

## 6. Intent & Sentiment Analysis

The system identifies what the customer needs and how they feel.

### Intent Examples

* Billing Issue
* Refund Request
* Account Problem
* Technical Support
* Delivery Issue
* Subscription Cancellation
* Product Complaint

### Sentiment

* Positive
* Neutral
* Negative
* Very Negative

### Emotion

* Frustration
* Anger
* Confusion
* Anxiety
* Satisfaction
* Disappointment
* Urgency

---

## 7. Escalation Risk Detection

The system continuously evaluates the possibility of escalation.

Example:

```text
Escalation Risk: 78%
Risk Level: HIGH
```

Possible risk factors:

* Increasing customer frustration
* Repeated complaints
* Previous failed support
* Negative language
* Request for supervisor
* Poor agent response
* Unresolved issue

The system also provides recommended intervention strategies.

---

## 8. Performance Analytics

After each session, the system generates a performance report.

Example:

```text
Overall Score          88%

Communication          91%
Knowledge              96%
Problem Solving        89%
Empathy                84%
De-escalation          78%
Policy Adherence       96%
```

---

## 9. Skill Mastery Profile

The application tracks long-term agent development.

Example:

```text
Communication Clarity       91%
Policy & KB Adherence       96%
Knowledge Retrieval         93%
Problem Solving             89%
Empathy & Validation        84%
De-escalation Under Stress  78%
```

This helps identify individual strengths and weaknesses.

---

## 10. Personalized Training

The system recommends training scenarios based on the agent's performance.

For example:

> **Weak Area:** De-escalation
> **Recommended Practice:** Angry Customer Simulation

The difficulty can also adapt according to the agent's performance.

---

## 11. Gamification

To encourage continuous learning, the platform can include:

* XP
* Levels
* Badges
* Daily challenges
* Training streaks
* Leaderboards
* Achievements

---

# 🧠 AI Agents

The platform uses a multi-agent architecture.

```text
                    AI ORCHESTRATOR
                           │
       ┌───────────────────┼───────────────────┐
       ↓                   ↓                   ↓
Customer Simulator   Intent & Sentiment    Knowledge/RAG
       │                   │                   │
       └───────────────────┼───────────────────┘
                           ↓
                   Coaching Agent
                           │
                           ↓
                 Escalation Monitor
                           │
                           ↓
                 Summary & Report Agent
```

### Customer Simulator Agent

Generates realistic customer messages.

### Intent & Sentiment Agent

Analyzes customer intent, emotion, sentiment, and frustration.

### Knowledge Recommendation Agent

Retrieves relevant information from the knowledge base.

### Coaching & Response Agent

Provides response suggestions and communication feedback.

### Escalation Risk Agent

Predicts escalation probability and recommends intervention.

### Post-Interaction Summary Agent

Generates the final session summary and performance report.

---

# 🖥️ Application Workflow

```text
Login
  ↓
Dashboard
  ↓
Select Interaction Mode
  ↓
Select Scenario
  ↓
Start Conversation
  ↓
Customer Message
  ↓
AI Analysis
  ↓
Knowledge + Coaching + Risk Analysis
  ↓
Agent Response
  ↓
Next Conversation Turn
  ↓
Session Complete
  ↓
Performance Report
  ↓
Personalized Training Recommendation
```

---

# 📊 Main Application Modules

1. **Authentication & User Management**
2. **Dashboard**
3. **Session Configuration**
4. **Simulator Mode**
5. **Manual Message Mode**
6. **Replay Training Mode**
7. **Customer Simulator**
8. **Multi-Agent AI Pipeline**
9. **Knowledge Base & RAG**
10. **Real-Time Coaching**
11. **Escalation Risk Detection**
12. **Performance Reports**
13. **Personalized Coaching**
14. **Training & Scenarios**
15. **Analytics**
16. **Gamification**
17. **Admin Management**

---

# 🗃️ Main Entities

```text
User
Role
Team
AgentProfile

Session
Scenario
CustomerPersona
Conversation
Message

IntentAnalysis
SentimentAnalysis
KnowledgeDocument
KnowledgeRecommendation

CoachingRecommendation
SuggestedResponse
EscalationAssessment

PerformanceReport
PerformanceScore
SkillProfile

TrainingPlan
TrainingAssignment
Achievement
Notification
AuditLog
```

---

# 🏗️ High-Level Architecture

```text
                     FRONTEND
                         │
                         ↓
                    API LAYER
                         │
                         ↓
                SESSION ORCHESTRATOR
                         │
                         ↓
                  AI ORCHESTRATOR
                         │
        ┌────────────────┼────────────────┐
        ↓                ↓                ↓
    AI AGENTS          RAG            RISK ENGINE
        │                │                │
        └────────────────┼────────────────┘
                         ↓
                    AI RESPONSE
                         │
                         ↓
                  REAL-TIME UI
                         │
                         ↓
                 PERFORMANCE REPORT
```

---

# 🛠️ Technology Stack

### Frontend

* React
* TypeScript
* Tailwind CSS
* Modern responsive UI

### Backend

* Python
* FastAPI
* REST APIs
* WebSockets

### AI

* Large Language Model
* Multi-Agent Architecture
* Prompt Engineering
* Structured AI Outputs

### RAG

* Embeddings
* Vector Search
* PostgreSQL + pgvector / Vector Database
* Document Processing

### Database

* PostgreSQL

### Caching / Real-Time

* Redis
* WebSockets

### Deployment

* Docker
* Cloud deployment

---

# 🔐 Security Features

The application can implement:

* Authentication
* Role-Based Access Control
* Secure API keys
* PII detection and masking
* Data encryption
* Session access control
* Audit logs
* Knowledge-source validation
* AI confidence scores

---

# 🚀 Future Enhancements

Future versions can include:

* 🎙️ Voice-based customer support
* 🌐 Multilingual support
* 📞 Real-time call coaching
* 🧠 Adaptive AI training
* 🔌 CRM integration
* 💬 WhatsApp/Teams integration
* 📈 Advanced team analytics
* 🔍 Knowledge quality monitoring
* 📊 Predictive performance analytics

---

# 💡 Unique Features

The key differentiating features of **Customer Support Assistant** are:

### 1. Adaptive Customer Simulator

The AI customer's frustration and behavior change according to the agent's responses.

### 2. Real-Time Coach

The system provides short, actionable coaching while the conversation is happening.

### 3. Explainable Recommendations

The agent can understand **why** a particular response was recommended.

### 4. Escalation Prediction

The system identifies potential escalation before the conversation reaches a critical point.

### 5. Counterfactual Coaching

The system can compare:

```text
Agent's Actual Response
          ↓
Actual Risk

Recommended Response
          ↓
Potentially Lower Risk
```

### 6. Adaptive Difficulty

Training difficulty automatically changes according to the agent's performance.

---

# 🎯 Project Outcomes

The **Customer Support Assistant** aims to:

* Improve agent communication skills.
* Increase first-interaction resolution.
* Reduce unnecessary escalations.
* Improve knowledge usage.
* Improve customer satisfaction.
* Reduce training time.
* Provide personalized agent development.
* Transform traditional reactive training into continuous AI-assisted learning.

---

# 📌 Project Vision

> **Customer Support Assistant transforms customer-support training from a reactive, post-interaction process into a proactive, real-time learning experience.**

It combines **AI simulation, multi-agent analysis, RAG-powered knowledge retrieval, live coaching, escalation detection, and performance analytics** into a single platform.

---

## 👨‍💻 Project Team

**Project:** Customer Support Assistant
**Type:** AI-Powered Customer Support & Training Platform
**Architecture:** Multi-Agent AI + RAG
**Primary User:** Customer Support Agent
**Platform Manager:** Admin / Manager
