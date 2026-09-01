import { isCloudMetricSupported, shouldUseCloud, type ComputeEnginePreference } from '@/services/cloud/config';
import type { MetricsEngine } from './engine';
import type { MetricsRequest } from './types';
import type { MetricsResult } from './types';
import { cloudMetricsEngine } from './cloudEngine';
import { graphologyMetricsEngine } from './graphologyEngine';

export function unsupportedCloudMetricIds(request: MetricsRequest, engine: ComputeEnginePreference = 'auto'): string[] {
  if (!shouldUseCloud(request.nodes.length, request.edges.length, engine)) return [];
  const requested = [...(request.metricIds || []), ...(request.runLouvain ? ['louvain'] : [])];
  return Array.from(new Set(requested.filter((metricId) => !isCloudMetricSupported(metricId))));
}

export function metricsEngineFor(request: MetricsRequest, engine: ComputeEnginePreference = 'auto'): MetricsEngine {
  return shouldUseCloud(request.nodes.length, request.edges.length, engine) ? cloudMetricsEngine : graphologyMetricsEngine;
}

export interface RoutedMetricsResult {
  result: MetricsResult;
  fallbackNotice?: string;
}

const withEngine = (result: MetricsResult, engine: 'cloud' | 'browser', fallback = false): MetricsResult => ({
  ...result,
  validity: Object.fromEntries(Object.entries(result.validity).map(([id, validity]) => [id, {
    ...validity,
    engine,
    ...(fallback ? { fallbackFrom: 'cloud' as const } : {}),
  }])),
});

/** Cloud-first, sequential routing. Browser-only requests never start a Cloud job. */
export async function computeMetricsRouted(request: MetricsRequest, engine: ComputeEnginePreference = 'auto'): Promise<RoutedMetricsResult> {
  const cloudSelected = shouldUseCloud(request.nodes.length, request.edges.length, engine);
  const unsupported = unsupportedCloudMetricIds(request, engine);
  if (!cloudSelected || unsupported.length) {
    return { result: withEngine(await graphologyMetricsEngine.compute(request), 'browser') };
  }
  try {
    return { result: withEngine(await cloudMetricsEngine.compute(request), 'cloud') };
  } catch (error: any) {
    if (error?.name === 'AbortError' || request.signal?.aborted) throw error;
    const large = request.nodes.length >= 7_000 || request.edges.length >= 15_000;
    const performance = large ? ' This graph is large, so the browser fallback may be slower.' : '';
    return {
      result: withEngine(await graphologyMetricsEngine.compute(request), 'browser', true),
      fallbackNotice: `Cloud calculation failed; completed in Browser.${performance}`,
    };
  }
}
