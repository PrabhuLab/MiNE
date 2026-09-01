import { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { computeActiveNetwork } from '@/lib/workspaceUtils';

export function useGraphFilters() {
  const { rawNodes, rawEdges, filters, setFilter } = useStore();
  
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [network, setNetwork] = useState(() => computeActiveNetwork(rawNodes, rawEdges, filters));
  
  useEffect(() => {
    if (filters.liveUpdate) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAppliedFilters(filters);
    }
  }, [filters]);

  const removedNodesStr = appliedFilters.removedNodes || '';
  const edgeFilterStr = JSON.stringify(appliedFilters.edgeFilter);

  useEffect(() => {
    const computed = computeActiveNetwork(rawNodes, rawEdges, appliedFilters);
    
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNetwork(prev => {
      const nodesEqual = computed.validNodes.length === prev.validNodes.length &&
        computed.validNodes.every((n, i) => n.id === prev.validNodes[i]?.id);
        
      const edgesEqual = computed.validEdges.length === prev.validEdges.length &&
        computed.validEdges.every((e, i) => 
          e.source === prev.validEdges[i]?.source && 
          e.target === prev.validEdges[i]?.target && 
          e.weight_raw === prev.validEdges[i]?.weight_raw && 
          e.weight_secondary === prev.validEdges[i]?.weight_secondary
        );

      if (nodesEqual && edgesEqual) {
        return prev;
      }
      return computed;
    });
  }, [rawNodes, rawEdges, removedNodesStr, edgeFilterStr, appliedFilters]);

  // Sync missing variables fallback logic (the one with useEffect)
  const hasType = rawNodes.some(n => n.type !== undefined);
  const hasSecondaryWeight = rawEdges.some(e => e.weight_secondary !== undefined);

  useEffect(() => {
    if (!hasType && filters.nodeColorBase === 'type') setFilter('nodeColorBase', 'community');
    if (filters.nodeSizeBase === 'abundance') setFilter('nodeSizeBase', 'degree');
    if (!hasSecondaryWeight && filters.edgeColorBase === 'weight_secondary') setFilter('edgeColorBase', 'uniform');
    if (!hasSecondaryWeight && filters.edgeWeightBase === 'weight_secondary') setFilter('edgeWeightBase', 'weight_raw');
    if (!hasSecondaryWeight && filters.edgeFilter?.attribute === 'weight_secondary') setFilter('edgeFilter', null);
  }, [hasType, hasSecondaryWeight, filters.nodeColorBase, filters.nodeSizeBase, filters.edgeColorBase, filters.edgeWeightBase, filters.edgeFilter, setFilter]);

  return {
    rawNodes,
    rawEdges,
    filters,
    setFilter,
    appliedFilters,
    setAppliedFilters,
    validNodes: network.validNodes,
    validEdges: network.validEdges,
  };
}
