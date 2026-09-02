from app.services.pdf_service import extract_text_from_pdf


pdf_path = "data/documents/refund_policy_v1.pdf"

pages = extract_text_from_pdf(pdf_path)

print(f"Total pages: {len(pages)}")

for page in pages:
    print("\n--------------------")
    print(f"Page: {page['page_number']}")
    print("--------------------")
    print(page["text"][:500])