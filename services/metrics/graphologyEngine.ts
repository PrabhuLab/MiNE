import Graph from 'graphology';
import louvainPkg from 'graphology-communities-louvain';
import seedrandomPkg from 'seedrandom';
import { normalize_communities } from '@/lib/communityUtils';
import { computeCommunityMetrics } from '@/lib/workspaceUtils';
import { METRIC_BY_ID, isMetricCompatible } from './registry';
import type { MetricsEngine } from './engine';
import type { MetricGraphContext, MetricsRequest, MetricsResult, TopologyMetrics } from './types';

const louvain = typeof louvainPkg === 'function' ? louvainPkg : (louvainPkg as any).default || louvainPkg;
const seedrandom = typeof seedrandomPkg === 'function' ? seedrandomPkg : (seedrandomPkg as any).default || seedrandomPkg;

function finiteWeight(value: unknown, fallback = 1): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function createGraph(request: Pick<MetricsRequest, 'nodes' | 'edges' | 'directed' | 'weightAttribute'>): any {
  const graph: any = new (Graph as any)({ type: request.directed ? 'directed' : 'undirected', multi: false, allowSelfLoops: false });
  request.nodes.forEach((node) => {
    if (!graph.hasNode(String(node.id))) graph.addNode(String(node.id), { ...node });
  });
  request.edges.forEach((edge) => {
    const source = String(edge.source);
    const target = String(edge.target);
    if (!graph.hasNode(source) || !graph.hasNode(target) || source === target || graph.hasEdge(source, target)) return;
    const weightSource = request.weightAttribute || 'weight_raw';
    const weight = weightSource === '__unweighted' ? 1 : finiteWeight(edge[weightSource] ?? edge.weight_raw ?? edge.weight, 1);
    graph.addEdgeWithKey(String(edge.key ?? `${source}${request.directed ? '->' : '--'}${target}`), source, target, { ...edge, weight });
  });
  return graph;
}

export function calculateTopologyMetrics(nodes: any[], edges: any[], directed: boolean): TopologyMetrics {
  const graph = createGraph({ nodes, edges, directed, weightAttribute: 'weight_raw' });
  const degreeByNode: TopologyMetrics['degreeByNode'] = {};
  const declaredCommunities: Record<string, string> = {};
  nodes.forEach((node) => {
    if (node.community !== undefined && node.community !== null && node.community !== '') declaredCommunities[String(node.id)] = String(node.community);
  });
  graph.forEachNode((nodeId: string) => {
    degreeByNode[nodeId] = directed
      ? { inDegree: graph.inDegree(nodeId), outDegree: graph.outDegree(nodeId) }
      : { degree: graph.degree(nodeId) };
  });
  return { nodeIds: graph.nodes(), degreeByNode, declaredCommunities };
}

function graphContext(graph: any, request: MetricsRequest): MetricGraphContext {
  const weights = graph.mapEdges((_edge: string, attributes: any) => Number(attributes.weight)).filter(Number.isFinite);
  const weighted = weights.some((weight: number) => weight !== 1);
  return {
    directed: request.directed,
    weighted,
    bipartite: request.bipartite,
    multi: Boolean(graph.multi),
    hasEdges: graph.size > 0,
    hasPositiveWeights: weights.length > 0 && weights.every((weight: number) => weight > 0),
    hasCommunities: graph.someNode((_node: string, attributes: any) => attributes.community !== undefined && attributes.community !== null && attributes.community !== ''),
    hasPositions: graph.everyNode((_node: string, attributes: any) => Number.isFinite(Number(attributes.x)) && Number.isFinite(Number(attributes.y))),
  };
}

class GraphologyMetricsEngine implements MetricsEngine {
  async compute(request: MetricsRequest): Promise<MetricsResult> {
    const graph = createGraph(request);
    const metricsByNode: Record<string, Record<string, any>> = Object.fromEntries(graph.nodes().map((node: string) => [node, {}]));
    const metricsByEdge: Record<string, Record<string, any>> = {};
    const graphMetrics: Record<string, any> = {};
    const validity: MetricsResult['validity'] = {};
    const warnings: Record<string, string> = {};
    const calculatedMetricIds: string[] = [];
    let louvainResult: MetricsResult['louvain'] = null;

    if (request.runLouvain && graph.size > 0) {
      try {
        const details = louvain.detailed(graph, { rng: seedrandom(request.louvainSeed), resolution: request.resolution, getEdgeWeight: 'weight', fastLocalMoves: true });
        const normalized = normalize_communities(details.communities as Record<string, number>);
        const communityMap = Object.fromEntries(Object.entries(normalized).map(([node, community]) => [node, String(community)]));
        Object.entries(normalized).forEach(([node, community]) => {
          const label = `Cluster ${Number(community) + 1}`;
          metricsByNode[node].louvain = label;
          graph.setNodeAttribute(node, 'community', String(community));
        });
        const nodeMetrics = computeCommunityMetrics(graph, communityMap, request.directed);
        nodeMetrics.forEach((entry: any) => Object.assign(metricsByNode[String(entry.id)], entry));
        louvainResult = { nodeMetrics, modularity: details.modularity };
        graphMetrics.louvainModularity = details.modularity;
        validity.louvain = { graphRevision: request.graphRevision, filterRevision: request.filterRevision, calculatedAt: new Date().toISOString() };
      } catch (error) {
        warnings.louvain = error instanceof Error ? error.message : String(error);
      }
    }

    const context = graphContext(graph, request);
    const requestedIds = request.metricIds || Object.entries(request.selected).filter(([id, selected]) => id !== 'louvain' && selected).map(([id]) => id);
    for (const id of requestedIds) {
      const definition = METRIC_BY_ID.get(id);
      if (!definition || !isMetricCompatible(definition, context)) continue;
      try {
        const computed = definition.compute(graph, context);
        if (computed.graph !== undefined) graphMetrics[id] = computed.graph;
        Object.entries(computed.nodes || {}).forEach(([node, values]) => {
          if (metricsByNode[node]) Object.assign(metricsByNode[node], values);
        });
        Object.entries(computed.edges || {}).forEach(([edge, values]) => {
          metricsByEdge[edge] = { ...(metricsByEdge[edge] || {}), ...values };
        });
        validity[id] = {
          graphRevision: request.graphRevision,
          filterRevision: request.filterRevision,
          ...(definition.scope === 'layout' ? { layoutRevision: request.layoutRevision } : {}),
          calculatedAt: new Date().toISOString(),
        };
        calculatedMetricIds.push(id);
      } catch (error) {
        warnings[id] = error instanceof Error ? error.message : String(error);
      }
    }

    return { nodeIds: graph.nodes(), metricsByNode, metricsByEdge, graphMetrics, validity, calculatedMetricIds, warnings, louvain: louvainResult };
  }
}

export const graphologyMetricsEngine: MetricsEngine = new GraphologyMetricsEngine();
