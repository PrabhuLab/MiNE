import Graph from 'graphology';

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

  const filteredEdges = rawEdges.filter(e => {
    const passesWeightFilters = (appliedFilters.weightFilters || []).every((filter: any) => {
      const val = e[filter.type];
      if (val === undefined || val === null) return true;
      return val >= filter.cutoff;
    });

    return passesWeightFilters &&
      !removedSet.has(e.source) &&
      !removedSet.has(e.target);
  });

  const nodesWithEdges = new Set<string>();
  filteredEdges.forEach(e => {
    nodesWithEdges.add(e.source);
    nodesWithEdges.add(e.target);
  });

  const filteredNodes = rawNodes.filter(n => 
    nodesWithEdges.has(n.id) && !removedSet.has(n.id)
  );

  const validNodeIds = new Set(filteredNodes.map(n => n.id));
  const strictlyValidEdges = filteredEdges.filter(e => validNodeIds.has(e.source) && validNodeIds.has(e.target));

  return { validNodes: filteredNodes, validEdges: strictlyValidEdges };
}

export function computeCommunityMetrics(graph: Graph, newCommunityMap: Record<string, any>, directed: boolean) {
  let sumWeights = 0;
  graph.forEachEdge((e, atts) => { sumWeights += (atts.weight || 1); });
      
  const metrics = graph.nodes().map(nodeId => {
    const comm = newCommunityMap[nodeId] || "";
        
    if (directed) {
      const totalWeight = sumWeights;
      let nodeInDegree = 0;
      let nodeOutDegree = 0;
          
      graph.forEachInEdge(nodeId, (e, atts) => { nodeInDegree += (atts.weight || 1); });
      graph.forEachOutEdge(nodeId, (e, atts) => { nodeOutDegree += (atts.weight || 1); });

      let commInDegree = 0;
      let commOutDegree = 0;
      graph.forEachNode(n => {
        if (newCommunityMap[n] === comm) {
          graph.forEachInEdge(n, (e, atts) => { commInDegree += (atts.weight || 1); });
          graph.forEachOutEdge(n, (e, atts) => { commOutDegree += (atts.weight || 1); });
        }
      });

      let k_in_from_comm = 0;
      let k_out_to_comm = 0;
      graph.forEachInEdge(nodeId, (e, atts, source) => {
        if (newCommunityMap[source] === comm) k_in_from_comm += (atts.weight || 1);
      });
      graph.forEachOutEdge(nodeId, (e, atts, source, target) => {
        if (newCommunityMap[target] === comm) k_out_to_comm += (atts.weight || 1);
      });
          
      const deltaQ = totalWeight > 0 ? 
        ((k_in_from_comm + k_out_to_comm) / totalWeight) - 
        ((nodeOutDegree * commInDegree + nodeInDegree * commOutDegree) / Math.pow(totalWeight, 2)) : 0;
            
      return {
        id: nodeId,
        community: comm,
        k_i_in: (k_in_from_comm + k_out_to_comm).toFixed(4),
        nodeDegree: `↓${nodeInDegree.toFixed(2)} ↑${nodeOutDegree.toFixed(2)}`,
        communityDegree: `↓${commInDegree.toFixed(2)} ↑${commOutDegree.toFixed(2)}`,
        deltaQ: deltaQ.toFixed(6)
      };
    } else {
      const totalWeight2m = sumWeights * 2;
      let nodeDegree = 0;
      graph.forEachEdge(nodeId, (e, atts) => { nodeDegree += (atts.weight || 1); });
          
      let communityDegree = 0;
      graph.forEachNode(n => {
        if (newCommunityMap[n] === comm) {
          graph.forEachEdge(n, (e, atts) => { communityDegree += (atts.weight || 1); });
        }
      });

      let k_i_in = 0;
      graph.forEachEdge(nodeId, (edge, atts, source, target) => {
        const neighbor = source === nodeId ? target : source;
        if (newCommunityMap[neighbor] === comm) {
          k_i_in += (atts.weight || 1);
        }
      });

      const deltaQ = totalWeight2m > 0 ? (k_i_in / totalWeight2m) - ((nodeDegree * communityDegree) / Math.pow(totalWeight2m, 2)) : 0;
          
      return {
        id: nodeId,
        community: comm,
        k_i_in: k_i_in.toFixed(4),
        nodeDegree: nodeDegree.toFixed(4),
        communityDegree: communityDegree.toFixed(4),
        deltaQ: deltaQ.toFixed(6)
      };
    }
  });

  metrics.sort((a,b) => parseFloat(b.deltaQ) - parseFloat(a.deltaQ));
  return metrics;
}

export function computeTableDataNodes(validNodes: any[], networkMetrics: any[], nodeMetrics: any[], communityMap: Record<string, any>, searchQuery: string, sortConfig: { key: string, direction: "asc" | "desc" } | null) {
  const netMap = new Map((networkMetrics || []).map((m: any) => [m.id, m]));
  const modMap = new Map((nodeMetrics || []).map((m: any) => [m.id, m]));

  let data = validNodes.map(node => {
    const net = netMap.get(node.id) || {};
    const mod = modMap.get(node.id) || {};
    const comm = mod.community || net.louvain || communityMap[node.id] || node.community || "";
    return { ...node, net, mod, comm };
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
      let aVal: any = a.id;
      let bVal: any = b.id;

      if (sortConfig.key === "id") {
        aVal = a.id; bVal = b.id;
      } else if (sortConfig.key === "label") {
        aVal = a.label || a.name || ""; bVal = b.label || b.name || "";
      } else if (sortConfig.key === "abundance") {
        aVal = a.abundance || 0; bVal = b.abundance || 0;
      } else if (sortConfig.key === "degree") {
        aVal = a.net.degree ?? (parseFloat(a.net.degreeCentrality) || 0); bVal = b.net.degree ?? (parseFloat(b.net.degreeCentrality) || 0);
      } else if (sortConfig.key === "inDegree") {
        aVal = a.net.inDegree ?? (parseFloat(a.net.inDegreeCentrality) || 0); bVal = b.net.inDegree ?? (parseFloat(b.net.inDegreeCentrality) || 0);
      } else if (sortConfig.key === "outDegree") {
        aVal = a.net.outDegree ?? (parseFloat(a.net.outDegreeCentrality) || 0); bVal = b.net.outDegree ?? (parseFloat(b.net.outDegreeCentrality) || 0);
      } else if (sortConfig.key === "inDegreeCentrality") {
        aVal = parseFloat(a.net.inDegreeCentrality) || 0; bVal = parseFloat(b.net.inDegreeCentrality) || 0;
      } else if (sortConfig.key === "outDegreeCentrality") {
        aVal = parseFloat(a.net.outDegreeCentrality) || 0; bVal = parseFloat(b.net.outDegreeCentrality) || 0;
      } else if (sortConfig.key === "degreeCentrality") {
        aVal = parseFloat(a.net.degreeCentrality) || 0; bVal = parseFloat(b.net.degreeCentrality) || 0;
      } else if (sortConfig.key === "eigenvector") {
        aVal = parseFloat(a.net.eigenvector) || 0; bVal = parseFloat(b.net.eigenvector) || 0;
      } else if (sortConfig.key === "pagerank") {
        aVal = parseFloat(a.net.pagerank) || 0; bVal = parseFloat(b.net.pagerank) || 0;
      } else if (sortConfig.key === "betweenness") {
        aVal = parseFloat(a.net.betweenness) || 0; bVal = parseFloat(b.net.betweenness) || 0;
      } else if (sortConfig.key === "closeness") {
        aVal = parseFloat(a.net.closeness) || 0; bVal = parseFloat(b.net.closeness) || 0;
      } else if (sortConfig.key === "clustering") {
        aVal = parseFloat(a.net.clustering ?? a.net.bipartiteClustering) || 0; bVal = parseFloat(b.net.clustering ?? b.net.bipartiteClustering) || 0;
      } else if (sortConfig.key === "bipartitePartition") {
        aVal = a.net.bipartitePartition || ""; bVal = b.net.bipartitePartition || "";
      } else if (sortConfig.key === "bipartiteNormDegree") {
        aVal = parseFloat(a.net.bipartiteNormDegree) || 0; bVal = parseFloat(b.net.bipartiteNormDegree) || 0;
      } else if (sortConfig.key === "bipartiteClustering") {
        aVal = parseFloat(a.net.bipartiteClustering) || 0; bVal = parseFloat(b.net.bipartiteClustering) || 0;
      } else if (sortConfig.key === "bipartiteRedundancy") {
        aVal = parseFloat(a.net.bipartiteRedundancy) || 0; bVal = parseFloat(b.net.bipartiteRedundancy) || 0;
      } else if (sortConfig.key === "bipartiteProjectionDegree") {
        aVal = a.net.bipartiteProjectionDegree || 0; bVal = b.net.bipartiteProjectionDegree || 0;
      } else if (sortConfig.key === "community") {
        aVal = a.comm; bVal = b.comm;
      } else if (sortConfig.key === "louvain") {
        aVal = a.net.louvain || ""; bVal = b.net.louvain || "";
      } else if (sortConfig.key === "deltaQ") {
        aVal = parseFloat(a.mod.deltaQ) || 0; bVal = parseFloat(b.mod.deltaQ) || 0;
      }

      if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }

  return data;
}

export function computeTableDataEdges(validEdges: any[], searchQuery: string, sortConfig: { key: string, direction: "asc" | "desc" } | null) {
  let data = validEdges;
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    data = data.filter(d => 
      String(d.source).toLowerCase().includes(q) || 
      String(d.target).toLowerCase().includes(q)
    );
  }
  
  if (sortConfig) {
    data = [...data].sort((a, b) => {
      let aVal: any = a.source;
      let bVal: any = b.source;

      if (sortConfig.key === "source") {
        aVal = a.source; bVal = b.source;
      } else if (sortConfig.key === "target") {
        aVal = a.target; bVal = b.target;
      } else if (sortConfig.key === "weight_raw") {
        aVal = a.weight_raw; bVal = b.weight_raw;
      } else if (sortConfig.key === "weight_secondary") {
        aVal = a.weight_secondary; bVal = b.weight_secondary;
      }

      if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }

  return data;
}
