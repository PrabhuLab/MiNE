'use client';

/* eslint-disable react-hooks/set-state-in-effect */

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import type Graph from 'graphology';
import Sigma from 'sigma';
import {
  sdfCircle,
  sdfSquare,
  pathLine,
  pathCurved,
  extremityArrow,
} from 'sigma/rendering';
import { layerBorder } from '@sigma/node-border';
import { DEFAULT_PRIMITIVES } from 'sigma/primitives';
import { DEFAULT_STYLES } from 'sigma/types';
import { useStore, RawNode, RawEdge } from '@/store/useStore';
import GraphLegend from '@/components/graph/GraphLegend';
import GraphControlOverlay from '@/components/graph/GraphControlOverlay';
import NodeDetailsSidebar from '@/components/graph/NodeDetailsSidebar';
import GraphTooltip, { TooltipData } from '@/components/graph/GraphTooltip';
import { useGraphStyles } from '@/hooks/useGraphStyles';

// Native Sigma v4 SDF Primitives Configuration with LayerBorder and Fill
const SIGMA_PRIMITIVES = {
  ...DEFAULT_PRIMITIVES,
  depthLayers: [
    'dimmedEdges',
    'edges',
    'activeEdges',
    'topEdges',
    'dimmedNodes',
    'nodes',
    'activeNodes',
    'topNodes',
  ],
  nodes: {
    ...DEFAULT_PRIMITIVES.nodes,
    shapes: [sdfCircle(), sdfSquare()],
    variables: {
      borderColor: {
        type: 'color' as const,
        default: '#ffffff',
      },
    },
    layers: [
      layerBorder({
        borders: [
          {
            size: 1,
            mode: 'pixels',
            color: { attribute: 'borderColor' },
          },
          {
            size: 0,
            fill: true,
            color: { attribute: 'color' },
          },
        ],
      }),
    ],
  },
  edges: {
    ...DEFAULT_PRIMITIVES.edges,
    paths: [pathLine(), pathCurved()],
    extremities: [extremityArrow()],
  },
};

// Explicit Sigma v4 Styles Mapping using Ordered Rule Arrays
const SIGMA_STYLES = {
  nodes: [
    DEFAULT_STYLES.nodes,
    {
      shape: { attribute: 'shape' },
      size: { attribute: 'size' },
      color: { attribute: 'color' },
      opacity: { attribute: 'opacity' },
      borderColor: { attribute: 'borderColor' },
      labelColor: { attribute: 'labelColor' },
      depth: { attribute: 'depth' },
    },
  ],
  edges: [
    DEFAULT_STYLES.edges,
    {
      size: { attribute: 'size' },
      color: { attribute: 'color' },
      opacity: { attribute: 'opacity' },
      path: { attribute: 'path' },
      head: { attribute: 'head' },
      depth: { attribute: 'depth' },
    },
  ],
};

function checkIsSecondary(node: any, isBipartite: boolean): boolean {
  if (!isBipartite || !node) return false;
  if (node.partitionIndex !== undefined && node.partitionIndex !== null) return Number(node.partitionIndex) === 1;
  const t = String(node.type || '').toUpperCase();
  const g = String(node.group || '').toUpperCase();
  const b = String(node.bipartite || '').toUpperCase();
  const s = String(node.set || '').toUpperCase();
  const p = String(node.partition || '').toUpperCase();
  return p === '1' || p === 'B' || p === 'SECONDARY' || t === 'B' || t === 'SECONDARY' || g === '1' || g === 'B' || b === '1' || b === 'B' || b === 'SECONDARY' || s === '1' || s === 'B';
}

const CAMERA_MS = 200;

interface GraphFocusRequest {
  id: string;
  type: 'node' | 'edge';
  requestId: number;
  source?: string;
  target?: string;
}

function fitSigmaNodeSet(
  sigma: Sigma | null,
  graph: Graph,
  container: HTMLDivElement | null,
  nodeIds: string[],
  duration = CAMERA_MS
) {
  if (!sigma || !graph || !container) return;
  // A renderer hidden by the Data tab can retain a 1x1 internal viewport.
  // Resize after it becomes visible before doing any coordinate conversion.
  sigma.resize();
  const { width, height } = sigma.getDimensions();
  if (width <= 0 || height <= 0) return;

  const camera = sigma.getCamera();

  if (!nodeIds || nodeIds.length === 0) {
    camera.animate({ x: 0.5, y: 0.5, ratio: 1, angle: 0 }, { duration });
    return;
  }

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  let validCount = 0;

  for (const id of nodeIds) {
    if (!graph.hasNode(id)) continue;
    const rawX = Number(graph.getNodeAttribute(id, 'x'));
    const rawY = Number(graph.getNodeAttribute(id, 'y'));
    if (!isFinite(rawX) || !isFinite(rawY)) continue;

    const viewportPoint = sigma.graphToViewport({ x: rawX, y: rawY });

    if (isFinite(viewportPoint.x) && isFinite(viewportPoint.y)) {
      minX = Math.min(minX, viewportPoint.x);
      maxX = Math.max(maxX, viewportPoint.x);
      minY = Math.min(minY, viewportPoint.y);
      maxY = Math.max(maxY, viewportPoint.y);
      validCount++;
    }
  }

  if (validCount === 0 || minX === Infinity || !isFinite(minX) || !isFinite(minY)) {
    camera.animate({ x: 0.5, y: 0.5, ratio: 1, angle: 0 }, { duration });
    return;
  }

  const viewportCenter = {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
  };
  const framedCenter = sigma.viewportToFramedGraph(viewportCenter);

  if (validCount === 1) {
    camera.animate({ x: framedCenter.x, y: framedCenter.y, ratio: 0.25, angle: 0 }, { duration });
    return;
  }

  const spanX = Math.abs(maxX - minX);
  const spanY = Math.abs(maxY - minY);

  const curRatio = camera.ratio;

  if (!isFinite(curRatio) || curRatio <= 0) {
    camera.animate({ x: framedCenter.x, y: framedCenter.y, ratio: 0.5, angle: 0 }, { duration });
    return;
  }

  const paddingFactor = 0.75;
  const stagePadding = Number(sigma.getSetting('stagePadding')) || 0;
  const availableWidth = Math.max(1, (width - stagePadding * 2) * paddingFactor);
  const availableHeight = Math.max(1, (height - stagePadding * 2) * paddingFactor);
  const ratioX = (spanX / availableWidth) * curRatio;
  const ratioY = (spanY / availableHeight) * curRatio;
  let targetRatio = Math.max(ratioX, ratioY);

  if (!isFinite(targetRatio) || targetRatio <= 0) targetRatio = 0.5;
  targetRatio = camera.getBoundedRatio(targetRatio);

  camera.animate(
    { x: framedCenter.x, y: framedCenter.y, ratio: targetRatio, angle: 0 },
    { duration }
  );
}

interface SigmaGraphProps {
  graph: Graph;
  isReady?: boolean;
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
  focusRequest?: GraphFocusRequest | null;
  onSwitchRenderer?: (engine: 'd3' | 'sigma') => void;
  isRendererSwitching?: boolean;
  beginDrag?: (id: string, x: number, y: number) => void;
  movePinnedNode?: (id: string, x: number, y: number) => void;
  endDrag?: (id: string) => void;
  onRendererReady?: (renderer: Sigma | null) => void;
}

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
      if (nodeId.toLowerCase().includes(q) || (attrs.rawNode?.name && attrs.rawNode.name.toLowerCase().includes(q))) {
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
      map.set(id, checkIsSecondary(attrs.rawNode, bipartite));
    });
    return map;
  }, [graph, bipartite]);

  // Dynamic Global Label Gating
  const shouldRenderLabels = useMemo(() => {
    return Boolean(showNodeLabels || selectedElement || clickedNode || searchQuery.trim());
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

  const displayMap = communityDisplay.displayMap;

  const styleRefs = useRef({
    getNodeColor,
    getEdgeColor,
    getEdgeOpacity,
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
  });

  useEffect(() => {
    styleRefs.current = {
      getNodeColor,
      getEdgeColor,
      getEdgeOpacity,
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
    };
  }, [
    getNodeColor,
    getEdgeColor,
    getEdgeOpacity,
    nodeOpacity,
    hiddenItems,
    isolatedLegendItem,
    selectedCommunityId,
    isolatedCommunityId,
    hoveredCommunityId,
    displayMap,
    searchQuery,
    directed,
    showNodeLabels,
    selectedNeighborSet,
    searchMatchSet,
    isSecondaryMap,
  ]);

  const checkIsNodeVisible = useCallback(
    (nodeKey: string, attrs: any, isoCommOverride?: string | null, isoLegOverride?: string | null): boolean => {
      const rawNode = attrs.rawNode;
      const isSecondary = checkIsSecondary(rawNode, bipartite);
      const activeHidden = hiddenItems;
      const activeIsolated = isoLegOverride !== undefined ? isoLegOverride : isolatedLegendItem;
      const activeIsoComm = isoCommOverride !== undefined ? isoCommOverride : isolatedCommunityId;
      const dispIdx = displayMap[nodeKey] ?? -1;

      if (activeHidden.has('element:standard') && !isSecondary) return false;
      if (activeHidden.has('element:bipartite') && isSecondary) return false;
      if (activeHidden.has(`community:${dispIdx}`)) return false;
      if (rawNode?.type && activeHidden.has(`type:${rawNode.type}`)) return false;

      if (activeIsoComm) {
        const targetComm = activeIsoComm.replace('community:', '');
        if (String(dispIdx) !== targetComm) return false;
      }

      if (activeIsolated) {
        if (activeIsolated === 'element:standard' && isSecondary) return false;
        if (activeIsolated === 'element:bipartite' && !isSecondary) return false;
        if (activeIsolated.startsWith('type:')) {
          const targetType = activeIsolated.replace('type:', '');
          if (rawNode?.type !== targetType) return false;
        }
        if (activeIsolated.startsWith('community:')) {
          const targetComm = activeIsolated.replace('community:', '');
          if (String(dispIdx) !== targetComm) return false;
        }
      }

      return true;
    },
    [bipartite, hiddenItems, isolatedLegendItem, isolatedCommunityId, displayMap]
  );

  const getVisibleNodeIds = useCallback(
    (targetFilter?: string | null, isoCommOverride?: string | null, isoLegOverride?: string | null) => {
      if (!graph) return [];
      const matchingIds: string[] = [];

      graph.forEachNode((nodeId: string, attrs: any) => {
        if (checkIsNodeVisible(nodeId, attrs, isoCommOverride, isoLegOverride)) {
          if (targetFilter) {
            if (targetFilter.startsWith('community:')) {
              const commTarget = targetFilter.replace('community:', '');
              const dispIdx = displayMap[nodeId] !== undefined ? String(displayMap[nodeId]) : null;
              if (dispIdx !== commTarget && communityMap[nodeId] !== commTarget) return;
            } else if (targetFilter.startsWith('type:')) {
              const typeTarget = targetFilter.replace('type:', '');
              if (attrs.rawNode?.type !== typeTarget) return;
            } else if (targetFilter === 'element:bipartite') {
              const isSecondary = checkIsSecondary(attrs.rawNode, bipartite);
              if (!isSecondary) return;
            } else if (targetFilter === 'element:standard') {
              const isSecondary = checkIsSecondary(attrs.rawNode, bipartite);
              if (isSecondary) return;
            }
          }
          matchingIds.push(nodeId);
        }
      });

      return matchingIds;
    },
    [graph, checkIsNodeVisible, displayMap, communityMap, bipartite]
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

    const visibleIds = getVisibleNodeIds(null, null, null);
    fitSigmaNodeSet(sigmaRef.current, graph, containerRef.current, visibleIds);
  }, [
    graph,
    setIsolatedCommunityId,
    setSelectedCommunityId,
    setIsolatedLegendItem,
    setHoveredCommunityId,
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
        setIsolatedCommunityId(commId);
        setSelectedCommunityId(commId);
        const targetIds = getVisibleNodeIds(commId, commId, isolatedLegendItem);
        fitSigmaNodeSet(sigmaRef.current, graph, containerRef.current, targetIds);
      }
    },
    [graph, isolatedCommunityId, isolatedLegendItem, setIsolatedCommunityId, setSelectedCommunityId, getVisibleNodeIds]
  );

  const handleElementDoubleClick = useCallback(
    (id: string) => {
      if (!graph) return;
      if (isolatedLegendItem === id) {
        setIsolatedLegendItem(null);
        const visibleIds = getVisibleNodeIds(null, isolatedCommunityId, null);
        fitSigmaNodeSet(sigmaRef.current, graph, containerRef.current, visibleIds);
      } else {
        setIsolatedLegendItem(id);
        const targetIds = getVisibleNodeIds(id, isolatedCommunityId, id);
        fitSigmaNodeSet(sigmaRef.current, graph, containerRef.current, targetIds);
      }
    },
    [graph, isolatedLegendItem, isolatedCommunityId, setIsolatedLegendItem, getVisibleNodeIds]
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
      nodeReducer: (nodeKey, data: any) => {
        const {
          hiddenItems: currentHidden,
          isolatedLegendItem: currentIsolated,
          selectedCommunityId: currentSelComm,
          isolatedCommunityId: currentIsoComm,
          hoveredCommunityId: currentHovComm,
          displayMap: currentDispMap,
          clickedNodeRef: currentClickedNodeRef,
          showNodeLabels: isShowNodeLabels,
          selectedNeighborSet: currentNeighbors,
          searchMatchSet: currentMatches,
          isSecondaryMap: currentSecondaryMap,
        } = styleRefs.current;

        const dispIdx = currentDispMap[nodeKey] ?? -1;
        const isSecondary = currentSecondaryMap.get(nodeKey);

        const res = { ...data };
        res.visibility = 'visible';
        res.labelVisibility = 'hidden';

        if (currentHidden.has('element:standard') && !isSecondary) {
          res.visibility = 'hidden';
          return res;
        }
        if (currentHidden.has('element:bipartite') && isSecondary) {
          res.visibility = 'hidden';
          return res;
        }

        if (currentHidden.has(`community:${dispIdx}`)) {
          res.visibility = 'hidden';
          return res;
        }
        
        const type = data.rawNode?.type;
        if (type && currentHidden.has(`type:${type}`)) {
          res.visibility = 'hidden';
          return res;
        }

        if (currentIsolated) {
          if (currentIsolated === 'element:standard' && isSecondary) {
            res.visibility = 'hidden';
            return res;
          }
          if (currentIsolated === 'element:bipartite' && !isSecondary) {
            res.visibility = 'hidden';
            return res;
          }
          if (currentIsolated.startsWith('type:')) {
            const targetType = currentIsolated.replace('type:', '');
            if (type !== targetType) {
              res.visibility = 'hidden';
              return res;
            }
          }
          if (currentIsolated.startsWith('community:')) {
            const targetComm = currentIsolated.replace('community:', '');
            if (String(dispIdx) !== targetComm) {
              res.visibility = 'hidden';
              return res;
            }
          }
        }

        let isDimmed = false;
        let isFocused = false;
        let isNeighbor = false;
        let isCommMember = false;

        const activeCommFilter = currentHovComm || currentSelComm || currentIsoComm || (currentIsolated && currentIsolated.startsWith('community:') ? currentIsolated : null);
        if (activeCommFilter) {
          const targetComm = activeCommFilter.replace('community:', '');
          if (String(dispIdx) === targetComm) {
            isCommMember = true;
          } else {
            isDimmed = true;
          }
        }

        const selNode = currentClickedNodeRef.current;
        if (selNode) {
          const selId = selNode.id;
          if (nodeKey === selId) {
            isFocused = true;
            res.highlighted = true;
          } else if (currentNeighbors.has(nodeKey)) {
            isNeighbor = true;
          } else {
            isDimmed = true;
          }
        }

        if (currentMatches.size > 0) {
          if (!currentMatches.has(nodeKey)) {
            isDimmed = true;
          } else {
            isFocused = true;
            res.highlighted = true;
          }
        }

        if (isFocused) {
          res.depth = 'topNodes';
        } else if (isNeighbor || isCommMember) {
          res.depth = 'activeNodes';
        } else if (isDimmed) {
          res.depth = 'dimmedNodes';
        } else {
          res.depth = 'nodes';
        }

        const dimFactor = 0.1;
        res.opacity = isDimmed ? (data.opacity ?? 1) * dimFactor : (data.opacity ?? 1);
        
        res.label = data.rawNode?.name || data.rawNode?.label || nodeKey;

        if (res.visibility === 'hidden') {
          res.labelVisibility = 'hidden';
        } else if (isFocused || isNeighbor) {
          res.labelVisibility = 'visible';
        } else if (activeCommFilter) {
          res.labelVisibility = isCommMember
            ? (isShowNodeLabels ? 'auto' : 'visible')
            : 'hidden';
        } else if (isShowNodeLabels) {
          res.labelVisibility = 'auto';
        } else {
          res.labelVisibility = 'hidden';
        }

        return res;
      },
      edgeReducer: (edgeKey, data: any) => {
        const {
          hiddenItems: currentHidden,
          clickedNodeRef: currentClickedNodeRef,
          clickedEdgeRef: currentClickedEdgeRef,
          directed: currentDirected,
          selectedCommunityId: currentSelComm,
          isolatedCommunityId: currentIsoComm,
          hoveredCommunityId: currentHovComm,
          isolatedLegendItem: currentIsolated,
          displayMap: currentDispMap,
        } = styleRefs.current;

        const res = { ...data };
        res.visibility = 'visible';

        if (currentHidden.has('element:edges')) {
          res.visibility = 'hidden';
          return res;
        }

        const [s, t] = graph.extremities(edgeKey);
        let isDimmed = false;
        let isFocusedEdge = false;

        const selNode = currentClickedNodeRef.current;
        if (selNode) {
          const selId = selNode.id;
          if (s === selId || t === selId) {
            isFocusedEdge = true;
          } else {
            isDimmed = true;
          }
        } else if (currentClickedEdgeRef.current) {
          const cSrc = currentClickedEdgeRef.current.source;
          const cTgt = currentClickedEdgeRef.current.target;
          if ((s === cSrc && t === cTgt) || (!currentDirected && s === cTgt && t === cSrc)) {
            isFocusedEdge = true;
          } else {
            isDimmed = true;
          }
        } else {
          const activeCommFilter = currentHovComm || currentSelComm || currentIsoComm || (currentIsolated && currentIsolated.startsWith('community:') ? currentIsolated : null);
          if (activeCommFilter) {
            const targetComm = activeCommFilter.replace('community:', '');
            const sComm = String(currentDispMap[s] ?? -1);
            const tComm = String(currentDispMap[t] ?? -1);
            if (sComm === targetComm && tComm === targetComm) {
              isFocusedEdge = true;
            } else if (sComm !== targetComm && tComm !== targetComm) {
              isDimmed = true;
            }
          }
        }

        const edgeDimFactor = 0.1;
        if (isFocusedEdge) {
          res.depth = 'topEdges';
          res.opacity = Math.min(1, (data.opacity ?? 1) * 1.5);
        } else if (isDimmed) {
          res.depth = 'dimmedEdges';
          res.opacity = (data.opacity ?? 1) * edgeDimFactor;
        } else {
          res.depth = 'edges';
          res.opacity = data.opacity;
        }

        return res;
      }
    });

    sigmaRef.current = sigmaInstance;
    onRendererReady?.(sigmaInstance);

    // Streamlined Drag Lifecycle: beginDrag (reheat ONCE on start), movePinnedNode (move only), endDrag
    sigmaInstance.on('nodeDragStart', (e) => {
      if (beginDrag && graph.hasNode(e.node)) {
        beginDrag(e.node, graph.getNodeAttribute(e.node, 'x'), graph.getNodeAttribute(e.node, 'y'));
      }
    });

    sigmaInstance.on('nodeDrag', (e) => {
      if (movePinnedNode && graph.hasNode(e.node)) {
        movePinnedNode(e.node, graph.getNodeAttribute(e.node, 'x'), graph.getNodeAttribute(e.node, 'y'));
      }
    });

    sigmaInstance.on('nodeDragEnd', (e) => {
      if (endDrag) {
        endDrag(e.node);
      }
    });

    sigmaInstance.on('enterNode', (e) => {
      const nodeKey = e.node;
      const attrs = graph.getNodeAttributes(nodeKey);
      const rawNode = attrs.rawNode;
      const degree = graph.degree(nodeKey);
      const dispIdx = displayMap[nodeKey] ?? -1;

      const items: { label: string; value: string | number }[] = [];
      if (rawNode?.type) items.push({ label: 'Type', value: rawNode.type });
      items.push({ label: 'Community', value: dispIdx >= 0 ? dispIdx : 'N/A' });
      items.push({ label: 'Abundance', value: rawNode?.abundance ?? 'N/A' });
      items.push({ label: 'Degree', value: degree });

      setTooltip({
        x: e.event.x,
        y: e.event.y,
        title: rawNode?.name || rawNode?.label || nodeKey,
        items
      });
    });

    sigmaInstance.on('leaveNode', () => {
      setTooltip(null);
    });

    sigmaInstance.on('clickNode', (e) => {
      const nodeKey = e.node;
      if (clickedNodeRef.current && clickedNodeRef.current.id === nodeKey) {
        setClickedNode(null);
        setClickedEdge(null);
      } else {
        const rawNode = graph.getNodeAttribute(nodeKey, 'rawNode');
        setClickedNode(rawNode || { id: nodeKey, name: nodeKey, abundance: 0 });
        setClickedDegree(graph.degree(nodeKey));
        setClickedEdge(null);
      }
    });

    sigmaInstance.on('doubleClickNode', (e) => {
      e.preventSigmaDefault();
      const nodeKey = e.node;
      onElementDoubleClick && onElementDoubleClick(nodeKey, 'node');
    });

    sigmaInstance.on('clickStage', () => {
      setClickedNode(null);
      setClickedEdge(null);
      onClearSelection && onClearSelection();
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
      });
    }
  }, [
    clickedNode,
    clickedEdge,
    selectedElement,
    searchQuery,
    hiddenLegendItems,
    isolatedLegendItem,
    selectedCommunityId,
    isolatedCommunityId,
    hoveredCommunityId,
    showNodeLabels,
    nodeOpacity,
    edgeOpacity,
    isDarkMode,
    displayMap,
    shouldRenderLabels,
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
