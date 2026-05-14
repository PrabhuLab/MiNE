import { create } from 'zustand';

export interface RawNode {
  id: string;
  name: string;
  label?: string;
  type?: string;
  abundance: number;
}

export interface RawEdge {
  source: string;
  target: string;
  weight_raw: number;
  weight_secondary: number;
}

export interface WorkspaceFilters {
  relCutoff: number;
  absCutoff: number;
  removedNodes: string;
  recalculateCommunities: boolean;
  resolution: number;
  nodeSize: number;
  edgeWeight: number;
  nodeOpacity: number;
  edgeOpacity: number;
  forceStrength: number;
  livePhysics: boolean;
  isFrozen: boolean;
  edgeWeightBase: string;
  nodeSizeBase: string;
}

interface AppState {
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
  directed: boolean;
  bipartite: boolean;
  rawNodes: RawNode[];
  rawEdges: RawEdge[];
  setRawData: (nodes: RawNode[], edges: RawEdge[], directed?: boolean, bipartite?: boolean) => void;

  filters: WorkspaceFilters;
  setFilter: <K extends keyof WorkspaceFilters>(key: K, value: WorkspaceFilters[K]) => void;

  communityMap: Record<string, string>; // nodeId -> color
  setCommunityMap: (map: Record<string, string>) => void;
  
  clearStore: () => void;
}

export const useStore = create<AppState>((set) => ({
  isDarkMode: false,
  setIsDarkMode: (val) => set({ isDarkMode: val }),
  directed: false,
  bipartite: false,
  rawNodes: [],
  rawEdges: [],
  setRawData: (nodes, edges, directed = false, bipartite = false) => set({ rawNodes: nodes, rawEdges: edges, directed, bipartite }),

  filters: {
    relCutoff: 0,
    absCutoff: 0,
    removedNodes: "",
    recalculateCommunities: true,
    resolution: 1.0,
    nodeSize: 3,
    edgeWeight: 1.0,
    nodeOpacity: 1.0,
    edgeOpacity: 0.8,
    forceStrength: -100,
    livePhysics: false,
    isFrozen: false,
    edgeWeightBase: 'weight_raw',
    nodeSizeBase: 'abundance',
  },
  setFilter: (key, value) => 
    set((state) => ({ filters: { ...state.filters, [key]: value } })),

  communityMap: {},
  setCommunityMap: (map) => set({ communityMap: map }),
  
  clearStore: () => set({
    directed: false,
    bipartite: false,
    rawNodes: [],
    rawEdges: [],
    communityMap: {},
    filters: {
      relCutoff: 0,
      absCutoff: 0,
      removedNodes: "",
      recalculateCommunities: true,
      resolution: 1.0,
      nodeSize: 3,
      edgeWeight: 1.0,
      nodeOpacity: 1.0,
      edgeOpacity: 0.8,
      forceStrength: -100,
      livePhysics: false,
      isFrozen: false,
      edgeWeightBase: 'weight_raw',
      nodeSizeBase: 'abundance',
    }
  })
}));
