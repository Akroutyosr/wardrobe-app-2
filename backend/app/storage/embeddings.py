"""
Embedding generation only. Chroma's bundled DefaultEmbeddingFunction
(all-MiniLM-L6-v2, 384 dims, ONNX, runs locally) is kept solely to compute
embeddings — the Chroma *store* is gone. Reusing the same function guarantees
vectors produced now are identical to the ones already in the wardrobe, so the
Postgres migration doesn't need to re-embed anything and similarity rankings
stay comparable.
"""

from chromadb.utils.embedding_functions import DefaultEmbeddingFunction

_embed_fn = DefaultEmbeddingFunction()


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed one or more texts. Returns a list of float vectors (384 dims)."""
    return [list(v) for v in _embed_fn(texts)]


def to_vector_literal(vec: list[float]) -> str:
    """Format a vector as a pgvector literal, e.g. '[0.12, 0.34, ...]'."""
    return "[" + ",".join(f"{float(x):.6f}" for x in vec) + "]"
