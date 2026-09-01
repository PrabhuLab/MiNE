import type Graph from 'graphology';
import type { ForceAtlas2Settings } from 'graphology-layout-forceatlas2';
import type { NoverlapSettings } from 'graphology-layout-noverlap';

export type LayoutAlgorithm = 'random' | 'circular' | 'circlepack' | 'noverlap' | 'forceatlas2'
  | 'd3Force' | 'auto' | 'drl' | 'fruchtermanReingold' | 'kamadaKawai' | 'cloudCircular' | 'cloudRandom' | 'bipartite' | 'sugiyama';

export interface LayoutSettings {
  random?: { center?: number; scale?: number };
  circular?: { center?: number; scale?: number };
  circlepack?: { center?: number; scale?: number; hierarchyAttributes?: string[] };
  noverlap?: NoverlapSettings & { maxIterations?: number };
  forceatlas2?: ForceAtlas2Settings;
  d3Force?: Record<string, never>;
  drl?: { seed?: number; normalize?: boolean };
  auto?: { seed?: number; normalize?: boolean };
  fruchtermanReingold?: { seed?: number; normalize?: boolean; iterations?: number };
  kamadaKawai?: { seed?: number; normalize?: boolean };
  cloudCircular?: { normalize?: boolean };
  cloudRandom?: { seed?: number; normalize?: boolean };
  bipartite?: { normalize?: boolean };
  sugiyama?: { normalize?: boolean };
}

export interface LayoutRequest<Node = unknown, Edge = unknown> {
  nodes: Node[];
  edges: Edge[];
  graph?: Graph;
  algorithm: LayoutAlgorithm;
  settings: LayoutSettings;
  onTick?: () => void;
  onStop?: () => void;
  directed?: boolean;
  bipartite?: boolean;
  graphRevision?: string;
  filterRevision?: string;
  signal?: AbortSignal;
  weightAttribute?: string;
}

export interface LayoutResult {
  positions: Record<string, { x: number; y: number }>;
  graphRevision?: string;
  filterRevision?: string;
  nodeOrderHash?: string;
  edgeOrderHash?: string;
  warnings?: Record<string, string>;
}
