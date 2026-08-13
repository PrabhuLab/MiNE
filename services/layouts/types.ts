import type Graph from 'graphology';
import type { ForceAtlas2Settings } from 'graphology-layout-forceatlas2';
import type { NoverlapSettings } from 'graphology-layout-noverlap';

export type LayoutAlgorithm = 'random' | 'circular' | 'circlepack' | 'noverlap' | 'forceatlas2';

export interface LayoutSettings {
  random?: { center?: number; scale?: number };
  circular?: { center?: number; scale?: number };
  circlepack?: { center?: number; scale?: number; hierarchyAttributes?: string[] };
  noverlap?: NoverlapSettings & { maxIterations?: number };
  forceatlas2?: ForceAtlas2Settings;
}

export interface LayoutRequest<Node = unknown, Edge = unknown> {
  nodes: Node[];
  edges: Edge[];
  graph?: Graph;
  algorithm: LayoutAlgorithm;
  settings: LayoutSettings;
  onTick?: () => void;
  onStop?: () => void;
}

export interface LayoutResult {
  positions: Record<string, { x: number; y: number }>;
}
