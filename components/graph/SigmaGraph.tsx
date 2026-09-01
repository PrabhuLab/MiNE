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
import { isSecondaryNode } from '@/components/graph/sigma/visibility';
import { shouldRenderSigmaLabels } from '@/components/graph/sigma/labels';
import type { SigmaGraphProps } from '@/components/graph/sigma/types';
import { createSigmaEdgeReducer, createSigmaNodeReducer } from '@/components/graph/sigma/reducers';
import { registerSigmaInteractions } from '@/components/graph/sigma/interactions';
import { createElementLegendItems } from '@/components/graph/legend/elementItems';
import { computeGraphLegendVisibility } from '@/services/graphPresentation/legendVisibility';

export default function SigmaGraph({
  graph,
  isReady = false,
  staticLayoutRevision = 0,
  nodes,
  edges,
  communityMap,
  networkMetrics = [],
  nodeSizeMult,
  bipartiteNodeSizeMult = 2,
  nodeSizeBase = 'degree',
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
  const lastIndexationSignatureRef = useRef('');
  const hasInitialFitRef = useRef(false);
  const sigmaConstructionStartedRef = useRef(0);

  const [clickedNode, setClickedNode] = useState<RawNode | null>(null);
  const [clickedDegree, setClickedDegree] = useState<number>(0);
  const [clickedEdge, setClickedEdge] = useState<RawEdge | null>(null);
  const [isCalculatingLayout, setIsCalculatingLayout] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

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
    isLegendMinimized,
    setIsLegendMinimized,
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
    return new Map(nodes.map((node) => [String(node.id), isSecondaryNode(node, bipartite)]));
  }, [nodes, bipartite]);

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
    legendMetricScales,
    legendNodeMembership,
    legendEdgeMembership,
    getNodeColor,
    getEdgeColor,
    getEdgeOpacity,
    getShouldShowArrowhead,
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

  const displayMap = communityDisplay.displayMap;
  const edgeVisibilityRecords = useMemo(() => edges.map((edge) => ({
    id: String(edge.key ?? `${edge.source}->${edge.target}`),
    source: String(edge.source),
    target: String(edge.target),
  })), [edges]);
  const legendVisibility = useMemo(() => computeGraphLegendVisibility({
    nodes,
    edges: edgeVisibilityRecords,
    bipartite,
    isSecondaryNode: (node) => isSecondaryNode(node as RawNode, bipartite),
    displayMap,
    hiddenItemIds: hiddenItems,
    isolatedItemId: isolatedLegendItem || isolatedCommunityId,
    nodeMembership: legendNodeMembership,
    edgeMembership: legendEdgeMembership,
  }), [bipartite, displayMap, edgeVisibilityRecords, hiddenItems, isolatedCommunityId, isolatedLegendItem, legendEdgeMembership, legendNodeMembership, nodes]);
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
    legendNodeMembership,
    legendEdgeMembership,
    legendVisibility,
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
      legendNodeMembership,
      legendEdgeMembership,
      legendVisibility,
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
    legendNodeMembership,
    legendEdgeMembership,
    legendVisibility,
  ]);

  const getVisibleNodeIds = useCallback(
    (
      targetFilter?: string | null,
      isoCommOverride?: string | null,
      isoLegOverride?: string | null,
      hiddenOverride?: Set<string>,
    ) => {
      const isolatedCommunity = isoCommOverride !== undefined ? isoCommOverride : isolatedCommunityId;
      const isolatedLegend = isoLegOverride !== undefined ? isoLegOverride : isolatedLegendItem;
      const visibility = computeGraphLegendVisibility({
        nodes,
        edges: edgeVisibilityRecords,
        bipartite,
        isSecondaryNode: (node) => isSecondaryNode(node as RawNode, bipartite),
        displayMap,
        hiddenItemIds: hiddenOverride ?? hiddenItems,
        isolatedItemId: isolatedLegend || isolatedCommunity,
        nodeMembership: legendNodeMembership,
        edgeMembership: legendEdgeMembership,
      });
      return Array.from(visibility.visibleNodeIds).filter((nodeId) => {
        if (!targetFilter) return true;
        const node = nodes.find((candidate) => String(candidate.id) === nodeId);
        if (targetFilter.startsWith('community:')) return String(displayMap[nodeId] ?? -1) === targetFilter.slice('community:'.length);
        if (targetFilter.startsWith('type:')) return String(node?.type) === targetFilter.slice('type:'.length);
        if (targetFilter.startsWith('attribute:')) return legendNodeMembership.get(targetFilter)?.has(nodeId) ?? visibility.visibleNodeIds.has(nodeId);
        if (targetFilter === 'element:bipartite') return Boolean(node && isSecondaryNode(node, bipartite));
        if (targetFilter === 'element:standard') return Boolean(node && !isSecondaryNode(node, bipartite));
        return true;
      });
    },
    [bipartite, hiddenItems, isolatedLegendItem, isolatedCommunityId, displayMap, legendNodeMembership, legendEdgeMembership, nodes, edgeVisibilityRecords]
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
    setHoveredCommunityId(null);
    setClickedNode(null);
    setClickedEdge(null);
    onClearSelection?.();

    const visibleIds = getVisibleNodeIds(null, null, null, hiddenItems);
    fitSigmaNodeSet(sigmaRef.current, graph, containerRef.current, visibleIds);
  }, [
    graph,
    setIsolatedCommunityId,
    setSelectedCommunityId,
    setIsolatedLegendItem,
    setHoveredCommunityId,
    onClearSelection,
    getVisibleNodeIds,
    hiddenItems,
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
        const targetIds = getVisibleNodeIds(null, commId, isolatedLegendItem, revealedItems);
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
        const targetIds = getVisibleNodeIds(null, isolatedCommunityId, id, revealedItems);
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
    sigmaConstructionStartedRef.current = performance.now();
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
  }, [isReady, staticLayoutRevision, graph, directed, bipartite, beginDrag, movePinnedNode, endDrag]);

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
      console.info(JSON.stringify({ event: 'mine_sigma_first_render', nodes: graph.order, edges: graph.size, sigmaFirstRenderMs: Number((performance.now() - sigmaConstructionStartedRef.current).toFixed(3)), staticLayoutRevision }));
    };

    sigma.once('afterRender', fitAfterFirstRender);
    return () => {
      sigma.off('afterRender', fitAfterFirstRender);
    };
  }, [isReady, staticLayoutRevision, graph, getVisibleNodeIds]);

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
      lastIndexationSignatureRef.current = JSON.stringify({
        clickedNode: clickedNode?.id ?? null,
        clickedEdge: clickedEdge ? `${clickedEdge.source}->${clickedEdge.target}` : null,
        selectedElement,
        focus: focusRequest?.requestId ?? null,
        isolatedLegendItem,
        selectedCommunityId,
        isolatedCommunityId,
        showArrowheads,
      });
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
      const indexationSignature = JSON.stringify({
        clickedNode: clickedNode?.id ?? null,
        clickedEdge: clickedEdge ? `${clickedEdge.source}->${clickedEdge.target}` : null,
        selectedElement,
        focus: focusRequest?.requestId ?? null,
        isolatedLegendItem,
        selectedCommunityId,
        isolatedCommunityId,
        showArrowheads,
      });
      const needsIndexation = lastIndexationSignatureRef.current !== indexationSignature;
      lastIndexationSignatureRef.current = indexationSignature;
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
        skipIndexation: !needsIndexation,
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
