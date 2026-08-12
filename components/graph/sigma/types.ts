import type Graph from 'graphology';
import type Sigma from 'sigma';
import type { RawEdge, RawNode } from '@/store/useStore';
import type { GraphFocusRequest } from '@/services/workspace/types';

export type { GraphFocusRequest } from '@/services/workspace/types';

export interface SigmaGraphProps {
  graph: Graph;
  isReady?: boolean;
  nodes: RawNode[];
  edges: RawEdge[];
  communityMap: Record<string, string>;
  networkMetrics?: any[];
  nodeSizeMult: number;
  bipartiteNodeSizeMult?: number;
  nodeSizeBase?: string;
  nodeColorBase?: string;
  uniformNodeColor?: string;
  uniformEdgeColor?: string;
  edgeWeightMult?: number;
  edgeWeightBase?: string;
  edgeColorBase?: string;
  edgeColorNodeMetric?: string;
  edgeColorNodeTarget?: 'source' | 'target';
  nodeOpacity?: number;
  edgeOpacity?: number;
  edgeOpacityBase?: string;
  forceStrength: number;
  directed: boolean;
  bipartite: boolean;
  livePhysics?: boolean;
  isDarkMode?: boolean;
  refreshKey?: number;
  onRefresh?: () => void;
  onElementDoubleClick?: (id: string, type: 'node' | 'edge') => void;
  onClearSelection?: () => void;
  searchQuery?: string;
  selectedElement?: string | null;
  focusRequest?: GraphFocusRequest | null;
  onSwitchRenderer?: (engine: 'd3' | 'sigma') => void;
  isRendererSwitching?: boolean;
  beginDrag?: (id: string, x: number, y: number) => void;
  movePinnedNode?: (id: string, x: number, y: number) => void;
  endDrag?: (id: string) => void;
  onRendererReady?: (renderer: Sigma | null) => void;
}
