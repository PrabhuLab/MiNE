import type Graph from 'graphology';
import { density } from 'graphology-metrics/graph/density';
import diameter from 'graphology-metrics/graph/diameter';
import { edgeExtent } from 'graphology-metrics/graph/extent';
import modularity from 'graphology-metrics/graph/modularity';
import simpleSize from 'graphology-metrics/graph/simple-size';
import weightedSize from 'graphology-metrics/graph/weighted-size';
import eccentricity from 'graphology-metrics/node/eccentricity';
import { weightedDegree, weightedInDegree, weightedOutDegree } from 'graphology-metrics/node/weighted-degree';
import disparity from 'graphology-metrics/edge/disparity';
import simmelianStrength from 'graphology-metrics/edge/simmelian-strength';
import { chiSquare, gSquare } from 'graphology-metrics/edge';
import betweenness from 'graphology-metrics/centrality/betweenness';
import edgeBetweenness from 'graphology-metrics/centrality/edge-betweenness';
import closeness from 'graphology-metrics/centrality/closeness';
import { degreeCentrality, inDegreeCentrality, outDegreeCentrality } from 'graphology-metrics/centrality/degree';
import eigenvector from 'graphology-metrics/centrality/eigenvector';
import hits from 'graphology-metrics/centrality/hits';
import pagerank from 'graphology-metrics/centrality/pagerank';
import connectedCloseness from 'graphology-metrics/layout-quality/connected-closeness';
import edgeUniformity from 'graphology-metrics/layout-quality/edge-uniformity';
import neighborhoodPreservation from 'graphology-metrics/layout-quality/neighborhood-preservation';
import stress from 'graphology-metrics/layout-quality/stress';
import type { MetricComputation, MetricCost, MetricGraphContext, MetricScope } from './types';

export interface MetricDefinition {
  id: string;
  label: string;
  scope: MetricScope;
  cost: MetricCost;
  supportsDirected: boolean;
  supportsUndirected: boolean;
  supportsWeighted: boolean;
  supportsUnweighted: boolean;
  supportsBipartite: boolean;
  /** Attribute names emitted into graph, node, or edge result records. */
  resultAttributes: string[];
  requiresEdges?: boolean;
  requiresCommunities?: boolean;
  requiresPositions?: boolean;
  compute: (graph: Graph, context: MetricGraphContext) => MetricComputation;
}

const asNodeMetrics = (attribute: string, values: Record<string, unknown>): MetricComputation => ({
  nodes: Object.fromEntries(Object.entries(values).map(([node, value]) => [node, { [attribute]: value }])),
});

const asEdgeMetrics = (attribute: string, values: Record<string, unknown>): MetricComputation => ({
  edges: Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined).map(([edge, value]) => [edge, { [attribute]: value }])),
});

const base = {
  supportsDirected: true,
  supportsUndirected: true,
  supportsWeighted: true,
  supportsUnweighted: true,
  supportsBipartite: true,
} as const;

export const METRIC_REGISTRY: MetricDefinition[] = [
  { ...base, id: 'density', label: 'Density', scope: 'graph', cost: 'cheap', resultAttributes: ['density'], compute: (graph) => ({ graph: density(graph) }) },
  { ...base, id: 'diameter', label: 'Diameter', scope: 'graph', cost: 'medium', resultAttributes: ['diameter'], compute: (graph) => ({ graph: diameter(graph) }) },
  { ...base, id: 'extent', label: 'Edge Weight Extent', scope: 'graph', cost: 'cheap', resultAttributes: ['extent'], supportsUnweighted: false, requiresEdges: true, compute: (graph) => ({ graph: edgeExtent(graph, 'weight') }) },
  { ...base, id: 'modularity', label: 'Modularity', scope: 'graph', cost: 'medium', resultAttributes: ['modularity'], requiresEdges: true, requiresCommunities: true, compute: (graph) => ({ graph: modularity(graph, { getNodeCommunity: 'community', getEdgeWeight: 'weight' }) }) },
  { ...base, id: 'simpleSize', label: 'Simple Size', scope: 'graph', cost: 'cheap', resultAttributes: ['simpleSize'], compute: (graph) => ({ graph: simpleSize(graph) }) },
  { ...base, id: 'weightedSize', label: 'Weighted Size', scope: 'graph', cost: 'cheap', resultAttributes: ['weightedSize'], supportsUnweighted: false, requiresEdges: true, compute: (graph) => ({ graph: weightedSize(graph, 'weight') }) },
  { ...base, id: 'eccentricity', label: 'Eccentricity', scope: 'node', cost: 'medium', resultAttributes: ['eccentricity'], compute: (graph) => asNodeMetrics('eccentricity', Object.fromEntries(graph.nodes().map((node) => [node, eccentricity(graph, node)]))) },
  { ...base, id: 'weightedDegree', label: 'Weighted Degree', scope: 'node', cost: 'cheap', resultAttributes: ['weightedDegree', 'weightedInDegree', 'weightedOutDegree'], supportsUnweighted: false, requiresEdges: true, compute: (graph, context) => ({ nodes: Object.fromEntries(graph.nodes().map((node) => [node, context.directed ? { weightedDegree: weightedDegree(graph, node, 'weight'), weightedInDegree: weightedInDegree(graph, node, 'weight'), weightedOutDegree: weightedOutDegree(graph, node, 'weight') } : { weightedDegree: weightedDegree(graph, node, 'weight') }])) }) },
  { ...base, id: 'disparity', label: 'Disparity', scope: 'edge', cost: 'medium', resultAttributes: ['disparity'], supportsDirected: false, supportsUnweighted: false, requiresEdges: true, compute: (graph) => asEdgeMetrics('disparity', disparity(graph, { getEdgeWeight: 'weight' })) },
  { ...base, id: 'simmelianStrength', label: 'Simmelian Strength', scope: 'edge', cost: 'medium', resultAttributes: ['simmelianStrength'], supportsDirected: false, requiresEdges: true, compute: (graph) => asEdgeMetrics('simmelianStrength', simmelianStrength(graph)) },
  { ...base, id: 'chiSquare', label: 'Chi Square', scope: 'edge', cost: 'medium', resultAttributes: ['chiSquare'], supportsDirected: false, supportsUnweighted: false, requiresEdges: true, compute: (graph) => asEdgeMetrics('chiSquare', chiSquare(graph, 'weight')) },
  { ...base, id: 'gSquare', label: 'G Square', scope: 'edge', cost: 'medium', resultAttributes: ['gSquare'], supportsDirected: false, supportsUnweighted: false, requiresEdges: true, compute: (graph) => asEdgeMetrics('gSquare', gSquare(graph, 'weight')) },
  { ...base, id: 'betweenness', label: 'Betweenness Centrality', scope: 'node', cost: 'expensive', resultAttributes: ['betweenness'], requiresEdges: true, compute: (graph, context) => asNodeMetrics('betweenness', betweenness(graph, { getEdgeWeight: context.weighted ? 'weight' : null })) },
  { ...base, id: 'edgeBetweenness', label: 'Edge Betweenness Centrality', scope: 'edge', cost: 'expensive', resultAttributes: ['edgeBetweenness'], requiresEdges: true, compute: (graph, context) => asEdgeMetrics('edgeBetweenness', edgeBetweenness(graph, { getEdgeWeight: context.weighted ? 'weight' : null })) },
  { ...base, id: 'closeness', label: 'Closeness Centrality', scope: 'node', cost: 'medium', resultAttributes: ['closeness'], requiresEdges: true, compute: (graph) => asNodeMetrics('closeness', closeness(graph, { wassermanFaust: true })) },
  { ...base, id: 'degree', label: 'Degree Centrality', scope: 'node', cost: 'cheap', resultAttributes: ['degreeCentrality', 'inDegreeCentrality', 'outDegreeCentrality'], compute: (graph, context) => {
    if (!context.directed) return asNodeMetrics('degreeCentrality', degreeCentrality(graph));
    const inbound = inDegreeCentrality(graph);
    const outbound = outDegreeCentrality(graph);
    return { nodes: Object.fromEntries(graph.nodes().map((node) => [node, { inDegreeCentrality: inbound[node], outDegreeCentrality: outbound[node] }])) };
  } },
  { ...base, id: 'eigenvector', label: 'Eigenvector Centrality', scope: 'node', cost: 'expensive', resultAttributes: ['eigenvector'], supportsBipartite: false, requiresEdges: true, compute: (graph, context) => asNodeMetrics('eigenvector', eigenvector(graph, { getEdgeWeight: context.weighted ? 'weight' : null })) },
  { ...base, id: 'hits', label: 'HITS (Hubs + Authorities)', scope: 'node', cost: 'expensive', resultAttributes: ['hub', 'authority'], supportsUndirected: false, requiresEdges: true, compute: (graph, context) => { const values = hits(graph, { getEdgeWeight: context.weighted ? 'weight' : null }); return { nodes: Object.fromEntries(graph.nodes().map((node) => [node, { hub: values.hubs[node], authority: values.authorities[node] }])) }; } },
  { ...base, id: 'pagerank', label: 'PageRank', scope: 'node', cost: 'medium', resultAttributes: ['pagerank'], requiresEdges: true, compute: (graph, context) => asNodeMetrics('pagerank', pagerank(graph, { getEdgeWeight: context.weighted ? 'weight' : null })) },
  { ...base, id: 'connectedCloseness', label: 'Connected Closeness', scope: 'layout', cost: 'expensive', resultAttributes: ['connectedCloseness'], supportsDirected: false, requiresEdges: true, requiresPositions: true, compute: (graph) => ({ graph: connectedCloseness(graph) }) },
  { ...base, id: 'edgeUniformity', label: 'Edge Uniformity', scope: 'layout', cost: 'cheap', resultAttributes: ['edgeUniformity'], requiresEdges: true, requiresPositions: true, compute: (graph) => ({ graph: edgeUniformity(graph) }) },
  { ...base, id: 'neighborhoodPreservation', label: 'Neighborhood Preservation', scope: 'layout', cost: 'expensive', resultAttributes: ['neighborhoodPreservation'], requiresEdges: true, requiresPositions: true, compute: (graph) => ({ graph: neighborhoodPreservation(graph) }) },
  { ...base, id: 'stress', label: 'Stress', scope: 'layout', cost: 'expensive', resultAttributes: ['stress'], requiresPositions: true, compute: (graph) => ({ graph: stress(graph) }) },
];

export const METRIC_BY_ID = new Map(METRIC_REGISTRY.map((metric) => [metric.id, metric]));

export function isMetricCompatible(metric: MetricDefinition, context: MetricGraphContext): boolean {
  if (context.directed ? !metric.supportsDirected : !metric.supportsUndirected) return false;
  if (context.weighted ? !metric.supportsWeighted : !metric.supportsUnweighted) return false;
  if (context.bipartite && !metric.supportsBipartite) return false;
  if (metric.requiresEdges && !context.hasEdges) return false;
  if (metric.requiresCommunities && !context.hasCommunities) return false;
  if (metric.requiresPositions && !context.hasPositions) return false;
  if (['chiSquare', 'gSquare'].includes(metric.id) && !context.hasPositiveWeights) return false;
  return true;
}

export function compatibleMetrics(context: MetricGraphContext): MetricDefinition[] {
  return METRIC_REGISTRY.filter((metric) => isMetricCompatible(metric, context));
}
