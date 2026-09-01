import type { ComputeEngine } from './config';

export interface CloudLayoutSpec {
  algorithm: 'auto' | 'drl' | 'fruchtermanReingold' | 'kamadaKawai' | 'circular' | 'random' | 'bipartite' | 'sugiyama';
  seed?: number;
  normalize?: boolean;
  iterations?: number;
}

export type CommunityAlgorithm = 'louvain' | 'infomap' | 'labelPropagation' | 'walktrap' | 'fastGreedy' | 'sbm' | 'lbm';
export type CommunityWeightChannel = 'unweighted' | 'weight_raw' | 'weight_secondary';

export interface CloudCommunitySpec {
  algorithm: CommunityAlgorithm;
  weightChannel: CommunityWeightChannel;
  resolution?: number;
  iterations?: number;
  trials?: number;
  steps?: number;
  seed?: number;
  clusters?: number;
}

export interface CloudCommunityResult {
  algorithm: CommunityAlgorithm;
  label: string;
  membership: number[];
  quality?: number | null;
  provenance: Record<string, unknown>;
}

export interface CloudAnalyzeRequest {
  schemaVersion: 'mine-igraph-1';
  requestId?: string;
  graphRevision: string;
  filterRevision: string;
  nodeOrderHash: string;
  edgeOrderHash: string;
  directed: boolean;
  bipartite: boolean;
  nodeIds: string[];
  edgeSources: number[];
  edgeTargets: number[];
  edgeWeights?: number[];
  edgeKeys?: string[];
  communities?: Array<string | number>;
  partitions?: Array<string | number>;
  initialX?: number[];
  initialY?: number[];
  metricIds?: string[];
  layout?: CloudLayoutSpec;
  community?: CloudCommunitySpec;
  resolution?: number;
  randomSeed?: number;
}

export interface CloudAnalyzeResponse {
  schemaVersion: 'mine-igraph-1';
  requestId?: string | null;
  graphRevision: string;
  filterRevision: string;
  nodeOrderHash: string;
  edgeOrderHash: string;
  nodeCount: number;
  edgeCount: number;
  positions?: { x: number[]; y: number[] };
  community?: CloudCommunityResult;
  nodeMetrics: Record<string, Array<number | string | null>>;
  edgeMetrics: Record<string, Array<number | string | null>>;
  graphMetrics: Record<string, unknown>;
  validity: Record<string, unknown>;
  warnings: Record<string, string>;
  timings: Record<string, number>;
}

export interface CloudExecutionOptions {
  computeEngine?: ComputeEngine;
  signal?: AbortSignal;
}
