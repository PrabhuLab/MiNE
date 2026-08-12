'use client';

/* eslint-disable react-hooks/set-state-in-effect */

import React, { useEffect, useRef, useState } from 'react';
import type Graph from 'graphology';
import { useStore, RawNode, RawEdge } from '@/store/useStore';
import GraphLegend from '@/components/graph/GraphLegend';
import GraphControlOverlay from '@/components/graph/GraphControlOverlay';
import NodeDetailsSidebar from '@/components/graph/NodeDetailsSidebar';
import GraphTooltip, { TooltipData } from '@/components/graph/GraphTooltip';
import { useGraphStyles } from '@/hooks/useGraphStyles';
import { useGraphSimulation } from '@/hooks/useGraphSimulation';

interface D3GraphProps {
  graph: Graph;
  nodes: RawNode[];
  edges: RawEdge[];
  communityMap: Record<string, string>;
  networkMetrics?: any[];
  nodeSizeMult: number;
  bipartiteNodeSizeMult?: number;
  nodeSizeBase?: string;
  nodeColorBase?: string;
  uniformNodeColor?: string;
  uniformEdgeColor?: string;
  edgeWeightMult?: number;
  edgeWeightBase?: string;
  edgeColorBase?: string;
  edgeColorNodeMetric?: string;
  edgeColorNodeTarget?: 'source' | 'target';
  nodeOpacity?: number;
  edgeOpacity?: number;
  edgeOpacityBase?: string;
  forceStrength: number;
  directed: boolean;
  bipartite: boolean;
  livePhysics?: boolean;
  isDarkMode?: boolean;
  refreshKey?: number;
  onRefresh?: () => void;
  onElementDoubleClick?: (id: string, type: 'node' | 'edge') => void;
  onClearSelection?: () => void;
  searchQuery?: string;
  selectedElement?: string | null;
  onSwitchRenderer?: (engine: 'd3' | 'sigma') => void;
  isRendererSwitching?: boolean;
  registerD3TickListener?: (cb: () => void) => () => void;
  beginDrag?: (id: string, x: number, y: number) => void;
  movePinnedNode?: (id: string, x: number, y: number) => void;
  endDrag?: (id: string) => void;
  d3NodesRef?: React.RefObject<any[]>;
  d3LinksRef?: React.RefObject<any[]>;
  d3NodesMapRef?: React.RefObject<Map<string, any>>;
}

export default function D3Graph({
  graph,
  nodes,
  edges,
  communityMap,
  networkMetrics = [],
  nodeSizeMult,
  bipartiteNodeSizeMult = 2,
  nodeSizeBase = 'abundance',
  nodeColorBase = 'custom',
  uniformNodeColor = '#cccccc',
  uniformEdgeColor = '#cccccc',
  edgeWeightMult = 1,
  edgeWeightBase = 'weight_raw',
  edgeColorBase = 'uniform',
  edgeColorNodeMetric = '',
  edgeColorNodeTarget = 'source',
  nodeOpacity = 1,
  edgeOpacity = 0.3,
  edgeOpacityBase = 'uniform',
  forceStrength,
  directed,
  bipartite,
  livePhysics,
  isDarkMode,
  refreshKey,
  onRefresh,
  onElementDoubleClick,
  onClearSelection,
  searchQuery = '',
  selectedElement = null,
  onSwitchRenderer,
  isRendererSwitching = false,
  registerD3TickListener,
  beginDrag,
  movePinnedNode,
  endDrag,
  d3NodesRef,
  d3LinksRef,
  d3NodesMapRef,
}: D3GraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const [clickedNode, setClickedNode] = useState<RawNode | null>(null);
  const [clickedDegree, setClickedDegree] = useState<number>(0);
  const [clickedEdge, setClickedEdge] = useState<RawEdge | null>(null);
  const [isCalculatingLayout, setIsCalculatingLayout] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [isLegendMinimized, setIsLegendMinimized] = useState(false);

  const {
    hiddenLegendItems,
    setHiddenLegendItems,
    isolatedLegendItem,
    setIsolatedLegendItem,
    selectedCommunityId,
    setSelectedCommunityId,
    isolatedCommunityId,
    setIsolatedCommunityId,
    hoveredCommunityId,
    setHoveredCommunityId,
    showArrowheads,
    setShowArrowheads,
    showNodeLabels,
    setShowNodeLabels,
  } = useStore();

  const hiddenItems = new Set(hiddenLegendItems);
  const setHiddenItems = (updater: (prev: Set<string>) => Set<string>) => {
    setHiddenLegendItems(Array.from(updater(new Set(hiddenLegendItems))));
  };

  const clickedNodeRef = useRef<RawNode | null>(null);
  const clickedEdgeRef = useRef<RawEdge | null>(null);
  useEffect(() => { clickedNodeRef.current = clickedNode; }, [clickedNode]);
  useEffect(() => { clickedEdgeRef.current = clickedEdge; }, [clickedEdge]);

  useEffect(() => {
    if (selectedElement) {
      const node = nodes.find((candidate) => candidate.id === selectedElement);
      if (node) {
        setClickedNode(node);
        setClickedEdge(null);
        return;
      }

      const edge = edges.find((candidate) => {
        const forward = `${candidate.source}-${candidate.target}`;
        const reverse = `${candidate.target}-${candidate.source}`;
        return selectedElement === forward || (!directed && selectedElement === reverse);
      });
      if (edge) {
        setClickedEdge(edge);
        setClickedNode(null);
        return;
      }
      setClickedNode(null);
      setClickedEdge(null);
    }
  }, [selectedElement, nodes, edges, directed]);

  useEffect(() => {
    setHiddenLegendItems([]);
    setClickedNode(null);
  }, [refreshKey, setHiddenLegendItems]);

  const {
    customColorMap,
    communityDisplay,
    netMap,
    maxRaw,
    maxSec,
    getShouldShowArrowhead,
    elementLegendItems,
    elementLegendIds,
    legendCategories,
    legendMetricScale,
    getNodeColor,
    getEdgeColor,
    getEdgeOpacity,
  } = useGraphStyles({
    nodes,
    edges,
    communityMap,
    networkMetrics,
    nodeColorBase,
    uniformNodeColor,
    uniformEdgeColor,
    edgeWeightBase,
    edgeColorBase,
    edgeColorNodeMetric,
    edgeColorNodeTarget,
    nodeOpacity,
    edgeOpacity,
    edgeOpacityBase,
    directed,
    bipartite,
    isDarkMode,
    searchQuery,
    selectedElement,
    showArrowheads,
    isolatedLegendItem,
    clickedNodeRef,
    clickedEdgeRef,
  });

  const { handleZoomFit } = useGraphSimulation({
    graph,
    containerRef,
    svgRef,
    nodes,
    edges,
    communityMap,
    networkMetrics,
    nodeSizeMult,
    bipartiteNodeSizeMult,
    nodeSizeBase,
    nodeColorBase,
    uniformNodeColor,
    uniformEdgeColor,
    edgeWeightMult,
    edgeWeightBase,
    edgeColorBase,
    edgeColorNodeMetric,
    edgeColorNodeTarget,
    nodeOpacity,
    edgeOpacity,
    edgeOpacityBase,
    forceStrength,
    directed,
    bipartite,
    livePhysics,
    isDarkMode,
    refreshKey,
    onRefresh,
    onElementDoubleClick,
    onClearSelection,
    searchQuery,
    selectedElement,
    hiddenItems,
    isolatedLegendItem,
    showArrowheads,
    showNodeLabels,
    getShouldShowArrowhead,
    getNodeColor,
    getEdgeColor,
    getEdgeOpacity,
    netMap,
    displayMap: communityDisplay.displayMap,
    maxRaw,
    maxSec,
    clickedNode,
    setClickedNode,
    clickedEdge,
    setClickedEdge,
    setClickedDegree,
    setTooltip,
    isCalculatingLayout,
    setIsCalculatingLayout,
    registerD3TickListener,
    beginDrag,
    movePinnedNode,
    endDrag,
    d3NodesRef,
    d3LinksRef,
    d3NodesMapRef,
  });

  const handleLegendClick = (e: React.MouseEvent, id: string, categoryIds: string[]) => {
    e.stopPropagation();
    setHiddenItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCommunitySingleClick = (id: string) => {
    setHiddenItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleElementSingleClick = (id: string) => {
    setHiddenItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCommunityDoubleClick = (id: string) => {
    const isCurrentlyIsolated = isolatedCommunityId === id || isolatedLegendItem === id;
    if (isCurrentlyIsolated) {
      setIsolatedCommunityId(null);
      setSelectedCommunityId(null);
    } else {
      setIsolatedCommunityId(id);
      setSelectedCommunityId(id);
    }
  };

  const handleElementDoubleClick = (id: string) => {
    const isCurrentlyIsolated = isolatedLegendItem === id;
    if (isCurrentlyIsolated) {
      setIsolatedLegendItem(null);
    } else {
      setIsolatedLegendItem(id);
    }
  };

  const handleResetView = () => {
    setIsolatedCommunityId(null);
    setSelectedCommunityId(null);
    setIsolatedLegendItem(null);
    setHiddenLegendItems([]);
    setHoveredCommunityId(null);
    setClickedNode(null);
    setClickedEdge(null);
    if (onClearSelection) onClearSelection();
    handleZoomFit();
  };

  return (
    <div ref={containerRef} className="w-full h-full relative cursor-crosshair">
      <svg ref={svgRef} id="network-graph-svg" className="w-full h-full block" />

      <GraphControlOverlay
        isDarkMode={isDarkMode}
        onZoomFit={handleZoomFit}
        onResetView={handleResetView}
        onRefreshGraph={() => {
          if (onRefresh) onRefresh();
        }}
        isCalculatingLayout={isCalculatingLayout}
        activeRenderer="d3"
        onSwitchRenderer={onSwitchRenderer}
        isRendererSwitching={isRendererSwitching}
      />

      <NodeDetailsSidebar
        clickedNode={clickedNode}
        clickedEdge={clickedEdge}
        clickedDegree={clickedDegree}
        netMap={netMap}
        communityMap={communityMap}
        customColorMap={customColorMap}
        isDarkMode={isDarkMode}
        onClose={() => {
          setClickedNode(null);
          setClickedEdge(null);
        }}
      />

      <GraphTooltip tooltip={tooltip} isDarkMode={isDarkMode} />

      <GraphLegend
        isDarkMode={isDarkMode}
        elementLegendItems={elementLegendItems}
        elementLegendIds={elementLegendIds}
        hiddenItems={hiddenItems}
        isolatedLegendItem={isolatedLegendItem}
        selectedCommunityId={selectedCommunityId}
        isolatedCommunityId={isolatedCommunityId}
        handleLegendClick={handleLegendClick}
        onElementSingleClick={handleElementSingleClick}
        onElementDoubleClick={handleElementDoubleClick}
        onCommunitySingleClick={handleCommunitySingleClick}
        onCommunityDoubleClick={handleCommunityDoubleClick}
        onCommunityHover={setHoveredCommunityId}
        showNodeLabels={showNodeLabels}
        setShowNodeLabels={setShowNodeLabels}
        directed={directed}
        showArrowheads={showArrowheads}
        setShowArrowheads={setShowArrowheads}
        legendCategories={legendCategories}
        legendMetricScale={legendMetricScale}
        isLegendMinimized={isLegendMinimized}
        setIsLegendMinimized={setIsLegendMinimized}
      />
    </div>
  );
}
