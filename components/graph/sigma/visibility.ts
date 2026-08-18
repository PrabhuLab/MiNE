import type Graph from 'graphology';
import { isSecondaryNode } from '@/services/graphPresentation/visibility';

export { isSecondaryNode } from '@/services/graphPresentation/visibility';

export interface SigmaVisibilityContext {
  bipartite: boolean;
  hiddenItems: Set<string>;
  isolatedLegendItem: string | null;
  isolatedCommunityId: string | null;
  displayMap: Record<string, number>;
  legendNodeMembership: Map<string, Set<string>>;
}

export function isSigmaNodeVisible(
  nodeKey: string,
  attrs: any,
  context: SigmaVisibilityContext,
  isolatedCommunityOverride?: string | null,
  isolatedLegendOverride?: string | null,
): boolean {
  const rawNode = attrs.rawNode;
  const secondary = isSecondaryNode(rawNode, context.bipartite);
  const isolatedLegend = isolatedLegendOverride !== undefined ? isolatedLegendOverride : context.isolatedLegendItem;
  const isolatedCommunity = isolatedCommunityOverride !== undefined ? isolatedCommunityOverride : context.isolatedCommunityId;
  const displayIndex = context.displayMap[nodeKey] ?? -1;

  if (context.hiddenItems.has('element:standard') && !secondary) return false;
  if (context.hiddenItems.has('element:bipartite') && secondary) return false;
  if (context.hiddenItems.has(`community:${displayIndex}`)) return false;
  if (rawNode?.type && context.hiddenItems.has(`type:${rawNode.type}`)) return false;
  for (const hiddenId of context.hiddenItems) {
    if (hiddenId.startsWith('attribute:') && context.legendNodeMembership.get(hiddenId)?.has(nodeKey)) return false;
  }
  if (isolatedCommunity && String(displayIndex) !== isolatedCommunity.replace('community:', '')) return false;

  if (isolatedLegend === 'element:standard' && secondary) return false;
  if (isolatedLegend === 'element:bipartite' && !secondary) return false;
  if (isolatedLegend?.startsWith('type:') && rawNode?.type !== isolatedLegend.replace('type:', '')) return false;
  if (isolatedLegend?.startsWith('community:') && String(displayIndex) !== isolatedLegend.replace('community:', '')) return false;
  if (isolatedLegend?.startsWith('attribute:')
    && context.legendNodeMembership.get(isolatedLegend)?.size
    && !context.legendNodeMembership.get(isolatedLegend)?.has(nodeKey)) return false;
  return true;
}

export function collectVisibleSigmaNodeIds(
  graph: Graph,
  context: SigmaVisibilityContext,
  communityMap: Record<string, string>,
  targetFilter?: string | null,
  isolatedCommunityOverride?: string | null,
  isolatedLegendOverride?: string | null,
): string[] {
  const matchingIds: string[] = [];
  graph.forEachNode((nodeId: string, attrs: any) => {
    if (!isSigmaNodeVisible(nodeId, attrs, context, isolatedCommunityOverride, isolatedLegendOverride)) return;
    if (targetFilter?.startsWith('community:')) {
      const target = targetFilter.replace('community:', '');
      const displayIndex = context.displayMap[nodeId] !== undefined ? String(context.displayMap[nodeId]) : null;
      if (displayIndex !== target && communityMap[nodeId] !== target) return;
    } else if (targetFilter?.startsWith('type:')) {
      if (attrs.rawNode?.type !== targetFilter.replace('type:', '')) return;
    } else if (targetFilter?.startsWith('attribute:')) {
      if (!context.legendNodeMembership.get(targetFilter)?.has(nodeId)) return;
    } else if (targetFilter === 'element:bipartite' && !isSecondaryNode(attrs.rawNode, context.bipartite)) {
      return;
    } else if (targetFilter === 'element:standard' && isSecondaryNode(attrs.rawNode, context.bipartite)) {
      return;
    }
    matchingIds.push(nodeId);
  });
  return matchingIds;
}
