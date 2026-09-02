from app.services.ingestion_service import ingest_document


pdf_path = "data/documents/refund_policy_v1.pdf"


result = ingest_document(
    file_path=pdf_path,
    document_id=1,
    document_name="Refund Policy",
    document_type="policy",
    version=1,
    uploaded_by="admin"
)


print("\nINGESTION RESULT:")
print(result)