import Graph from 'graphology';
import louvainPkg from 'graphology-communities-louvain';
import pagerankPkg from 'graphology-metrics/centrality/pagerank';
import eigenvectorPkg from 'graphology-metrics/centrality/eigenvector';
import betweennessPkg from 'graphology-metrics/centrality/betweenness';
import closenessPkg from 'graphology-metrics/centrality/closeness';
import * as degreePkg from 'graphology-metrics/centrality/degree';
import seedrandomPkg from 'seedrandom';
import { normalize_communities } from '@/lib/communityUtils';
import { computeCommunityMetrics } from '@/lib/workspaceUtils';
import type { MetricsEngine } from './engine';
import type { MetricsRequest, MetricsResult, TopologyMetrics } from './types';

// Handle Next.js ESM/CJS interop for graphology plugins.
const louvain = typeof louvainPkg === 'function' ? louvainPkg : (louvainPkg as any).default || louvainPkg;
const pagerank = typeof pagerankPkg === 'function' ? pagerankPkg : (pagerankPkg as any).default || pagerankPkg;
const eigenvector = typeof eigenvectorPkg === 'function' ? eigenvectorPkg : (eigenvectorPkg as any).default || eigenvectorPkg;
const betweenness = typeof betweennessPkg === 'function' ? betweennessPkg : (betweennessPkg as any).default || betweennessPkg;
const closeness = typeof closenessPkg === 'function' ? closenessPkg : (closenessPkg as any).default || closenessPkg;
const degreeCentrality = degreePkg.degreeCentrality || (degreePkg as any).default?.degreeCentrality;
const inDegreeCentrality = degreePkg.inDegreeCentrality || (degreePkg as any).default?.inDegreeCentrality;
const outDegreeCentrality = degreePkg.outDegreeCentrality || (degreePkg as any).default?.outDegreeCentrality;
const seedrandom = typeof seedrandomPkg === 'function' ? seedrandomPkg : (seedrandomPkg as any).default || seedrandomPkg;

function createGraph(nodes: any[], edges: any[], directed: boolean): any {
  const graph: any = new (Graph as any)({
    type: directed ? 'directed' : 'undirected',
    multi: false,
    allowSelfLoops: false,
  });
  nodes.forEach((node) => {
    if (!graph.hasNode(node.id)) graph.addNode(node.id, { ...node });
  });
  edges.forEach((edge) => {
    if (graph.hasNode(edge.source) && graph.hasNode(edge.target) && !graph.hasEdge(edge.source, edge.target)) {
      graph.addEdge(edge.source, edge.target, { weight: edge.weight_raw || 1 });
    }
  });
  return graph;
}

export function calculateTopologyMetrics(nodes: any[], edges: any[], directed: boolean): TopologyMetrics {
  const graph = createGraph(nodes, edges, directed);
  const degreeByNode: TopologyMetrics['degreeByNode'] = {};
  const declaredCommunities: Record<string, string> = {};
  nodes.forEach((node) => {
    if (node.community !== undefined && node.community !== null && node.community !== '') {
      declaredCommunities[node.id] = String(node.community);
    }
  });
  graph.forEachNode((nodeId: string) => {
    degreeByNode[nodeId] = directed
      ? { inDegree: graph.inDegree ? graph.inDegree(nodeId) : 0, outDegree: graph.outDegree ? graph.outDegree(nodeId) : 0 }
      : { degree: graph.degree ? graph.degree(nodeId) : 0 };
  });
  return { nodeIds: graph.nodes(), degreeByNode, declaredCommunities };
}

class GraphologyMetricsEngine implements MetricsEngine {
  async compute(request: MetricsRequest): Promise<MetricsResult> {
    const graph = createGraph(request.nodes, request.edges, request.directed);
    const metricsByNode: Record<string, Record<string, any>> = {};
    graph.forEachNode((node: string) => { metricsByNode[node] = {}; });
    let louvainResult: MetricsResult['louvain'] = null;

    if (request.runLouvain) {
      try {
        const details = louvain.detailed(graph, {
          rng: seedrandom(request.louvainSeed),
          resolution: request.resolution,
          getEdgeWeight: 'weight',
          fastLocalMoves: true,
        });
        const normalized = normalize_communities(details.communities as Record<string, number>);
        Object.keys(normalized).forEach((node) => {
          metricsByNode[node].louvain = `Cluster ${normalized[node] + 1}`;
        });
        const communityMap = Object.fromEntries(
          Object.entries(normalized).map(([node, community]) => [node, String(community)]),
        );
        louvainResult = {
          nodeMetrics: computeCommunityMetrics(graph, communityMap, request.directed),
          modularity: details.modularity,
        };
      } catch (error) {
        console.warn('Community detection failed', error);
      }
    }

    if (request.selected.degree) {
      try {
        if (request.directed) {
          const inDegree = inDegreeCentrality(graph);
          const outDegree = outDegreeCentrality(graph);
          Object.keys(inDegree).forEach((node) => { metricsByNode[node].inDegreeCentrality = inDegree[node].toFixed(6); });
          Object.keys(outDegree).forEach((node) => { metricsByNode[node].outDegreeCentrality = outDegree[node].toFixed(6); });
        } else {
          const degree = degreeCentrality(graph);
          Object.keys(degree).forEach((node) => { metricsByNode[node].degreeCentrality = degree[node].toFixed(6); });
        }
      } catch (error) {
        console.warn('Degree Centrality failed', error);
      }
    }
    if (request.selected.betweenness) {
      try {
        const values = betweenness(graph);
        Object.keys(values).forEach((node) => { metricsByNode[node].betweenness = values[node].toFixed(6); });
      } catch (error) {
        console.warn('Betweenness Centrality failed', error);
      }
    }
    if (request.selected.closeness) {
      try {
        const values = closeness(graph);
        Object.keys(values).forEach((node) => { metricsByNode[node].closeness = values[node].toFixed(6); });
      } catch (error) {
        console.warn('Closeness Centrality failed', error);
      }
    }
    if (request.selected.clustering) {
      try {
        graph.forEachNode((node: string) => {
          const neighbors = graph.neighbors(node);
          const count = neighbors.length;
          if (count < 2) {
            metricsByNode[node].clustering = '0.000000';
            return;
          }
          let edgesBetween = 0;
          for (let first = 0; first < count; first++) {
            for (let second = first + 1; second < count; second++) {
              if (graph.hasEdge(neighbors[first], neighbors[second]) || graph.hasEdge(neighbors[second], neighbors[first])) edgesBetween++;
            }
          }
          const possibleEdges = request.directed ? count * (count - 1) : (count * (count - 1)) / 2;
          metricsByNode[node].clustering = (edgesBetween / possibleEdges).toFixed(6);
        });
      } catch (error) {
        console.warn('Clustering Coefficient failed', error);
      }
    }
    if (request.selected.pagerank) {
      try {
        const values = pagerank(graph);
        Object.keys(values).forEach((node) => { metricsByNode[node].pagerank = values[node].toFixed(6); });
      } catch (error) {
        console.warn('PageRank failed', error);
      }
    }
    if (request.selected.eigenvector) {
      try {
        const values = eigenvector(graph);
        Object.keys(values).forEach((node) => { metricsByNode[node].eigenvector = values[node].toFixed(6); });
      } catch (error) {
        console.warn('Eigenvector Centrality failed', error);
      }
    }

    return { nodeIds: graph.nodes(), metricsByNode, louvain: louvainResult };
  }
}

export const graphologyMetricsEngine: MetricsEngine = new GraphologyMetricsEngine();
