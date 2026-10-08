'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import type Graph from 'graphology';

interface UseSharedPhysicsProps {
  graph: Graph | null;
  topologyKey: string;
  livePhysics?: boolean;
  forceStrength?: number;
  activeRenderer?: 'd3' | 'sigma';
}

export function useSharedPhysics({ graph, topologyKey, livePhysics = false, forceStrength = -100, activeRenderer = 'd3' }: UseSharedPhysicsProps) {
  const workerRef = useRef<Worker | null>(null);
  const wakeRef = useRef<() => void>(() => {});
  const d3NodesMapRef = useRef<Map<string, any>>(new Map());
  const d3NodesRef = useRef<any[]>([]);
  const d3LinksRef = useRef<any[]>([]);
  const d3TickListenersRef = useRef<Set<() => void>>(new Set());
  const activeRendererRef = useRef(activeRenderer);
  const forceStrengthRef = useRef(forceStrength);
  const appliedForceStrengthRef = useRef(forceStrength);
  const [physicsError, setPhysicsError] = useState<string | null>(null);

  useEffect(() => { forceStrengthRef.current = forceStrength; }, [forceStrength]);

  const registerD3TickListener = useCallback((listener: () => void) => {
    d3TickListenersRef.current.add(listener);
    return () => { d3TickListenersRef.current.delete(listener); };
  }, []);

  const syncGraphology = useCallback(() => {
    if (!graph) return;
    graph.updateEachNodeAttributes((id, attrs) => {
      const node = d3NodesMapRef.current.get(id);
      if (node) { attrs.x = node.x; attrs.y = node.y; }
      return attrs;
    }, { attributes: ['x', 'y'] });
  }, [graph]);

  useEffect(() => {
    activeRendererRef.current = activeRenderer;
    if (graph && workerRef.current && livePhysics && activeRenderer === 'sigma') syncGraphology();
  }, [activeRenderer, livePhysics, graph, syncGraphology]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhysicsError(null);
    if (!graph || !livePhysics) return;
    const map = d3NodesMapRef.current;
    const nodes = graph.mapNodes((id, attrs) => {
      const node = map.get(id) || { id, x: attrs.x ?? 0, y: attrs.y ?? 0 };
      node.x = attrs.x ?? 0;
      node.y = attrs.y ?? 0;
      node.fx = node.fy = null;
      node.size = attrs.size ?? 5;
      map.set(id, node);
      return node;
    });
    for (const id of map.keys()) if (!graph.hasNode(id)) map.delete(id);
    const links = graph.mapEdges((_id, attrs, source, target) => ({ source, target, rawEdge: attrs.rawEdge }));
    d3NodesRef.current = nodes;
    d3LinksRef.current = links;

    let worker: Worker;
    let frame: number | null = null;
    let pending = false;
    let running = true;
    let wakeVersion = 0;
    let tickWakeVersion = 0;
    const requestTick = () => {
      if (!pending && frame === null && running) {
        pending = true;
        tickWakeVersion = wakeVersion;
        worker.postMessage({ type: 'tick' });
      }
    };
    const fail = (message: string) => {
      running = false;
      worker.terminate();
      wakeRef.current = () => {};
      if (workerRef.current === worker) workerRef.current = null;
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      setPhysicsError(message);
    };
    try {
      worker = new Worker(new URL('../services/layouts/d3.worker.ts', import.meta.url));
      workerRef.current = worker;
      wakeRef.current = () => { wakeVersion += 1; running = true; requestTick(); };
      worker.onmessage = ({ data }) => {
        pending = false;
        if (data.error) { fail(data.error); return; }
        const receivedWakeVersion = tickWakeVersion;
        // Pull one physics step per painted frame; a slow renderer cannot queue stale frames.
        frame = requestAnimationFrame(() => {
          frame = null;
          nodes.forEach((node, index) => {
            node.x = node.fx ?? data.positions[index * 2];
            node.y = node.fy ?? data.positions[index * 2 + 1];
          });
          d3TickListenersRef.current.forEach((draw) => draw());
          if (activeRendererRef.current === 'sigma') syncGraphology();
          running = data.running || wakeVersion !== receivedWakeVersion;
          requestTick();
        });
      };
      worker.onerror = (event) => fail(event.message || 'Physics worker failed');
      appliedForceStrengthRef.current = forceStrengthRef.current;
      worker.postMessage({ type: 'start', nodes: nodes.map(({ id, x, y, size }) => ({ id, x, y, size })), links: links.map(({ source, target }) => ({ source, target })), forceStrength: forceStrengthRef.current });
      requestTick();
    } catch (cause) {
      workerRef.current?.terminate();
      workerRef.current = null;
      setPhysicsError(cause instanceof Error ? cause.message : String(cause));
    }
    return () => {
      running = false;
      if (frame !== null) cancelAnimationFrame(frame);
      worker?.terminate();
      workerRef.current = null;
      wakeRef.current = () => {};
      syncGraphology();
    };
  }, [graph, livePhysics, topologyKey, syncGraphology]);

  useEffect(() => {
    if (appliedForceStrengthRef.current === forceStrength) return;
    appliedForceStrengthRef.current = forceStrength;
    workerRef.current?.postMessage({ type: 'strength', forceStrength });
    wakeRef.current();
  }, [forceStrength]);

  const movePinnedNode = useCallback((id: string, x: number, y: number) => {
    const node = d3NodesMapRef.current.get(id);
    if (!node) return;
    node.fx = node.x = x;
    node.fy = node.y = y;
    workerRef.current?.postMessage({ type: 'pin', id, x, y });
    wakeRef.current();
    // The dragged node tracks the pointer immediately while the worker catches up.
    if (graph?.hasNode(id) && (graph.getNodeAttribute(id, 'x') !== x || graph.getNodeAttribute(id, 'y') !== y)) graph.mergeNodeAttributes(id, { x, y });
    d3TickListenersRef.current.forEach((draw) => draw());
  }, [graph]);

  const endDrag = useCallback((id: string) => {
    const node = d3NodesMapRef.current.get(id);
    if (node) { node.fx = null; node.fy = null; }
    workerRef.current?.postMessage({ type: 'release', id });
    wakeRef.current();
  }, []);

  return { registerD3TickListener, beginDrag: movePinnedNode, movePinnedNode, endDrag, d3NodesRef, d3LinksRef, d3NodesMapRef, physicsError };
}
