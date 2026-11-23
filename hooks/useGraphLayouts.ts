/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type Graph from 'graphology';
import type { RawEdge, RawNode } from '@/store/useStore';
import { computeCloudLayout } from '@/services/layouts/cloudEngine';
import type { LayoutAlgorithm, LayoutResult, LayoutSettings } from '@/services/layouts/types';
import { computeForceDirectedLayoutAsync } from '@/services/layouts/d3Worker';

interface UseGraphLayoutsOptions {
  graph: Graph;
  nodes: RawNode[];
  topologyKey: string;
  livePhysics: boolean;
  setLivePhysics: (enabled: boolean) => void;
  onLayoutApplied: () => void;
  directed: boolean;
  bipartite: boolean;
  cloudRouted: boolean;
  ready: boolean;
  applyLayoutPositions: (result: LayoutResult, cloud: boolean) => void;
  weightAttribute: string;
  forceStrength: number;
}

export function useGraphLayouts(options: UseGraphLayoutsOptions) {
  const [selection, setAlgorithm] = useState<LayoutAlgorithm>('d3Force');
  const [settings, setSettings] = useState<Partial<Record<LayoutAlgorithm, LayoutSettings>>>({});
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const pending = useRef<AbortController | null>(null);
  const algorithm = (!options.cloudRouted && selection !== 'd3Force' && selection !== 'forceatlas2')
    || (!options.directed && selection === 'sugiyama') ? 'd3Force' : selection;

  const cancel = useCallback(() => {
    pending.current?.abort();
    pending.current = null;
    setRunning(false);
    setWarning(null);
  }, []);

  useLayoutEffect(() => {
    setRunning(false);
    setError(null);
    setWarning(null);
    return () => {
      pending.current?.abort();
      pending.current = null;
    };
  }, [options.graph, options.topologyKey, options.cloudRouted, options.directed, options.bipartite]);

  useEffect(() => {
    if (options.livePhysics && pending.current) cancel();
  }, [options.livePhysics, cancel]);

  const start = async () => {
    if (!options.ready || pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setError(null);
    setWarning(null);
    setRunning(true);
    options.setLivePhysics(false);
    try {
      const edges = options.graph.mapEdges((key, { rawEdge }, source, target): RawEdge => {
        const weight = Number(rawEdge?.[options.weightAttribute] ?? 1);
        return { key, source, target, weight_raw: Number.isFinite(weight) ? weight : 1 };
      }).filter(({ source, target }) => source !== target);
      const cloud = options.cloudRouted && algorithm !== 'd3Force';
      let result: LayoutResult;
      if (cloud) {
        result = await computeCloudLayout(options.nodes, edges, options.directed, options.bipartite, options.topologyKey,
          { algorithm, ...settings[algorithm] }, controller.signal);
      } else {
        if (algorithm === 'forceatlas2' && edges.some((edge) => edge.weight_raw <= 0)) {
          edges.forEach((edge) => { edge.weight_raw = 1; });
          setWarning('ForceAtlas2 used equal edge weights because the selected weights include zero or negative values.');
        }
        const positions = await computeForceDirectedLayoutAsync(
          options.nodes, edges, options.directed, options.forceStrength, controller.signal,
          algorithm === 'forceatlas2' ? 'forceatlas2' : 'd3Force',
        );
        result = { positions: Object.fromEntries(positions), filterRevision: options.topologyKey };
      }
      if (controller.signal.aborted) return;
      options.applyLayoutPositions(result, cloud);
      options.onLayoutApplied();
      if (result.warnings && Object.keys(result.warnings).length) setWarning(Object.values(result.warnings).join(' '));
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setRunning(false);
      }
    }
  };

  function updateAlgorithmSettings(values: LayoutSettings) {
    setSettings((current) => ({ ...current, [algorithm]: { ...current[algorithm], ...values } }));
  }

  return {
    algorithm, setAlgorithm, settings, updateAlgorithmSettings, running, error, warning, start, cancel,
    cloudRouted: options.cloudRouted, directed: options.directed, ready: options.ready,
  };
}
