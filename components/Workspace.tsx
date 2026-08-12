'use client';

/* eslint-disable react-hooks/set-state-in-effect */

import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useStore, RawNode, RawEdge } from '@/store/useStore';
import * as d3 from 'd3';
import { Download } from 'lucide-react';
import type Sigma from 'sigma';
import type Graph from 'graphology';
import { useGraphFilters } from '@/hooks/useGraphFilters';
import { useGraphMetrics } from '@/hooks/useGraphMetrics';
import { useDataTableSort } from '@/hooks/useDataTableSort';
import { useGraphStyles } from '@/hooks/useGraphStyles';
import { useSharedGraph } from '@/hooks/useSharedGraph';
import { useSharedPhysics } from '@/hooks/useSharedPhysics';
import { useWorkspaceSelection } from '@/hooks/useWorkspaceSelection';
import { useWorkspaceIO } from '@/hooks/useWorkspaceIO';
import { useGraphLayouts } from '@/hooks/useGraphLayouts';
import { METRIC_REGISTRY } from '@/services/metrics/registry';

// Dynamically import D3Graph & SigmaGraph so they only run on the client due to canvas/SVG dependencies
const D3Graph = dynamic(() => import('./D3Graph'), { ssr: false });
const SigmaGraph = dynamic(() => import('./graph/SigmaGraph'), { ssr: false });

import { WorkspaceSidebar } from "@/components/workspace/WorkspaceSidebar";
import { WorkspaceDataTable } from "@/components/workspace/WorkspaceDataTable";
import { GraphMetricCarousel } from '@/components/workspace/GraphMetricCarousel';
import { isSecondaryNode } from '@/services/graphPresentation/visibility';
import { LayoutControls } from '@/components/workspace/LayoutControls';

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
  const metricsGraphRef = useRef<Graph | null>(null);
  const metricsLayoutRevisionRef = useRef(0);
  const metricAccessors = useMemo(() => ({
    getPositionedNodes: () => {
      const currentGraph = metricsGraphRef.current;
      if (!currentGraph) return validNodes;
      return validNodes.map((node) => currentGraph.hasNode(node.id) ? { ...node, ...currentGraph.getNodeAttributes(node.id) } : node);
    },
    getLayoutRevision: () => metricsLayoutRevisionRef.current,
  }), [validNodes]);

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
    edgeMetrics,
    graphMetrics,
    metricValidity,
    metricWarnings,
    metricContext,
    staleMetricIds,
    metricsToRun,
    setMetricsToRun,
    metricsLoading,
    runSelectedMetrics,
    invalidateLayoutMetrics,
  } = useGraphMetrics(validNodes, validEdges, appliedFilters, rawNodes, metricAccessors);

  const {
    searchQuery,
    sortConfig,
    setSortConfig,
    tableData,
    tableDataEdges
  } = useDataTableSort(validNodes, validEdges, networkMetrics, nodeMetrics);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const {
    activeTab,
    setActiveTab,
    dataTab,
    setDataTab,
    graphFocusRequest,
    handleElementDoubleClick,
    clearSelection,
  } = useWorkspaceSelection();
  const [showExportMenu, setShowExportMenu] = useState(false);
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
  const metricMap = useMemo(() => new Map(networkMetrics.map((metric: any) => [String(metric.id), metric])), [networkMetrics]);
  const visibleNodeMap = useMemo(() => new Map(validNodes.map((node) => [String(node.id), node])), [validNodes]);

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

      const isSecondary = isSecondaryNode(node, bipartite);
      const mult = isSecondary ? (appliedFilters.bipartiteNodeSize || 2) : (appliedFilters.nodeSize || 3);

      return mult * Math.max(Math.log(baseVal + 2), 1) + 2;
    },
    [appliedFilters.nodeSizeBase, appliedFilters.bipartiteNodeSize, appliedFilters.nodeSize, bipartite, degreeMap, selectedCustomAttribute, customSizeDomain]
  );

  const edgeSizeValue = useCallback((candidate: RawEdge): number | null => {
    const base = appliedFilters.edgeWeightBase || 'weight_raw';
    if (base === 'uniform') return null;
    if (base === 'weight_raw') return Number(candidate.weight_raw);
    if (base === 'weight_secondary') return Number(candidate.weight_secondary);
    if (base.startsWith('edge:')) return Number(candidate[base.slice('edge:'.length)]);

    const prefix = base.startsWith('metric:') ? 'metric:' : base.startsWith('node:') ? 'node:' : '';
    if (!prefix) return Number.NaN;
    const source = base.slice(prefix.length);
    const nodeValue = (nodeId: string) => {
      const node = visibleNodeMap.get(nodeId);
      const metric = metricMap.get(nodeId);
      if (source === 'abundance') return Number(node?.abundance);
      if (source === 'degree') return Number(degreeMap[nodeId] || 0);
      if (source === 'inDegree' || source === 'outDegree') return Number(metric?.[source] || 0);
      return Number(metric?.[source] ?? node?.[source]);
    };
    const sourceValue = nodeValue(String(candidate.source));
    const targetValue = nodeValue(String(candidate.target));
    if (Number.isFinite(sourceValue) && Number.isFinite(targetValue)) return (sourceValue + targetValue) / 2;
    return Number.isFinite(sourceValue) ? sourceValue : targetValue;
  }, [appliedFilters.edgeWeightBase, degreeMap, metricMap, visibleNodeMap]);

  const edgeSizeDomain = useMemo(() => {
    const values = validEdges.map(edgeSizeValue).filter((value): value is number => value !== null && Number.isFinite(value));
    if (!values.length) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    return [min, max === min ? min + 1 : max] as const;
  }, [edgeSizeValue, validEdges]);

  const getEdgeSize = useCallback((edge: RawEdge) => {
    const value = edgeSizeValue(edge);
    const baseWidth = value !== null && Number.isFinite(value) && edgeSizeDomain
      ? d3.scaleLinear().domain(edgeSizeDomain).range([1, 6])(value)
      : 2;
    return Math.max(0.5, baseWidth * (appliedFilters.edgeWeight || 1));
  }, [appliedFilters.edgeWeight, edgeSizeDomain, edgeSizeValue]);

  // Unified persistent Graphology instance (using D3 static layout pre-rendering)
  const { graph, isReady, layoutRevision, runRefreshLayout, notifyLayoutChange } = useSharedGraph({
    nodes: validNodes,
    edges: validEdges,
    directed,
    bipartite,
    forceStrength: appliedFilters.forceStrength || -100,
    livePhysics: appliedFilters.livePhysics,
    isDarkMode,
    getNodeColor,
    getNodeSize,
    getEdgeColor,
    getEdgeSize,
    getEdgeOpacity,
    getShouldShowArrowhead,
    nodeOpacity: appliedFilters.nodeOpacity ?? 1,
  });
  useEffect(() => {
    metricsGraphRef.current = graph;
    metricsLayoutRevisionRef.current = layoutRevision;
  }, [graph, layoutRevision]);

  const selectedLayoutMetricIds = useMemo(() => METRIC_REGISTRY.filter((metric) => metric.scope === 'layout' && metricsToRun[metric.id]).map((metric) => metric.id), [metricsToRun]);
  const handleLayoutStopped = useCallback(() => {
    if (selectedLayoutMetricIds.length) runSelectedMetrics(selectedLayoutMetricIds);
  }, [runSelectedMetrics, selectedLayoutMetricIds]);
  const layoutController = useGraphLayouts({
    graph,
    nodes: validNodes,
    edges: validEdges,
    topologyKey,
    livePhysics: appliedFilters.livePhysics,
    setLivePhysics: (enabled) => useStore.getState().setFilter('livePhysics', enabled),
    notifyLayoutChange,
    onLayoutStarted: invalidateLayoutMetrics,
    onLayoutStopped: handleLayoutStopped,
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

  useEffect(() => {
    setIsSwitchingRenderer(true);
    const timer = setTimeout(() => {
      setIsSwitchingRenderer(false);
    }, 200);
    return () => clearTimeout(timer);
  }, [rendererEngine]);

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

  const { handleImportWorkspace, handleExport } = useWorkspaceIO({
    graph,
    rawNodes,
    rawEdges,
    directed,
    bipartite,
    isDarkMode,
    projectName,
    rendererEngine,
    useSigma,
    sigmaRendererRef,
    communityMap,
    networkMetrics,
    nodeMetrics,
    edgeMetrics,
    graphMetrics,
    metricValidity,
    metricsToRun,
    setMetricsToRun,
    setAppliedFilters,
    setRefreshKey,
    closeExportMenu: () => setShowExportMenu(false),
  });

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
        metricContext={metricContext}
        staleMetricIds={staleMetricIds}
        metricWarnings={metricWarnings}
        layoutControls={<LayoutControls {...layoutController} />}
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

          <div className="flex items-center gap-3">
            {activeTab === 'data' && (
              <div className="flex text-[10px] uppercase font-bold tracking-widest bg-white dark:bg-[#141414] border border-[#141414] dark:border-[#333] shadow-sm">
                <button className={`px-4 py-2 ${dataTab === 'nodes' ? 'bg-[#141414] text-white dark:bg-[#333]' : 'text-[#888]'}`} onClick={() => setDataTab('nodes')}>Nodes</button>
                <button className={`px-4 py-2 border-l border-[#141414] dark:border-[#333] ${dataTab === 'edges' ? 'bg-[#141414] text-white dark:bg-[#333]' : 'text-[#888]'}`} onClick={() => setDataTab('edges')}>Edges</button>
              </div>
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

        {activeTab === 'data' && (
          <GraphMetricCarousel metrics={graphMetrics} />
        )}

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
                  onClearSelection={clearSelection}
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
                  layoutRevision={layoutRevision}
                  onRefresh={handleRefresh}
                  onElementDoubleClick={handleElementDoubleClick}
                  onClearSelection={clearSelection}
                  searchQuery={searchQuery}
                  selectedElement={selectedElement}
                  focusRequest={graphFocusRequest}
                  onSwitchRenderer={handleSwitchRenderer}
                  isRendererSwitching={isSwitchingRenderer}
                  registerD3TickListener={registerD3TickListener}
                  beginDrag={beginDrag}
                  movePinnedNode={movePinnedNode}
                  endDrag={endDrag}
                  d3NodesRef={d3NodesRef}
                  d3LinksRef={d3LinksRef}
                  d3NodesMapRef={d3NodesMapRef}
                  getNodeSize={getNodeSize}
                  getEdgeSize={getEdgeSize}
                />
              )}
            </div>
            
            <div className={`flex-1 w-full h-full overflow-hidden ${activeTab === "data" ? "block" : "hidden"}`}>
              <WorkspaceDataTable dataTab={dataTab} tableData={tableData} tableDataEdges={tableDataEdges} edgeMetrics={edgeMetrics} handleSort={handleSort} sortConfig={sortConfig} handleElementDoubleClick={handleElementDoubleClick} />
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
