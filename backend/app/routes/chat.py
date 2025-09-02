from __future__ import annotations

import os
import re
import unicodedata
from typing import List, Tuple, Dict, Any, Optional

import requests
from fastapi import APIRouter, Depends
from ..auth import get_current_user
from ..schemas import ChatRequest, ChatResponse, Citation
from ..llm import embed, chat
from .. import vectorstore as vs

print("CHAT ROUTE VERSION = v9-no-weather-better-calc")

router = APIRouter(prefix="/chat", tags=["chat"])

GENERAL_SYSTEM = (
    "Jsi užitečný, přátelský asistent. Mluv přirozeně v jazyce dotazu. "
    "Buď stručný, ale užitečný."
)

RAG_SYSTEM = (
    "Jsi užitečný asistent. Odpovídej přirozeně v jazyce dotazu. "
    "Použij poskytnutý kontext jako zdroj faktů. Nekopíruj technické značky, cesty k souborům ani chunk ID. "
    "Když něco v kontextu chybí, řekni to."
)

WEB_SYSTEM = (
    "Jsi vyhledávací asistent. Máš k dispozici krátké výtahy z výsledků hledání z webu. "
    "Odpověz věcně v jazyce dotazu a drž se faktů."
)

def _vector_search(qvec: List[float], top_k: int) -> List[Tuple[Dict[str, Any], float]]:
    try:
        return vs.search(qvec, top_k=top_k)
    except Exception:
        return []

_SRC_KEYS = ("source", "file", "filename", "path")
_TEXT_KEYS = ("text", "content", "page_content", "body")

def _get_text(meta: Dict[str, Any]) -> str:
    for k in _TEXT_KEYS:
        v = meta.get(k)
        if isinstance(v, str) and v.strip():
            return v
    return ""

def _get_source_name(meta: Dict[str, Any]) -> str:
    raw = ""
    for k in _SRC_KEYS:
        v = meta.get(k)
        if isinstance(v, str) and v.strip():
            raw = v
            break
    if not raw:
        return ""
    m = re.search(r"[^/\\]+$", raw)
    return m.group(0) if m else raw

def _strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))

# ---------- Intent detection (bez počasí) ----------

def _detect_intent(q: str) -> str:
    ql = _strip_accents(q.lower()).strip()

    # Time/date
    if any(w in ql for w in ["kolik je hodin", "cas", "time is it", "datum", "date today"]) and "po" not in ql:
        return "TIME"

    # Calculator – pokud je ve větě aspoň jedna číslice a operátor
    if re.search(r"\d", ql) and re.search(r"[+\-*/^%]", ql):
        return "CALC"

    # Contact/email/phone
    if any(w in ql for w in ["email", "e-mail", "mail", "telefon", "phone", "contact", "kontakt"]):
        return "CONTACT"

    # Web research
    if any(w in ql for w in ["vyhledej", "najdi na webu", "google", "search the web", "what is", "who is"]):
        return "WEB"

    return "GENERAL"

# ---------- Calculator helpers ----------

_MATH_TOKEN = re.compile(r"[ \t\d\.,+\-*/()^%]+")

def _extract_math_expression(q: str) -> Optional[str]:
    """
    Z přirozené věty vytáhne souvislý matematický výraz.
    Příklad: 'kolik je 2+2?' -> '2+2'
    """
    # vezmeme nejdelší souvislou shodu z povolených znaků
    candidates = [m.group(0) for m in _MATH_TOKEN.finditer(q)]
    candidates = [c.strip() for c in candidates if any(ch.isdigit() for ch in c)]
    if not candidates:
        return None
    # nejdelší je obvykle to, co chceme
    expr = max(candidates, key=len)
    # normalizace čárky -> tečka
    expr = expr.replace(",", ".")
    return expr if re.search(r"\d", expr) else None

def _calc_answer(expr_or_sentence: str) -> str:
    expr = _extract_math_expression(expr_or_sentence) or expr_or_sentence
    # bezpečnostní whitelist výrazů
    if not re.fullmatch(r"[ \t\d\.\+\-\*\/\(\)\^%]+", expr):
        return "Tohle nedokážu spočítat."
    try:
        safe = expr.replace("^", "**")
        val = eval(safe, {"__builtins__": {}}, {})
        return f"Výsledek: {val}" if isinstance(val, (int, float)) else "Tohle nedokážu spočítat."
    except Exception:
        return "Tohle nedokážu spočítat."

def _time_answer() -> str:
    import datetime as dt
    now = dt.datetime.utcnow()
    return f"Teď je {now.strftime('%H:%M')} UTC (serverový čas)."

# ---------- Web search (ponecháno, pokud používáš) ----------

SERPAPI_KEY = os.getenv("SERPAPI_API_KEY", "").strip()

def _web_search(query: str, num: int = 6) -> list[dict]:
    if not SERPAPI_KEY:
        return []
    try:
        r = requests.get(
            "https://serpapi.com/search.json",
            params={"engine": "google", "q": query, "api_key": SERPAPI_KEY, "num": num},
            timeout=20,
        )
        r.raise_for_status()
        data = r.json() or {}
        org = (data.get("organic_results") or [])[:num]
        out = []
        for it in org:
            out.append({
                "title": it.get("title", ""),
                "snippet": it.get("snippet", ""),
                "url": it.get("link", ""),
            })
        return out
    except Exception:
        return []

def _domain(url: str) -> str:
    m = re.search(r"https?://([^/]+)/?", url or "")
    return m.group(1) if m else (url or "")

def _web_answer(query: str) -> ChatResponse:
    results = _web_search(query, num=6)
    if not results:
        return ChatResponse(
            answer="Webové vyhledávání není nakonfigurované (chybí SERPAPI_API_KEY), nebo se nepodařilo najít výsledky.",
            citations=[],
        )
    parts = []
    citations: List[Citation] = []
    for i, r in enumerate(results, 1):
        title = r["title"]; snip = r["snippet"]; url = r["url"]
        parts.append(f"[{i}] {title}\n{snip}\nURL: {url}")
        citations.append(Citation(source=_domain(url), snippet=title, score=None))
    context = "\n\n".join(parts)
    prompt = f"VSTUPNÍ VÝSLEDKY:\n{context}\n\nOTÁZKA: {query}\n\nODPOVĚZ SROZUMITELNĚ:"
    answer = chat(WEB_SYSTEM, prompt).strip()
    return ChatResponse(answer=answer, citations=citations)

# ---------- Contacts & RAG (beze změn) ----------

BASE_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}", re.I)
PHONE_RE = re.compile(r"(?:(?:\+?\s?(?:420|421)|\+?\s?\d{1,3})\s*)?(?:\d\s*){9,}", re.I)

def _contact_answer(query: str, qvec: List[float]) -> Optional[ChatResponse]:
    hits = _vector_search(qvec, top_k=200)
    # ... (tvoje současná logika pro hledání emailů/telefonů) ...
    return None

@router.post("", response_model=ChatResponse)
def ask(payload: ChatRequest, user=Depends(get_current_user)):
    query = payload.query.strip()
    intent = _detect_intent(query)

    if intent == "CALC":
        return ChatResponse(answer=_calc_answer(query), citations=[])
    if intent == "TIME":
        return ChatResponse(answer=_time_answer(), citations=[])
    if intent == "WEB":
        return _web_answer(query)

    qvec = embed([query])[0]
    if intent == "CONTACT":
        resp = _contact_answer(query, qvec)
        if resp: return resp

    hits = _vector_search(qvec, top_k=max(8, payload.top_k))
    has_context = False
    context_parts: List[str] = []
    citations: List[Citation] = []
    seen = set()
    for meta, score in hits[:6]:
        text = (_get_text(meta) or "").strip()
        if not text: continue
        has_context = True
        context_parts.append(text)
        fname = _get_source_name(meta)
        if fname and fname not in seen:
            seen.add(fname)
            citations.append(Citation(source=fname, snippet=None, score=float(score or 0)))

    if has_context:
        user_prompt = "CONTEXT:\n" + "\n\n".join(context_parts) + f"\n\nQUESTION: {query}\n\nANSWER:"
        answer = chat(RAG_SYSTEM, user_prompt).strip()
        answer = re.sub(r"\[[^\]\n]*#chunk=\d+\]", "", answer)
        answer = re.sub(r"\s{2,}", " ", answer).strip()
        return ChatResponse(answer=answer, citations=citations)

    general_answer = chat(GENERAL_SYSTEM, query).strip()
    return ChatResponse(answer=general_answer, citations=[])
