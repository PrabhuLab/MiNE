import type Graph from 'graphology';
import { write as writeGEXF } from 'graphology-gexf';
import { cleanAttributes, numeric } from './attributes';

export function writeGexf(graph: Graph): string {
  const firstNode = graph.nodes()[0];
  const graphAttributes = graph.getAttributes();
  const graphMetrics = Object.fromEntries(Object.entries(graphAttributes).filter(([key]) => ![
    'directed', 'bipartite', 'weighted', 'partitionAttribute', 'metricsMetadata',
  ].includes(key)));
  // GEXF only declares attributes already present on the graph before the
  // formatter runs. Use a copy with one reserved metadata carrier node so
  // graph-level results can round-trip without polluting the live workspace.
  const exportGraph = graph.copy();
  if (firstNode) exportGraph.mergeNodeAttributes(firstNode, {
    __mineGraphMetrics: JSON.stringify(graphMetrics),
    __mineMetricsMetadata: String(graphAttributes.metricsMetadata || '{}'),
  });
  return writeGEXF(exportGraph, {
    pretty: true,
    version: '1.3',
    formatNode: (_key: string, attributes: Record<string, any>) => ({
      label: String(attributes.label ?? attributes.name ?? ''),
      attributes: cleanAttributes(attributes),
      viz: {
        color: attributes.color,
        x: Number.isFinite(Number(attributes.x)) ? Number(attributes.x) : undefined,
        y: Number.isFinite(Number(attributes.y)) ? Number(attributes.y) : undefined,
        size: Number.isFinite(Number(attributes.size)) ? Number(attributes.size) : undefined,
        shape: attributes.shape,
      },
    }),
    formatEdge: (_key: string, attributes: Record<string, any>) => ({
      label: attributes.label,
      attributes: cleanAttributes(attributes),
      weight: numeric(attributes.weight_raw ?? attributes.weight, 1),
      viz: { color: attributes.color, thickness: attributes.size },
    }),
  } as any);
}
