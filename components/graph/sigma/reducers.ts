import type Graph from 'graphology';
import type { MutableRefObject } from 'react';

export function createSigmaNodeReducer(styleRefs: MutableRefObject<any>) {
  return (nodeKey: string, data: any) => {
    const {
      hiddenItems,
      isolatedLegendItem,
      selectedCommunityId,
      isolatedCommunityId,
      hoveredCommunityId,
      displayMap,
      clickedNodeRef,
      showNodeLabels,
      selectedNeighborSet,
      searchMatchSet,
      isSecondaryMap,
      focusedEdgeNodeSet,
      legendNodeMembership,
    } = styleRefs.current;

    const displayIndex = displayMap[nodeKey] ?? -1;
    const isSecondary = isSecondaryMap.get(nodeKey);
    const result = {
      ...data,
      visibility: data.visibility ?? 'visible',
      labelVisibility: 'hidden',
    };
    const hideNode = () => ({
      ...result,
      // Sigma 4 beta zeroes hidden node program slots, which can render the
      // zero-index node as a single ghost instance. A zero-size transparent
      // node keeps its own slot valid while remaining non-rendered/non-pickable.
      visibility: 'visible' as const,
      labelVisibility: 'hidden' as const,
      opacity: 0,
    });

    if (result.visibility === 'hidden') return hideNode();
    if (hiddenItems.has('element:standard') && !isSecondary) return hideNode();
    if (hiddenItems.has('element:bipartite') && isSecondary) return hideNode();
    if (hiddenItems.has(`community:${displayIndex}`)) return hideNode();

    const type = data.rawNode?.type;
    if (type && hiddenItems.has(`type:${type}`)) return hideNode();
    for (const hiddenId of hiddenItems as Set<string>) {
      if (hiddenId.startsWith('attribute:') && legendNodeMembership.get(hiddenId)?.has(nodeKey)) return hideNode();
    }
    if (isolatedLegendItem === 'element:standard' && isSecondary) return hideNode();
    if (isolatedLegendItem === 'element:bipartite' && !isSecondary) return hideNode();
    if (isolatedLegendItem?.startsWith('type:') && type !== isolatedLegendItem.replace('type:', '')) {
      return hideNode();
    }
    if (isolatedLegendItem?.startsWith('community:') && String(displayIndex) !== isolatedLegendItem.replace('community:', '')) {
      return hideNode();
    }
    if (isolatedLegendItem?.startsWith('attribute:')
      && legendNodeMembership.get(isolatedLegendItem)?.size
      && !legendNodeMembership.get(isolatedLegendItem)?.has(nodeKey)) return hideNode();

    let dimmed = false;
    let focused = false;
    let neighbor = false;
    let communityMember = false;
    if (focusedEdgeNodeSet.size > 0) {
      if (!focusedEdgeNodeSet.has(nodeKey)) return hideNode();
      focused = true;
      result.highlighted = true;
    }
    const activeCommunity = (hoveredCommunityId?.startsWith('community:') ? hoveredCommunityId : null) || selectedCommunityId || isolatedCommunityId
      || (isolatedLegendItem?.startsWith('community:') ? isolatedLegendItem : null);
    if (activeCommunity) {
      if (String(displayIndex) === activeCommunity.replace('community:', '')) communityMember = true;
      else dimmed = true;
    }
    const hoveredAttribute = hoveredCommunityId?.startsWith('attribute:') ? hoveredCommunityId : null;
    if (hoveredAttribute) {
      const members = legendNodeMembership.get(hoveredAttribute);
      if (members?.size) {
        if (members.has(nodeKey)) {
          focused = true;
          result.highlighted = true;
        } else dimmed = true;
      }
    }

    const selectedNode = clickedNodeRef.current;
    if (selectedNode) {
      if (nodeKey === selectedNode.id) {
        focused = true;
        result.highlighted = true;
      } else if (selectedNeighborSet.has(nodeKey)) neighbor = true;
      else dimmed = true;
    }
    if (searchMatchSet.size > 0) {
      if (!searchMatchSet.has(nodeKey)) dimmed = true;
      else {
        focused = true;
        result.highlighted = true;
      }
    }

    if (focused) result.depth = 'topNodes';
    else if (neighbor || communityMember) result.depth = 'activeNodes';
    else if (dimmed) result.depth = 'dimmedNodes';
    else result.depth = 'nodes';
    result.opacity = dimmed ? (data.opacity ?? 1) * 0.1 : (data.opacity ?? 1);
    result.label = data.rawNode?.name || data.rawNode?.label || nodeKey;

    if (focused || neighbor) result.labelVisibility = 'visible';
    else if (activeCommunity) result.labelVisibility = communityMember ? (showNodeLabels ? 'auto' : 'visible') : 'hidden';
    else if (showNodeLabels) result.labelVisibility = 'auto';
    return result;
  };
}

export function createSigmaEdgeReducer(graph: Graph, styleRefs: MutableRefObject<any>) {
  return (edgeKey: string, data: any) => {
    const {
      hiddenItems,
      clickedNodeRef,
      clickedEdgeRef,
      directed,
      selectedCommunityId,
      isolatedCommunityId,
      hoveredCommunityId,
      isolatedLegendItem,
      displayMap,
      focusedEdgeNodeSet,
      isSecondaryMap,
      getShouldShowArrowhead,
      legendNodeMembership,
      legendEdgeMembership,
    } = styleRefs.current;
    const [source, target] = graph.extremities(edgeKey);
    const rawEdge = graph.getEdgeAttribute(edgeKey, 'rawEdge') || { source, target };
    const result = {
      ...data,
      visibility: data.visibility ?? 'visible',
      path: directed ? 'curved' : 'straight',
      curvature: directed ? Number(data.curvature ?? 0.3) : 0,
      head: directed && getShouldShowArrowhead(rawEdge) ? 'arrow' : 'none',
    };
    if (hiddenItems.has('element:edges')) return { ...result, visibility: 'hidden' };
    const rawEdgeId = String(rawEdge.key ?? `${source}->${target}`);
    for (const hiddenId of hiddenItems as Set<string>) {
      if (hiddenId.startsWith('attribute:') && legendEdgeMembership.get(hiddenId)?.has(rawEdgeId)) return { ...result, visibility: 'hidden' };
    }
    if (isolatedLegendItem?.startsWith('attribute:')
      && legendEdgeMembership.get(isolatedLegendItem)?.size
      && !legendEdgeMembership.get(isolatedLegendItem)?.has(rawEdgeId)) return { ...result, visibility: 'hidden' };

    const nodeHidden = (nodeKey: string) => {
      const attrs = graph.getNodeAttributes(nodeKey);
      const rawNode = attrs.rawNode;
      const displayIndex = displayMap[nodeKey] ?? -1;
      const secondary = isSecondaryMap.get(nodeKey);
      const type = rawNode?.type;
      return (
        (hiddenItems.has('element:standard') && !secondary)
        || (hiddenItems.has('element:bipartite') && secondary)
        || hiddenItems.has(`community:${displayIndex}`)
        || Boolean(type && hiddenItems.has(`type:${type}`))
        || (isolatedLegendItem === 'element:standard' && secondary)
        || (isolatedLegendItem === 'element:bipartite' && !secondary)
        || Boolean(isolatedLegendItem?.startsWith('type:') && type !== isolatedLegendItem.replace('type:', ''))
        || Boolean(isolatedLegendItem?.startsWith('community:') && String(displayIndex) !== isolatedLegendItem.replace('community:', ''))
        || Boolean(isolatedLegendItem?.startsWith('attribute:')
          && legendNodeMembership.get(isolatedLegendItem)?.size
          && !legendNodeMembership.get(isolatedLegendItem)?.has(nodeKey))
        || (focusedEdgeNodeSet.size > 0 && !focusedEdgeNodeSet.has(nodeKey))
      );
    };
    if (nodeHidden(source) || nodeHidden(target)) return { ...result, visibility: 'hidden' };
    if (focusedEdgeNodeSet.size > 0 && (!focusedEdgeNodeSet.has(source) || !focusedEdgeNodeSet.has(target))) {
      return { ...result, visibility: 'hidden' };
    }
    let dimmed = false;
    let focused = false;
    const selectedNode = clickedNodeRef.current;
    if (selectedNode) {
      if (source === selectedNode.id || target === selectedNode.id) focused = true;
      else dimmed = true;
    } else if (clickedEdgeRef.current) {
      const selectedSource = clickedEdgeRef.current.source;
      const selectedTarget = clickedEdgeRef.current.target;
      if ((source === selectedSource && target === selectedTarget) || (!directed && source === selectedTarget && target === selectedSource)) focused = true;
      else dimmed = true;
    } else {
      const activeCommunity = (hoveredCommunityId?.startsWith('community:') ? hoveredCommunityId : null) || selectedCommunityId || isolatedCommunityId
        || (isolatedLegendItem?.startsWith('community:') ? isolatedLegendItem : null);
      if (activeCommunity) {
        const community = activeCommunity.replace('community:', '');
        const sourceCommunity = String(displayMap[source] ?? -1);
        const targetCommunity = String(displayMap[target] ?? -1);
        if (sourceCommunity === community && targetCommunity === community) focused = true;
        else if (sourceCommunity !== community && targetCommunity !== community) dimmed = true;
      }
    }

    if (focused) {
      result.depth = 'topEdges';
      result.opacity = Math.min(1, (data.opacity ?? 1) * 1.5);
    } else if (dimmed) {
      result.depth = 'dimmedEdges';
      result.opacity = (data.opacity ?? 1) * 0.1;
    } else {
      result.depth = 'edges';
      result.opacity = data.opacity;
    }
    return result;
  };
}
