import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config({ override: true });

const app = express();
const PORT = 3009;

app.use(express.json({ limit: '10mb' }));

// Lazy GoogleGenAI client
let aiClient: GoogleGenAI | null = null;
function getAi(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return aiClient;
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', hasGeminiKey: !!process.env.GEMINI_API_KEY });
});

// Helper for fallback text responses
function sanitizeJsonString(raw: string): string {
  let clean = raw.trim();
  if (clean.startsWith('```json')) {
    clean = clean.replace(/^```json/, '').replace(/```$/, '').trim();
  } else if (clean.startsWith('```')) {
    clean = clean.replace(/^```/, '').replace(/```$/, '').trim();
  }
  return clean;
}

// 1. Analyze Turn (Multi-Agent Pipeline)
app.post('/api/analyze-turn', async (req, res) => {
  try {
    const { customerMessage, conversationHistory = [], scenario, lastAgentMessage, knowledgeDocs = [] } = req.body;
    const ai = getAi();

    if (!ai) {
      // Fallback structured simulation if no API key
      return res.json({
        intent: scenario?.category === 'Billing' ? 'Duplicate Billing / Refund Dispute' : 'Customer Inquiry',
        intentConfidence: 94,
        sentiment: 'negative',
        sentimentConfidence: 89,
        frustrationLevel: 72,
        frustrationTrend: 'increasing',
        emotions: ['Frustration', 'Urgency', 'Disappointment'],
        relevantKnowledge: {
          kbId: 'KB-102',
          title: 'Duplicate Subscription Charges & Billing Disputes',
          relevantSection: 'Section 3.2: Duplicate Charge Reversal',
          policySnippet: 'When duplicate charges occur due to gateway sync issues, verify both transaction IDs and issue immediate full credit. Inform customer: Funds reappear within 3-5 business days.',
          source: 'Refund Policy → Section 3.2',
          confidence: 96,
          troubleshootingSteps: [
            'Verify both transaction timestamps in billing portal',
            'Confirm identical descriptor and $49 charge',
            'Authorize immediate refund reversal',
            'Communicate 3-5 business days banking clearance window'
          ],
          isVerified: true
        },
        escalationRisk: 68,
        escalationLevel: 'high',
        riskReasons: [
          'Customer mentioned previous support ticket was ignored',
          'Financial discrepancy creates high anxiety',
          'Customer threatened bank dispute and account cancellation'
        ],
        recommendedIntervention: 'Acknowledge prior ticket delay with sincerity, confirm immediate refund initiation, and provide the 3-5 day banking timeline.',
        coachWhisper: '💡 Acknowledge their previous unanswered email first before stating the refund timeline.',
        alertType: 'warning',
        suggestedResponses: {
          quick: "I'm so sorry about the duplicate charge and prior delay. I've initiated your $49 refund right away.",
          professional: "I apologize for the delay on your previous inquiry and the duplicate charge. I have verified the discrepancy and processed an immediate $49 refund, which will reflect in 3-5 business days.",
          empathetic: "I completely understand how frustrating it is to see duplicate charges and not receive a prompt reply. Let me make this right immediately—I've verified the error and authorized your full refund now.",
          concise: "Apologies for the duplicate charge. I've processed your $49 refund, visible in 3-5 business days.",
          detailed: "Thank you for bringing this to our attention. I reviewed our billing records, confirmed the duplicate $49 charge from the gateway sync, and processed an immediate reversal to your card. You'll receive a confirmation receipt shortly, and funds will return in 3-5 business days.",
          deEscalation: "I am genuinely sorry for the stress this caused and that your previous email was missed. You will not have to dispute anything—I have already processed your $49 refund and verified your account is clean."
        },
        whyReasons: [
          'Validating prior ignored communication instantly stops escalation to supervisor',
          'Cites verified KB-102 refund reversal protocol with 100% compliance',
          'Assures proactive ownership without asking customer to do manual legwork'
        ],
        counterfactual: {
          alternativeResponse: "You have to wait 5 business days for billing tickets to process.",
          predictedRiskDrop: -25,
          reasoning: "A dismissive response would increase escalation risk from 68% to 93% and trigger supervisor demand."
        },
        agentEvaluation: lastAgentMessage ? {
          tone: 'Empathetic',
          empathyScore: 88,
          clarityScore: 92,
          concisenessScore: 90,
          grammarScore: 98,
          policyComplianceScore: 95,
          problemNoticed: 'Good empathy; make sure to specify 3-5 day banking window.',
          coachingAdvice: 'Strong ownership. Reassure customer with the exact refund transaction ID.'
        } : undefined
      });
    }

    const kbContext = knowledgeDocs.length > 0
      ? knowledgeDocs.map((d: any) => `[${d.id}] ${d.title}\n${d.summary}\n${d.content}`).join('\n\n')
      : 'Standard Support Knowledge Base: Refund policy permits 100% refund within 30 days. Reversals take 3-5 business days.';

    const systemPrompt = `You are an expert AI Customer Support Coaching Engine.
Analyze the latest customer turn and conversation state in a real-time support training session.

Scenario Context:
Title: ${scenario?.title || 'Support Case'}
Category: ${scenario?.category || 'General'}
Customer Persona: ${scenario?.customerPersona?.name || 'Customer'} (${scenario?.customerPersona?.type || 'Customer'})
Objectives: ${scenario?.sessionObjectives || 'Resolve issue without escalation'}

Knowledge Base Articles (RAG):
${kbContext}

Recent Conversation:
${conversationHistory.map((m: any) => `${m.sender.toUpperCase()}: ${m.text}`).join('\n')}
Latest Customer Message: "${customerMessage}"
${lastAgentMessage ? `Last Agent Message to Evaluate: "${lastAgentMessage}"` : ''}

Output ONLY valid JSON adhering strictly to this structure:
{
  "intent": "Brief intent label (e.g. Duplicate Charge Refund)",
  "intentConfidence": 95,
  "sentiment": "positive" | "neutral" | "negative" | "very_negative",
  "sentimentConfidence": 90,
  "frustrationLevel": 75,
  "frustrationTrend": "increasing" | "decreasing" | "stable",
  "emotions": ["Frustration", "Urgency"],
  "relevantKnowledge": {
    "kbId": "KB-101",
    "title": "Article Title",
    "relevantSection": "Section 3.2",
    "policySnippet": "Exact verified quote from KB",
    "source": "Refund Policy → Section 3.2",
    "confidence": 94,
    "troubleshootingSteps": ["Step 1", "Step 2"],
    "isVerified": true
  },
  "escalationRisk": 70,
  "escalationLevel": "low" | "moderate" | "high" | "critical",
  "riskReasons": ["Reason 1", "Reason 2"],
  "recommendedIntervention": "Actionable coaching instruction",
  "coachWhisper": "💡 Short punchy 1-sentence tip",
  "alertType": "info" | "warning" | "critical",
  "suggestedResponses": {
    "quick": "Short reply",
    "professional": "Formal polite reply",
    "empathetic": "Emotion-first reply",
    "concise": "Direct minimal reply",
    "detailed": "Thorough step-by-step reply",
    "deEscalation": "High empathy de-escalating reply"
  },
  "whyReasons": ["Reason 1 why this response works", "Reason 2"],
  "counterfactual": {
    "alternativeResponse": "Example poor or dismissive response",
    "predictedRiskDrop": -30,
    "reasoning": "Why the poor response would trigger escalation"
  },
  "agentEvaluation": ${lastAgentMessage ? `{
    "tone": "Empathetic" | "Polite" | "Professional" | "Robotic" | "Defensive" | "Dismissive",
    "empathyScore": 85,
    "clarityScore": 90,
    "concisenessScore": 88,
    "grammarScore": 95,
    "policyComplianceScore": 92,
    "problemNoticed": "Specific critique if any",
    "coachingAdvice": "Specific improvement tip"
  }` : 'null'}
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: systemPrompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.3
      }
    });

    const jsonText = sanitizeJsonString(response.text || '{}');
    const parsed = JSON.parse(jsonText);
    res.json(parsed);
  } catch (error: any) {
    console.error('Error in /api/analyze-turn:', error);
    res.status(500).json({ error: error.message || 'Analysis failed' });
  }
});

// 2. Simulate Customer Turn (Dynamic Emotional State)
app.post('/api/simulate-customer', async (req, res) => {
  try {
    const { scenario, conversationHistory = [], agentResponse, currentCustomerState } = req.body;
    const ai = getAi();

    const currentState = currentCustomerState || {
      frustration: scenario?.customerPersona?.baseFrustration || 60,
      trust: scenario?.customerPersona?.trust || 40,
      patience: scenario?.customerPersona?.patience || 40,
      satisfaction: scenario?.customerPersona?.satisfaction || 30,
      escalationIntent: scenario?.customerPersona?.escalationIntent || 45
    };

    if (!ai) {
      // Rule-based dynamic emotional state updater
      const text = (agentResponse || '').toLowerCase();
      const isEmpathetic = text.includes('sorry') || text.includes('understand') || text.includes('apologize') || text.includes('refund');
      const isDismissive = text.includes('policy') && !isEmpathetic;

      const frustrationDelta = isEmpathetic ? -25 : (isDismissive ? +20 : -5);
      const trustDelta = isEmpathetic ? +20 : (isDismissive ? -15 : +5);
      const satDelta = isEmpathetic ? +25 : -10;

      const newFrustration = Math.max(5, Math.min(100, currentState.frustration + frustrationDelta));
      const newTrust = Math.max(5, Math.min(100, currentState.trust + trustDelta));
      const newSat = Math.max(5, Math.min(100, currentState.satisfaction + satDelta));
      const newEscalation = Math.max(0, Math.min(100, currentState.escalationIntent - (isEmpathetic ? 30 : -15)));

      const isResolved = newFrustration <= 20 && newSat >= 70;
      const isEscalated = newEscalation >= 85 || newFrustration >= 90;

      let nextCustomerMessage = "Thank you for checking that for me. Does that mean I'll receive a confirmation email once it's posted?";
      if (isResolved) {
        nextCustomerMessage = "Thank you so much! That solves my problem completely. I really appreciate your quick help and understanding.";
      } else if (isEscalated) {
        nextCustomerMessage = "I have had enough of this runaround! Please transfer me to your supervisor or manager right now.";
      } else if (newFrustration > 50) {
        nextCustomerMessage = "Okay, but how long is this actually going to take? I need to be 100% sure this won't happen again next month.";
      }

      return res.json({
        nextCustomerMessage,
        updatedCustomerState: {
          frustration: newFrustration,
          trust: newTrust,
          patience: Math.max(5, Math.min(100, currentState.patience + (isEmpathetic ? 15 : -15))),
          satisfaction: newSat,
          escalationIntent: newEscalation
        },
        isResolved,
        isEscalated,
        stateChangeExplanation: isEmpathetic
          ? "Agent expressed genuine empathy and offered immediate solution: Frustration dropped -25%, Trust rose +20%."
          : "Agent provided informational response without deep empathy: Frustration adjusted moderately."
      });
    }

    const prompt = `You are roleplaying as a realistic customer in a support training simulator.
Persona Details:
Name: ${scenario?.customerPersona?.name || 'Customer'}
Personality Type: ${scenario?.customerPersona?.type || 'Customer'}
Behavior: ${scenario?.customerPersona?.behaviorDescription || 'Customer with an issue'}
Scenario Problem: ${scenario?.initialProblem || 'Support issue'}
Escalation Trigger: ${scenario?.escalationTrigger || 'Robotic answers or refusal to help'}

Current Hidden Emotional State:
Frustration: ${currentState.frustration}%
Trust: ${currentState.trust}%
Patience: ${currentState.patience}%
Satisfaction: ${currentState.satisfaction}%
Escalation Intent: ${currentState.escalationIntent}%

Conversation Transcript so far:
${conversationHistory.map((m: any) => `${m.sender.toUpperCase()}: ${m.text}`).join('\n')}

Agent's Latest Response:
"${agentResponse}"

Task:
1. Evaluate how the agent's response impacts the customer's emotions (empathy/clear solution reduces frustration; robotic/dismissive/blaming increases frustration).
2. Calculate new emotional state percentages (0-100).
3. If satisfaction is >= 75% and frustration <= 25%, mark isResolved: true and express genuine satisfaction.
4. If escalationIntent >= 85% or frustration >= 90%, mark isEscalated: true and demand a manager.
5. Generate the customer's next natural, conversational reply in character.

Output ONLY valid JSON:
{
  "nextCustomerMessage": "Customer's next spoken message",
  "updatedCustomerState": {
    "frustration": 45,
    "trust": 60,
    "patience": 50,
    "satisfaction": 55,
    "escalationIntent": 20
  },
  "isResolved": false,
  "isEscalated": false,
  "stateChangeExplanation": "Brief explanation of how agent response affected state"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.7
      }
    });

    const parsed = JSON.parse(sanitizeJsonString(response.text || '{}'));
    res.json(parsed);
  } catch (error: any) {
    console.error('Error in /api/simulate-customer:', error);
    res.status(500).json({ error: error.message || 'Simulation failed' });
  }
});

// 3. Generate Scenario with AI (Trainer Tool)
app.post('/api/generate-scenario', async (req, res) => {
  try {
    const { prompt: userPrompt, category = 'Billing', difficulty = 'hard' } = req.body;
    const ai = getAi();

    if (!ai) {
      return res.json({
        id: `SCENARIO-${Date.now().toString().slice(-4)}`,
        title: `Simulated ${category} Scenario: ${userPrompt || 'Customer Dispute'}`,
        category,
        difficulty,
        customerPersona: {
          id: `persona-${Date.now()}`,
          name: 'Jordan Miller',
          avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
          type: difficulty === 'expert' ? 'Angry' : (difficulty === 'hard' ? 'Highly frustrated' : 'Impatient'),
          behaviorDescription: 'Fast-paced customer who expects immediate answers and transparent accountability.',
          baseFrustration: difficulty === 'expert' ? 85 : 70,
          patience: 30,
          trust: 35,
          satisfaction: 20,
          escalationIntent: 60
        },
        initialProblem: userPrompt || 'Subscription billed twice on renewal.',
        customerOpeningMessage: `Hi, I am experiencing an issue regarding ${userPrompt || 'my bill'}. This is unacceptable and I need this resolved right now.`,
        expectedResolution: 'Apologize sincerely, confirm the issue against policy, initiate appropriate resolution, and reassure timelines.',
        escalationTrigger: 'Giving canned responses without checking logs or asking customer to repeat themselves.',
        successCriteria: [
          'Acknowledge customer emotions immediately',
          'Apply correct policy from Knowledge Base',
          'Provide clear timeline and resolution steps',
          'Avoid escalation to supervisor'
        ],
        sessionObjectives: `Resolve ${userPrompt || 'the support dispute'} within 3-4 turns while de-escalating customer frustration.`,
        relevantKbIds: ['KB-101', 'KB-102'],
        targetResolutionTurns: 4
      });
    }

    const aiPrompt = `Generate a comprehensive, realistic customer support training scenario.
User Prompt: "${userPrompt}"
Category: ${category}
Difficulty: ${difficulty} (easy, medium, hard, expert)

Return ONLY valid JSON matching this schema:
{
  "id": "SCENARIO-${Date.now().toString().slice(-4)}",
  "title": "Descriptive Scenario Title",
  "category": "${category}",
  "difficulty": "${difficulty}",
  "customerPersona": {
    "id": "persona-gen-${Date.now()}",
    "name": "Full Customer Name",
    "avatar": "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
    "type": "Angry" | "Highly frustrated" | "Confused" | "Impatient" | "Professional" | "Technically knowledgeable",
    "behaviorDescription": "Detailed behavioral description of customer",
    "baseFrustration": 75,
    "patience": 25,
    "trust": 30,
    "satisfaction": 20,
    "escalationIntent": 65
  },
  "initialProblem": "Detailed summary of the customer's issue",
  "customerOpeningMessage": "Opening message that the AI customer will say",
  "expectedResolution": "Clear guide on what the agent should do to succeed",
  "escalationTrigger": "What agent mistakes cause the customer to escalate",
  "successCriteria": [
    "Criteria 1",
    "Criteria 2",
    "Criteria 3",
    "Criteria 4"
  ],
  "sessionObjectives": "Clear objective statement for the agent",
  "relevantKbIds": ["KB-101", "KB-102"],
  "targetResolutionTurns": 4
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: aiPrompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.7
      }
    });

    const parsed = JSON.parse(sanitizeJsonString(response.text || '{}'));
    res.json(parsed);
  } catch (error: any) {
    console.error('Error in /api/generate-scenario:', error);
    res.status(500).json({ error: error.message || 'Scenario generation failed' });
  }
});

// 4. Generate AI Performance Report
app.post('/api/generate-report', async (req, res) => {
  try {
    const { scenario, messages = [], durationSeconds = 180, coachingLevel = 'beginner' } = req.body;
    const ai = getAi();

    if (!ai || messages.length === 0) {
      return res.json({
        score: {
          overall: 89,
          intentHandling: 94,
          knowledgeUsage: 90,
          empathy: 88,
          tone: 92,
          clarity: 95,
          resolution: 90,
          escalationHandling: 86,
          policyCompliance: 96,
          resolutionQuality: {
            problemIdentification: 95,
            correctSolution: 92,
            knowledgeAccuracy: 94,
            customerSatisfaction: 88,
            resolutionCompleteness: 90,
            overallQuality: 92
          }
        },
        startingSentiment: 'negative',
        endingSentiment: 'positive',
        sentimentImprovement: 68,
        resolved: true,
        escalated: false,
        timelineEvents: [
          {
            turn: 1,
            timestamp: '00:15',
            type: 'sentiment_shift',
            description: 'Customer initiated session with high frustration on duplicate billing.',
            severity: 'warning'
          },
          {
            turn: 1,
            timestamp: '00:45',
            type: 'kb_retrieved',
            description: 'RAG Knowledge KB-102 retrieved with 94% relevance match.',
            severity: 'normal'
          },
          {
            turn: 2,
            timestamp: '01:30',
            type: 'empathy_bonus',
            description: 'Agent warmly acknowledged prior ticket delay, reducing customer frustration by 35%.',
            severity: 'positive'
          },
          {
            turn: 3,
            timestamp: '02:45',
            type: 'resolution_milestone',
            description: 'Full refund authorized; customer confirmed complete satisfaction.',
            severity: 'positive'
          }
        ],
        topStrengths: [
          'Excellent empathy and emotional validation on first contact turn',
          'Strict adherence to verified Knowledge Base refund timelines',
          'Fast resolution without unnecessary transfers'
        ],
        topWeaknesses: [
          'Could have proactively shared confirmation receipt ID before customer asked'
        ],
        recommendedTrainings: [
          'Advanced Financial Dispute De-escalation',
          'VIP Customer Care & Retention Mastery'
        ],
        xpEarned: 240,
        responseComparisons: messages.filter((m: any) => m.sender === 'agent').slice(0, 2).map((m: any, idx: number) => ({
          turnNumber: idx + 1,
          originalAgentText: m.text,
          aiImprovedText: `I completely understand how concerning this is. I have already verified the error in our system and processed your full refund, which will appear in 3-5 business days.`,
          improvementExplanation: 'Adds direct emotional validation and highlights active ownership of the solution.'
        }))
      });
    }

    const transcript = messages.map((m: any, i: number) => `Turn ${i + 1} [${m.sender.toUpperCase()}]: ${m.text}`).join('\n');

    const prompt = `You are the AI Performance Evaluation Engine for a customer support training platform.
Evaluate this completed support session transcript:

Scenario Title: ${scenario?.title || 'Support Session'}
Scenario Category: ${scenario?.category || 'General'}
Customer Persona: ${scenario?.customerPersona?.name} (${scenario?.customerPersona?.type})
Session Duration: ${durationSeconds} seconds
Coaching Level Used: ${coachingLevel}

Transcript:
${transcript}

Task:
Calculate comprehensive multi-dimensional scores (0-100), evaluate whether the customer issue was resolved or escalated, construct a chronological coaching timeline, highlight top strengths/weaknesses, and generate Before vs After response comparisons.

Return ONLY valid JSON matching this schema:
{
  "score": {
    "overall": 88,
    "intentHandling": 92,
    "knowledgeUsage": 90,
    "empathy": 85,
    "tone": 90,
    "clarity": 94,
    "resolution": 88,
    "escalationHandling": 84,
    "policyCompliance": 96,
    "resolutionQuality": {
      "problemIdentification": 95,
      "correctSolution": 90,
      "knowledgeAccuracy": 94,
      "customerSatisfaction": 86,
      "resolutionCompleteness": 88,
      "overallQuality": 91
    }
  },
  "startingSentiment": "very_negative" | "negative" | "neutral",
  "endingSentiment": "positive" | "neutral" | "negative",
  "sentimentImprovement": 65,
  "resolved": true,
  "escalated": false,
  "timelineEvents": [
    {
      "turn": 1,
      "timestamp": "00:20",
      "type": "sentiment_shift" | "kb_retrieved" | "risk_spike" | "empathy_bonus" | "policy_check" | "resolution_milestone",
      "description": "Event description",
      "severity": "normal" | "positive" | "warning" | "critical"
    }
  ],
  "topStrengths": ["Strength 1", "Strength 2", "Strength 3"],
  "topWeaknesses": ["Weakness 1", "Weakness 2"],
  "recommendedTrainings": ["Training Module 1", "Training Module 2"],
  "xpEarned": 220,
  "responseComparisons": [
    {
      "turnNumber": 1,
      "originalAgentText": "Agent's actual message",
      "aiImprovedText": "Polished AI improved version",
      "improvementExplanation": "Why this improved version is better"
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.3
      }
    });

    const parsed = JSON.parse(sanitizeJsonString(response.text || '{}'));
    res.json(parsed);
  } catch (error: any) {
    console.error('Error in /api/generate-report:', error);
    res.status(500).json({ error: error.message || 'Report generation failed' });
  }
});

// 5. Counterfactual Simulation
app.post('/api/counterfactual', async (req, res) => {
  try {
    const { scenario, customerMessage, customAgentResponse } = req.body;
    const ai = getAi();

    if (!ai) {
      return res.json({
        predictedCustomerReaction: "Thank you for looking into this so quickly! That puts my mind at ease.",
        predictedFrustrationDelta: -35,
        predictedEscalationRisk: 22,
        reasoning: "Your response explicitly acknowledged the customer's prior frustration and committed to a concrete timeline, eliminating escalation pressure."
      });
    }

    const prompt = `Simulate counterfactual customer reaction.
Scenario: ${scenario?.title || 'Support Case'}
Customer Message: "${customerMessage}"
Agent Proposed Response: "${customAgentResponse}"

Evaluate how the customer would react to this response. Output ONLY valid JSON:
{
  "predictedCustomerReaction": "Realistic customer response",
  "predictedFrustrationDelta": -30,
  "predictedEscalationRisk": 25,
  "reasoning": "Detailed analysis of why this response works or fails"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.4
      }
    });

    res.json(JSON.parse(sanitizeJsonString(response.text || '{}')));
  } catch (error: any) {
    console.error('Error in /api/counterfactual:', error);
    res.status(500).json({ error: error.message });
  }
});

// 6. Multilingual Translation
app.post('/api/translate', async (req, res) => {
  try {
    const { text, targetLang = 'English' } = req.body;
    const ai = getAi();

    if (!ai) {
      return res.json({
        translatedText: text,
        detectedLang: 'English',
        intent: 'General Inquiry'
      });
    }

    const prompt = `Translate this customer support text into ${targetLang} and identify its intent.
Text: "${text}"

Output JSON:
{
  "translatedText": "Translated text",
  "detectedLang": "Language name",
  "intent": "Intent label"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2
      }
    });

    res.json(JSON.parse(sanitizeJsonString(response.text || '{}')));
  } catch (error: any) {
    console.error('Error in /api/translate:', error);
    res.status(500).json({ error: error.message });
  }
});

// Vite Middleware for SPA serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AI Customer Support Coaching Server running on port ${PORT}`);
  });
}

startServer();
