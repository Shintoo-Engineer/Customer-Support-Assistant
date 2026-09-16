# Task 4: Intent and Sentiment Analysis Agent

## 1. Objective

The objective of Task 4 is to develop an analysis agent that evaluates every customer message during a support conversation. The agent identifies the customer's intent, emotional state, sentiment, frustration level, satisfaction trend, escalation risk, and confidence while considering previous customer messages as conversation context.

The analysis is integrated with the Task 3 Customer Simulator Agent so that every newly generated customer message can be analyzed before the next support response.

---

## 2. System Flow

The implemented conversation flow is:

**Customer Simulator → Customer Message → Intent & Sentiment Analysis → Structured Analysis → Next Support Response**

For a multi-turn conversation, previous customer messages are passed to the analysis service so that the current message is not treated as an isolated interaction.

---

## 3. Analysis Components

The Task 4 analysis service is implemented in:

`backend/app/services/analysis_service.py`

The main entry point is:

`analyze_customer_message(message, conversation_history=None)`

It combines all analysis components and returns a structured result.

---

## 4. Customer Intent Classification

The system identifies the customer's primary support intent.

The supported intent categories are:

* `refund_status`
* `cancellation`
* `delivery_issue`
* `payment_issue`
* `account_issue`
* `complaint`
* `return_exchange`
* `general_inquiry`

The current message is analyzed first. If the message does not contain enough information to identify an intent, recent customer messages from the conversation history are considered.

This allows the system to preserve the topic of an ongoing conversation.

---

## 5. Customer Emotion Detection

The analysis service identifies the customer's emotional state using the language present in the message.

Supported emotion categories include:

* Happy
* Neutral
* Confused
* Worried
* Frustrated
* Angry
* Satisfied

The system checks for relevant emotional language and uses `neutral` when no stronger emotional signal is detected.

---

## 6. Frustration Scoring

Each customer message receives a frustration score from **0 to 10**.

The score considers signals such as:

* Negative or frustrated language
* Angry expressions
* Repeated complaints
* Escalation requests
* Repeated punctuation
* Multiple unresolved customer turns
* Language indicating that the issue has already been discussed

The score is clamped to the required range of 0–10.

A higher score indicates stronger evidence of customer frustration.

---

## 7. Sentiment Analysis

Each message is classified into one of three sentiment categories:

* **Positive**
* **Neutral**
* **Negative**

The implementation evaluates positive and negative language signals in the customer's message. Additional conversational signals, such as punctuation and complaint-related language, are also considered.

The resulting sentiment is used by the satisfaction-trend component.

---

## 8. Satisfaction Trend Tracking

The system compares the current customer message with previous customer messages to determine the direction of customer satisfaction.

The supported values are:

* **Improving**
* **Declining**
* **Stable**

The trend considers changes in sentiment and, when sentiment remains in the same category, changes in frustration.

For example, if previous messages were neutral but the current message becomes strongly negative or more frustrated, the satisfaction trend can become **Declining**.

This allows the system to track the progression of a conversation instead of analyzing each message independently.

---

## 9. Conversation Context Management

Conversation history is passed to the analysis service in the following structure:

```json
[
  {
    "sender_type": "Customer",
    "message_text": "I would like to know my refund status."
  },
  {
    "sender_type": "Support Agent",
    "message_text": "Let me check that for you."
  }
]
```

The analysis service primarily uses previous customer messages when determining conversational context.

This is particularly important when a customer's current message is short or ambiguous.

For example:

**Previous customer message:**

> I want to know where my refund is.

**Current customer message:**

> This is still not resolved.

The current message alone does not explicitly mention a refund, but the previous customer message provides the necessary context to maintain the `refund_status` intent.

---

## 10. Escalation-Risk Detection

The system classifies escalation risk into:

* **Low**
* **Medium**
* **High**

Risk is determined using signals including:

* Frustration level
* Explicit escalation language
* Repeated complaints
* Requests to speak with a manager or supervisor
* Conversation length
* Strongly negative customer language

High frustration or explicit escalation requests can result in a **High** escalation-risk classification.

---

## 11. Confidence

The analysis also returns a confidence value between **0 and 1**.

The confidence calculation is based on the available evidence in the message, including:

* Intent-related keyword matches
* Emotion-related signals
* Sentiment evidence
* Message characteristics

The value provides an indication of how strongly the available message evidence supports the resulting analysis.

---

## 12. API Endpoint

A dedicated analysis endpoint was implemented:

**POST `/support/analyze`**

### Request

```json
{
  "message": "I have already explained this twice. Where is my refund?",
  "conversation_history": []
}
```

### Response

```json
{
  "intent": "refund_status",
  "emotion": "frustrated",
  "sentiment": "negative",
  "frustration_level": 8,
  "satisfaction_trend": "declining",
  "escalation_risk": "high",
  "confidence": 0.94
}
```

The exact values depend on the message and conversation history being analyzed.

---

## 13. Integration with Task 3 Customer Simulator

The Task 4 analysis agent was integrated directly into the existing Task 3 simulator.

### Simulator start

When a simulation starts, the opening customer message is analyzed immediately.

The analysis is returned along with:

* Session ID
* Conversation ID
* Customer message
* Customer state
* Turn number

### Subsequent customer turns

When the support agent sends a response:

1. The simulator receives the support response.
2. The Customer Simulator generates the next customer message.
3. The generated customer message is passed to the Task 4 analysis service.
4. Previous conversation messages are provided as context.
5. The analysis result is returned with the new customer message.
6. The conversation record is updated with the latest intent, sentiment, and escalation risk.

Therefore, the implemented flow is:

**Customer Simulator → Generated Customer Message → Task 4 Analysis → Analysis Result → Next Support Response**

---

## 14. Conversation History

The simulator maintains the conversation history using the existing `Message` records.

The history endpoint is:

**GET `/simulator/{session_id}/history`**

Internal system-state messages are excluded from the returned dialogue history.

The history contains the actual customer and support-agent conversation, allowing the analysis component to use previous customer turns for contextual analysis.

---

## 15. Testing

Task 4 includes **24 unit tests** in:

`backend/tests/test_analysis_service.py`

The test coverage includes:

* 8 intent-classification tests
* 5 emotion-detection tests
* 3 sentiment-analysis tests
* 2 frustration-scoring tests
* 2 satisfaction-trend tests
* 3 escalation-risk tests
* 1 complete analysis-structure test

The complete test suite for the analysis service was executed successfully:

**24 passed**

This verifies the main Task 4 analysis components and their structured output.

---

## 16. Multi-Turn Demonstration

A multi-turn simulator conversation was also tested.

Example:

### Customer — Turn 1

> I would like to know my refund status.

The analysis identifies the conversation as a refund-related request.

### Support Agent

> Let me check that for you.

### Customer — Turn 2

> This is still not resolved and I am getting frustrated.

The analysis uses the previous customer message to retain the refund context while analyzing the new emotional and conversational signals.

An observed result included:

```json
{
  "intent": "refund_status",
  "emotion": "frustrated",
  "sentiment": "Neutral",
  "frustration_level": 4,
  "satisfaction_trend": "Declining",
  "escalation_risk": "Low",
  "confidence": 0.75
}
```

This demonstrates that the system uses conversation history rather than treating the second message as an isolated message.

---

## 17. Task 4 Deliverables Status

| Deliverable                       | Status               |
| --------------------------------- | -------------------- |
| Intent classification module      | Completed            |
| Emotion classification module     | Completed            |
| Sentiment analysis module         | Completed            |
| Frustration scoring mechanism     | Completed            |
| Satisfaction trend tracker        | Completed            |
| Escalation-risk detection         | Completed            |
| Conversation history management   | Completed            |
| API endpoint                      | Completed            |
| 20+ customer scenarios/unit tests | Completed — 24 tests |
| Technical documentation           | Completed            |
| Multi-turn working demonstration  | Completed            |

---

## 18. Current Implementation Characteristics

The current Task 4 implementation is a deterministic analysis service based on message and conversation signals. It does not depend on an external LLM for the analysis itself.

This provides predictable outputs for testing and makes the analysis components independently testable.

The Customer Simulator remains responsible for generating customer turns, while the Task 4 service analyzes those generated messages.

---

## 19. Future Improvements

Possible future improvements include:

* Using a trained or LLM-based classifier for more nuanced intent detection.
* Improving emotion recognition using contextual language models.
* Calibrating confidence using a larger evaluation dataset.
* Persisting all analysis attributes, including emotion and frustration, directly in dedicated database fields.
* Adding multilingual customer-message analysis.
* Using analysis results as inputs for the Knowledge Recommendation Agent and Live Response Guidance system.

---

## 20. Conclusion

Task 4 implements a structured Intent and Sentiment Analysis Agent capable of analyzing customer messages in real time while maintaining conversational context.

The system identifies intent, emotion, sentiment, frustration, satisfaction trend, escalation risk, and confidence. It is integrated with the Task 3 Customer Simulator and has been validated through API testing, multi-turn conversation testing, and 24 automated unit tests.

The completed Task 4 analysis pipeline provides the foundation for the next stage: the **Knowledge Recommendation Agent**, which will use customer messages and conversation context to retrieve relevant information from the existing RAG knowledge base.
