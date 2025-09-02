# backend/app/schemas.py
from pydantic import BaseModel
from typing import List, Optional

class FileMeta(BaseModel):
    filename: str
    sha256: str
    size: int

class UploadResponse(BaseModel):
    status: str
    file: FileMeta

class ListItem(BaseModel):
    filename: str
    size: int
    uploaded_at: str  # ISO8601

class ListResponse(BaseModel):
    items: List[ListItem]

class ChatRequest(BaseModel):
    query: str
    top_k: int = 5

class Citation(BaseModel):
    source: str
    snippet: Optional[str] = None
    score: Optional[float] = None

class ChatResponse(BaseModel):
    answer: str
    citations: List[Citation]
