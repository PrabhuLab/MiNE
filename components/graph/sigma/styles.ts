import { DEFAULT_STYLES } from 'sigma/types';

export const SIGMA_STYLES = {
  nodes: [
    DEFAULT_STYLES.nodes,
    {
      shape: { attribute: 'shape' },
      size: { attribute: 'size' },
      color: { attribute: 'color' },
      opacity: { attribute: 'opacity' },
      borderColor: { attribute: 'borderColor' },
      labelColor: { attribute: 'labelColor' },
      depth: { attribute: 'depth' },
    },
  ],
  edges: [
    DEFAULT_STYLES.edges,
    {
      size: { attribute: 'size' },
      color: { attribute: 'color' },
      opacity: { attribute: 'opacity' },
      path: { attribute: 'path' },
      head: { attribute: 'head' },
      depth: { attribute: 'depth' },
    },
  ],
};
