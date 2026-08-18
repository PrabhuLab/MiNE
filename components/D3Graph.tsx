'use client';

/* eslint-disable react-hooks/set-state-in-effect */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type Graph from 'graphology';
import { useStore, RawNode, RawEdge } from '@/store/useStore';
import GraphLegend from '@/components/graph/GraphLegend';
import GraphControlOverlay from '@/components/graph/GraphControlOverlay';
import NodeDetailsSidebar from '@/components/graph/NodeDetailsSidebar';
import GraphTooltip from '@/components/graph/GraphTooltip';
import type { TooltipData } from '@/services/graphInteraction/types';
import { useGraphStyles } from '@/hooks/useGraphStyles';
import { useGraphSimulation } from '@/hooks/useGraphSimulation';
import type { GraphFocusRequest } from '@/services/workspace/types';
import { createElementLegendItems } from '@/components/graph/legend/elementItems';
import { collectVisibleD3NodeIds } from '@/components/graph/d3/presentation';

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
  layoutRevision?: number;
  onRefresh?: () => void;
  onElementDoubleClick?: (id: string, type: 'node' | 'edge') => void;
  onClearSelection?: () => void;
  searchQuery?: string;
  selectedElement?: string | null;
  focusRequest?: GraphFocusRequest | null;
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
  layoutRevision = 0,
  onRefresh,
  onElementDoubleClick,
  onClearSelection,
  searchQuery = '',
  selectedElement = null,
  focusRequest = null,
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

  const hiddenItems = useMemo(() => new Set(hiddenLegendItems), [hiddenLegendItems]);
  const setHiddenItems = (updater: (prev: Set<string>) => Set<string>) => {
    setHiddenLegendItems(Array.from(updater(new Set(hiddenLegendItems))));
  };

  const clickedNodeRef = useRef<RawNode | null>(null);
  const clickedEdgeRef = useRef<RawEdge | null>(null);
  useEffect(() => { clickedNodeRef.current = clickedNode; }, [clickedNode]);
  useEffect(() => { clickedEdgeRef.current = clickedEdge; }, [clickedEdge]);

  const focusedEdgeNodeIds = useMemo(() => {
    if (focusRequest?.type !== 'edge') return new Set<string>();
    return new Set([focusRequest.source, focusRequest.target].filter((id): id is string => Boolean(id)));
  }, [focusRequest]);
  const renderNodes = useMemo(
    () => focusedEdgeNodeIds.size > 0 ? nodes.filter((node) => focusedEdgeNodeIds.has(node.id)) : nodes,
    [nodes, focusedEdgeNodeIds],
  );
  const renderEdges = useMemo(
    () => focusedEdgeNodeIds.size > 0
      ? edges.filter((edge) => focusedEdgeNodeIds.has(edge.source) && focusedEdgeNodeIds.has(edge.target))
      : edges,
    [edges, focusedEdgeNodeIds],
  );

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
    legendCategories,
    legendMetricScale,
    legendMetricScales,
    legendNodeMembership,
    legendEdgeMembership,
    getNodeColor,
    getEdgeColor,
    getEdgeOpacity,
  } = useGraphStyles({
    nodes,
    edges,
    communityMap,
    networkMetrics,
    nodeSizeBase,
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
    selectedCommunityId,
    isolatedCommunityId,
    showArrowheads,
    isolatedLegendItem,
    clickedNodeRef,
    clickedEdgeRef,
  });
  const elementLegendItems = useMemo(
    () => createElementLegendItems(bipartite, directed, isDarkMode),
    [bipartite, directed, isDarkMode],
  );
  const elementLegendIds = useMemo(
    () => elementLegendItems.map((item) => item.id),
    [elementLegendItems],
  );

  const getVisibleNodeIds = React.useCallback(
    (
      targetFilter?: string | null,
      isolatedCommunityOverride?: string | null,
      isolatedLegendOverride?: string | null,
      hiddenOverride?: Set<string>,
    ) => collectVisibleD3NodeIds(
      nodes,
      {
        bipartite,
        hiddenItems: hiddenOverride ?? hiddenItems,
        isolatedLegendItem,
        isolatedCommunityId,
        displayMap: communityDisplay.displayMap,
        legendNodeMembership,
      },
      targetFilter,
      isolatedCommunityOverride,
      isolatedLegendOverride,
    ),
    [nodes, bipartite, hiddenItems, isolatedLegendItem, isolatedCommunityId, communityDisplay.displayMap, legendNodeMembership],
  );
  const fittedNodeIds = useMemo(
    () => focusedEdgeNodeIds.size > 0 ? Array.from(focusedEdgeNodeIds) : getVisibleNodeIds(),
    [focusedEdgeNodeIds, getVisibleNodeIds],
  );

  const { fitD3NodeSet } = useGraphSimulation({
    graph,
    containerRef,
    svgRef,
    nodes: renderNodes,
    edges: renderEdges,
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
    layoutRevision,
    onRefresh,
    onElementDoubleClick,
    onClearSelection,
    searchQuery,
    selectedElement,
    hiddenItems,
    isolatedLegendItem,
    selectedCommunityId,
    isolatedCommunityId,
    hoveredCommunityId,
    showArrowheads,
    showNodeLabels,
    getShouldShowArrowhead,
    getNodeColor,
    getEdgeColor,
    getEdgeOpacity,
    netMap,
    displayMap: communityDisplay.displayMap,
    legendNodeMembership,
    legendEdgeMembership,
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
    focusedEdgeNodeSet: focusedEdgeNodeIds,
    fitNodeIds: fittedNodeIds,
  });

  useEffect(() => {
    if (!focusRequest) return;
    let frameId = 0;
    const focusWhenVisible = () => {
      const container = containerRef.current;
      if (!container || container.clientWidth <= 0 || container.clientHeight <= 0) {
        frameId = requestAnimationFrame(focusWhenVisible);
        return;
      }
      const nodeIds = focusRequest.type === 'node'
        ? [focusRequest.id]
        : [focusRequest.source, focusRequest.target].filter((id): id is string => Boolean(id));
      fitD3NodeSet(nodeIds);
    };
    frameId = requestAnimationFrame(focusWhenVisible);
    return () => cancelAnimationFrame(frameId);
  }, [focusRequest, fitD3NodeSet]);

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
      fitD3NodeSet(getVisibleNodeIds(null, null, isolatedLegendItem));
    } else {
      const revealedItems = new Set(hiddenItems);
      revealedItems.delete(id);
      setHiddenItems((previous) => {
        const next = new Set(previous);
        next.delete(id);
        return next;
      });
      setIsolatedCommunityId(id);
      setSelectedCommunityId(id);
      fitD3NodeSet(getVisibleNodeIds(id, id, isolatedLegendItem, revealedItems));
    }
  };

  const handleElementDoubleClick = (id: string) => {
    const isCurrentlyIsolated = isolatedLegendItem === id;
    if (isCurrentlyIsolated) {
      setIsolatedLegendItem(null);
      fitD3NodeSet(getVisibleNodeIds(null, isolatedCommunityId, null));
    } else {
      const revealedItems = new Set(hiddenItems);
      revealedItems.delete(id);
      setHiddenItems((previous) => {
        const next = new Set(previous);
        next.delete(id);
        return next;
      });
      setIsolatedLegendItem(id);
      fitD3NodeSet(getVisibleNodeIds(id, isolatedCommunityId, id, revealedItems));
    }
  };

  const handleZoomFit = () => fitD3NodeSet(fittedNodeIds);

  const handleResetView = () => {
    setIsolatedCommunityId(null);
    setSelectedCommunityId(null);
    setIsolatedLegendItem(null);
    setHiddenLegendItems([]);
    setHoveredCommunityId(null);
    setClickedNode(null);
    setClickedEdge(null);
    if (onClearSelection) onClearSelection();
    fitD3NodeSet(getVisibleNodeIds(null, null, null, new Set()));
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
        onCommunityDoubleClick={(id) => id.startsWith('community:') ? handleCommunityDoubleClick(id) : handleElementDoubleClick(id)}
        onCommunityHover={setHoveredCommunityId}
        showNodeLabels={showNodeLabels}
        setShowNodeLabels={setShowNodeLabels}
        directed={directed}
        showArrowheads={showArrowheads}
        setShowArrowheads={setShowArrowheads}
        legendCategories={legendCategories}
        legendMetricScale={legendMetricScale}
        legendMetricScales={legendMetricScales}
        isLegendMinimized={isLegendMinimized}
        setIsLegendMinimized={setIsLegendMinimized}
      />
    </div>
  );
}
