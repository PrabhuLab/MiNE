'use client';

import { useEffect, useCallback, useState, useMemo, useRef } from 'react';
import Graph from 'graphology';
import { RawNode, RawEdge } from '@/store/useStore';
import { computeForceDirectedLayout } from '@/lib/layoutUtils';
import { isSecondaryNode } from '@/services/graphPresentation/visibility';

interface UseSharedGraphProps {
  nodes: RawNode[];
  edges: RawEdge[];
  directed: boolean;
  bipartite: boolean;
  forceStrength?: number;
  livePhysics?: boolean;
  isDarkMode?: boolean;
  getNodeColor: (node: any) => string;
  getNodeSize: (node: any) => number;
  getEdgeColor: (edge: any) => string;
  getEdgeSize: (edge: any) => number;
  getEdgeOpacity: (edge: any) => number;
  getShouldShowArrowhead: (edge: any) => boolean;
  nodeOpacity?: number;
}

export function useSharedGraph({
  nodes,
  edges,
  directed,
  bipartite,
  forceStrength = -100,
  livePhysics = false,
  isDarkMode,
  getNodeColor,
  getNodeSize,
  getEdgeColor,
  getEdgeSize,
  getEdgeOpacity,
  getShouldShowArrowhead,
  nodeOpacity = 1,
}: UseSharedGraphProps) {
  const graph = useMemo(() => {
    return new (Graph as any)({ type: directed ? 'directed' : 'undirected', multi: false });
  }, [directed]);

  const topologyKey = useMemo(
    () => JSON.stringify([
      directed,
      nodes.map((node) => node.id),
      edges.map((edge) => [edge.source, edge.target]),
    ]),
    [directed, nodes, edges]
  );
  const [readyTopologyKey, setReadyTopologyKey] = useState<string | null>(null);
  const [layoutRevision, setLayoutRevision] = useState(0);
  const lastStaticForceStrengthRef = useRef<number | null>(null);
  const isReady = readyTopologyKey === topologyKey;

  // Apply offline D3 force-directed static layout to Graphology graph
  const applyD3StaticLayout = useCallback((graphInst: Graph) => {
    if (!graphInst) return;
    const posMap = computeForceDirectedLayout(nodes, edges, directed, forceStrength);
    graphInst.updateEachNodeAttributes((nodeId: string, attrs: any) => {
      const pos = posMap.get(nodeId);
      return pos ? { ...attrs, x: pos.x, y: pos.y } : attrs;
    }, { attributes: ['x', 'y'] });
    // Notify renderers after Graphology has received the complete position
    // batch; deferring also avoids a cascading React update inside the graph
    // synchronization effect that performs an initial static layout.
    setTimeout(() => setLayoutRevision((revision) => revision + 1), 0);
  }, [nodes, edges, directed, forceStrength]);

  // Initialize or update Graphology graph structure & static D3 layout
  useEffect(() => {
    if (!graph) return;

    const strokeColor = isDarkMode ? '#ffffff' : '#141414';

    // Synchronize Nodes
    const existingNodes = new Set<string>(graph.nodes());
    const targetNodes = new Set<string>(nodes.map((n) => n.id));

    // Remove nodes no longer in target set
    existingNodes.forEach((id) => {
      if (!targetNodes.has(id)) {
        graph.dropNode(id);
      }
    });

    let needsLayout = false;

    nodes.forEach((n) => {
      const size = getNodeSize(n);
      const color = getNodeColor(n);
      const isSecondary = isSecondaryNode(n, bipartite);
      const shape = isSecondary ? 'square' : 'circle';

      if (!graph.hasNode(n.id)) {
        needsLayout = true;
        graph.addNode(n.id, {
          ...n,
          x: n.x,
          y: n.y,
          size,
          color,
          opacity: nodeOpacity,
          borderColor: strokeColor,
          labelColor: strokeColor,
          label: n.name || n.label || n.id,
          rawNode: n,
          shape,
        });
      } else {
        graph.mergeNodeAttributes(n.id, {
          ...n,
          size,
          color,
          opacity: nodeOpacity,
          borderColor: strokeColor,
          labelColor: strokeColor,
          label: n.name || n.label || n.id,
          rawNode: n,
          shape,
        });
      }
    });

    // Synchronize Edges
    const existingEdges = new Set<string>(graph.edges());
    const targetEdgeKeys = new Set<string>();

    edges.forEach((e) => {
      if (graph.hasNode(e.source) && graph.hasNode(e.target)) {
        const edgeKey = graph.hasEdge(e.source, e.target) ? graph.edge(e.source, e.target) : null;
        const color = getEdgeColor(e);
        const opacity = getEdgeOpacity(e);
        const size = getEdgeSize(e);
        const isArrow = getShouldShowArrowhead(e);
        const path = directed ? 'curved' : 'straight';
        const curvature = directed ? 0.3 : 0;

        if (!edgeKey) {
          try {
            const newKey = graph.addEdge(e.source, e.target, {
              ...e,
              size,
              color,
              opacity,
              path,
              curvature,
              head: isArrow ? 'arrow' : 'none',
              rawEdge: e,
            });
            targetEdgeKeys.add(newKey);
          } catch {
            // Ignore parallel edge conflicts
          }
        } else {
          targetEdgeKeys.add(edgeKey);
          graph.mergeEdgeAttributes(edgeKey, {
            ...e,
            size,
            color,
            opacity,
            path,
            curvature,
            head: isArrow ? 'arrow' : 'none',
            rawEdge: e,
          });
        }
      }
    });

    existingEdges.forEach((key) => {
      if (!targetEdgeKeys.has(key) && graph.hasEdge(key)) {
        graph.dropEdge(key);
      }
    });

    // New/unpositioned topology gets one static layout. Explicit refreshes use
    // runRefreshLayout below and must not leave a persistent layout trigger.
    if (needsLayout) {
      applyD3StaticLayout(graph);
    }

    // Schedule readiness notification to avoid cascading render in current tick
    const timeout = setTimeout(() => setReadyTopologyKey(topologyKey), 0);
    return () => clearTimeout(timeout);
  }, [
    graph,
    nodes,
    edges,
    directed,
    bipartite,
    isDarkMode,
    getNodeColor,
    getNodeSize,
    getEdgeColor,
    getEdgeSize,
    getEdgeOpacity,
    getShouldShowArrowhead,
    nodeOpacity,
    applyD3StaticLayout,
    topologyKey,
  ]);

  // Static graphs still respond to repulsion changes. Debouncing avoids
  // repeatedly running the offline force solver while a live slider is being
  // dragged. When Live Update is off, `forceStrength` does not change here
  // until Apply Changes copies the pending filters into appliedFilters.
  useEffect(() => {
    if (!graph || !isReady) return;

    const repulsion = typeof forceStrength === 'number' ? forceStrength : -100;
    if (livePhysics) {
      lastStaticForceStrengthRef.current = repulsion;
      return;
    }
    if (lastStaticForceStrengthRef.current === null) {
      lastStaticForceStrengthRef.current = repulsion;
      return;
    }
    if (lastStaticForceStrengthRef.current === repulsion) return;

    const timer = setTimeout(() => {
      applyD3StaticLayout(graph);
      lastStaticForceStrengthRef.current = repulsion;
    }, 180);
    return () => clearTimeout(timer);
  }, [graph, isReady, livePhysics, forceStrength, applyD3StaticLayout]);

  const runRefreshLayout = useCallback(() => {
    if (graph) {
      applyD3StaticLayout(graph);
    }
  }, [graph, applyD3StaticLayout]);

  const notifyLayoutChange = useCallback(() => setLayoutRevision((revision) => revision + 1), []);

  return {
    graph,
    isReady,
    layoutRevision,
    runRefreshLayout,
    notifyLayoutChange,
  };
}
