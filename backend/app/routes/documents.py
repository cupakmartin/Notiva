# backend/app/routes/documents.py
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path as FSPath
from typing import Dict, List

from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from fastapi import Path as PathParam
from ..auth import get_current_user
from ..schemas import UploadResponse, FileMeta, ListResponse, ListItem
from ..ingest import ingest_file  # ← přidáno: ingest po uploadu

router = APIRouter(prefix="/documents", tags=["documents"])

DATA_DIR = FSPath(os.environ.get("DATA_DIR", "data"))
UPLOADS = DATA_DIR / "uploads"
INDEX = UPLOADS / "index.json"
UPLOADS.mkdir(parents=True, exist_ok=True)


def _load_index() -> Dict[str, Dict]:
    if INDEX.exists():
        try:
            return json.loads(INDEX.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}


def _save_index(idx: Dict) -> None:
    INDEX.write_text(json.dumps(idx, ensure_ascii=False, indent=2), encoding="utf-8")


@router.get("", response_model=ListResponse)
def list_files(user=Depends(get_current_user)) -> ListResponse:
    idx = _load_index()
    items: List[ListItem] = []

    for filename, meta in idx.items():
        p = UPLOADS / filename
        if not p.exists():
            continue
        mtime = datetime.fromtimestamp(p.stat().st_mtime, tz=timezone.utc).isoformat()
        size = int(meta.get("size", p.stat().st_size))
        items.append(ListItem(filename=filename, size=size, uploaded_at=mtime))

    known = {i.filename for i in items}
    for p in UPLOADS.iterdir():
        if not p.is_file() or p.name == "index.json" or p.name in known:
            continue
        mtime = datetime.fromtimestamp(p.stat().st_mtime, tz=timezone.utc).isoformat()
        items.append(ListItem(filename=p.name, size=p.stat().st_size, uploaded_at=mtime))

    items.sort(key=lambda i: i.uploaded_at, reverse=True)
    return {"items": items}


@router.post("/upload", response_model=UploadResponse)
async def upload(file: UploadFile = File(...), user=Depends(get_current_user)) -> UploadResponse:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename.")

    data = await file.read()
    sha = hashlib.sha256(data).hexdigest()
    dest = UPLOADS / file.filename

    status = "uploaded"
    if dest.exists():
        existing_sha = hashlib.sha256(dest.read_bytes()).hexdigest()
        if existing_sha == sha:
            status = "skipped"
        else:
            status = "replaced"

    dest.write_bytes(data)

    idx = _load_index()
    idx[file.filename] = {"sha256": sha, "size": len(data)}
    _save_index(idx)

    try:
        ingest_file(str(dest), owner=str(user.get("sub", "unknown")))
    except Exception as e:
        print(f"[documents.upload] ingest failed for {dest.name}: {e}")

    return UploadResponse(status=status, file=FileMeta(filename=file.filename, sha256=sha, size=len(data)))


@router.post("/upload-url", response_model=UploadResponse)
def upload_url(payload: Dict, user=Depends(get_current_user)) -> UploadResponse:
    url = (payload or {}).get("url")
    if not url or not isinstance(url, str):
        raise HTTPException(status_code=400, detail="Missing or invalid 'url'.")

    fname = (url.split("/")[-1] or "downloaded.file").split("?")[0]
    dest = UPLOADS / fname
    content = f"Imported from URL: {url}\n".encode("utf-8")

    sha = hashlib.sha256(content).hexdigest()
    dest.write_bytes(content)

    idx = _load_index()
    idx[fname] = {"sha256": sha, "size": len(content)}
    _save_index(idx)

    try:
        ingest_file(str(dest), owner=str(user.get("sub", "unknown")))
    except Exception as e:
        print(f"[documents.upload-url] ingest failed for {dest.name}: {e}")

    return UploadResponse(status="uploaded", file=FileMeta(filename=fname, sha256=sha, size=len(content)))


@router.get("/check")
def check_exists(name: str, user=Depends(get_current_user)) -> Dict[str, bool]:
    return {"exists": (UPLOADS / name).exists()}


@router.post("/reingest")
def reingest_all(user=Depends(get_current_user)) -> Dict[str, int]:
    count = 0
    for p in UPLOADS.iterdir():
        if p.is_file() and p.name != "index.json":
            try:
                ingest_file(str(p), owner=str(user.get("sub", "unknown")))
                count += 1
            except Exception as e:
                print(f"[documents.reingest] ingest failed for {p.name}: {e}")
    return {"ingested": count}


@router.delete("/{filename}", response_model=dict)
def delete_file(
    filename: str = PathParam(..., description="Exact filename to delete"),
    user=Depends(get_current_user),
):
    idx = _load_index()

    try:
        p = UPLOADS / filename
        if p.exists():
            p.unlink()
    except Exception:
        pass

    if filename in idx:
        try:
            del idx[filename]
            _save_index(idx)
        except Exception:
            raise HTTPException(status_code=500, detail="Failed to update index after deletion.")

    # TODO: odstranit vektory daného souboru z Qdrantu podle payloadu "source"

    return {"ok": True}
