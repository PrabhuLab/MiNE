import type { CloudAnalyzeRequest, CloudAnalyzeResponse } from './types';

export function validateCloudResponse(request: CloudAnalyzeRequest, response: CloudAnalyzeResponse): void {
  if (response.schemaVersion !== 'mine-igraph-1') throw new Error(`Unsupported cloud schema: ${response.schemaVersion}`);
  if (response.graphRevision !== request.graphRevision || response.filterRevision !== request.filterRevision) throw new Error('Discarded stale cloud analysis response.');
  if (request.requestId && response.requestId !== request.requestId) throw new Error('Discarded cloud response with a mismatched request ID.');
  if (response.nodeCount !== request.nodeIds.length || response.nodeOrderHash !== request.nodeOrderHash) throw new Error('Cloud response node order does not match the current graph.');
  if (response.edgeCount !== request.edgeSources.length || response.edgeOrderHash !== request.edgeOrderHash) throw new Error('Cloud response edge order does not match the current graph.');
  if (response.positions) {
    if (response.positions.x.length !== response.nodeCount || response.positions.y.length !== response.nodeCount) throw new Error('Cloud response contains incomplete coordinates.');
    if (!response.positions.x.every(Number.isFinite) || !response.positions.y.every(Number.isFinite)) throw new Error('Cloud response contains non-finite coordinates.');
  }
  if (response.community && response.community.membership.length !== response.nodeCount) throw new Error('Cloud community response has the wrong membership length.');
  Object.entries(response.nodeMetrics || {}).forEach(([id, values]) => {
    if (values.length !== response.nodeCount) throw new Error(`Cloud node metric ${id} has the wrong array length.`);
  });
  Object.entries(response.edgeMetrics || {}).forEach(([id, values]) => {
    if (values.length !== response.edgeCount) throw new Error(`Cloud edge metric ${id} has the wrong array length.`);
  });
}
