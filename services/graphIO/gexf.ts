import type Graph from 'graphology';
import { write as writeGEXF } from 'graphology-gexf';
import { cleanAttributes, numeric } from './attributes';

export function writeGexf(graph: Graph): string {
  return writeGEXF(graph, {
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
