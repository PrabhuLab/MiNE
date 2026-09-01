export interface LegendVisibilityInput {
  nodeIds: Iterable<string>;
  edges: Array<{ id: string; source: string; target: string }>;
  hiddenItemIds: Iterable<string>;
  isolatedItemId: string | null;
  nodeMembership: Map<string, Set<string>>;
  edgeMembership: Map<string, Set<string>>;
}

export interface LegendVisibilityResult {
  visibleNodeIds: Set<string>;
  visibleEdgeIds: Set<string>;
  isNodeVisible: (id: string) => boolean;
  isEdgeVisible: (id: string) => boolean;
}

export interface GraphLegendVisibilityInput {
  nodes: Array<{ id: string; type?: unknown }>;
  edges: Array<{ id: string; source: string; target: string }>;
  bipartite: boolean;
  isSecondaryNode: (node: any) => boolean;
  displayMap: Record<string, number>;
  hiddenItemIds: Iterable<string>;
  isolatedItemId: string | null;
  nodeMembership?: Map<string, Set<string>>;
  edgeMembership?: Map<string, Set<string>>;
}

export function legendItemId(scope: 'node' | 'edge', attribute: string, value: unknown): string {
  return `attribute:${scope}:${encodeURIComponent(attribute)}:${encodeURIComponent(String(value))}`;
}

/** Renderer-independent hide/isolate projection for renderers and data tables. */
export function computeLegendVisibility(input: LegendVisibilityInput): LegendVisibilityResult {
  let visibleNodeIds = new Set(Array.from(input.nodeIds, String));
  let visibleEdgeIds = new Set(input.edges.map((edge) => String(edge.id)));
  const hidden = new Set(input.hiddenItemIds);

  hidden.forEach((itemId) => {
    const nodeMembers = input.nodeMembership.get(itemId);
    const edgeMembers = input.edgeMembership.get(itemId);
    nodeMembers?.forEach((id) => visibleNodeIds.delete(String(id)));
    edgeMembers?.forEach((id) => visibleEdgeIds.delete(String(id)));
  });

  if (input.isolatedItemId) {
    const nodeMembers = input.nodeMembership.get(input.isolatedItemId);
    const edgeMembers = input.edgeMembership.get(input.isolatedItemId);
    if (nodeMembers?.size) {
      const builtInNodeElement = input.isolatedItemId === 'element:standard' || input.isolatedItemId === 'element:bipartite';
      // Node/category isolation is an ego projection: retain the selected
      // members, their direct neighbours, and only edges incident to a member.
      // This preserves internal edges without leaking neighbour-to-neighbour
      // edges or unrelated components into the isolated view.
      const selectedMembers = new Set(Array.from(nodeMembers, String).filter((id) => visibleNodeIds.has(id)));
      const incidentEdges = new Set<string>();
      const projectedNodes = new Set(selectedMembers);
      input.edges.forEach((edge) => {
        const id = String(edge.id);
        if (!visibleEdgeIds.has(id)) return;
        const source = String(edge.source);
        const target = String(edge.target);
        if (builtInNodeElement ? (!selectedMembers.has(source) || !selectedMembers.has(target)) : (!selectedMembers.has(source) && !selectedMembers.has(target))) return;
        incidentEdges.add(id);
        if (!builtInNodeElement && visibleNodeIds.has(source)) projectedNodes.add(source);
        if (!builtInNodeElement && visibleNodeIds.has(target)) projectedNodes.add(target);
      });
      visibleNodeIds = projectedNodes;
      visibleEdgeIds = incidentEdges;
    } else if (edgeMembers?.size) {
      visibleEdgeIds = new Set(Array.from(edgeMembers, String).filter((id) => visibleEdgeIds.has(id)));
      if (input.isolatedItemId === 'element:edges') visibleNodeIds = new Set();
      else {
        const endpoints = new Set<string>();
        input.edges.forEach((edge) => {
          if (!visibleEdgeIds.has(String(edge.id))) return;
          endpoints.add(String(edge.source));
          endpoints.add(String(edge.target));
        });
        visibleNodeIds = new Set(Array.from(endpoints).filter((id) => visibleNodeIds.has(id)));
      }
    }
  }

  const edgeOnlyIsolation = input.isolatedItemId === 'element:edges';
  if (!edgeOnlyIsolation) input.edges.forEach((edge) => {
    const id = String(edge.id);
    if (!visibleNodeIds.has(String(edge.source)) || !visibleNodeIds.has(String(edge.target))) visibleEdgeIds.delete(id);
  });

  return {
    visibleNodeIds,
    visibleEdgeIds,
    isNodeVisible: (id) => visibleNodeIds.has(String(id)),
    isEdgeVisible: (id) => visibleEdgeIds.has(String(id)),
  };
}

/** Adds built-in element, type, and displayed-community memberships before projecting visibility. */
export function computeGraphLegendVisibility(input: GraphLegendVisibilityInput): LegendVisibilityResult {
  const nodeMembership = new Map(Array.from(input.nodeMembership || [], ([id, members]) => [id, new Set(members)]));
  const edgeMembership = new Map(Array.from(input.edgeMembership || [], ([id, members]) => [id, new Set(members)]));
  const primary = new Set<string>();
  const secondary = new Set<string>();

  input.nodes.forEach((node) => {
    const nodeId = String(node.id);
    (input.bipartite && input.isSecondaryNode(node) ? secondary : primary).add(nodeId);
    const community = input.displayMap[nodeId];
    if (community !== undefined) {
      const id = `community:${community}`;
      const members = nodeMembership.get(id) || new Set<string>();
      members.add(nodeId);
      nodeMembership.set(id, members);
    }
    if (node.type !== undefined && node.type !== null && String(node.type) !== '') {
      const id = `type:${String(node.type)}`;
      const members = nodeMembership.get(id) || new Set<string>();
      members.add(nodeId);
      nodeMembership.set(id, members);
    }
  });
  nodeMembership.set('element:standard', primary);
  nodeMembership.set('element:bipartite', secondary);
  edgeMembership.set('element:edges', new Set(input.edges.map((edge) => String(edge.id))));

  return computeLegendVisibility({
    nodeIds: input.nodes.map((node) => String(node.id)),
    edges: input.edges,
    hiddenItemIds: input.hiddenItemIds,
    isolatedItemId: input.isolatedItemId,
    nodeMembership,
    edgeMembership,
  });
}
