import type { MetricValidity } from '@/services/metrics/types';

const requests = new Map<string, Promise<unknown>>();

/** Strict-Mode-safe request de-duplication scoped to one loaded graph instance. */
export function automaticLouvainOnce<T>(key: string, create: () => Promise<T>): Promise<T> {
  const existing = requests.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const request = create();
  requests.set(key, request);
  return request;
}

export function validSavedLouvainKey(options: {
  validity: Record<string, MetricValidity>;
  graphRevision: string;
  filterRevision: string;
  nodeIds: string[];
  nodes: Record<string, Record<string, unknown>>;
}): 'community_louvain' | 'louvain' | null {
  return (['community_louvain', 'louvain'] as const).find((id) => {
    const validity = options.validity[id];
    const attribute = id === 'louvain' ? 'louvain' : 'community_louvain';
    return validity?.graphRevision === options.graphRevision
      && validity?.filterRevision === options.filterRevision
      && options.nodeIds.every((nodeId) => options.nodes[nodeId]?.[attribute] !== undefined);
  }) || null;
}

export function resetAutomaticLouvainForTests(): void {
  requests.clear();
}
