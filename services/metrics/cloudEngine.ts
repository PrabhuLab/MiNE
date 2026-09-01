import type { MetricsEngine } from './engine';
import type { MetricValidity, MetricsResult } from './types';
import { requestCloudAnalysis } from '@/services/cloud/coordinator';
import { buildCloudAnalyzeRequest } from '@/services/cloud/request';

const RESULT_ATTRIBUTES: Record<string, string[]> = {
  density: ['density'], diameter: ['diameter'], extent: ['extent'], simpleSize: ['simpleSize'], weightedSize: ['weightedSize'],
  eccentricity: ['eccentricity'], weightedDegree: ['weightedDegree', 'weightedInDegree', 'weightedOutDegree'],
  degree: ['degreeCentrality', 'inDegreeCentrality', 'outDegreeCentrality'], betweenness: ['betweenness'],
  edgeBetweenness: ['edgeBetweenness'], closeness: ['closeness'], eigenvector: ['eigenvector'], hits: ['hub', 'authority'],
  pagerank: ['pagerank'], louvain: ['louvain'], modularity: ['modularity'],
};

export const cloudMetricsEngine: MetricsEngine = {
  async compute(request): Promise<MetricsResult> {
    const metricIds = Array.from(new Set([...(request.metricIds || []), ...(request.runLouvain ? ['louvain'] : [])]));
    const cloudRequest = buildCloudAnalyzeRequest({
      nodes: request.nodes,
      edges: request.edges,
      directed: request.directed,
      bipartite: request.bipartite,
      filterRevision: request.filterRevision,
      weightAttribute: request.weightAttribute,
      metricIds,
      resolution: request.resolution,
      randomSeed: Number(request.louvainSeed) || 42,
      includeCommunities: metricIds.includes('modularity'),
    });
    // Preserve the caller's retained graph revision when it was computed from
    // the same canonical order; response validation still checks order hashes.
    cloudRequest.graphRevision = request.graphRevision;
    const result = await requestCloudAnalysis(cloudRequest, request.signal);
    const metricsByNode: MetricsResult['metricsByNode'] = Object.fromEntries(cloudRequest.nodeIds.map((id) => [id, {}]));
    const metricsByEdge: MetricsResult['metricsByEdge'] = Object.fromEntries((cloudRequest.edgeKeys || []).map((key) => [key, {}]));
    Object.entries(result.nodeMetrics).forEach(([attribute, values]) => values.forEach((value, index) => {
      if (value !== null) metricsByNode[cloudRequest.nodeIds[index]][attribute] = value;
    }));
    Object.entries(result.edgeMetrics).forEach(([attribute, values]) => values.forEach((value, index) => {
      if (value !== null && cloudRequest.edgeKeys?.[index]) metricsByEdge[cloudRequest.edgeKeys[index]][attribute] = value;
    }));
    const calculatedAt = new Date().toISOString();
    const validity: Record<string, MetricValidity> = {};
    metricIds.forEach((id) => {
      const attributes = RESULT_ATTRIBUTES[id] || [];
      const present = attributes.some((attribute) => result.nodeMetrics[attribute] || result.edgeMetrics[attribute] || attribute in result.graphMetrics)
        || (id === 'louvain' && Boolean(result.nodeMetrics.louvain));
      if (present) validity[id] = { graphRevision: request.graphRevision, filterRevision: request.filterRevision, calculatedAt };
    });
    const louvainValues = result.nodeMetrics.louvain;
    const louvain = louvainValues ? {
      nodeMetrics: cloudRequest.nodeIds.map((id, index) => ({ id, louvain: `Cluster ${Number(louvainValues[index]) + 1}`, community: `Cluster ${Number(louvainValues[index]) + 1}` })),
      modularity: Number(result.graphMetrics.louvainModularity ?? 0),
    } : null;
    if (louvain) louvain.nodeMetrics.forEach((entry) => Object.assign(metricsByNode[entry.id], entry));
    return {
      nodeIds: cloudRequest.nodeIds,
      metricsByNode,
      metricsByEdge,
      graphMetrics: result.graphMetrics,
      validity,
      calculatedMetricIds: Object.keys(validity),
      warnings: result.warnings || {},
      louvain,
    };
  },
};
