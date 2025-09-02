import os
import uuid
from typing import List, Tuple

from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams, PointStruct
from qdrant_client.http.exceptions import UnexpectedResponse

COLLECTION = "ai_knowledge_hub"


def get_client() -> QdrantClient:
    url = os.getenv("QDRANT_URL", "http://qdrant:6333")
    api_key = os.getenv("QDRANT_API_KEY")
    return QdrantClient(url=url, api_key=api_key)


def ensure_collection(client: QdrantClient, dim: int = 1536) -> bool:
    existing = [c.name for c in client.get_collections().collections]
    if COLLECTION not in existing:
        client.create_collection(
            collection_name=COLLECTION,
            vectors_config=VectorParams(size=dim, distance=Distance.COSINE),
        )
        return True
    return False


def _recreate_collection(client: QdrantClient, dim: int) -> None:
    try:
        client.delete_collection(collection_name=COLLECTION)
    except Exception:
        pass
    client.create_collection(
        collection_name=COLLECTION,
        vectors_config=VectorParams(size=dim, distance=Distance.COSINE),
    )


def upsert_embeddings(embeddings: List[List[float]], metadatas: List[dict]) -> None:
    client = get_client()
    dim = len(embeddings[0]) if embeddings else 1536
    ensure_collection(client, dim=dim)

    points = [
        PointStruct(id=str(uuid.uuid4()), vector=v, payload=m)
        for v, m in zip(embeddings, metadatas)
    ]

    try:
        client.upsert(collection_name=COLLECTION, points=points)
    except Exception:
        _recreate_collection(client, dim=dim)
        client.upsert(collection_name=COLLECTION, points=points)


def search(query_vec: List[float], top_k: int = 5) -> List[Tuple[dict, float]]:
    client = get_client()
    dim = len(query_vec) if query_vec else 1536

    created = ensure_collection(client, dim=dim)
    if created:
        return []

    try:
        res = client.search(
            collection_name=COLLECTION,
            query_vector=query_vec,
            limit=top_k,
        )
        return [(r.payload, float(r.score)) for r in res]
    except UnexpectedResponse as e:
        if "doesn't exist" in str(e).lower():
            _recreate_collection(client, dim=dim)
            return []
        return []
    except Exception:
        return []
