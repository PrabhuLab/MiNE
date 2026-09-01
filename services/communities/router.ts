import type { ResolvedComputeEngine } from '@/services/cloud/config';
import { computeCommunityInBrowser, computeCommunityInCloud } from './engine';
import type { CommunityComputationResult, CommunityRequest } from './types';

export interface RoutedCommunityResult {
  result: CommunityComputationResult;
  fallbackNotice?: string;
}

/** Runs one engine at a time. Only Louvain has a supported browser fallback. */
export async function computeCommunityRouted(request: CommunityRequest, engine: ResolvedComputeEngine): Promise<RoutedCommunityResult> {
  if (engine === 'browser') return { result: await computeCommunityInBrowser(request) };
  try {
    return { result: await computeCommunityInCloud(request) };
  } catch (error: any) {
    if (error?.name === 'AbortError' || request.signal?.aborted) throw error;
    if (request.settings.algorithm !== 'louvain') {
      throw new Error(`Cloud ${request.settings.algorithm} failed and has no Browser equivalent. Check the Cloud API and try again.`);
    }
    const large = request.nodes.length >= 7_000 || request.edges.length >= 15_000;
    const performance = large ? ' This graph is large, so the browser fallback may be slower.' : '';
    return {
      result: await computeCommunityInBrowser(request),
      fallbackNotice: `Cloud Louvain failed; completed with Browser Graphology.${performance}`,
    };
  }
}
