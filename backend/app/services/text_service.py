import re


def clean_text(text: str) -> str:
    """
    Clean extracted PDF text.
    """

    text = re.sub(r"\s+", " ", text)

    text = text.strip()

    return text


def create_chunks(text: str, chunk_size: int = 500, overlap: int = 100):
    """
    Split text into overlapping chunks.
    """

    words = text.split()

    chunks = []

    start = 0

    while start < len(words):

        end = start + chunk_size

        chunk = " ".join(words[start:end])

        chunks.append(chunk)

        start += chunk_size - overlap

    return chunks