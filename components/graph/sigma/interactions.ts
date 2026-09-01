import type Graph from 'graphology';
import type { MutableRefObject } from 'react';
import type Sigma from 'sigma';
import type { RawEdge, RawNode } from '@/store/useStore';

interface SigmaInteractionConfig {
  sigma: Sigma;
  graph: Graph;
  displayMap: Record<string, number>;
  clickedNodeRef: MutableRefObject<RawNode | null>;
  beginDrag?: (id: string, x: number, y: number) => void;
  movePinnedNode?: (id: string, x: number, y: number) => void;
  endDrag?: (id: string) => void;
  onElementDoubleClick?: (id: string, type: 'node' | 'edge') => void;
  onClearSelection?: () => void;
  setClickedNode: (node: RawNode | null) => void;
  setClickedDegree: (degree: number) => void;
  setClickedEdge: (edge: RawEdge | null) => void;
  setTooltip: (tooltip: {
    x: number;
    y: number;
    title: string;
    items: { label: string; value: string | number }[];
  } | null) => void;
}

export function registerSigmaInteractions({
  sigma,
  graph,
  displayMap,
  clickedNodeRef,
  beginDrag,
  movePinnedNode,
  endDrag,
  onElementDoubleClick,
  onClearSelection,
  setClickedNode,
  setClickedDegree,
  setClickedEdge,
  setTooltip,
}: SigmaInteractionConfig) {
  const isInteractiveNode = (nodeKey: string) => {
    const data = sigma.getNodeDisplayData(nodeKey);
    return Boolean(data && data.visibility !== 'hidden' && (data.opacity ?? 1) > 0);
  };

  sigma.on('nodeDragStart', (event) => {
    if (beginDrag && graph.hasNode(event.node) && isInteractiveNode(event.node)) {
      beginDrag(event.node, graph.getNodeAttribute(event.node, 'x'), graph.getNodeAttribute(event.node, 'y'));
    }
  });
  sigma.on('nodeDrag', (event) => {
    if (movePinnedNode && graph.hasNode(event.node) && isInteractiveNode(event.node)) {
      movePinnedNode(event.node, graph.getNodeAttribute(event.node, 'x'), graph.getNodeAttribute(event.node, 'y'));
    }
  });
  sigma.on('nodeDragEnd', (event) => endDrag?.(event.node));

  sigma.on('enterNode', (event) => {
    const nodeKey = event.node;
    if (!isInteractiveNode(nodeKey)) return;
    const attributes = graph.getNodeAttributes(nodeKey);
    const rawNode = attributes.rawNode;
    const displayIndex = displayMap[nodeKey] ?? -1;
    const items: { label: string; value: string | number }[] = [];
    if (rawNode?.type) items.push({ label: 'Type', value: rawNode.type });
    items.push({ label: 'Community', value: displayIndex >= 0 ? displayIndex : 'N/A' });
    items.push({ label: 'Degree', value: graph.degree(nodeKey) });
    setTooltip({
      x: event.event.x,
      y: event.event.y,
      title: rawNode?.name || rawNode?.label || nodeKey,
      items,
    });
  });
  sigma.on('leaveNode', () => setTooltip(null));
  sigma.on('clickNode', (event) => {
    const nodeKey = event.node;
    if (!isInteractiveNode(nodeKey)) return;
    if (clickedNodeRef.current?.id === nodeKey) {
      setClickedNode(null);
      setClickedEdge(null);
      return;
    }
    const rawNode = graph.getNodeAttribute(nodeKey, 'rawNode');
    setClickedNode(rawNode || { id: nodeKey, name: nodeKey });
    setClickedDegree(graph.degree(nodeKey));
    setClickedEdge(null);
  });
  sigma.on('doubleClickNode', (event) => {
    event.preventSigmaDefault();
    if (!isInteractiveNode(event.node)) return;
    onElementDoubleClick?.(event.node, 'node');
  });
  sigma.on('clickStage', () => {
    setClickedNode(null);
    setClickedEdge(null);
    onClearSelection?.();
  });
}
