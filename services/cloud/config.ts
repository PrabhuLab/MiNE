export type ComputeEnginePreference = 'auto' | 'browser' | 'cloud';
export type ResolvedComputeEngine = 'browser' | 'cloud';
/** @deprecated Prefer ComputeEnginePreference for user-selected state. */
export type ComputeEngine = ComputeEnginePreference;

import {
  CLOUD_EDGE_CUTOFF,
  CLOUD_NODE_CUTOFF,
  effectiveComputationEngine,
} from '../engines/policy.ts';

/** @deprecated Use CLOUD_NODE_CUTOFF from services/engines/policy. */
export const CLOUD_NODE_THRESHOLD = CLOUD_NODE_CUTOFF;
/** @deprecated Use CLOUD_EDGE_CUTOFF from services/engines/policy. */
export const CLOUD_EDGE_THRESHOLD = CLOUD_EDGE_CUTOFF;
export const CLOUD_SCHEMA_VERSION = 'mine-igraph-1' as const;
export const CLOUD_STATUS_TIMEOUT_MS = 5_000;
export const CLOUD_ANALYSIS_TIMEOUT_MS = 250_000;

export const CLOUD_METRIC_IDS = new Set([
  'density', 'diameter', 'extent', 'simpleSize', 'weightedSize', 'eccentricity',
  'weightedDegree', 'degree', 'betweenness', 'edgeBetweenness', 'closeness',
  'eigenvector', 'hits', 'pagerank', 'louvain', 'modularity',
]);

export const CLOUD_LAYOUT_IDS = new Set([
  'auto', 'drl', 'fruchtermanReingold', 'kamadaKawai', 'cloudCircular', 'cloudRandom', 'bipartite', 'sugiyama',
]);

export const MINE_IGRAPH_API_URL = (process.env.NEXT_PUBLIC_MINE_IGRAPH_API_URL || '').replace(/\/$/, '');

export type CloudBackendState = 'not-configured' | 'idle' | 'checking' | 'available' | 'unavailable';

export interface CloudCapabilities {
  schemaVersion: string;
  backendVersion: string;
  supportedMetricIds: string[];
  supportedLayoutIds: string[];
  communityAlgorithms?: Array<{ id: string; label: string; directed: boolean; weighted: boolean; bipartite?: boolean; parameters: string[] }>;
  limits: Record<string, number>;
}

export interface CloudBackendStatus {
  state: CloudBackendState;
  hostname: string | null;
  version?: string;
  capabilities?: CloudCapabilities;
  message?: string;
}

export function cloudBackendHostname(apiUrl: string = MINE_IGRAPH_API_URL): string | null {
  if (!apiUrl) return null;
  try {
    const parsed = new URL(apiUrl);
    return parsed.port ? `${parsed.hostname}:${parsed.port}` : parsed.hostname;
  } catch {
    return null;
  }
}

export async function checkCloudBackend(
  apiUrl: string = MINE_IGRAPH_API_URL,
  options: { signal?: AbortSignal; fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<CloudBackendStatus> {
  const hostname = cloudBackendHostname(apiUrl);
  if (!apiUrl) return {
    state: 'not-configured', hostname: null,
    message: 'Set NEXT_PUBLIC_MINE_IGRAPH_API_URL and restart MiNE to enable Cloud API.',
  };
  if (!hostname) return { state: 'unavailable', hostname: null, message: 'The configured Cloud API URL is invalid.' };

  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, options.timeoutMs ?? CLOUD_STATUS_TIMEOUT_MS);
  const abort = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener('abort', abort, { once: true });
  try {
    const fetchImpl = options.fetchImpl || fetch;
    const [healthResponse, capabilitiesResponse] = await Promise.all([
      fetchImpl(`${apiUrl}/health`, { signal: controller.signal, headers: { Accept: 'application/json' } }),
      fetchImpl(`${apiUrl}/v1/capabilities`, { signal: controller.signal, headers: { Accept: 'application/json' } }),
    ]);
    if (!healthResponse.ok) throw new Error(`health check returned HTTP ${healthResponse.status}`);
    if (!capabilitiesResponse.ok) throw new Error(`capabilities returned HTTP ${capabilitiesResponse.status}`);
    const health = await healthResponse.json() as { status?: string; version?: string };
    const capabilities = await capabilitiesResponse.json() as CloudCapabilities;
    if (health.status !== 'ok') throw new Error(`health status was ${health.status || 'unknown'}`);
    if (capabilities.schemaVersion !== CLOUD_SCHEMA_VERSION) throw new Error(`unsupported schema ${capabilities.schemaVersion || 'unknown'}`);
    return { state: 'available', hostname, version: capabilities.backendVersion || health.version, capabilities };
  } catch (cause) {
    if (options.signal?.aborted) throw cause;
    const detail = timedOut ? 'Connection check timed out.' : cause instanceof Error ? cause.message : String(cause);
    return { state: 'unavailable', hostname, message: `Cloud API at ${hostname} is unavailable: ${detail}` };
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', abort);
  }
}

export function shouldUseCloud(
  nodeCount: number,
  edgeCount: number,
  engine: ComputeEnginePreference = 'auto',
): boolean {
  return resolveComputeEngine(nodeCount, edgeCount, engine) === 'cloud';
}

export function resolveComputeEngine(
  nodeCount: number,
  edgeCount: number,
  preference: ComputeEnginePreference = 'auto',
): ResolvedComputeEngine {
  return effectiveComputationEngine(nodeCount, edgeCount, preference);
}

export function isCloudMetricSupported(metricId: string): boolean {
  return CLOUD_METRIC_IDS.has(metricId);
}

export function isCloudLayoutSupported(layoutId: string): boolean {
  return CLOUD_LAYOUT_IDS.has(layoutId);
}

export function requireCloudUrl(): string {
  if (!MINE_IGRAPH_API_URL) {
    throw new Error(
      'Cloud API is not configured. Set NEXT_PUBLIC_MINE_IGRAPH_API_URL and restart MiNE, or select Browser.',
    );
  }
  return MINE_IGRAPH_API_URL;
}
