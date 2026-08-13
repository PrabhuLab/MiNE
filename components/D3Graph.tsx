'use client';

/* eslint-disable react-hooks/set-state-in-effect */

import React, { useEffect, useRef, useState } from 'react';
import { useStore, RawNode, RawEdge } from '@/store/useStore';
import GraphLegend from '@/components/graph/GraphLegend';
import GraphControlOverlay from '@/components/graph/GraphControlOverlay';
import NodeDetailsSidebar from '@/components/graph/NodeDetailsSidebar';
import GraphTooltip, { TooltipData } from '@/components/graph/GraphTooltip';
import { useGraphStyles } from '@/hooks/useGraphStyles';
import { useGraphSimulation } from '@/hooks/useGraphSimulation';

interface D3GraphProps {
  nodes: RawNode[];
  edges: RawEdge[];
  communityMap: Record<string, string>;
  networkMetrics?: any[];
  nodeSizeMult: number;
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
}

export default function D3Graph({
  nodes,
  edges,
  communityMap,
  networkMetrics = [],
  nodeSizeMult,
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
      if (!selectedElement.includes('-')) {
        const node = nodes.find((n) => n.id === selectedElement);
        if (node) {
          setClickedNode(node);
          setClickedEdge(null);
          return;
        }
      } else {
        const parts = selectedElement.split('-');
        if (parts.length >= 2) {
          const edge = edges.find(
            (e) =>
              (e.source === parts[0] && e.target === parts[1]) ||
              (!directed && e.source === parts[1] && e.target === parts[0])
          );
          if (edge) {
            setClickedEdge(edge);
            setClickedNode(null);
            return;
          }
        }
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
    communityColorMap,
    netMap,
    maxRaw,
    maxSec,
    getShouldShowArrowhead,
    elementLegendItems,
    elementLegendIds,
    legendCategories,
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
    containerRef,
    svgRef,
    nodes,
    edges,
    communityMap,
    networkMetrics,
    nodeSizeMult,
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
  });

  const clickTimers = useRef<{ [key: string]: NodeJS.Timeout }>({});
  const clickCounts = useRef<{ [key: string]: number }>({});

  const handleLegendClick = (e: React.MouseEvent, id: string, categoryIds: string[]) => {
    e.stopPropagation();
    clickCounts.current[id] = (clickCounts.current[id] || 0) + 1;

    if (clickTimers.current[id]) {
      clearTimeout(clickTimers.current[id]);
    }

    if (clickCounts.current[id] >= 3) {
      clickCounts.current[id] = 0;
      setIsolatedLegendItem(null);
      setHiddenItems((prev) => {
        const next = new Set(prev);
        categoryIds.forEach((cid) => next.delete(cid));
        return next;
      });
      handleZoomFit();
    } else {
      clickTimers.current[id] = setTimeout(() => {
        const count = clickCounts.current[id];
        clickCounts.current[id] = 0;
        delete clickTimers.current[id];

        if (count === 1) {
          if (isolatedLegendItem === id) {
            setIsolatedLegendItem(null);
          } else {
            setHiddenItems((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            });
          }
        } else if (count === 2) {
          setIsolatedLegendItem(id);
          setHiddenItems((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          handleZoomFit(id);
        }
      }, 300);
    }
  };

  return (
    <div ref={containerRef} className="w-full h-full relative cursor-crosshair">
      <svg ref={svgRef} id="network-graph-svg" className="w-full h-full block" />

      <GraphControlOverlay
        isDarkMode={isDarkMode}
        onZoomFit={handleZoomFit}
        onRefreshGraph={() => {
          nodes.forEach((n: any) => {
            n.x = undefined;
            n.y = undefined;
            n.vx = undefined;
            n.vy = undefined;
            n.fx = undefined;
            n.fy = undefined;
          });
          onRefresh && onRefresh();
        }}
        isCalculatingLayout={isCalculatingLayout}
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
        handleLegendClick={handleLegendClick}
        showNodeLabels={showNodeLabels}
        setShowNodeLabels={setShowNodeLabels}
        directed={directed}
        showArrowheads={showArrowheads}
        setShowArrowheads={setShowArrowheads}
        legendCategories={legendCategories}
        isLegendMinimized={isLegendMinimized}
        setIsLegendMinimized={setIsLegendMinimized}
      />
    </div>
  );
}
