import * as d3 from 'd3';
import { computeForceDirectedLayout } from '../../lib/layoutUtils.ts';

let simulation: d3.Simulation<any, any> | null = null;
let nodes: any[] = [];
let nodesById = new Map<string, any>();

const charge = (strength: number) => {
  const force = d3.forceManyBody().strength(strength);
  if (nodes.length > 800) force.theta(0.9);
  return force;
};

self.onmessage = ({ data }) => {
  try {
    if (data.type === 'static') {
      const positions = computeForceDirectedLayout(data.nodes, data.edges, data.directed, data.forceStrength);
      self.postMessage({ positions });
      return;
    }
    if (data.type === 'start') {
      nodes = data.nodes;
      nodesById = new Map(nodes.map((node) => [node.id, node]));
      simulation?.stop();
      simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(data.links).id((node: any) => node.id)
          .distance(Math.max(35, Math.min(100, 1000 / Math.sqrt(nodes.length || 1)))))
        .force('charge', charge(data.forceStrength))
        .force('center', d3.forceCenter(0, 0))
        .alphaDecay(0.02)
        .stop();
      if (nodes.length <= 800) simulation.force('collide', d3.forceCollide().radius((node: any) => (node.size || 5) + 4).iterations(1));
      return;
    }
    if (!simulation) return;
    if (data.type === 'strength') {
      simulation.force('charge', charge(data.forceStrength)).alpha(0.3);
    } else if (data.type === 'pin') {
      const node = nodesById.get(data.id);
      if (node) { node.fx = data.x; node.fy = data.y; }
      simulation.alphaTarget(0.3);
    } else if (data.type === 'release') {
      const node = nodesById.get(data.id);
      if (node) { node.fx = null; node.fy = null; }
      simulation.alphaTarget(0);
    } else if (data.type === 'tick') {
      simulation.tick();
      const positions = new Float64Array(nodes.length * 2);
      nodes.forEach((node, index) => { positions[index * 2] = node.x; positions[index * 2 + 1] = node.y; });
      self.postMessage({ positions, running: simulation.alpha() >= simulation.alphaMin() || simulation.alphaTarget() > 0 }, { transfer: [positions.buffer] });
    }
  } catch (cause) {
    self.postMessage({ error: cause instanceof Error ? cause.message : String(cause) });
  }
};
