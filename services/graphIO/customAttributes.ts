import type { CustomAttributeMetadata, CustomAttributeType, RawEdge, RawNode } from '@/store/useStore';
import { meaningful } from './attributes';

export function detectCustomAttributeType(values: unknown[]): CustomAttributeType {
  const distinct = Array.from(new Set(values.filter(meaningful).map((value) => typeof value === 'string' ? value.trim() : value)));
  if (distinct.length === 2) return 'binary';
  if (distinct.length && distinct.every((value) => Number.isFinite(Number(value)))) {
    return distinct.every((value) => Number.isInteger(Number(value))) ? 'discrete' : 'continuous';
  }
  return 'nominal';
}

export function availableCustomNodeAttributes(nodes: RawNode[]): string[] {
  const consumed = new Set([
    'id', 'name', 'label', 'source', 'target', 'weight', 'weight_raw', 'weight_secondary',
    'partition', 'partitionIndex', 'bipartite', 'set', 'community', 'abundance', 'x', 'y',
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
    const detectedType = detectCustomAttributeType(nodes.map((node) => node[name]));
    return { name, source: name, scope: 'node', detectedType, selectedType: detectedType, active: false, shown: false };
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
    return { name, source: name, scope: 'edge', detectedType, selectedType: detectedType, active: false, shown: false };
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
