import type Graph from 'graphology';

/** Repaint without topology changes or one Graphology event per element. */
export function updateGraphColors(
  graph: Graph,
  dark: boolean,
  nodeColor: (node: any) => string,
  edgeColor: (edge: any) => string,
): void {
  const strokeColor = dark ? '#ffffff' : '#141414';
  graph.updateEachNodeAttributes((_id, attrs) => ({
    ...attrs, color: nodeColor(attrs.rawNode || attrs), borderColor: strokeColor, labelColor: strokeColor,
  }), { attributes: ['color', 'borderColor', 'labelColor'] });
  graph.updateEachEdgeAttributes((_id, attrs) => ({
    ...attrs, color: edgeColor(attrs.rawEdge || attrs),
  }), { attributes: ['color'] });
}
