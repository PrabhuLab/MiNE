import type { CloudLayoutSpec } from '../cloud/types';

export type LayoutAlgorithm = 'd3Force' | Exclude<CloudLayoutSpec['algorithm'], 'auto' | 'random'>;
export type LayoutSettings = Omit<CloudLayoutSpec, 'algorithm'>;

export interface LayoutResult {
  positions: Record<string, { x: number; y: number }>;
  filterRevision: string;
  warnings?: Record<string, string>;
}
