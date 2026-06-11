FROM python:3.11-slim-bookworm

WORKDIR /app

ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1

# Системные зависимости: ffmpeg (librosa/whisper), libchromaprint-tools (fpcalc), build-essential
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        ffmpeg \
        libchromaprint-tools \
        libsndfile1 \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# CPU-only torch ставим из официального индекса (легче бинарь)
RUN pip install --upgrade pip \
 && pip install --index-url https://download.pytorch.org/whl/cpu torch==2.4.1 torchaudio==2.4.1 \
 && pip install -r requirements.txt

COPY . .

EXPOSE 8001

# По умолчанию — FastAPI; воркер запускается отдельной командой в docker-compose.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
