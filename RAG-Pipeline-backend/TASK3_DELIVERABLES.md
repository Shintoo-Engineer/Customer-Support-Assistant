# TASK 3 Deliverables — Customer Simulator Agent

This document maps the **Expected Output** requirements from `TASK3.docx` to the specific implementation files, functions, logs, and automated tests.

---

## Deliverables Mapping

| Expected Output Requirement | Satisfying Component / File / Command |
| :--- | :--- |
| **Customer Simulator Agent** | [`app/services/simulator_service.py`](file:///c:/Users/shrushti/Customer-Support-Assistant/RAG-Pipeline-backend/app/services/simulator_service.py) |
| **Persona and Scenario Configuration** | [`app/services/persona_service.py`](file:///c:/Users/shrushti/Customer-Support-Assistant/RAG-Pipeline-backend/app/services/persona_service.py) (6 personas) & [`app/services/scenario_service.py`](file:///c:/Users/shrushti/Customer-Support-Assistant/RAG-Pipeline-backend/app/services/scenario_service.py) (5 scenarios) |
| **Emotion / State Management** | [`app/services/simulator_state.py`](file:///c:/Users/shrushti/Customer-Support-Assistant/RAG-Pipeline-backend/app/services/simulator_state.py) (`initial_state`, `update_state`, `is_resolved`, `is_escalated`) |
| **Turn-by-Turn Response Generation** | `generate_customer_turn()` in [`app/services/simulator_service.py`](file:///c:/Users/shrushti/Customer-Support-Assistant/RAG-Pipeline-backend/app/services/simulator_service.py) |
| **API Integration** | [`app/api/simulator.py`](file:///c:/Users/shrushti/Customer-Support-Assistant/RAG-Pipeline-backend/app/api/simulator.py) (`POST /simulator/start`, `POST /simulator/message`, `GET /simulator/{session_id}/history`) |
| **Sample Conversation Logs** | [`logs/simulator/*.json`](file:///c:/Users/shrushti/Customer-Support-Assistant/RAG-Pipeline-backend/logs/simulator), generated via [`scripts/demo_simulator_conversations.py`](file:///c:/Users/shrushti/Customer-Support-Assistant/RAG-Pipeline-backend/scripts/demo_simulator_conversations.py) |
| **Test Cases Covering Customer Behaviors** | [`tests/test_simulator.py`](file:///c:/Users/shrushti/Customer-Support-Assistant/RAG-Pipeline-backend/tests/test_simulator.py) (16 automated tests via `pytest tests/test_simulator.py -v`) |

---

## How to Run

Execute the following commands from the `RAG-Pipeline-backend/` directory:

### 1. Initialize Database Tables
Creates the simulator tables (`scenarios`, `sessions`, `conversations`, `messages`) in `app.db`:
```bash
python scripts/create_simulator_table.py
```

### 2. Run Demo Conversations & Generate Logs
Executes 5 end-to-end multi-turn conversations across all 5 scenarios and distinct personas, and exports the JSON logs into `logs/simulator/`:
```bash
python scripts/demo_simulator_conversations.py
```

### 3. Run the Automated Test Suite
Runs all 16 isolated unit and integration tests covering the state machine, persona/scenario libraries, LLM fallback handling, and FastAPI endpoints:
```bash
pytest tests/test_simulator.py -v
```
