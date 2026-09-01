import Graph, { UndirectedGraph } from 'graphology';
import clusters from 'graphology-generators/random/clusters';
import type { ImportedMetricsBundle } from '@/store/useStore';
import { EMPTY_METRICS, GRAPH_IO_VERSION, NETWORK_WORKSPACE_FORMAT, type AllInOneDocument, type WorkspaceSettingsDocument } from './types';

export function buildAllInOne(graph: Graph, metrics: ImportedMetricsBundle, workspace: WorkspaceSettingsDocument): AllInOneDocument {
  return { format: NETWORK_WORKSPACE_FORMAT, version: GRAPH_IO_VERSION, graph: graph.export(), metrics, workspace };
}

export function createRandomClusterAllInOne(
  options: { order: number; size: number; clusters: number; clusterDensity: number },
  workspace: WorkspaceSettingsDocument,
): AllInOneDocument {
  const graph = clusters(UndirectedGraph as any, options) as Graph;
  graph.forEachNode((node, attributes) => graph.mergeNodeAttributes(node, {
    label: `Node ${node}`,
    name: `Node ${node}`,
    community: attributes.cluster,
  }));
  graph.forEachEdge((edge) => graph.mergeEdgeAttributes(edge, { weight: 1, weight_raw: 1 }));
  graph.setAttribute('directed', false);
  graph.setAttribute('bipartite', false);
  graph.setAttribute('weighted', false);
  graph.setAttribute('weightChannels', { primary: true, secondary: false });
  return buildAllInOne(graph, { ...EMPTY_METRICS }, { ...workspace, graphMode: { directed: false, bipartite: false, weighted: false } });
}
