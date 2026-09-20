# AssignVault PDF to DOCX Converter Service

Stateless Python microservice providing high-fidelity PDF to Word (`.docx`) conversion using `pdf2docx` and `PyMuPDF`.

---

## Features
- **FastAPI Endpoints**:
  - `GET /health`: Health check (`{"status": "ok"}`).
  - `POST /convert`: Authenticated multipart PDF file upload (`file`), returns converted `.docx` binary stream.
- **Security & Validation**:
  - `X-API-Key` header authentication matching `CONVERTER_API_KEY`.
  - Binary magic byte inspection (`%PDF`).
  - Size cap: Maximum 10 MB per file.
  - Page cap: Maximum 30 pages.
  - Scanned PDF detection: Rejects PDFs without extractable text.
  - Isolation: Every conversion executes in a dedicated temporary directory, guaranteed to be destroyed after processing (`try/finally`).

---

## Local Development

### 1. Using `uv` (Recommended)
`uv` automatically provisions Python 3.11 in an isolated environment without modifying system PATH.

```bash
# Run tests
uv run pytest -v

# Start development server
uv run uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

### 2. Standard Virtual Environment
```bash
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

---

## Deployment

### Render
1. Create a **Web Service** connected to your repository.
2. Root Directory: `converter`
3. Environment: `Python 3` or `Docker`
4. Build Command: `pip install -r requirements.txt`
5. Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
6. Set Environment Variables:
   - `CONVERTER_API_KEY`: Secret string shared with Next.js app.

### Railway
1. New Project -> Deploy from GitHub repo -> select `/converter` subfolder.
2. Railway detects the `Dockerfile` automatically.
3. Add Variable `CONVERTER_API_KEY`.
