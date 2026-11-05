'use client';

import React, { useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { RawNode, RawEdge } from '@/store/useStore';
import { getCommunityDisplayMap, getCommunityColor } from '@/lib/communityUtils';
import { useStore } from '@/store/useStore';
import { useGraphColorScales } from '@/hooks/graphStyles/useGraphColorScales';
import { numericExtent } from '@/lib/utils';
import type { LegendMetricScale } from '@/services/graphStyles/types';
import { isCategoricalSemanticType } from '@/services/attributes/registry';
import { degreeByNode } from '@/services/graphStyles/size';
import { buildLegendCategories } from '@/services/graphStyles/categories';
export type { LegendMetricScale } from '@/services/graphStyles/types';

const metricLabel = (metric: string) => ({
  degree: 'Degree',
  degreeCentrality: 'Degree Centrality',
  inDegree: 'In-Degree',
  outDegree: 'Out-Degree',
  inDegreeCentrality: 'In-Degree Centrality',
  outDegreeCentrality: 'Out-Degree Centrality',
  eigenvector: 'Eigenvector Centrality',
  pagerank: 'PageRank',
  betweenness: 'Betweenness Centrality',
  closeness: 'Closeness Centrality',
  clustering: 'Clustering Coefficient',
  louvain: 'Louvain Community',
  type: 'Node Type',
}[metric] || metric);

interface UseGraphStylesProps {
  nodes: RawNode[];
  edges: RawEdge[];
  communityMap: Record<string, string>;
  networkMetrics?: any[];
  nodeSizeBase?: string;
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
  nodeSizeBase = 'uniform',
  nodeColorBase = 'custom',
  uniformNodeColor = '#cccccc',
  uniformEdgeColor = '#888888',
  edgeWeightBase = 'uniform',
  edgeColorBase = 'uniform',
  edgeColorNodeMetric = '',
  edgeColorNodeTarget = 'source',
  edgeOpacity = 0.3,
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
  const customNodeSizeAttribute = useStore((state) => state.filters.customNodeSizeAttribute);
  const customAttributes = useStore((state) => state.customAttributes);
  const legendColorOverrides = useStore((state) => state.legendColorOverrides);
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
    legendMetricScale,
  } = useGraphColorScales({
    nodes,
    networkMetrics,
    nodeColorBase,
    customNodeAttribute,
    customIsNumeric,
    legendColorOverrides,
  });
  const netMap = useMemo(
    () => new Map((networkMetrics || []).map((m: any) => [m.id, m])),
    [networkMetrics]
  );

  // Compute contiguous display mapping (0, 1, 2, 3...)
  const communityDisplay = useMemo(
    () => getCommunityDisplayMap(
      nodes,
      communityMap,
      networkMetrics,
      'louvain',
    ),
    [nodes, communityMap, networkMetrics]
  );

  const displayMap = communityDisplay.displayMap; // nodeId -> displayInt (e.g. 0, 1, 2, or -1)

  // Map each contiguous display integer to its distinct non-repeating color
  const communityColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    Object.values(communityDisplay.rawToDisplayMap).forEach((dispIdx) => {
      const rawId = communityDisplay.displayToRawMap[dispIdx];
      map[String(dispIdx)] = legendColorOverrides[`community:${rawId}`] ?? getCommunityColor(rawId);
    });
    map['-1'] = '#777777';
    map['unassigned'] = '#777777';
    return map;
  }, [communityDisplay.rawToDisplayMap, communityDisplay.displayToRawMap, legendColorOverrides]);

  const customColorMap = communityColorMap;
  const nodeById = useMemo(() => new Map(nodes.map((node) => [String(node.id), node])), [nodes]);

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

  const communityColor = useCallback((rawId: string | number) =>
    legendColorOverrides[`community:${String(rawId)}`] ?? getCommunityColor(rawId), [legendColorOverrides]);
  const legendCategories = useMemo(() => buildLegendCategories({
    nodes,
    edges,
    communityDisplay,
    netMap,
    nodeColorBase,
    edgeColorBase,
    edgeColorNodeMetric,
    edgeColorNodeTarget,
    customAttributes,
    legendColorOverrides,
    customNodeAttribute,
    typeColorScale,
  }), [nodes, edges, communityDisplay, netMap, nodeColorBase, edgeColorBase, edgeColorNodeMetric, edgeColorNodeTarget, customAttributes, legendColorOverrides, customNodeAttribute, typeColorScale]);

  const legendNodeMembership = useMemo(() => new Map(legendCategories.flatMap((category) => category.items.map((item) => [item.id, new Set(item.nodeIds || [])] as const))), [legendCategories]);
  const legendEdgeMembership = useMemo(() => new Map(legendCategories.flatMap((category) => category.items.map((item) => [item.id, new Set(item.edgeIds || [])] as const))), [legendCategories]);

  const getNodeColor = useCallback(
    (d: any) => {
      const net = netMap.get(d.id);
      const defaultNodeColor = isDarkMode ? '#E4E3E0' : '#141414';
      if (nodeColorBase === 'uniform') {
        const override = legendColorOverrides['element:standard'];
        if (override) return override;
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
      if (
        nodeColorBase === 'custom' ||
        nodeColorBase === 'louvain' ||
        nodeColorBase === 'community'
      ) {
        if (nodeColorBase === 'custom' && customNodeAttribute) {
          if (customIsNumeric) {
            const value = Number(net?.[customNodeAttribute] ?? d[customNodeAttribute]);
            if (Number.isFinite(value)) return customNumericColorScale(value);
          } else {
            const value = net?.[customNodeAttribute] ?? d[customNodeAttribute];
            if (value !== undefined && value !== null && String(value).trim() !== '') {
              const colorKey = `attribute:${customNodeAttribute}=${String(value)}`;
              return legendColorOverrides[colorKey] ?? getCommunityColor(colorKey);
            }
          }
          return defaultNodeColor;
        }
        const dispIdx = displayMap[d.id] ?? -1;
        if (dispIdx >= 0) return communityColor(communityDisplay.displayToRawMap[dispIdx]);
        return defaultNodeColor;
      }
      if (nodeColorBase === 'type') {
        const t = d.type || (d.group !== undefined ? String(d.group) : null);
        if (t) return legendColorOverrides[`type:${t}`] ?? typeColorScale(t);
      }
      if (nodeColorBase === 'partition') {
        return String(d.partition) === 'B' || Number(d.partitionIndex) === 1
          ? (legendColorOverrides['element:bipartite'] ?? (isDarkMode ? '#ff9f43' : '#c44f00'))
          : (legendColorOverrides['element:standard'] ?? (isDarkMode ? '#54a0ff' : '#0057b8'));
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
        const val = parseFloat(net?.degreeCentrality ?? net?.degree ?? d.degreeCentrality ?? d.degree ?? 0);
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
      eigenColorScale,
      prColorScale,
      betweennessColorScale,
      closenessColorScale,
      clusteringColorScale,
      degreeCentColorScale,
      netMap,
      communityDisplay.displayToRawMap,
      communityColor,
      legendColorOverrides,
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
  const edgeScaleColors = useCallback((key: string, defaults: [string, string]) => [
    legendColorOverrides[`scale:${key}:min`] || defaults[0],
    legendColorOverrides[`scale:${key}:max`] || defaults[1],
  ] as [string, string], [legendColorOverrides]);
  const rawColors = useMemo(
    () => edgeScaleColors('edge:weight_raw', ['#deebf7', '#08519c']),
    [edgeScaleColors],
  );
  const secondaryColors = useMemo(
    () => edgeScaleColors('edge:weight_secondary', ['#fee6ce', '#a63603']),
    [edgeScaleColors],
  );
  const rawColorScale = useMemo(() => d3.scaleSequential(d3.interpolateRgb(...rawColors)).domain([0, maxRaw]), [maxRaw, rawColors]);
  const secColorScale = useMemo(() => d3.scaleSequential(d3.interpolateRgb(...secondaryColors)).domain([0, maxSec]), [maxSec, secondaryColors]);
  const getNodeMetricValue = useCallback((nodeId: string, metric: string): number | null => {
    const node = nodeById.get(String(nodeId));
    const net = netMap.get(String(nodeId));
    if (metric === 'custom') {
      const value = customNodeAttribute ? Number(net?.[customNodeAttribute] ?? node?.[customNodeAttribute]) : Number.NaN;
      return Number.isFinite(value) ? value : null;
    }
    if (metric.startsWith('custom:')) {
      const attribute = metric.slice('custom:'.length);
      const value = Number(net?.[attribute] ?? node?.[attribute]);
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
  const nodeEdgeMetricKey = `edge:node:${edgeColorNodeMetric}`;
  const nodeEdgeMetricColors = useMemo(
    () => edgeScaleColors(nodeEdgeMetricKey, ['#440154', '#fde725']),
    [edgeScaleColors, nodeEdgeMetricKey],
  );
  const nodeMetricColorScale = useMemo(() => d3.scaleSequential(d3.interpolateRgb(...nodeEdgeMetricColors)).domain([nodeMetricExtent.min, nodeMetricExtent.max]), [nodeEdgeMetricColors, nodeMetricExtent]);
  const selectedEdgeColorAttribute = edgeColorBase.startsWith('edge:') ? edgeColorBase.slice('edge:'.length) : '';
  const selectedEdgeColorMetadata = customAttributes.find((item) => item.scope === 'edge' && item.name === selectedEdgeColorAttribute);
  const selectedEdgeColorNumeric = Boolean(selectedEdgeColorMetadata && !isCategoricalSemanticType(selectedEdgeColorMetadata.selectedType));
  const customEdgeColorExtent = useMemo(() => {
    const [min, max] = numericExtent(edges.map((edge) => Number(edge[selectedEdgeColorAttribute]))) || [0, 1];
    return { min, max: max === min ? min + 1 : max };
  }, [edges, selectedEdgeColorAttribute]);
  const customEdgeScaleKey = `edge:${selectedEdgeColorAttribute}`;
  const customEdgeColors = useMemo(
    () => edgeScaleColors(customEdgeScaleKey, ['#440154', '#fde725']),
    [customEdgeScaleKey, edgeScaleColors],
  );
  const customEdgeColorScale = useMemo(() => d3.scaleSequential(d3.interpolateRgb(...customEdgeColors)).domain([customEdgeColorExtent.min, customEdgeColorExtent.max]), [customEdgeColorExtent, customEdgeColors]);

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
          const rawValue = net?.[attribute] ?? nodeById.get(String(targetId))?.[attribute];
          const metadata = customAttributes.find((item) => item.scope === 'node' && item.name === attribute);
          if (metadata && !isCategoricalSemanticType(metadata.selectedType) && Number.isFinite(Number(rawValue))) {
            return nodeMetricColorScale(Number(rawValue));
          }
          return rawValue === null || rawValue === undefined || String(rawValue).trim() === ''
            ? defaultColor
            : (legendColorOverrides[`attribute:${attribute}=${String(rawValue)}`] ?? getCommunityColor(`attribute:${attribute}=${String(rawValue)}`));
        }
        if (
          mBase === 'custom' ||
          mBase === 'community' ||
          mBase === 'louvain'
        ) {
          const dispIdx = displayMap[targetId] ?? -1;
          return communityColor(communityDisplay.displayToRawMap[dispIdx]);
        }
        if (mBase === 'type') {
          const t = nodeById.get(String(targetId))?.type;
          if (t) return legendColorOverrides[`type:${t}`] ?? typeColorScale(t);
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
        const rawValue = d[attribute];
        if (rawValue !== undefined && rawValue !== null && String(rawValue).trim() !== '') {
          if (selectedEdgeColorNumeric && Number.isFinite(Number(rawValue))) return customEdgeColorScale(Number(rawValue));
          const colorKey = `attribute:${attribute}=${String(rawValue)}`;
          return legendColorOverrides[colorKey] ?? getCommunityColor(colorKey);
        }
      }
      return legendColorOverrides['element:edges'] ?? uniformEdgeColor;
    },
    [
      edgeColorBase,
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
      isDarkMode,
      communityDisplay.displayToRawMap,
      legendColorOverrides,
      communityColor,
      uniformEdgeColor,
      customAttributes,
      nodeMetricColorScale,
      selectedEdgeColorNumeric,
      customEdgeColorScale,
    ]
  );

  const getEdgeOpacity = useCallback(() => Math.max(0, Math.min(1, edgeOpacity)), [edgeOpacity]);

  const degrees = useMemo(() => degreeByNode(nodes, edges), [nodes, edges]);
  const legendMetricScales = useMemo(() => {
    const result: LegendMetricScale[] = [];
    if (legendMetricScale) result.push(legendMetricScale);
    const addColor = (title: string, min: number, max: number, scale: (value: number) => string, key: string, colors: [string, string]) => {
      result.push({ title, visual: 'color', min, max, ticks: [min, (min + max) / 2, max], scale, colors: { min: colors[0], max: colors[1] }, colorKeys: { min: `scale:${key}:min`, max: `scale:${key}:max` } });
    };
    const addNumeric = (title: string, visual: LegendMetricScale['visual'], values: number[], description?: string) => {
      const extent = numericExtent(values);
      if (!extent) return;
      const [min, rawMax] = extent;
      const max = rawMax === min ? min + 1 : rawMax;
      result.push({ title, description, visual, min, max, ticks: [min, (min + max) / 2, max] });
    };

    if (nodeSizeBase !== 'uniform') {
      const selectedName = nodeSizeBase === 'custom' ? customNodeSizeAttribute : nodeSizeBase;
      const values = nodes.map((node) => {
        if (nodeSizeBase === 'custom') return Number(customNodeSizeAttribute ? netMap.get(String(node.id))?.[customNodeSizeAttribute] ?? node[customNodeSizeAttribute] : Number.NaN);
        if (nodeSizeBase === 'degree') return degrees[String(node.id)] ?? 0;
        return Number(netMap.get(String(node.id))?.[nodeSizeBase] ?? node[nodeSizeBase]);
      });
      addNumeric(`Node size · ${metricLabel(selectedName || 'custom')}`, 'size', values, 'Larger circles represent larger values.');
    }

    if (edgeWeightBase !== 'uniform') {
      const edgeWeightValue = (edge: RawEdge) => {
        if (edgeWeightBase === 'weight_raw') return Number(edge.weight_raw);
        if (edgeWeightBase === 'weight_secondary') return Number(edge.weight_secondary);
        if (edgeWeightBase.startsWith('edge:')) return Number(edge[edgeWeightBase.slice('edge:'.length)]);
        return Number.NaN;
      };
      const rawMetric = edgeWeightBase.replace(/^(edge:|node:|metric:)/, '');
      addNumeric(`Edge weight · ${edgeWeightBase === 'weight_raw' ? 'Raw / absolute weight' : edgeWeightBase === 'weight_secondary' ? 'Secondary / transformed weight' : metricLabel(rawMetric)}`, 'width', edges.map(edgeWeightValue), 'Thicker lines represent larger values.');
    }
    if (edgeColorBase === 'weight_raw') addColor('Edge color · Raw / absolute weight', 0, maxRaw, rawColorScale, 'edge:weight_raw', rawColors);
    if (edgeColorBase === 'weight_secondary') addColor('Edge color · Secondary / transformed weight', 0, maxSec, secColorScale, 'edge:weight_secondary', secondaryColors);
    if (edgeColorBase === 'nodeMetric' && edgeColorNodeMetric && !['louvain', 'community', 'type'].includes(edgeColorNodeMetric)) {
      const metadata = edgeColorNodeMetric.startsWith('custom:') ? customAttributes.find((item) => item.scope === 'node' && item.name === edgeColorNodeMetric.slice(7)) : null;
      if (!metadata || !isCategoricalSemanticType(metadata.selectedType)) addColor(`Edge color · ${metricLabel(edgeColorNodeMetric.replace('custom:', ''))} (${edgeColorNodeTarget} node)`, nodeMetricExtent.min, nodeMetricExtent.max, nodeMetricColorScale, nodeEdgeMetricKey, nodeEdgeMetricColors);
    }
    if (selectedEdgeColorAttribute && selectedEdgeColorNumeric) addColor(`Edge color · ${metricLabel(selectedEdgeColorAttribute)}`, customEdgeColorExtent.min, customEdgeColorExtent.max, customEdgeColorScale, customEdgeScaleKey, customEdgeColors);
    return Array.from(new Map(result.map((entry) => [`${entry.visual}:${entry.title}`, entry])).values());
  }, [customAttributes, customEdgeColorExtent, customEdgeColorScale, customEdgeColors, customEdgeScaleKey, customNodeSizeAttribute, degrees, edgeColorBase, edgeColorNodeMetric, edgeColorNodeTarget, edgeWeightBase, edges, legendMetricScale, maxRaw, maxSec, netMap, nodeEdgeMetricColors, nodeEdgeMetricKey, nodeMetricColorScale, nodeMetricExtent, nodeSizeBase, nodes, rawColorScale, rawColors, secColorScale, secondaryColors, selectedEdgeColorAttribute, selectedEdgeColorNumeric]);

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
    legendMetricScales,
    legendNodeMembership,
    legendEdgeMembership,
    getNodeColor,
    getEdgeColor,
    getEdgeOpacity,
  };
}
