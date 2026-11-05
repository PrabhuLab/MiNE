import { useState, useEffect, useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { computeActiveNetwork } from '@/lib/workspaceUtils';
import { graphSettings } from '@/services/graphStyles/liveUpdate';

export function useGraphFilters() {
  const { rawNodes, rawEdges, filters, setFilter } = useStore();
  
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const liveFilters = graphSettings(filters, appliedFilters);
  const [frame, setFrame] = useState({ rawNodes, rawEdges, filters: liveFilters });
  const frameFilters = frame.rawNodes === rawNodes && frame.rawEdges === rawEdges ? frame.filters : liveFilters;
  const activeFilters = filters.liveUpdate ? { ...liveFilters,
    nodeFilter: frameFilters.nodeFilter, edgeFilter: frameFilters.edgeFilter,
    communityFilter: frameFilters.communityFilter, removedNodes: frameFilters.removedNodes,
  } : appliedFilters;

  useEffect(() => {
    const request = requestAnimationFrame(() => setFrame({ rawNodes, rawEdges, filters: liveFilters }));
    return () => cancelAnimationFrame(request);
  }, [liveFilters, rawNodes, rawEdges]);
  
  useEffect(() => {
    if (filters.liveUpdate) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAppliedFilters(filters);
    }
  }, [filters]);

  const removedNodesStr = activeFilters.removedNodes || '';
  const edgeFilter = activeFilters.edgeFilter;
  const candidate = useMemo(() => computeActiveNetwork(rawNodes, rawEdges, {
    removedNodes: removedNodesStr, edgeFilter,
  }), [rawNodes, rawEdges, removedNodesStr, edgeFilter]);
  const [retained, setRetained] = useState({ candidate, network: candidate });
  let network = retained.network;
  if (retained.candidate !== candidate) {
    // Preserve analysis inputs when a new cutoff retains exactly the same records.
    network = candidate.validNodes.length === network.validNodes.length
      && candidate.validEdges.length === network.validEdges.length
      && candidate.validNodes.every((node, index) => node === network.validNodes[index])
      && candidate.validEdges.every((edge, index) => edge === network.validEdges[index]) ? network : candidate;
    setRetained({ candidate, network });
  }

  // Sync missing variables fallback logic (the one with useEffect)
  const hasType = useMemo(() => rawNodes.some(n => n.type !== undefined), [rawNodes]);
  const hasSecondaryWeight = useMemo(() => rawEdges.some(e => e.weight_secondary !== undefined), [rawEdges]);

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
    appliedFilters: activeFilters,
    setAppliedFilters,
    validNodes: network.validNodes,
    validEdges: network.validEdges,
  };
}
