export type TopologyType = 'Unipartite' | 'Bipartite';

export interface WizardFilesState {
  countsFile: File | null;
  percentagesFile: File | null;
  singleMatrixFile: File | null;
  edgesFile: File | null;
  nodeFiles: File[];
  additionalEdgeFiles: File[];
  adjListFile: File | null;
  jsonFile: File | null;
  hasAdditionalAttributes: boolean;
}

export interface ColumnMappingState {
  sourceCol: string;
  adjSourceCol: string;
  targetCol: string;
  weightRawCol: string;
  weightSecCol: string;
  nodeIdCol: string;
  nodeLabelCol: string;
  nodePartitionCol: string;
  nodeCommunityCol: string;
  rowHeadersCol: number | '';
  colHeadersRow: number | '';
  dataStartRow: number | '';
  dataStartCol: number | '';
}

export interface BaseStepProps {
  isDarkMode: boolean;
  onNext?: () => void;
  onBack?: () => void;
}

export interface MetadataTable {
  name: string;
  kind: 'nodes' | 'edges';
  data: any[][];
  mapping: ColumnMappingState;
}

export interface ParsedDataState {
  metadataTables?: MetadataTable[];
  matrix?: any[][];
  counts?: any[][];
  percentages?: any[][];
  edges?: any[][];
  nodes?: any[][];
  adjList?: any[][];
  additionalEdges?: any[][];
  jsonNodes?: any[][];
  jsonEdges?: any[][];
  rawNodes?: any[];
  rawEdges?: any[];
}
