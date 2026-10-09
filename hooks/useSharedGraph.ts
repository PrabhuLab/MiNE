'use client';

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useCallback, useState, useMemo, useRef } from 'react';
import Graph from 'graphology';
import { RawNode, RawEdge } from '@/store/useStore';
import { computeForceDirectedLayoutAsync } from '@/services/layouts/d3Worker';
import { updateGraphColors } from '@/services/graphStyles/colors';
import { isSecondaryNode } from '@/services/graphPresentation/visibility';
import { computeGraphRevisions } from '@/services/cloud/revision';
import { shouldUseCloud, type ComputeEngine } from '@/services/cloud/config';
import type { LayoutResult } from '@/services/layouts/types';

export type PositionSource = 'imported' | 'local-static' | 'local-live' | 'cloud-static' | 'pending-cloud';

interface UseSharedGraphProps {
  nodes: RawNode[];
  edges: RawEdge[];
  directed: boolean;
  bipartite: boolean;
  forceStrength?: number;
  livePhysics?: boolean;
  computeEngine?: ComputeEngine;
  graphRevision?: string;
  weightAttribute?: string;
  isDarkMode?: boolean;
  getNodeColor: (node: any) => string;
  getNodeSize: (node: any) => number;
  getEdgeColor: (edge: any) => string;
  getEdgeSize: (edge: any) => number;
  getEdgeOpacity: (edge: any) => number;
  getShouldShowArrowhead: (edge: any) => boolean;
  nodeOpacity?: number;
}

const finitePosition = (value: any): value is { x: number; y: number } => Number.isFinite(Number(value?.x)) && Number.isFinite(Number(value?.y));

export function useSharedGraph({
  nodes, edges, directed, bipartite, forceStrength = -100, livePhysics = false,
  computeEngine = 'auto', graphRevision, weightAttribute = 'weight_raw', isDarkMode, getNodeColor, getNodeSize, getEdgeColor,
  getEdgeSize, getEdgeOpacity, getShouldShowArrowhead, nodeOpacity = 1,
}: UseSharedGraphProps) {
  const graph: Graph = useMemo(() => new (Graph as any)({ type: directed ? 'directed' : 'undirected', multi: false }), [directed]);
  const revisions = useMemo(() => computeGraphRevisions(nodes, edges, directed, true, weightAttribute), [nodes, edges, directed, weightAttribute]);
  const topologyKey = revisions.graphRevision;
  const cloudRouted = shouldUseCloud(nodes.length, edges.length, computeEngine);
  const [readyGraph, setReadyGraph] = useState<Graph | null>(null);
  const [layoutRevision, setLayoutRevision] = useState(0);
  const [staticLayoutRevision, setStaticLayoutRevision] = useState(0);
  const [positionSource, setPositionSource] = useState<PositionSource>('local-static');
  const [positioningError, setPositioningError] = useState<string | null>(null);
  const lastStaticForceStrengthRef = useRef<number | null>(null);
  const layoutAbortRef = useRef<AbortController | null>(null);
  const positionCacheRef = useRef(new Map<string, { x: number; y: number }>());
  const cacheGraphRevisionRef = useRef(graphRevision);
  const topologyRevisionRef = useRef(topologyKey);
  const committedTopologyRef = useRef<string | null>(null);
  const isReady = readyGraph === graph && positionSource !== 'pending-cloud';

  useEffect(() => {
    topologyRevisionRef.current = topologyKey;
    if (cacheGraphRevisionRef.current !== graphRevision) {
      positionCacheRef.current.clear();
      cacheGraphRevisionRef.current = graphRevision;
      committedTopologyRef.current = null;
    }
  }, [graphRevision, topologyKey]);

  const commitPositions = useCallback((source: PositionSource) => {
    graph.forEachNode((id, attrs) => {
      if (finitePosition(attrs)) positionCacheRef.current.set(id, { x: Number(attrs.x), y: Number(attrs.y) });
    });
    setPositionSource(source);
    committedTopologyRef.current = topologyRevisionRef.current;
    setReadyGraph(graph);
    setLayoutRevision((revision) => revision + 1);
    if (source === 'local-static' || source === 'cloud-static' || source === 'imported') setStaticLayoutRevision((revision) => revision + 1);
  }, [graph]);

  const applyD3StaticLayout = useCallback((graphInst: Graph) => {
    layoutAbortRef.current?.abort();
    const controller = new AbortController();
    layoutAbortRef.current = controller;
    const revision = topologyRevisionRef.current;
    setPositioningError(null);
    void computeForceDirectedLayoutAsync(nodes, edges, directed, forceStrength, controller.signal).then((posMap) => {
      if (controller.signal.aborted || topologyRevisionRef.current !== revision) return;
      graphInst.updateEachNodeAttributes((nodeId: string, attrs: any) => {
        const pos = posMap.get(nodeId);
        return pos ? { ...attrs, x: pos.x, y: pos.y } : attrs;
      }, { attributes: ['x', 'y'] });
      commitPositions('local-static');
    }).catch((cause) => {
      if (!controller.signal.aborted) setPositioningError(cause instanceof Error ? cause.message : String(cause));
    }).finally(() => {
      if (layoutAbortRef.current === controller) layoutAbortRef.current = null;
    });
    return controller;
  }, [nodes, edges, directed, forceStrength, commitPositions]);

  useEffect(() => () => layoutAbortRef.current?.abort(), [graph]);

  const applyExternalPositions = useCallback((result: LayoutResult, expectedRevision: string): void => {
    if (topologyRevisionRef.current !== expectedRevision || result.filterRevision !== expectedRevision) return;
    const ids = graph.nodes();
    if (ids.length !== nodes.length || ids.some((id) => !finitePosition(result.positions[id]))) throw new Error('Cloud layout did not return one finite coordinate pair for every current node.');
    const applyStarted = performance.now();
    graph.updateEachNodeAttributes((nodeId: string, attrs: any) => {
      const position = result.positions[nodeId];
      return { ...attrs, x: position.x, y: position.y };
    }, { attributes: ['x', 'y'] });
    console.info(JSON.stringify({ event: 'mine_cloud_positions_applied', nodes: ids.length, frontendApplicationMs: Number((performance.now() - applyStarted).toFixed(3)) }));
    commitPositions('cloud-static');
  }, [commitPositions, graph, nodes.length]);

  useEffect(() => {
    const strokeColor = isDarkMode ? '#ffffff' : '#141414';
    const targetNodes = new Set(nodes.map((node) => String(node.id)));
    graph.forEachNode((id, attrs) => {
      if (!targetNodes.has(id)) {
        if (finitePosition(attrs)) positionCacheRef.current.set(id, { x: Number(attrs.x), y: Number(attrs.y) });
        graph.dropNode(id);
      }
    });

    let addedUnpositionedNode = false;
    nodes.forEach((node) => {
      const cached = positionCacheRef.current.get(String(node.id));
      const supplied = finitePosition(node) ? { x: Number(node.x), y: Number(node.y) } : cached;
      const presentation = {
        ...node, ...(supplied || {}), size: getNodeSize(node), color: getNodeColor(node), opacity: nodeOpacity,
        borderColor: strokeColor, labelColor: strokeColor, label: node.name || node.label || node.id, rawNode: node,
        shape: isSecondaryNode(node, bipartite) ? 'square' : 'circle',
      };
      if (!graph.hasNode(node.id)) {
        if (!supplied) addedUnpositionedNode = true;
        graph.addNode(node.id, presentation);
      } else Object.assign(graph.getNodeAttributes(node.id), presentation);
    });
    graph.updateEachNodeAttributes((_id, attrs) => attrs, { attributes: ['x', 'y', 'size', 'opacity', 'shape'] });

    const existingEdges = new Set(graph.edges());
    const targetEdgeKeys = new Set<string>();
    edges.forEach((edge) => {
      if (!graph.hasNode(edge.source) || !graph.hasNode(edge.target)) return;
      const existingKey = graph.hasEdge(edge.source, edge.target) ? graph.edge(edge.source, edge.target) : null;
      const attrs = {
        ...edge, size: getEdgeSize(edge), color: getEdgeColor(edge), opacity: getEdgeOpacity(edge),
        path: directed ? 'curved' : 'straight', curvature: directed ? 0.3 : 0,
        head: getShouldShowArrowhead(edge) ? 'arrow' : 'none', rawEdge: edge,
      };
      if (existingKey) { targetEdgeKeys.add(existingKey); Object.assign(graph.getEdgeAttributes(existingKey), attrs); }
      else { try { targetEdgeKeys.add(graph.addEdge(edge.source, edge.target, attrs)); } catch { /* retain first simple edge */ } }
    });
    existingEdges.forEach((key) => { if (!targetEdgeKeys.has(key) && graph.hasEdge(key)) graph.dropEdge(key); });
    // Re-index edge slots: hidden edges have no repaint slot in Sigma 4 beta.
    graph.updateEachEdgeAttributes((_id, attrs) => attrs, { attributes: ['size', 'opacity', 'path', 'head', 'type'] });
    const hasUnpositionedNode = addedUnpositionedNode || graph.someNode((_id, attrs) => !finitePosition(attrs));

    setPositioningError(null);
    if (hasUnpositionedNode) {
      setReadyGraph(null);
      // Rendering is independent from computation routing. Every unpositioned
      // graph starts from MiNE's familiar local D3-force layout; Cloud layouts
      // replace it only after the user explicitly applies one.
      applyD3StaticLayout(graph);
      return () => layoutAbortRef.current?.abort();
    } else {
      setPositionSource((current) => current === 'cloud-static' ? current : 'imported');
      const timeout = setTimeout(() => {
        setReadyGraph(graph);
        if (committedTopologyRef.current === null) {
          committedTopologyRef.current = topologyKey;
          setStaticLayoutRevision((revision) => revision + 1);
        }
      }, 0);
      return () => clearTimeout(timeout);
    }
    // Color changes use the batched effect below. Selection-dependent arrowheads
    // are handled by renderer reducers, so they must not rebuild every edge.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, nodes, edges, directed, bipartite, getNodeSize, getEdgeSize, getEdgeOpacity, nodeOpacity, applyD3StaticLayout, topologyKey, graphRevision]);

  useEffect(() => {
    updateGraphColors(graph, Boolean(isDarkMode), getNodeColor, getEdgeColor);
  }, [graph, nodes, edges, isDarkMode, getNodeColor, getEdgeColor]);

  useEffect(() => {
    if (!isReady) return;
    const repulsion = typeof forceStrength === 'number' ? forceStrength : -100;
    if (livePhysics) { lastStaticForceStrengthRef.current = repulsion; return; }
    if (lastStaticForceStrengthRef.current === null) { lastStaticForceStrengthRef.current = repulsion; return; }
    if (lastStaticForceStrengthRef.current === repulsion) return;
    let controller: AbortController | undefined;
    const timer = setTimeout(() => { controller = applyD3StaticLayout(graph); lastStaticForceStrengthRef.current = repulsion; }, 180);
    return () => { clearTimeout(timer); controller?.abort(); };
  }, [graph, isReady, livePhysics, forceStrength, applyD3StaticLayout]);

  const runRefreshLayout = useCallback(() => {
    setReadyGraph(null);
    applyD3StaticLayout(graph);
  }, [applyD3StaticLayout, graph]);

  const notifyLayoutChange = useCallback(() => { setPositionSource('local-live'); setLayoutRevision((revision) => revision + 1); }, []);

  return {
    graph, isReady, layoutRevision, staticLayoutRevision, topologyKey, positionSource,
    positioningError, cloudRouted, runRefreshLayout, notifyLayoutChange, applyExternalPositions,
  };
}
