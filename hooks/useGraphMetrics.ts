/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@/store/useStore';
import { calculateTopologyMetrics } from '@/services/metrics/graphologyEngine';
import { computeMetricsRouted } from '@/services/metrics/router';
import { computeGraphRevisions } from '@/services/cloud/revision';
import { METRIC_BY_ID, METRIC_REGISTRY } from '@/services/metrics/registry';
import type { MetricGraphContext, MetricsSelection, MetricValidity } from '@/services/metrics/types';
import { resolveComputeEngine } from '@/services/cloud/config';
import { computeCommunityRouted, type RoutedCommunityResult } from '@/services/communities/router';
import { communityResultStyleSelection, DEFAULT_COMMUNITY_SETTINGS, type CommunityComputationResult, type CommunitySettings } from '@/services/communities/types';
import { resultMetadata } from '@/services/attributes/registry';
import { automaticLouvainOnce, shouldRunAutomaticLouvain, validSavedLouvainKey } from '@/services/communities/automatic';
import { staleCalculationIds } from '@/services/metrics/validity';

interface GraphMetricAccessors {
  getPositionedNodes?: () => any[];
  getLayoutRevision?: () => number;
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
  const { directed, bipartite, computeEngine, rawEdges, graphGeneration, restoredVisualization, setCommunityMap, setFilter, importedMetrics, filters, customAttributes, setCustomAttributes } = useStore();
  const [networkMetrics, setNetworkMetrics] = useState<any[]>([]);
  const [nodeMetrics, setNodeMetrics] = useState<any[]>([]);
  const [edgeMetrics, setEdgeMetrics] = useState<any[]>([]);
  const [graphMetrics, setGraphMetrics] = useState<Record<string, any>>({});
  const [metricValidity, setMetricValidity] = useState<Record<string, MetricValidity>>({});
  const [metricWarnings, setMetricWarnings] = useState<Record<string, string>>({});
  const [metricsToRun, setMetricsToRun] = useState<MetricsSelection>({ ...EMPTY_SELECTION });
  const [metricsLoading, setMetricsLoading] = useState(false);
  const importedForRevision = useRef<string | null>(null);
  const activeRequestRef = useRef<AbortController | null>(null);
  const lastGraphRevisionRef = useRef<string | null>(null);
  const automaticCommitRef = useRef<string | null>(null);

  const metricWeightAttribute = appliedFilters?.metricWeightAttribute || 'weight_raw';
  const graphRevision = useMemo(() => computeGraphRevisions(rawNodes, rawEdges, directed, true, metricWeightAttribute).graphRevision, [directed, metricWeightAttribute, rawEdges, rawNodes]);
  const filterRevision = useMemo(() => computeGraphRevisions(validNodes, validEdges, directed, true, metricWeightAttribute).graphRevision, [directed, metricWeightAttribute, validNodes, validEdges]);
  const communityAttribute = filters.communityAttribute || '';
  const requestGenerationRef = useRef(0);
  const effectiveEngine = resolveComputeEngine(rawNodes.length, rawEdges.length, computeEngine);
  const topologyNodes = useMemo(() => communityAttribute
    ? validNodes.map((node) => ({ ...node, community: node[communityAttribute] }))
    : validNodes.map((node) => {
      const { community: _community, ...withoutCommunity } = node;
      return withoutCommunity;
    }), [communityAttribute, validNodes]);
  const topology = useMemo(() => topologyNodes.length ? calculateTopologyMetrics(topologyNodes, validEdges, directed) : null, [topologyNodes, validEdges, directed]);

  const metricContext = useMemo<MetricGraphContext>(() => {
    const weightAttribute = metricWeightAttribute;
    const weights = validEdges.map((edge) => Number(edge[weightAttribute])).filter(Number.isFinite);
    return {
      directed,
      weighted: weights.some((weight) => weight !== 1),
      bipartite,
      multi: false,
      hasEdges: validEdges.length > 0,
      hasPositiveWeights: weights.length > 0 && weights.every((weight) => weight > 0),
      hasCommunities: Boolean(communityAttribute)
        || networkMetrics.some((node) => node.louvain !== undefined)
        || customAttributes.some((attribute) => attribute.scope === 'node' && attribute.origin === 'community'),
      // The shared graph guarantees finite canonical x/y before controls become actionable.
      hasPositions: validNodes.length > 0,
    };
  }, [bipartite, communityAttribute, customAttributes, directed, metricWeightAttribute, networkMetrics, validEdges, validNodes]);

  useEffect(() => {
    if (!topology) {
      setNetworkMetrics([]);
      setNodeMetrics([]);
      setEdgeMetrics([]);
      setGraphMetrics({});
      setMetricValidity({});
      return;
    }
    const graphChanged = lastGraphRevisionRef.current !== null && lastGraphRevisionRef.current !== graphRevision;
    lastGraphRevisionRef.current = graphRevision;
    setCommunityMap(topology.declaredCommunities);
    setNetworkMetrics((current) => {
      const previous = graphChanged ? new Map() : new Map(current.map((entry) => [String(entry.id), entry]));
      return topology.nodeIds.map((nodeId) => ({ ...(previous.get(nodeId) || {}), id: nodeId, ...topology.degreeByNode[nodeId] }));
    });
    if (graphChanged) {
      setNodeMetrics([]);
      setEdgeMetrics([]);
      setGraphMetrics({});
      setMetricValidity({});
    }
    setMetricWarnings({});
  }, [filterRevision, graphRevision, setCommunityMap, topology]);

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
    const importedDescriptors = Array.isArray(importedMetrics.metadata?.attributeDescriptors)
      ? importedMetrics.metadata.attributeDescriptors
      : [];
    importedDescriptors.forEach((descriptor: any) => {
      if (!descriptor?.name) return;
      const validityKey = descriptor.origin === 'community' ? descriptor.name : descriptor.resultOf;
      if (tracksValidity && validityKey && !validMetricIds.has(validityKey)) return;
      if (descriptor.scope === 'node') allowedNodeAttributes.add(descriptor.name);
      if (descriptor.scope === 'edge') allowedEdgeAttributes.add(descriptor.name);
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
    setFilter('nodeColorBase', 'uniform');
    setFilter('nodeSizeBase', 'degree');
    setFilter('edgeColorBase', 'uniform');
    setFilter('edgeColorNodeMetric', '');
    setFilter('edgeColorNodeTarget', 'source');
  }, [rawNodes.length, setFilter]);

  const commitCommunityResult = useCallback((
    result: CommunityComputationResult,
    validity: { graphRevision: string; filterRevision: string },
    options: { automatic?: boolean; fallbackNotice?: string } = {},
  ) => {
    setNetworkMetrics((current) => current.map((entry) => ({
      ...entry,
      [result.resultId]: result.memberships[String(entry.id)],
    })));
    setNodeMetrics(Object.entries(result.memberships).map(([id, community]) => ({ id, [result.resultId]: community })));
    setCommunityMap(result.memberships);
    setGraphMetrics((current) => ({ ...current, [`${result.resultId}_quality`]: result.quality }));
    const resultEngine = result.provenance.engine === 'graphology' ? 'browser' : 'cloud';
    setMetricValidity((current) => ({ ...current, [result.resultId]: {
      ...validity,
      calculatedAt: result.calculatedAt,
      engine: resultEngine,
      ...(options.fallbackNotice ? { fallbackFrom: 'cloud' as const } : {}),
    } }));
    const descriptor = resultMetadata({
      name: result.resultId,
      label: `${result.label} Communities`,
      scope: 'node',
      semanticType: 'nominal',
      origin: 'community',
      resultOf: result.algorithm,
      presentCount: Object.keys(result.memberships).length,
    });
    const latestAttributes = useStore.getState().customAttributes;
    setCustomAttributes([...latestAttributes.filter((entry) => !(entry.scope === 'node' && entry.name === result.resultId)), descriptor]);
    if (!options.automatic || !useStore.getState().restoredVisualization) {
      const styleSelection = communityResultStyleSelection(result.resultId);
      Object.entries(styleSelection).forEach(([key, value]) => setFilter(key as any, value as never));
    }
    setMetricWarnings((current) => options.fallbackNotice
      ? { ...current, fallback: options.fallbackNotice }
      : Object.fromEntries(Object.entries(current).filter(([key]) => key !== 'community' && key !== 'fallback')));
  }, [setCommunityMap, setCustomAttributes, setFilter]);

  const runSelectedMetrics = useCallback((onlyMetricIds?: string[]) => {
    if (!validNodes.length) return;
    const requested = onlyMetricIds || Object.entries(metricsToRun).filter(([id, selected]) => id !== 'louvain' && selected).map(([id]) => id);
    const runLouvain = Boolean(onlyMetricIds?.includes('louvain'));
    const basePositionedNodes = accessors.getPositionedNodes?.() || validNodes;
    const positionedNodes = communityAttribute
      ? basePositionedNodes.map((node) => ({ ...node, community: node[communityAttribute] }))
      : basePositionedNodes.map((node) => {
        const { community: _community, ...withoutCommunity } = node;
        return withoutCommunity;
      });
    activeRequestRef.current?.abort();
    const controller = new AbortController();
    activeRequestRef.current = controller;
    const expectedRequestGeneration = requestGenerationRef.current;
    setMetricsLoading(true);
    setTimeout(() => {
      const request = {
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
        signal: controller.signal,
      };
      void computeMetricsRouted(request, effectiveEngine).then(({ result, fallbackNotice }) => {
        if (controller.signal.aborted || requestGenerationRef.current !== expectedRequestGeneration) return;
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
        setMetricWarnings({ ...result.warnings, ...(fallbackNotice ? { fallback: fallbackNotice } : {}) });
        const descriptors = result.calculatedMetricIds.flatMap((metricId) => {
          const definition = METRIC_BY_ID.get(metricId);
          if (!definition || definition.scope === 'graph' || definition.scope === 'layout') return [];
          const scope = definition.scope === 'node' ? 'node' : 'edge';
          return definition.resultAttributes.map((attribute) => resultMetadata({
            name: attribute,
            label: `${definition.label} · ${attribute}`,
            scope,
            semanticType: 'continuous',
            resultOf: metricId,
            presentCount: definition.scope === 'node' ? result.nodeIds.length : Object.keys(result.metricsByEdge).length,
          }));
        });
        if (descriptors.length) {
          const byKey = new Map(customAttributes.map((entry) => [`${entry.scope}:${entry.name}`, entry]));
          descriptors.forEach((entry) => byKey.set(`${entry.scope}:${entry.name}`, { ...byKey.get(`${entry.scope}:${entry.name}`), ...entry }));
          setCustomAttributes(Array.from(byKey.values()));
        }
      }).catch((error) => {
        if (error?.name !== 'AbortError' && requestGenerationRef.current === expectedRequestGeneration) {
          console.error('Failed to run metrics:', error);
          const message = error instanceof Error ? error.message : String(error);
          const errorIds = [...requested, ...(runLouvain ? ['louvain'] : [])];
          setMetricWarnings((current) => ({ ...current, cloud: message, ...Object.fromEntries(errorIds.map((metricId) => [metricId, message])) }));
        }
      }).finally(() => {
        if (activeRequestRef.current === controller) setMetricsLoading(false);
      });
    }, 50);
  }, [accessors, appliedFilters?.louvainSeed, appliedFilters?.metricWeightAttribute, appliedFilters?.resolution, bipartite, communityAttribute, customAttributes, directed, effectiveEngine, filterRevision, graphRevision, metricsToRun, setCommunityMap, setCustomAttributes, validEdges, validNodes]);

  const runCommunity = useCallback((settings: CommunitySettings) => {
    if (!validNodes.length || !validEdges.length) return;
    activeRequestRef.current?.abort();
    const controller = new AbortController();
    activeRequestRef.current = controller;
    const expectedGeneration = requestGenerationRef.current;
    setMetricsLoading(true);
    setMetricWarnings({});
    const request = { nodes: validNodes, edges: validEdges, directed, bipartite, graphRevision, filterRevision, settings, signal: controller.signal };
    void computeCommunityRouted(request, effectiveEngine).then(({ result, fallbackNotice }) => {
      if (controller.signal.aborted || expectedGeneration !== requestGenerationRef.current) return;
      commitCommunityResult(result, { graphRevision, filterRevision }, { fallbackNotice });
    }).catch((error) => {
      if (error?.name !== 'AbortError') setMetricWarnings({ community: error instanceof Error ? error.message : String(error) });
    }).finally(() => {
      if (activeRequestRef.current === controller) setMetricsLoading(false);
    });
  }, [bipartite, commitCommunityResult, directed, effectiveEngine, filterRevision, graphRevision, validEdges, validNodes]);

  useEffect(() => {
    if (!topology || !validNodes.length || !validEdges.length) return;
    const automaticKey = `${graphGeneration}:${graphRevision}`;
    if (automaticCommitRef.current === automaticKey) return;

    const importedValidity = (importedMetrics?.metadata?.validity || {}) as Record<string, MetricValidity>;
    const savedKey = validSavedLouvainKey({
      validity: importedValidity,
      graphRevision,
      filterRevision,
      nodeIds: topology.nodeIds,
      nodes: importedMetrics?.nodes || {},
    });
    if (savedKey) {
      automaticCommitRef.current = automaticKey;
      if (!restoredVisualization) {
        const resultId = savedKey === 'louvain' ? 'louvain' : 'community_louvain';
        Object.entries(communityResultStyleSelection(resultId)).forEach(([key, value]) => setFilter(key as any, value as never));
      }
      return;
    }

    // Use imported raw counts so applying filters cannot unexpectedly trigger
    // an expensive initial browser calculation for an originally large graph.
    if (!shouldRunAutomaticLouvain(rawNodes.length, rawEdges.length)) {
      automaticCommitRef.current = automaticKey;
      return;
    }

    const settings: CommunitySettings = {
      ...DEFAULT_COMMUNITY_SETTINGS,
      seed: Number(appliedFilters?.louvainSeed) || DEFAULT_COMMUNITY_SETTINGS.seed,
      resolution: Number(appliedFilters?.resolution) || DEFAULT_COMMUNITY_SETTINGS.resolution,
      weightChannel: appliedFilters?.metricWeightAttribute === 'weight_secondary' ? 'weight_secondary'
        : appliedFilters?.metricWeightAttribute === 'weight_raw' ? 'weight_raw'
          : 'unweighted',
    };
    const initialFilterRevision = filterRevision;
    const request = automaticLouvainOnce<RoutedCommunityResult>(automaticKey, () => computeCommunityRouted({
        nodes: validNodes,
        edges: validEdges,
        directed,
        bipartite,
        graphRevision,
        filterRevision: initialFilterRevision,
        settings,
      }, effectiveEngine));
    let disposed = false;
    setMetricsLoading(true);
    void request.then(({ result, fallbackNotice }) => {
      if (!disposed) {
        automaticCommitRef.current = automaticKey;
        commitCommunityResult(result, { graphRevision, filterRevision: initialFilterRevision }, { automatic: true, fallbackNotice });
      }
    }).catch((error) => {
      if (!disposed && error?.name !== 'AbortError') {
        setMetricWarnings((current) => ({ ...current, community: error instanceof Error ? error.message : String(error) }));
      }
    }).finally(() => {
      if (!disposed) setMetricsLoading(false);
    });
    return () => { disposed = true; };
  }, [appliedFilters?.louvainSeed, appliedFilters?.metricWeightAttribute, appliedFilters?.resolution, bipartite, commitCommunityResult, directed, effectiveEngine, filterRevision, graphGeneration, graphRevision, importedMetrics, rawEdges.length, rawNodes.length, restoredVisualization, setFilter, topology, validEdges, validNodes]);

  useEffect(() => {
    requestGenerationRef.current += 1;
    const hadManualRequest = Boolean(activeRequestRef.current);
    activeRequestRef.current?.abort();
    activeRequestRef.current = null;
    if (hadManualRequest) setMetricsLoading(false);
    setMetricWarnings({});
  }, [effectiveEngine, filterRevision, graphRevision]);

  useEffect(() => () => activeRequestRef.current?.abort(), []);

  const modularity = Number.isFinite(Number(graphMetrics.louvainModularity)) ? Number(graphMetrics.louvainModularity) : null;
  const staleMetricIds = useMemo(() => staleCalculationIds(metricValidity, graphRevision, filterRevision), [filterRevision, graphRevision, metricValidity]);

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
    runCommunity,
    invalidateLayoutMetrics,
  };
}
