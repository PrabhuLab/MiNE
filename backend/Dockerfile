FROM python:3.12 AS wheels
COPY pyproject.toml /build/pyproject.toml
COPY app /build/app
RUN pip wheel --wheel-dir /wheels /build

FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PORT=8080
RUN addgroup --system mine && adduser --system --ingroup mine mine
RUN --mount=type=bind,from=wheels,source=/wheels,target=/wheels pip install --no-cache-dir --no-index --find-links=/wheels mine-igraph-backend
WORKDIR /tmp
USER mine
EXPOSE 8080
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --workers 1 --no-access-log"]
