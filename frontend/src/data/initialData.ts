import {
  Scenario,
  KnowledgeDocument,
  AgentProfile,
  LeaderboardEntry,
  AuditLogEntry,
  SessionRecord,
  TrainingPlanWeek
} from '../types';

export const INITIAL_KNOWLEDGE_DOCS: KnowledgeDocument[] = [
  {
    id: 'KB-101',
    title: 'Refund & Credit Policy Guidelines',
    category: 'Policies',
    updatedAt: '2026-08-20',
    chunkCount: 14,
    embeddingCount: 56,
    status: 'indexed',
    citationsCount: 142,
    summary: 'Rules for processing customer refunds, merchant credit, partial reimbursements, and processing timelines (Section 3.2).',
    content: `SECTION 1: GENERAL REFUND CRITERIA
Customers are eligible for a 100% refund within 30 days of purchase if the service was non-functional or product damaged.
For subscription services billed in error or duplicated, a full immediate reversal must be authorized.

SECTION 3.2: DUPLICATE CHARGE REVERSAL
When duplicate charges occur due to gateway sync issues:
1. Verify both transaction IDs and timestamps in the billing portal.
2. Confirm the identical billing descriptor and amount.
3. Issue an immediate credit back to the original payment method.
4. Inform the customer: "The reversal is processed instantly on our end, and funds typically reappear on your bank statement within 3 to 5 business days depending on your financial institution."
5. Never ask the customer to contact their bank first without verifying our internal merchant logs.`
  },
  {
    id: 'KB-102',
    title: 'Duplicate Subscription Charges & Billing Disputes',
    category: 'Billing',
    updatedAt: '2026-08-22',
    chunkCount: 18,
    embeddingCount: 72,
    status: 'indexed',
    citationsCount: 230,
    summary: 'Standard operating procedures for addressing duplicate subscriptions, accidental renewals, and disputed invoices.',
    content: `BILLING DISPUTE PROTOCOL
1. Verification: Ask for customer email or Invoice #. Never disclose full card details (PII Protection).
2. Root Cause Analysis: Check for multiple workspace memberships or accidental double-click during checkout.
3. Resolution Path:
   - If double-charged: Cancel extra seat/subscription immediately.
   - Authorize instant credit or refund.
   - Apply courtesy $10 account credit if customer experienced over 48 hours of downtime or frustration.
4. De-escalation Guideline: Always validate the customer's frustration regarding financial discrepancies before stating processing timelines.`
  },
  {
    id: 'KB-103',
    title: 'Damaged & Delayed Package Deliveries',
    category: 'Shipping', 
    updatedAt: '2026-08-15',
    chunkCount: 12,
    embeddingCount: 48,
    status: 'indexed',
    citationsCount: 98,
    summary: 'Handling late courier shipments, transit damage claims, and replacement expedited dispatch.',
    content: `SHIPPING INCIDENT RESOLUTION
1. Damaged in Transit:
   - Request order number. Photo proof is helpful but optional for trusted tier-1 accounts under $150.
   - Offer either an immediate complimentary replacement with Priority 2-Day Air shipping OR full refund.
2. Delayed Beyond SLA (>48 hours past delivery window):
   - Check courier tracking API in dashboard.
   - If courier marked stuck/exception: waive shipping fee and offer 15% discount promo code for next purchase.`
  },
  {
    id: 'KB-104',
    title: 'Account Lockout, Security & 2FA Recovery',
    category: 'Security',
    updatedAt: '2026-08-25',
    chunkCount: 16,
    embeddingCount: 64,
    status: 'indexed',
    citationsCount: 115,
    summary: 'Authentication troubleshooting, security verification procedures, and 2FA recovery without compromising user privacy.',
    content: `ACCOUNT RECOVERY VERIFICATION
1. Identity Verification: Verify primary email, last 4 digits of phone number, and approximate signup date.
2. Temporary Bypass: If customer lost MFA authenticator device, send one-time verification code to backup email.
3. Password Reset: Never verbally read or type temporary passwords in unencrypted chat. Send an automated secure magic link valid for 15 minutes.`
  },
  {
    id: 'KB-105',
    title: 'Application Crash & Technical Integration Troubleshooting',
    category: 'Technical',
    updatedAt: '2026-08-18',
    chunkCount: 20,
    embeddingCount: 80,
    status: 'indexed',
    citationsCount: 76,
    summary: 'Client-side debugging, browser cache clearing, WebGL/API socket reconnection steps.',
    content: `TECHNICAL ERROR PROTOCOL
1. Information Gathering: Request browser version, OS, and screenshot of error dialog or console if applicable.
2. Fast Triaging:
   - Step 1: Hard refresh (Cmd+Shift+R or Ctrl+F5).
   - Step 2: Test in Incognito window to isolate extension conflicts.
   - Step 3: Check status.company.com for live incident status.
3. If persistent: Collect session ID and escalate to Level 2 Engineering with repro steps.`
  },
  {
    id: 'KB-106',
    title: 'Subscription Cancellation & Retention Offers',
    category: 'Billing',
    updatedAt: '2026-08-24',
    chunkCount: 10,
    embeddingCount: 40,
    status: 'indexed',
    citationsCount: 165,
    summary: 'Handling cancellation requests, graceful offboarding, pause subscription option, and retention credit.',
    content: `CANCELLATION POLICY & RETENTION
1. Always respect customer decision immediately; do not trap or create friction.
2. Offer Pause Option (1 to 3 months) if temporary hiatus is needed.
3. If cancellation is due to cost: eligible for 30% loyalty discount for 3 months.
4. If customer insists on cancellation: process immediately and confirm that access remains active until the end of the current billing cycle.`
  }
];

export const INITIAL_SCENARIOS: Scenario[] = [
  {
    id: 'SCENARIO-01',
    title: 'Duplicate Subscription Charge Dispute',
    category: 'Billing',
    difficulty: 'hard',                                                                   
    customerPersona: {
      id: 'persona-1',
      name: 'Marcus Vance',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      type: 'Highly frustrated',
      behaviorDescription: 'Customer noticed two $49 charges on their credit card. They previously submitted a ticket that was ignored.',
      baseFrustration: 75,
      patience: 25,
      trust: 30,
      satisfaction: 20,
      escalationIntent: 65
    },
    initialProblem: 'Charged twice for the Pro Plan subscription on the same day ($49 x 2).',
    customerOpeningMessage: "I've been charged twice for my subscription this month ($49 x 2)! I sent an email 3 days ago and nobody replied. I need this refunded immediately or I'm calling my bank to dispute the charge and cancelling my account!",
    expectedResolution: 'Apologize sincerely, acknowledge previous unanswered ticket, confirm duplicate charge in records, initiate immediate $49 refund, and reassure 3-5 day timeline.',
    escalationTrigger: 'Agent ignores previous email delay, gives cold robotic policy answers, or tells customer to contact bank themselves.',
    successCriteria: [
      'Acknowledge customer frustration and prior contact delay immediately',
      'Cite KB-101 / KB-102 duplicate charge reversal process',
      'Confirm $49 refund initiated without arguing',
      'Provide clear 3-5 business days timeframe',
      'Prevent escalation to supervisor'
    ],
    sessionObjectives: 'De-escalate the customer, issue the duplicate charge refund according to KB-102, and restore account trust within 4 conversation turns.',
    relevantKbIds: ['KB-101', 'KB-102'],
    targetResolutionTurns: 4
  },
  {
    id: 'SCENARIO-02',
    title: 'Order Arrived Damaged Before Event',
    category: 'Product',
    difficulty: 'medium',
    customerPersona: {
      id: 'persona-2',
      name: 'Elena Rostova',
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
      type: 'Impatient',
      behaviorDescription: 'Needs the item for a corporate event tomorrow. Package box arrived crushed and item is cracked.',
      baseFrustration: 60,
      patience: 40,
      trust: 50,
      satisfaction: 35,
      escalationIntent: 40
    },
    initialProblem: 'Custom exhibition display arrived cracked 24 hours before trade show.',
    customerOpeningMessage: "My order #88492 just arrived and the main acrylic panel is cracked down the middle! The shipping box was completely crushed. My trade show is TOMORROW morning. What can you do for me right now?",
    expectedResolution: 'Express empathy for the tight event deadline, check courier logistics for overnight replacement or issue full refund plus local courier emergency dispatch credit.',
    escalationTrigger: 'Telling customer to mail back the broken item first before replacement can be approved.',
    successCriteria: [
      'Empathize with the urgent event timeline',
      'Waive return requirement for broken unit',
      'Offer emergency Priority Overnight replacement or full refund',
      'Maintain polite, proactive tone'
    ],
    sessionObjectives: 'Provide an urgent solution for damaged goods per KB-103 and reassure the customer without requiring return friction.',
    relevantKbIds: ['KB-103'],
    targetResolutionTurns: 3
  },
  {
    id: 'SCENARIO-03',
    title: 'Account Locked Out During Critical Presentation',
    category: 'Security',
    difficulty: 'expert',
    customerPersona: {
      id: 'persona-3',
      name: 'Dr. David Chen',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      type: 'Angry',
      behaviorDescription: 'Senior executive locked out due to failed 2FA prompt right before an investor pitch.',
      baseFrustration: 85,
      patience: 15,
      trust: 20,
      satisfaction: 15,
      escalationIntent: 80
    },
    initialProblem: 'Locked out of account after 3 failed password attempts; authenticator app lost on new phone.',
    customerOpeningMessage: "I am locked out of my corporate account and my new phone doesn't have the 2FA app synced. I have an investor presentation in 15 minutes. If I lose this deal because of your security lockout I am suing your company. Unlock my account RIGHT NOW.",
    expectedResolution: 'Stay calm and unflustered, follow secure verification via registered backup email magic link per KB-104, restore access rapidly while maintaining security compliance.',
    escalationTrigger: 'Getting defensive, arguing with legal threats, or bypassing security policies unsafely.',
    successCriteria: [
      'Maintain professional, calm composure under severe pressure',
      'Never bypass identity verification, use rapid backup email 1-time code',
      'Provide concise step-by-step guidance',
      'De-escalate panic and urgency effectively'
    ],
    sessionObjectives: 'Perform rapid secure identity verification and restore account access within 3 turns without violating security protocols.',
    relevantKbIds: ['KB-104'],
    targetResolutionTurns: 3
  },
  {
    id: 'SCENARIO-04',
    title: 'Unexpected Auto-Renewal & Subscription Cancellation',
    category: 'Subscription',
    difficulty: 'easy',
    customerPersona: {
      id: 'persona-4',
      name: 'Sarah Jenkins',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
      type: 'Confused',
      behaviorDescription: 'First-time user thought they were on a monthly trial; annual plan renewed automatically for $199.',
      baseFrustration: 45,
      patience: 60,
      trust: 60,
      satisfaction: 50,
      escalationIntent: 25
    },
    initialProblem: 'Customer forgot to cancel free trial and was billed $199 for annual plan.',
    customerOpeningMessage: "Hi, I just noticed an unexpected charge of $199 on my account from yesterday. I thought my trial was still active. I don't use the tool enough for an annual plan. Can I please cancel this and get my money back?",
    expectedResolution: 'Kindly explain annual renewal policy, immediately offer full refund since requested within 48 hours of charge per KB-101/KB-106, or offer discounted monthly tier.',
    escalationTrigger: 'Refusing refund claiming annual plans are strictly non-refundable.',
    successCriteria: [
      'Warm and polite tone',
      'Clear explanation without blaming the customer',
      'Process refund within 30-day grace policy',
      'Confirm cancellation status'
    ],
    sessionObjectives: 'Resolve the subscription cancellation politely, issue full refund under trial grace period, and leave customer with a positive impression.',
    relevantKbIds: ['KB-101', 'KB-106'],
    targetResolutionTurns: 3
  },
  {
    id: 'SCENARIO-05',
    title: 'Web App Crashing on Large Data Export',
    category: 'Technical',
    difficulty: 'medium',
    customerPersona: {
      id: 'persona-5',
      name: 'Alex Rivera',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
      type: 'Technically knowledgeable',
      behaviorDescription: 'Developer experiencing HTTP 504 and browser memory leak when exporting 50k rows to CSV.',
      baseFrustration: 40,
      patience: 70,
      trust: 65,
      satisfaction: 55,
      escalationIntent: 20
    },
    initialProblem: 'Data export modal hangs at 85% and crashes browser tab.',
    customerOpeningMessage: "Hey team, whenever I trigger a CSV export for datasets over 50,000 records, the client throws an Out of Memory error in Chrome and the worker socket drops. Is there a background export queue or pagination workaround?",
    expectedResolution: 'Acknowledge technical issue, provide immediate workaround (filter date range or use CLI/API batch export per KB-105), and file high-priority ticket with engineering.',
    escalationTrigger: 'Telling technical user generic advice like "restart your computer" or "clear cookies".',
    successCriteria: [
      'Match the customer technical caliber',
      'Provide actionable batching workaround',
      'Offer background server export link'
    ],
    sessionObjectives: 'Provide accurate technical guidance and workaround for export payload limits without frustrating a tech-savvy user.',
    relevantKbIds: ['KB-105'],
    targetResolutionTurns: 3
  }
];

export const INITIAL_REPLAY_SESSIONS = [
  {
    id: 'REPLAY-01',
    title: 'Historic Escalation Case: Unresolved Billing Dispute',
    category: 'Billing',
    difficulty: 'hard' as const,
    customerName: 'Jonathan Brand',
    turns: [
      {
        turnNumber: 1,
        customerMessage: "I was billed $89 for a service I cancelled two weeks ago. This is unacceptable, fix it right now.",
        originalAgentResponse: "You need to check your bank and see if the charge cleared. We don't bill cancelled accounts.",
        criticism: "Dismissive and defensive. Shifts blame to customer and contradicts customer statement without verification.",
        improvedResponse: "I am truly sorry to hear you were billed after cancelling, Jonathan. Let me pull up your account records immediately and verify what happened so we can reverse the charge right away."
      },
      {
        turnNumber: 2,
        customerMessage: "It DID clear, I'm looking at my statement right here! Why are you telling me to check my bank? Transfer me to your manager immediately.",
        originalAgentResponse: "Our managers are busy. You have to wait 5 to 7 business days for billing tickets.",
        criticism: "Spiked customer frustration to 95%. Blocked escalation unprofessionally and provided zero empathy.",
        improvedResponse: "I completely understand why this is upsetting, and I apologize for not checking your account first. I have just verified your cancellation on the 12th—the charge was an automated sync error. I have processed a full $89 refund directly to your card, which will show in 3-5 days. I'm also here with you until you receive the confirmation email."
      }
    ]
  },
  {
    id: 'REPLAY-02',
    title: 'Historic Case: Lost Courier Package De-escalation',
    category: 'Shipping',
    difficulty: 'medium' as const,
    customerName: 'Clara Oswald',
    turns: [
      {
        turnNumber: 1,
        customerMessage: "Tracking says my birthday gift package was delivered 3 days ago, but nothing ever arrived on my porch. It was stolen or lost!",
        originalAgentResponse: "If tracking says delivered, you have to file a police report or contact FedEx directly.",
        criticism: "Robotic and hostile. Forces customer to do courier investigation themselves for an emotional birthday gift.",
        improvedResponse: "Oh no, Clara, I am so sorry! I know how stressful it is when a birthday gift doesn't arrive as expected. Let me check the courier delivery scan details and arrange a replacement shipment for you right away."
      }
    ]
  }
];

export const INITIAL_USER_PROFILE: AgentProfile = {
  id: 'agent-001',
  name: 'Alex Morgan',
  email: 'alex.morgan@supportpro.ai',
  role: 'employee',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  level: 4,
  xp: 3450,
  xpToNextLevel: 5000,
  streakDays: 6,
  totalSessions: 42,
  averageScore: 88,
  resolutionRate: 92,
  avgCsat: 87,
  escalationRate: 11,
  avgResponseQuality: 90,
  skills: {
    communication: 91,
    empathy: 84,
    knowledge: 93,
    problemSolving: 89,
    deEscalation: 78,
    policyCompliance: 96
  },
  badges: [
    {
      id: 'b-1',
      name: 'First Resolution',
      description: 'Successfully resolved your first simulated customer case',
      icon: 'Trophy',
      category: 'resolution',
      unlockedAt: '2026-08-01'
    },
    {
      id: 'b-2',
      name: 'Knowledge Master',
      description: 'Maintained 95%+ policy compliance across 10 sessions',
      icon: 'BookOpen',
      category: 'knowledge',
      unlockedAt: '2026-08-10'
    },
    {
      id: 'b-3',
      name: 'De-escalation Pro',
      description: 'Reduced customer frustration by over 50% in a single session',
      icon: 'HeartHandshake',
      category: 'empathy',
      unlockedAt: '2026-08-18'
    },
    {
      id: 'b-4',
      name: '6-Day Streak',
      description: 'Practiced coaching simulations 6 consecutive days',
      icon: 'Flame',
      category: 'streak',
      unlockedAt: '2026-08-26'
    },
    {
      id: 'b-5',
      name: 'Zero Escalation Hero',
      description: 'Completed 5 expert scenarios without a single supervisor transfer',
      icon: 'ShieldCheck',
      category: 'mastery',
      progress: 4,
      maxProgress: 5
    }
  ],
  recentSessions: [
    {
      id: 'sess-101',
      agentName: 'Alex Morgan',
      agentId: 'agent-001',
      scenarioId: 'SCENARIO-01',
      scenarioTitle: 'Duplicate Subscription Charge Dispute',
      mode: 'simulator',
      coachingLevel: 'beginner',
      difficulty: 'hard',
      startTime: '2026-08-26T14:20:00Z',
      endTime: '2026-08-26T14:26:00Z',
      durationSeconds: 360,
      status: 'completed',
      messages: [],
      score: {
        overall: 89,
        intentHandling: 94,
        knowledgeUsage: 91,
        empathy: 85,
        tone: 92,
        clarity: 95,
        resolution: 90,
        escalationHandling: 84,
        policyCompliance: 98,
        resolutionQuality: {
          problemIdentification: 96,
          correctSolution: 92,
          knowledgeAccuracy: 95,
          customerSatisfaction: 88,
          resolutionCompleteness: 90,
          overallQuality: 92
        }
      },
      startingSentiment: 'very_negative',
      endingSentiment: 'positive',
      sentimentImprovement: 65,
      resolved: true,
      escalated: false,
      timelineEvents: [
        {
          turn: 1,
          timestamp: '14:20:15',
          type: 'sentiment_shift',
          description: 'Customer arrived with 75% frustration on duplicate billing',
          severity: 'warning'
        },
        {
          turn: 1,
          timestamp: '14:21:00',
          type: 'kb_retrieved',
          description: 'KB-102 Duplicate Subscription Charges automatically retrieved with 94% relevance',
          severity: 'normal'
        },
        {
          turn: 2,
          timestamp: '14:22:10',
          type: 'empathy_bonus',
          description: 'Agent warmly acknowledged delay in prior email ticket',
          severity: 'positive'
        },
        {
          turn: 3,
          timestamp: '14:24:05',
          type: 'resolution_milestone',
          description: 'Full $49 refund processed; customer frustration dropped to 18%',
          severity: 'positive'
        }
      ],
      topWeaknesses: ['Initial response could have proactively offered account credit'],
      topStrengths: ['Accurate KB policy citation', 'Warm empathetic tone', 'Fast de-escalation'],
      recommendedTrainings: ['Handling High Net Worth Billing Disputes', 'Advanced Empathy in Financial Friction'],
      xpEarned: 180,
      responseComparisons: [
        {
          turnNumber: 1,
          originalAgentText: "I'm sorry for the trouble. Let me check your duplicate charge.",
          aiImprovedText: "I completely understand how frustrating it is to see duplicate charges and not receive a prompt reply to your previous email. Let me verify your account immediately and issue a full reversal.",
          improvementExplanation: "Directly validates prior unanswered ticket and shows personal accountability."
        }
      ]
    },
    {
      id: 'sess-102',
      agentName: 'Alex Morgan',
      agentId: 'agent-001',
      scenarioId: 'SCENARIO-02',
      scenarioTitle: 'Order Arrived Damaged Before Event',
      mode: 'simulator',
      coachingLevel: 'intermediate',
      difficulty: 'medium',
      startTime: '2026-08-25T11:00:00Z',
      endTime: '2026-08-25T11:05:30Z',
      durationSeconds: 330,
      status: 'completed',
      messages: [],
      score: {
        overall: 93,
        intentHandling: 98,
        knowledgeUsage: 94,
        empathy: 92,
        tone: 96,
        clarity: 96,
        resolution: 94,
        escalationHandling: 90,
        policyCompliance: 96,
        resolutionQuality: {
          problemIdentification: 98,
          correctSolution: 95,
          knowledgeAccuracy: 96,
          customerSatisfaction: 94,
          resolutionCompleteness: 95,
          overallQuality: 96
        }
      },
      startingSentiment: 'negative',
      endingSentiment: 'positive',
      sentimentImprovement: 72,
      resolved: true,
      escalated: false,
      timelineEvents: [],
      topWeaknesses: ['Confirm shipping address before dispatching overnight parcel'],
      topStrengths: ['Waived return photo requirement gracefully', 'Priority overnight dispatch'],
      recommendedTrainings: ['Logistics Expedited Support'],
      xpEarned: 220,
      responseComparisons: []
    }
  ]
};

export const INITIAL_LEADERBOARD: LeaderboardEntry[] = [
  {
    rank: 1,
    agentId: 'agent-009',
    agentName: 'Sophia Lin',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    score: 96,
    sessionsCompleted: 68,
    resolutionRate: 98,
    escalationRate: 3,
    streakDays: 14,
    tier: 'Diamond'
  },
  {
    rank: 2,
    agentId: 'agent-001',
    agentName: 'Alex Morgan (You)',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    score: 89,
    sessionsCompleted: 42,
    resolutionRate: 92,
    escalationRate: 11,
    streakDays: 6,
    tier: 'Platinum'
  },
  {
    rank: 3,
    agentId: 'agent-004',
    agentName: 'Liam O\'Connor',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    score: 87,
    sessionsCompleted: 39,
    resolutionRate: 90,
    escalationRate: 14,
    streakDays: 5,
    tier: 'Gold'
  },
  {
    rank: 4,
    agentId: 'agent-007',
    agentName: 'Priya Sharma',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    score: 86,
    sessionsCompleted: 35,
    resolutionRate: 88,
    escalationRate: 15,
    streakDays: 8,
    tier: 'Gold'
  },
  {
    rank: 5,
    agentId: 'agent-012',
    agentName: 'Carlos Ramirez',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    score: 82,
    sessionsCompleted: 28,
    resolutionRate: 84,
    escalationRate: 19,
    streakDays: 2,
    tier: 'Silver'
  }
];

export const INITIAL_TRAINING_PLANS: TrainingPlanWeek[] = [
  {
    weekNumber: 1,
    title: 'Empathy & Active Emotional De-escalation',
    focusArea: 'Handling Angry & High-Frustration Customers',
    assignedScenarios: ['SCENARIO-01', 'SCENARIO-03'],
    completedScenarios: ['SCENARIO-01'],
    status: 'current',
    targetScore: 90
  },
  {
    weekNumber: 2,
    title: 'Product Knowledge & Policy Mastery (RAG)',
    focusArea: 'Accurate Source Citation & Compliance with Zero Hallucination',
    assignedScenarios: ['SCENARIO-02', 'SCENARIO-04'],
    completedScenarios: ['SCENARIO-02'],
    status: 'upcoming',
    targetScore: 92
  },
  {
    weekNumber: 3,
    title: 'High-Stakes Technical Crisis & VIP Accounts',
    focusArea: 'Rapid Incident Triaging & Technical Conciseness',
    assignedScenarios: ['SCENARIO-05'],
    completedScenarios: [],
    status: 'upcoming',
    targetScore: 90
  },
  {
    weekNumber: 4,
    title: 'Escalation Prevention & Executive Retention',
    focusArea: 'Zero Unnecessary Transfers & Retention Mastery',
    assignedScenarios: ['SCENARIO-03', 'SCENARIO-04'],
    completedScenarios: [],
    status: 'upcoming',
    targetScore: 95
  }
];

export const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 'log-01',
    timestamp: '2026-08-27 05:40:12',
    userName: 'Alex Morgan',
    action: 'Session Completed',
    category: 'session',
    details: 'Completed simulation session for "Duplicate Subscription Charge Dispute" with 89% score.'
  },
  {
    id: 'log-02',
    timestamp: '2026-08-26 19:15:30',
    userName: 'Admin (Sarah Connor)',
    action: 'Knowledge Document Updated',
    category: 'knowledge',
    details: 'Updated KB-101 (Refund & Credit Policy Guidelines) - reindexed 14 chunks.'
  },
  {
    id: 'log-03',
    timestamp: '2026-08-26 14:02:11',
    userName: 'Trainer (Marcus Lee)',
    action: 'AI Scenario Generated',
    category: 'scenario',
    details: 'Generated new scenario "Account Locked Out During Critical Presentation" with Expert difficulty.'
  },
  {
    id: 'log-04',
    timestamp: '2026-08-26 10:10:00',
    userName: 'System Orchestrator',
    action: 'PII Protection Rule Triggered',
    category: 'system',
    details: 'Masked credit card format pattern in live conversation turn #2.'
  }
];
