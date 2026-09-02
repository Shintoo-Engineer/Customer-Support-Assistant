from sentence_transformers import SentenceTransformer


MODEL_NAME = "all-MiniLM-L6-v2"

model = SentenceTransformer(MODEL_NAME)


def generate_embedding(text: str):
    """
    Generate an embedding vector for a single text chunk.
    """

    embedding = model.encode(text)

    return embedding.tolist()