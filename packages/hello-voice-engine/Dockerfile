# hello-voice-engine — KhalOS voice engine (Python runtime)
FROM python:3.12-slim
WORKDIR /app

COPY requirements*.txt ./
RUN pip install --no-cache-dir -r requirements.txt 2>/dev/null || true

COPY . .

ENV PORT=8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

EXPOSE 8000
CMD ["python", "main.py"]
