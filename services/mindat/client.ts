import type { RawEdge, RawNode } from '@/store/useStore';
import { MINE_IGRAPH_API_URL } from '@/services/cloud/config';

export type MindatNetworkTopology = 'bipartite' | 'mineral' | 'locality';
export type MindatAttributeScope = 'mineral' | 'locality' | 'occurrence';

export interface MindatSearchFilters {
  mineralIds: number[];
  localityIds: number[];
  name: string;
  keywords: string;
  includeElements: string[];
  excludeElements: string[];
  essentialElementsOnly: boolean;
}

export interface MindatDatasetQuery {
  token: string;
  filters: MindatSearchFilters;
  maxGeomaterials: number;
  maxOccurrences: number;
  includeQuestioned: boolean;
}

export interface MindatDataset {
  format: 'mindat-json';
  version: 1;
  query: Record<string, unknown>;
  attributeCatalog: Record<MindatAttributeScope, string[]>;
  geomaterials: Array<Record<string, unknown>>;
  localities: Array<Record<string, unknown>>;
  occurrences: Array<Record<string, unknown>>;
}

export interface MindatNetworkQuery {
  dataset: MindatDataset;
  topology: MindatNetworkTopology;
  attributes: Record<MindatAttributeScope, string[]>;
}

export interface MindatNetwork {
  nodes: RawNode[];
  edges: RawEdge[];
  topology: MindatNetworkTopology;
  bipartite: boolean;
  occurrenceCount: number;
  mineralCount: number;
  localityCount: number;
}

const apiUrl = () => {
  if (!MINE_IGRAPH_API_URL) {
    throw new Error('Mindat imports require the MiNE Python API. Configure NEXT_PUBLIC_MINE_IGRAPH_API_URL and restart MiNE.');
  }
  return MINE_IGRAPH_API_URL;
};

const responsePayload = async <T>(response: Response): Promise<T> => {
  const payload = await response.json().catch(() => null) as (T & { detail?: { message?: string } }) | null;
  if (!response.ok) throw new Error(payload?.detail?.message || `Mindat request failed (${response.status}).`);
  if (!payload) throw new Error('The MiNE Python API returned an empty Mindat response.');
  return payload;
};

export async function fetchMindatDataset(query: MindatDatasetQuery): Promise<MindatDataset> {
  const response = await fetch(`${apiUrl()}/v1/mindat/dataset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      apiToken: query.token,
      filters: query.filters,
      maxGeomaterials: query.maxGeomaterials,
      maxOccurrences: query.maxOccurrences,
      includeQuestioned: query.includeQuestioned,
    }),
  });
  const dataset = await responsePayload<MindatDataset>(response);
  if (
    dataset.format !== 'mindat-json'
    || !Array.isArray(dataset.geomaterials)
    || !Array.isArray(dataset.localities)
    || !Array.isArray(dataset.occurrences)
  ) {
    throw new Error('The MiNE Python API returned an unexpected Mindat JSON dataset.');
  }
  return dataset;
}

export async function fetchMindatNetwork(query: MindatNetworkQuery): Promise<MindatNetwork> {
  const response = await fetch(`${apiUrl()}/v1/mindat/network`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(query),
  });
  const network = await responsePayload<MindatNetwork>(response);
  if (!Array.isArray(network.nodes) || !Array.isArray(network.edges)) {
    throw new Error('The MiNE Python API returned an unexpected Mindat network response.');
  }
  return network;
}
