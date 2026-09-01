import type Graph from 'graphology';
import modularityMetric from 'graphology-metrics/graph/modularity.js';

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
    const passesWeightFilter = !filter || (Number.isFinite(value) && value >= Number(filter.min) && value <= Number(filter.max));

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

export function computeCommunityMetrics(graph: Graph, newCommunityMap: Record<string, any>, directed: boolean) {
  let sumWeights = 0;
  graph.forEachEdge((e: any, atts: any) => { sumWeights += (atts.weight || 1); });
      
  const metrics = graph.nodes().map((nodeId: string) => {
    const comm = newCommunityMap[nodeId] || "";
        
    if (directed) {
      const totalWeight = sumWeights;
      let nodeInDegree = 0;
      let nodeOutDegree = 0;
          
      graph.forEachInEdge(nodeId, (e: any, atts: any) => { nodeInDegree += (atts.weight || 1); });
      graph.forEachOutEdge(nodeId, (e: any, atts: any) => { nodeOutDegree += (atts.weight || 1); });

      let commInDegree = 0;
      let commOutDegree = 0;
      graph.forEachNode((n: any) => {
        if (newCommunityMap[n] === comm) {
          graph.forEachInEdge(n, (e: any, atts: any) => { commInDegree += (atts.weight || 1); });
          graph.forEachOutEdge(n, (e: any, atts: any) => { commOutDegree += (atts.weight || 1); });
        }
      });

      let k_in_from_comm = 0;
      let k_out_to_comm = 0;
      graph.forEachInEdge(nodeId, (e: any, atts: any, source: any) => {
        if (newCommunityMap[source] === comm) k_in_from_comm += (atts.weight || 1);
      });
      graph.forEachOutEdge(nodeId, (e: any, atts: any, source: any, target: any) => {
        if (newCommunityMap[target] === comm) k_out_to_comm += (atts.weight || 1);
      });
          
      const nodeCommunityDegree = k_in_from_comm + k_out_to_comm;
      const deltaQ = totalWeight > 0
        ? modularityMetric.directedDelta(totalWeight, commInDegree, commOutDegree, nodeInDegree, nodeOutDegree, nodeCommunityDegree)
        : 0;
            
      return {
        id: nodeId,
        community: comm,
        k_i_in: nodeCommunityDegree,
        nodeDegree: `↓${nodeInDegree.toFixed(2)} ↑${nodeOutDegree.toFixed(2)}`,
        communityDegree: `↓${commInDegree.toFixed(2)} ↑${commOutDegree.toFixed(2)}`,
        deltaQ
      };
    } else {
      const totalWeight = sumWeights;
      let nodeDegree = 0;
      graph.forEachEdge(nodeId, (e: any, atts: any) => { nodeDegree += (atts.weight || 1); });
          
      let communityDegree = 0;
      graph.forEachNode((n: any) => {
        if (newCommunityMap[n] === comm) {
          graph.forEachEdge(n, (e: any, atts: any) => { communityDegree += (atts.weight || 1); });
        }
      });

      let k_i_in = 0;
      graph.forEachEdge(nodeId, (edge: any, atts: any, source: any, target: any) => {
        const neighbor = source === nodeId ? target : source;
        if (newCommunityMap[neighbor] === comm) {
          k_i_in += (atts.weight || 1);
        }
      });

      const deltaQ = totalWeight > 0 ? modularityMetric.undirectedDelta(totalWeight, communityDegree, nodeDegree, k_i_in * 2) : 0;
          
      return {
        id: nodeId,
        community: comm,
        k_i_in,
        nodeDegree,
        communityDegree,
        deltaQ
      };
    }
  });

  metrics.sort((a: any, b: any) => parseFloat(b.deltaQ) - parseFloat(a.deltaQ));
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
