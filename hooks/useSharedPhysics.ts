'use client';

import { useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import type Graph from 'graphology';

interface UseSharedPhysicsProps {
  graph: Graph | null;
  topologyKey: string;
  livePhysics?: boolean;
  forceStrength?: number;
  activeRenderer?: 'd3' | 'sigma';
}

export function useSharedPhysics({
  graph,
  topologyKey,
  livePhysics = false,
  forceStrength = -100,
  activeRenderer = 'd3',
}: UseSharedPhysicsProps) {
  const simulationRef = useRef<d3.Simulation<any, any> | null>(null);
  const d3NodesMapRef = useRef<Map<string, any>>(new Map());
  const d3NodesRef = useRef<any[]>([]);
  const d3LinksRef = useRef<any[]>([]);
  const d3TickListenersRef = useRef<Set<() => void>>(new Set());
  const activeRendererRef = useRef(activeRenderer);
  const appliedForceStrengthRef = useRef<number | null>(null);

  const registerD3TickListener = useCallback((listener: () => void) => {
    d3TickListenersRef.current.add(listener);
    return () => {
      d3TickListenersRef.current.delete(listener);
    };
  }, []);

  // One-time sync helper
  const syncGraphology = useCallback(() => {
    if (!graph) return;
    const map = d3NodesMapRef.current;
    graph.updateEachNodeAttributes(
      (id: string, attrs: any) => {
        const simNode = map.get(id);
        return simNode ? { ...attrs, x: simNode.x, y: simNode.y } : attrs;
      },
      { attributes: ['x', 'y'] }
    );
  }, [graph]);

  // Renderer switching changes only the position consumer. The shared
  // simulation remains alive across D3/Sigma switches.
  useEffect(() => {
    activeRendererRef.current = activeRenderer;
    if (graph && livePhysics && activeRenderer === 'sigma') {
      syncGraphology();
    }
  }, [activeRenderer, livePhysics, graph, syncGraphology]);

  // Create/recreate only for topology or live-physics lifecycle changes.
  useEffect(() => {
    if (!graph || !livePhysics) return;

    const repulsionVal = typeof forceStrength === 'number' ? forceStrength : -100;

    // Build shared D3 nodes array from Graphology graph
    const d3Nodes: any[] = [];
    const d3NodesMap = d3NodesMapRef.current;

    graph.forEachNode((nodeId: string, attrs: any) => {
      let dNode = d3NodesMap.get(nodeId);
      if (!dNode) {
        dNode = {
          id: nodeId,
          x: attrs.x ?? 0,
          y: attrs.y ?? 0,
          vx: 0,
          vy: 0,
          size: attrs.size ?? 5,
        };
        d3NodesMap.set(nodeId, dNode);
      } else {
        dNode.size = attrs.size ?? dNode.size;
      }
      d3Nodes.push(dNode);
    });

    for (const nodeId of d3NodesMap.keys()) {
      if (!graph.hasNode(nodeId)) d3NodesMap.delete(nodeId);
    }

    d3NodesRef.current = d3Nodes;

    // Build shared D3 links array from Graphology edges
    const d3Links: any[] = [];
    graph.forEachEdge((edgeId: string, attrs: any, source: string, target: string) => {
      d3Links.push({ source, target, weight: attrs.rawEdge?.weight_raw || 1, rawEdge: attrs.rawEdge });
    });

    d3LinksRef.current = d3Links;

    const linkDist = Math.max(35, Math.min(100, 1000 / Math.sqrt(d3Nodes.length || 1)));
    const manyBody = d3.forceManyBody().strength(repulsionVal);
    if (d3Nodes.length > 800) manyBody.theta(0.9);
    appliedForceStrengthRef.current = repulsionVal;

    const sim = d3
      .forceSimulation(d3Nodes)
      .force('link', d3.forceLink(d3Links).id((d: any) => d.id).distance(linkDist))
      .force('charge', manyBody)
      .force('center', d3.forceCenter(0, 0))
      .alphaDecay(0.02);

    if (d3Nodes.length <= 800) {
      sim.force('collide', d3.forceCollide().radius((d: any) => (d.size || 5) + 4).iterations(1));
    }

    sim.on('tick', () => {
      // 1. Direct D3 SVG DOM update (D3 reads d.x/d.y directly from simulation objects)
      d3TickListenersRef.current.forEach((fn) => fn());

      // D3's timer is already animation-frame based. Sigma observes this one
      // Graphology bulk update directly, without an extra scheduling boundary.
      if (activeRendererRef.current === 'sigma') {
        syncGraphology();
      }
    });

    sim.alpha(1).restart();
    simulationRef.current = sim;

    return () => {
      syncGraphology();
      sim.stop();
      if (simulationRef.current === sim) {
        simulationRef.current = null;
      }
    };
  }, [graph, livePhysics, topologyKey, syncGraphology]);

  // Force-strength changes update and reheat the existing simulation without
  // rebuilding its nodes, links, or other physics state.
  useEffect(() => {
    const sim = simulationRef.current;
    if (!sim || !graph || !livePhysics) return;

    const repulsionVal = typeof forceStrength === 'number' ? forceStrength : -100;
    if (appliedForceStrengthRef.current === repulsionVal) return;

    const manyBody = d3.forceManyBody().strength(repulsionVal);
    if (sim.nodes().length > 800) manyBody.theta(0.9);
    sim.force('charge', manyBody);
    appliedForceStrengthRef.current = repulsionVal;
    sim.alpha(0.3).restart();
  }, [forceStrength, graph, livePhysics]);

  // Streamlined Drag Lifecycle: Reheat ONCE on drag start
  const beginDrag = useCallback((id: string, x: number, y: number) => {
    const dNode = d3NodesMapRef.current.get(id);
    if (dNode) {
      dNode.fx = x;
      dNode.fy = y;
      if (simulationRef.current) {
        simulationRef.current.alphaTarget(0.3).restart();
      }
    }
  }, []);

  // Update fx/fy ONLY on drag move (zero reheating)
  const movePinnedNode = useCallback((id: string, x: number, y: number) => {
    const dNode = d3NodesMapRef.current.get(id);
    if (dNode) {
      dNode.fx = x;
      dNode.fy = y;
      if (!simulationRef.current) {
        dNode.x = x;
        dNode.y = y;
        if (graph?.hasNode(id)) {
          graph.mergeNodeAttributes(id, { x, y });
        }
        d3TickListenersRef.current.forEach((fn) => fn());
      }
    }
  }, [graph]);

  // Release pinning on drag end
  const endDrag = useCallback((id: string) => {
    const dNode = d3NodesMapRef.current.get(id);
    if (dNode) {
      dNode.fx = null;
      dNode.fy = null;
      if (simulationRef.current) {
        simulationRef.current.alphaTarget(0);
      }
    }
  }, []);

  const reheat = useCallback(() => {
    if (simulationRef.current) {
      simulationRef.current.alphaTarget(0.3).restart();
    }
  }, []);

  return {
    registerD3TickListener,
    beginDrag,
    movePinnedNode,
    endDrag,
    reheat,
    d3NodesRef,
    d3LinksRef,
    d3NodesMapRef,
    simulationRef,
  };
}
