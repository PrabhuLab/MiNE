'use client';

import React, { useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { RawNode, RawEdge } from '@/store/useStore';
import { COMMUNITY_COLORS } from '@/lib/communityUtils';
import { ElementLegendItem } from '@/components/graph/GraphLegend';

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
  showArrowheads,
  isolatedLegendItem,
  clickedNodeRef,
  clickedEdgeRef,
}: UseGraphStylesProps) {
  const customLabels = useMemo(
    () =>
      Array.from(new Set(Object.values(communityMap || {}).filter(Boolean))).sort((a, b) =>
        String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
      ),
    [communityMap]
  );

  const louvainLabels = useMemo(
    () =>
      Array.from(new Set((networkMetrics || []).map((m) => m.louvain).filter(Boolean))).sort(
        (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
      ),
    [networkMetrics]
  );

  const customColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    customLabels.forEach((label, i) => {
      map[label] = COMMUNITY_COLORS[i % COMMUNITY_COLORS.length] || COMMUNITY_COLORS[0];
    });
    return map;
  }, [customLabels]);

  const louvainColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    louvainLabels.forEach((label, i) => {
      map[label] = COMMUNITY_COLORS[i % COMMUNITY_COLORS.length] || COMMUNITY_COLORS[0];
    });
    return map;
  }, [louvainLabels]);

  const communityLabels = useMemo(() => {
    if (nodeColorBase === 'louvain') return louvainLabels;
    return customLabels;
  }, [nodeColorBase, customLabels, louvainLabels]);

  const communityColorMap = useMemo(() => {
    if (nodeColorBase === 'louvain') return louvainColorMap;
    return customColorMap;
  }, [nodeColorBase, customColorMap, louvainColorMap]);

  const communityLegendIds = useMemo(
    () => communityLabels.map((c) => `community:${c}`),
    [communityLabels]
  );

  const typeLabels = useMemo(() => {
    return Array.from(new Set(nodes.map((n) => n.type).filter(Boolean))) as string[];
  }, [nodes]);

  const typeColorScale = useMemo(() => d3.scaleOrdinal(d3.schemeCategory10), []);

  const netMap = useMemo(
    () => new Map((networkMetrics || []).map((m: any) => [m.id, m])),
    [networkMetrics]
  );

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

      if (isolatedLegendItem && isolatedLegendItem.startsWith('community:')) {
        const commVal = isolatedLegendItem.split('community:')[1];

        const getNodeComm = (nodeId: string) => {
          const net = netMap.get(nodeId);
          if (nodeColorBase === 'louvain') return net?.louvain;
          if (nodeColorBase === 'infomap') return net?.infomap;
          if (nodeColorBase === 'fast_greedy') return net?.fast_greedy;
          if (nodeColorBase === 'label_propagation') return net?.label_propagation;
          if (nodeColorBase === 'walktrap') return net?.walktrap;
          if (nodeColorBase === 'eigenvector') return net?.eigenvector;
          if (nodeColorBase === 'spinglass') return net?.spinglass;
          return communityMap[nodeId] ?? net?.community ?? net?.louvain;
        };

        const srcComm = getNodeComm(srcId);
        const tgtComm = getNodeComm(tgtId);

        if (String(srcComm) === String(commVal) || String(tgtComm) === String(commVal)) {
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
      isolatedLegendItem,
      netMap,
      nodeColorBase,
      communityMap,
      searchQuery,
      clickedNodeRef,
      clickedEdgeRef,
    ]
  );

  const elementLegendItems: ElementLegendItem[] = useMemo(
    () => [
      {
        id: 'element:standard',
        label: 'Standard Node',
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
              label: 'Bipartite Node',
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
        label: directed ? 'Directed Edge' : 'Undirected Edge',
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

  const legendCategories = useMemo(() => {
    if (
      (nodeColorBase === 'custom' || nodeColorBase === 'louvain') &&
      communityLabels.length > 0
    ) {
      return {
        title:
          nodeColorBase === 'custom'
            ? 'Custom Communities'
            : 'Louvain Communities',
        items: communityLabels.map((label) => ({
          label,
          id: `community:${label}`,
          color: communityColorMap[label],
          nodes: nodes
            .filter((n) => {
              if (nodeColorBase === 'custom') return communityMap[n.id] === label;
              const net = netMap.get(n.id);
              return net && net[nodeColorBase] === label;
            })
            .map((n) => n.label || n.name || n.id),
          allIds: communityLegendIds,
        })),
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
    communityLabels,
    communityColorMap,
    communityMap,
    typeLabels,
    typeColorScale,
    nodes,
    communityLegendIds,
    netMap,
  ]);

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
        parseFloat(d.degreeCentrality || d.inDegreeCentrality || 0)
      ) || 1,
    [networkMetrics]
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
      if (nodeColorBase === 'custom')
        return customColorMap[communityMap[d.id] ?? d.community] || defaultNodeColor;
      if (nodeColorBase === 'louvain' && net?.louvain)
        return louvainColorMap[net.louvain] || defaultNodeColor;
      if (nodeColorBase === 'type' && d.type) return typeColorScale(d.type);
      if (nodeColorBase === 'eigenvector' && net?.eigenvector !== undefined)
        return eigenColorScale(parseFloat(net.eigenvector));
      if (nodeColorBase === 'pagerank' && net?.pagerank !== undefined)
        return prColorScale(parseFloat(net.pagerank));
      if (nodeColorBase === 'betweenness' && net?.betweenness !== undefined)
        return betweennessColorScale(parseFloat(net.betweenness));
      if (nodeColorBase === 'closeness' && net?.closeness !== undefined)
        return closenessColorScale(parseFloat(net.closeness));
      if (nodeColorBase === 'clustering' && net?.clustering !== undefined)
        return clusteringColorScale(parseFloat(net.clustering));
      if (nodeColorBase === 'degreeCentrality' && net?.degreeCentrality !== undefined)
        return degreeCentColorScale(parseFloat(net.degreeCentrality));
      if (nodeColorBase === 'inDegreeCentrality' && net?.inDegreeCentrality !== undefined)
        return degreeCentColorScale(parseFloat(net.inDegreeCentrality));
      if (nodeColorBase === 'outDegreeCentrality' && net?.outDegreeCentrality !== undefined)
        return degreeCentColorScale(parseFloat(net.outDegreeCentrality));
      return defaultNodeColor;
    },
    [
      isDarkMode,
      nodeColorBase,
      uniformNodeColor,
      customColorMap,
      louvainColorMap,
      communityMap,
      typeColorScale,
      eigenColorScale,
      prColorScale,
      betweennessColorScale,
      closenessColorScale,
      clusteringColorScale,
      degreeCentColorScale,
      netMap,
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
        if (mBase === 'custom') return customColorMap[communityMap[targetId]] || defaultColor;
        if (mBase === 'louvain' && net?.louvain) return louvainColorMap[net.louvain] || defaultColor;
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
        if (mBase === 'inDegreeCentrality' && net?.inDegreeCentrality !== undefined)
          return degreeCentColorScale(parseFloat(net.inDegreeCentrality));
        if (mBase === 'outDegreeCentrality' && net?.outDegreeCentrality !== undefined)
          return degreeCentColorScale(parseFloat(net.outDegreeCentrality));
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
            uniformEdgeColor === '#fff'
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
      customColorMap,
      louvainColorMap,
      communityMap,
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
    ]
  );

  const getEdgeOpacity = useCallback(
    (d: any) => {
      if (edgeOpacityBase === 'weight_raw' && d.weight_raw !== undefined)
        return 0.1 + 0.9 * (Number(d.weight_raw) / maxRaw);
      if (edgeOpacityBase === 'weight_secondary' && d.weight_secondary !== undefined)
        return 0.1 + 0.9 * (Number(d.weight_secondary) / maxSec);
      return edgeOpacity;
    },
    [edgeOpacityBase, maxRaw, maxSec, edgeOpacity]
  );

  return {
    customColorMap,
    communityColorMap,
    netMap,
    maxRaw,
    maxSec,
    getShouldShowArrowhead,
    elementLegendItems,
    elementLegendIds,
    legendCategories,
    getNodeColor,
    getEdgeColor,
    getEdgeOpacity,
  };
}
