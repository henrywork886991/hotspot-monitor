# hotspot-monitor — single image, two roles (api | worker). See DEPLOY.md.
FROM python:3.13-slim

WORKDIR /app

# Runtime libs for lxml/trafilatura/Pillow wheels + TLS/curl for healthchecks.
RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates curl libxml2 libxslt1.1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# refresh.sh (run from scripts/) calls ../.venv/bin/python — point it at the
# system interpreter so the worker script runs unmodified.
RUN mkdir -p /app/.venv/bin && ln -sf "$(command -v python)" /app/.venv/bin/python

COPY . .
RUN chmod +x deploy/entrypoint.sh scripts/refresh.sh 2>/dev/null || true

# DB + JSON live under /app/data (mount a volume here). Override via env if needed.
ENV HOTSPOT_DB_PATH=/app/data/hotspots.db \
    PYTHONUNBUFFERED=1 \
    PORT=8900

EXPOSE 8900
ENTRYPOINT ["deploy/entrypoint.sh"]
CMD ["api"]
