/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@/store/useStore';
import { calculateTopologyMetrics, graphologyMetricsEngine } from '@/services/metrics/graphologyEngine';
import { METRIC_BY_ID, METRIC_REGISTRY } from '@/services/metrics/registry';
import type { MetricGraphContext, MetricsSelection, MetricValidity } from '@/services/metrics/types';

interface GraphMetricAccessors {
  getPositionedNodes?: () => any[];
  getLayoutRevision?: () => number;
}

function revisionOf(nodes: any[], edges: any[], includeWeights = false): string {
  let hash = 2166136261;
  const add = (value: unknown) => {
    const text = String(value);
    for (let index = 0; index < text.length; index++) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
  };
  nodes.forEach((node) => add(node.id));
  edges.forEach((edge) => {
    add(edge.source);
    add(edge.target);
    if (includeWeights) {
      add(edge.weight_raw);
      add(edge.weight_secondary);
    }
  });
  return `${nodes.length}:${edges.length}:${(hash >>> 0).toString(36)}`;
}

const EMPTY_SELECTION: MetricsSelection = Object.fromEntries([
  ['louvain', false],
  ...METRIC_REGISTRY.map((metric) => [metric.id, false]),
]) as MetricsSelection;

const LOUVAIN_RESULT_ATTRIBUTES = new Set(['louvain', 'community', 'deltaQ', 'k_i_in', 'nodeDegree', 'communityDegree']);

function pickAttributes(values: Record<string, any>, allowed: Set<string>): Record<string, any> {
  return Object.fromEntries(Object.entries(values).filter(([key]) => allowed.has(key)));
}

export function useGraphMetrics(
  validNodes: any[],
  validEdges: any[],
  appliedFilters: any,
  rawNodes: any[],
  accessors: GraphMetricAccessors = {},
) {
  const { directed, bipartite, setCommunityMap, setFilter, importedMetrics, filters } = useStore();
  const [networkMetrics, setNetworkMetrics] = useState<any[]>([]);
  const [nodeMetrics, setNodeMetrics] = useState<any[]>([]);
  const [edgeMetrics, setEdgeMetrics] = useState<any[]>([]);
  const [graphMetrics, setGraphMetrics] = useState<Record<string, any>>({});
  const [metricValidity, setMetricValidity] = useState<Record<string, MetricValidity>>({});
  const [metricWarnings, setMetricWarnings] = useState<Record<string, string>>({});
  const [metricsToRun, setMetricsToRun] = useState<MetricsSelection>({ ...EMPTY_SELECTION });
  const [metricsLoading, setMetricsLoading] = useState(false);
  const importedForRevision = useRef<string | null>(null);

  const graphRevision = useMemo(() => revisionOf(rawNodes, useStore.getState().rawEdges, true), [rawNodes]);
  const filterRevision = useMemo(() => revisionOf(validNodes, validEdges, true), [validNodes, validEdges]);
  const communityAttribute = filters.communityAttribute || '';
  const topologyNodes = useMemo(() => communityAttribute
    ? validNodes.map((node) => ({ ...node, community: node[communityAttribute] }))
    : validNodes.map((node) => {
      const { community: _community, ...withoutCommunity } = node;
      return withoutCommunity;
    }), [communityAttribute, validNodes]);
  const topology = useMemo(() => topologyNodes.length ? calculateTopologyMetrics(topologyNodes, validEdges, directed) : null, [topologyNodes, validEdges, directed]);

  const metricContext = useMemo<MetricGraphContext>(() => {
    const weightAttribute = appliedFilters?.metricWeightAttribute || 'weight_raw';
    const weights = validEdges.map((edge) => Number(edge[weightAttribute])).filter(Number.isFinite);
    return {
      directed,
      weighted: weights.some((weight) => weight !== 1),
      bipartite,
      multi: false,
      hasEdges: validEdges.length > 0,
      hasPositiveWeights: weights.length > 0 && weights.every((weight) => weight > 0),
      hasCommunities: Boolean(communityAttribute) || networkMetrics.some((node) => node.louvain !== undefined),
      // The shared graph guarantees finite canonical x/y before controls become actionable.
      hasPositions: validNodes.length > 0,
    };
  }, [appliedFilters?.metricWeightAttribute, bipartite, communityAttribute, directed, networkMetrics, validEdges, validNodes]);

  useEffect(() => {
    if (!topology) {
      setNetworkMetrics([]);
      setNodeMetrics([]);
      setEdgeMetrics([]);
      setGraphMetrics({});
      setMetricValidity({});
      return;
    }
    setCommunityMap(topology.declaredCommunities);
    setNetworkMetrics(topology.nodeIds.map((nodeId) => ({ id: nodeId, ...topology.degreeByNode[nodeId] })));
    setNodeMetrics([]);
    setEdgeMetrics([]);
    setGraphMetrics({});
    setMetricValidity({});
    setMetricWarnings({});
  }, [filterRevision, setCommunityMap, topology]);

  useEffect(() => {
    if (!importedMetrics || !topology) return;
    const importedValidity = (importedMetrics.metadata?.validity || {}) as Record<string, MetricValidity>;
    const tracksValidity = Object.keys(importedValidity).length > 0;
    const importRevisionKey = tracksValidity ? `${graphRevision}:${filterRevision}` : graphRevision;
    // Validity-aware imports are safe to restore again. This also matters in
    // React Strict Mode, where the topology reset effect runs twice in dev.
    // Legacy imports lack revision metadata, so retain the one-time guard.
    if (!tracksValidity && importedForRevision.current === importRevisionKey) return;
    if (importedMetrics.metadata?.selectedMetrics) setMetricsToRun((current) => ({ ...current, ...importedMetrics.metadata.selectedMetrics }));

    const validMetricIds = new Set(Object.entries(importedValidity)
      .filter(([, validity]) => validity?.graphRevision === graphRevision && validity?.filterRevision === filterRevision)
      .map(([id]) => id));
    const allowedNodeAttributes = new Set<string>();
    const allowedEdgeAttributes = new Set<string>();
    validMetricIds.forEach((id) => {
      if (id === 'louvain') LOUVAIN_RESULT_ATTRIBUTES.forEach((attribute) => allowedNodeAttributes.add(attribute));
      const definition = METRIC_BY_ID.get(id);
      if (definition?.scope === 'node') definition.resultAttributes.forEach((attribute) => allowedNodeAttributes.add(attribute));
      if (definition?.scope === 'edge') definition.resultAttributes.forEach((attribute) => allowedEdgeAttributes.add(attribute));
    });
    const restoredNodes: any[] = topology.nodeIds.map((id) => ({
      id,
      ...topology.degreeByNode[id],
      ...(tracksValidity ? pickAttributes(importedMetrics.nodes?.[id] || {}, allowedNodeAttributes) : (importedMetrics.nodes?.[id] || {})),
    }));
    const restoredLouvain = restoredNodes.filter((entry) => entry.deltaQ !== undefined);
    setNetworkMetrics(restoredNodes);
    setNodeMetrics(restoredLouvain);
    setEdgeMetrics(Object.entries(importedMetrics.edges || {}).map(([key, values]) => ({ key, ...(tracksValidity ? pickAttributes(values, allowedEdgeAttributes) : values) })));
    const importedGraphMetrics = { ...(importedMetrics.graph || {}) };
    // Older exports stored Louvain's Q under `modularity`. Preserve it as the
    // explicitly named Louvain result when validity metadata makes that clear.
    if (validMetricIds.has('louvain') && !validMetricIds.has('modularity') && importedGraphMetrics.louvainModularity === undefined && importedGraphMetrics.modularity !== undefined) {
      importedGraphMetrics.louvainModularity = importedGraphMetrics.modularity;
      delete importedGraphMetrics.modularity;
    }
    setGraphMetrics(tracksValidity
      ? Object.fromEntries(Object.entries(importedGraphMetrics).filter(([id]) => validMetricIds.has(id) || (id === 'louvainModularity' && validMetricIds.has('louvain'))))
      : importedGraphMetrics);
    setMetricValidity(tracksValidity ? Object.fromEntries(Object.entries(importedValidity).filter(([id]) => validMetricIds.has(id))) : {});
    if (!tracksValidity) importedForRevision.current = importRevisionKey;
  }, [filterRevision, graphRevision, importedMetrics, topology]);

  useEffect(() => {
    if (rawNodes.length) return;
    setMetricsToRun({ ...EMPTY_SELECTION });
    setFilter('nodeColorBase', 'louvain');
    setFilter('nodeSizeBase', 'abundance');
    setFilter('edgeColorBase', 'nodeMetric');
    setFilter('edgeColorNodeMetric', 'louvain');
    setFilter('edgeColorNodeTarget', 'source');
  }, [rawNodes.length, setFilter]);

  const runSelectedMetrics = useCallback((onlyMetricIds?: string[]) => {
    if (!validNodes.length) return;
    const requested = onlyMetricIds || Object.entries(metricsToRun).filter(([id, selected]) => id !== 'louvain' && selected).map(([id]) => id);
    const runLouvain = onlyMetricIds?.includes('louvain') || (!onlyMetricIds && (metricsToRun.louvain || appliedFilters?.nodeColorBase === 'louvain' || appliedFilters?.edgeColorNodeMetric === 'louvain'));
    const positionedNodes = accessors.getPositionedNodes?.() || validNodes;
    setMetricsLoading(true);
    setTimeout(() => {
      void graphologyMetricsEngine.compute({
        nodes: positionedNodes,
        edges: validEdges,
        directed,
        bipartite,
        selected: metricsToRun,
        metricIds: requested.filter((id) => id !== 'louvain'),
        runLouvain,
        louvainSeed: appliedFilters?.louvainSeed || 42,
        resolution: appliedFilters?.resolution || 1,
        weightAttribute: appliedFilters?.metricWeightAttribute || 'weight_raw',
        graphRevision,
        filterRevision,
        layoutRevision: accessors.getLayoutRevision?.(),
      }).then((result) => {
        setNetworkMetrics((current) => {
          const currentById = new Map(current.map((entry) => [String(entry.id), entry]));
          return result.nodeIds.map((id) => ({ ...(currentById.get(id) || { id }), ...result.metricsByNode[id] }));
        });
        if (result.louvain) {
          setNodeMetrics(result.louvain.nodeMetrics);
          const nextCommunities = Object.fromEntries(result.louvain.nodeMetrics.map((entry: any) => [String(entry.id), String(entry.community)]));
          setCommunityMap(nextCommunities);
        }
        setEdgeMetrics((current) => {
          const byKey = new Map(current.map((entry) => [String(entry.key), entry]));
          Object.entries(result.metricsByEdge).forEach(([key, values]) => byKey.set(key, { ...(byKey.get(key) || { key }), ...values }));
          return Array.from(byKey.values());
        });
        setGraphMetrics((current) => ({ ...current, ...result.graphMetrics }));
        setMetricValidity((current) => ({ ...current, ...result.validity }));
        setMetricWarnings(result.warnings);
      }).catch((error) => {
        console.error('Failed to run metrics:', error);
      }).finally(() => setMetricsLoading(false));
    }, 50);
  }, [accessors, appliedFilters?.edgeColorNodeMetric, appliedFilters?.louvainSeed, appliedFilters?.metricWeightAttribute, appliedFilters?.nodeColorBase, appliedFilters?.resolution, bipartite, directed, filterRevision, graphRevision, metricsToRun, setCommunityMap, validEdges, validNodes]);

  useEffect(() => {
    if (!validNodes.length || !validEdges.length) return;
    const shouldAutoRunLouvain =
      appliedFilters?.nodeColorBase === 'louvain' ||
      appliedFilters?.edgeColorNodeMetric === 'louvain' ||
      metricsToRun.louvain;
    const hasLouvainData = networkMetrics.some((node) => node.louvain !== undefined);
    if (shouldAutoRunLouvain && !hasLouvainData && !metricsLoading) {
      const timer = setTimeout(() => {
        runSelectedMetrics(['louvain']);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [appliedFilters?.edgeColorNodeMetric, appliedFilters?.nodeColorBase, metricsLoading, metricsToRun.louvain, networkMetrics, runSelectedMetrics, validEdges.length, validNodes.length]);

  useEffect(() => {
    if (!validNodes.length || communityAttribute) return;
    const timer = setTimeout(() => runSelectedMetrics(['louvain']), 0);
    return () => clearTimeout(timer);
  }, [communityAttribute, filterRevision, runSelectedMetrics, validNodes.length]);

  useEffect(() => {
    const cheapSelected = Object.entries(metricsToRun)
      .filter(([id, selected]) => selected && METRIC_BY_ID.get(id)?.cost === 'cheap' && METRIC_BY_ID.get(id)?.scope !== 'layout')
      .map(([id]) => id);
    if (!cheapSelected.length || !validNodes.length) return;
    const timer = setTimeout(() => runSelectedMetrics(cheapSelected), 180);
    return () => clearTimeout(timer);
  }, [filterRevision, metricsToRun, runSelectedMetrics, validNodes.length]);

  const modularity = Number.isFinite(Number(graphMetrics.louvainModularity)) ? Number(graphMetrics.louvainModularity) : null;
  const staleMetricIds = useMemo(() => Object.entries(metricsToRun)
    .filter(([id, selected]) => selected && id !== 'louvain' && metricValidity[id]?.filterRevision !== filterRevision)
    .map(([id]) => id), [filterRevision, metricValidity, metricsToRun]);

  const invalidateLayoutMetrics = useCallback(() => {
    const layoutIds = new Set(METRIC_REGISTRY.filter((metric) => metric.scope === 'layout').map((metric) => metric.id));
    setGraphMetrics((current) => Object.fromEntries(Object.entries(current).filter(([id]) => !layoutIds.has(id))));
    setMetricValidity((current) => Object.fromEntries(Object.entries(current).filter(([id]) => !layoutIds.has(id))));
  }, []);

  return {
    networkMetrics,
    nodeMetrics,
    edgeMetrics,
    graphMetrics,
    metricValidity,
    metricWarnings,
    metricContext,
    staleMetricIds,
    graphRevision,
    filterRevision,
    modularity,
    metricsToRun,
    setMetricsToRun,
    metricsLoading,
    runSelectedMetrics,
    invalidateLayoutMetrics,
  };
}
