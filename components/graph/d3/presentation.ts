import type { RawEdge, RawNode } from '@/store/useStore';
import { isSecondaryNode } from '@/services/graphPresentation/visibility';

export interface D3PresentationContext {
  bipartite: boolean;
  directed: boolean;
  hiddenItems: Set<string>;
  isolatedLegendItem: string | null;
  selectedCommunityId: string | null;
  isolatedCommunityId: string | null;
  hoveredCommunityId: string | null;
  displayMap: Record<string, number>;
  clickedNodeId: string | null;
  clickedEdge: RawEdge | null;
  selectedNeighborSet: Set<string>;
  searchMatchSet: Set<string>;
  focusedEdgeNodeSet: Set<string>;
  showNodeLabels: boolean;
  nodeOpacity: number;
}

export interface D3NodePresentation {
  hidden: boolean;
  dimmed: boolean;
  focused: boolean;
  neighbor: boolean;
  communityMember: boolean;
  opacity: number;
  labelVisible: boolean;
}

export interface D3EdgePresentation {
  hidden: boolean;
  dimmed: boolean;
  focused: boolean;
  opacity: number;
}

export function activeCommunityId(context: D3PresentationContext): string | null {
  return context.hoveredCommunityId
    || context.selectedCommunityId
    || context.isolatedCommunityId
    || (context.isolatedLegendItem?.startsWith('community:') ? context.isolatedLegendItem : null);
}

export function isD3NodeLegendVisible(
  node: RawNode,
  context: Pick<D3PresentationContext, 'bipartite' | 'hiddenItems' | 'isolatedLegendItem' | 'displayMap'>,
  isolatedLegendOverride?: string | null,
): boolean {
  const secondary = isSecondaryNode(node, context.bipartite);
  const displayIndex = context.displayMap[node.id] ?? -1;
  const isolatedLegend = isolatedLegendOverride !== undefined
    ? isolatedLegendOverride
    : context.isolatedLegendItem;

  if (context.hiddenItems.has('element:standard') && !secondary) return false;
  if (context.hiddenItems.has('element:bipartite') && secondary) return false;
  if (context.hiddenItems.has(`community:${displayIndex}`)) return false;
  if (node.type && context.hiddenItems.has(`type:${node.type}`)) return false;
  if (isolatedLegend === 'element:standard' && secondary) return false;
  if (isolatedLegend === 'element:bipartite' && !secondary) return false;
  if (isolatedLegend?.startsWith('type:') && node.type !== isolatedLegend.replace('type:', '')) return false;
  if (isolatedLegend?.startsWith('community:') && String(displayIndex) !== isolatedLegend.replace('community:', '')) return false;
  return true;
}

export function collectVisibleD3NodeIds(
  nodes: RawNode[],
  context: Pick<D3PresentationContext, 'bipartite' | 'hiddenItems' | 'isolatedLegendItem' | 'isolatedCommunityId' | 'displayMap'>,
  targetFilter?: string | null,
  isolatedCommunityOverride?: string | null,
  isolatedLegendOverride?: string | null,
): string[] {
  const isolatedCommunity = isolatedCommunityOverride !== undefined
    ? isolatedCommunityOverride
    : context.isolatedCommunityId;
  return nodes.filter((node) => {
    if (!isD3NodeLegendVisible(node, context, isolatedLegendOverride)) return false;
    if (isolatedCommunity && String(context.displayMap[node.id] ?? -1) !== isolatedCommunity.replace('community:', '')) {
      return false;
    }
    if (targetFilter?.startsWith('community:')) {
      return String(context.displayMap[node.id] ?? -1) === targetFilter.replace('community:', '');
    }
    if (targetFilter?.startsWith('type:')) return node.type === targetFilter.replace('type:', '');
    if (targetFilter === 'element:bipartite') return isSecondaryNode(node, context.bipartite);
    if (targetFilter === 'element:standard') return !isSecondaryNode(node, context.bipartite);
    return true;
  }).map((node) => node.id);
}

export function getD3NodePresentation(node: RawNode, context: D3PresentationContext): D3NodePresentation {
  if (!isD3NodeLegendVisible(node, context)) {
    return { hidden: true, dimmed: false, focused: false, neighbor: false, communityMember: false, opacity: 0, labelVisible: false };
  }
  if (context.focusedEdgeNodeSet.size > 0 && !context.focusedEdgeNodeSet.has(node.id)) {
    return { hidden: true, dimmed: false, focused: false, neighbor: false, communityMember: false, opacity: 0, labelVisible: false };
  }

  let dimmed = false;
  let focused = context.focusedEdgeNodeSet.has(node.id);
  let neighbor = false;
  let communityMember = false;
  const activeCommunity = activeCommunityId(context);
  if (activeCommunity) {
    communityMember = String(context.displayMap[node.id] ?? -1) === activeCommunity.replace('community:', '');
    if (!communityMember) dimmed = true;
  }
  if (context.clickedNodeId) {
    if (node.id === context.clickedNodeId) focused = true;
    else if (context.selectedNeighborSet.has(node.id)) neighbor = true;
    else dimmed = true;
  }
  if (context.searchMatchSet.size > 0) {
    if (context.searchMatchSet.has(node.id)) focused = true;
    else dimmed = true;
  }

  const labelVisible = focused
    || neighbor
    || (activeCommunity ? communityMember : context.showNodeLabels);
  return {
    hidden: false,
    dimmed,
    focused,
    neighbor,
    communityMember,
    opacity: dimmed ? context.nodeOpacity * 0.1 : context.nodeOpacity,
    labelVisible,
  };
}

export function getD3EdgePresentation(
  source: string,
  target: string,
  rawEdge: RawEdge,
  baseOpacity: number,
  context: D3PresentationContext,
  nodePresentation: Map<string, D3NodePresentation>,
): D3EdgePresentation {
  if (context.hiddenItems.has('element:edges')) {
    return { hidden: true, dimmed: false, focused: false, opacity: 0 };
  }
  if (nodePresentation.get(source)?.hidden || nodePresentation.get(target)?.hidden) {
    return { hidden: true, dimmed: false, focused: false, opacity: 0 };
  }

  let dimmed = false;
  let focused = false;
  if (context.clickedNodeId) {
    if (source === context.clickedNodeId || target === context.clickedNodeId) focused = true;
    else dimmed = true;
  } else if (context.clickedEdge) {
    const selectedSource = String(context.clickedEdge.source);
    const selectedTarget = String(context.clickedEdge.target);
    if ((source === selectedSource && target === selectedTarget)
      || (!context.directed && source === selectedTarget && target === selectedSource)) focused = true;
    else dimmed = true;
  } else {
    const activeCommunity = activeCommunityId(context);
    if (activeCommunity) {
      const community = activeCommunity.replace('community:', '');
      const sourceCommunity = String(context.displayMap[source] ?? -1);
      const targetCommunity = String(context.displayMap[target] ?? -1);
      if (sourceCommunity === community && targetCommunity === community) focused = true;
      else if (sourceCommunity !== community && targetCommunity !== community) dimmed = true;
    }
  }

  return {
    hidden: false,
    dimmed,
    focused,
    opacity: focused ? Math.min(1, baseOpacity * 1.5) : dimmed ? baseOpacity * 0.1 : baseOpacity,
  };
}
