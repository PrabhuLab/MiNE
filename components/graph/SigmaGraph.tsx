'use client';

/* eslint-disable react-hooks/set-state-in-effect */

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import type Graph from 'graphology';
import Sigma from 'sigma';
import { useStore, RawNode, RawEdge } from '@/store/useStore';
import GraphLegend from '@/components/graph/GraphLegend';
import GraphControlOverlay from '@/components/graph/GraphControlOverlay';
import NodeDetailsSidebar from '@/components/graph/NodeDetailsSidebar';
import GraphTooltip from '@/components/graph/GraphTooltip';
import type { TooltipData } from '@/services/graphInteraction/types';
import { useGraphStyles } from '@/hooks/useGraphStyles';
import { SIGMA_PRIMITIVES } from '@/components/graph/sigma/primitives';
import { SIGMA_STYLES } from '@/components/graph/sigma/styles';
import { fitSigmaNodeSet } from '@/components/graph/sigma/camera';
import { collectVisibleSigmaNodeIds, isSecondaryNode } from '@/components/graph/sigma/visibility';
import { shouldRenderSigmaLabels } from '@/components/graph/sigma/labels';
import type { SigmaGraphProps } from '@/components/graph/sigma/types';
import { createSigmaEdgeReducer, createSigmaNodeReducer } from '@/components/graph/sigma/reducers';
import { registerSigmaInteractions } from '@/components/graph/sigma/interactions';
import { createElementLegendItems } from '@/components/graph/legend/elementItems';

export default function SigmaGraph({
  graph,
  isReady = false,
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
  focusRequest = null,
  onSwitchRenderer,
  isRendererSwitching = false,
  beginDrag,
  movePinnedNode,
  endDrag,
  onRendererReady,
}: SigmaGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sigmaRef = useRef<Sigma | null>(null);
  const styledSigmaRef = useRef<Sigma | null>(null);
  const hasInitialFitRef = useRef(false);

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
  const setHiddenItems = useCallback((updater: (prev: Set<string>) => Set<string>) => {
    setHiddenLegendItems(Array.from(updater(new Set(hiddenLegendItems))));
  }, [hiddenLegendItems, setHiddenLegendItems]);

  const clickedNodeRef = useRef<RawNode | null>(null);
  const clickedEdgeRef = useRef<RawEdge | null>(null);
  useEffect(() => { clickedNodeRef.current = clickedNode; }, [clickedNode]);
  useEffect(() => { clickedEdgeRef.current = clickedEdge; }, [clickedEdge]);

  // Precompute selected neighbors for O(1) lookup in reducers
  const selectedNeighborSet = useMemo(() => {
    if (!graph || !clickedNode) return new Set<string>();
    try {
      return new Set<string>(graph.neighbors(clickedNode.id));
    } catch {
      return new Set<string>();
    }
  }, [graph, clickedNode]);

  // Precompute search match set
  const searchMatchSet = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || !graph) return new Set<string>();
    const matches = new Set<string>();
    graph.forEachNode((nodeId: string, attrs: any) => {
      if (
        nodeId.toLowerCase().includes(q)
        || String(attrs.rawNode?.name || '').toLowerCase().includes(q)
        || String(attrs.rawNode?.label || '').toLowerCase().includes(q)
      ) {
        matches.add(nodeId);
      }
    });
    return matches;
  }, [graph, searchQuery]);

  // Precompute secondary status for all nodes
  const isSecondaryMap = useMemo(() => {
    if (!graph) return new Map<string, boolean>();
    const map = new Map<string, boolean>();
    graph.forEachNode((id: string, attrs: any) => {
      map.set(id, isSecondaryNode(attrs.rawNode, bipartite));
    });
    return map;
  }, [graph, bipartite]);

  // Dynamic Global Label Gating
  const shouldRenderLabels = useMemo(() => {
    return shouldRenderSigmaLabels(showNodeLabels, selectedElement, clickedNode, searchQuery);
  }, [showNodeLabels, selectedElement, clickedNode, searchQuery]);

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
    legendCategories,
    legendMetricScale,
    getNodeColor,
    getEdgeColor,
    getEdgeOpacity,
    getShouldShowArrowhead,
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

  const displayMap = communityDisplay.displayMap;
  const focusedEdgeNodeSet = useMemo(() => {
    if (focusRequest?.type !== 'edge') return new Set<string>();
    return new Set([focusRequest.source, focusRequest.target].filter((id): id is string => Boolean(id)));
  }, [focusRequest]);

  const styleRefs = useRef({
    getNodeColor,
    getEdgeColor,
    getEdgeOpacity,
    getShouldShowArrowhead,
    nodeOpacity,
    hiddenItems,
    isolatedLegendItem,
    selectedCommunityId,
    isolatedCommunityId,
    hoveredCommunityId,
    displayMap,
    searchQuery,
    clickedNodeRef,
    clickedEdgeRef,
    directed,
    showNodeLabels,
    selectedNeighborSet,
    searchMatchSet,
    isSecondaryMap,
    focusedEdgeNodeSet,
  });

  useEffect(() => {
    styleRefs.current = {
      getNodeColor,
      getEdgeColor,
      getEdgeOpacity,
      getShouldShowArrowhead,
      nodeOpacity,
      hiddenItems,
      isolatedLegendItem,
      selectedCommunityId,
      isolatedCommunityId,
      hoveredCommunityId,
      displayMap,
      searchQuery,
      clickedNodeRef,
      clickedEdgeRef,
      directed,
      showNodeLabels,
      selectedNeighborSet,
      searchMatchSet,
      isSecondaryMap,
      focusedEdgeNodeSet,
    };
  }, [
    getNodeColor,
    getEdgeColor,
    getEdgeOpacity,
    getShouldShowArrowhead,
    nodeOpacity,
    hiddenItems,
    isolatedLegendItem,
    selectedCommunityId,
    isolatedCommunityId,
    hoveredCommunityId,
    showArrowheads,
    displayMap,
    searchQuery,
    directed,
    showNodeLabels,
    selectedNeighborSet,
    searchMatchSet,
    isSecondaryMap,
    focusedEdgeNodeSet,
  ]);

  const getVisibleNodeIds = useCallback(
    (
      targetFilter?: string | null,
      isoCommOverride?: string | null,
      isoLegOverride?: string | null,
      hiddenOverride?: Set<string>,
    ) => {
      return collectVisibleSigmaNodeIds(graph, {
        bipartite,
        hiddenItems: hiddenOverride ?? hiddenItems,
        isolatedLegendItem,
        isolatedCommunityId,
        displayMap,
      }, communityMap, targetFilter, isoCommOverride, isoLegOverride);
    },
    [graph, bipartite, hiddenItems, isolatedLegendItem, isolatedCommunityId, displayMap, communityMap]
  );

  const handleZoomFit = useCallback(() => {
    if (!sigmaRef.current || !graph) return;
    const visibleIds = getVisibleNodeIds();
    fitSigmaNodeSet(sigmaRef.current, graph, containerRef.current, visibleIds);
  }, [graph, getVisibleNodeIds]);

  const handleResetView = useCallback(() => {
    if (!sigmaRef.current || !graph) return;
    setIsolatedCommunityId(null);
    setSelectedCommunityId(null);
    setIsolatedLegendItem(null);
    setHiddenLegendItems([]);
    setHoveredCommunityId(null);
    setClickedNode(null);
    setClickedEdge(null);
    onClearSelection?.();

    const visibleIds = getVisibleNodeIds(null, null, null, new Set());
    fitSigmaNodeSet(sigmaRef.current, graph, containerRef.current, visibleIds);
  }, [
    graph,
    setIsolatedCommunityId,
    setSelectedCommunityId,
    setIsolatedLegendItem,
    setHiddenLegendItems,
    setHoveredCommunityId,
    onClearSelection,
    getVisibleNodeIds,
  ]);

  const handleCommunityDoubleClick = useCallback(
    (commId: string) => {
      if (!graph) return;
      if (isolatedCommunityId === commId) {
        setIsolatedCommunityId(null);
        setSelectedCommunityId(null);
        const visibleIds = getVisibleNodeIds(null, null, isolatedLegendItem);
        fitSigmaNodeSet(sigmaRef.current, graph, containerRef.current, visibleIds);
      } else {
        const revealedItems = new Set(hiddenItems);
        revealedItems.delete(commId);
        setHiddenItems((previous) => {
          const next = new Set(previous);
          next.delete(commId);
          return next;
        });
        setIsolatedCommunityId(commId);
        setSelectedCommunityId(commId);
        const targetIds = getVisibleNodeIds(commId, commId, isolatedLegendItem, revealedItems);
        fitSigmaNodeSet(sigmaRef.current, graph, containerRef.current, targetIds);
      }
    },
    [graph, hiddenItems, isolatedCommunityId, isolatedLegendItem, setHiddenItems, setIsolatedCommunityId, setSelectedCommunityId, getVisibleNodeIds]
  );

  const handleElementDoubleClick = useCallback(
    (id: string) => {
      if (!graph) return;
      if (isolatedLegendItem === id) {
        setIsolatedLegendItem(null);
        const visibleIds = getVisibleNodeIds(null, isolatedCommunityId, null);
        fitSigmaNodeSet(sigmaRef.current, graph, containerRef.current, visibleIds);
      } else {
        const revealedItems = new Set(hiddenItems);
        revealedItems.delete(id);
        setHiddenItems((previous) => {
          const next = new Set(previous);
          next.delete(id);
          return next;
        });
        setIsolatedLegendItem(id);
        const targetIds = getVisibleNodeIds(id, isolatedCommunityId, id, revealedItems);
        fitSigmaNodeSet(sigmaRef.current, graph, containerRef.current, targetIds);
      }
    },
    [graph, hiddenItems, isolatedLegendItem, isolatedCommunityId, setHiddenItems, setIsolatedLegendItem, getVisibleNodeIds]
  );

  // Initialize Sigma v4 Renderer on Container & Graph change
  useEffect(() => {
    // `autoRescale: "once"` snapshots Sigma's normalization when the renderer
    // is constructed. Waiting for the shared graph's static layout prevents an
    // empty/stale snapshot from also poisoning the automatic label grid.
    if (!isReady || !containerRef.current || !graph) return;
    hasInitialFitRef.current = false;

    if (sigmaRef.current) {
      sigmaRef.current.kill();
      sigmaRef.current = null;
    }

    const sigmaInstance = new Sigma(graph, containerRef.current, {
      primitives: SIGMA_PRIMITIVES,
      styles: SIGMA_STYLES as any,
      settings: {
        allowInvalidContainer: true,
        itemSizesReference: 'screen',
        zoomToSizeRatioFunction: () => 1,
        autoRescale: 'once',
        hideEdgesOnMove: false,
        hideLabelsOnMove: false,
        renderEdgeLabels: false,
        enableEdgeEvents: false,
        enableNodeDrag: true,
        renderLabels: shouldRenderLabels,
        labelRenderedSizeThreshold: 0,
        labelDensity: 1,
        labelGridCellSize: 100,
      },
      nodeReducer: createSigmaNodeReducer(styleRefs),
      edgeReducer: createSigmaEdgeReducer(graph, styleRefs),
    });

    sigmaRef.current = sigmaInstance;
    onRendererReady?.(sigmaInstance);

    registerSigmaInteractions({
      sigma: sigmaInstance,
      graph,
      displayMap,
      clickedNodeRef,
      beginDrag,
      movePinnedNode,
      endDrag,
      onElementDoubleClick,
      onClearSelection,
      setClickedNode,
      setClickedDegree,
      setClickedEdge,
      setTooltip,
    });

    return () => {
      if (sigmaRef.current) {
        onRendererReady?.(null);
        sigmaRef.current.kill();
        sigmaRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, graph, directed, bipartite, beginDrag, movePinnedNode, endDrag]);

  // The shared Graphology graph is populated and statically laid out in a
  // parent effect. Fit once only after that readiness signal reaches this
  // mounted renderer (including every D3 -> Sigma switch).
  useEffect(() => {
    if (!isReady || !sigmaRef.current || hasInitialFitRef.current) return;
    const sigma = sigmaRef.current;

    const fitAfterFirstRender = () => {
      if (hasInitialFitRef.current || sigmaRef.current !== sigma) return;
      hasInitialFitRef.current = true;
      const visibleIds = getVisibleNodeIds();
      fitSigmaNodeSet(sigma, graph, containerRef.current, visibleIds, 0);
    };

    sigma.once('afterRender', fitAfterFirstRender);
    return () => {
      sigma.off('afterRender', fitAfterFirstRender);
    };
  }, [isReady, graph, getVisibleNodeIds]);

  // UI/context styling changes get one reducer reprocessing request. Position
  // updates continue through Sigma's normal Graphology lifecycle only.
  useEffect(() => {
    const sigma = sigmaRef.current;
    if (!sigma) return;

    styleRefs.current.showNodeLabels = showNodeLabels;
    // The constructor already consumed the current reducer state and settings.
    // Do not immediately clear/rebuild its freshly computed `autoRescale: once`
    // extent on this effect's first run for a new renderer.
    if (styledSigmaRef.current !== sigma) {
      styledSigmaRef.current = sigma;
      return;
    }

    if (sigma.getSetting('renderLabels') !== shouldRenderLabels) {
      // Sigma v4's full setting refresh clears its transient node extent. Keep
      // the already-computed one as the renderer's fixed custom bounding box so
      // `autoRescale: once` remains stable across label toggles.
      if (!sigma.getCustomBBox()) sigma.setCustomBBox(sigma.getBBox());
      // setSetting performs the one required scheduled reprocessing itself.
      sigma.setSetting('renderLabels', shouldRenderLabels);
    } else {
      // Re-run reducers and rebuild the label grid without clearing the frozen
      // extent. This is one scheduled request for each logical UI change.
      sigma.scheduleRefresh({
        partialGraph: {
          nodes: graph.nodes(),
          edges: graph.edges(),
        },
        // Arrowheads and straight/curved paths select different v4 primitive
        // programs. They must be re-indexed rather than repainted in-place.
        // Hidden nodes remain valid transparent slots in the node reducer, so
        // element isolation does not reintroduce the old zero-index ghost.
        skipIndexation: false,
      });
    }
  }, [
    clickedNode,
    clickedEdge,
    selectedElement,
    focusRequest,
    searchQuery,
    hiddenLegendItems,
    isolatedLegendItem,
    selectedCommunityId,
    isolatedCommunityId,
    hoveredCommunityId,
    showArrowheads,
    showNodeLabels,
    nodeOpacity,
    edgeOpacity,
    isDarkMode,
    displayMap,
    shouldRenderLabels,
    graph,
  ]);

  const handleLegendClick = useCallback((e: React.MouseEvent, id: string, categoryIds: string[]) => {
    e.stopPropagation();
    setHiddenItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, [setHiddenItems]);

  const handleCommunitySingleClick = useCallback((id: string) => {
    setHiddenItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, [setHiddenItems]);

  const handleElementSingleClick = useCallback((id: string) => {
    setHiddenItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, [setHiddenItems]);

  // Selected element context. Table-originated camera focus is handled by the
  // requestId-based effect below so repeated double-clicks always work.
  useEffect(() => {
    if (!selectedElement || !sigmaRef.current || !graph || isCalculatingLayout) return;

    if (graph.hasNode(selectedElement)) {
      const rawNode = graph.getNodeAttribute(selectedElement, 'rawNode');
      if (rawNode) {
        setClickedNode(rawNode);
        setClickedDegree(graph.degree(selectedElement));
      }
      if (focusRequest?.id !== selectedElement) {
        fitSigmaNodeSet(sigmaRef.current, graph, containerRef.current, [selectedElement]);
      }
    } else {
      const edge = edges.find((candidate) => {
        const forward = `${candidate.source}-${candidate.target}`;
        const reverse = `${candidate.target}-${candidate.source}`;
        return selectedElement === forward || (!directed && selectedElement === reverse);
      });
      if (edge && focusRequest?.id !== selectedElement) {
        fitSigmaNodeSet(sigmaRef.current, graph, containerRef.current, [edge.source, edge.target]);
      }
    }
  }, [selectedElement, isCalculatingLayout, graph, edges, directed, focusRequest]);

  // Data Table -> Graph focus waits for the hidden Sigma container to become
  // visible, using animation frames rather than an arbitrary delay.
  useEffect(() => {
    if (!focusRequest || !sigmaRef.current || !graph) return;

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
      fitSigmaNodeSet(sigmaRef.current, graph, container, nodeIds);
    };

    frameId = requestAnimationFrame(focusWhenVisible);
    return () => cancelAnimationFrame(frameId);
  }, [focusRequest, graph]);

  return (
    <div className="w-full h-full relative cursor-crosshair">
      <div ref={containerRef} id="network-graph-sigma" className="w-full h-full block" />

      <GraphControlOverlay
        isDarkMode={isDarkMode}
        onZoomFit={handleZoomFit}
        onResetView={handleResetView}
        onRefreshGraph={() => {
          onRefresh && onRefresh();
        }}
        isCalculatingLayout={isCalculatingLayout}
        activeRenderer="sigma"
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
