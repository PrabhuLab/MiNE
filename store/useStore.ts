import { create } from 'zustand';

export interface RawNode {
  id: string;
  name: string;
  label?: string;
  type?: string;
  group?: string | number;
  bipartite?: number | string;
  community?: string | number;
  abundance: number;
  x?: number;
  y?: number;
  partition?: string | number;
  [key: string]: any;
}

export interface RawEdge {
  source: string;
  target: string;
  weight_raw: number;
  weight_secondary: number;
  [key: string]: any;
}

export type CustomAttributeType = 'binary' | 'discrete' | 'continuous' | 'nominal' | 'ordinal';

export interface CustomAttributeMetadata {
  name: string;
  scope: 'node' | 'edge';
  detectedType: CustomAttributeType;
  selectedType: CustomAttributeType;
  ordinalOrder?: string[];
}

export interface ImportedMetricsBundle {
  graph: Record<string, any>;
  nodes: Record<string, Record<string, any>>;
  edges: Record<string, Record<string, any>>;
  metadata: Record<string, any>;
}

export interface WeightFilter {
  id: string;
  type: string;
  cutoff: number;
}

export interface WorkspaceFilters {
  weightFilters: WeightFilter[];
  searchEdges: boolean;
  removedNodes: string;
  resolution: number;
  nodeSize: number;
  bipartiteNodeSize: number;
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
  metricWeightAttribute: string;
  liveUpdate: boolean;
  livePhysics: boolean;
  customAttributeScope: 'node' | 'edge';
  customNodeAttribute: string;
  customEdgeAttribute: string;
}

interface AppState {
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
  directed: boolean;
  bipartite: boolean;
  rawNodes: RawNode[];
  rawEdges: RawEdge[];
  setRawData: (nodes: RawNode[], edges: RawEdge[], directed?: boolean, bipartite?: boolean) => void;
  customAttributes: CustomAttributeMetadata[];
  setCustomAttributes: (attributes: CustomAttributeMetadata[]) => void;
  importedMetrics: ImportedMetricsBundle | null;
  setImportedMetrics: (metrics: ImportedMetricsBundle | null) => void;

  filters: WorkspaceFilters;
  setFilter: <K extends keyof WorkspaceFilters>(key: K, value: WorkspaceFilters[K]) => void;

  communityMap: Record<string, string>; // nodeId -> color
  setCommunityMap: (map: Record<string, string>) => void;
  
  selectedElement: string | null;
  setSelectedElement: (val: string | null) => void;
  selectedCommunityId: string | null;
  setSelectedCommunityId: (val: string | null) => void;
  isolatedCommunityId: string | null;
  setIsolatedCommunityId: (val: string | null) => void;
  hoveredCommunityId: string | null;
  setHoveredCommunityId: (val: string | null) => void;
  
  hiddenLegendItems: string[];
  setHiddenLegendItems: (val: string[]) => void;
  isolatedLegendItem: string | null;
  setIsolatedLegendItem: (val: string | null) => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  showArrowheads: boolean;
  setShowArrowheads: (val: boolean) => void;
  showNodeLabels: boolean;
  setShowNodeLabels: (val: boolean) => void;
  rendererEngine: 'auto' | 'd3' | 'sigma';
  setRendererEngine: (engine: 'auto' | 'd3' | 'sigma') => void;
  isRendererSwitching: boolean;
  setIsRendererSwitching: (val: boolean) => void;
  projectName: string;
  setProjectName: (val: string) => void;
  clearStore: () => void;
}

export const useStore = create<AppState>((set) => ({
  isDarkMode: false,
  setIsDarkMode: (val) => set({ isDarkMode: val }),
  rendererEngine: 'auto',
  setRendererEngine: (val) => set({ rendererEngine: val }),
  isRendererSwitching: false,
  setIsRendererSwitching: (val) => set({ isRendererSwitching: val }),
  projectName: 'NEW_PROJECT_NAME',
  setProjectName: (val) => set({ projectName: val }),
  directed: false,
  bipartite: false,
  rawNodes: [],
  rawEdges: [],
  setRawData: (nodes, edges, directed = false, bipartite = false) => set({ rawNodes: nodes, rawEdges: edges, directed, bipartite }),
  customAttributes: [],
  setCustomAttributes: (customAttributes) => set({ customAttributes }),
  importedMetrics: null,
  setImportedMetrics: (importedMetrics) => set({ importedMetrics }),

  selectedElement: null,
  setSelectedElement: (val) => set({ selectedElement: val }),
  selectedCommunityId: null,
  setSelectedCommunityId: (val) => set({ selectedCommunityId: val }),
  isolatedCommunityId: null,
  setIsolatedCommunityId: (val) => set({ isolatedCommunityId: val }),
  hoveredCommunityId: null,
  setHoveredCommunityId: (val) => set({ hoveredCommunityId: val }),

  hiddenLegendItems: [],
  setHiddenLegendItems: (val) => set({ hiddenLegendItems: val }),
  isolatedLegendItem: null,
  setIsolatedLegendItem: (val) => set({ isolatedLegendItem: val }),
  searchQuery: '',
  setSearchQuery: (val) => set({ searchQuery: val }),
  showArrowheads: false,
  setShowArrowheads: (val) => set({ showArrowheads: val }),
  showNodeLabels: false,
  setShowNodeLabels: (val) => set({ showNodeLabels: val }),

  filters: {
    weightFilters: [],
    searchEdges: false,
    removedNodes: "",
    resolution: 1.0,
    nodeSize: 3,
    bipartiteNodeSize: 2,
    nodeSizeBase: 'abundance',
    nodeColorBase: 'louvain',
    uniformNodeColor: '#cccccc',
    uniformEdgeColor: '#888888',
    nodeOpacity: 1.0,
    edgeWeight: 1.0,
    edgeWeightBase: 'weight_raw',
    edgeColorBase: 'nodeMetric',
    edgeColorNodeMetric: 'louvain',
    edgeColorNodeTarget: 'source',
    edgeOpacity: 0.3,
    edgeOpacityBase: 'uniform',
    forceStrength: -100,
    louvainSeed: 42,
    metricWeightAttribute: 'weight_raw',
    liveUpdate: true,
    livePhysics: false,
    customAttributeScope: 'node',
    customNodeAttribute: '',
    customEdgeAttribute: '',
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
    customAttributes: [],
    importedMetrics: null,
    communityMap: {},
    selectedElement: null,
    selectedCommunityId: null,
    isolatedCommunityId: null,
    hoveredCommunityId: null,
    hiddenLegendItems: [],
    isolatedLegendItem: null,
    showArrowheads: false,
    showNodeLabels: false,
    filters: {
      weightFilters: [],
      searchEdges: false,
      removedNodes: "",
      resolution: 1.0,
      nodeSize: 3,
      bipartiteNodeSize: 2,
      nodeSizeBase: 'abundance',
      nodeColorBase: 'louvain',
      uniformNodeColor: '#cccccc',
      uniformEdgeColor: '#888888',
      nodeOpacity: 1.0,
      edgeWeight: 1.0,
      edgeWeightBase: 'weight_raw',
      edgeColorBase: 'nodeMetric',
      edgeColorNodeMetric: 'louvain',
      edgeColorNodeTarget: 'source',
      edgeOpacity: 0.3,
      edgeOpacityBase: 'uniform',
      forceStrength: -100,
      louvainSeed: 42,
      metricWeightAttribute: 'weight_raw',
      liveUpdate: true,
      livePhysics: false,
      customAttributeScope: 'node',
      customNodeAttribute: '',
      customEdgeAttribute: '',
    }
  })
}));
