import type { RawEdge, RawNode } from '@/store/useStore';
import { requestCloudAnalysis } from '@/services/cloud/coordinator';
import { buildCloudAnalyzeRequest } from '@/services/cloud/request';
import type { CloudLayoutSpec } from '@/services/cloud/types';
import type { LayoutEngine } from './engine';
import type { LayoutAlgorithm } from './types';

function cloudAlgorithm(algorithm: LayoutAlgorithm): CloudLayoutSpec['algorithm'] {
  if (algorithm === 'cloudCircular' || algorithm === 'circular') return 'circular';
  if (algorithm === 'cloudRandom' || algorithm === 'random') return 'random';
  if (algorithm === 'fruchtermanReingold') return 'fruchtermanReingold';
  if (algorithm === 'auto' || algorithm === 'kamadaKawai' || algorithm === 'sugiyama') return algorithm;
  if (algorithm === 'bipartite') return 'bipartite';
  return 'drl';
}

export const cloudLayoutEngine: LayoutEngine = {
  async compute(request) {
    const algorithm = cloudAlgorithm(request.algorithm);
    const algorithmSettings = (request.settings[request.algorithm] || {}) as { seed?: number; normalize?: boolean; iterations?: number };
    const cloudRequest = buildCloudAnalyzeRequest({
      nodes: request.nodes as RawNode[],
      edges: request.edges as RawEdge[],
      directed: Boolean(request.directed),
      bipartite: Boolean(request.bipartite),
      filterRevision: request.filterRevision,
      weightAttribute: request.weightAttribute,
      layout: { algorithm, seed: algorithmSettings.seed ?? 42, normalize: algorithmSettings.normalize !== false, iterations: algorithmSettings.iterations },
    });
    if (request.graphRevision) cloudRequest.graphRevision = request.graphRevision;
    const response = await requestCloudAnalysis(cloudRequest, request.signal);
    if (!response.positions) throw new Error('Cloud layout response did not include positions.');
    return {
      positions: Object.fromEntries(cloudRequest.nodeIds.map((id, index) => [id, { x: response.positions!.x[index], y: response.positions!.y[index] }])),
      graphRevision: response.graphRevision,
      filterRevision: response.filterRevision,
      nodeOrderHash: response.nodeOrderHash,
      edgeOrderHash: response.edgeOrderHash,
      warnings: response.warnings,
    };
  },
};
