export const CLOUD_NODE_CUTOFF = 7_000;
export const CLOUD_EDGE_CUTOFF = 15_000;
export const ENGINE_POLICY_VERSION = 1 as const;

export type ComputationEngine = 'browser' | 'cloud';
export type ComputationPreference = ComputationEngine | 'auto';
export type Renderer = 'd3' | 'sigma';
export type RendererPreference = Renderer | 'auto';

export function requiresCloud(nodeCount: number, edgeCount: number): boolean {
  return nodeCount >= CLOUD_NODE_CUTOFF || edgeCount >= CLOUD_EDGE_CUTOFF;
}

export function effectiveComputationEngine(
  nodeCount: number,
  edgeCount: number,
  preference: ComputationPreference = 'browser',
): ComputationEngine {
  if (requiresCloud(nodeCount, edgeCount)) return 'cloud';
  return preference === 'cloud' ? 'cloud' : 'browser';
}

export function rendererForEngine(engine: ComputationEngine): Renderer {
  return engine === 'cloud' ? 'sigma' : 'd3';
}

export function effectiveRenderer(preference: RendererPreference, engine: ComputationEngine): Renderer {
  return preference === 'd3' || preference === 'sigma' ? preference : rendererForEngine(engine);
}

export function legacyRendererToPreference(
  renderer: 'auto' | 'd3' | 'sigma' | undefined,
  nodeCount: number,
  edgeCount: number,
): ComputationPreference {
  if (renderer === 'd3') return 'browser';
  if (renderer === 'sigma') return 'cloud';
  return requiresCloud(nodeCount, edgeCount) ? 'cloud' : 'browser';
}
