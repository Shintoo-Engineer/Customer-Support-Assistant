from app.services.embedding_service import generate_embedding


text = """
Customers may request a refund within 15 calendar days
of the original purchase date.
"""


embedding = generate_embedding(text)


print("Embedding generated successfully.")
print("Vector length:", len(embedding))
print("First 10 values:", embedding[:10])