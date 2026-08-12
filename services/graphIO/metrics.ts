import type { ImportedMetricsBundle } from '@/store/useStore';

export function createMetricsBundle(
  networkMetrics: any[],
  nodeMetrics: any[],
  edgeMetrics: any[],
  graphMetrics: Record<string, any>,
  metadata: Record<string, any>,
): ImportedMetricsBundle {
  const nodes: Record<string, Record<string, any>> = {};
  networkMetrics.forEach((entry) => { if (entry?.id !== undefined) nodes[String(entry.id)] = { ...entry }; });
  nodeMetrics.forEach((entry) => {
    if (entry?.id === undefined) return;
    nodes[String(entry.id)] = { ...(nodes[String(entry.id)] || {}), ...entry };
  });
  const edges: Record<string, Record<string, any>> = {};
  edgeMetrics.forEach((entry, index) => {
    const key = String(entry.key ?? (entry.source !== undefined ? `${entry.source}->${entry.target}` : index));
    edges[key] = { ...entry };
  });
  const graph = Object.fromEntries(
    Object.entries(graphMetrics).filter(([, value]) => value !== null && value !== undefined && !(typeof value === 'number' && !Number.isFinite(value))),
  );
  return { graph, nodes, edges, metadata: { ...metadata } };
}
