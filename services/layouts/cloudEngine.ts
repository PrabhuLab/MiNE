import type { RawEdge, RawNode } from '@/store/useStore';
import { requestCloudAnalysis } from '@/services/cloud/coordinator';
import { buildCloudAnalyzeRequest } from '@/services/cloud/request';
import type { CloudLayoutSpec } from '@/services/cloud/types';
import type { LayoutResult } from './types';

export async function computeCloudLayout(
  nodes: RawNode[],
  edges: RawEdge[],
  directed: boolean,
  bipartite: boolean,
  topologyKey: string,
  layout: CloudLayoutSpec,
  signal: AbortSignal,
): Promise<LayoutResult> {
  const request = buildCloudAnalyzeRequest({
    nodes, edges, directed, bipartite, filterRevision: topologyKey, layout,
  });
  const response = await requestCloudAnalysis(request, signal);
  if (!response.positions) throw new Error('Cloud layout response did not include positions.');
  const { x, y } = response.positions;
  // igraph normalizes to [-1, 1]. D3 draws node radii in graph units.
  const scale = Math.max(80, 25 * Math.sqrt(nodes.length));
  return {
    positions: Object.fromEntries(request.nodeIds.map((id, index) => [id, { x: x[index] * scale, y: y[index] * scale }])),
    filterRevision: response.filterRevision,
    warnings: response.warnings,
  };
}
