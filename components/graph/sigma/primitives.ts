import { layerBorder } from '@sigma/node-border';
import { DEFAULT_PRIMITIVES } from 'sigma/primitives';
import { extremityArrow, pathCurved, pathLine, sdfCircle, sdfSquare } from 'sigma/rendering';

export const SIGMA_PRIMITIVES = {
  ...DEFAULT_PRIMITIVES,
  depthLayers: [
    'dimmedEdges',
    'edges',
    'activeEdges',
    'topEdges',
    'dimmedNodes',
    'nodes',
    'activeNodes',
    'topNodes',
  ],
  nodes: {
    ...DEFAULT_PRIMITIVES.nodes,
    shapes: [sdfCircle(), sdfSquare()],
    variables: {
      borderColor: { type: 'color' as const, default: '#ffffff' },
    },
    layers: [
      layerBorder({
        borders: [
          { size: 1, mode: 'pixels', color: { attribute: 'borderColor' } },
          { size: 0, fill: true, color: { attribute: 'color' } },
        ],
      }),
    ],
  },
  edges: {
    ...DEFAULT_PRIMITIVES.edges,
    paths: [pathLine(), pathCurved()],
    extremities: [extremityArrow()],
  },
};
