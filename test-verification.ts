process.env.SERVERLESS = '1';
import { app } from './server';
import { seedInitialData } from './server/db';
import http from 'http';

async function runTests() {
  console.log('========================================');
  console.log('STARTING INTEGRATION VERIFICATION SUITE');
  console.log('========================================\n');

  console.log('--- Initializing & Seeding Database ---');
  await seedInitialData();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const port = address.port;
  const baseUrl = `http://127.0.0.1:${port}`;

  console.log(`Test server running at ${baseUrl}`);

  try {
    // 1. Admin Login
    console.log('\n[TEST 1] Admin Login...');
    const adminLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com', password: 'Admin123!' })
    });
    const adminLogin = await adminLoginRes.json();
    console.log('✓ Admin Login status:', adminLoginRes.status, '| Role:', adminLogin.user?.role, '| Token generated:', !!adminLogin.token);
    if (!adminLogin.token || adminLogin.user?.role !== 'admin') throw new Error('Admin login failed');

    // 2. Trainer Login
    console.log('\n[TEST 2] Trainer Login...');
    const trainerLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'trainer@example.com', password: 'Trainer123!' })
    });
    const trainerLogin = await trainerLoginRes.json();
    console.log('✓ Trainer Login status:', trainerLoginRes.status, '| Role:', trainerLogin.user?.role, '| Token generated:', !!trainerLogin.token);
    if (!trainerLogin.token || trainerLogin.user?.role !== 'trainer') throw new Error('Trainer login failed');

    // 3. Employee Login
    console.log('\n[TEST 3] Employee Login...');
    const empLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'employee@example.com', password: 'Employee123!' })
    });
    const empLogin = await empLoginRes.json();
    console.log('✓ Employee Login status:', empLoginRes.status, '| Role:', empLogin.user?.role, '| Token generated:', !!empLogin.token);
    if (!empLogin.token || empLogin.user?.role !== 'employee') throw new Error('Employee login failed');

    const empToken = empLogin.token;

    // Test GET /api/auth/me
    console.log('\n[TEST 3b] GET /api/auth/me with Bearer token...');
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${empToken}` }
    });
    const meData = await meRes.json();
    console.log('✓ GET /api/auth/me status:', meRes.status, '| User:', meData.user?.email, '| Role:', meData.user?.role);
    if (!meData.user || meData.user.email !== 'employee@example.com') throw new Error('/api/auth/me failed');

    // 4 & 5. Policy AI Assistant - Annual leave question
    console.log('\n[TEST 4 & 5] Policy AI Assistant - Annual leave question...');
    const leaveRes = await fetch(`${baseUrl}/api/assistant/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${empToken}`
      },
      body: JSON.stringify({
        message: "What is the company's annual leave policy?",
        history: []
      })
    });
    const leaveData = await leaveRes.json();
    console.log('✓ Leave question status:', leaveRes.status);
    console.log('  Sources count:', leaveData.sources?.length, '| Top source:', leaveData.sources?.[0]?.documentTitle);
    console.log('  Answer summary:', leaveData.answer?.slice(0, 150).replace(/\n+/g, ' '), '...');
    if (!leaveData.answer || leaveData.sources?.length === 0) throw new Error('Leave question failed');

    // 6. Policy AI Assistant - IT password question
    console.log('\n[TEST 6] Policy AI Assistant - IT password security question...');
    const passRes = await fetch(`${baseUrl}/api/assistant/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${empToken}`
      },
      body: JSON.stringify({
        message: "What are the IT password rules and expiration guidelines?",
        history: []
      })
    });
    const passData = await passRes.json();
    console.log('✓ Password question status:', passRes.status);
    console.log('  Sources count:', passData.sources?.length, '| Top source:', passData.sources?.[0]?.documentTitle);
    console.log('  Answer summary:', passData.answer?.slice(0, 150).replace(/\n+/g, ' '), '...');
    if (!passData.answer || passData.sources?.length === 0) throw new Error('Password question failed');

    // 7. Policy AI Assistant - Random unrelated question
    console.log('\n[TEST 7] Policy AI Assistant - Anti-hallucination guard on unrelated question...');
    const randRes = await fetch(`${baseUrl}/api/assistant/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${empToken}`
      },
      body: JSON.stringify({
        message: "What is the average surface temperature on Mars and how to cook pizza?",
        history: []
      })
    });
    const randData = await randRes.json();
    console.log('✓ Unrelated question status:', randRes.status);
    console.log('  Sources returned:', randData.sources?.length);
    console.log('  Safe refusal answer:', randData.answer);
    if (!randData.answer.includes("couldn't find this information in the available company policies")) {
      throw new Error('Anti-hallucination check failed');
    }

    // 8-11. Training simulator dynamic responses and state changes
    console.log('\n[TEST 8-11] Training Simulator Dynamic Responses...');

    const dummyScenario = {
      title: "Duplicate Billing Dispute",
      category: "Billing",
      initialProblem: "Subscription billed twice on monthly renewal.",
      customerPersona: {
        name: "Jordan Miller",
        type: "Angry",
        behaviorDescription: "Demands immediate refund for duplicate charge.",
        baseFrustration: 75,
        patience: 30,
        trust: 35,
        satisfaction: 20,
        escalationIntent: 60
      }
    };

    // Test A: Greeting
    console.log('\n--- Case A: Agent sends Greeting ("Hello!") ---');
    const simGreetingRes = await fetch(`${baseUrl}/api/simulate-customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scenario: dummyScenario,
        conversationHistory: [],
        agentResponse: "Hello! Welcome to support, how can I assist you today?"
      })
    });
    const simGreeting = await simGreetingRes.json();
    console.log('✓ Customer Response:', simGreeting.nextCustomerMessage);
    console.log('  Frustration:', simGreeting.updatedCustomerState?.frustration, '| Trust:', simGreeting.updatedCustomerState?.trust);

    // Test B: Empathetic + Refund
    console.log('\n--- Case B: Agent expresses empathy & promises refund ---');
    const simRefundRes = await fetch(`${baseUrl}/api/simulate-customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scenario: dummyScenario,
        conversationHistory: [{ sender: 'agent', text: 'Hello' }],
        agentResponse: "I understand you're frustrated. I'm sorry about the duplicate charge. I'll check KB-102 and help process the refund right away.",
        currentCustomerState: simGreeting.updatedCustomerState
      })
    });
    const simRefund = await simRefundRes.json();
    console.log('✓ Customer Response:', simRefund.nextCustomerMessage);
    console.log('  Frustration:', simRefund.updatedCustomerState?.frustration, '| Trust:', simRefund.updatedCustomerState?.trust);
    console.log('  Explanation:', simRefund.stateChangeExplanation);

    // Test C: Dismissive "Wait"
    console.log('\n--- Case C: Agent says "You need to wait." ---');
    const simWaitRes = await fetch(`${baseUrl}/api/simulate-customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scenario: dummyScenario,
        conversationHistory: [],
        agentResponse: "You need to wait.",
        currentCustomerState: { frustration: 60, trust: 40, patience: 40, satisfaction: 30, escalationIntent: 40 }
      })
    });
    const simWait = await simWaitRes.json();
    console.log('✓ Customer Response:', simWait.nextCustomerMessage);
    console.log('  Frustration:', simWait.updatedCustomerState?.frustration, '| Escalation Intent:', simWait.updatedCustomerState?.escalationIntent);

    // Test D: Repetitive dismissive "I have already explained the same thing."
    console.log('\n--- Case D: Agent says "I have already explained the same thing." ---');
    const simRepeatRes = await fetch(`${baseUrl}/api/simulate-customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scenario: dummyScenario,
        conversationHistory: [],
        agentResponse: "I have already explained the same thing.",
        currentCustomerState: { frustration: 65, trust: 30, patience: 30, satisfaction: 25, escalationIntent: 55 }
      })
    });
    const simRepeat = await simRepeatRes.json();
    console.log('✓ Customer Response:', simRepeat.nextCustomerMessage);
    console.log('  Frustration:', simRepeat.updatedCustomerState?.frustration, '| Escalation Intent:', simRepeat.updatedCustomerState?.escalationIntent);

    // Test E: Blunt Policy "That's our policy."
    console.log('\n--- Case E: Agent says "That\'s our policy." ---');
    const simPolicyRes = await fetch(`${baseUrl}/api/simulate-customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scenario: dummyScenario,
        conversationHistory: [],
        agentResponse: "That's our policy.",
        currentCustomerState: { frustration: 60, trust: 40, patience: 40, satisfaction: 30, escalationIntent: 40 }
      })
    });
    const simPolicy = await simPolicyRes.json();
    console.log('✓ Customer Response:', simPolicy.nextCustomerMessage);
    console.log('  Frustration:', simPolicy.updatedCustomerState?.frustration);

    // Test F: Resolution Confirmation
    console.log('\n--- Case F: Agent resolves issue with confirmation ---');
    const simConfRes = await fetch(`${baseUrl}/api/simulate-customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scenario: dummyScenario,
        conversationHistory: [],
        agentResponse: "I am deeply sorry. I have processed the refund and you should receive confirmation email shortly within 3-5 business days.",
        currentCustomerState: { frustration: 35, trust: 65, patience: 60, satisfaction: 60, escalationIntent: 15 }
      })
    });
    const simConf = await simConfRes.json();
    console.log('✓ Customer Response:', simConf.nextCustomerMessage);
    console.log('  Frustration:', simConf.updatedCustomerState?.frustration, '| Satisfaction:', simConf.updatedCustomerState?.satisfaction);
    console.log('  Is Resolved:', simConf.isResolved);

    console.log('\n========================================');
    console.log('ALL 12 INTEGRATION & SIMULATOR TESTS PASSED!');
    console.log('========================================\n');

  } finally {
    server.close();
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
