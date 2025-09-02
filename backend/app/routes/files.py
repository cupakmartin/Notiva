from __future__ import annotations

import os
from typing import List
from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from ..auth import get_current_user
from .. import vectorstore as vs

router = APIRouter(prefix="/files", tags=["files"])

DATA_DIR = os.getenv("DATA_DIR", "/data")

def _file_path(name: str) -> str:
    return os.path.join(DATA_DIR, name)

@router.get("", response_model=List[str])
def list_files(user=Depends(get_current_user)):
    try:
        return sorted([f for f in os.listdir(DATA_DIR) if os.path.isfile(_file_path(f))])
    except FileNotFoundError:
        return []

@router.post("")
def upload(file: UploadFile = File(...), user=Depends(get_current_user)):
    os.makedirs(DATA_DIR, exist_ok=True)
    dest = _file_path(file.filename)
    with open(dest, "wb") as f:
        f.write(file.file.read())

    return {"ok": True, "filename": file.filename}

@router.delete("/{name}")
def delete(name: str, user=Depends(get_current_user)):
    path = _file_path(name)
    if not os.path.exists(path):
        vs.delete_by_source(name)
        raise HTTPException(status_code=404, detail="File not found")

    try:
        os.remove(path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete file: {e}")

    try:
        vs.delete_by_source(name)
    except Exception as e:
        print(f"[WARN] Deleting vectors for {name} failed: {e}")

    return {"ok": True, "deleted": name}
