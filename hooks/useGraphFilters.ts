import { useState, useEffect, useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { computeActiveNetwork } from '@/lib/workspaceUtils';

export function useGraphFilters() {
  const { rawNodes, rawEdges, filters, setFilter } = useStore();
  
  const [appliedFilters, setAppliedFilters] = useState(filters);
  
  useEffect(() => {
    if (filters.liveUpdate) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAppliedFilters(filters);
    }
  }, [filters, filters.liveUpdate]);

  const removedNodesStr = appliedFilters.removedNodes || '';
  const weightFiltersStr = JSON.stringify(appliedFilters.weightFilters || []);

  const { validNodes, validEdges } = useMemo(() => {
    return computeActiveNetwork(rawNodes, rawEdges, appliedFilters);
  }, [rawNodes, rawEdges, removedNodesStr, weightFiltersStr]);

  // Sync missing variables fallback logic (the one with useEffect)
  const hasType = rawNodes.some(n => n.type !== undefined);
  const hasAbundance = rawNodes.some(n => n.abundance !== undefined);
  const hasSecondaryWeight = rawEdges.some(e => e.weight_secondary !== undefined);

  useEffect(() => {
    if (!hasType && filters.nodeColorBase === 'type') setFilter('nodeColorBase', 'community');
    if (!hasAbundance && filters.nodeSizeBase === 'abundance') setFilter('nodeSizeBase', 'degree');
    if (!hasSecondaryWeight && filters.edgeColorBase === 'weight_secondary') setFilter('edgeColorBase', 'uniform');
    if (!hasSecondaryWeight && filters.edgeWeightBase === 'weight_secondary') setFilter('edgeWeightBase', 'weight_raw');
    if (!hasSecondaryWeight && filters.edgeOpacityBase === 'weight_secondary') setFilter('edgeOpacityBase', 'uniform');
  }, [hasType, hasAbundance, hasSecondaryWeight, filters.nodeColorBase, filters.nodeSizeBase, filters.edgeColorBase, filters.edgeWeightBase, filters.edgeOpacityBase, setFilter]);

  return {
    rawNodes,
    rawEdges,
    filters,
    setFilter,
    appliedFilters,
    setAppliedFilters,
    validNodes,
    validEdges,
    hasType,
    hasAbundance,
    hasSecondaryWeight
  };
}
