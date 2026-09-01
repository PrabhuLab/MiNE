import type { CustomAttributeMetadata, CustomAttributeType, RawEdge, RawNode } from '@/store/useStore';
import { meaningful } from './attributes.ts';

export function detectCustomAttributeType(values: unknown[]): CustomAttributeType {
  const distinct = Array.from(new Set(values.filter(meaningful).map((value) => typeof value === 'string' ? value.trim() : value)));
  if (distinct.length > 0 && distinct.every((value) => Number(value) === 0 || Number(value) === 1)) return 'binary';
  if (distinct.length === 2) return 'binary';
  if (distinct.length && distinct.every((value) => Number.isFinite(Number(value)))) {
    return distinct.every((value) => Number.isInteger(Number(value))) ? 'discrete' : 'continuous';
  }
  return 'nominal';
}

export function availableCustomNodeAttributes(nodes: RawNode[]): string[] {
  const consumed = new Set([
    'id', 'name', 'label', 'source', 'target', 'weight', 'weight_raw', 'weight_secondary',
    'partition', 'partitionIndex', 'bipartite', 'set', 'community', 'x', 'y',
    'louvain', 'deltaQ', 'k_i_in', 'nodeDegree', 'communityDegree', 'degree', 'inDegree', 'outDegree',
    'degreeCentrality', 'inDegreeCentrality', 'outDegreeCentrality', 'betweenness', 'closeness', 'clustering',
    'pagerank', 'eigenvector', 'eccentricity', 'weightedDegree', 'weightedInDegree', 'weightedOutDegree',
    'hub', 'authority',
  ]);
  const keys = new Set<string>();
  nodes.forEach((node) => Object.keys(node).forEach((key) => { if (!consumed.has(key)) keys.add(key); }));
  return Array.from(keys).sort();
}

export function inferCustomNodeAttributes(nodes: RawNode[]): CustomAttributeMetadata[] {
  const names = availableCustomNodeAttributes(nodes);
  if (nodes.some((node) => meaningful(node.community))) names.unshift('community');
  return names.map((name) => {
    // `community` is declared categorical by the importer even when its labels
    // happen to be numeric. Keep that parser decision consistent everywhere.
    const declaredCategorical = /(^|_)(community|cluster|group|category|class|type|label)($|_)/i.test(name);
    const detectedType = name === 'community' || declaredCategorical ? 'nominal' : detectCustomAttributeType(nodes.map((node) => node[name]));
    return { name, label: name, source: name, scope: 'node', origin: 'uploaded', detectedType, selectedType: detectedType, active: true, shown: false, presentCount: nodes.filter((node) => meaningful(node[name])).length };
  });
}

export function availableCustomEdgeAttributes(edges: RawEdge[]): string[] {
  const consumed = new Set([
    'key', 'id', 'source', 'target', 'weight', 'weight_raw', 'weight_secondary',
    'size', 'color', 'opacity', 'path', 'head', 'tail', 'curvature', 'directed',
  ]);
  const keys = new Set<string>();
  edges.forEach((edge) => Object.keys(edge).forEach((key) => {
    if (!consumed.has(key)) keys.add(key);
  }));
  return Array.from(keys).sort();
}

export function inferCustomEdgeAttributes(edges: RawEdge[]): CustomAttributeMetadata[] {
  return availableCustomEdgeAttributes(edges).map((name) => {
    const detectedType = detectCustomAttributeType(edges.map((edge) => edge[name]));
    return { name, label: name, source: name, scope: 'edge', origin: 'uploaded', detectedType, selectedType: detectedType, active: true, shown: false, presentCount: edges.filter((edge) => meaningful(edge[name])).length };
  });
}

/** Preserve saved card order/state while appending attributes newly detected in graph data. */
export function mergeCustomAttributeMetadata(
  inferred: CustomAttributeMetadata[],
  saved: CustomAttributeMetadata[] | null | undefined,
): CustomAttributeMetadata[] {
  if (!saved?.length) return inferred;
  const inferredByKey = new Map(inferred.map((attribute) => [`${attribute.scope}:${attribute.name}`, attribute]));
  const merged = saved.map((attribute) => {
    const detected = inferredByKey.get(`${attribute.scope}:${attribute.name}`);
    if (detected) inferredByKey.delete(`${attribute.scope}:${attribute.name}`);
    return {
      ...detected,
      ...attribute,
      source: attribute.source ?? detected?.source ?? attribute.name,
      detectedType: detected?.detectedType ?? attribute.detectedType,
      selectedType: attribute.selectedType ?? detected?.selectedType ?? attribute.detectedType,
    };
  });
  return [...merged, ...inferredByKey.values()];
}

export function availableNumericCustomEdgeAttributes(edges: RawEdge[]): string[] {
  return availableCustomEdgeAttributes(edges)
    .filter((key) => {
      const values = edges.map((edge) => edge[key]).filter(meaningful);
      return values.length > 0 && values.every((value) => Number.isFinite(Number(value)));
    })
    .sort();
}
