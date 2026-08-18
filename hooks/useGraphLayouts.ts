/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type Graph from 'graphology';
import { graphologyLayoutEngine, isContinuousLayout, type LayoutController } from '@/services/layouts/engine';
import type { LayoutAlgorithm, LayoutSettings } from '@/services/layouts/types';

const DEFAULT_SETTINGS: LayoutSettings = {
  random: { center: 0, scale: 100 },
  circular: { center: 0, scale: 100 },
  circlepack: { center: 0, scale: 100, hierarchyAttributes: ['community'] },
  noverlap: { gridSize: 20, margin: 5, expansion: 1.1, ratio: 1, speed: 3, maxIterations: 500 },
  forceatlas2: { adjustSizes: false, barnesHutOptimize: true, barnesHutTheta: 0.5, edgeWeightInfluence: 1, gravity: 1, linLogMode: false, outboundAttractionDistribution: false, scalingRatio: 1, slowDown: 1, strongGravityMode: false },
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
}

export function useGraphLayouts(options: UseGraphLayoutsOptions) {
  const [algorithm, setAlgorithm] = useState<LayoutAlgorithm>('circular');
  const [settings, setSettings] = useState<LayoutSettings>(DEFAULT_SETTINGS);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<LayoutController | null>(null);

  const stop = useCallback(() => {
    controllerRef.current?.stop();
    controllerRef.current = null;
    setRunning(false);
    options.notifyLayoutChange();
  }, [options]);

  const kill = useCallback(() => {
    controllerRef.current?.kill();
    controllerRef.current = null;
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
        if (isContinuousLayout(algorithm)) {
          const controller = graphologyLayoutEngine.createController(request);
          controllerRef.current = controller;
          controller.start();
          setRunning(true);
        } else {
          void graphologyLayoutEngine.compute(request).catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)));
        }
      } catch (cause) {
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

  useEffect(() => () => kill(), [kill]);
  useLayoutEffect(() => { kill(); }, [kill, options.topologyKey]);

  return useMemo(() => ({ algorithm, setAlgorithm, settings, updateAlgorithmSettings, running, error, start, stop, inferForceAtlas2 }), [algorithm, error, inferForceAtlas2, running, settings, start, stop, updateAlgorithmSettings]);
}
