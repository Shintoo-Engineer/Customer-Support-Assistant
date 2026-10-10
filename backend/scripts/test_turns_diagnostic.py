import sys
from pathlib import Path
backend_dir = Path(r"c:\Users\shrushti\Customer-Support-Assistant-New\backend")
sys.path.insert(0, str(backend_dir))

from app.services.analysis_service import (
    _normalize_text,
    _keyword_matches,
    detect_intent,
    detect_emotion,
    detect_sentiment,
    calculate_frustration,
    determine_satisfaction_trend,
    detect_escalation_risk,
    EMOTION_KEYWORDS,
    NEGATIVE_WORDS,
)

# Test Turn 1 opening message:
turn1 = "Hi, I was charged $49.99 for a subscription renewal that I requested to cancel last week. I need a full refund issued back to my card immediately."

# Test Turn 4 de-escalating message:
turn4 = "*Sigh* Finally, someone actually listens—though it shouldn't have taken pulling teeth and threatening to talk to a supervisor to get this basic issue resolved. Fine, please process the $49.99 refund back to my original card right now, and give me the confirmation details so I can make sure it's actually done this time."

history_up_to_turn4 = [
    {"sender_type": "Customer", "message_text": turn1},
    {"sender_type": "Support Agent", "message_text": "Could you provide order ID?"},
    {"sender_type": "Customer", "message_text": "I already explained this twice, order #INV-49201."},
    {"sender_type": "Support Agent", "message_text": "It is against our policy. Deal with it."},
    {"sender_type": "Customer", "message_text": "Are you kidding me?! Let me speak to a supervisor immediately!"},
    {"sender_type": "Support Agent", "message_text": "I am so sorry, let me refund $49.99 right now."},
]

print("Turn 1 text:", turn1)
print("Turn 4 text:", turn4)
