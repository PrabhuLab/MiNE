import asyncio
import gzip
import logging
import os
import resource
import sys
import threading
import time
import zlib
from typing import Any

import orjson
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from .config import get_settings
from .errors import ApiError, too_large
from .graph_builder import build_graph
from .layouts import SUPPORTED_LAYOUTS, compute_layout
from .metrics import REGISTRY, capabilities, compute_metrics
from .models import AnalyzeRequest, AnalyzeResponse, Positions
from .communities import COMMUNITY_CAPABILITIES, compute_community

settings = get_settings()
app = FastAPI(title="MiNE igraph analysis", version=settings.backend_version, docs_url=None, redoc_url=None)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Content-Encoding", "Accept-Encoding"],
    expose_headers=["Content-Encoding", "X-MiNE-Uncompressed-Length"],
)
logger = logging.getLogger("mine.igraph")
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"), format="%(message)s")
analysis_slot = threading.BoundedSemaphore(1)


def log_event(event: str, **values: Any) -> None:
    logger.info(orjson.dumps({"event": event, **values}, option=orjson.OPT_NON_STR_KEYS).decode())


def json_response(payload: Any, status_code: int = 200, accept_gzip: bool = False) -> Response:
    body = orjson.dumps(payload)
    headers = {"X-MiNE-Uncompressed-Length": str(len(body))}
    if accept_gzip and len(body) >= settings.response_gzip_min_bytes:
        body = gzip.compress(body, compresslevel=5)
        headers["Content-Encoding"] = "gzip"
    return Response(body, status_code=status_code, media_type="application/json", headers=headers)


def decompress_gzip_limited(body: bytes) -> bytes:
    decoder = zlib.decompressobj(16 + zlib.MAX_WBITS)
    try:
        decoded = decoder.decompress(body, settings.max_decompressed_bytes + 1)
        if len(decoded) > settings.max_decompressed_bytes or decoder.unconsumed_tail:
            raise too_large("decompressed_body", "Decompressed request exceeds the configured limit.")
        decoded += decoder.flush(settings.max_decompressed_bytes + 1 - len(decoded))
    except zlib.error as exc:
        raise ApiError(400, "invalid_gzip", "Request body is not valid gzip data.") from exc
    if len(decoded) > settings.max_decompressed_bytes:
        raise too_large("decompressed_body", "Decompressed request exceeds the configured limit.")
    return decoded


@app.exception_handler(ApiError)
async def api_error_handler(_request: Request, exc: ApiError):
    log_event("request_error", status=exc.status_code, code=exc.code, message=exc.message)
    return json_response({"detail": {"code": exc.code, "message": exc.message}}, exc.status_code)


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_request: Request, exc: RequestValidationError):
    errors = [{"loc": list(error["loc"]), "msg": error["msg"], "type": error["type"]} for error in exc.errors()]
    return json_response({"detail": {"code": "validation_error", "message": "Request contract validation failed.", "errors": errors}}, 422)


@app.exception_handler(Exception)
async def unhandled_error_handler(_request: Request, exc: Exception):
    log_event("request_error", status=503, code="internal_error", errorType=type(exc).__name__)
    return json_response({"detail": {"code": "service_error", "message": "Analysis failed without returning a server stack trace."}}, 503)


@app.get("/health")
async def health():
    acquired = analysis_slot.acquire(blocking=False)
    if acquired:
        analysis_slot.release()
    return {"status": "ok", "version": settings.backend_version, "busy": not acquired}


@app.get("/v1/capabilities")
async def get_capabilities():
    exact_thresholds = {
        metric_id: {"maxNodes": item["max_nodes"], "maxEdges": item["max_edges"]}
        for metric_id, item in ((entry["id"], entry) for entry in capabilities(settings))
    }
    return {
        "schemaVersion": "mine-igraph-1",
        "backendVersion": settings.backend_version,
        "supportedMetricIds": list(REGISTRY),
        "supportedLayoutIds": list(SUPPORTED_LAYOUTS),
        "communityAlgorithms": COMMUNITY_CAPABILITIES,
        "limits": {
            "maxNodes": settings.max_nodes,
            "maxEdges": settings.max_edges,
            "maxCompressedBytes": settings.max_compressed_bytes,
            "maxDecompressedBytes": settings.max_decompressed_bytes,
        },
        "exactMetricThresholds": exact_thresholds,
        "approximateMetricThresholds": {},
        "metricDefinitions": capabilities(settings),
    }


def perform_analysis(request: AnalyzeRequest, decode_ms: float) -> AnalyzeResponse:
    started = time.perf_counter()
    build_started = time.perf_counter()
    built = build_graph(request, settings)
    build_ms = (time.perf_counter() - build_started) * 1000
    metric_started = time.perf_counter()
    node_metrics, edge_metrics, graph_metrics, warnings, per_metric_timings, calculated_ids = compute_metrics(built.graph, request, settings)
    metrics_ms = (time.perf_counter() - metric_started) * 1000
    layout_started = time.perf_counter()
    positions = compute_layout(built.graph, request, settings, warnings)
    layout_ms = (time.perf_counter() - layout_started) * 1000
    community, community_ms = compute_community(built.graph, request)
    peak_raw = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    peak_bytes = peak_raw if sys.platform == "darwin" else peak_raw * 1024
    response = AnalyzeResponse(
        request_id=request.request_id,
        graph_revision=request.graph_revision,
        filter_revision=request.filter_revision,
        node_order_hash=request.node_order_hash,
        edge_order_hash=request.edge_order_hash,
        node_count=built.graph.vcount(),
        edge_count=built.graph.ecount(),
        positions=Positions(x=positions[0], y=positions[1]) if positions else None,
        community=community,
        node_metrics=node_metrics,
        edge_metrics=edge_metrics,
        graph_metrics=graph_metrics,
        validity={metric_id: {"exact": True} for metric_id in calculated_ids},
        warnings=warnings,
        timings={
            "decodeMs": round(decode_ms, 3), "buildMs": round(build_ms, 3),
            "metricsMs": round(metrics_ms, 3), "layoutMs": round(layout_ms, 3), "communityMs": round(community_ms, 3),
            **per_metric_timings,
        },
    )
    log_event(
        "analysis_complete", success=True, nodes=built.graph.vcount(), edges=built.graph.ecount(),
        metrics=request.metric_ids, layout=request.layout.algorithm if request.layout else None, community=request.community.algorithm if request.community else None,
        elapsedMs=round((time.perf_counter() - started) * 1000, 3), peakProcessBytes=peak_bytes,
    )
    return response


def perform_with_slot(request: AnalyzeRequest, decode_ms: float) -> AnalyzeResponse:
    try:
        return perform_analysis(request, decode_ms)
    finally:
        analysis_slot.release()


@app.post("/v1/community")
@app.post("/v1/metrics")
@app.post("/v1/layout")
@app.post("/v1/analyze")
async def analyze(http_request: Request):
    chunks = bytearray()
    async for chunk in http_request.stream():
        chunks.extend(chunk)
        if len(chunks) > settings.max_compressed_bytes:
            raise too_large("compressed_body", "Compressed request exceeds the configured transport limit; Cloud Storage is not enabled in this phase.")
    compressed_body = bytes(chunks)
    decode_started = time.perf_counter()
    content_encoding = http_request.headers.get("content-encoding", "identity").lower()
    if content_encoding not in {"identity", "", "gzip"}:
        raise ApiError(400, "content_encoding", f"Unsupported Content-Encoding: {content_encoding}")
    body = decompress_gzip_limited(compressed_body) if content_encoding == "gzip" else compressed_body
    if len(body) > settings.max_decompressed_bytes:
        raise too_large("decompressed_body", "Request exceeds the configured uncompressed transport limit.")
    try:
        payload = orjson.loads(body)
    except orjson.JSONDecodeError as exc:
        raise ApiError(400, "invalid_json", "Request body is not valid JSON.") from exc
    try:
        request = AnalyzeRequest.model_validate(payload)
    except Exception as exc:
        raise ApiError(422, "validation_error", "Request fields do not satisfy the mine-igraph-1 contract.") from exc
    decode_ms = (time.perf_counter() - decode_started) * 1000
    if not analysis_slot.acquire(blocking=False):
        raise ApiError(429, "container_busy", "This container already has an active analysis; retry on another instance.")
    try:
        response = await asyncio.wait_for(
            asyncio.to_thread(perform_with_slot, request, decode_ms),
            timeout=settings.request_timeout_seconds,
        )
    except asyncio.TimeoutError as exc:
        # The C-level igraph call may continue. The semaphore remains held until
        # its worker actually exits, preventing a second large graph in memory.
        raise ApiError(503, "analysis_timeout", "Analysis exceeded the synchronous request time limit.") from exc
    serialize_started = time.perf_counter()
    payload = response.model_dump(by_alias=True)
    payload["timings"]["serializeMs"] = round((time.perf_counter() - serialize_started) * 1000, 3)
    accept_gzip = "gzip" in http_request.headers.get("accept-encoding", "").lower()
    return json_response(payload, accept_gzip=accept_gzip)
