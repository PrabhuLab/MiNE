'use client';

import { useEffect, useCallback, useState, useMemo } from 'react';
import Graph from 'graphology';
import { RawNode, RawEdge } from '@/store/useStore';
import { computeForceDirectedLayout } from '@/lib/layoutUtils';

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

interface UseSharedGraphProps {
  nodes: RawNode[];
  edges: RawEdge[];
  directed: boolean;
  bipartite: boolean;
  forceStrength?: number;
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
  const isReady = readyTopologyKey === topologyKey;

  // Apply offline D3 force-directed static layout to Graphology graph
  const applyD3StaticLayout = useCallback((graphInst: Graph) => {
    if (!graphInst) return;
    const posMap = computeForceDirectedLayout(nodes, edges, directed, forceStrength);
    graphInst.forEachNode((nodeId: string) => {
      const pos = posMap.get(nodeId);
      if (pos) {
        graphInst.setNodeAttribute(nodeId, 'x', pos.x);
        graphInst.setNodeAttribute(nodeId, 'y', pos.y);
      }
    });
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
      const isSecondary = checkIsSecondary(n, bipartite);
      const shape = isSecondary ? 'square' : 'circle';

      if (!graph.hasNode(n.id)) {
        needsLayout = true;
        graph.addNode(n.id, {
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

        if (!edgeKey) {
          try {
            const newKey = graph.addEdge(e.source, e.target, {
              size,
              color,
              opacity,
              path,
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
            size,
            color,
            opacity,
            path,
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

  const runRefreshLayout = useCallback(() => {
    if (graph) {
      applyD3StaticLayout(graph);
    }
  }, [graph, applyD3StaticLayout]);

  return {
    graph,
    isReady,
    runRefreshLayout,
  };
}
