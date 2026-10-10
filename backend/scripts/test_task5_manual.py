import sys
from pathlib import Path
backend_dir = Path(r"c:\Users\shrushti\Customer-Support-Assistant-New\backend")
sys.path.insert(0, str(backend_dir))

from app.services.knowledge_recommendation_service import recommend_knowledge

test_cases = [
    ("payment_issue", "My credit card was declined and payment failed with error ERR_PAYMENT_FAILED_04"),
    ("delivery_issue", "Where is my package? The tracking has not updated and delivery is delayed by 3 days"),
    ("refund", "I need a full refund for my order #INV-49201. Please reverse the charge"),
    ("return_exchange", "The item arrived damaged and I want to return or exchange it for a new one"),
    ("account_issue", "I am locked out of my corporate account because of two-factor authentication 2FA issue"),
    ("out_of_domain", "What is the best recipe for chocolate cake with strawberry frosting?")
]

print("=" * 70)
print("TASK 5 KNOWLEDGE RECOMMENDATION VERIFICATION")
print("=" * 70)

for category, query in test_cases:
    print(f"\n[TEST CASE: {category}]")
    print(f"Query: \"{query}\"")
    result = recommend_knowledge(message=query, conversation_history=[], number_of_recommendations=3)
    recs = result.get("recommendations", [])
    print(f"Result count: {len(recs)}, Message: \"{result.get('message')}\"")
    for r in recs:
        print(f"  - Rank {r['rank']}: {r['document_name']} (score: {r['relevance_score']}, chunk: {r['chunk_id']})")
