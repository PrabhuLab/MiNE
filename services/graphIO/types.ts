import type Graph from 'graphology';
import type { SerializedGraph } from 'graphology-types';
import type { CustomAttributeMetadata, ImportedMetricsBundle, WorkspaceFilters } from '@/store/useStore';

export const NETWORK_WORKSPACE_FORMAT = 'network-workspace' as const;
export const WORKSPACE_SETTINGS_FORMAT = 'workspace-settings' as const;
export const GRAPH_IO_VERSION = 1 as const;

export interface WorkspaceSettingsDocument {
  format: typeof WORKSPACE_SETTINGS_FORMAT;
  version: typeof GRAPH_IO_VERSION;
  projectName: string;
  rendererEngine: 'auto' | 'd3' | 'sigma';
  graphMode: { directed: boolean; bipartite: boolean; weighted: boolean };
  filters: WorkspaceFilters;
  appearance: {
    isDarkMode: boolean;
    showNodeLabels: boolean;
    showArrowheads: boolean;
    communityMap: Record<string, string>;
    customAttributes?: CustomAttributeMetadata[];
    legendColorOverrides?: Record<string, string>;
  };
  visibility: {
    hiddenLegendItems: string[];
    isolatedLegendItem: string | null;
    isolatedCommunityId: string | null;
  };
  calculations: { selected: Record<string, boolean> };
  layout: { livePhysics: boolean; forceStrength: number };
}

export interface AllInOneDocument {
  format: typeof NETWORK_WORKSPACE_FORMAT;
  version: typeof GRAPH_IO_VERSION;
  graph: SerializedGraph;
  metrics: ImportedMetricsBundle;
  workspace: WorkspaceSettingsDocument;
}

export interface ParsedNetwork {
  graph: Graph;
  directed: boolean;
  bipartite: boolean;
  weighted: boolean;
  metrics: ImportedMetricsBundle | null;
  workspace: WorkspaceSettingsDocument | null;
  projectName?: string;
}

export const EMPTY_METRICS: ImportedMetricsBundle = { graph: {}, nodes: {}, edges: {}, metadata: {} };
