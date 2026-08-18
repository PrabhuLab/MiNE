'use client';

import React, { useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { RawNode, RawEdge } from '@/store/useStore';
import { getCommunityDisplayMap, getCommunityColor } from '@/lib/communityUtils';
import { useStore } from '@/store/useStore';
import { useGraphColorScales } from '@/hooks/graphStyles/useGraphColorScales';
import { numericExtent } from '@/lib/utils';
import type { LegendMetricScale } from '@/services/graphStyles/types';
export type { LegendMetricScale } from '@/services/graphStyles/types';

const metricLabel = (metric: string) => ({
  abundance: 'Abundance',
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
  uniformEdgeColor = '#cccccc',
  edgeWeightBase = 'uniform',
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
  const legendColorOverrides = useStore((state) => state.legendColorOverrides);
  const shownNodeAttributes = useMemo(() => customAttributes.filter((attribute) => attribute.scope === 'node' && attribute.active && attribute.shown), [customAttributes]);
  const shownEdgeAttributes = useMemo(() => customAttributes.filter((attribute) => attribute.scope === 'edge' && attribute.active && attribute.shown), [customAttributes]);
  const shownContinuousScales = useMemo(() => {
    const scales = new Map<string, { min: number; max: number; scale: (value: number) => string }>();
    [...shownNodeAttributes, ...shownEdgeAttributes].forEach((attribute) => {
      if (attribute.selectedType !== 'continuous') return;
      const entities = attribute.scope === 'node' ? nodes : edges;
      const [min, rawMax] = numericExtent(entities.map((entity) => Number(entity[attribute.name]))) || [0, 1];
      const max = rawMax === min ? min + 1 : rawMax;
      const key = `${attribute.scope}:${attribute.name}`;
      const minColor = legendColorOverrides[`scale:${key}:min`] || '#440154';
      const maxColor = legendColorOverrides[`scale:${key}:max`] || '#fde725';
      scales.set(key, { min, max, scale: d3.scaleSequential(d3.interpolateRgb(minColor, maxColor)).domain([min, max]) });
    });
    return scales;
  }, [edges, legendColorOverrides, nodes, shownEdgeAttributes, shownNodeAttributes]);
  const attributeStates = useCallback((entity: Record<string, any>, scopeAttributes: typeof customAttributes) => scopeAttributes.flatMap((attribute) => {
    const value = entity[attribute.name];
    if (value === undefined || value === null || String(value).trim() === '') return [];
    const state = attribute.selectedType === 'continuous' ? attribute.name : `${attribute.name}=${String(value)}`;
    return [{ state, label: attribute.selectedType === 'continuous' ? attribute.name : `${attribute.name}: ${String(value)}`, value, attribute }];
  }), []);
  const attributeOrder = useMemo(() => new Map(customAttributes.map((attribute, index) => [`${attribute.scope}:${attribute.name}`, index])), [customAttributes]);
  const effectiveStates = useCallback((states: ReturnType<typeof attributeStates>) => {
    const ordered = [...states].sort((left, right) =>
      (attributeOrder.get(`${left.attribute.scope}:${left.attribute.name}`) ?? Number.MAX_SAFE_INTEGER)
      - (attributeOrder.get(`${right.attribute.scope}:${right.attribute.name}`) ?? Number.MAX_SAFE_INTEGER));
    const priorityState = ordered.find((state) => state.attribute.combine === false);
    return priorityState ? [priorityState] : ordered;
  }, [attributeOrder]);
  const derivedEdgeNodeStateMap = useMemo(() => {
    const valuesByNode = new Map<string, Map<string, { attribute: (typeof customAttributes)[number]; values: unknown[] }>>();
    shownEdgeAttributes.filter((attribute) => attribute.edgeNodeTarget && attribute.edgeNodeTarget !== 'none').forEach((attribute) => {
      edges.forEach((edge) => {
        const rawValue = edge[attribute.name];
        if (rawValue === undefined || rawValue === null || String(rawValue).trim() === '') return;
        const nodeId = String(attribute.edgeNodeTarget === 'source' ? edge.source : edge.target);
        const byAttribute = valuesByNode.get(nodeId) || new Map();
        const entry = byAttribute.get(attribute.name) || { attribute, values: [] };
        entry.values.push(rawValue);
        byAttribute.set(attribute.name, entry);
        valuesByNode.set(nodeId, byAttribute);
      });
    });
    return new Map(Array.from(valuesByNode.entries()).map(([nodeId, entries]) => [nodeId, Array.from(entries.values()).map(({ attribute, values }) => {
      const numericValues = values.map(Number).filter(Number.isFinite);
      const value = attribute.selectedType === 'continuous' && numericValues.length
        ? numericValues.reduce((sum, current) => sum + current, 0) / numericValues.length
        : Array.from(new Set(values.map(String))).sort().join(' + ');
      const targetLabel = attribute.edgeNodeTarget === 'source' ? 'Source' : 'Target';
      const state = attribute.selectedType === 'continuous' ? `${attribute.name} (${targetLabel})` : `${attribute.name} (${targetLabel})=${String(value)}`;
      return { state, label: attribute.selectedType === 'continuous' ? state : `${attribute.name} (${targetLabel}): ${String(value)}`, value, attribute };
    })]));
  }, [edges, shownEdgeAttributes]);
  const shownNodeStateMap = useMemo(() => new Map(nodes.map((node) => [
    String(node.id),
    effectiveStates([...attributeStates(node, shownNodeAttributes), ...(derivedEdgeNodeStateMap.get(String(node.id)) || [])]),
  ])), [attributeStates, derivedEdgeNodeStateMap, effectiveStates, nodes, shownNodeAttributes]);
  const shownEdgeStateMap = useMemo(() => new Map(edges.map((edge) => [String(edge.key ?? `${edge.source}->${edge.target}`), effectiveStates(attributeStates(edge, shownEdgeAttributes))])), [attributeStates, edges, effectiveStates, shownEdgeAttributes]);
  const overlayColor = useCallback((states: ReturnType<typeof attributeStates>) => {
    if (!states.length) return null;
    if (states.length === 1) {
      const continuous = shownContinuousScales.get(`${states[0].attribute.scope}:${states[0].attribute.name}`);
      if (continuous && Number.isFinite(Number(states[0].value))) return continuous.scale(Number(states[0].value));
      const colorKey = `attribute:${states[0].state}`;
      return legendColorOverrides[colorKey] ?? getCommunityColor(colorKey);
    }
    const colorKey = `attribute-combination:${states.map((item) => item.state).sort().join('|')}`;
    return legendColorOverrides[colorKey] ?? getCommunityColor(colorKey);
  }, [legendColorOverrides, shownContinuousScales]);
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

  const communitiesShown = nodeColorBase === 'louvain' || nodeColorBase === 'community'
    || (edgeColorBase === 'nodeMetric' && edgeColorNodeMetric === 'louvain');
  const communityColor = useCallback((rawId: string | number) =>
    legendColorOverrides[`community:${String(rawId)}`] ?? getCommunityColor(rawId), [legendColorOverrides]);
  const legendCategories = useMemo(() => {
    const stateEntries = new Map<string, { label: string; color: string; colorKey: string; nodes: string[]; nodeIds: string[]; edgeIds: string[] }>();
    const addStateEntry = (key: string, label: string, color: string, colorKey: string, node?: RawNode, edgeId?: string) => {
      const current = stateEntries.get(key) || { label, color, colorKey, nodes: [], nodeIds: [], edgeIds: [] };
      if (node) {
        current.nodes.push(String(node.label || node.name || node.id));
        current.nodeIds.push(String(node.id));
      }
      if (edgeId) current.edgeIds.push(edgeId);
      stateEntries.set(key, current);
    };
    nodes.forEach((node) => {
      const states = shownNodeStateMap.get(String(node.id)) || [];
      if (!states.length) return;
      states.filter((state) => state.attribute.selectedType !== 'continuous').forEach((state) => {
        const colorKey = `attribute:${state.state}`;
        addStateEntry(colorKey, state.label, overlayColor([state])!, colorKey, node);
      });
      if (states.length > 1) {
        const stateKey = states.map((item) => item.state).sort().join('|');
        const colorKey = `attribute-combination:${stateKey}`;
        addStateEntry(colorKey, states.map((item) => item.label).sort().join(' + '), overlayColor(states)!, colorKey, node);
      }
    });
    edges.forEach((edge) => {
      const states = shownEdgeStateMap.get(String(edge.key ?? `${edge.source}->${edge.target}`)) || [];
      if (!states.length) return;
      if (states.length === 1 && states[0].attribute.selectedType === 'continuous') return;
      const stateKey = states.map((item) => item.state).sort().join('|');
      const key = `edge:${stateKey}`;
      const label = `${states.length === 1 ? states[0].label : states.map((item) => item.attribute.name).sort().join(' + ')} (Edge)`;
      const colorKey = states.length === 1 ? `attribute:${states[0].state}` : `attribute-combination:${stateKey}`;
      addStateEntry(key, label, overlayColor(states)!, colorKey, undefined, String(edge.key ?? `${edge.source}->${edge.target}`));
    });
    const sections = [];
    if (stateEntries.size > 0) {
      const items = Array.from(stateEntries.entries()).map(([key, entry]) => ({ label: entry.label, id: `attribute:${key}`, color: entry.color, colorKey: entry.colorKey, nodes: entry.nodes, nodeIds: entry.nodeIds, edgeIds: entry.edgeIds, allIds: [] as string[] }));
      const allIds = items.map((item) => item.id);
      items.forEach((item) => { item.allIds = allIds; });
      sections.push({ title: 'Custom Attributes', items });
    }
    if (
      communitiesShown &&
      Object.keys(communityDisplay.rawToDisplayMap).length > 0
    ) {
      const sortedDispIndices = Object.values(communityDisplay.rawToDisplayMap).sort((a, b) => a - b);
      sections.push({
        title: edgeColorBase === 'nodeMetric' && edgeColorNodeMetric === 'louvain'
          ? `Communities · Edge color from ${edgeColorNodeTarget} node`
          : 'Communities',
        items: sortedDispIndices.map((dispIdx) => {
          const rawId = communityDisplay.displayToRawMap[dispIdx];
          const color = communityColor(rawId);
          const memberNodes = nodes
            .filter((n) => displayMap[n.id] === dispIdx)
            .map((n) => n.label || n.name || n.id);

          return {
            label: `Community ${dispIdx}`,
            id: `community:${dispIdx}`,
            color,
            colorKey: `community:${rawId}`,
            nodes: memberNodes,
            nodeIds: nodes.filter((n) => displayMap[n.id] === dispIdx).map((n) => String(n.id)),
            edgeIds: [] as string[],
            allIds: sortedDispIndices.map((i) => `community:${i}`),
          };
        }),
      });
    } else if ((nodeColorBase === 'type' || (edgeColorBase === 'nodeMetric' && edgeColorNodeMetric === 'type')) && typeLabels.length > 0) {
      sections.push({
        title: edgeColorBase === 'nodeMetric' && edgeColorNodeMetric === 'type'
          ? `Types · Edge color from ${edgeColorNodeTarget} node`
          : 'Types',
        items: typeLabels.map((label) => ({
          label,
          id: `type:${label}`,
          color: typeColorScale(label),
          nodes: nodes.filter((n) => n.type === label).map((n) => n.label || n.name || n.id),
          nodeIds: nodes.filter((n) => n.type === label).map((n) => String(n.id)),
          edgeIds: [] as string[],
          allIds: typeLabels.map((t) => `type:${t}`),
        })),
      });
    }
    if (edgeColorBase === 'nodeMetric' && edgeColorNodeMetric.startsWith('custom:')) {
      const attribute = edgeColorNodeMetric.slice('custom:'.length);
      const metadata = customAttributes.find((item) => item.scope === 'node' && item.name === attribute);
      const values = Array.from(new Set(nodes.map((node) => node[attribute]).filter((value) => value !== undefined && value !== null && String(value).trim() !== '').map(String)));
      const allNumeric = values.length > 0 && values.every((value) => Number.isFinite(Number(value)));
      if (values.length && !allNumeric && metadata?.selectedType !== 'continuous') {
        sections.push({
          title: `Edge Color · ${attribute} (${edgeColorNodeTarget} node)`,
          items: values.map((value) => {
            const colorKey = `attribute:${attribute}=${value}`;
            return {
              label: value,
              id: `attribute:edge-node:${attribute}:${value}`,
              color: legendColorOverrides[colorKey] ?? getCommunityColor(colorKey),
              nodeIds: nodes.filter((node) => String(node[attribute]) === value).map((node) => String(node.id)),
              edgeIds: [] as string[],
              allIds: values.map((item) => `attribute:edge-node:${attribute}:${item}`),
            };
          }),
        });
      }
    }
    const addSelectedAttributeCategory = (scope: 'node' | 'edge', attribute: string, title: string) => {
      const entities = scope === 'node' ? nodes : edges;
      const metadata = customAttributes.find((item) => item.scope === scope && item.name === attribute);
      const values = Array.from(new Set(entities.map((entity) => entity[attribute]).filter((value) => value !== undefined && value !== null && String(value).trim() !== '').map(String)));
      const allNumeric = values.length > 0 && values.every((value) => Number.isFinite(Number(value)));
      if (!values.length || allNumeric || metadata?.selectedType === 'continuous') return;
      sections.push({
        title,
        items: values.map((value) => {
          const colorKey = `attribute:${attribute}=${value}`;
          return {
            label: value,
            id: `attribute:selected-${scope}:${attribute}:${value}`,
            color: legendColorOverrides[colorKey] ?? getCommunityColor(colorKey),
            nodeIds: scope === 'node' ? nodes.filter((node) => String(node[attribute]) === value).map((node) => String(node.id)) : [],
            edgeIds: scope === 'edge' ? edges.filter((edge) => String(edge[attribute]) === value).map((edge) => String(edge.key ?? `${edge.source}->${edge.target}`)) : [],
            allIds: values.map((item) => `attribute:selected-${scope}:${attribute}:${item}`),
          };
        }),
      });
    };
    const selectedNodeAttributeShown = shownNodeAttributes.some((attribute) => attribute.name === customNodeAttribute);
    if (nodeColorBase === 'custom' && customNodeAttribute && !selectedNodeAttributeShown) {
      addSelectedAttributeCategory('node', customNodeAttribute, `Node Color · ${customNodeAttribute}`);
    }
    if (edgeColorBase.startsWith('edge:')) {
      const attribute = edgeColorBase.slice('edge:'.length);
      if (!shownEdgeAttributes.some((item) => item.name === attribute)) addSelectedAttributeCategory('edge', attribute, `Edge Color · ${attribute}`);
    }
    return sections;
  }, [
    nodeColorBase,
    communityDisplay,
    displayMap,
    nodes,
    typeLabels,
    typeColorScale,
    edges,
    overlayColor,
    shownEdgeStateMap,
    shownNodeStateMap,
    communitiesShown,
    communityColor,
    edgeColorBase,
    edgeColorNodeMetric,
    edgeColorNodeTarget,
    customAttributes,
    legendColorOverrides,
    customNodeAttribute,
    shownNodeAttributes,
    shownEdgeAttributes,
  ]);
  const legendNodeMembership = useMemo(() => new Map(legendCategories.flatMap((category) => category.items.map((item) => [item.id, new Set(item.nodeIds || [])] as const))), [legendCategories]);
  const legendEdgeMembership = useMemo(() => new Map(legendCategories.flatMap((category) => category.items.map((item) => [item.id, new Set(item.edgeIds || [])] as const))), [legendCategories]);

  const getNodeColor = useCallback(
    (d: any) => {
      const shownStates = shownNodeStateMap.get(String(d.id)) || [];
      if (shownStates.length) {
        const shownColor = overlayColor(shownStates);
        if (shownColor) return shownColor;
      }
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
        if (nodeColorBase === 'custom' && customNodeAttribute) {
          if (customIsNumeric) {
            const value = Number(d[customNodeAttribute]);
            if (Number.isFinite(value)) return customNumericColorScale(value);
          } else {
            const value = d[customNodeAttribute];
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
      overlayColor,
      shownNodeStateMap,
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
      const edgeIdentity = String(d.key ?? `${typeof d.source === 'object' ? d.source.id : d.source}->${typeof d.target === 'object' ? d.target.id : d.target}`);
      const directStates = effectiveStates(attributeStates(d, shownEdgeAttributes));
      const shownColor = overlayColor(shownEdgeStateMap.get(edgeIdentity) || directStates);
      if (shownColor) return shownColor;
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
        const rawValue = d[attribute];
        if (rawValue !== undefined && rawValue !== null && String(rawValue).trim() !== '') {
          const colorKey = `attribute:${attribute}=${String(rawValue)}`;
          return legendColorOverrides[colorKey] ?? getCommunityColor(colorKey);
        }
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
      attributeStates,
      effectiveStates,
      overlayColor,
      shownEdgeAttributes,
      shownEdgeStateMap,
      legendColorOverrides,
      communityColor,
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

  const degreeByNode = useMemo(() => {
    const result = new Map<string, number>();
    edges.forEach((edge) => {
      result.set(String(edge.source), (result.get(String(edge.source)) || 0) + 1);
      result.set(String(edge.target), (result.get(String(edge.target)) || 0) + 1);
    });
    return result;
  }, [edges]);
  const legendMetricScales = useMemo(() => {
    const result: LegendMetricScale[] = [];
    const addNumeric = (title: string, visual: LegendMetricScale['visual'], values: number[], scale?: (value: number) => string, description?: string) => {
      const extent = numericExtent(values);
      if (!extent) return;
      const [min, rawMax] = extent;
      const max = rawMax === min ? min + 1 : rawMax;
      result.push({ title, description, visual, min, max, ticks: [min, (min + max) / 2, max], scale });
    };

    if (legendMetricScale) result.push({ ...legendMetricScale, title: `Node color · ${legendMetricScale.title}`, visual: 'color' });

    if (nodeSizeBase !== 'uniform') {
      const selectedName = nodeSizeBase === 'custom' ? customNodeAttribute : nodeSizeBase;
      const values = nodes.map((node) => {
        if (nodeSizeBase === 'custom') return Number(customNodeAttribute ? node[customNodeAttribute] : Number.NaN);
        if (nodeSizeBase === 'abundance') return Number(node.abundance);
        if (nodeSizeBase === 'degree') return degreeByNode.get(String(node.id)) ?? 0;
        return Number(netMap.get(String(node.id))?.[nodeSizeBase] ?? node[nodeSizeBase]);
      });
      addNumeric(`Node size · ${metricLabel(selectedName || 'custom')}`, 'size', values, undefined, 'Larger circles represent larger values.');
    }

    if (edgeColorBase === 'weight_raw') addNumeric('Edge color · Raw / absolute weight', 'color', edges.map((edge) => Number(edge.weight_raw)), rawColorScale);
    else if (edgeColorBase === 'weight_secondary') addNumeric('Edge color · Secondary / transformed weight', 'color', edges.map((edge) => Number(edge.weight_secondary)), secColorScale);
    else if (edgeColorBase.startsWith('edge:')) {
      const attribute = edgeColorBase.slice('edge:'.length);
      const values = edges.map((edge) => Number(edge[attribute]));
      if (values.some(Number.isFinite) && values.filter(Number.isFinite).length === edges.filter((edge) => edge[attribute] !== undefined && edge[attribute] !== null && String(edge[attribute]).trim() !== '').length) {
        addNumeric(`Edge color · ${attribute}`, 'color', values, customEdgeColorScales.get(attribute));
      }
    } else if (edgeColorBase === 'nodeMetric' && edgeColorNodeMetric) {
      const endpoint = edgeColorNodeTarget === 'source' ? 'Source node' : 'Target node';
      const rawMetric = edgeColorNodeMetric.startsWith('custom:') ? edgeColorNodeMetric.slice('custom:'.length) : edgeColorNodeMetric;
      const values = nodes.map((node) => getNodeMetricValue(String(node.id), edgeColorNodeMetric) ?? Number.NaN);
      if (values.some(Number.isFinite)) addNumeric(`Edge color · ${metricLabel(rawMetric)}`, 'color', values, nodeMetricColorScale, endpoint);
      else result.push({ title: `Edge color · ${metricLabel(rawMetric)}`, description: endpoint, visual: 'color', min: 0, max: 1, ticks: [] });
    }

    if (edgeWeightBase !== 'uniform') {
      const edgeWeightValue = (edge: RawEdge) => {
        if (edgeWeightBase === 'weight_raw') return Number(edge.weight_raw);
        if (edgeWeightBase === 'weight_secondary') return Number(edge.weight_secondary);
        if (edgeWeightBase.startsWith('edge:')) return Number(edge[edgeWeightBase.slice('edge:'.length)]);
        const prefix = edgeWeightBase.startsWith('metric:') ? 'metric:' : edgeWeightBase.startsWith('node:') ? 'node:' : '';
        if (!prefix) return Number.NaN;
        const metric = edgeWeightBase.slice(prefix.length);
        const valueFor = (nodeId: string) => {
          if (metric === 'degree') return degreeByNode.get(nodeId) ?? 0;
          const node = nodeById.get(nodeId);
          return Number(netMap.get(nodeId)?.[metric] ?? node?.[metric]);
        };
        const source = valueFor(String(edge.source));
        const target = valueFor(String(edge.target));
        return Number.isFinite(source) && Number.isFinite(target) ? (source + target) / 2 : Number.isFinite(source) ? source : target;
      };
      const rawMetric = edgeWeightBase.replace(/^(edge:|node:|metric:)/, '');
      const description = edgeWeightBase.startsWith('node:') || edgeWeightBase.startsWith('metric:') ? 'Mean of source and target nodes' : 'Thicker lines represent larger values.';
      addNumeric(`Edge weight · ${edgeWeightBase === 'weight_raw' ? 'Raw / absolute weight' : edgeWeightBase === 'weight_secondary' ? 'Secondary / transformed weight' : metricLabel(rawMetric)}`, 'width', edges.map(edgeWeightValue), undefined, description);
    }

    Array.from(shownContinuousScales.entries()).forEach(([key, entry]) => {
      const scope = key.startsWith('edge:') ? 'Edge' : 'Node';
      const title = `${scope} color · ${key.slice(key.indexOf(':') + 1)}`;
      result.push({
        title,
        visual: 'color',
        min: entry.min,
        max: entry.max,
        ticks: [entry.min, (entry.min + entry.max) / 2, entry.max],
        scale: entry.scale,
        colorKeys: { min: `scale:${key}:min`, max: `scale:${key}:max` },
        colors: { min: legendColorOverrides[`scale:${key}:min`] || '#440154', max: legendColorOverrides[`scale:${key}:max`] || '#fde725' },
      });
    });
    return Array.from(new Map(result.map((entry) => [`${entry.visual}:${entry.title}`, entry])).values());
  }, [customEdgeColorScales, customNodeAttribute, degreeByNode, edgeColorBase, edgeColorNodeMetric, edgeColorNodeTarget, edgeWeightBase, edges, getNodeMetricValue, legendColorOverrides, legendMetricScale, netMap, nodeById, nodeMetricColorScale, nodeSizeBase, nodes, rawColorScale, secColorScale, shownContinuousScales]);

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
