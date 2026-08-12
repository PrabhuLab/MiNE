import { useState, useMemo } from 'react';
import { computeTableDataNodes, computeTableDataEdges } from '@/lib/workspaceUtils';
import { useStore } from '@/store/useStore';
import { isSecondaryNode } from '@/services/graphPresentation/visibility';

export function useDataTableSort(validNodes: any[], validEdges: any[], networkMetrics: any[], nodeMetrics: any[]) {
  const { communityMap, searchQuery, setSearchQuery, hiddenLegendItems, isolatedLegendItem, bipartite, selectedElement, filters } = useStore();
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: "asc" | "desc" } | null>(null);

  const netMap = useMemo(() => new Map((networkMetrics || []).map((m: any) => [m.id, m])), [networkMetrics]);

  const filteredNodes = useMemo(() => {
    let nodes = validNodes;
    const hiddenSet = new Set(hiddenLegendItems);
    
    // Filter by legend states
    nodes = nodes.filter(d => {
      const isBipartiteNode = isSecondaryNode(d, bipartite);
      if (isBipartiteNode && hiddenSet.has('element:bipartite')) return false;
      if (!isBipartiteNode && hiddenSet.has('element:standard')) return false;
      
      const net = netMap.get(d.id);
      let comm: any;
      if (filters.nodeColorBase === 'louvain') {
        comm = net?.louvain;
      } else {
        comm = communityMap[d.id] ?? d.community ?? net?.louvain;
      }

      if (comm !== undefined && comm !== null && hiddenSet.has(`community:${comm}`)) return false;
      if (d.type && hiddenSet.has(`type:${d.type}`)) return false;
      
      if (isolatedLegendItem) {
        if (isolatedLegendItem === 'element:bipartite' && !isBipartiteNode) return false;
        if (isolatedLegendItem === 'element:standard' && isBipartiteNode) return false;
        if (isolatedLegendItem.startsWith('community:')) {
          const targetComm = isolatedLegendItem.replace('community:', '');
          if (String(comm) !== targetComm) return false;
        }
        if (isolatedLegendItem.startsWith('type:') && `type:${d.type}` !== isolatedLegendItem) return false;
      }
      return true;
    });
    
    return nodes;
  }, [validNodes, hiddenLegendItems, isolatedLegendItem, bipartite, communityMap, filters.nodeColorBase, netMap]);
  
  const filteredEdges = useMemo(() => {
    let edges = validEdges;
    const hiddenSet = new Set(hiddenLegendItems);
    
    if (hiddenSet.has('element:edges')) return [];
    if (isolatedLegendItem && isolatedLegendItem !== 'element:edges' && !isolatedLegendItem.startsWith('community:') && !isolatedLegendItem.startsWith('type:') && !isolatedLegendItem.startsWith('element:')) {
       // if isolatedLegendItem is not something that applies to edges directly, well we just filter by the valid nodes
    }
    
    // The easiest way is to only show edges where both source and target are in filteredNodes
    const validNodeIds = new Set(filteredNodes.map(n => n.id));
    edges = edges.filter(e => validNodeIds.has(e.source) && validNodeIds.has(e.target));
    
    return edges;
  }, [validEdges, hiddenLegendItems, isolatedLegendItem, filteredNodes]);

  const tableData = useMemo(() => {
    return computeTableDataNodes(filteredNodes, networkMetrics, nodeMetrics, communityMap, searchQuery, sortConfig);
  }, [filteredNodes, networkMetrics, nodeMetrics, communityMap, sortConfig, searchQuery]);

  const tableDataEdges = useMemo(() => {
    return computeTableDataEdges(filteredEdges, searchQuery, sortConfig);
  }, [filteredEdges, sortConfig, searchQuery]);

  return {
    searchQuery,
    setSearchQuery,
    sortConfig,
    setSortConfig,
    tableData,
    tableDataEdges,
  };
}
