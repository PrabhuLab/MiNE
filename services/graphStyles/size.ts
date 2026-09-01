import { numericExtent } from '../../lib/utils.ts';

/** Shared logarithmic size transform used by D3, Sigma, and size legends. */
export function logarithmicNodeSize(value: unknown, multiplier = 3): number {
  const numeric = Number(value);
  const finite = Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
  return multiplier * Math.max(Math.log(finite + 2), 1) + 2;
}

export function degreeByNode(
  nodes: Array<{ id: string }>,
  edges: Array<{ source: string; target: string }>,
): Record<string, number> {
  const result: Record<string, number> = Object.fromEntries(nodes.map((node) => [String(node.id), 0]));
  edges.forEach((edge) => {
    const source = String(edge.source);
    const target = String(edge.target);
    result[source] = (result[source] || 0) + 1;
    result[target] = (result[target] || 0) + 1;
  });
  return result;
}

export function normalizedNumericSize(value: unknown, values: unknown[]): number {
  const extent = numericExtent(values.map(Number));
  const numeric = Number(value);
  if (!extent || !Number.isFinite(numeric)) return 0;
  const [minimum, maximum] = extent;
  return maximum === minimum ? 5 : 1 + ((numeric - minimum) / (maximum - minimum)) * 9;
}
