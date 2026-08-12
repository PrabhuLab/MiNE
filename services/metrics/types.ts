export type MetricScope = 'graph' | 'node' | 'edge' | 'layout';
export type MetricCost = 'cheap' | 'medium' | 'expensive';

export interface MetricValidity {
  graphRevision: string;
  filterRevision: string;
  layoutRevision?: number;
  calculatedAt: string;
}

export interface MetricsSelection {
  [metricId: string]: boolean;
  louvain: boolean;
}

export interface MetricGraphContext {
  directed: boolean;
  weighted: boolean;
  bipartite: boolean;
  multi: boolean;
  hasEdges: boolean;
  hasPositiveWeights: boolean;
  hasCommunities: boolean;
  hasPositions: boolean;
}

export interface MetricComputation {
  graph?: unknown;
  nodes?: Record<string, Record<string, unknown>>;
  edges?: Record<string, Record<string, unknown>>;
}

export interface MetricsRequest {
  nodes: any[];
  edges: any[];
  directed: boolean;
  bipartite: boolean;
  selected: MetricsSelection;
  metricIds?: string[];
  runLouvain: boolean;
  louvainSeed: string | number;
  resolution: number;
  weightAttribute?: string;
  graphRevision: string;
  filterRevision: string;
  layoutRevision?: number;
}

export interface LouvainMetricsResult {
  nodeMetrics: any[];
  modularity: number;
}

export interface MetricsResult {
  nodeIds: string[];
  metricsByNode: Record<string, Record<string, any>>;
  metricsByEdge: Record<string, Record<string, any>>;
  graphMetrics: Record<string, any>;
  validity: Record<string, MetricValidity>;
  calculatedMetricIds: string[];
  warnings: Record<string, string>;
  louvain: LouvainMetricsResult | null;
}

export interface TopologyMetrics {
  nodeIds: string[];
  degreeByNode: Record<string, { degree?: number; inDegree?: number; outDegree?: number }>;
  declaredCommunities: Record<string, string>;
}
