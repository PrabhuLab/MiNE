import type Graph from 'graphology';
import { meaningful, serializableValue } from './attributes';

function xmlEscape(value: unknown): string {
  return String(value ?? '').replace(/[<>&'\"]/g, (character) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
  })[character]!);
}

function graphMlType(values: any[]): string {
  const present = values.filter(meaningful);
  if (present.length && present.every((value) => typeof value === 'boolean')) return 'boolean';
  if (present.length && present.every((value) => Number.isInteger(Number(value)))) return 'long';
  if (present.length && present.every((value) => Number.isFinite(Number(value)))) return 'double';
  return 'string';
}

export function writeGraphML(graph: Graph): string {
  const nodeKeys = new Set<string>();
  const edgeKeys = new Set<string>();
  const graphKeys = new Set<string>(Object.keys(graph.getAttributes()));
  graph.forEachNode((_node, attributes) => Object.keys(attributes).forEach((key) => nodeKeys.add(key)));
  graph.forEachEdge((_edge, attributes) => Object.keys(attributes).forEach((key) => edgeKeys.add(key)));
  const definitions: string[] = [];
  const nodeIds = new Map<string, string>();
  const edgeIds = new Map<string, string>();
  const graphIds = new Map<string, string>();
  Array.from(nodeKeys).sort().forEach((key, index) => {
    const id = `n${index}`;
    nodeIds.set(key, id);
    definitions.push(`<key id="${id}" for="node" attr.name="${xmlEscape(key)}" attr.type="${graphMlType(graph.mapNodes((_node, attributes) => attributes[key]))}"/>`);
  });
  Array.from(edgeKeys).sort().forEach((key, index) => {
    const id = `e${index}`;
    edgeIds.set(key, id);
    definitions.push(`<key id="${id}" for="edge" attr.name="${xmlEscape(key)}" attr.type="${graphMlType(graph.mapEdges((_edge, attributes) => attributes[key]))}"/>`);
  });
  Array.from(graphKeys).sort().forEach((key, index) => {
    const id = `g${index}`;
    graphIds.set(key, id);
    definitions.push(`<key id="${id}" for="graph" attr.name="${xmlEscape(key)}" attr.type="${graphMlType([graph.getAttribute(key)])}"/>`);
  });
  const dataXml = (attributes: Record<string, any>, ids: Map<string, string>) => Object.entries(attributes)
    .filter(([key, value]) => ids.has(key) && meaningful(value))
    .map(([key, value]) => `<data key="${ids.get(key)}">${xmlEscape(serializableValue(value))}</data>`).join('');
  const nodes = graph.mapNodes((node, attributes) => `<node id="${xmlEscape(node)}">${dataXml(attributes, nodeIds)}</node>`).join('');
  const edges = graph.mapEdges((edge, attributes, source, target) => `<edge id="${xmlEscape(edge)}" source="${xmlEscape(source)}" target="${xmlEscape(target)}">${dataXml(attributes, edgeIds)}</edge>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><graphml xmlns="http://graphml.graphdrawing.org/xmlns">${definitions.join('')}<graph id="G" edgedefault="${graph.type === 'directed' ? 'directed' : 'undirected'}">${dataXml(graph.getAttributes(), graphIds)}${nodes}${edges}</graph></graphml>`;
}
