import { createMetricsGraph, graphologyMetricsEngine } from '@/services/metrics/graphologyEngine';
import { requestCloudAnalysis } from '@/services/cloud/coordinator';
import { buildCloudAnalyzeRequest } from '@/services/cloud/request';
import type { CommunityComputationResult, CommunityRequest } from './types';
import { computeCommunityMetrics } from '@/lib/workspaceUtils';

const resultIdOf = (algorithm: string) => `community_${algorithm}`;
const labelOf = (algorithm: string) => ({
  louvain: 'Louvain', infomap: 'Infomap', labelPropagation: 'Label Propagation', walktrap: 'Walktrap', fastGreedy: 'Fast Greedy', sbm: 'Sparse SBM', lbm: 'Sparse LBM',
} as Record<string, string>)[algorithm] || algorithm;

export async function computeCommunityInBrowser(request: CommunityRequest): Promise<CommunityComputationResult> {
  if (request.settings.algorithm !== 'louvain') throw new Error('Browser mode supports Louvain only. Select Cloud for this algorithm.');
  if (request.directed) throw new Error('Browser Louvain requires an undirected graph.');
  const result = await graphologyMetricsEngine.compute({
    nodes: request.nodes,
    edges: request.edges,
    directed: request.directed,
    bipartite: request.bipartite,
    selected: { louvain: true },
    metricIds: [],
    runLouvain: true,
    louvainSeed: request.settings.seed,
    resolution: request.settings.resolution,
    weightAttribute: request.settings.weightChannel === 'unweighted' ? '__unweighted' : request.settings.weightChannel,
    graphRevision: request.graphRevision,
    filterRevision: request.filterRevision,
    signal: request.signal,
  });
  if (!result.louvain) throw new Error(result.warnings.louvain || 'Louvain did not return a result.');
  const memberships = Object.fromEntries(result.louvain.nodeMetrics.map((entry) => [String(entry.id), `Cluster ${Number(entry.community) + 1}`]));
  return {
    resultId: resultIdOf('louvain'),
    algorithm: 'louvain',
    label: 'Louvain',
    memberships,
    louvainNodeMetrics: result.louvain.nodeMetrics.map((entry) => ({ ...entry, community: memberships[String(entry.id)], louvain: memberships[String(entry.id)] })),
    quality: Number.isFinite(result.louvain.modularity) ? result.louvain.modularity : null,
    provenance: { engine: 'graphology', ...request.settings },
    calculatedAt: new Date().toISOString(),
  };
}

export async function computeCommunityInCloud(request: CommunityRequest): Promise<CommunityComputationResult> {
  // Louvain is part of the original mine-igraph-1 metric contract. Routing it
  // through that stable shape keeps current and previously deployed backends
  // compatible while newer algorithms use the community extension below.
  if (request.settings.algorithm === 'louvain') {
    const legacyRequest = buildCloudAnalyzeRequest({
      nodes: request.nodes,
      edges: request.edges,
      directed: request.directed,
      bipartite: request.bipartite,
      filterRevision: request.filterRevision,
      weightAttribute: request.settings.weightChannel === 'unweighted' ? 'weight_raw' : request.settings.weightChannel,
      metricIds: ['louvain'],
      resolution: request.settings.resolution,
      randomSeed: request.settings.seed,
    });
    legacyRequest.graphRevision = request.graphRevision;
    if (request.settings.weightChannel === 'unweighted') delete legacyRequest.edgeWeights;
    const response = await requestCloudAnalysis(legacyRequest, request.signal);
    const memberships = response.nodeMetrics.louvain;
    if (!memberships || memberships.length !== legacyRequest.nodeIds.length) throw new Error('Cloud Louvain response did not include aligned memberships.');
    const membershipMap = Object.fromEntries(legacyRequest.nodeIds.map((id, index) => [id, `Cluster ${Number(memberships[index]) + 1}`]));
    // Derive the aligned node rows locally as well. This keeps the browser
    // client compatible with older deployed backends that return membership
    // and Q but predate node-level modularity fields.
    const graph = createMetricsGraph({
      nodes: request.nodes,
      edges: request.edges,
      directed: false,
      weightAttribute: request.settings.weightChannel === 'unweighted' ? '__unweighted' : request.settings.weightChannel,
    });
    const rawMemberships = Object.fromEntries(legacyRequest.nodeIds.map((id, index) => [id, String(memberships[index])]));
    const localNodeMetrics = computeCommunityMetrics(graph, rawMemberships, false, request.settings.resolution);
    return {
      resultId: resultIdOf('louvain'),
      algorithm: 'louvain',
      label: 'Louvain',
      memberships: membershipMap,
      louvainNodeMetrics: localNodeMetrics.map((entry) => ({ ...entry, community: membershipMap[entry.id], louvain: membershipMap[entry.id] })),
      quality: Number.isFinite(Number(response.graphMetrics.louvainModularity)) ? Number(response.graphMetrics.louvainModularity) : null,
      provenance: { engine: 'python-igraph', ...request.settings },
      calculatedAt: new Date().toISOString(),
    };
  }
  const cloudRequest = buildCloudAnalyzeRequest({
    nodes: request.nodes,
    edges: request.edges,
    directed: request.directed,
    bipartite: request.bipartite,
    filterRevision: request.filterRevision,
    weightAttribute: request.settings.weightChannel === 'unweighted' ? 'weight_raw' : request.settings.weightChannel,
    community: {
      algorithm: request.settings.algorithm,
      weightChannel: request.settings.weightChannel,
      resolution: request.settings.resolution,
      iterations: request.settings.iterations,
      trials: request.settings.trials,
      steps: request.settings.steps,
      seed: request.settings.seed,
      clusters: request.settings.clusters,
    },
  });
  cloudRequest.graphRevision = request.graphRevision;
  const response = await requestCloudAnalysis(cloudRequest, request.signal);
  if (!response.community) throw new Error('Cloud community response did not include memberships.');
  return {
    resultId: resultIdOf(response.community.algorithm),
    algorithm: response.community.algorithm,
    label: response.community.label || labelOf(response.community.algorithm),
    memberships: Object.fromEntries(cloudRequest.nodeIds.map((id, index) => [id, `Cluster ${Number(response.community!.membership[index]) + 1}`])),
    quality: Number.isFinite(Number(response.community.quality)) ? Number(response.community.quality) : null,
    provenance: response.community.provenance || { engine: 'python-igraph' },
    calculatedAt: new Date().toISOString(),
  };
}
