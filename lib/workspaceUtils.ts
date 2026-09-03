import type Graph from 'graphology';
import type { NodeFilter } from '@/store/useStore';

export function computeMaxRelWeight(rawEdges: any[]): number {
  if (!rawEdges || rawEdges.length === 0) return 100;
  let max = 0;
  for (const e of rawEdges) {
    if (e.weight_secondary !== undefined && e.weight_secondary > max) {
      max = e.weight_secondary;
    }
  }
  return max ? Number(max.toFixed(2)) : 100;
}

export function computeMaxRawWeight(rawEdges: any[]): number {
  if (!rawEdges || rawEdges.length === 0) return 500;
  let max = 0;
  for (const e of rawEdges) {
    if (e.weight_raw !== undefined && e.weight_raw > max) {
      max = e.weight_raw;
    }
  }
  return max ? Math.ceil(max) : 500;
}

export function computeActiveNetwork(rawNodes: any[], rawEdges: any[], appliedFilters: any) {
  const removedSet = new Set(
    (appliedFilters.removedNodes || '').split(',')
      .map((s: string) => s.trim())
      .filter(Boolean)
  );

  const eligibleNodes = (rawNodes || []).filter(n => {
    const nodeIdStr = String(n.id);
    return !removedSet.has(nodeIdStr);
  });
  const eligibleNodeIds = new Set(eligibleNodes.map(n => String(n.id)));

  const filteredEdges = (rawEdges || []).filter(e => {
    const filter = appliedFilters.edgeFilter;
    const value = filter ? Number(e[filter.attribute]) : 0;
    const passesWeightFilter = !filter || filter.source === 'metric'
      || (Number.isFinite(value) && value >= Number(filter.min) && value <= Number(filter.max));

    return passesWeightFilter &&
      !removedSet.has(String(e.source)) &&
      !removedSet.has(String(e.target)) &&
      eligibleNodeIds.has(String(e.source)) &&
      eligibleNodeIds.has(String(e.target));
  });
  const strictlyValidEdges = filteredEdges.filter(e =>
    eligibleNodeIds.has(String(e.source)) && eligibleNodeIds.has(String(e.target))
  );

  const nodesWithEdges = new Set<string>();
  strictlyValidEdges.forEach(e => {
    nodesWithEdges.add(String(e.source));
    nodesWithEdges.add(String(e.target));
  });
  const filteredNodes = eligibleNodes.filter(n => nodesWithEdges.has(String(n.id)));

  return { validNodes: filteredNodes, validEdges: strictlyValidEdges };
}

/**
 * Applies a node-value filter without changing the graph used to calculate
 * that value. This avoids a self-invalidating cycle for centrality and
 * Louvain metrics while keeping the viewport and data tables in sync.
 */
export function filterNetworkByNodeMetric(
  nodes: any[],
  edges: any[],
  filter: NodeFilter | null | undefined,
  networkMetrics: any[],
) {
  if (!filter) return { validNodes: nodes, validEdges: edges };
  const metricsByNode = new Map((networkMetrics || []).map((entry) => [String(entry.id), entry]));
  const values = nodes.map((node) => Number(metricsByNode.get(String(node.id))?.[filter.attribute] ?? node[filter.attribute]));
  if (!values.some(Number.isFinite)) return { validNodes: nodes, validEdges: edges };

  const validNodes = nodes.filter((node) => {
    const value = Number(metricsByNode.get(String(node.id))?.[filter.attribute] ?? node[filter.attribute]);
    return Number.isFinite(value) && value >= Number(filter.min) && value <= Number(filter.max);
  });
  const nodeIds = new Set(validNodes.map((node) => String(node.id)));
  const validEdges = edges.filter((edge) => nodeIds.has(String(edge.source)) && nodeIds.has(String(edge.target)));
  return { validNodes, validEdges };
}

/** Presentation-stage counterpart for calculated edge metrics. */
export function filterNetworkByEdgeMetric(
  nodes: any[],
  edges: any[],
  filter: { attribute: string; min: number; max: number; source?: string } | null | undefined,
  edgeMetrics: any[],
) {
  if (!filter || filter.source !== 'metric') return { validNodes: nodes, validEdges: edges };
  const metricsByEdge = new Map(edgeMetrics.flatMap((entry) => {
    const keys = [entry.key, entry.source !== undefined ? `${entry.source}->${entry.target}` : undefined].filter(Boolean).map(String);
    return keys.map((key) => [key, entry] as const);
  }));
  const metricFor = (edge: any) => metricsByEdge.get(String(edge.key ?? `${edge.source}->${edge.target}`))
    || metricsByEdge.get(`${edge.source}->${edge.target}`)
    || metricsByEdge.get(`${edge.target}->${edge.source}`)
    || metricsByEdge.get(`${edge.source}--${edge.target}`)
    || metricsByEdge.get(`${edge.target}--${edge.source}`);
  const hasValues = edges.some((edge) => Number.isFinite(Number(metricFor(edge)?.[filter.attribute])));
  if (!hasValues) return { validNodes: nodes, validEdges: edges };
  const validEdges = edges.filter((edge) => {
    const value = Number(metricFor(edge)?.[filter.attribute]);
    return Number.isFinite(value) && value >= Number(filter.min) && value <= Number(filter.max);
  });
  return { validNodes: nodes, validEdges };
}

const finiteWeight = (value: unknown): number => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 1;
};

/**
 * Computes sparse node rows equivalent to summing the igraph modularity
 * matrix within each node's assigned community. The per-node contributions
 * therefore sum to Q without allocating igraph's dense n x n matrix.
 */
export function computeCommunityMetrics(
  graph: Graph,
  newCommunityMap: Record<string, any>,
  directed: boolean,
  resolution = 1,
) {
  const nodes = graph.nodes();
  const communityOf = Object.fromEntries(nodes.map((node) => [node, String(newCommunityMap[node] ?? '')]));
  const nodeIn = Object.fromEntries(nodes.map((node) => [node, 0])) as Record<string, number>;
  const nodeOut = Object.fromEntries(nodes.map((node) => [node, 0])) as Record<string, number>;
  const withinIn = Object.fromEntries(nodes.map((node) => [node, 0])) as Record<string, number>;
  const withinOut = Object.fromEntries(nodes.map((node) => [node, 0])) as Record<string, number>;
  let totalWeight = 0;

  graph.forEachEdge((_edge, attributes, source, target) => {
    const weight = finiteWeight(attributes.weight);
    totalWeight += weight;
    if (directed) {
      nodeOut[source] += weight;
      nodeIn[target] += weight;
      if (communityOf[source] === communityOf[target]) {
        withinOut[source] += weight;
        withinIn[target] += weight;
      }
      return;
    }
    nodeOut[source] += weight;
    nodeOut[target] += weight;
    if (communityOf[source] === communityOf[target]) {
      withinOut[source] += weight;
      withinOut[target] += weight;
    }
  });

  const communityIn: Record<string, number> = {};
  const communityOut: Record<string, number> = {};
  nodes.forEach((node) => {
    const community = communityOf[node];
    communityIn[community] = (communityIn[community] || 0) + nodeIn[node];
    communityOut[community] = (communityOut[community] || 0) + nodeOut[node];
  });

  const metrics = nodes.map((node) => {
    const community = communityOf[node];
    const nodeStrength = directed ? nodeIn[node] + nodeOut[node] : nodeOut[node];
    const communityStrength = directed
      ? (communityIn[community] || 0) + (communityOut[community] || 0)
      : communityOut[community] || 0;
    const withinCommunityWeight = directed ? withinIn[node] + withinOut[node] : withinOut[node];
    const louvainDeltaQ = totalWeight > 0
      ? directed
        ? withinCommunityWeight / totalWeight - resolution * (
          nodeOut[node] * (communityIn[community] || 0) + nodeIn[node] * (communityOut[community] || 0)
        ) / (totalWeight * totalWeight)
        : withinCommunityWeight / totalWeight
          - resolution * nodeStrength * communityStrength / (2 * totalWeight * totalWeight)
      : 0;
    const modularityContribution = louvainDeltaQ / 2;
    return {
      id: node,
      community,
      withinCommunityWeight,
      nodeStrength,
      communityStrength,
      modularityContribution,
      louvainDeltaQ,
      // Preserve the original MiNE column names for imported workspaces.
      deltaQ: louvainDeltaQ,
      k_i_in: withinCommunityWeight,
      nodeDegree: nodeStrength,
      communityDegree: communityStrength,
    };
  });

  metrics.sort((a, b) => b.louvainDeltaQ - a.louvainDeltaQ);
  return metrics;
}

export function computeTableDataNodes(validNodes: any[], networkMetrics: any[], nodeMetrics: any[], communityMap: Record<string, any>, searchQuery: string, sortConfig: { key: string, direction: "asc" | "desc" } | null) {
  const netMap = new Map((networkMetrics || []).map((m: any) => [m.id, m]));
  const modMap = new Map((nodeMetrics || []).map((m: any) => [m.id, m]));

  let data = validNodes.map(node => {
    const net = netMap.get(node.id) || {};
    const mod = modMap.get(node.id) || {};
    const comm = mod.community ?? net.louvain ?? communityMap[node.id] ?? node.community ?? "";
    return { ...node, ...net, ...mod, community: comm || node.community };
  });

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    data = data.filter(d => 
      String(d.id).toLowerCase().includes(q) || 
      String(d.label || d.name || "").toLowerCase().includes(q)
    );
  }

  if (sortConfig) {
    data.sort((a, b) => {
      const aVal: any = a[sortConfig.key];
      const bVal: any = b[sortConfig.key];
      const empty = (value: any) => value === undefined || value === null || value === '';
      if (empty(aVal) && empty(bVal)) return 0;
      if (empty(aVal)) return 1;
      if (empty(bVal)) return -1;
      const direction = sortConfig.direction === 'asc' ? 1 : -1;
      if (typeof aVal === 'number' && typeof bVal === 'number') return (aVal - bVal) * direction;
      if (typeof aVal === 'boolean' && typeof bVal === 'boolean') return (Number(aVal) - Number(bVal)) * direction;
      return String(aVal).localeCompare(String(bVal), undefined, { numeric: true }) * direction;
    });
  }

  return data;
}

export function computeTableDataEdges(validEdges: any[], edgeMetrics: any[], searchQuery: string, sortConfig: { key: string, direction: "asc" | "desc" } | null) {
  const metrics = new Map((edgeMetrics || []).map((entry: any) => [String(entry.key), entry]));
  let data = validEdges.map((edge) => ({ ...edge, ...(metrics.get(String(edge.key)) || metrics.get(`${edge.source}->${edge.target}`) || {}) }));
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    data = data.filter(d => 
      String(d.source).toLowerCase().includes(q) || 
      String(d.target).toLowerCase().includes(q)
    );
  }
  
  if (sortConfig) {
    data = [...data].sort((a, b) => {
      const aVal: any = a[sortConfig.key];
      const bVal: any = b[sortConfig.key];
      const direction = sortConfig.direction === 'asc' ? 1 : -1;
      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;
      if (typeof aVal === 'number' && typeof bVal === 'number') return (aVal - bVal) * direction;
      return String(aVal).localeCompare(String(bVal), undefined, { numeric: true }) * direction;
    });
  }

  return data;
}
