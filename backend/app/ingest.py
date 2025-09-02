
from __future__ import annotations
from pathlib import Path
from typing import List
from .llm import embed
from .vectorstore import upsert_embeddings
import PyPDF2, docx, pptx

def extract_text(path: str) -> str:
    p = Path(path)
    if p.suffix.lower() == ".pdf":
        text = []
        with open(p, "rb") as f:
            reader = PyPDF2.PdfReader(f)
            for page in reader.pages:
                text.append(page.extract_text() or "")
        return "\n".join(text)
    if p.suffix.lower() in [".docx"]:
        d = docx.Document(p)
        return "\n".join([p.text for p in d.paragraphs])
    if p.suffix.lower() in [".pptx"]:
        prs = pptx.Presentation(str(p))
        out = []
        for slide in prs.slides:
            for shape in slide.shapes:
                if hasattr(shape, "text"):
                    out.append(shape.text)
        return "\n".join(out)
    return p.read_text(encoding="utf-8", errors="ignore")

def chunk(text: str, size: int = 800, overlap: int = 120) -> List[str]:
    parts = []
    i = 0
    while i < len(text):
        parts.append(text[i:i+size])
        i += size - overlap
    return parts

def ingest_file(path: str, owner: str = "unknown", source_id: str | None = None):
    raw = extract_text(path)
    chunks = chunk(raw)
    vecs = embed(chunks)
    metas = [ {"owner": owner, "source": path, "chunk": i, "text": t} for i, t in enumerate(chunks) ]
    upsert_embeddings(vecs, metas)
    return len(chunks)
