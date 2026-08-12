'use client';

import React, { useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { RawNode, RawEdge } from '@/store/useStore';
import { getCommunityDisplayMap, getCommunityColor } from '@/lib/communityUtils';
import { ElementLegendItem } from '@/components/graph/GraphLegend';
import { useStore } from '@/store/useStore';

export interface LegendMetricScale {
  title: string;
  min: number;
  max: number;
  ticks: number[];
  scale: (val: number) => string;
}

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
  const customNumericDomain = useMemo(() => {
    if (!customIsNumeric || !customNodeAttribute) return [0, 1] as [number, number];
    const values = nodes.map((node) => Number(node[customNodeAttribute])).filter(Number.isFinite);
    if (!values.length) return [0, 1] as [number, number];
    const min = Math.min(...values);
    const max = Math.max(...values);
    return [min, max === min ? min + 1 : max] as [number, number];
  }, [customIsNumeric, customNodeAttribute, nodes]);
  const customNumericColorScale = useMemo(
    () => d3.scaleSequential(d3.interpolateViridis).domain(customNumericDomain),
    [customNumericDomain],
  );
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

  const elementLegendItems: ElementLegendItem[] = useMemo(
    () => [
      {
        id: 'element:standard',
        label: 'Standard Nodes',
        Icon: () => (
          <div
            className={`w-3 h-3 rounded-full border ${
              isDarkMode ? 'border-[#E4E3E0] bg-transparent' : 'border-[#141414] bg-transparent'
            }`}
          />
        ),
      },
      ...(bipartite
        ? [
            {
              id: 'element:bipartite',
              label: 'Bipartite Nodes',
              Icon: () => (
                <div
                  className={`w-3 h-3 border ${
                    isDarkMode
                      ? 'border-[#E4E3E0] bg-transparent'
                      : 'border-[#141414] bg-transparent'
                  }`}
                />
              ),
            },
          ]
        : []),
      {
        id: 'element:edges',
        label: directed ? 'Directed Edges' : 'Undirected Edges',
        Icon: () => (
          <div className="w-3 relative flex items-center justify-center">
            <div className={`w-full h-[1px] ${isDarkMode ? 'bg-[#bbb]' : 'bg-[#141414]'}`} />
            {directed && (
              <div
                className={`absolute right-0 translate-x-[2px] w-0 h-0 border-y-[3px] border-y-transparent border-l-[4px] ${
                  isDarkMode ? 'border-l-[#bbb]' : 'border-l-[#141414]'
                } opacity-80`}
              />
            )}
          </div>
        ),
      },
    ],
    [bipartite, directed, isDarkMode]
  );

  const elementLegendIds = useMemo(() => elementLegendItems.map((item) => item.id), [
    elementLegendItems,
  ]);

  // Continuous Color Metric Domains and Scales
  const maxEigen = useMemo(
    () => d3.max(networkMetrics, (d: any) => parseFloat(d.eigenvector)) || 1,
    [networkMetrics]
  );
  const minEigen = useMemo(
    () => d3.min(networkMetrics, (d: any) => parseFloat(d.eigenvector)) || 0,
    [networkMetrics]
  );
  const maxPageRank = useMemo(
    () => d3.max(networkMetrics, (d: any) => parseFloat(d.pagerank)) || 1,
    [networkMetrics]
  );
  const minPageRank = useMemo(
    () => d3.min(networkMetrics, (d: any) => parseFloat(d.pagerank)) || 0,
    [networkMetrics]
  );
  const maxBetweenness = useMemo(
    () => d3.max(networkMetrics, (d: any) => parseFloat(d.betweenness)) || 1,
    [networkMetrics]
  );
  const maxCloseness = useMemo(
    () => d3.max(networkMetrics, (d: any) => parseFloat(d.closeness)) || 1,
    [networkMetrics]
  );
  const maxClustering = useMemo(
    () => d3.max(networkMetrics, (d: any) => parseFloat(d.clustering)) || 1,
    [networkMetrics]
  );
  const maxDegreeCent = useMemo(
    () =>
      d3.max(networkMetrics, (d: any) =>
        parseFloat(d.degreeCentrality || d.inDegreeCentrality || d.degree || 0)
      ) || 1,
    [networkMetrics]
  );
  const maxAbundance = useMemo(
    () => d3.max(nodes, (d: any) => parseFloat(d.abundance || 0)) || 1,
    [nodes]
  );
  const minAbundance = useMemo(
    () => d3.min(nodes, (d: any) => parseFloat(d.abundance || 0)) || 0,
    [nodes]
  );

  const eigenColorScale = useMemo(
    () => d3.scaleSequential(d3.interpolatePurples).domain([minEigen, maxEigen]),
    [minEigen, maxEigen]
  );
  const prColorScale = useMemo(
    () => d3.scaleSequential(d3.interpolateGreens).domain([minPageRank, maxPageRank]),
    [minPageRank, maxPageRank]
  );
  const betweennessColorScale = useMemo(
    () => d3.scaleSequential(d3.interpolateOranges).domain([0, maxBetweenness]),
    [maxBetweenness]
  );
  const closenessColorScale = useMemo(
    () => d3.scaleSequential(d3.interpolateBlues).domain([0, maxCloseness]),
    [maxCloseness]
  );
  const clusteringColorScale = useMemo(
    () => d3.scaleSequential(d3.interpolateReds).domain([0, maxClustering]),
    [maxClustering]
  );
  const degreeCentColorScale = useMemo(
    () => d3.scaleSequential(d3.interpolateYlOrBr).domain([0, maxDegreeCent]),
    [maxDegreeCent]
  );
  const abundanceColorScale = useMemo(
    () => d3.scaleSequential(d3.interpolateViridis).domain([minAbundance, maxAbundance]),
    [minAbundance, maxAbundance]
  );

  const legendMetricScale: LegendMetricScale | null = useMemo(() => {
    if (nodeColorBase === 'custom' && customNodeAttribute && customIsNumeric) {
      const [min, max] = customNumericDomain;
      return {
        title: customNodeAttribute,
        min,
        max,
        ticks: [min, (min + max) / 2, max],
        scale: customNumericColorScale,
      };
    }
    if (nodeColorBase === 'abundance') {
      return {
        title: 'Abundance',
        min: minAbundance,
        max: maxAbundance,
        ticks: [minAbundance, (minAbundance + maxAbundance) / 2, maxAbundance],
        scale: abundanceColorScale,
      };
    }
    if (nodeColorBase === 'eigenvector') {
      return {
        title: 'Eigenvector Centrality',
        min: minEigen,
        max: maxEigen,
        ticks: [minEigen, (minEigen + maxEigen) / 2, maxEigen],
        scale: eigenColorScale,
      };
    }
    if (nodeColorBase === 'pagerank') {
      return {
        title: 'PageRank',
        min: minPageRank,
        max: maxPageRank,
        ticks: [minPageRank, (minPageRank + maxPageRank) / 2, maxPageRank],
        scale: prColorScale,
      };
    }
    if (nodeColorBase === 'betweenness') {
      return {
        title: 'Betweenness Centrality',
        min: 0,
        max: maxBetweenness,
        ticks: [0, maxBetweenness / 2, maxBetweenness],
        scale: betweennessColorScale,
      };
    }
    if (nodeColorBase === 'closeness') {
      return {
        title: 'Closeness Centrality',
        min: 0,
        max: maxCloseness,
        ticks: [0, maxCloseness / 2, maxCloseness],
        scale: closenessColorScale,
      };
    }
    if (nodeColorBase === 'clustering') {
      return {
        title: 'Clustering Coefficient',
        min: 0,
        max: maxClustering,
        ticks: [0, maxClustering / 2, maxClustering],
        scale: clusteringColorScale,
      };
    }
    if (nodeColorBase === 'degreeCentrality' || nodeColorBase === 'degree') {
      return {
        title: 'Degree Centrality',
        min: 0,
        max: maxDegreeCent,
        ticks: [0, maxDegreeCent / 2, maxDegreeCent],
        scale: degreeCentColorScale,
      };
    }
    if (nodeColorBase === 'inDegreeCentrality') {
      return {
        title: 'In-Degree Centrality',
        min: 0,
        max: maxDegreeCent,
        ticks: [0, maxDegreeCent / 2, maxDegreeCent],
        scale: degreeCentColorScale,
      };
    }
    if (nodeColorBase === 'outDegreeCentrality') {
      return {
        title: 'Out-Degree Centrality',
        min: 0,
        max: maxDegreeCent,
        ticks: [0, maxDegreeCent / 2, maxDegreeCent],
        scale: degreeCentColorScale,
      };
    }
    return null;
  }, [
    nodeColorBase,
    customNodeAttribute,
    customIsNumeric,
    customNumericDomain,
    customNumericColorScale,
    minAbundance,
    maxAbundance,
    abundanceColorScale,
    minEigen,
    maxEigen,
    eigenColorScale,
    minPageRank,
    maxPageRank,
    prColorScale,
    maxBetweenness,
    betweennessColorScale,
    maxCloseness,
    closenessColorScale,
    maxClustering,
    clusteringColorScale,
    maxDegreeCent,
    degreeCentColorScale,
  ]);

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

  const getEdgeColor = useCallback(
    (d: any) => {
      if (edgeColorBase === 'nodeMetric' && edgeColorNodeMetric) {
        const targetId =
          edgeColorNodeTarget === 'source' ? d.source.id || d.source : d.target.id || d.target;
        const net = netMap.get(targetId);
        const mBase = edgeColorNodeMetric;
        const defaultColor = isDarkMode ? '#eeeeee' : '#141414';
        if (
          mBase === 'custom' ||
          mBase === 'community' ||
          mBase === 'louvain'
        ) {
          const dispIdx = displayMap[targetId] ?? -1;
          return getCommunityColor(communityDisplay.displayToRawMap[dispIdx]);
        }
        if (mBase === 'type') {
          const t = nodes.find((n) => n.id === targetId)?.type;
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
      nodes,
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
      }
      return Math.max(0, Math.min(1, alpha));
    },
    [edgeOpacityBase, maxRaw, maxSec, edgeOpacity]
  );

  return {
    customColorMap,
    communityColorMap,
    communityDisplay,
    netMap,
    maxRaw,
    maxSec,
    getShouldShowArrowhead,
    elementLegendItems,
    elementLegendIds,
    legendCategories,
    legendMetricScale,
    getNodeColor,
    getEdgeColor,
    getEdgeOpacity,
  };
}
