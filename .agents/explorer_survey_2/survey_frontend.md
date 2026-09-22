# Frontend AI Decision Support & Coaching Survey Report

**Explorer**: `explorer_survey_2`  
**Date**: 2026-09-21  
**Working Directory**: `C:\Users\shrushti\Customer-Support-Assistant\.agents\explorer_survey_2`  
**Target Repository**: `C:\Users\shrushti\Customer-Support-Assistant`

---

## Executive Summary

This investigation surveys the Customer Support Assistant frontend architecture to prepare for **Task 6 Phase 1 (Coaching & Response Suggestion Agent)** integration.

A critical structural discovery was made:
1. **Primary Active Production Frontend**: `C:\Users\shrushti\Customer-Support-Assistant\final_project\frontend` (package name: `"frontend"`). This frontend was established in commit `fac51c2` ("Move RAG-Pipeline-backend and frontend to final_project") and polished in commit `75fa7d1` ("Fix UI layout, auth integration, RAG documents..."). It contains `DecisionSupportCard.tsx`, `SupportConsole.tsx`, `src/types/index.ts` (with `DecisionSupportResult`), active `node_modules`, and successfully passes `npm run build` (`tsc -b && vite build`) with zero errors.
2. **Legacy / Standalone Prototype Frontend**: `C:\Users\shrushti\Customer-Support-Assistant\frontend` (package name: `"react-example"`). An earlier full-stack Node/Express prototype with `LiveConsoleView` and dark-mode `CoachingPanel.tsx`, which does not contain `node_modules` or `DecisionSupportResult`.

The primary target for Task 6 Phase 1 frontend integration is **`final_project/frontend`**.

---

## 1. Architectural Landscape & Component Mapping

### 1.1 The Primary Production Frontend (`final_project/frontend`)

The primary frontend is built on **React 19.2.8**, **Vite 8.3.0**, **TypeScript 6.0.2**, and **TailwindCSS 4.3.3**.

The core view where support agents interact during a simulation is:
* **Host Component**: `src/components/SupportConsole.tsx` (451 lines)
* **Dedicated Decision Support Component**: `src/components/DecisionSupportCard.tsx` (110 lines)

### 1.2 Layout of `SupportConsole.tsx`

`SupportConsole.tsx` renders a 12-column grid:
* **Left Column (7 cols)**: Dialogue Stream (chat bubble history between AI Customer and Support Agent) + Support Agent reply form (`<textarea>` + `[Send Response →]` button).
* **Right Column (5 cols)**:
  1. **AI Decision Support Card** (currently lines 267–327 rendered inline; matching `DecisionSupportCard.tsx`)
  2. **Task 4 Analysis & Metrics** (lines 330–389: Intent, Emotion, Sentiment, Frustration, Patience, Satisfaction Trend, Escalation Risk, Confidence)
  3. **Task 5 Knowledge Recommendations** (lines 392–443: RAG documents with relevance scores and `+ Use in Reply` buttons)

---

## 2. AI Decision Support UI Components, Props, Hooks & State

### 2.1 State and Lifecycle in `SupportConsole.tsx`

```typescript
// SupportConsole.tsx state
const [sessionData, setSessionData] = useState<IntegratedTurnResponse>(initialTurnData);
const [messages, setMessages] = useState<DialogueMessage[]>([]);
const [agentInput, setAgentInput] = useState<string>('');
const [loadingTurn, setLoadingTurn] = useState<boolean>(false);
const [turnError, setTurnError] = useState<string | null>(null);
const [decisionSupport, setDecisionSupport] = useState<DecisionSupportResult | null>(null);

const messagesEndRef = useRef<HTMLDivElement>(null);
const inputRef = useRef<HTMLTextAreaElement>(null);
```

### 2.2 Data Fetching Hook for Decision Support

In `SupportConsole.tsx` (lines 69–82):
```typescript
useEffect(() => {
  const fetchDecisionSupport = async () => {
    try {
      const ds = await analysisApi.getDecisionSupport(sessionData.session_id);
      setDecisionSupport(ds);
    } catch {
      // Graceful isolation
    }
  };

  if (sessionData.session_id) {
    fetchDecisionSupport();
  }
}, [sessionData.session_id, sessionData.turn]);
```
* On mount and whenever `sessionData.turn` changes (after `supportApi.processTurn`), it calls `analysisApi.getDecisionSupport(sessionId)`:
  * HTTP call: `GET /analysis/{session_id}/decision-support`
  * Backend returns Pydantic `DecisionSupportResult` (from `final_project/RAG-Pipeline-backend/app/schemas/analysis.py`).
  * If backend fails, graceful failure isolation leaves `decisionSupport` unchanged without crashing the simulation.

### 2.3 Existing UI Duplication Issue

Currently, `DecisionSupportCard.tsx` is implemented as an extracted component in `src/components/DecisionSupportCard.tsx`, but `SupportConsole.tsx` has a copy-pasted inline implementation at lines 267–327.
* **Problem**: When changing the decision support UI, updating one file without the other leaves discrepancies.
* **Solution**: Cleanly import `<DecisionSupportCard decision={decisionSupport} onApplyAction={handleInsertText} />` inside `SupportConsole.tsx`. This avoids UI duplication and centralizes all coaching changes in `DecisionSupportCard.tsx`.

---

## 3. The "Use Suggested Tone in Reply" Button

### 3.1 Current Implementation

In `final_project/frontend/src/components/DecisionSupportCard.tsx` (lines 80–106) and `SupportConsole.tsx` (lines 300–324):

```tsx
<button
  type="button"
  onClick={() => {
    const action = decisionSupport.recommended_action;
    let text = "I understand your concern. Let me resolve this for you immediately.";
    if (action === "escalate") {
      text = "I completely understand your frustration. I am escalating this ticket to my supervisor who will assist you immediately.";
    } else if (action === "apologize_and_resolve") {
      text = "I sincerely apologize for the inconvenience. Let me resolve this for you right away.";
    } else if (action === "provide_status") {
      text = "Let me check the exact status of your request and get right back to you.";
    } else if (action === "clarify") {
      text = "Could you please provide a little more detail so I can accurately resolve this for you?";
    } else if (action === "offer_options") {
      text = "I want to make this right. Let me offer you a few options to resolve this.";
    } else if (action === "provide_instructions") {
      text = "I can certainly help you with that. Here are the step-by-step instructions.";
    }
    handleInsertText(text);
  }}
  className="mt-3 w-full py-1.5 px-3 rounded-lg text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
>
  <span>Use Suggested Tone in Reply</span>
  <ArrowRight className="w-3.5 h-3.5" />
</button>
```

### 3.2 State Injection Mechanism

In `SupportConsole.tsx` (lines 130–133):
```typescript
const handleInsertText = (snippet: string) => {
  setAgentInput((prev) => (prev ? prev + '\n\n' + snippet : snippet));
  inputRef.current?.focus();
};
```
* The function appends `snippet` to `agentInput` (or initializes `agentInput` if empty).
* It immediately focuses the `<textarea ref={inputRef}>`.

### 3.3 New Required Behavior

Under Task 6 Phase 1:
1. The button should inject the dynamic, context-aware `decisionSupport.suggested_response`.
2. If `suggested_response` is empty or null (e.g. deterministic fallback or legacy turn), it must gracefully fall back to the existing canned action templates.
3. Updated click handler:
```typescript
onClick={() => {
  let text = decision?.suggested_response?.trim();
  if (!text) {
    const action = decision?.recommended_action;
    text = "I understand your concern. Let me resolve this for you immediately.";
    if (action === "escalate") {
      text = "I completely understand your frustration. I am escalating this ticket to my supervisor who will assist you immediately.";
    } else if (action === "apologize_and_resolve") {
      text = "I sincerely apologize for the inconvenience. Let me resolve this for you right away.";
    } else if (action === "provide_status") {
      text = "Let me check the exact status of your request and get right back to you.";
    } else if (action === "clarify") {
      text = "Could you please provide a little more detail so I can accurately resolve this for you?";
    } else if (action === "offer_options") {
      text = "I want to make this right. Let me offer you a few options to resolve this.";
    } else if (action === "provide_instructions") {
      text = "I can certainly help you with that. Here are the step-by-step instructions.";
    }
  }
  onApplyAction(text);
}}
```

---

## 4. TypeScript Types & Backend Parity

### 4.1 Current Backend Contract (`RAG-Pipeline-backend/app/schemas/analysis.py`)

```python
class DecisionSupportResult(BaseModel):
    priority: DecisionPriority
    recommended_tone: RecommendedTone
    recommended_action: RecommendedAction
    escalation_recommended: bool
    risk_flags: list[str] = Field(default_factory=list)
    customer_needs: list[CustomerNeed] = Field(default_factory=list)
    rationale: str
    confidence: float
    session_id: int | None = None
    turn_number: int | None = None
```

### 4.2 Current Frontend Contract (`final_project/frontend/src/types/index.ts`)

```typescript
export interface DecisionSupportResult {
  priority: 'low' | 'medium' | 'high' | 'critical';
  recommended_tone: 'empathetic' | 'reassuring' | 'clarifying' | 'apologetic' | 'professional' | 'calm' | 'firm';
  recommended_action: 'resolve' | 'clarify' | 'apologize_and_resolve' | 'provide_status' | 'provide_instructions' | 'offer_options' | 'escalate';
  escalation_recommended: boolean;
  risk_flags: string[];
  customer_needs: string[];
  rationale: string;
  confidence: number;
  session_id?: number | null;
  turn_number?: number | null;
}
```

### 4.3 Extended Contract for Task 6 Phase 1

In `final_project/frontend/src/types/index.ts`:

```typescript
// New interface for Turn Response Evaluation
export interface ResponseEvaluation {
  clarity: number;         // 0–100 or 1–10
  empathy: number;         // 0–100 or 1–10
  relevance: number;       // 0–100 or 1–10
  professionalism: number; // 0–100 or 1–10
  overall_score?: number;
  feedback?: string;
}

// Extended DecisionSupportResult
export interface DecisionSupportResult {
  priority: 'low' | 'medium' | 'high' | 'critical';
  recommended_tone: 'empathetic' | 'reassuring' | 'clarifying' | 'apologetic' | 'professional' | 'calm' | 'firm';
  recommended_action: 'resolve' | 'clarify' | 'apologize_and_resolve' | 'provide_status' | 'provide_instructions' | 'offer_options' | 'escalate';
  escalation_recommended: boolean;
  risk_flags: string[];
  customer_needs: string[];
  rationale: string;
  confidence: number;
  session_id?: number | null;
  turn_number?: number | null;

  // Task 6 Phase 1 Additions:
  suggested_response?: string | null;
  coaching_tips?: string[];
  response_evaluation?: ResponseEvaluation | null;
}
```

---

## 5. UI Design Analysis for Coaching Metrics

To maintain the current visual design, prevent visual clutter, and avoid layout shifts:

### 5.1 Suggested Response Display
* **Location**: Just above the action button.
* **Styling**: Subtle indigo tint box:
  ```tsx
  {decision.suggested_response && (
    <div className="mt-2.5 p-2.5 rounded-lg bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-950 leading-relaxed">
      <span className="font-semibold text-indigo-900 block mb-1 text-2xs uppercase tracking-wider">
        Suggested Response:
      </span>
      <p className="italic">"{decision.suggested_response}"</p>
    </div>
  )}
  ```

### 5.2 Coaching Tips Display
* **Location**: Below Rationale / Risk Flags.
* **Styling**: Light amber hint container:
  ```tsx
  {decision.coaching_tips && decision.coaching_tips.length > 0 && (
    <div className="mt-2.5 p-2.5 rounded-lg bg-amber-50/60 border border-amber-200/70 text-xs space-y-1">
      <span className="font-semibold text-amber-900 block text-2xs uppercase tracking-wider">
        Coaching Tips:
      </span>
      {decision.coaching_tips.map((tip, idx) => (
        <div key={idx} className="flex items-start gap-1.5 text-slate-700 text-2xs leading-snug">
          <span className="text-amber-500 font-bold">•</span>
          <span>{tip}</span>
        </div>
      ))}
    </div>
  )}
  ```

### 5.3 Response Evaluation Display
* **Location**: Bottom metric strip inside the card (when previous agent turn was evaluated).
* **Styling**: 4-metric grid mirroring the tone/action grid:
  ```tsx
  {decision.response_evaluation && (
    <div className="mt-3 pt-2.5 border-t border-indigo-100/70">
      <span className="text-slate-400 block text-3xs font-semibold uppercase mb-1.5">
        Previous Turn Evaluation
      </span>
      <div className="grid grid-cols-4 gap-1.5 text-center">
        <div className="p-1.5 rounded bg-white border border-slate-200/80">
          <span className="text-slate-400 text-3xs uppercase block">Clarity</span>
          <span className="text-xs font-bold text-slate-800">
            {decision.response_evaluation.clarity}%
          </span>
        </div>
        <div className="p-1.5 rounded bg-white border border-slate-200/80">
          <span className="text-slate-400 text-3xs uppercase block">Empathy</span>
          <span className="text-xs font-bold text-slate-800">
            {decision.response_evaluation.empathy}%
          </span>
        </div>
        <div className="p-1.5 rounded bg-white border border-slate-200/80">
          <span className="text-slate-400 text-3xs uppercase block">Relevance</span>
          <span className="text-xs font-bold text-slate-800">
            {decision.response_evaluation.relevance}%
          </span>
        </div>
        <div className="p-1.5 rounded bg-white border border-slate-200/80">
          <span className="text-slate-400 text-3xs uppercase block">Professional</span>
          <span className="text-xs font-bold text-slate-800">
            {decision.response_evaluation.professionalism}%
          </span>
        </div>
      </div>
    </div>
  )}
  ```

---

## 6. Build System & Test Verification

### 6.1 Build System Inspection

| Configuration | Value / Version |
| :--- | :--- |
| Project Root | `C:\Users\shrushti\Customer-Support-Assistant\final_project\frontend` |
| Build Tool | Vite `8.3.0` |
| TypeScript | `~6.0.2` (`tsc -b && vite build`) |
| CSS Engine | `@tailwindcss/vite` `4.3.3` |
| Framework | React `19.2.8` |
| Current Build Status | **PASS** (31 modules, built in 525ms, zero errors) |

### 6.2 TypeScript Strictness Considerations

From `tsconfig.app.json`:
* `"noUnusedLocals": true`
* `"noUnusedParameters": true`
* `"erasableSyntaxOnly": true`
* `"verbatimModuleSyntax": true`

Any new imports, props, or variables must be actively referenced.

---

## 7. Exact File Modification Roadmap

Only **3 frontend files** require targeted modification for Task 6 Phase 1:

1. **`final_project/frontend/src/types/index.ts`**
   * Add `ResponseEvaluation` interface.
   * Extend `DecisionSupportResult` with `suggested_response`, `coaching_tips`, and `response_evaluation`.
   * (Optionally) Add `decision_support?: DecisionSupportResult` to `IntegratedTurnResponse`.

2. **`final_project/frontend/src/components/DecisionSupportCard.tsx`**
   * Add rendering for `decision.suggested_response`.
   * Add rendering for `decision.coaching_tips`.
   * Add rendering for `decision.response_evaluation`.
   * Update the "Use Suggested Tone in Reply" button onClick handler to pass `decision.suggested_response || fallbackActionText` to `onApplyAction`.

3. **`final_project/frontend/src/components/SupportConsole.tsx`**
   * Import `<DecisionSupportCard />`.
   * Replace lines 267–327 (the inline duplicate card) with:
     ```tsx
     {decisionSupport && (
       <DecisionSupportCard
         decision={decisionSupport}
         onApplyAction={handleInsertText}
       />
     )}
     ```
   * This completely eliminates UI duplication.

---

## 8. Verification & Test Plan

1. **Static Type & Bundle Verification**:
   ```bash
   cd C:\Users\shrushti\Customer-Support-Assistant\final_project\frontend
   npm run build
   ```
   Must compile with 0 errors.

2. **Functional UI Verification**:
   * Launch a simulation session (`npm run dev` or live backend).
   * Verify that when `GET /analysis/{id}/decision-support` returns `suggested_response`, the text appears in the card.
   * Click "Use Suggested Tone in Reply": verify the text box (`agentInput`) is populated with `suggested_response`.
   * Verify coaching tips appear as bulleted tips.
   * Verify response evaluation scores appear in the 4-column metric grid.
   * Verify fallback: if `suggested_response` is not returned, the button still injects the action-based fallback sentence.
