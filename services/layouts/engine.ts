import Graph from 'graphology';
import random from 'graphology-layout/random.js';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import seedrandom from 'seedrandom';

export function computeForceAtlas2(
  nodes: { id: string }[],
  edges: { source: string; target: string; weight_raw?: number }[],
) {
  const graph = new Graph({ type: 'undirected', multi: true, allowSelfLoops: false });
  nodes.forEach(({ id }) => graph.addNode(id));
  if (!graph.order) return new Map<string, { x: number; y: number }>();
  edges.forEach(({ source, target, weight_raw }) => {
    graph.addEdge(source, target, { weight: weight_raw });
  });
  random.assign(graph, { center: 0, scale: 100, rng: seedrandom('42') });
  forceAtlas2.assign(graph, {
    iterations: 100,
    settings: forceAtlas2.inferSettings(graph),
    getEdgeWeight: 'weight',
  });
  return new Map(graph.mapNodes((id, { x, y }) => [id, { x: Number(x), y: Number(y) }]));
}
