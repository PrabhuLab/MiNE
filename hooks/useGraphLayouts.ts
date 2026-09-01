/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type Graph from 'graphology';
import { graphologyLayoutEngine, isContinuousLayout, type LayoutController } from '@/services/layouts/engine';
import { cloudLayoutEngine } from '@/services/layouts/cloudEngine';
import type { LayoutAlgorithm, LayoutSettings } from '@/services/layouts/types';
import { isCloudLayoutSupported } from '@/services/cloud/config';
import { computeForceDirectedLayout } from '@/lib/layoutUtils';

const DEFAULT_SETTINGS: LayoutSettings = {
  random: { center: 0, scale: 100 },
  circular: { center: 0, scale: 100 },
  circlepack: { center: 0, scale: 100, hierarchyAttributes: ['community'] },
  noverlap: { gridSize: 20, margin: 5, expansion: 1.1, ratio: 1, speed: 3, maxIterations: 500 },
  forceatlas2: { adjustSizes: false, barnesHutOptimize: true, barnesHutTheta: 0.5, edgeWeightInfluence: 1, gravity: 1, linLogMode: false, outboundAttractionDistribution: false, scalingRatio: 1, slowDown: 1, strongGravityMode: false },
  d3Force: {},
  drl: { seed: 42, normalize: true },
  auto: { seed: 42, normalize: true },
  fruchtermanReingold: { seed: 42, normalize: true, iterations: 500 },
  kamadaKawai: { seed: 42, normalize: true },
  cloudCircular: { normalize: true },
  cloudRandom: { seed: 42, normalize: true },
  bipartite: { normalize: true },
  sugiyama: { normalize: true },
};

interface UseGraphLayoutsOptions {
  graph: Graph;
  nodes: any[];
  edges: any[];
  topologyKey: string;
  livePhysics: boolean;
  setLivePhysics: (enabled: boolean) => void;
  notifyLayoutChange: () => void;
  onLayoutStarted?: () => void;
  onLayoutStopped?: () => void;
  directed: boolean;
  bipartite: boolean;
  cloudRouted: boolean;
  applyExternalPositions: (result: any, expectedRevision: string) => void;
  weightAttribute: string;
  forceStrength: number;
}

export function useGraphLayouts(options: UseGraphLayoutsOptions) {
  const [algorithm, setAlgorithm] = useState<LayoutAlgorithm>('d3Force');
  const [settings, setSettings] = useState<LayoutSettings>(DEFAULT_SETTINGS);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<LayoutController | null>(null);
  const cloudAbortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    controllerRef.current?.stop();
    controllerRef.current = null;
    setRunning(false);
    options.notifyLayoutChange();
  }, [options]);

  const kill = useCallback(() => {
    controllerRef.current?.kill();
    controllerRef.current = null;
    cloudAbortRef.current?.abort();
    cloudAbortRef.current = null;
    setRunning(false);
  }, []);

  const start = useCallback(() => {
    setError(null);
    kill();
    options.onLayoutStarted?.();
    options.setLivePhysics(false);
    const request = {
      graph: options.graph,
      nodes: options.nodes,
      edges: options.edges,
      algorithm,
      settings,
      directed: options.directed,
      bipartite: options.bipartite,
      graphRevision: options.topologyKey,
      filterRevision: options.topologyKey,
      weightAttribute: options.weightAttribute,
      onTick: options.notifyLayoutChange,
      onStop: () => {
        controllerRef.current = null;
        setRunning(false);
        options.notifyLayoutChange();
        options.onLayoutStopped?.();
      },
    };
    const begin = () => {
      try {
        if (algorithm === 'd3Force') {
          setRunning(true);
          const forcePositions = computeForceDirectedLayout(options.nodes, options.edges, options.directed, options.forceStrength);
          options.graph.updateEachNodeAttributes((nodeId, attributes) => {
            const position = forcePositions.get(nodeId);
            return position ? { ...attributes, ...position } : attributes;
          }, { attributes: ['x', 'y'] });
          options.notifyLayoutChange();
          options.onLayoutStopped?.();
          setRunning(false);
          return;
        }
        const serverAlgorithm = isCloudLayoutSupported(algorithm);
        if (!options.cloudRouted && serverAlgorithm) {
          setError(`${algorithm} requires Cloud API, but the resolved computation engine is Browser.`);
          return;
        }
        if (options.cloudRouted) {
          const cloudAlgorithm: LayoutAlgorithm = serverAlgorithm ? algorithm : 'd3Force';
          const controller = new AbortController();
          cloudAbortRef.current = controller;
          setRunning(true);
          void cloudLayoutEngine.compute({ ...request, algorithm: cloudAlgorithm, signal: controller.signal }).then((result) => {
            options.applyExternalPositions(result, options.topologyKey);
            options.onLayoutStopped?.();
          }).catch((cause) => {
            if (cause?.name !== 'AbortError') setError(cause instanceof Error ? cause.message : String(cause));
          }).finally(() => {
            if (cloudAbortRef.current === controller) cloudAbortRef.current = null;
            setRunning(false);
          });
        } else if (isContinuousLayout(algorithm)) {
          const controller = graphologyLayoutEngine.createController(request);
          controllerRef.current = controller;
          controller.start();
          setRunning(true);
        } else {
          void graphologyLayoutEngine.compute(request).catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)));
        }
      } catch (cause) {
        setRunning(false);
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    };
    setTimeout(begin, 0);
  }, [algorithm, kill, options, settings]);

  const inferForceAtlas2 = useCallback(() => {
    setSettings((current) => ({ ...current, forceatlas2: graphologyLayoutEngine.inferForceAtlas2(options.graph) }));
  }, [options.graph]);

  const updateAlgorithmSettings = useCallback((values: Record<string, any>) => {
    setSettings((current) => ({ ...current, [algorithm]: { ...(current[algorithm] || {}), ...values } }));
  }, [algorithm]);

  useEffect(() => {
    if (options.livePhysics && controllerRef.current) stop();
  }, [options.livePhysics, stop]);

  useEffect(() => {
    kill();
  }, [kill, options.cloudRouted]);

  useEffect(() => () => kill(), [kill]);
  useLayoutEffect(() => { kill(); }, [kill, options.topologyKey]);
  useEffect(() => {
    if (algorithm === 'auto') setAlgorithm('d3Force');
    else if (options.cloudRouted && !['d3Force', 'drl', 'fruchtermanReingold', 'kamadaKawai', 'cloudCircular', 'cloudRandom', 'bipartite', 'sugiyama'].includes(algorithm)) setAlgorithm('d3Force');
    else if (!options.cloudRouted && isCloudLayoutSupported(algorithm)) setAlgorithm('d3Force');
  }, [algorithm, options.cloudRouted]);

  return useMemo(() => ({ algorithm, setAlgorithm, settings, updateAlgorithmSettings, running, error, start, stop, inferForceAtlas2, cloudRouted: options.cloudRouted, bipartite: options.bipartite, directed: options.directed }), [algorithm, error, inferForceAtlas2, running, settings, start, stop, updateAlgorithmSettings, options.cloudRouted, options.bipartite, options.directed]);
}
