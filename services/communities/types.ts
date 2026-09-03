import type { CommunityAlgorithm, CommunityWeightChannel } from '@/services/cloud/types';
import type { LouvainNodeMetric } from '@/services/metrics/types';

export interface CommunitySettings {
  algorithm: CommunityAlgorithm;
  weightChannel: CommunityWeightChannel;
  resolution: number;
  iterations: number;
  trials: number;
  steps: number;
  seed: number;
  clusters: number;
}

export interface CommunityRequest {
  nodes: any[];
  edges: any[];
  directed: boolean;
  bipartite: boolean;
  graphRevision: string;
  filterRevision: string;
  settings: CommunitySettings;
  signal?: AbortSignal;
}

export interface CommunityComputationResult {
  resultId: string;
  algorithm: CommunityAlgorithm;
  label: string;
  memberships: Record<string, string>;
  louvainNodeMetrics?: LouvainNodeMetric[];
  quality: number | null;
  provenance: Record<string, unknown>;
  calculatedAt: string;
}

export const DEFAULT_COMMUNITY_SETTINGS: CommunitySettings = {
  algorithm: 'louvain',
  weightChannel: 'unweighted',
  resolution: 1,
  iterations: 2,
  trials: 10,
  steps: 4,
  seed: 42,
  clusters: 5,
};

/** One normalized post-success style update shared by Browser and Cloud community results. */
export function communityResultStyleSelection(resultId: string) {
  return {
    customNodeAttribute: resultId,
    nodeColorBase: 'custom',
    edgeColorBase: 'nodeMetric',
    edgeColorNodeMetric: `custom:${resultId}`,
    edgeColorNodeTarget: 'source' as const,
  };
}
