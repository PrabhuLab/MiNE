'use client';

import React, { useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { RawNode, RawEdge } from '@/store/useStore';
import { getCommunityDisplayMap, getCommunityColor } from '@/lib/communityUtils';
import { useStore } from '@/store/useStore';
import { useGraphColorScales } from '@/hooks/graphStyles/useGraphColorScales';
import { numericExtent } from '@/lib/utils';
export type { LegendMetricScale } from '@/services/graphStyles/types';

interface UseGraphStylesProps {
  nodes: RawNode[];
  edges: RawEdge[];
  communityMap: Record<string, string>;
  networkMetrics?: any[];
  nodeColorBase?: string;
  uniformNodeColor?: string;
  uniformEdgeColor?: string;
  edgeWeightBase?: string;
  edgeColorBase?: string;
  edgeColorNodeMetric?: string;
  edgeColorNodeTarget?: 'source' | 'target';
  nodeOpacity?: number;
  edgeOpacity?: number;
  edgeOpacityBase?: string;
  directed: boolean;
  bipartite: boolean;
  isDarkMode?: boolean;
  searchQuery?: string;
  selectedElement?: string | null;
  selectedCommunityId?: string | null;
  isolatedCommunityId?: string | null;
  showArrowheads: boolean;
  isolatedLegendItem: string | null;
  clickedNodeRef: React.RefObject<RawNode | null>;
  clickedEdgeRef: React.RefObject<RawEdge | null>;
}

export function useGraphStyles({
  nodes,
  edges,
  communityMap,
  networkMetrics = [],
  nodeColorBase = 'custom',
  uniformNodeColor = '#cccccc',
  uniformEdgeColor = '#cccccc',
  edgeColorBase = 'uniform',
  edgeColorNodeMetric = '',
  edgeColorNodeTarget = 'source',
  edgeOpacity = 0.3,
  edgeOpacityBase = 'uniform',
  directed,
  bipartite,
  isDarkMode,
  searchQuery = '',
  selectedElement = null,
  selectedCommunityId = null,
  isolatedCommunityId = null,
  showArrowheads,
  isolatedLegendItem,
  clickedNodeRef,
  clickedEdgeRef,
}: UseGraphStylesProps) {
  const customNodeAttribute = useStore((state) => state.filters.customNodeAttribute);
  const customAttributes = useStore((state) => state.customAttributes);
  const selectedCustomMetadata = customAttributes.find((attribute) => attribute.scope === 'node' && attribute.name === customNodeAttribute);
  const customIsNumeric = Boolean(selectedCustomMetadata && ['discrete', 'continuous'].includes(selectedCustomMetadata.selectedType));
  const {
    customNumericColorScale,
    eigenColorScale,
    prColorScale,
    betweennessColorScale,
    closenessColorScale,
    clusteringColorScale,
    degreeCentColorScale,
    abundanceColorScale,
    legendMetricScale,
  } = useGraphColorScales({
    nodes,
    networkMetrics,
    nodeColorBase,
    customNodeAttribute,
    customIsNumeric,
  });
  const netMap = useMemo(
    () => new Map((networkMetrics || []).map((m: any) => [m.id, m])),
    [networkMetrics]
  );

  // Compute contiguous display mapping (0, 1, 2, 3...)
  const communityDisplay = useMemo(
    () => getCommunityDisplayMap(nodes, communityMap, networkMetrics, nodeColorBase, customNodeAttribute),
    [nodes, communityMap, networkMetrics, nodeColorBase, customNodeAttribute]
  );

  const displayMap = communityDisplay.displayMap; // nodeId -> displayInt (e.g. 0, 1, 2, or -1)

  // Map each contiguous display integer to its distinct non-repeating color
  const communityColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    Object.values(communityDisplay.rawToDisplayMap).forEach((dispIdx) => {
      map[String(dispIdx)] = getCommunityColor(communityDisplay.displayToRawMap[dispIdx]);
    });
    map['-1'] = '#777777';
    map['unassigned'] = '#777777';
    return map;
  }, [communityDisplay.rawToDisplayMap, communityDisplay.displayToRawMap]);

  const customColorMap = communityColorMap;
  const nodeById = useMemo(() => new Map(nodes.map((node) => [String(node.id), node])), [nodes]);

  const typeLabels = useMemo(() => {
    return Array.from(new Set(nodes.map((n) => n.type).filter(Boolean))) as string[];
  }, [nodes]);

  const typeColorScale = useMemo(() => d3.scaleOrdinal(d3.schemeCategory10), []);

  const getShouldShowArrowhead = useCallback(
    (d: any) => {
      if (!directed) return false;

      const srcId = typeof d.source === 'object' ? d.source.id : d.source;
      const tgtId = typeof d.target === 'object' ? d.target.id : d.target;

      if (showArrowheads) return true;

      const activeNodeId =
        clickedNodeRef.current?.id ||
        (selectedElement && !selectedElement.includes('-') ? selectedElement : null);
      if (activeNodeId && (srcId === activeNodeId || tgtId === activeNodeId)) {
        return true;
      }

      if (clickedEdgeRef.current) {
        const cSrc =
          typeof clickedEdgeRef.current.source === 'object'
            ? (clickedEdgeRef.current.source as any).id
            : clickedEdgeRef.current.source;
        const cTgt =
          typeof clickedEdgeRef.current.target === 'object'
            ? (clickedEdgeRef.current.target as any).id
            : clickedEdgeRef.current.target;
        if (srcId === cSrc && tgtId === cTgt) return true;
      }
      if (selectedElement && selectedElement.includes('-')) {
        const parts = selectedElement.split('-');
        if (
          (srcId === parts[0] && tgtId === parts[1]) ||
          (!directed && srcId === parts[1] && tgtId === parts[0])
        ) {
          return true;
        }
      }

      const activeComm =
        isolatedCommunityId ||
        selectedCommunityId ||
        (isolatedLegendItem && isolatedLegendItem.startsWith('community:')
          ? isolatedLegendItem
          : null);
      if (activeComm) {
        const commVal = String(activeComm).replace('community:', '');
        const srcDisp = String(displayMap[srcId] ?? -1);
        const tgtDisp = String(displayMap[tgtId] ?? -1);

        if (srcDisp === commVal || tgtDisp === commVal) {
          return true;
        }
      }

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (String(srcId).toLowerCase().includes(q) || String(tgtId).toLowerCase().includes(q)) {
          return true;
        }
      }

      return false;
    },
    [
      directed,
      showArrowheads,
      selectedElement,
      isolatedCommunityId,
      selectedCommunityId,
      isolatedLegendItem,
      displayMap,
      searchQuery,
      clickedNodeRef,
      clickedEdgeRef,
    ]
  );

  const legendCategories = useMemo(() => {
    if (
      (nodeColorBase === 'louvain' || nodeColorBase === 'community' || (nodeColorBase === 'custom' && !customIsNumeric)) &&
      Object.keys(communityDisplay.rawToDisplayMap).length > 0
    ) {
      const sortedDispIndices = Object.values(communityDisplay.rawToDisplayMap).sort((a, b) => a - b);
      return {
        title: nodeColorBase === 'custom' && customNodeAttribute ? customNodeAttribute : 'Communities',
        items: sortedDispIndices.map((dispIdx) => {
          const rawId = communityDisplay.displayToRawMap[dispIdx];
          const color = getCommunityColor(communityDisplay.displayToRawMap[dispIdx]);
          const memberNodes = nodes
            .filter((n) => displayMap[n.id] === dispIdx)
            .map((n) => n.label || n.name || n.id);

          return {
            label: nodeColorBase === 'custom' && customNodeAttribute ? rawId : `Community ${dispIdx}`,
            id: `community:${dispIdx}`,
            color,
            nodes: memberNodes,
            allIds: sortedDispIndices.map((i) => `community:${i}`),
          };
        }),
      };
    } else if (nodeColorBase === 'type' && typeLabels.length > 0) {
      return {
        title: 'Types',
        items: typeLabels.map((label) => ({
          label,
          id: `type:${label}`,
          color: typeColorScale(label),
          nodes: nodes.filter((n) => n.type === label).map((n) => n.label || n.name || n.id),
          allIds: typeLabels.map((t) => `type:${t}`),
        })),
      };
    }
    return null;
  }, [
    nodeColorBase,
    communityDisplay,
    displayMap,
    nodes,
    typeLabels,
    typeColorScale,
    customNodeAttribute,
    customIsNumeric,
  ]);

  const getNodeColor = useCallback(
    (d: any) => {
      const net = netMap.get(d.id);
      const defaultNodeColor = isDarkMode ? '#E4E3E0' : '#141414';
      if (nodeColorBase === 'uniform') {
        if (
          !isDarkMode &&
          (uniformNodeColor === '#cccccc' ||
            uniformNodeColor === '#bbb' ||
            uniformNodeColor === '#bbbbbb')
        ) {
          return '#141414';
        }
        return uniformNodeColor;
      }
      if (nodeColorBase === 'abundance') {
        const val = parseFloat(d.abundance ?? net?.abundance ?? 0);
        return abundanceColorScale(val);
      }
      if (
        nodeColorBase === 'custom' ||
        nodeColorBase === 'louvain' ||
        nodeColorBase === 'community'
      ) {
        if (nodeColorBase === 'custom' && customIsNumeric && customNodeAttribute) {
          const value = Number(d[customNodeAttribute]);
          if (Number.isFinite(value)) return customNumericColorScale(value);
        }
        const dispIdx = displayMap[d.id] ?? -1;
        if (dispIdx >= 0) return getCommunityColor(communityDisplay.displayToRawMap[dispIdx]);
        if (d.type) return typeColorScale(d.type);
        if (d.group !== undefined) return getCommunityColor(String(d.group));
        return defaultNodeColor;
      }
      if (nodeColorBase === 'type') {
        const t = d.type || (d.group !== undefined ? String(d.group) : null);
        if (t) return typeColorScale(t);
      }
      if (nodeColorBase === 'eigenvector') {
        const val = parseFloat(net?.eigenvector ?? d.eigenvector ?? 0);
        return eigenColorScale(val);
      }
      if (nodeColorBase === 'pagerank') {
        const val = parseFloat(net?.pagerank ?? d.pagerank ?? 0);
        return prColorScale(val);
      }
      if (nodeColorBase === 'betweenness') {
        const val = parseFloat(net?.betweenness ?? d.betweenness ?? 0);
        return betweennessColorScale(val);
      }
      if (nodeColorBase === 'closeness') {
        const val = parseFloat(net?.closeness ?? d.closeness ?? 0);
        return closenessColorScale(val);
      }
      if (nodeColorBase === 'clustering') {
        const val = parseFloat(net?.clustering ?? d.clustering ?? 0);
        return clusteringColorScale(val);
      }
      if (nodeColorBase === 'degreeCentrality' || nodeColorBase === 'degree') {
        const val = parseFloat(net?.degreeCentrality ?? net?.degree ?? d.degreeCentrality ?? d.degree ?? d.abundance ?? 0);
        return degreeCentColorScale(val);
      }
      if (nodeColorBase === 'inDegreeCentrality') {
        const val = parseFloat(net?.inDegreeCentrality ?? d.inDegreeCentrality ?? 0);
        return degreeCentColorScale(val);
      }
      if (nodeColorBase === 'outDegreeCentrality') {
        const val = parseFloat(net?.outDegreeCentrality ?? d.outDegreeCentrality ?? 0);
        return degreeCentColorScale(val);
      }
      return defaultNodeColor;
    },
    [
      isDarkMode,
      nodeColorBase,
      customNodeAttribute,
      customIsNumeric,
      customNumericColorScale,
      uniformNodeColor,
      displayMap,
      typeColorScale,
      abundanceColorScale,
      eigenColorScale,
      prColorScale,
      betweennessColorScale,
      closenessColorScale,
      clusteringColorScale,
      degreeCentColorScale,
      netMap,
      communityDisplay.displayToRawMap,
    ]
  );

  const maxRaw = useMemo(
    () => d3.max(edges, (d: any) => Number(d.weight_raw) || 0) || 1,
    [edges]
  );
  const maxSec = useMemo(
    () => d3.max(edges, (d: any) => Number(d.weight_secondary) || 0) || 1,
    [edges]
  );
  const rawColorScale = useMemo(
    () =>
      d3.scaleSequential(isDarkMode ? d3.interpolateGnBu : d3.interpolateBlues).domain([0, maxRaw]),
    [isDarkMode, maxRaw]
  );
  const secColorScale = useMemo(
    () =>
      d3
        .scaleSequential(isDarkMode ? d3.interpolateOrRd : d3.interpolateOranges)
        .domain([0, maxSec]),
    [isDarkMode, maxSec]
  );
  const customEdgeColorScales = useMemo(() => {
    const attributes = new Set<string>();
    if (edgeColorBase.startsWith('edge:')) attributes.add(edgeColorBase.slice('edge:'.length));
    if (edgeOpacityBase.startsWith('edge:')) attributes.add(edgeOpacityBase.slice('edge:'.length));
    const result = new Map<string, (value: number) => string>();
    attributes.forEach((attribute) => {
      const [min, max] = numericExtent(edges.map((edge: any) => Number(edge[attribute]))) || [0, 1];
      result.set(attribute, d3.scaleSequential(d3.interpolateTurbo).domain([min, max === min ? min + 1 : max]));
    });
    return result;
  }, [edgeColorBase, edgeOpacityBase, edges]);
  const customEdgeOpacityMax = useMemo(() => {
    if (!edgeOpacityBase.startsWith('edge:')) return 1;
    const attribute = edgeOpacityBase.slice('edge:'.length);
    return numericExtent(edges.map((edge: any) => Number(edge[attribute])))?.[1] ?? 1;
  }, [edgeOpacityBase, edges]);
  const getNodeMetricValue = useCallback((nodeId: string, metric: string): number | null => {
    const node = nodeById.get(String(nodeId));
    const net = netMap.get(String(nodeId));
    if (metric === 'custom') {
      const value = customNodeAttribute ? Number(node?.[customNodeAttribute]) : Number.NaN;
      return Number.isFinite(value) ? value : null;
    }
    if (metric.startsWith('custom:')) {
      const value = Number(node?.[metric.slice('custom:'.length)]);
      return Number.isFinite(value) ? value : null;
    }
    if (metric === 'degreeCentrality') {
      const value = Number(net?.degreeCentrality ?? net?.degree ?? net?.inDegree ?? node?.degree);
      return Number.isFinite(value) ? value : null;
    }
    const value = Number(net?.[metric] ?? node?.[metric]);
    return Number.isFinite(value) ? value : null;
  }, [customNodeAttribute, netMap, nodeById]);
  const nodeMetricExtent = useMemo(() => {
    const [min, max] = numericExtent(nodes.map((node) => getNodeMetricValue(node.id, edgeColorNodeMetric) ?? Number.NaN)) || [0, 1];
    return { min, max: max === min ? min + 1 : max };
  }, [edgeColorNodeMetric, getNodeMetricValue, nodes]);
  const nodeMetricColorScale = useMemo(
    () => d3.scaleSequential(d3.interpolateViridis).domain([nodeMetricExtent.min, nodeMetricExtent.max]),
    [nodeMetricExtent],
  );

  const getEdgeColor = useCallback(
    (d: any) => {
      if (edgeColorBase === 'nodeMetric' && edgeColorNodeMetric) {
        const targetId =
          edgeColorNodeTarget === 'source' ? d.source.id || d.source : d.target.id || d.target;
        const net = netMap.get(targetId);
        const mBase = edgeColorNodeMetric;
        const defaultColor = isDarkMode ? '#eeeeee' : '#141414';
        if (mBase.startsWith('custom:')) {
          const attribute = mBase.slice('custom:'.length);
          const value = getNodeMetricValue(targetId, mBase);
          if (value !== null) return nodeMetricColorScale(value);
          const rawValue = nodeById.get(String(targetId))?.[attribute];
          return rawValue === null || rawValue === undefined || String(rawValue).trim() === ''
            ? defaultColor
            : getCommunityColor(`${attribute}:${String(rawValue)}`);
        }
        if (
          mBase === 'custom' ||
          mBase === 'community' ||
          mBase === 'louvain'
        ) {
          const dispIdx = displayMap[targetId] ?? -1;
          return getCommunityColor(communityDisplay.displayToRawMap[dispIdx]);
        }
        if (mBase === 'type') {
          const t = nodeById.get(String(targetId))?.type;
          if (t) return typeColorScale(t);
        }
        if (mBase === 'eigenvector' && net?.eigenvector !== undefined)
          return eigenColorScale(parseFloat(net.eigenvector));
        if (mBase === 'pagerank' && net?.pagerank !== undefined)
          return prColorScale(parseFloat(net.pagerank));
        if (mBase === 'betweenness' && net?.betweenness !== undefined)
          return betweennessColorScale(parseFloat(net.betweenness));
        if (mBase === 'closeness' && net?.closeness !== undefined)
          return closenessColorScale(parseFloat(net.closeness));
        if (mBase === 'clustering' && net?.clustering !== undefined)
          return clusteringColorScale(parseFloat(net.clustering));
        if (mBase === 'degreeCentrality' && net?.degreeCentrality !== undefined)
          return degreeCentColorScale(parseFloat(net.degreeCentrality));
      }

      if (edgeColorBase === 'weight_raw' && d.weight_raw !== undefined)
        return rawColorScale(Number(d.weight_raw));
      if (edgeColorBase === 'weight_secondary' && d.weight_secondary !== undefined)
        return secColorScale(Number(d.weight_secondary));
      if (edgeColorBase.startsWith('edge:')) {
        const attribute = edgeColorBase.slice('edge:'.length);
        const value = Number(d[attribute]);
        const scale = customEdgeColorScales.get(attribute);
        if (Number.isFinite(value) && scale) return scale(value);
      }
      if (edgeColorBase === 'uniform') {
        if (isDarkMode) {
          if (
            uniformEdgeColor === '#000000' ||
            uniformEdgeColor === '#000' ||
            uniformEdgeColor === '#141414' ||
            uniformEdgeColor === '#222222'
          ) {
            return '#888888';
          }
        } else {
          if (
            uniformEdgeColor === '#cccccc' ||
            uniformEdgeColor === '#E4E3E0' ||
            uniformEdgeColor === '#ffffff' ||
            uniformEdgeColor === '#fff' ||
            uniformEdgeColor === '#888888'
          ) {
            return '#333333';
          }
        }
        return uniformEdgeColor;
      }
      return isDarkMode ? '#888888' : '#333333';
    },
    [
      edgeColorBase,
      uniformEdgeColor,
      edgeColorNodeMetric,
      edgeColorNodeTarget,
      nodeById,
      netMap,
      displayMap,
      typeColorScale,
      eigenColorScale,
      prColorScale,
      betweennessColorScale,
      closenessColorScale,
      clusteringColorScale,
      degreeCentColorScale,
      rawColorScale,
      secColorScale,
      customEdgeColorScales,
      getNodeMetricValue,
      nodeMetricColorScale,
      isDarkMode,
      communityDisplay.displayToRawMap,
    ]
  );

  const getEdgeOpacity = useCallback(
    (d: any) => {
      let alpha = edgeOpacity;
      if (edgeOpacityBase === 'weight_raw' && d.weight_raw !== undefined) {
        const ratio = maxRaw > 0 ? Number(d.weight_raw) / maxRaw : 1;
        alpha = edgeOpacity * ratio;
      } else if (edgeOpacityBase === 'weight_secondary' && d.weight_secondary !== undefined) {
        const ratio = maxSec > 0 ? Number(d.weight_secondary) / maxSec : 1;
        alpha = edgeOpacity * ratio;
      } else if (edgeOpacityBase.startsWith('edge:')) {
        const attribute = edgeOpacityBase.slice('edge:'.length);
        const value = Number(d[attribute]);
        if (Number.isFinite(value)) alpha = edgeOpacity * (customEdgeOpacityMax > 0 ? value / customEdgeOpacityMax : 1);
      } else if (edgeOpacityBase === 'nodeMetric' && edgeColorNodeMetric) {
        const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
        const targetId = typeof d.target === 'object' ? d.target.id : d.target;
        const source = getNodeMetricValue(String(sourceId), edgeColorNodeMetric);
        const target = getNodeMetricValue(String(targetId), edgeColorNodeMetric);
        const value = source === null ? target : target === null ? source : (source + target) / 2;
        if (value !== null) {
          const ratio = (value - nodeMetricExtent.min) / (nodeMetricExtent.max - nodeMetricExtent.min);
          alpha = edgeOpacity * Math.max(0.08, ratio);
        }
      }
      return Math.max(0, Math.min(1, alpha));
    },
    [edgeOpacityBase, edgeColorNodeMetric, edgeOpacity, customEdgeOpacityMax, getNodeMetricValue, maxRaw, maxSec, nodeMetricExtent]
  );

  return {
    customColorMap,
    communityColorMap,
    communityDisplay,
    netMap,
    maxRaw,
    maxSec,
    getShouldShowArrowhead,
    legendCategories,
    legendMetricScale,
    getNodeColor,
    getEdgeColor,
    getEdgeOpacity,
  };
}
