'use client';

/* eslint-disable react-hooks/set-state-in-effect */

import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useStore, RawNode, RawEdge } from '@/store/useStore';
import * as d3 from 'd3';
import { resetCommunityColorCache } from '@/lib/communityUtils';
import { Download } from 'lucide-react';
import { exportSvg, exportImage, downloadBlobAsFile, downloadStringAsFile } from '@/lib/exportUtils';
import type Sigma from 'sigma';
import {
  buildAllInOne,
  buildCsvZip,
  canonicalExportGraph,
  createMetricsBundle,
  writeGexf,
  writeGraphML,
  type WorkspaceSettingsDocument,
} from '@/lib/graphIO';
import { 
  computeMaxRelWeight, 
  computeMaxRawWeight,
} from '@/lib/workspaceUtils';
import { useGraphFilters } from '@/hooks/useGraphFilters';
import { useGraphMetrics } from '@/hooks/useGraphMetrics';
import { useDataTableSort } from '@/hooks/useDataTableSort';
import { useGraphStyles } from '@/hooks/useGraphStyles';
import { useSharedGraph } from '@/hooks/useSharedGraph';
import { useSharedPhysics } from '@/hooks/useSharedPhysics';

// Dynamically import D3Graph & SigmaGraph so they only run on the client due to canvas/SVG dependencies
const D3Graph = dynamic(() => import('./D3Graph'), { ssr: false });
const SigmaGraph = dynamic(() => import('./graph/SigmaGraph'), { ssr: false });

import { WorkspaceSidebar } from "@/components/workspace/WorkspaceSidebar";
import { WorkspaceDataTable } from "@/components/workspace/WorkspaceDataTable";

interface GraphFocusRequest {
  id: string;
  type: 'node' | 'edge';
  requestId: number;
  source?: string;
  target?: string;
}

export default function Workspace() {
  const { rawNodes, rawEdges, filters, communityMap, customAttributes, directed, bipartite, isDarkMode, selectedElement, setSelectedElement, projectName, rendererEngine, setRendererEngine } = useStore();

  const {
    appliedFilters,
    setAppliedFilters,
    validNodes,
    validEdges,
    hasType,
    hasAbundance,
    hasSecondaryWeight
  } = useGraphFilters();

  const [isSwitchingRenderer, setIsSwitchingRenderer] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const useSigma = rendererEngine === 'sigma' || (rendererEngine === 'auto' && (validNodes.length >= 1000 || validEdges.length >= 3000));
  const topologyKey = useMemo(
    () => `${directed ? 'd' : 'u'}:${validNodes.map((node) => node.id).join('\u001f')}:${validEdges.map((edge) => `${edge.source}\u001e${edge.target}`).join('\u001f')}`,
    [directed, validNodes, validEdges]
  );

  const handleSwitchRenderer = useCallback((engine: 'd3' | 'sigma') => {
    if (rendererEngine === engine) return;
    setIsSwitchingRenderer(true);
    setRendererEngine(engine);
    setTimeout(() => {
      setIsSwitchingRenderer(false);
    }, 200);
  }, [rendererEngine, setRendererEngine]);

  const {
    networkMetrics,
    nodeMetrics,
    modularity,
    metricsToRun,
    setMetricsToRun,
    metricsLoading,
    runSelectedMetrics
  } = useGraphMetrics(validNodes, validEdges, appliedFilters, rawNodes);

  const {
    searchQuery,
    sortConfig,
    setSortConfig,
    tableData,
    tableDataEdges
  } = useDataTableSort(validNodes, validEdges, networkMetrics, nodeMetrics);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<"graph" | "data">("graph");
  const [dataTab, setDataTab] = useState<"nodes" | "edges">("nodes");
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [graphFocusRequest, setGraphFocusRequest] = useState<GraphFocusRequest | null>(null);
  const graphFocusRequestIdRef = useRef(0);
  const sigmaRendererRef = useRef<Sigma | null>(null);

  const clickedNodeRef = useRef<RawNode | null>(null);
  const clickedEdgeRef = useRef<RawEdge | null>(null);

  const {
    getNodeColor,
    getEdgeColor,
    getEdgeOpacity,
    getShouldShowArrowhead,
  } = useGraphStyles({
    nodes: validNodes,
    edges: validEdges,
    communityMap,
    networkMetrics,
    nodeColorBase: appliedFilters.nodeColorBase || 'custom',
    uniformNodeColor: appliedFilters.uniformNodeColor || '#cccccc',
    uniformEdgeColor: appliedFilters.uniformEdgeColor || (isDarkMode ? '#888888' : '#333333'),
    edgeWeightBase: appliedFilters.edgeWeightBase || 'weight_raw',
    edgeColorBase: appliedFilters.edgeColorBase || 'uniform',
    edgeColorNodeMetric: appliedFilters.edgeColorNodeMetric || 'custom',
    edgeColorNodeTarget: appliedFilters.edgeColorNodeTarget || 'source',
    nodeOpacity: appliedFilters.nodeOpacity ?? 1,
    edgeOpacity: appliedFilters.edgeOpacity ?? 0.3,
    edgeOpacityBase: appliedFilters.edgeOpacityBase || 'uniform',
    directed,
    bipartite,
    isDarkMode,
    searchQuery: '',
    selectedElement,
    showArrowheads: true,
    isolatedLegendItem: null,
    clickedNodeRef,
    clickedEdgeRef,
  });

  const degreeMap = useMemo(() => {
    const map: Record<string, number> = {};
    validEdges.forEach((e) => {
      map[e.source] = (map[e.source] || 0) + 1;
      map[e.target] = (map[e.target] || 0) + 1;
    });
    return map;
  }, [validEdges]);

  const maxRelWeight = useMemo(() => computeMaxRelWeight(rawEdges), [rawEdges]);
  const maxRawWeight = useMemo(() => computeMaxRawWeight(rawEdges), [rawEdges]);
  const selectedCustomAttribute = customAttributes.find((attribute) => attribute.scope === 'node' && attribute.name === appliedFilters.customNodeAttribute);
  const customSizeDomain = useMemo(() => {
    if (!selectedCustomAttribute || !['discrete', 'continuous'].includes(selectedCustomAttribute.selectedType)) return null;
    const values = validNodes.map((node) => Number(node[selectedCustomAttribute.name])).filter(Number.isFinite);
    return values.length ? [Math.min(...values), Math.max(...values)] as const : null;
  }, [selectedCustomAttribute, validNodes]);

  const getNodeSize = useCallback(
    (node: RawNode) => {
      let baseVal = 10;
      const base = appliedFilters.nodeSizeBase || 'abundance';
      if (base === 'uniform') baseVal = 5;
      else if (base === 'abundance') baseVal = node.abundance ?? 10;
      else if (base === 'degree') baseVal = (degreeMap[node.id] || 0) * 5;
      else if (base === 'custom' && selectedCustomAttribute && customSizeDomain) {
        const value = Number(node[selectedCustomAttribute.name]);
        const [min, max] = customSizeDomain;
        if (Number.isFinite(value)) baseVal = max === min ? 5 : 1 + ((value - min) / (max - min)) * 9;
      }

      const isSecondary = bipartite && (Number(node.partitionIndex) === 1 || node.partition === 'B' || node.partition === 1 || node.type === 'B' || node.type === 'secondary' || node.group === 1 || (node as any).bipartite === 1);
      const mult = isSecondary ? (appliedFilters.bipartiteNodeSize || 2) : (appliedFilters.nodeSize || 3);

      return mult * Math.max(Math.log(baseVal + 2), 1) + 2;
    },
    [appliedFilters.nodeSizeBase, appliedFilters.bipartiteNodeSize, appliedFilters.nodeSize, bipartite, degreeMap, selectedCustomAttribute, customSizeDomain]
  );

  const getEdgeSize = useCallback(
    (edge: RawEdge) => {
      let baseWidth = 2;
      const base = appliedFilters.edgeWeightBase || 'weight_raw';
      if (base === 'weight_raw') {
        const scale = d3.scaleLinear().domain([0, maxRawWeight]).range([1, 6]);
        baseWidth = scale(Number(edge.weight_raw) || 0);
      } else if (base === 'weight_secondary') {
        const scale = d3.scaleLinear().domain([0, maxRelWeight]).range([1, 6]);
        baseWidth = scale(Number(edge.weight_secondary) || 0);
      }
      return Math.max(0.5, baseWidth * (appliedFilters.edgeWeight || 1));
    },
    [appliedFilters.edgeWeightBase, appliedFilters.edgeWeight, maxRawWeight, maxRelWeight]
  );

  // Unified persistent Graphology instance (using D3 static layout pre-rendering)
  const { graph, isReady, runRefreshLayout } = useSharedGraph({
    nodes: validNodes,
    edges: validEdges,
    directed,
    bipartite,
    forceStrength: appliedFilters.forceStrength || -100,
    isDarkMode,
    getNodeColor,
    getNodeSize,
    getEdgeColor,
    getEdgeSize,
    getEdgeOpacity,
    getShouldShowArrowhead,
    nodeOpacity: appliedFilters.nodeOpacity ?? 1,
  });

  // Unified live D3-force simulation controller
  const {
    registerD3TickListener,
    beginDrag,
    movePinnedNode,
    endDrag,
    d3NodesRef,
    d3LinksRef,
    d3NodesMapRef,
  } = useSharedPhysics({
    graph,
    topologyKey,
    livePhysics: appliedFilters.livePhysics,
    forceStrength: appliedFilters.forceStrength || -100,
    activeRenderer: useSigma ? 'sigma' : 'd3',
  });

  const handleRefresh = useCallback(() => {
    setIsSwitchingRenderer(true);
    runRefreshLayout();
    setRefreshKey((k) => k + 1);
    runSelectedMetrics();
    setTimeout(() => {
      setIsSwitchingRenderer(false);
    }, 250);
  }, [runRefreshLayout, runSelectedMetrics]);

  const handleImportWorkspace = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const isCurrentSettings = json.format === 'workspace-settings' && json.version === 1;
        const isLegacySettings = json.type === 'workspace_state';
        if (!isCurrentSettings && !isLegacySettings) throw new Error('Invalid Workspace Settings JSON.');

        resetCommunityColorCache();
        const settings: any = isCurrentSettings ? json as WorkspaceSettingsDocument : {
          projectName: json.projectName,
          rendererEngine: json.rendererEngine || json.renderer,
          graphMode: { directed: json.directed, bipartite: json.bipartite },
          filters: json.filters,
          appearance: {
            isDarkMode: json.isDarkMode,
            showNodeLabels: json.showNodeLabels,
            showArrowheads: json.showArrowheads,
            communityMap: json.communityMap,
            customAttributes: json.customAttributes,
          },
          visibility: {},
          calculations: { selected: {} },
        };
        const nextFilters = settings.filters || useStore.getState().filters;
        useStore.setState({
          projectName: settings.projectName || projectName,
          directed: settings.graphMode?.directed ?? directed,
          bipartite: settings.graphMode?.bipartite ?? bipartite,
          isDarkMode: settings.appearance?.isDarkMode ?? useStore.getState().isDarkMode,
          rendererEngine: settings.rendererEngine || 'auto',
          filters: nextFilters,
          communityMap: settings.appearance?.communityMap || {},
          customAttributes: settings.appearance?.customAttributes || useStore.getState().customAttributes,
          showNodeLabels: settings.appearance?.showNodeLabels ?? useStore.getState().showNodeLabels,
          showArrowheads: settings.appearance?.showArrowheads ?? useStore.getState().showArrowheads,
          hiddenLegendItems: settings.visibility?.hiddenLegendItems || [],
          isolatedLegendItem: settings.visibility?.isolatedLegendItem || null,
          isolatedCommunityId: settings.visibility?.isolatedCommunityId || null,
        });
        setAppliedFilters(nextFilters);
        setMetricsToRun((current: any) => ({ ...current, ...(settings.calculations?.selected || {}) }));
        setRefreshKey((key) => key + 1);
      } catch (err: any) {
        alert('Failed to import workspace: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  useEffect(() => {
    setIsSwitchingRenderer(true);
    const timer = setTimeout(() => {
      setIsSwitchingRenderer(false);
    }, 200);
    return () => clearTimeout(timer);
  }, [rendererEngine]);

  const handleElementDoubleClick = (
    id: string,
    type: "node" | "edge",
    endpoints?: { source: string; target: string }
  ) => {
    setSelectedElement(id);
    if (activeTab === "data") {
      graphFocusRequestIdRef.current += 1;
      setGraphFocusRequest({
        id,
        type,
        requestId: graphFocusRequestIdRef.current,
        source: endpoints?.source,
        target: endpoints?.target,
      });
      setActiveTab("graph");
    } else {
      setActiveTab("data");
      setDataTab(type + "s" as any);
    }
  };

  const { removedNodesString, removedNodesCount } = useMemo(() => {
    const visibleNodeIds = new Set(validNodes.map(n => n.id));
    const removedNodesList = rawNodes
      .filter(n => !visibleNodeIds.has(n.id))
      .map(n => n.name || n.id);
    return {
      removedNodesString: removedNodesList.join(', '),
      removedNodesCount: removedNodesList.length
    };
  }, [rawNodes, validNodes]);

  const createWorkspaceSettings = (): WorkspaceSettingsDocument => {
    const state = useStore.getState();
    return {
      format: 'workspace-settings',
      version: 1,
      projectName,
      rendererEngine,
      graphMode: {
        directed,
        bipartite,
        weighted: rawEdges.some((edge) => Number(edge.weight_raw) !== 1 || Number(edge.weight_secondary) !== 1),
      },
      filters: state.filters,
      appearance: {
        isDarkMode,
        showNodeLabels: state.showNodeLabels,
        showArrowheads: state.showArrowheads,
        communityMap,
        customAttributes: state.customAttributes,
      },
      visibility: {
        hiddenLegendItems: state.hiddenLegendItems,
        isolatedLegendItem: state.isolatedLegendItem,
        isolatedCommunityId: state.isolatedCommunityId,
      },
      calculations: { selected: metricsToRun },
      layout: { livePhysics: state.filters.livePhysics, forceStrength: state.filters.forceStrength },
    };
  };

  const handleExport = async (format: string) => {
    setShowExportMenu(false);
    if (format === 'svg') {
      exportSvg(document.getElementById('network-graph-svg') as SVGSVGElement | null, `${projectName}.svg`);
      return;
    }
    if (format === 'png' || format === 'jpeg') {
      if (useSigma && sigmaRendererRef.current) {
        try {
          const { toBlob: exportSigmaImageBlob } = await import('@sigma/export-image');
          const blob = await exportSigmaImageBlob(sigmaRendererRef.current, {
            format,
            fileName: projectName,
            backgroundColor: isDarkMode ? '#141414' : '#ffffff',
          });
          downloadBlobAsFile(blob, `${projectName}.${format === 'jpeg' ? 'jpg' : 'png'}`);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error('Sigma image export failed:', error);
          window.alert(`Sigma image export failed: ${message}`);
        }
      } else {
        exportImage(document.getElementById('network-graph-svg') as SVGSVGElement | null, format, `${projectName}.${format === 'jpeg' ? 'jpg' : 'png'}`, isDarkMode);
      }
      return;
    }

    const metrics = createMetricsBundle(
      networkMetrics,
      nodeMetrics,
      tableDataEdges,
      { modularity },
      { selectedMetrics: metricsToRun },
    );
    const exportGraph = canonicalExportGraph(graph, rawNodes, rawEdges, metrics, directed, bipartite);
    if (format === 'json') downloadStringAsFile(JSON.stringify(exportGraph.export(), null, 2), `${projectName}.json`, 'application/json');
    else if (format === 'graphml') downloadStringAsFile(writeGraphML(exportGraph), `${projectName}.graphml`, 'application/graphml+xml');
    else if (format === 'gexf') downloadStringAsFile(writeGexf(exportGraph), `${projectName}.gexf`, 'application/gexf+xml');
    else if (format === 'csvzip') downloadBlobAsFile(await buildCsvZip(exportGraph, metrics), `${projectName}_network.zip`);
    else if (format === 'settings') downloadStringAsFile(JSON.stringify(createWorkspaceSettings(), null, 2), `${projectName}_workspace_settings.json`, 'application/json');
    else if (format === 'allinone') downloadStringAsFile(JSON.stringify(buildAllInOne(exportGraph, metrics, createWorkspaceSettings()), null, 2), `${projectName}_all_in_one.json`, 'application/json');
  };

  const handleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  return (
    <div className={`flex flex-1 overflow-hidden h-full w-full transition-colors ${isDarkMode ? 'bg-[#141414] text-[#E4E3E0]' : 'bg-[#E4E3E0] text-[#141414]'}`}>
      {/* SIDEBAR CONTROL PANEL */}
      
      <WorkspaceSidebar 
        networkMetrics={networkMetrics}
        isSidebarCollapsed={isSidebarCollapsed}
        setIsSidebarCollapsed={setIsSidebarCollapsed}
        handleImportWorkspace={handleImportWorkspace}
        metricsToRun={metricsToRun}
        setMetricsToRun={setMetricsToRun}
        runSelectedMetrics={runSelectedMetrics}
        metricsLoading={metricsLoading}
        maxRelWeight={maxRelWeight}
        maxRawWeight={maxRawWeight}
        hasType={hasType}
        hasAbundance={hasAbundance}
        hasSecondaryWeight={hasSecondaryWeight}
        validNodes={validNodes}
        rawNodes={rawNodes}
        validEdges={validEdges}
        rawEdges={rawEdges}
        removedNodesString={removedNodesString}
        removedNodesCount={removedNodesCount}
        setAppliedFilters={setAppliedFilters}
      />

      {/* MAIN VIEWPORT */}
      <section className={`flex-1 relative overflow-hidden h-full flex flex-col transition-colors ${isDarkMode ? "bg-[#000]" : "bg-white"}`}>
        {/* Top Navigation Bar */}
        <div className={`flex items-center justify-between px-6 py-3 border-b z-50 ${isDarkMode ? "bg-[#222] border-[#444]" : "bg-[#f0f0f0] border-[#ccc]"}`}>
          <div className="flex text-[10px] uppercase font-bold tracking-widest bg-white dark:bg-[#141414] border border-[#141414] dark:border-[#333] shadow-sm">
            <button 
              className={`px-6 py-2 transition-colors ${activeTab === "graph" ? (isDarkMode ? "bg-[#333] text-white" : "bg-[#141414] text-white") : (isDarkMode ? "text-[#888] hover:bg-[#222]" : "text-[#888] hover:bg-[#f5f5f5]")}`}
              onClick={() => setActiveTab("graph")}
            >
              Graph
            </button>
            <button 
              className={`px-6 py-2 transition-colors border-l border-[#141414] dark:border-[#333] ${activeTab === "data" ? (isDarkMode ? "bg-[#333] text-white" : "bg-[#141414] text-white") : (isDarkMode ? "text-[#888] hover:bg-[#222]" : "text-[#888] hover:bg-[#f5f5f5]")}`}
              onClick={() => setActiveTab("data")}
            >
              Data
            </button>
          </div>
          
          <div className="flex items-center space-x-6">
            {activeTab === "data" && (
              <>
                {typeof modularity === "number" && !isNaN(modularity) && (
                  <div className="flex items-center space-x-2 text-[10px] font-bold uppercase tracking-widest mr-4">
                    <span className="opacity-60">Modularity (Q):</span>
                    <span className={`font-mono px-2 py-1 rounded ${isDarkMode ? "bg-white/10" : "bg-black/5"}`}>
                      {modularity.toFixed(4)}
                    </span>
                  </div>
                )}
                <div className="flex text-[10px] uppercase font-bold tracking-widest bg-white dark:bg-[#141414] border border-[#141414] dark:border-[#333] shadow-sm">
                  <button 
                    className={`px-4 py-2 transition-colors ${dataTab === "nodes" ? (isDarkMode ? "bg-[#333] text-white" : "bg-[#141414] text-white") : (isDarkMode ? "text-[#888] hover:bg-[#222]" : "text-[#888] hover:bg-[#f5f5f5]")}`}
                    onClick={() => setDataTab("nodes")}
                  >
                    Nodes
                  </button>
                  <button 
                    className={`px-4 py-2 transition-colors border-l border-[#141414] dark:border-[#333] ${dataTab === "edges" ? (isDarkMode ? "bg-[#333] text-white" : "bg-[#141414] text-white") : (isDarkMode ? "text-[#888] hover:bg-[#222]" : "text-[#888] hover:bg-[#f5f5f5]")}`}
                    onClick={() => setDataTab("edges")}
                  >
                    Edges
                  </button>
                </div>
              </>
            )}
            
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className={`flex items-center space-x-2 px-4 py-2 border text-[10px] uppercase font-bold tracking-widest transition-colors shadow-sm ${isDarkMode ? "bg-[#141414] border-[#333] text-[#E4E3E0] hover:bg-[#333]" : "bg-white border-[#141414] text-[#141414] hover:bg-black/5"}`}
              >
                <Download size={14} />
                <span>Export</span>
              </button>
              
              {showExportMenu && (
                <div 
                  className={`absolute right-0 mt-2 w-48 border shadow-lg z-50 flex flex-col text-[10px] uppercase font-bold tracking-widest ${isDarkMode ? 'bg-[#141414] border-[#333]' : 'bg-white border-[#ccc]'}`}
                  onMouseLeave={() => setShowExportMenu(false)}
                >
                  {!useSigma && <button onClick={() => handleExport('svg')} className={`text-left px-4 py-3 hover:opacity-100 transition-opacity opacity-70 ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}>Export as SVG</button>}
                  <button onClick={() => handleExport('png')} className={`text-left px-4 py-3 hover:opacity-100 transition-opacity opacity-70 ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}>Export as PNG</button>
                  <button onClick={() => handleExport('jpeg')} className={`text-left px-4 py-3 hover:opacity-100 transition-opacity opacity-70 ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}>Export as JPG</button>
                  <div className={`h-px w-full ${isDarkMode ? 'bg-[#333]' : 'bg-[#eee]'}`}></div>
                  <button onClick={() => handleExport('json')} className={`text-left px-4 py-3 hover:opacity-100 transition-opacity opacity-70 ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}>Graphology JSON</button>
                  <button onClick={() => handleExport('graphml')} className={`text-left px-4 py-3 hover:opacity-100 transition-opacity opacity-70 ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}>GraphML</button>
                  <button onClick={() => handleExport('gexf')} className={`text-left px-4 py-3 hover:opacity-100 transition-opacity opacity-70 ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}>GEXF</button>
                  <button onClick={() => handleExport('csvzip')} className={`text-left px-4 py-3 hover:opacity-100 transition-opacity opacity-70 ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}>Node + Edge CSV ZIP</button>
                  <div className={`h-px w-full ${isDarkMode ? 'bg-[#333]' : 'bg-[#eee]'}`}></div>
                  <button onClick={() => handleExport('settings')} className={`text-left px-4 py-3 hover:opacity-100 transition-opacity opacity-70 ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}>Workspace Settings JSON</button>
                  <button onClick={() => handleExport('allinone')} className={`text-left px-4 py-3 hover:opacity-100 transition-opacity opacity-70 ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}>All-in-One JSON</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {validNodes.length > 0 ? (
          <>
            <div className={`flex-1 w-full h-full relative ${activeTab === "graph" ? "block" : "hidden"}`}>
              {isSwitchingRenderer && (
                <div className={`absolute inset-0 z-50 flex items-center justify-center font-mono text-xs font-bold uppercase tracking-widest ${isDarkMode ? 'bg-black/80 text-white' : 'bg-white/80 text-black'}`}>
                  <span>Switching Renderer Engine...</span>
                </div>
              )}
              {useSigma ? (
                <SigmaGraph 
                  graph={graph}
                  isReady={isReady}
                  nodes={validNodes} 
                  edges={validEdges} 
                  communityMap={communityMap}
                  networkMetrics={networkMetrics}
                  nodeSizeMult={appliedFilters.nodeSize || 3}
                  bipartiteNodeSizeMult={appliedFilters.bipartiteNodeSize || 2}
                  nodeSizeBase={appliedFilters.nodeSizeBase || "abundance"}
                  nodeColorBase={appliedFilters.nodeColorBase || "custom"}
                  uniformNodeColor={appliedFilters.uniformNodeColor || "#cccccc"}
                  uniformEdgeColor={appliedFilters.uniformEdgeColor || (isDarkMode ? "#888888" : "#333333")}
                  edgeWeightMult={appliedFilters.edgeWeight || 1}
                  edgeWeightBase={appliedFilters.edgeWeightBase || "weight_raw"}
                  edgeColorBase={appliedFilters.edgeColorBase || "uniform"}
                  edgeColorNodeMetric={appliedFilters.edgeColorNodeMetric || "custom"}
                  edgeColorNodeTarget={appliedFilters.edgeColorNodeTarget || "source"}
                  nodeOpacity={appliedFilters.nodeOpacity ?? 1}
                  edgeOpacity={appliedFilters.edgeOpacity ?? 0.3}
                  edgeOpacityBase={appliedFilters.edgeOpacityBase || "uniform"}
                  forceStrength={appliedFilters.forceStrength || -100}
                  directed={directed}
                  bipartite={bipartite}
                  livePhysics={appliedFilters.livePhysics}
                  isDarkMode={isDarkMode}
                  refreshKey={refreshKey}
                  onRefresh={handleRefresh}
                  onElementDoubleClick={handleElementDoubleClick}
                  onClearSelection={() => setSelectedElement(null)}
                  searchQuery={searchQuery}
                  selectedElement={selectedElement}
                  focusRequest={graphFocusRequest}
                  onSwitchRenderer={handleSwitchRenderer}
                  isRendererSwitching={isSwitchingRenderer}
                  beginDrag={beginDrag}
                  movePinnedNode={movePinnedNode}
                  endDrag={endDrag}
                  onRendererReady={(renderer) => { sigmaRendererRef.current = renderer; }}
                />
              ) : (
                <D3Graph 
                  graph={graph}
                  nodes={validNodes} 
                  edges={validEdges} 
                  communityMap={communityMap}
                  networkMetrics={networkMetrics}
                  nodeSizeMult={appliedFilters.nodeSize || 3}
                  bipartiteNodeSizeMult={appliedFilters.bipartiteNodeSize || 2}
                  nodeSizeBase={appliedFilters.nodeSizeBase || "abundance"}
                  nodeColorBase={appliedFilters.nodeColorBase || "custom"}
                  uniformNodeColor={appliedFilters.uniformNodeColor || "#cccccc"}
                  uniformEdgeColor={appliedFilters.uniformEdgeColor || (isDarkMode ? "#888888" : "#333333")}
                  edgeWeightMult={appliedFilters.edgeWeight || 1}
                  edgeWeightBase={appliedFilters.edgeWeightBase || "weight_raw"}
                  edgeColorBase={appliedFilters.edgeColorBase || "uniform"}
                  edgeColorNodeMetric={appliedFilters.edgeColorNodeMetric || "custom"}
                  edgeColorNodeTarget={appliedFilters.edgeColorNodeTarget || "source"}
                  nodeOpacity={appliedFilters.nodeOpacity ?? 1}
                  edgeOpacity={appliedFilters.edgeOpacity ?? 0.3}
                  edgeOpacityBase={appliedFilters.edgeOpacityBase || "uniform"}
                  forceStrength={appliedFilters.forceStrength || -100}
                  directed={directed}
                  bipartite={bipartite}
                  livePhysics={appliedFilters.livePhysics}
                  isDarkMode={isDarkMode}
                  refreshKey={refreshKey}
                  onRefresh={handleRefresh}
                  onElementDoubleClick={handleElementDoubleClick}
                  onClearSelection={() => setSelectedElement(null)}
                  searchQuery={searchQuery}
                  selectedElement={selectedElement}
                  onSwitchRenderer={handleSwitchRenderer}
                  isRendererSwitching={isSwitchingRenderer}
                  registerD3TickListener={registerD3TickListener}
                  beginDrag={beginDrag}
                  movePinnedNode={movePinnedNode}
                  endDrag={endDrag}
                  d3NodesRef={d3NodesRef}
                  d3LinksRef={d3LinksRef}
                  d3NodesMapRef={d3NodesMapRef}
                />
              )}
            </div>
            
            <div className={`flex-1 w-full h-full overflow-hidden ${activeTab === "data" ? "block" : "hidden"}`}>
              <WorkspaceDataTable dataTab={dataTab} tableData={tableData} tableDataEdges={tableDataEdges} networkMetrics={networkMetrics} handleSort={handleSort} sortConfig={sortConfig} handleElementDoubleClick={handleElementDoubleClick} />
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center font-mono text-sm opacity-50">
            <span>NO DATA // ADJUST FILTERS</span>
          </div>
        )}
      </section>
    </div>
  );
}
