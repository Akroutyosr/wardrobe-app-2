"""
Embedding generation + similarity search via pgvector in Postgres, replacing
the Chroma store. The embedding vectors live in the items.embedding column of
the same Supabase database, so there's a single system of record.

Embeddings are computed with the same local ONNX all-MiniLM-L6-v2 model Chroma
used (see app.storage.embeddings), preserving vector continuity across the
migration.
"""

from app.storage.db import get_connection, get_item
from app.storage.embeddings import embed_texts, to_vector_literal


def item_to_text(tags: dict) -> str:
    """Turn tags into a short natural-language description for embedding."""
    parts = [
        tags.get("pattern", ""), tags.get("primary_color", ""),
    ]
    if tags.get("secondary_color"):
        parts.append(f"and {tags['secondary_color']}")
    parts.append(tags.get("subcategory", ""))
    parts.append(f"({tags.get('fabric_guess', '')})" if tags.get("fabric_guess") else "")
    if tags.get("seasons"):
        parts.append(f"for {', '.join(tags['seasons'])}")
    parts.append(tags.get("notes", ""))
    return " ".join(p for p in parts if p).strip()


def add_embedding(item_id: str, tags: dict) -> None:
    text = item_to_text(tags)
    vec = to_vector_literal(embed_texts([text])[0])
    conn = get_connection()
    conn.execute(
        "UPDATE items SET embedding = %s::vector WHERE id = %s", (vec, item_id)
    )
    conn.commit()
    conn.close()


def find_similar(query_text: str, k: int = 5) -> list[dict]:
    """Nearest items by L2 distance over pgvector (<->)."""
    q = to_vector_literal(embed_texts([query_text])[0])
    conn = get_connection()
    rows = conn.execute(
        """SELECT id, embedding <-> %s::vector AS distance
        FROM items WHERE embedding IS NOT NULL
        ORDER BY embedding <-> %s::vector
        LIMIT %s""",
        (q, q, k),
    ).fetchall()
    conn.close()

    results = []
    for row in rows:
        item = get_item(row["id"])
        results.append({
            "item_id": row["id"],
            "text": item_to_text(item) if item else "",
            "distance": row["distance"],
        })
    return results