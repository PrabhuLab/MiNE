'use client';

/* eslint-disable react-hooks/set-state-in-effect */

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { resetCommunityColorCache } from '@/lib/communityUtils';
import { TopologyType, WizardFilesState, ColumnMappingState, ParsedDataState } from './types';
import { parseCSVFile } from './utils/parseHelpers';
import { constructGraph } from './utils/graphConstructors';
import {
  createRandomClusterAllInOne,
  graphFromRaw,
  graphToRaw,
  inferCustomEdgeAttributes,
  inferCustomNodeAttributes,
  mergeCustomAttributeMetadata,
  parseNetworkFiles,
  type ParsedNetwork,
  type WorkspaceSettingsDocument,
} from '@/lib/graphIO';

import { StepTopology } from './steps/StepTopology';
import { StepWeights } from './steps/StepWeights';
import { StepDirection } from './steps/StepDirection';
import { StepFileFormat } from './steps/StepFileFormat';
import { StepDataMapping } from './steps/StepDataMapping';
import { migrateComputationPreference, migrateRendererPreference, migrateWorkspaceFilters } from '@/services/graphIO/migrations';
import { UnifiedNetworkImportCard } from './UnifiedNetworkImportCard';
import { RandomGraphCard, type RandomGraphOptions } from './RandomGraphCard';

const detectNodeIdColumn = (headers: string[]) =>
  headers.find((header) => /^(?:id|node[ _-]?id|key|mode[ _-]?#)$/i.test(String(header).trim())) || headers[0] || '';

const detectNodeLabelColumn = (headers: string[]) =>
  headers.find((header) => /^(?:label|name|node[ _-]?label|mode[ _-]?name)$/i.test(String(header).trim())) || '';

export default function SmartUploadWizard() {
  const router = useRouter();
  const setRawData = useStore((state) => state.setRawData);
  const clearStore = useStore((state) => state.clearStore);
  const isDarkMode = useStore((state) => state.isDarkMode);
  const [networkFiles, setNetworkFiles] = useState<File[]>([]);
  const [networkImporting, setNetworkImporting] = useState(false);
  const [randomOptions, setRandomOptions] = useState<RandomGraphOptions>({ order: 100, size: 350, clusters: 5, clusterDensity: 0.7 });

  // Cascade UI State
  const [step, setStep] = useState(1);
  const [topology, setTopology] = useState<TopologyType | null>(null);
  const [isWeighted, setIsWeighted] = useState<boolean>(false);
  const [isDirected, setIsDirected] = useState<boolean>(false);
  const [format, setFormat] = useState('Standard JSON');

  // File State
  const [filesState, setFilesState] = useState<WizardFilesState>({
    countsFile: null,
    percentagesFile: null,
    singleMatrixFile: null,
    edgesFile: null,
    nodesFile: null,
    adjListFile: null,
    jsonFile: null,
    hasAdditionalAttributes: false,
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Parsed CSVs / JSON
  const [parsedData, setParsedData] = useState<ParsedDataState>({});

  // Column Mapping State
  const [mapping, setMapping] = useState<ColumnMappingState>({
    sourceCol: '',
    adjSourceCol: '',
    targetCol: '',
    weightRawCol: '',
    weightSecCol: '',
    nodeIdCol: '',
    nodeLabelCol: '',
    nodePartitionCol: '',
    nodeCommunityCol: '',
    rowHeadersCol: 0,
    colHeadersRow: 0,
    dataStartRow: 1,
    dataStartCol: 1,
  });

  const availableFormats = useMemo(() => {
    if (topology === 'Bipartite') {
      const edgeListFormat = isDirected ? 'Directed Bipartite Edge List' : 'Bipartite Edge List';
      return ['Incidence Matrix', edgeListFormat, 'Standard JSON'];
    }
    if (topology === 'Unipartite' && isWeighted) {
      return [
        'Dual Adjacency Matrix',
        'Single Weighted Adjacency Matrix',
        isDirected ? 'Directed Weighted Edge List' : 'Weighted Edge List',
        'Standard JSON',
      ];
    }
    if (topology === 'Unipartite' && !isWeighted) {
      return ['Adjacency Matrix', isDirected ? 'Directed Edge List' : 'Edge List', 'Adjacency List', 'Standard JSON'];
    }
    return ['Standard JSON'];
  }, [topology, isWeighted, isDirected]);

  useEffect(() => {
    if (!availableFormats.includes(format)) {
      setFormat(availableFormats[0]);
    }
  }, [availableFormats, format]);

  const isFormatMatrix = ['Adjacency Matrix', 'Incidence Matrix', 'Single Weighted Adjacency Matrix', 'Single Adjacency Matrix'].includes(format);
  const isFormatEdgeList = ['Edge List', 'Weighted Edge List', 'Directed Edge List', 'Directed Weighted Edge List', 'Bipartite Edge List', 'Directed Bipartite Edge List'].includes(format);
  const isFormatDualMatrix = format === 'Dual Adjacency Matrix';
  const isFormatAdjList = format === 'Adjacency List';

  const isStep4Valid = () => {
    if (format === 'Standard JSON') return filesState.jsonFile !== null;
    if (isFormatDualMatrix) return filesState.countsFile !== null && filesState.percentagesFile !== null;
    if (isFormatMatrix) return filesState.singleMatrixFile !== null;
    if (isFormatEdgeList) return filesState.edgesFile !== null;
    if (isFormatAdjList) return filesState.adjListFile !== null;
    return false;
  };

  const handleParseAndReview = async () => {
    if (format === 'Standard JSON') {
      try {
        if (!filesState.jsonFile) throw new Error('No JSON file selected');
        applyParsedNetwork(await parseNetworkFiles([filesState.jsonFile]));
      } catch (err: any) {
        setError(err.message || 'Invalid JSON file.');
      }
      return;
    }

    setIsProcessing(true);
    setError(null);
    try {
      const dataParts: ParsedDataState[] = [];

      if (isFormatMatrix) {
        dataParts.push({ matrix: await parseCSVFile(filesState.singleMatrixFile!) });
      } else if (isFormatDualMatrix) {
        dataParts.push({
          counts: await parseCSVFile(filesState.countsFile!),
          percentages: await parseCSVFile(filesState.percentagesFile!),
        });
      } else if (isFormatEdgeList) {
        const edgeData = await parseCSVFile(filesState.edgesFile!);
        dataParts.push({ edges: edgeData });
        setMapping((prev) => {
          const next = { ...prev };
          if (edgeData[0]) {
            const headers = edgeData[0];
            next.sourceCol = headers.find((header: string) => /^(source|from|src|origin)$/i.test(header)) || headers[0] || '';
            next.targetCol = headers.find((header: string) => /^(target|to|dst|destination)$/i.test(header)) || headers[1] || '';
              next.weightRawCol = headers.find((header: string) => /^(weight_raw|raw_weight|absolute|count|weight)$/i.test(header)) || (isWeighted ? headers[2] || '' : '');
            next.weightSecCol = headers.find((header: string) => /^(weight_secondary|secondary_weight|conditional|percentage|percent|pct|log1p)$/i.test(header)) || '';
          }
          return next;
        });
        if (filesState.nodesFile) {
          const nodeData = await parseCSVFile(filesState.nodesFile);
          dataParts.push({ nodes: nodeData });
          setMapping((prev) => {
            const next = { ...prev };
            if (nodeData[0]) {
              const headers = nodeData[0];
              next.nodeIdCol = detectNodeIdColumn(headers);
              next.nodeLabelCol = detectNodeLabelColumn(headers);
              next.nodePartitionCol = topology === 'Bipartite' ? headers.find((header: string) => /^(partition|bipartite|set)$/i.test(header)) || '' : '';
              next.nodeCommunityCol = headers.find((header: string) => /^(community|group|cluster)$/i.test(header)) || '';
            }
            return next;
          });
        }
      } else if (isFormatAdjList) {
        const adjList = await parseCSVFile(filesState.adjListFile!);
        dataParts.push({ adjList });
        if (adjList.length > 0 && adjList[0]) {
          setMapping((prev) => ({ ...prev, adjSourceCol: adjList[0][0] || '' }));
        }
      }

      if (filesState.hasAdditionalAttributes) {
        if (!isFormatEdgeList && filesState.edgesFile) {
          const edgeData = await parseCSVFile(filesState.edgesFile);
          dataParts.push({ additionalEdges: edgeData });
          if (edgeData[0]) {
            const headers = edgeData[0];
            setMapping((prev) => ({
              ...prev,
              sourceCol: headers.find((header: string) => /^(source|from|src|origin)$/i.test(header)) || headers[0] || '',
              targetCol: headers.find((header: string) => /^(target|to|dst|destination)$/i.test(header)) || headers[1] || '',
              weightRawCol: headers.find((header: string) => /^(weight_raw|raw_weight|absolute|count|weight)$/i.test(header)) || '',
              weightSecCol: headers.find((header: string) => /^(weight_secondary|secondary_weight|conditional|percentage|percent|pct|log1p)$/i.test(header)) || '',
            }));
          }
        }
        if (filesState.nodesFile) {
          const nodeData = await parseCSVFile(filesState.nodesFile);
          dataParts.push({ nodes: nodeData });
          if (nodeData[0]) {
            const headers = nodeData[0];
            setMapping((prev) => ({
              ...prev,
              nodeIdCol: detectNodeIdColumn(headers),
              nodeLabelCol: detectNodeLabelColumn(headers),
              nodePartitionCol: topology === 'Bipartite' ? headers.find((header: string) => /^(partition|bipartite|set)$/i.test(header)) || '' : '',
              nodeCommunityCol: headers.find((header: string) => /(?:^|_)community$|^(group|cluster)$/i.test(header)) || '',
            }));
          }
        }
      }

      setParsedData(Object.assign({}, ...dataParts));
      setStep(5);
    } catch (e: any) {
      setError(e.message || 'Failed to parse files');
    } finally {
      setIsProcessing(false);
    }
  };

  const previewGraph = useMemo(() => {
    if (step < 5) return { nodes: [], edges: [] };
    return constructGraph(parsedData, format, mapping, isDirected, topology || 'Unipartite', isWeighted);
  }, [parsedData, format, step, mapping, isDirected, topology, isWeighted]);

  const handleFinalize = () => {
    setIsProcessing(true);
    resetCommunityColorCache();
    clearStore();
    const canonical = graphToRaw(graphFromRaw(previewGraph.nodes, previewGraph.edges, isDirected, topology === 'Bipartite'));
    setRawData(canonical.nodes, canonical.edges, isDirected, topology === 'Bipartite');
    const inferredCustomAttributes = [...inferCustomNodeAttributes(canonical.nodes), ...inferCustomEdgeAttributes(canonical.edges)];
    useStore.setState((state) => ({
      filters: {
        ...state.filters,
        customNodeAttribute: '',
        customNodeSizeAttribute: '',
        customEdgeAttribute: '',
        communityAttribute: '',
        nodeColorBase: 'uniform',
        edgeColorBase: 'uniform',
        edgeColorNodeMetric: '',
        edgeColorNodeTarget: 'source' as const,
      },
      customAttributes: inferredCustomAttributes,
    }));
    router.push('/workspace');
  };

  const applyParsedNetwork = (parsed: ParsedNetwork, restoreVisualization = Boolean(parsed.workspace)) => {
    const { nodes, edges } = graphToRaw(parsed.graph);
    const workspace = parsed.workspace;
    const inferredCustomAttributes = [...inferCustomNodeAttributes(nodes), ...inferCustomEdgeAttributes(edges)];
    resetCommunityColorCache();
    clearStore();
    const defaultFilters = useStore.getState().filters;
    const nextFilters = workspace?.filters ? {
      ...defaultFilters,
      ...workspace.filters,
      edgeFilter: migrateWorkspaceFilters(workspace.filters, edges),
      weightFilters: undefined,
      communityAttribute: '',
      nodeColorBase: workspace.filters.nodeColorBase === 'community' ? 'uniform' : workspace.filters.nodeColorBase,
    } : {
      ...defaultFilters,
      communityAttribute: '',
      nodeColorBase: 'uniform',
      edgeColorBase: 'uniform',
      edgeColorNodeMetric: '',
      edgeColorNodeTarget: 'source' as const,
    };
    useStore.setState({
      rawNodes: nodes,
      rawEdges: edges,
      directed: workspace?.graphMode.directed ?? parsed.directed,
      bipartite: workspace?.graphMode.bipartite ?? parsed.bipartite,
      importedMetrics: parsed.metrics,
      restoredVisualization: restoreVisualization,
      projectName: workspace?.projectName || parsed.projectName || networkFiles[0]?.name.replace(/\.[^.]+$/, '') || 'NEW_PROJECT_NAME',
      computeEngine: migrateComputationPreference(workspace, nodes.length, edges.length),
      rendererEngine: workspace ? migrateRendererPreference(workspace) : useStore.getState().rendererEngine,
      filters: nextFilters,
      isDarkMode: workspace?.appearance.isDarkMode ?? useStore.getState().isDarkMode,
      showNodeLabels: workspace?.appearance.showNodeLabels ?? false,
      showArrowheads: workspace?.appearance.showArrowheads ?? false,
      communityMap: workspace?.appearance.communityMap || {},
      legendColorOverrides: workspace?.appearance.legendColorOverrides || {},
      customAttributes: mergeCustomAttributeMetadata(
        inferredCustomAttributes,
        (workspace?.appearance.customAttributes || parsed.metrics?.metadata?.attributeDescriptors)?.map((attribute: any) => ({ ...attribute, drivesCommunity: false })),
      ),
      hiddenLegendItems: workspace?.visibility.hiddenLegendItems || [],
      isolatedLegendItem: workspace?.visibility.isolatedLegendItem || null,
      isolatedCommunityId: workspace?.visibility.isolatedCommunityId || null,
    });
    router.push('/workspace');
  };

  const handleUnifiedImport = async () => {
    setNetworkImporting(true);
    setError(null);
    try {
      applyParsedNetwork(await parseNetworkFiles(networkFiles));
    } catch (importError: any) {
      setError(importError.message || 'Unable to import network.');
    } finally {
      setNetworkImporting(false);
    }
  };

  const handleRandomGraph = async () => {
    setNetworkImporting(true);
    setError(null);
    try {
      const maximumEdges = Math.max(0, randomOptions.order * (randomOptions.order - 1) / 2);
      if (randomOptions.size > maximumEdges) throw new Error(`A simple undirected graph with ${randomOptions.order} nodes supports at most ${maximumEdges} edges.`);
      const state = useStore.getState();
      const workspace: WorkspaceSettingsDocument = {
        format: 'workspace-settings',
        version: 1,
        projectName: 'RANDOM_CLUSTER_GRAPH',
        computeEngine: state.computeEngine,
        rendererEngine: state.rendererEngine,
        graphMode: { directed: false, bipartite: false, weighted: false },
        filters: state.filters,
        appearance: {
          isDarkMode: state.isDarkMode,
          showNodeLabels: state.showNodeLabels,
          showArrowheads: state.showArrowheads,
          communityMap: {},
          customAttributes: [],
          legendColorOverrides: {},
        },
        visibility: { hiddenLegendItems: [], isolatedLegendItem: null, isolatedCommunityId: null },
        calculations: { selected: {} },
        layout: { livePhysics: state.filters.livePhysics, forceStrength: state.filters.forceStrength },
      };
      const document = createRandomClusterAllInOne(randomOptions, workspace);
      const file = new File([JSON.stringify(document)], 'random-cluster.network.json', { type: 'application/json' });
      applyParsedNetwork(await parseNetworkFiles([file]), false);
    } catch (generationError: any) {
      setError(generationError.message || 'Unable to create random graph.');
    } finally {
      setNetworkImporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {!topology && <UnifiedNetworkImportCard isDarkMode={isDarkMode} files={networkFiles} importing={networkImporting} onFilesChange={setNetworkFiles} onImport={handleUnifiedImport} />}
      {!topology && <RandomGraphCard isDarkMode={isDarkMode} options={randomOptions} generating={networkImporting} onChange={setRandomOptions} onGenerate={handleRandomGraph} />}

      <div
      className={`order-1 w-full max-w-4xl mx-auto mt-12 overflow-hidden mb-12 flex flex-col transition-colors ${
        isDarkMode
          ? 'bg-[#141414] border border-[#333] shadow-[4px_4px_0_0_#333] text-[#E4E3E0]'
          : 'bg-white border border-[#141414] shadow-[4px_4px_0_0_#141414] text-[#141414]'
      }`}
      >
      <div
        className={`p-6 transition-colors ${
          isDarkMode ? 'border-b border-[#333] bg-[#000]' : 'border-b border-[#141414] bg-[#E4E3E0]'
        }`}
      >
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-black tracking-tighter uppercase">Smart Upload Wizard</h2>
        </div>

        {/* Breadcrumb Header */}
        <div className="flex gap-2 text-[10px] font-mono font-bold uppercase tracking-widest overflow-x-auto pb-2">
          {['1. Topology', '2. Weights', '3. Direction', '4. Format', '5. Map'].map((b, i) => {
            const s = i + 1;
            return (
              <button
                key={s}
                onClick={() => {
                  if (s < step) setStep(s);
                }}
                disabled={s >= step}
                className={`whitespace-nowrap transition-all ${
                  step === s
                    ? 'text-[#141414]'
                    : s < step
                    ? 'text-[#141414]/60 hover:text-[#141414] cursor-pointer'
                    : 'text-[#141414]/30'
                }`}
              >
                {b}
                {i < 4 ? <span className="mx-2 opacity-30">&gt;</span> : ''}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-8">
        {error && (
          <div className="mb-6 bg-white border border-red-600 p-4 text-[10px] font-mono font-bold uppercase text-red-600">
            ERR: {error}
          </div>
        )}

        {step === 1 && (
          <StepTopology
            isDarkMode={isDarkMode}
            topology={topology}
            setTopology={setTopology}
            onNext={() => setStep(2)}
          />
        )}

        {step === 2 && (
          <StepWeights
            isDarkMode={isDarkMode}
            isWeighted={isWeighted}
            setIsWeighted={setIsWeighted}
            onNext={() => setStep(3)}
            onBack={() => {
              setTopology(null);
              setStep(1);
            }}
          />
        )}

        {step === 3 && (
          <StepDirection
            isDarkMode={isDarkMode}
            isDirected={isDirected}
            setIsDirected={setIsDirected}
            onNext={() => setStep(4)}
            onBack={() => setStep(2)}
          />
        )}

        {step === 4 && (
          <StepFileFormat
            isDarkMode={isDarkMode}
            format={format}
            setFormat={setFormat}
            availableFormats={availableFormats}
            filesState={filesState}
            setFilesState={setFilesState}
            isProcessing={isProcessing}
            isValid={isStep4Valid()}
            onParseAndReview={handleParseAndReview}
            onBack={() => setStep(3)}
          />
        )}

        {step === 5 && (
          <StepDataMapping
            isDarkMode={isDarkMode}
            format={format}
            parsedData={parsedData}
            mapping={mapping}
            setMapping={setMapping}
            previewGraph={previewGraph}
            isDirected={isDirected}
            topology={topology || 'Unipartite'}
            isWeighted={isWeighted}
            onFinalize={handleFinalize}
            onBack={() => setStep(4)}
          />
        )}
      </div>
      </div>
    </div>
  );
}
