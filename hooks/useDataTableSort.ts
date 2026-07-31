import { useState, useMemo } from 'react';
import { computeTableDataNodes, computeTableDataEdges } from '@/lib/workspaceUtils';
import { useStore } from '@/store/useStore';

export function useDataTableSort(validNodes: any[], validEdges: any[], networkMetrics: any[], nodeMetrics: any[]) {
  const { communityMap, searchQuery, setSearchQuery, hiddenLegendItems, isolatedLegendItem, bipartite, selectedElement, filters } = useStore();
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: "asc" | "desc" } | null>(null);

  const netMap = useMemo(() => new Map((networkMetrics || []).map((m: any) => [m.id, m])), [networkMetrics]);

  const filteredNodes = useMemo(() => {
    let nodes = validNodes;
    const hiddenSet = new Set(hiddenLegendItems);
    
    // Filter by legend states
    nodes = nodes.filter(d => {
      const isBipartiteNode = bipartite && (d.type === 'B' || d.group === 1);
      if (isBipartiteNode && hiddenSet.has('element:bipartite')) return false;
      if (!isBipartiteNode && hiddenSet.has('element:standard')) return false;
      
      const net = netMap.get(d.id);
      let comm: any;
      if (filters.nodeColorBase === 'louvain') {
        comm = net?.louvain;
      } else if (filters.nodeColorBase === 'leiden') {
        comm = net?.leiden;
      } else {
        comm = communityMap[d.id] ?? d.community ?? net?.louvain ?? net?.leiden;
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
    
    // Filter by selected element
    if (selectedElement) {
      if (selectedElement.includes('-')) {
        const parts = selectedElement.split('-');
        if (parts.length === 2) {
          nodes = nodes.filter(n => n.id === parts[0] || n.id === parts[1]);
        }
      } else {
        nodes = nodes.filter(n => n.id === selectedElement);
      }
    }
    
    return nodes;
  }, [validNodes, hiddenLegendItems, isolatedLegendItem, bipartite, communityMap, selectedElement, filters.nodeColorBase, netMap]);
  
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
    
    if (selectedElement) {
      if (selectedElement.includes('-')) {
        edges = edges.filter(e => `${e.source}-${e.target}` === selectedElement || `${e.target}-${e.source}` === selectedElement);
      } else {
        edges = edges.filter(e => e.source === selectedElement || e.target === selectedElement);
      }
    }
    
    return edges;
  }, [validEdges, hiddenLegendItems, isolatedLegendItem, filteredNodes, selectedElement]);

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
