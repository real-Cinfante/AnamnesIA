FROM python:3.12-slim

WORKDIR /app

COPY anamnesia/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY anamnesia/ .

RUN mkdir -p /tmp/anamnesia/audio

CMD gunicorn run:app --bind 0.0.0.0:${PORT:-8080} --workers 1 --timeout 120
