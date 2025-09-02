
# 📚 AI Knowledge Hub (RAG for Companies)

Production-ready skeleton for a corporate **AI knowledge assistant**:
- Upload documents (PDF, DOCX, PPTX, MD)
- Ingestion pipeline → chunking + embeddings → **Qdrant** (vector DB)
- **FastAPI** backend with OAuth (Azure AD placeholder), **OpenAI** LLM
- **Next.js + Tailwind** frontend (chat UI + document uploads + citations)
- Docker & `docker-compose` for local prod-like setup
- CI (GitHub Actions): lint, tests, docker build

> Designed to be extended with Google Drive/SharePoint connectors and SSO.

---

## ⚙️ Quick start (local, docker-compose)

```bash
# 1) Create env files
cp .env.example backend/.env
cp .env.example frontend/.env.local  # only FRONTEND_* and BACKEND_URL used here

# 2) Launch services
docker compose up --build

# 3) Open frontend
# http://localhost:3000
```

### Required env vars
- `OPENAI_API_KEY` – OpenAI API key
- `QDRANT_URL` – default `http://qdrant:6333`
- `QDRANT_API_KEY` – if secured (empty for local)
- `DB_URL` – metadata DB (default SQLite), e.g. `sqlite:///./hub.db`
- `BACKEND_URL` – e.g. `http://localhost:8000`
- OAuth (Azure AD) placeholders:
  - `OAUTH_CLIENT_ID`, `OAUTH_CLIENT_SECRET`, `OAUTH_TENANT_ID`, `OAUTH_REDIRECT_URI`

---

## 🧱 Architecture

```
ai-knowledge-hub/
 ├─ backend/ (FastAPI)
 │   ├─ app/
 │   │   ├─ main.py            # FastAPI app + routers
 │   │   ├─ auth.py            # OAuth (Azure AD) placeholder
 │   │   ├─ models.py, db.py   # SQLAlchemy (docs/users)
 │   │   ├─ schemas.py         # Pydantic models
 │   │   ├─ ingest.py          # parsing, chunking, embeddings
 │   │   ├─ vectorstore.py     # Qdrant client helpers
 │   │   ├─ llm.py             # OpenAI chat + prompt templates
 │   │   └─ routes/
 │   │       ├─ documents.py   # upload/list
 │   │       └─ chat.py        # /chat endpoint with citations
 │   ├─ tests/
 │   │   └─ test_smoke.py
 │   ├─ requirements.txt
 │   └─ Dockerfile
 ├─ frontend/ (Next.js + Tailwind)
 │   ├─ app/ or pages/
 │   │   ├─ page.tsx           # Chat
 │   │   ├─ upload/page.tsx    # Upload
 │   │   └─ layout.tsx
 │   ├─ components/
 │   │   ├─ Chat.tsx
 │   │   └─ UploadBox.tsx
 │   ├─ tailwind.config.js
 │   ├─ postcss.config.js
 │   ├─ package.json
 │   ├─ styles/globals.css
 │   └─ Dockerfile
 ├─ docker-compose.yml
 ├─ .env.example
 └─ .github/workflows/ci.yml
```

---

## 🧪 Test
```bash
docker compose run --rm backend pytest -q
```

