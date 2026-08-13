import * as d3 from 'd3';
import { RawNode, RawEdge } from '@/store/useStore';

/**
 * Pre-computes 2D node positions using D3 force simulation layout offline.
 * Returns a Map of node IDs to x/y positions.
 */
export function computeForceDirectedLayout(
  nodes: RawNode[],
  edges: RawEdge[],
  directed: boolean,
  forceStrength: number = -100
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  if (!nodes || nodes.length === 0) return positions;

  const count = nodes.length;
  const radius = Math.min(800, Math.max(200, count * 8));

  const graphNodes = nodes.map((n, i) => {
    const angle = (i / Math.max(1, count)) * 2 * Math.PI;
    const r = radius * (0.1 + 0.9 * Math.random());
    return {
      id: n.id,
      x: n.x ?? r * Math.cos(angle),
      y: n.y ?? r * Math.sin(angle),
    };
  });

  const graphLinks = edges.map((e) => ({
    source: e.source,
    target: e.target,
    weight: e.weight_raw !== undefined ? Number(e.weight_raw) : 1,
  }));

  const linkDist = Math.max(30, Math.min(100, 1000 / Math.sqrt(count || 1)));
  const ticks = count > 3000 ? 40 : count > 1000 ? 60 : count > 500 ? 120 : 250;

  const manyBody = d3.forceManyBody().strength(forceStrength || -100);
  if (count > 800) {
    manyBody.theta(0.9);
  }

  const simulation = d3
    .forceSimulation(graphNodes as d3.SimulationNodeDatum[])
    .force('link', d3.forceLink(graphLinks).id((d: any) => d.id).distance(linkDist))
    .force('charge', manyBody)
    .force('center', d3.forceCenter(0, 0));

  if (count <= 800) {
    simulation.force('collide', d3.forceCollide().radius(12).iterations(count > 400 ? 1 : 2));
  }

  simulation.stop();

  for (let i = 0; i < ticks; i++) {
    simulation.tick();
  }

  graphNodes.forEach((node) => {
    positions.set(node.id, { x: node.x, y: node.y });
  });

  return positions;
}
