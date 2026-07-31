import { create } from 'zustand';

export interface RawNode {
  id: string;
  name: string;
  label?: string;
  type?: string;
  community?: string | number;
  abundance: number;
}

export interface RawEdge {
  source: string;
  target: string;
  weight_raw: number;
  weight_secondary: number;
}

export interface WeightFilter {
  id: string;
  type: 'weight_raw' | 'weight_secondary';
  cutoff: number;
}

export interface WorkspaceFilters {
  weightFilters: WeightFilter[];
  searchEdges: boolean;
  removedNodes: string;
  resolution: number;
  nodeSize: number;
  nodeSizeBase: string;
  nodeColorBase: string;
  uniformNodeColor: string;
  uniformEdgeColor: string;
  nodeOpacity: number;
  edgeWeight: number;
  edgeWeightBase: string;
  edgeColorBase: string;
  edgeColorNodeMetric: string;
  edgeColorNodeTarget: 'source' | 'target';
  edgeOpacity: number;
  edgeOpacityBase: string;
  forceStrength: number;
  louvainSeed: number;
  liveUpdate: boolean;
  livePhysics: boolean;
  
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
  
  selectedElement: string | null;
  setSelectedElement: (val: string | null) => void;
  hiddenLegendItems: string[];
  setHiddenLegendItems: (val: string[]) => void;
  isolatedLegendItem: string | null;
  setIsolatedLegendItem: (val: string | null) => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  showArrowheads: boolean;
  setShowArrowheads: (val: boolean) => void;
  projectName: string;
  setProjectName: (val: string) => void;
  clearStore: () => void;
}

export const useStore = create<AppState>((set) => ({
  isDarkMode: false,
  setIsDarkMode: (val) => set({ isDarkMode: val }),
  projectName: 'NEW_PROJECT_NAME',
  setProjectName: (val) => set({ projectName: val }),
  directed: false,
  bipartite: false,
  rawNodes: [],
  rawEdges: [],
  setRawData: (nodes, edges, directed = false, bipartite = false) => set({ rawNodes: nodes, rawEdges: edges, directed, bipartite }),

  selectedElement: null,
  setSelectedElement: (val) => set({ selectedElement: val }),
  hiddenLegendItems: [],
  setHiddenLegendItems: (val) => set({ hiddenLegendItems: val }),
  isolatedLegendItem: null,
  setIsolatedLegendItem: (val) => set({ isolatedLegendItem: val }),
  searchQuery: '',
  setSearchQuery: (val) => set({ searchQuery: val }),
  showArrowheads: false,
  setShowArrowheads: (val) => set({ showArrowheads: val }),

  filters: {
    weightFilters: [],
    searchEdges: false,
    removedNodes: "",
    resolution: 1.0,
    nodeSize: 3,
    nodeSizeBase: 'abundance',
    nodeColorBase: 'custom',
    uniformNodeColor: '#cccccc',
    uniformEdgeColor: '#888888',
    nodeOpacity: 1.0,
    edgeWeight: 1.0,
    edgeWeightBase: 'weight_raw',
    edgeColorBase: 'uniform',
    edgeColorNodeMetric: '',
    edgeColorNodeTarget: 'source',
    edgeOpacity: 0.3,
    edgeOpacityBase: 'uniform',
    forceStrength: -100,
    louvainSeed: 42,
    liveUpdate: true,
    livePhysics: false,
    
  },
  setFilter: (key, value) => 
    set((state) => ({ filters: { ...state.filters, [key]: value } })),

  communityMap: {},
  setCommunityMap: (map) => set({ communityMap: map }),
  
  clearStore: () => set({
    projectName: 'NEW_PROJECT_NAME',
    directed: false,
    bipartite: false,
    rawNodes: [],
    rawEdges: [],
    communityMap: {},
    hiddenLegendItems: [],
    isolatedLegendItem: null,
    showArrowheads: false,
    filters: {
      weightFilters: [],
      searchEdges: false,
      removedNodes: "",
      resolution: 1.0,
      nodeSize: 3,
      nodeSizeBase: 'abundance',
      nodeColorBase: 'custom',
      uniformNodeColor: '#cccccc',
      uniformEdgeColor: '#888888',
      nodeOpacity: 1.0,
      edgeWeight: 1.0,
      edgeWeightBase: 'weight_raw',
      edgeColorBase: 'uniform',
      edgeColorNodeMetric: '',
      edgeColorNodeTarget: 'source',
      edgeOpacity: 0.3,
      edgeOpacityBase: 'uniform',
      forceStrength: -100,
      louvainSeed: 42,
      liveUpdate: true,
      livePhysics: false,
      
    }
  })
}));
