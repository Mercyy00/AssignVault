import os
import io
import shutil
import tempfile
import asyncio
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

import fitz  # PyMuPDF
from docx import Document
from pdf2docx import Converter
from fastapi import FastAPI, Header, HTTPException, UploadFile, File, status
from fastapi.responses import Response, JSONResponse

app = FastAPI(
    title="AssignVault PDF to DOCX Converter",
    version="1.0.0",
    docs_url=None,
    redoc_url=None,
)

MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB
MAX_PAGES = 30
CONVERSION_TIMEOUT_SECONDS = 60
CONVERTER_API_KEY = os.environ.get("CONVERTER_API_KEY", "development-secret-key-12345")

executor = ThreadPoolExecutor(max_workers=2)


def run_pdf2docx_conversion(pdf_path: str, docx_path: str):
    """Execute pdf2docx conversion in a worker thread."""
    cv = Converter(pdf_path)
    try:
        cv.convert(docx_path, start=0, end=None)
    finally:
        cv.close()


@app.get("/health")
def health_check():
    """Service health check endpoint."""
    return {"status": "ok"}


@app.post("/convert")
async def convert_pdf(
    file: UploadFile = File(...),
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
):
    """
    Convert a text-based PDF assignment into a Word .docx document.
    Enforces API key authentication, magic bytes, size limits, page caps,
    and selectable text verification.
    """
    # 1. Authenticate with X-API-Key
    if not x_api_key or x_api_key != CONVERTER_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key.",
        )

    # 2. Read file content and check size limit (10 MB)
    content = await file.read()
    if not content or len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The uploaded file is empty.",
        )

    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File size exceeds the 10 MB limit.",
        )

    # 3. Verify %PDF magic bytes
    if not content.startswith(b"%PDF"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The uploaded file is not a valid PDF document.",
        )

    # 4. Inspect with PyMuPDF: verify page count and extractable text
    try:
        pdf_doc = fitz.open(stream=content, filetype="pdf")
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Could not read PDF document. The file may be corrupt.",
        )

    try:
        total_pages = len(pdf_doc)
        if total_pages > MAX_PAGES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"PDF has {total_pages} pages, which exceeds the maximum limit of {MAX_PAGES} pages.",
            )

        # Accumulate text across all pages to detect scans / image-only PDFs
        extracted_text_pieces = []
        for page in pdf_doc:
            text = page.get_text()
            if text:
                extracted_text_pieces.append(text.strip())

        full_extracted_text = "".join(extracted_text_pieces).strip()
        if len(full_extracted_text) < 10:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="This PDF is a scan and has no selectable text. Please upload the original .docx or a text-based PDF.",
            )
    finally:
        pdf_doc.close()

    # 5. Execute conversion in temporary directory with guaranteed cleanup
    temp_dir = tempfile.mkdtemp(prefix="assignvault_conv_")
    pdf_path = os.path.join(temp_dir, "input.pdf")
    docx_path = os.path.join(temp_dir, "output.docx")

    try:
        with open(pdf_path, "wb") as f:
            f.write(content)

        # Run conversion in worker thread with timeout
        loop = asyncio.get_running_loop()
        try:
            await asyncio.wait_for(
                loop.run_in_executor(executor, run_pdf2docx_conversion, pdf_path, docx_path),
                timeout=CONVERSION_TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError:
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="Conversion timed out. Please simplify the document or upload a .docx directly.",
            )
        except Exception as e:
            # Mask internal stack traces; return safe structured error
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Conversion failed while processing PDF structures.",
            )

        # 6. Verify converted .docx exists and contains text
        if not os.path.exists(docx_path) or os.path.getsize(docx_path) == 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Converted document is empty or failed to generate.",
            )

        try:
            doc = Document(docx_path)
            docx_text = " ".join(p.text for p in doc.paragraphs).strip()
            # Also check table cells if paragraphs are brief
            if not docx_text:
                for table in doc.tables:
                    for row in table.rows:
                        for cell in row.cells:
                            docx_text += " " + cell.text.strip()
            if not docx_text.strip():
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Converted document contains no readable text.",
                )
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to validate converted Word document structure.",
            )

        with open(docx_path, "rb") as f:
            docx_bytes = f.read()

        return Response(
            content=docx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={
                "Content-Disposition": 'attachment; filename="converted.docx"',
                "Content-Length": str(len(docx_bytes)),
            },
        )

    finally:
        # Guarantee removal of all temporary files
        shutil.rmtree(temp_dir, ignore_errors=True)
