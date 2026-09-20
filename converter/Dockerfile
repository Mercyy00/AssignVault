FROM python:3.11-slim

# Install libgomp and dependencies for PyMuPDF/OpenCV if needed
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PORT=8000
ENV HOST=0.0.0.0
# NOTE: CONVERTER_API_KEY must be overridden with a real secret in the host's
# environment settings. The dev default is intentionally not baked in for prod.

EXPOSE 8000

# Shell form so Render/Railway's injected $PORT is honored (falls back to 8000 locally).
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
