import os
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import parse_xml, OxmlElement
from docx.oxml.ns import nsdecls, qn

def set_cell_background(cell, fill_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=120, bottom=120, left=160, right=160):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(f'''
        <w:tcMar {nsdecls("w")}>
            <w:top w:w="{top}" w:type="dxa"/>
            <w:bottom w:w="{bottom}" w:type="dxa"/>
            <w:left w:w="{left}" w:type="dxa"/>
            <w:right w:w="{right}" w:type="dxa"/>
        </w:tcMar>
    ''')
    tcPr.append(tcMar)

def add_header_cell(row, col_idx, text, width_in_inches=None):
    cell = row.cells[col_idx]
    if width_in_inches:
        cell.width = Inches(width_in_inches)
    set_cell_background(cell, "1E293B")
    set_cell_margins(cell, top=140, bottom=140, left=180, right=180)
    p = cell.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    run = p.add_run(text)
    run.font.bold = True
    run.font.size = Pt(9.5)
    run.font.color.rgb = RGBColor(255, 255, 255)
    run.font.name = "Calibri"

def add_body_cell(row, col_idx, text, is_bold=False, text_color="0F172A", bg_color="FFFFFF", width_in_inches=None):
    cell = row.cells[col_idx]
    if width_in_inches:
        cell.width = Inches(width_in_inches)
    if bg_color != "FFFFFF":
        set_cell_background(cell, bg_color)
    set_cell_margins(cell, top=100, bottom=100, left=150, right=150)
    p = cell.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    run = p.add_run(text)
    run.font.bold = is_bold
    run.font.size = Pt(9)
    run.font.name = "Calibri"
    r = int(text_color[0:2], 16)
    g = int(text_color[2:4], 16)
    b = int(text_color[4:6], 16)
    run.font.color.rgb = RGBColor(r, g, b)

def create_document():
    doc = docx.Document()

    # Set page margins
    sections = doc.sections
    for section in sections:
        section.top_margin = Inches(0.75)
        section.bottom_margin = Inches(0.75)
        section.left_margin = Inches(0.75)
        section.right_margin = Inches(0.75)

    # Document Header / Title
    title_p = doc.add_paragraph()
    title_p.paragraph_format.space_before = Pt(0)
    title_p.paragraph_format.space_after = Pt(4)
    run_title = title_p.add_run("Customer Support Assistant — Master Testing Document")
    run_title.font.name = "Calibri"
    run_title.font.size = Pt(22)
    run_title.font.bold = True
    run_title.font.color.rgb = RGBColor(30, 41, 59) # Slate 800

    sub_p = doc.add_paragraph()
    sub_p.paragraph_format.space_after = Pt(14)
    run_sub = sub_p.add_run("Comprehensive End-to-End & Unit Testing Specification (Tasks 1 to 8 with Negative & Positive Scenarios)")
    run_sub.font.name = "Calibri"
    run_sub.font.size = Pt(11)
    run_sub.font.color.rgb = RGBColor(79, 70, 229) # Indigo 600

    # Meta Table
    meta_table = doc.add_table(rows=4, cols=4)
    meta_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    meta_data = [
        ("Project:", "AI Customer Support Assistant", "Version:", "2.0 (Full E2E Tasks 1-8)"),
        ("Document Type:", "Master Testing Specification", "Environment:", "Local (Frontend: 5173 / Backend: 8000)"),
        ("Coverage:", "Tasks 1 - 8 (Auth, RAG, Simulator, Analysis, Coaching, Console, Analytics)", "Status:", "Active / Verified"),
        ("Total Test Cases:", "10 Comprehensive Test Cases (Positive & Negative)", "Execution Target:", "Frontend UI, Backend API & Unit Integration")
    ]
    for row_idx, (l1, v1, l2, v2) in enumerate(meta_data):
        row = meta_table.rows[row_idx]
        add_body_cell(row, 0, l1, is_bold=True, bg_color="F1F5F9", width_in_inches=1.3)
        add_body_cell(row, 1, v1, width_in_inches=2.2)
        add_body_cell(row, 2, l2, is_bold=True, bg_color="F1F5F9", width_in_inches=1.3)
        add_body_cell(row, 3, v2, width_in_inches=2.2)

    doc.add_paragraph().paragraph_format.space_after = Pt(10)

    # Section 1: Executive Testing Scope
    h1 = doc.add_heading(level=1)
    run_h1 = h1.add_run("1. Testing Scope & Methodology")
    run_h1.font.name = "Calibri"
    run_h1.font.color.rgb = RGBColor(30, 41, 59)

    scope_p = doc.add_paragraph(
        "This document defines the minimum comprehensive set of 10 test cases required to validate the entire "
        "Customer Support Assistant codebase from end to end. The suite encompasses both positive workflows (happy paths) "
        "and critical negative scenarios (invalid inputs, unauthorized access, out-of-domain knowledge limits, and critical "
        "escalation triggers). Each test case maps directly to backend unit test suites and frontend component behaviors."
    )
    scope_p.paragraph_format.space_after = Pt(12)

    # Summary Matrix Table
    h2 = doc.add_heading(level=2)
    run_h2 = h2.add_run("2. Master Test Suite Matrix (Max 10 Cases)")
    run_h2.font.name = "Calibri"
    run_h2.font.color.rgb = RGBColor(30, 41, 59)

    matrix_table = doc.add_table(rows=1, cols=6)
    matrix_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    header_row = matrix_table.rows[0]
    add_header_cell(header_row, 0, "Test ID", 0.8)
    add_header_cell(header_row, 1, "Task Scope", 1.2)
    add_header_cell(header_row, 2, "Test Scenario Title", 2.2)
    add_header_cell(header_row, 3, "Type", 0.9)
    add_header_cell(header_row, 4, "Key Focus Area", 1.2)
    add_header_cell(header_row, 5, "Status", 0.7)

    matrix_data = [
        ("TC-01", "Task 1 (Auth)", "Invalid Credentials & Field Validation", "NEGATIVE", "401 / Error validation toast", "PASS"),
        ("TC-02", "Task 1 (Auth/RBAC)", "Valid Employee Login & Mode Access", "POSITIVE", "JWT token, role badge, sidebar unlock", "PASS"),
        ("TC-03", "Task 2 (RAG KB)", "Knowledge Document Indexing & Embeddings", "POSITIVE", "SOP upload, chunk/vector generation", "PASS"),
        ("TC-04", "Task 2 & 5 (RAG Grounding)", "Out-of-Domain Query & Anti-Hallucination", "NEGATIVE", "Zero-hallucination guard, fallback note", "PASS"),
        ("TC-05", "Task 3 & 4 (Simulator)", "Customer Simulation & Multi-Turn Analysis", "POSITIVE", "Persona generation, emotion & frustration", "PASS"),
        ("TC-06", "Task 4, 5, 6 (Coaching)", "AI Response, Guidance & De-escalation", "POSITIVE", "Contextual response, coaching ratings", "PASS"),
        ("TC-07", "Task 6 (Escalation)", "Dismissive Response & Critical Alert Trigger", "NEGATIVE", "Frustration 10/10, supervisor alert", "PASS"),
        ("TC-08", "Task 5 & 7A (Manual)", "Manual Mode & 15-Day Policy Grounding", "BOUNDARY", "14-day request against 15-day policy", "PASS"),
        ("TC-09", "Task 7B (Replay)", "Replay Controls & State Synchronization", "POSITIVE", "Play, Pause, Next, Prev, Summary", "PASS"),
        ("TC-10", "Task 8 (Summary/KPI)", "Post-Session Report & Analytics Dashboard", "POSITIVE", "End-session summary, dynamic DB KPIs", "PASS"),
    ]

    for item in matrix_data:
        row = matrix_table.add_row()
        badge_bg = "FEE2E2" if item[3] == "NEGATIVE" else ("FEF3C7" if item[3] == "BOUNDARY" else "F0FDF4")
        text_color = "991B1B" if item[3] == "NEGATIVE" else ("92400E" if item[3] == "BOUNDARY" else "166534")

        add_body_cell(row, 0, item[0], is_bold=True, width_in_inches=0.8)
        add_body_cell(row, 1, item[1], width_in_inches=1.2)
        add_body_cell(row, 2, item[2], is_bold=True, width_in_inches=2.2)
        add_body_cell(row, 3, item[3], is_bold=True, text_color=text_color, bg_color=badge_bg, width_in_inches=0.9)
        add_body_cell(row, 4, item[4], width_in_inches=1.2)
        add_body_cell(row, 5, item[5], is_bold=True, text_color="166534", bg_color="DCFCE7", width_in_inches=0.7)

    doc.add_paragraph().paragraph_format.space_after = Pt(14)

    # Detailed Test Cases
    h3 = doc.add_heading(level=2)
    run_h3 = h3.add_run("3. Detailed Functional & Unit Test Case Specifications")
    run_h3.font.name = "Calibri"
    run_h3.font.color.rgb = RGBColor(30, 41, 59)

    test_cases_details = [
        {
            "id": "TC-01",
            "title": "Invalid Login Credentials & Input Validation (Task 1 — Authentication)",
            "type": "NEGATIVE",
            "task": "Task 1 (User Authentication & RBAC)",
            "objective": "Verify that login fails securely with informative validation when empty fields, invalid email format, or wrong passwords are submitted, and prevent unauthorized dashboard access.",
            "preconditions": "User is on the login page (http://localhost:5173/login) without an active JWT session.",
            "inputs": (
                "Step 1: Leave Email and Password empty and click 'Sign In'.\n"
                "Step 2: Enter Email 'employee@company.com' with wrong Password 'WrongPass999!' and click 'Sign In'."
            ),
            "expected": (
                "1. Empty inputs trigger HTML5 / UI form validation ('Please fill in this field').\n"
                "2. Backend returns HTTP 401 Unauthorized with error detail: 'Invalid email or password'.\n"
                "3. Frontend displays an error toast notification without page reload.\n"
                "4. No JWT token is stored in localStorage; user remains on /login; Dashboard access is blocked."
            ),
            "unit_mapping": "backend/app/api/auth.py (login endpoint) & frontend/src/components/LoginView.tsx"
        },
        {
            "id": "TC-02",
            "title": "Valid Employee Authentication & Role-Based Dashboard Access (Task 1 — Authentication)",
            "type": "POSITIVE",
            "task": "Task 1 (Authentication & RBAC Navigation)",
            "objective": "Verify successful employee authentication, JWT bearer token persistence, role assignment, and access to all 7 primary support modules.",
            "preconditions": "Application running, valid user 'employee@company.com' seeded in database.",
            "inputs": (
                "1. Navigate to: http://localhost:5173/login\n"
                "2. Email: employee@company.com\n"
                "3. Password: Employee1234!\n"
                "4. Click 'Sign In' button."
            ),
            "expected": (
                "1. Backend returns HTTP 200 OK with access_token, user_id=4, and role='employee'.\n"
                "2. Token stored in localStorage; user redirected to Dashboard.\n"
                "3. Top bar displays 'Support Employee' and 'employee' role badge.\n"
                "4. Left sidebar unlocks: Dashboard, Simulator, Manual Mode, Replay Mode, Live Console, Knowledge Base, and Analytics."
            ),
            "unit_mapping": "backend/app/api/auth.py, tests/test_simulator.py & frontend/src/App.tsx"
        },
        {
            "id": "TC-03",
            "title": "Knowledge Document Ingestion, Chunking & Indexing (Task 2 — Knowledge Base RAG)",
            "type": "POSITIVE",
            "task": "Task 2 (Knowledge Base Management & Ingestion)",
            "objective": "Verify that custom SOP documents can be added, automatically chunked, embedded, indexed, and displayed in the document reader with accurate metadata.",
            "preconditions": "User logged in as employee/admin and on the Knowledge Base view.",
            "inputs": (
                "1. Click 'Knowledge Base' in sidebar.\n"
                "2. Click '+ Add Knowledge Document' button.\n"
                "3. Document Title: 'Express Shipping & Replacement Policy'\n"
                "4. Category: 'Shipping'\n"
                "5. Summary: 'Defines 2-day expedited shipping rules and transit damage replacement policies.'\n"
                "6. Content: 'Customers requesting express replacement must report transit damage within 48 hours of delivery. A replacement tracking number will be provided immediately upon receipt of carrier inspection photos.'\n"
                "7. Click 'Save & Index Document'."
            ),
            "expected": (
                "1. Modal closes cleanly with zero JavaScript runtime errors.\n"
                "2. New document appears at the top of the Knowledge Base list with 'indexed' green badge.\n"
                "3. Chunk count (1 chunk) and embedding count are dynamically calculated.\n"
                "4. Right reader pane automatically selects and renders document text and Zero Hallucination Guard badge.\n"
                "5. Top Vector Index counter increments."
            ),
            "unit_mapping": "tests/test_ingestion_service.py, test_embedding_service.py & KnowledgeBaseView.tsx"
        },
        {
            "id": "TC-04",
            "title": "Out-of-Domain Retrieval & Anti-Hallucination Guard (Task 2 & 5 — Knowledge Grounding)",
            "type": "NEGATIVE",
            "task": "Task 2 & 5 (RAG Grounding & Anti-Hallucination)",
            "objective": "Verify that queries with no relevance in the indexed knowledge base return low similarity scores, avoid fabricating policy facts, and provide safe fallback guidance.",
            "preconditions": "Knowledge base indexed with standard support policies (Account, Billing, Shipping, Returns).",
            "inputs": (
                "1. Navigate to Manual Mode (or API analyze endpoint).\n"
                "2. Customer query: 'Can I stake my cryptocurrency wallet tokens to earn daily cashback on order deliveries?'\n"
                "3. Click 'Analyze Message'."
            ),
            "expected": (
                "1. Vector distance exceeds threshold; no document retrieved with relevance >= 0.50.\n"
                "2. Knowledge recommendation returns fallback message: 'Waiting for relevant document' / general guidance.\n"
                "3. Suggested response does NOT invent fake cryptocurrency terms or cashback guarantees.\n"
                "4. Suggested response politely asks customer to clarify their order details or refers to standard accepted payment methods."
            ),
            "unit_mapping": "backend/app/services/knowledge_recommendation_service.py & tests/test_knowledge_recommendation.py"
        },
        {
            "id": "TC-05",
            "title": "Customer Persona Simulator & Real-Time Conversation Analysis (Task 3 & 4)",
            "type": "POSITIVE",
            "task": "Task 3 (Simulator) & Task 4 (Analysis Engine)",
            "objective": "Verify customer profile initialization, dynamic opening message generation, and real-time computation of intent, emotion, sentiment, frustration, and satisfaction trends.",
            "preconditions": "Employee logged in, on Simulator view.",
            "inputs": (
                "1. Click 'Simulator' in sidebar.\n"
                "2. Session Label: 'Billing Dispute - Overcharge'\n"
                "3. Persona: 'Frustrated' | Emotion: 'Frustrated' | Scenario: 'Refund Request'\n"
                "4. Issue Severity: 4 | Patience: 40% | Resolution: 'Issue $49.99 full refund'\n"
                "5. Click 'Start Simulation'."
            ),
            "expected": (
                "1. Redirects to Live Console with active session header and scenario title.\n"
                "2. AI Customer opening message generated: 'Hi, I was charged $49.99 for a subscription renewal that I requested to cancel last week. I need a full refund issued back to my card immediately.'\n"
                "3. Task 4 Live Analysis calculates:\n"
                "   - Intent: 'Refund Status'\n"
                "   - Emotion: 'Frustrated' (Red) | Sentiment: 'Negative'\n"
                "   - Frustration Level: 8/10\n"
                "   - Satisfaction: 'Declining' | Escalation: 'High'\n"
                "   - Confidence: ~84%\n"
                "4. Bottom chat textarea and dark 'Send' button are fully visible on screen."
            ),
            "unit_mapping": "backend/app/services/simulator_service.py, app/services/analysis_service.py & tests/test_analysis_service.py"
        },
        {
            "id": "TC-06",
            "title": "AI Coaching, Grounded Response Suggestion & De-escalation (Tasks 4, 5, 6)",
            "type": "POSITIVE",
            "task": "Tasks 4, 5 & 6 (AI Coaching & Response Guidance)",
            "objective": "Verify that AI coaching generates an empathetic, policy-grounded recommended response and tracks customer de-escalation across multiple interaction turns.",
            "preconditions": "Active simulation from TC-05 running in Live Console.",
            "inputs": (
                "Turn 1: Click purple 'Use Response' on the Recommended Response card and click 'Send'.\n"
                "Customer pushes back asking for an exact timeline for invoice #INV-49201.\n"
                "Turn 2: Enter: 'I understand your frustration. I have verified invoice #INV-49201 right now. It normally takes 5 to 7 business days for the $49.99 to credit back to your card. I am monitoring this personally.' and click 'Send'."
            ),
            "expected": (
                "1. Turn 1 AI suggested response references the $49.99 charge and cancellation review.\n"
                "2. Coaching feedback displays ratings for Tone, Empathy, Clarity, and Professionalism with actionable tips.\n"
                "3. Customer simulator responds in character with invoice #INV-49201 and timeline inquiry.\n"
                "4. After Turn 2 agent resolution, customer simulator concedes ('*Sighs heavily* Five to seven business days?... Fine. Just make sure it actually gets approved today...').\n"
                "5. Live Analysis updates: Frustration decreases (8/10 -> 7/10 -> 6/10), Satisfaction switches to 'Improving' (Green), Escalation drops to 'Medium'."
            ),
            "unit_mapping": "backend/app/services/coaching_service.py, tests/test_simulator.py & LiveConsoleView.tsx"
        },
        {
            "id": "TC-07",
            "title": "Dismissive Agent Response & Critical Escalation Alert (Task 6 — Escalation Engine)",
            "type": "NEGATIVE",
            "task": "Task 6 (Escalation Monitor & Alert System)",
            "objective": "Verify that poor agent handling, dismissive refusal, and supervisor escalation demands trigger the mathematical escalation threshold (>= 90%) and activate the critical alert banner.",
            "preconditions": "Active session in Live Console.",
            "inputs": (
                "1. In chat input, enter: 'Company policy says all charges and subscription renewals are strictly non-refundable. We cannot issue any refund under any circumstances.'\n"
                "2. Click 'Send'."
            ),
            "expected": (
                "1. AI customer responds with extreme anger: 'Are you kidding me?! I want to speak to a supervisor immediately! Put me through to your manager right now!'\n"
                "2. Task 4 Analysis updates:\n"
                "   - Frustration: 10/10 (Maximum)\n"
                "   - Satisfaction: 'Declining' | Escalation: 'Critical'\n"
                "3. Task 6 Escalation Risk Monitor:\n"
                "   - Risk Score: 10/10 (100%)\n"
                "   - Monitoring Status: 'Critical Alert' (Red high-contrast banner active)\n"
                "   - Indicators: 'Customer frustration is extremely high', 'Customer explicitly requested escalation or human assistance'.\n"
                "   - Recommended Action: 'Acknowledge the customer's frustration, take ownership, provide the verified resolution path, and prepare for immediate human escalation.'"
            ),
            "unit_mapping": "backend/app/services/escalation_service.py & tests/test_analysis_service.py"
        },
        {
            "id": "TC-08",
            "title": "Manual Console & Strict 15-Day Refund Policy Boundary (Task 5 & 7A)",
            "type": "BOUNDARY",
            "task": "Task 5 & 7A (Manual Console & Policy Grounding)",
            "objective": "Verify Manual Mode direct message analysis and test strict policy grounding: confirming that a 14-day return inquiry correctly matches the authoritative 15-day policy without hallucinating a 14-day rule.",
            "preconditions": "Application running, accessible from sidebar tab 'Manual Mode'.",
            "inputs": (
                "1. Click 'Manual Mode' in sidebar.\n"
                "2. In Customer Message box, enter: 'I bought this item 14 days ago and want to return it under the cooling-off period. Can I get a full refund?'\n"
                "3. Click 'Analyze Message'.\n"
                "4. Follow-up: In Agent Response, enter: 'Yes, you are within our 15-day refund window. Please provide your order number.' and click 'Send Response'."
            ),
            "expected": (
                "1. Task 4 Analysis: Intent: 'refund_status', Emotion: 'neutral', Frustration: 0/10, Escalation Risk: 'Low'.\n"
                "2. Task 5 Knowledge: Top retrieved doc is 'Refund Policy' (Version 1, Page 1, relevance ~0.55), quoting 'within 15 calendar days of the original purchase date'.\n"
                "3. Task 6 Suggested Response confirms eligibility under the 15-day policy (does not hallucinate a 14-day policy limit).\n"
                "4. Conversation history appends both turns and retains complete dialogue thread."
            ),
            "unit_mapping": "backend/app/api/analysis.py & frontend/src/components/ManualModeModal.tsx"
        },
        {
            "id": "TC-09",
            "title": "Replay Controls, Step Navigation & Multi-Turn State Synchronization (Task 7B)",
            "type": "POSITIVE",
            "task": "Task 7B (Replay Training Workspace)",
            "objective": "Verify Replay Mode controls (Play, Pause, Next Turn, Previous, Restart) and confirm turn-by-turn synchronized updates of conversation messages, analysis metrics, knowledge articles, and coaching suggestions.",
            "preconditions": "User navigates to 'Replay Mode' from sidebar; case '01 - Billing' selected.",
            "inputs": (
                "1. Click 'Next Turn' (or 'Play') to move from Turn 1 to Turn 2.\n"
                "2. Click 'Previous' to return to Turn 1.\n"
                "3. Click 'Restart' to reset to Turn 1.\n"
                "4. Click 'Next Turn', then click 'Complete Replay'."
            ),
            "expected": (
                "1. Advancing to Turn 2 updates Progress to Turn 2/2 (50%), highlights message 3 ('It DID clear, I'm looking at my statement right here!'), surges Frustration to 100%, and updates knowledge to 'Refund Policy'.\n"
                "2. Clicking 'Previous' restores Turn 1 metrics (Frustration 80%, General Support FAQ).\n"
                "3. Clicking 'Restart' resets progress to 0% and clears draft.\n"
                "4. Clicking 'Complete Replay' renders the 'Replay Session Complete' celebration card showing 2 turns reviewed, average frustration (90%), and summary takeaways."
            ),
            "unit_mapping": "frontend/src/components/ReplayModeView.tsx & tests/test_simulator.py"
        },
        {
            "id": "TC-10",
            "title": "Post-Interaction Summary Report & Performance Analytics Dashboard (Task 8)",
            "type": "POSITIVE",
            "task": "Task 8 (Summary Reports & Performance Analytics)",
            "objective": "Verify generation of structured post-interaction reports from actual conversation turns and confirm live computation of aggregate KPI metrics on the Performance Analytics dashboard.",
            "preconditions": "Completed or active multi-turn interaction in Live Console.",
            "inputs": (
                "Part A: In Live Console, click dark 'Finish Session' button.\n"
                "Part B: In left sidebar, click 'Analytics' tab."
            ),
            "expected": (
                "Part A (Summary Report):\n"
                "- Structured modal opens displaying Primary Issue ('Refund Request'), Status ('Resolved'), Resolution Quality Score (>= 90/100), Empathy Score (>= 90/100), and Policy Adherence.\n"
                "- Sentiment Journey graph accurately renders the progression of customer frustration across turns (8/10 -> 7/10 -> 6/10).\n"
                "- Actionable Agent Strengths and Coaching Recommendations are listed.\n\n"
                "Part B (Performance Analytics):\n"
                "- KPI cards display dynamically calculated metrics from SQLite database:\n"
                "  * Total Sessions (65+), Completed Sessions (12+), Total Interactions (325+)\n"
                "  * Resolution Rate % = (Resolved Sessions / Total Sessions) * 100\n"
                "  * Average Resolution Quality (/100) & Average Frustration (/10)\n"
                "  * Escalation Frequency % = (Escalated Sessions / Total Sessions) * 100\n"
                "- Breakdown widgets render Common Customer Intents, Escalation Triggers, Knowledge Gap Indicators, and Recent Sessions history table."
            ),
            "unit_mapping": "backend/app/services/summary_service.py, analytics_service.py, tests/test_task8_summary_analytics.py & PerformanceAnalyticsView.tsx"
        }
    ]

    for tc in test_cases_details:
        doc.add_page_break()
        h_tc = doc.add_heading(level=2)
        r_tc = h_tc.add_run(f"[{tc['id']}] {tc['title']}")
        r_tc.font.name = "Calibri"
        r_tc.font.size = Pt(13)
        r_tc.font.bold = True
        r_tc.font.color.rgb = RGBColor(30, 41, 59)

        tc_table = doc.add_table(rows=8, cols=2)
        tc_table.alignment = WD_TABLE_ALIGNMENT.CENTER
        
        tc_rows = [
            ("Test Case ID & Type:", f"{tc['id']} — {tc['type']}"),
            ("Task Module & Scope:", tc['task']),
            ("Test Objective:", tc['objective']),
            ("Pre-Conditions:", tc['preconditions']),
            ("Test Steps & Inputs:", tc['inputs']),
            ("Expected Results:", tc['expected']),
            ("Code & Unit Test Mapping:", tc['unit_mapping']),
            ("Execution Status:", "VERIFIED & PASSED (Live Verified)")
        ]

        for r_idx, (label, val) in enumerate(tc_rows):
            row = tc_table.rows[r_idx]
            is_status = (r_idx == 7)
            bg = "DCFCE7" if is_status else "F8FAFC"
            txt_color = "166534" if is_status else "0F172A"
            add_body_cell(row, 0, label, is_bold=True, bg_color="F1F5F9", width_in_inches=1.8)
            add_body_cell(row, 1, val, is_bold=is_status, text_color=txt_color, bg_color=bg, width_in_inches=5.2)

    # Save to project root
    output_path = r"c:\Users\shrushti\Customer-Support-Assistant-New\Customer_Support_Assistant_Testing_Document.docx"
    doc.save(output_path)
    print(f"Successfully generated Word document at: {output_path}")

if __name__ == "__main__":
    create_document()
