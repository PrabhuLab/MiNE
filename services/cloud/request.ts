import type { RawEdge, RawNode } from '@/store/useStore';
import { CLOUD_SCHEMA_VERSION } from './config';
import { computeGraphRevisions } from './revision';
import type { CloudAnalyzeRequest, CloudCommunitySpec, CloudLayoutSpec } from './types';

interface BuildOptions {
  nodes: RawNode[];
  edges: RawEdge[];
  directed: boolean;
  bipartite: boolean;
  filterRevision?: string;
  weightAttribute?: string;
  metricIds?: string[];
  layout?: CloudLayoutSpec;
  community?: CloudCommunitySpec;
  resolution?: number;
  randomSeed?: number;
  includeCommunities?: boolean;
  includeInitialPositions?: boolean;
}

export function buildCloudAnalyzeRequest(options: BuildOptions): CloudAnalyzeRequest {
  const weightAttribute = options.weightAttribute || 'weight_raw';
  const revisions = computeGraphRevisions(options.nodes, options.edges, options.directed, true, weightAttribute);
  const nodeIndex = new Map(options.nodes.map((node, index) => [String(node.id), index]));
  const edgeSources: number[] = [];
  const edgeTargets: number[] = [];
  const edgeWeights: number[] = [];
  const edgeKeys: string[] = [];

  options.edges.forEach((edge, index) => {
    const source = nodeIndex.get(String(edge.source));
    const target = nodeIndex.get(String(edge.target));
    if (source === undefined || target === undefined) {
      throw new Error(`Edge ${edge.key ?? index} refers to a node outside the compact node order.`);
    }
    edgeSources.push(source);
    edgeTargets.push(target);
    const rawWeight = Number(edge[weightAttribute] ?? 1);
    edgeWeights.push(Number.isFinite(rawWeight) ? rawWeight : 1);
    edgeKeys.push(String(edge.key ?? `e${index}`));
  });

  const request: CloudAnalyzeRequest = {
    schemaVersion: CLOUD_SCHEMA_VERSION,
    graphRevision: revisions.graphRevision,
    filterRevision: options.filterRevision || revisions.graphRevision,
    nodeOrderHash: revisions.nodeOrderHash,
    edgeOrderHash: revisions.edgeOrderHash,
    directed: options.directed,
    bipartite: options.bipartite,
    nodeIds: options.nodes.map((node) => String(node.id)),
    edgeSources,
    edgeTargets,
  };
  if (options.metricIds?.length) request.metricIds = Array.from(new Set(options.metricIds));
  if (options.layout) request.layout = options.layout;
  if (options.community) request.community = options.community;
  if (options.resolution !== undefined) request.resolution = options.resolution;
  if (options.randomSeed !== undefined) request.randomSeed = options.randomSeed;
  if (request.metricIds?.length || options.layout || (options.community && options.community.weightChannel !== 'unweighted')) {
    request.edgeWeights = edgeWeights;
    request.edgeKeys = edgeKeys;
  }
  if (options.includeCommunities) {
    request.communities = options.nodes.map((node) => node.community ?? node.louvain ?? '');
  }
  if (options.layout?.algorithm === 'bipartite' || options.community?.algorithm === 'lbm') {
    request.partitions = options.nodes.map((node) => node.partition ?? node.bipartite ?? node.type ?? 0);
  }
  if (options.includeInitialPositions) {
    const coordinates = options.nodes.map((node) => [Number(node.x), Number(node.y)] as const);
    if (coordinates.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))) {
      request.initialX = coordinates.map(([x]) => x);
      request.initialY = coordinates.map(([, y]) => y);
    }
  }
  return request;
}
