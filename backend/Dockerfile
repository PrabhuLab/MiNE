FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PORT=8080
WORKDIR /app
RUN addgroup --system mine && adduser --system --ingroup mine mine
COPY pyproject.toml ./
COPY app ./app
RUN pip install --no-cache-dir .
WORKDIR /tmp
USER mine
EXPOSE 8080
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --workers 1 --no-access-log"]
