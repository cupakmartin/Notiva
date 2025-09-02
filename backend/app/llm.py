# backend/app/llm.py
import os, requests, math, hashlib, re
from typing import List

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
OPENAI_API_BASE = os.getenv("OPENAI_API_BASE", "https://api.openai.com/v1").strip()
EMBED_MODEL = os.getenv("EMBED_MODEL", "text-embedding-3-small").strip()  # 1536 dims
CHAT_MODEL = os.getenv("CHAT_MODEL", "gpt-4o-mini").strip()
FALLBACK_DIM = int(os.getenv("FALLBACK_EMBED_DIM", "1536"))

def _use_openai() -> bool:
    return bool(OPENAI_API_KEY)

# ---------------- Embeddings ----------------

def _hash_embed(text: str, dim: int = FALLBACK_DIM) -> List[float]:
    vec = [0.0] * dim
    tokens = re.findall(r"[\w\-']+", text.lower())
    for t in tokens:
        h = int(hashlib.sha256(t.encode("utf-8")).hexdigest(), 16)
        vec[h % dim] += 1.0
    s = math.sqrt(sum(v*v for v in vec)) or 1.0
    return [v/s for v in vec]

def embed(texts: List[str]) -> List[List[float]]:
    if _use_openai():
        try:
            url = f"{OPENAI_API_BASE}/embeddings"
            headers = {"Authorization": f"Bearer {OPENAI_API_KEY}"}
            body = {"model": EMBED_MODEL, "input": texts}
            r = requests.post(url, json=body, headers=headers, timeout=60)
            r.raise_for_status()
            data = r.json()
            return [d["embedding"] for d in data["data"]]
        except Exception:
            pass
    return [_hash_embed(t) for t in texts]

# ---------------- Chat ----------------

def _extractive_answer(context: str, question: str) -> str:
    """Very small heuristic answerer used when OpenAI is unavailable."""
    # Split context into sentences / lines, score by keyword overlap
    parts = re.split(r"(?<=[\.\?\!])\s+|\n+", context)
    q_tokens = set(re.findall(r"[\w\-']+", question.lower()))
    scored = []
    for p in parts:
        ptoks = set(re.findall(r"[\w\-']+", p.lower()))
        score = len(q_tokens & ptoks)
        if score:
            scored.append((score, p.strip()))
    scored.sort(key=lambda x: x[0], reverse=True)
    if not scored:
        top = [p.strip() for p in parts[:2] if p.strip()]
    else:
        top = [p for _, p in scored[:3]]
    ans = " ".join(top).strip()
    ans = re.sub(r"\[[^\]\n]*#chunk=\d+\]", "", ans)
    ans = re.sub(r"\s{2,}", " ", ans).strip()
    return ans or "Z poskytnutého kontextu nedokážu odpovědět."

def chat(system: str, user: str) -> str:
    if _use_openai():
        try:
            url = f"{OPENAI_API_BASE}/chat/completions"
            headers = {"Authorization": f"Bearer {OPENAI_API_KEY}"}
            body = {
                "model": CHAT_MODEL,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                "temperature": 0.2,
            }
            r = requests.post(url, json=body, headers=headers, timeout=120)
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"]
        except Exception:
            pass

    m = re.search(
        r"(?:CONTEXT|KONTEKST):\s*(.*?)\n\n(?:QUESTION|DOTAZ):\s*(.*)$",
        user,
        flags=re.S | re.I,
    )
    if m:
        context_block, question = m.group(1), m.group(2)
    else:
        context_block, question = user, ""
    answer = _extractive_answer(context_block, question)
    return answer or "Z poskytnutého kontextu nedokážu odpovědět."
