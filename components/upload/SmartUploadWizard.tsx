'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { TopologyType, WizardFilesState, ColumnMappingState, ParsedDataState } from './types';
import { parseCSVFile, parseJSONFile } from './utils/parseHelpers';
import { constructGraph } from './utils/graphConstructors';

import { StepTopology } from './steps/StepTopology';
import { StepWeights } from './steps/StepWeights';
import { StepDirection } from './steps/StepDirection';
import { StepFileFormat } from './steps/StepFileFormat';
import { StepDataMapping } from './steps/StepDataMapping';

export default function SmartUploadWizard() {
  const router = useRouter();
  const setRawData = useStore((state) => state.setRawData);
  const clearStore = useStore((state) => state.clearStore);
  const isDarkMode = useStore((state) => state.isDarkMode);

  // Cascade UI State
  const [step, setStep] = useState(1);
  const [topology, setTopology] = useState<TopologyType>('Unipartite');
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
    nodeTypeCol: '',
    nodeCommunityCol: '',
    nodeAbundCol: '',
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

  if (!availableFormats.includes(format)) {
    setFormat(availableFormats[0]);
  }

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
        const { rawNodes, rawEdges, jsonNodesData, jsonEdgesData } = await parseJSONFile(filesState.jsonFile);

        setMapping((prev) => {
          const next = { ...prev };
          if (jsonEdgesData.length > 0) {
            const headers = jsonEdgesData[0];
            next.sourceCol = headers.find((h: string) => /source/i.test(h)) || headers[0] || '';
            next.targetCol = headers.find((h: string) => /target/i.test(h)) || headers[1] || '';
            next.weightRawCol = headers.find((h: string) => /weight/i.test(h)) || headers[2] || '';
            next.weightSecCol = headers.find((h: string) => /secondary/i.test(h)) || headers[3] || '';
          }
          if (jsonNodesData.length > 0) {
            const headers = jsonNodesData[0];
            next.nodeIdCol = headers.find((h: string) => /id/i.test(h)) || headers[0] || '';
            next.nodeLabelCol = headers.find((h: string) => /name|label/i.test(h)) || headers[1] || '';
            next.nodeAbundCol = headers.find((h: string) => /size|abund|weight/i.test(h)) || headers[2] || '';
            next.nodeTypeCol = headers.find((h: string) => /type/i.test(h)) || headers[3] || '';
            next.nodeCommunityCol = headers.find((h: string) => /group|community/i.test(h)) || headers[4] || '';
          }
          return next;
        });

        setParsedData({ jsonNodes: jsonNodesData, jsonEdges: jsonEdgesData, rawNodes, rawEdges });
        setStep(5);
      } catch (err: any) {
        setError(err.message || 'Invalid JSON file.');
      }
      return;
    }

    setIsProcessing(true);
    setError(null);
    try {
      const data: ParsedDataState = {};

      if (isFormatMatrix) {
        data.matrix = await parseCSVFile(filesState.singleMatrixFile!);
      } else if (isFormatDualMatrix) {
        data.counts = await parseCSVFile(filesState.countsFile!);
        data.percentages = await parseCSVFile(filesState.percentagesFile!);
      } else if (isFormatEdgeList) {
        const edgeData = await parseCSVFile(filesState.edgesFile!);
        data.edges = edgeData;
        setMapping((prev) => {
          const next = { ...prev };
          if (edgeData[0]) {
            next.sourceCol = edgeData[0][0] || '';
            next.targetCol = edgeData[0][1] || '';
            next.weightRawCol = edgeData[0][2] || '';
            next.weightSecCol = edgeData[0][3] || '';
          }
          return next;
        });
        if (filesState.nodesFile) {
          const nodeData = await parseCSVFile(filesState.nodesFile);
          data.nodes = nodeData;
          setMapping((prev) => {
            const next = { ...prev };
            if (nodeData[0]) {
              next.nodeIdCol = nodeData[0][0] || '';
              next.nodeLabelCol = nodeData[0][1] || '';
              next.nodeAbundCol = nodeData[0][2] || '';
              next.nodeTypeCol = nodeData[0][3] || '';
              next.nodeCommunityCol = nodeData[0][4] || '';
            }
            return next;
          });
        }
      } else if (isFormatAdjList) {
        data.adjList = await parseCSVFile(filesState.adjListFile!);
        if (data.adjList.length > 0 && data.adjList[0]) {
          setMapping((prev) => ({ ...prev, adjSourceCol: data.adjList![0][0] || '' }));
        }
      }

      if (filesState.hasAdditionalAttributes) {
        if (!isFormatEdgeList && filesState.edgesFile) {
          const edgeData = await parseCSVFile(filesState.edgesFile);
          data.additionalEdges = edgeData;
          if (edgeData[0]) {
            setMapping((prev) => ({
              ...prev,
              sourceCol: edgeData[0][0] || '',
              targetCol: edgeData[0][1] || '',
              weightRawCol: edgeData[0][2] || '',
              weightSecCol: edgeData[0][3] || '',
            }));
          }
        }
        if (filesState.nodesFile) {
          const nodeData = await parseCSVFile(filesState.nodesFile);
          data.nodes = nodeData;
          if (nodeData[0]) {
            setMapping((prev) => ({
              ...prev,
              nodeIdCol: nodeData[0][0] || '',
              nodeLabelCol: nodeData[0][1] || '',
              nodeAbundCol: nodeData[0][2] || '',
              nodeTypeCol: nodeData[0][3] || '',
              nodeCommunityCol: nodeData[0][4] || '',
            }));
          }
        }
      }

      setParsedData(data);
      setStep(5);
    } catch (e: any) {
      setError(e.message || 'Failed to parse files');
    } finally {
      setIsProcessing(false);
    }
  };

  const previewGraph = useMemo(() => {
    if (step < 5) return { nodes: [], edges: [] };
    return constructGraph(parsedData, format, mapping, isDirected, topology, isWeighted);
  }, [parsedData, format, step, mapping, isDirected, topology, isWeighted]);

  const handleFinalize = () => {
    clearStore();
    setRawData(previewGraph.nodes, previewGraph.edges, isDirected, topology === 'Bipartite');
    router.push('/workspace');
  };

  return (
    <div
      className={`max-w-4xl mx-auto mt-12 overflow-hidden mb-12 flex flex-col transition-colors ${
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
            onBack={() => setStep(1)}
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
            topology={topology}
            isWeighted={isWeighted}
            onFinalize={handleFinalize}
            onBack={() => setStep(4)}
          />
        )}
      </div>
    </div>
  );
}
