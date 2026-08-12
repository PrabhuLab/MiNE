export interface MetricsSelection {
  louvain: boolean;
  degree: boolean;
  betweenness: boolean;
  closeness: boolean;
  clustering: boolean;
  pagerank: boolean;
  eigenvector: boolean;
}

export interface MetricsRequest {
  nodes: any[];
  edges: any[];
  directed: boolean;
  selected: MetricsSelection;
  runLouvain: boolean;
  louvainSeed: string | number;
  resolution: number;
}

export interface LouvainMetricsResult {
  nodeMetrics: any[];
  modularity: number;
}

export interface MetricsResult {
  nodeIds: string[];
  metricsByNode: Record<string, Record<string, any>>;
  louvain: LouvainMetricsResult | null;
}

export interface TopologyMetrics {
  nodeIds: string[];
  degreeByNode: Record<string, { degree?: number; inDegree?: number; outDegree?: number }>;
  declaredCommunities: Record<string, string>;
}
