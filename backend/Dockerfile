FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/

# Matches the `deploy` user's UID on the host (see /opt/mc-launcher ownership)
# so the bind-mounted mc_launcher.db stays writable after dropping root.
RUN useradd -m -u 1001 appuser && chown -R appuser:appuser /app
USER appuser

# --proxy-headers + --forwarded-allow-ips '*': trust X-Forwarded-For from
# Nginx Proxy Manager so rate limiting keys on the real client IP instead of
# NPM's. Only safe because port 8000 must not be reachable directly from the
# internet — see docker-compose.yml comment.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
