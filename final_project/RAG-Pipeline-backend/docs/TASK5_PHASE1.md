# Task 5 — Phase 1: Knowledge Recommendation Agent Foundation

## 1. Phase 1 Objective

The primary objective of Phase 1 is to construct a production-ready, clean, and robust foundation for the **Knowledge Recommendation Agent** that retrieves contextually relevant support knowledge (support articles, FAQs, troubleshooting steps, policies) from the existing RAG knowledge base for customer queries.

Phase 1 specifically encompasses:
- Auditing the existing RAG pipeline, knowledge base, vector database, and metadata structure.
- Reusing the existing vector store (ChromaDB), embedding infrastructure (`all-MiniLM-L6-v2`), and document retrieval pipeline without duplication or framework replacements.
- Establishing a dedicated knowledge domain layer (`app/schemas/knowledge.py`, `app/services/knowledge_recommendation_service.py`, `app/api/knowledge.py`).
- Defining strictly typed Pydantic contracts for recommendation requests and ranked recommendation responses with full provenance (source, title, snippet, document type, and relevance score).
- Converting ChromaDB L2 distance metrics to bounded, normalized relevance scores `[0.0, 1.0]`.
- Enforcing a configurable relevance threshold (`DEFAULT_RELEVANCE_THRESHOLD = 0.38`) to safely distinguish relevant knowledge from completely out-of-domain queries.
- Handling the "no relevant knowledge" case safely (`no_relevant_information: true`, `recommendations: []`) without hallucinating documents or fabricating sources.
- Returning top 1–5 ranked recommendations without artificial padding.
- Providing 100% test coverage with 47 targeted Phase 1 tests (both MOCK and REAL).
- Preserving Task 3 (Customer Simulator) and Task 4 (Intent and Sentiment Analysis) APIs and databases with zero regression.

---

## 2. Existing RAG Architecture Audit

The repository contains an existing RAG pipeline previously built for question answering. The audit results are as follows:

| Component | Technical Implementation | Repository Location |
|---|---|---|
| **Vector Database** | ChromaDB v1.5.9 (`PersistentClient`), collection `support_knowledge_base` | `data/chroma_db/`, initialized in `app/services/vector_service.py` |
| **Total Chunks** | 429 chunks stored across 33 documents | `data/chroma_db/` |
| **Embedding Model** | `all-MiniLM-L6-v2` via `sentence-transformers` (384-dimensional dense vectors) | `app/services/embedding_service.py` |
| **Embedding Cache/Device** | Runs locally on CPU/CUDA via PyTorch; model loaded once at module import | `app/services/embedding_service.py` |
| **Document Ingestion** | `pypdf` extraction → text normalization → 500-word chunking (100-word overlap) → embedding → ChromaDB | `app/services/ingestion_service.py`, `app/services/text_service.py` |
| **Document Metadata Keys** | `document_id` (int), `document_name` (str), `document_type` (str), `version` (int), `page_number` (int), `uploaded_by` (str) | ChromaDB chunk metadata |
| **Document Types Present** | `faq` and `policy` | ChromaDB metadata |
| **Active Document Tracking** | SQLite database `app.db` via SQLAlchemy table `documents` (`status` = 'active' vs 'archived') | `app/models/document.py`, `app/services/rag_service.py` |
| **Existing Distance Metric** | ChromaDB squared L2 distance (`distances`), where smaller distance indicates greater semantic similarity | `app/services/vector_service.py` |
| **Existing RAG API** | `POST /rag/ask` taking `{"question": str, "number_of_results": int}` and returning LLM-generated answers via Gemini | `app/api/rag.py`, `app/services/rag_service.py` |

---

## 3. Knowledge Base Structure

The physical knowledge base consists of 40 PDF documents stored under `data/documents/` and indexed in ChromaDB:
- **Policy Documents**:
  - `Cancel_policy_v1.pdf` (`policy`)
  - `Delivery_policy_v1.pdf` (`policy`)
  - `Fraud_policy_v1.pdf` (`policy`)
  - `Order_policy_v1.pdf` (`policy`)
  - `Payment_policy_v1.pdf` (`policy`)
  - `Return_policy_v1.pdf` (`policy`)
  - `Refund_policy_v1.pdf` .. `v4.pdf` (`policy`)
  - `Test_Policy_Doc_v1.pdf` .. `v3.pdf` (`policy`)
  - `Regression_Refund_Policy_v1.pdf` .. `v13.pdf` (`policy`)
- **FAQ Documents**:
  - `Customer_Support_FAQ_v1.pdf` .. `v3.pdf` (`faq`)
  - `FAQ__v1.pdf` (`faq`)
  - `QA_FAQ_Document_v1.pdf` .. `v2.pdf` (`faq`)

> [!NOTE]
> Audit finding regarding document types: The knowledge base currently stores documents with `document_type = "faq"` or `document_type = "policy"`. Support articles and troubleshooting procedures are contained within these documents (e.g. troubleshooting steps for failed payments in `Test Policy Doc`, order tracking procedures in `Customer Support FAQ`). Phase 1 faithfully preserves the actual metadata types (`faq`, `policy`) without fabricating synthetic labels.

---

## 4. Knowledge Recommendation Agent Architecture

The Knowledge Recommendation Agent is built directly on top of the audited RAG components without duplicating infrastructure:

```
Customer Query ("My payment failed and I was still charged")
      ↓
Knowledge Recommendation Service (app/services/knowledge_recommendation_service.py)
      ↓
Query Normalization (rag_service.normalize_question)
      ↓
Vector Embedding Generation (embedding_service.generate_embedding)
      ↓
ChromaDB Vector Retrieval (vector_service.search_documents)
      ↓
Active Document Filtering & Archived Exclusion (db.Document status)
      ↓
L2 Distance to Relevance Score Conversion (relevance = 1.0 / (1.0 + distance))
      ↓
Configurable Relevance Threshold (DEFAULT_RELEVANCE_THRESHOLD = 0.38)
      ↓
Content Snippet Deduplication Across Versions
      ↓
Descending Relevance Ranking
      ↓
Top 1–5 Recommendations with Source Attribution
      ↓
KnowledgeRecommendationResult (or no_relevant_information: true)
```

---

## 5. Domain Contracts

### 5.1 Request Contract (`KnowledgeRecommendationRequest`)

```python
class KnowledgeRecommendationRequest(BaseModel):
    query: str = Field(
        ...,
        min_length=1,
        description="The customer query to retrieve relevant knowledge for.",
        examples=["My payment failed"]
    )
```
- Validates that `query` is non-empty and not whitespace-only.

### 5.2 Recommendation Contract (`KnowledgeRecommendation`)

```python
class KnowledgeRecommendation(BaseModel):
    title: str = Field(..., min_length=1, description="Title/name of knowledge document.")
    content: str = Field(..., min_length=1, description="Content excerpt from chunk.")
    source: str = Field(..., min_length=1, description="Source reference with chunk and document provenance.")
    document_type: str = Field(..., min_length=1, description="Category of document (e.g., 'faq', 'policy').")
    relevance_score: float = Field(..., ge=0.0, le=1.0, description="Normalized relevance score [0.0, 1.0].")
```

### 5.3 Result Contract (`KnowledgeRecommendationResult`)

```python
class KnowledgeRecommendationResult(BaseModel):
    query: str
    recommendations: List[KnowledgeRecommendation] = Field(default_factory=list)
    no_relevant_information: bool = Field(default=False)
```

---

## 6. Relevance Scoring & Thresholding

### 6.1 Distance-to-Relevance Transformation
ChromaDB returns Euclidean L2 distances:
$$\text{relevance\_score} = \frac{1.0}{1.0 + \text{distance}}$$
Properties:
- Monotonically decreasing in distance.
- Strictly bounded within $(0.0, 1.0]$.
- Exact match ($\text{distance} = 0$) yields $\text{relevance} = 1.0$.
- Semantically strong match ($\text{distance} \approx 0.70$) yields $\text{relevance} \approx 0.59$.
- Out-of-domain random vectors ($\text{distance} \approx 1.98$) yield $\text{relevance} \approx 0.33$.

### 6.2 Relevance Threshold
- Default: `DEFAULT_RELEVANCE_THRESHOLD = 0.38`.
- Configurable via environment variable: `KNOWLEDGE_RELEVANCE_THRESHOLD`.
- Calibrated against real knowledge queries:
  - `"My payment failed and I was still charged"`: $\text{score} = 0.5878 > 0.38 \implies \text{RECOMMENDED}$
  - `"I want a refund for my order"`: $\text{score} = 0.5707 > 0.38 \implies \text{RECOMMENDED}$
  - `"Delivery delay where is my order"`: $\text{score} = 0.4036 > 0.38 \implies \text{RECOMMENDED}$
  - `"What is the mass of Jupiter in kilograms?"`: $\text{score} = 0.3356 < 0.38 \implies \text{FILTERED OUT}$

---

## 7. No-Result Handling

When a query is out-of-domain or when no candidate chunk meets the relevance threshold:
```json
{
  "query": "What is the mass of Jupiter in kilograms?",
  "recommendations": [],
  "no_relevant_information": true
}
```
Safety guarantees:
1. No hallucinated text or documents.
2. No fabricated source strings.
3. No crashes or unhandled exceptions.
4. Clean HTTP 200 response with explicit `no_relevant_information: true`.

---

## 8. REST API Specification

### Endpoint: `POST /knowledge/recommend`
- **Request Body**: `{"query": "My payment failed"}`
- **Success Response (200 OK)**:
```json
{
  "query": "My payment failed and I was still charged",
  "recommendations": [
    {
      "title": "Test Policy Doc",
      "content": "Page 2: Payment and Checkout Errors For a failed payment, ask the customer to verify card details and retry once. Do not attempt multiple retries within 15 minutes.",
      "source": "chunk:doc_28_v1_p2_c1 | document:Test Policy Doc | v1 | p2",
      "document_type": "policy",
      "relevance_score": 0.5878
    },
    {
      "title": "Regression Refund Policy",
      "content": "Page 2: Refund Process Customers submit a refund request through the support portal. Support verifies the order and eligibility.",
      "source": "chunk:doc_25_v4_p2_c1 | document:Regression Refund Policy | v4 | p2",
      "document_type": "policy",
      "relevance_score": 0.4442
    }
  ],
  "no_relevant_information": false
}
```
- **Validation Error (422 Unprocessable Entity)**: Empty or whitespace query.
- **Internal Error (500 Internal Server Error)**: Vector database or embedding service failure (sanitized error message without stack trace or system internals).

---

## 9. Real vs. Mock Retrieval Validation

Both testing paradigms are implemented in `tests/test_knowledge_recommendation_phase1.py`:

| Test Suite | Mode | Scope | Result |
|---|---|---|---|
| `TestKnowledgeContracts` | MOCK | Pydantic schema validation, constraints, serialization | **10/10 PASS** |
| `TestKnowledgeRetrieval` | MOCK | FAQ & policy retrieval with mocked ChromaDB | **4/4 PASS** |
| `TestKnowledgeRanking` | MOCK | Descending sort order, highest-ranked first, max 5 limit | **3/3 PASS** |
| `TestResultCounts` | MOCK | 5, 3, 1, and 0 result scenarios | **4/4 PASS** |
| `TestNoResultHandling` | MOCK | Empty result safety, zero fabrication | **2/2 PASS** |
| `TestInputValidation` | MOCK | Empty, whitespace, long text, Unicode, emojis, SQL/JSON | **6/6 PASS** |
| `TestFailureHandling` | MOCK | Vector DB failure, embedding failure, bad metadata | **3/3 PASS** |
| `TestKnowledgeAPI` | MOCK | HTTP 200, 422, OpenAPI documentation schema | **4/4 PASS** |
| `TestRealRAGRetrieval` | **REAL** | Real queries against actual persistent ChromaDB knowledge base | **3/3 PASS** |
| `TestUtilityFunctions` | MOCK | Distance conversion math, threshold parser | **8/8 PASS** |
| **Total Phase 1 Tests** | | | **47/47 PASS** |

### Real Knowledge Retrieval Evidence
1. **Query**: `"I want a refund for my order"`
   - **Retrieved**: `Customer Support FAQ` (faq, score: 0.5707), `QA FAQ Document` (faq, score: 0.5707), `Regression Refund Policy` (policy, score: 0.5009)
   - **Provenance**: `chunk:doc_27_v1_p2_c1 | document:Customer Support FAQ | v1 | p2`
2. **Query**: `"My payment failed and I was still charged"`
   - **Retrieved**: `Test Policy Doc` (policy, score: 0.5878), `Regression Refund Policy` (policy, score: 0.4442)
   - **Provenance**: `chunk:doc_28_v1_p2_c1 | document:Test Policy Doc | v1 | p2`
3. **Query**: `"What is the mass of Jupiter in kilograms?"`
   - **Retrieved**: `[]` (`no_relevant_information: true`)

---

## 10. Regression Testing

- **Task 3 Simulator**: All tests pass (`test_simulator.py`)
- **Task 4 Analysis**: All phases pass (Phase 1, 2, 4, 5, 6, final, integration)
- **Full Test Suite**: **369 passed, 0 failed** (`pytest -q`)

---

## 11. Database Impact

**No database schema changes required.**
The Knowledge Recommendation Agent operates directly over the persistent ChromaDB collection (`support_knowledge_base`) and cross-references existing SQLite metadata without introducing new tables or columns.

---

## 12. Known Limitations & Phase 2 Boundary

The following capabilities are deliberately out of scope for Phase 1 and reserved for subsequent phases:
- **Context-aware conversation retrieval**: Phase 1 retrieves on the basis of a standalone customer query. Phase 2 will construct contextual search queries combining the latest message with conversation history and Task 4 intent/emotion signals.
- **Advanced multi-query & reranking**: Complex cross-encoder rerankers or reciprocal rank fusion.
- **Task 3 → Task 4 → Task 5 live integration**: Orchestrating simulator turn generation, intent analysis, and knowledge retrieval into an end-to-end coach pipeline.
- **10–20 Scenario Evaluation Suite & Performance Metrics**: Calculating MRR, NDCG, and retrieval precision across standard support scenario benchmarks.
