import { CLOUD_ANALYSIS_TIMEOUT_MS, requireCloudUrl } from './config';
import type { CloudAnalyzeRequest, CloudAnalyzeResponse } from './types';
import { validateCloudResponse } from './validation';

async function encodeRequest(request: CloudAnalyzeRequest): Promise<{ body: BodyInit; headers: HeadersInit; rawBytes: number; transportBytes: number }> {
  const json = JSON.stringify(request);
  if (typeof CompressionStream === 'undefined') {
    return { body: json, headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, rawBytes: new Blob([json]).size, transportBytes: new Blob([json]).size };
  }
  const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'));
  const body = await new Response(stream).arrayBuffer();
  return {
    body,
    headers: { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip', Accept: 'application/json', 'Accept-Encoding': 'gzip' },
    rawBytes: new Blob([json]).size,
    transportBytes: body.byteLength,
  };
}

export async function analyzeInCloud(request: CloudAnalyzeRequest, signal?: AbortSignal): Promise<CloudAnalyzeResponse> {
  const url = requireCloudUrl();
  const encodeStarted = performance.now();
  const encoded = await encodeRequest(request);
  const encodeMs = performance.now() - encodeStarted;
  const transferStarted = performance.now();
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, CLOUD_ANALYSIS_TIMEOUT_MS);
  const abort = () => controller.abort(signal?.reason);
  signal?.addEventListener('abort', abort, { once: true });
  let response: Response;
  let responseBody: ArrayBuffer;
  try {
    response = await fetch(`${url}/v1/analyze`, { method: 'POST', body: encoded.body, headers: encoded.headers, signal: controller.signal });
    responseBody = await response.arrayBuffer();
  } catch (cause) {
    if (signal?.aborted) throw new DOMException('Cloud analysis request was aborted.', 'AbortError');
    if (timedOut) throw new Error(`Cloud API request timed out after ${Math.round(CLOUD_ANALYSIS_TIMEOUT_MS / 1000)} seconds.`);
    const detail = cause instanceof Error ? cause.message : String(cause);
    throw new Error(`Could not connect to Cloud API at ${new URL(url).host}: ${detail}`);
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
  const transferMs = performance.now() - transferStarted;
  const decodeStarted = performance.now();
  const payload = (() => { try { return JSON.parse(new TextDecoder().decode(responseBody)); } catch { return {}; } })();
  const decodeMs = performance.now() - decodeStarted;
  if (!response.ok) {
    const validationDetails = Array.isArray(payload?.detail?.errors)
      ? payload.detail.errors.map((entry: any) => `${(entry.loc || []).join('.')}: ${entry.msg}`).join('; ')
      : '';
    throw new Error(`${payload?.detail?.message || payload?.detail || `Cloud analysis failed (${response.status}).`}${validationDetails ? ` ${validationDetails}` : ''}`);
  }
  validateCloudResponse(request, payload as CloudAnalyzeResponse);
  const result = payload as CloudAnalyzeResponse;
  const measuredServerMs = Object.entries(result.timings || {})
    .filter(([key]) => ['decodeMs', 'buildMs', 'metricsMs', 'layoutMs', 'serializeMs'].includes(key))
    .reduce((sum, [, value]) => sum + Number(value || 0), 0);
  result.timings = {
    ...(result.timings || {}), frontendEncodeCompressionMs: encodeMs,
    networkRoundTripMs: transferMs,
    networkOverheadMs: Math.max(0, transferMs - measuredServerMs),
    frontendDecodeMs: decodeMs,
    frontendRequestBytes: encoded.rawBytes, frontendRequestTransportBytes: encoded.transportBytes,
    frontendResponseBytes: responseBody.byteLength,
    frontendResponseTransportBytes: Number(response.headers.get('content-length')) || responseBody.byteLength,
  };
  console.info(JSON.stringify({ event: 'mine_cloud_analysis_transport', ...result.timings }));
  return result;
}
