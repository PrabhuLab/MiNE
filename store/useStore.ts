import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ComputeEnginePreference } from '@/services/cloud/config';
import { mergeComputeEnginePreference, persistedComputeEnginePreference } from '@/services/cloud/preference';
import type { RendererPreference } from '@/services/engines/policy';

export interface RawNode {
  id: string;
  name: string;
  label?: string;
  type?: string;
  group?: string | number;
  bipartite?: number | string;
  community?: string | number;
  abundance?: number;
  x?: number;
  y?: number;
  partition?: string | number;
  [key: string]: any;
}

export interface RawEdge {
  source: string;
  target: string;
  weight_raw: number;
  weight_secondary?: number;
  [key: string]: any;
}

export type CustomAttributeType = 'binary' | 'discrete' | 'continuous' | 'nominal' | 'ordinal';

export interface CustomAttributeMetadata {
  name: string;
  label?: string;
  scope: 'node' | 'edge';
  origin?: 'topology' | 'uploaded' | 'metric' | 'community';
  detectedType: CustomAttributeType;
  selectedType: CustomAttributeType;
  source?: string;
  active?: boolean;
  shown?: boolean;
  color?: string;
  edgeNodeTarget?: 'none' | 'source' | 'target';
  combine?: boolean;
  drivesCommunity?: boolean;
  ordinalOrder?: string[];
  presentCount?: number;
  resultOf?: string;
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

export interface EdgeFilter {
  attribute: string;
  min: number;
  max: number;
}

export interface WorkspaceFilters {
  edgeFilter: EdgeFilter | null;
  /** @deprecated Read only during legacy workspace migration. */
  weightFilters?: WeightFilter[];
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
  customNodeSizeAttribute: string;
  customEdgeAttribute: string;
  communityAttribute: string;
}

interface AppState {
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
  directed: boolean;
  bipartite: boolean;
  rawNodes: RawNode[];
  rawEdges: RawEdge[];
  graphGeneration: number;
  setRawData: (nodes: RawNode[], edges: RawEdge[], directed?: boolean, bipartite?: boolean) => void;
  customAttributes: CustomAttributeMetadata[];
  setCustomAttributes: (attributes: CustomAttributeMetadata[]) => void;
  importedMetrics: ImportedMetricsBundle | null;
  setImportedMetrics: (metrics: ImportedMetricsBundle | null) => void;
  restoredVisualization: boolean;
  setRestoredVisualization: (restored: boolean) => void;

  filters: WorkspaceFilters;
  setFilter: <K extends keyof WorkspaceFilters>(key: K, value: WorkspaceFilters[K]) => void;

  communityMap: Record<string, string>; // nodeId -> color
  setCommunityMap: (map: Record<string, string>) => void;
  legendColorOverrides: Record<string, string>;
  setLegendColor: (key: string, color: string) => void;
  
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
  isLegendMinimized: boolean;
  setIsLegendMinimized: (val: boolean) => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  showArrowheads: boolean;
  setShowArrowheads: (val: boolean) => void;
  showNodeLabels: boolean;
  setShowNodeLabels: (val: boolean) => void;
  rendererEngine: RendererPreference;
  setRendererEngine: (engine: RendererPreference) => void;
  computeEngine: ComputeEnginePreference;
  setComputeEngine: (engine: ComputeEnginePreference) => void;
  isRendererSwitching: boolean;
  setIsRendererSwitching: (val: boolean) => void;
  projectName: string;
  setProjectName: (val: string) => void;
  clearStore: () => void;
}

export const useStore = create<AppState>()(persist<AppState, [], [], { computeEngine: ComputeEnginePreference; rendererEngine: RendererPreference }>((set) => ({
  isDarkMode: false,
  setIsDarkMode: (val) => set({ isDarkMode: val }),
  rendererEngine: 'auto',
  setRendererEngine: (val) => set({ rendererEngine: val }),
  computeEngine: 'browser',
  setComputeEngine: (val) => set({ computeEngine: val }),
  isRendererSwitching: false,
  setIsRendererSwitching: (val) => set({ isRendererSwitching: val }),
  projectName: 'NEW_PROJECT_NAME',
  setProjectName: (val) => set({ projectName: val }),
  directed: false,
  bipartite: false,
  rawNodes: [],
  rawEdges: [],
  graphGeneration: 0,
  setRawData: (nodes, edges, directed = false, bipartite = false) => set((state) => ({ rawNodes: nodes, rawEdges: edges, directed, bipartite, graphGeneration: state.graphGeneration + 1 })),
  customAttributes: [],
  setCustomAttributes: (customAttributes) => set({ customAttributes }),
  importedMetrics: null,
  setImportedMetrics: (importedMetrics) => set({ importedMetrics }),
  restoredVisualization: false,
  setRestoredVisualization: (restoredVisualization) => set({ restoredVisualization }),

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
  isLegendMinimized: false,
  setIsLegendMinimized: (val) => set({ isLegendMinimized: val }),
  searchQuery: '',
  setSearchQuery: (val) => set({ searchQuery: val }),
  showArrowheads: false,
  setShowArrowheads: (val) => set({ showArrowheads: val }),
  showNodeLabels: false,
  setShowNodeLabels: (val) => set({ showNodeLabels: val }),

  filters: {
    edgeFilter: null,
    searchEdges: false,
    removedNodes: "",
    resolution: 1.0,
    nodeSize: 3,
    bipartiteNodeSize: 2,
    nodeSizeBase: 'degree',
    nodeColorBase: 'uniform',
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
    metricWeightAttribute: 'weight_raw',
    liveUpdate: true,
    livePhysics: false,
    customAttributeScope: 'node',
    customNodeAttribute: '',
    customNodeSizeAttribute: '',
    customEdgeAttribute: '',
    communityAttribute: '',
  },
  setFilter: (key, value) => 
    set((state) => ({ filters: { ...state.filters, [key]: value } })),

  communityMap: {},
  setCommunityMap: (map) => set({ communityMap: map }),
  legendColorOverrides: {},
  setLegendColor: (key, color) => set((state) => ({
    legendColorOverrides: { ...state.legendColorOverrides, [key]: color },
  })),
  
  clearStore: () => set((state) => ({
    graphGeneration: state.graphGeneration + 1,
    projectName: 'NEW_PROJECT_NAME',
    directed: false,
    bipartite: false,
    rawNodes: [],
    rawEdges: [],
    customAttributes: [],
    importedMetrics: null,
    restoredVisualization: false,
    communityMap: {},
    legendColorOverrides: {},
    selectedElement: null,
    selectedCommunityId: null,
    isolatedCommunityId: null,
    hoveredCommunityId: null,
    hiddenLegendItems: [],
    isolatedLegendItem: null,
    isLegendMinimized: false,
    showArrowheads: false,
    showNodeLabels: false,
    filters: {
      edgeFilter: null,
      searchEdges: false,
      removedNodes: "",
      resolution: 1.0,
      nodeSize: 3,
      bipartiteNodeSize: 2,
      nodeSizeBase: 'degree',
      nodeColorBase: 'uniform',
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
      metricWeightAttribute: 'weight_raw',
      liveUpdate: true,
      livePhysics: false,
      customAttributeScope: 'node',
      customNodeAttribute: '',
      customNodeSizeAttribute: '',
      customEdgeAttribute: '',
      communityAttribute: '',
    }
  }))
}), {
  name: 'mine-ui-preferences-v1',
  partialize: persistedComputeEnginePreference,
  merge: mergeComputeEnginePreference,
  skipHydration: true,
}));
