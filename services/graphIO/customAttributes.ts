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
    'partition', 'partitionIndex', 'type', 'group', 'bipartite', 'set', 'community', 'abundance', 'x', 'y',
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
  return availableCustomNodeAttributes(nodes).map((name) => {
    const detectedType = detectCustomAttributeType(nodes.map((node) => node[name]));
    return { name, scope: 'node', detectedType, selectedType: detectedType };
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
    return { name, scope: 'edge', detectedType, selectedType: detectedType };
  });
}

export function availableNumericCustomEdgeAttributes(edges: RawEdge[]): string[] {
  return availableCustomEdgeAttributes(edges)
    .filter((key) => {
      const values = edges.map((edge) => edge[key]).filter(meaningful);
      return values.length > 0 && values.every((value) => Number.isFinite(Number(value)));
    })
    .sort();
}
