import { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { calculateTopologyMetrics, graphologyMetricsEngine } from '@/services/metrics/graphologyEngine';

export function useGraphMetrics(validNodes: any[], validEdges: any[], appliedFilters: any, rawNodes: any[]) {
  const { directed, communityMap, setCommunityMap, setFilter, importedMetrics } = useStore();
  
  const [networkMetrics, setNetworkMetrics] = useState<any[]>([]);
  const [nodeMetrics, setNodeMetrics] = useState<any[]>([]);
  
  const [modularity, setModularity] = useState<number | null>(null);
  const [hasRanCommunities, setHasRanCommunities] = useState(false);
  
  const [metricsToRun, setMetricsToRun] = useState({
    louvain: false,
    degree: false,
    betweenness: false,
    closeness: false,
    clustering: false,
    pagerank: false,
    eigenvector: false
  });
  const [metricsLoading, setMetricsLoading] = useState(false);

  useEffect(() => {
    if (importedMetrics) {
      const restoredNodes: any[] = Object.entries(importedMetrics.nodes || {}).map(([id, metrics]) => ({ id, ...(metrics as Record<string, any>) }));
      setNetworkMetrics(restoredNodes);
      const restoredHasLouvain = restoredNodes.some((entry) => entry.louvain !== undefined);
      setNodeMetrics(restoredHasLouvain ? restoredNodes.filter((entry) => entry.deltaQ !== undefined) : []);
      const restoredModularity = Number(importedMetrics.graph?.modularity);
      setModularity(restoredHasLouvain && Number.isFinite(restoredModularity) ? restoredModularity : null);
      setHasRanCommunities(restoredHasLouvain);
      if (importedMetrics.metadata?.selectedMetrics) {
        setMetricsToRun((current) => ({ ...current, ...importedMetrics.metadata.selectedMetrics }));
      }
      return;
    }
    setNetworkMetrics([]);
    setNodeMetrics([]);
    setModularity(null);
    setHasRanCommunities(false);
    setMetricsToRun({
      louvain: false,
      degree: false,
      betweenness: false,
      closeness: false,
      clustering: false,
      pagerank: false,
      eigenvector: false
    });
    setFilter('nodeColorBase', 'custom');
    setFilter('nodeSizeBase', 'abundance');
    setFilter('edgeColorBase', 'uniform');
    setFilter('edgeColorNodeMetric', 'custom');
  }, [rawNodes, importedMetrics, setFilter]);

  // Compute Communities and Metrics
  useEffect(() => {
    if (validNodes.length === 0) return;

    try {
      const topology = calculateTopologyMetrics(validNodes, validEdges, directed);
      setCommunityMap(topology.declaredCommunities);

      setNetworkMetrics(prev => {
        const currentMap = new Map(prev.map((m: any) => [m.id, m]));
        return topology.nodeIds.map((nodeId: string) => {
          const old = currentMap.get(nodeId) || {};
          const next = { ...old, id: nodeId };
          if (directed) {
            delete next.degree;
            next.inDegree = topology.degreeByNode[nodeId].inDegree;
            next.outDegree = topology.degreeByNode[nodeId].outDegree;
          } else {
            delete next.inDegree;
            delete next.outDegree;
            next.degree = topology.degreeByNode[nodeId].degree;
          }
          return next;
        });
      });
    } catch (err) {
      console.warn("Community calculation skipped/failed:", err);
    }
  }, [validNodes, validEdges, directed, setCommunityMap]);

  const runSelectedMetrics = () => {
    if (validNodes.length === 0 || validEdges.length === 0) return;
    setMetricsLoading(true);
    
    // We defer to let the UI update the loading state
    setTimeout(() => {
      void graphologyMetricsEngine.compute({
        nodes: validNodes,
        edges: validEdges,
        directed,
        selected: metricsToRun,
        runLouvain: metricsToRun.louvain || appliedFilters?.nodeColorBase === 'louvain',
        louvainSeed: appliedFilters?.louvainSeed || 42,
        resolution: appliedFilters?.resolution || 1.0,
      }).then((result) => {
        if (result.louvain) {
          setNodeMetrics(result.louvain.nodeMetrics);
          setModularity(result.louvain.modularity);
          setHasRanCommunities(true);
        }
        setNetworkMetrics(prev => {
          const currentMap = new Map(prev.map((m: any) => [m.id, m]));
          return result.nodeIds.map((nodeId: string) => {
            const old = currentMap.get(nodeId) || { id: nodeId };
            return {
              ...old,
              ...result.metricsByNode[nodeId]
            };
          });
        });
        setHasRanCommunities(true);
      }).catch((err) => {
        console.error('Failed to run metrics:', err);
      }).finally(() => {
        setMetricsLoading(false);
      });
    }, 100);
  };

  // Auto recalculate active metrics or Louvain when validNodes, validEdges, or filter parameters change (ONLY if communities/metrics have been initially run and liveUpdate is enabled)
  useEffect(() => {
    if (!appliedFilters?.liveUpdate) return;
    const isLouvainActive = metricsToRun.louvain || appliedFilters?.nodeColorBase === 'louvain';
    const hasAnyMetricActive = Object.values(metricsToRun).some(Boolean) || isLouvainActive;

    if (hasRanCommunities && hasAnyMetricActive && validNodes.length > 0 && validEdges.length > 0) {
      const timer = setTimeout(() => {
        runSelectedMetrics();
      }, 0);
      return () => clearTimeout(timer);
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [validNodes, validEdges, appliedFilters?.resolution, appliedFilters?.louvainSeed, appliedFilters?.liveUpdate, hasRanCommunities]);

  return {
    networkMetrics,
    nodeMetrics,
    modularity,
    metricsToRun,
    setMetricsToRun,
    metricsLoading,
    runSelectedMetrics,
  };
}
