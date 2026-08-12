export type TopologyType = 'Unipartite' | 'Bipartite';

export interface WizardFilesState {
  countsFile: File | null;
  percentagesFile: File | null;
  singleMatrixFile: File | null;
  edgesFile: File | null;
  nodesFile: File | null;
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
  nodeTypeCol: string;
  nodePartitionCol: string;
  nodeCommunityCol: string;
  nodeAbundCol: string;
  customNodeAttribute: string;
  customNodeAttributeType: 'binary' | 'discrete' | 'continuous' | 'nominal' | 'ordinal';
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

export interface ParsedDataState {
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
