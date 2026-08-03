"""
Embeddings + similarity search via Chroma, running fully locally (no API
calls, no cost) using its bundled default embedding model.
"""

from pathlib import Path

import chromadb

REPO_ROOT = Path(__file__).resolve().parents[2]  # backend/
CHROMA_DIR = REPO_ROOT / "data" / "chroma"

_client = None
_collection = None


def _get_collection():
    global _client, _collection
    if _collection is None:
        _client = chromadb.PersistentClient(path=str(CHROMA_DIR))
        _collection = _client.get_or_create_collection(name="wardrobe_items")
    return _collection


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
    collection = _get_collection()
    text = item_to_text(tags)
    collection.upsert(ids=[item_id], documents=[text], metadatas=[{"category": tags.get("category", "")}])


def find_similar(query_text: str, k: int = 5) -> list[dict]:
    collection = _get_collection()
    results = collection.query(query_texts=[query_text], n_results=k)
    return [
        {"item_id": id_, "text": doc, "distance": dist}
        for id_, doc, dist in zip(results["ids"][0], results["documents"][0], results["distances"][0])
    ]
