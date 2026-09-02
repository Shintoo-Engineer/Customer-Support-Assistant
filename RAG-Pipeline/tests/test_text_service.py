from app.services.text_service import clean_text, create_chunks


sample_text = """
Customers     may request a refund within 15 calendar days
of the original purchase date.

The product must be in usable condition and the customer
must provide the registered email address and order reference.
"""


cleaned_text = clean_text(sample_text)

print("CLEANED TEXT:")
print(cleaned_text)

print("\nCHUNKS:")

chunks = create_chunks(
    cleaned_text,
    chunk_size=20,
    overlap=5
)

for index, chunk in enumerate(chunks, start=1):
    print(f"\nChunk {index}:")
    print(chunk)