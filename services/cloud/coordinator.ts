import { analyzeInCloud } from './client';
import type { CloudAnalyzeRequest, CloudAnalyzeResponse } from './types';

/**
 * Single Cloud router entry point. Each explicit operation retains its own
 * request ID so response validation and abort semantics cannot be weakened by
 * cross-operation request merging.
 */
export function requestCloudAnalysis(request: CloudAnalyzeRequest, signal?: AbortSignal): Promise<CloudAnalyzeResponse> {
  return analyzeInCloud(request, signal);
}
