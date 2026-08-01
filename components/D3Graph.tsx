'use client';

/* eslint-disable react-hooks/preserve-manual-memoization, react-hooks/exhaustive-deps */

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { useStore, RawNode, RawEdge } from '@/store/useStore';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { COMMUNITY_COLORS, getCommunityColor } from '@/lib/communityUtils';

interface D3GraphProps {
  nodes: RawNode[];
  edges: RawEdge[];
  communityMap: Record<string, string>;
  networkMetrics?: any[];
  nodeSizeMult: number;
  nodeSizeBase?: string;
  nodeColorBase?: string;
  edgeWeightMult?: number;
  edgeWeightBase?: string;
  edgeColorBase?: string;
  nodeOpacity?: number;
  edgeOpacity?: number;
  edgeOpacityBase?: string;
  forceStrength: number;
  directed: boolean;
  bipartite: boolean;
  livePhysics?: boolean;
    isDarkMode?: boolean;
  refreshKey?: number;
  onRefresh?: () => void;
  onElementDoubleClick?: (id: string, type: "node" | "edge") => void;
  onClearSelection?: () => void;
  searchQuery?: string;
  selectedElement?: string | null;
}

export default function D3Graph({ nodes, edges, communityMap, networkMetrics = [], nodeSizeMult, nodeSizeBase = 'abundance', nodeColorBase = 'custom', uniformNodeColor = '#cccccc', uniformEdgeColor = '#cccccc', edgeWeightMult = 1, edgeWeightBase = 'weight_raw', edgeColorBase = 'uniform', edgeColorNodeMetric = '', edgeColorNodeTarget = 'source', nodeOpacity = 1, edgeOpacity = 0.3, edgeOpacityBase = 'uniform', forceStrength, directed, bipartite, livePhysics, isDarkMode, refreshKey, onRefresh, onElementDoubleClick, onClearSelection, searchQuery = '', selectedElement = null }: D3GraphProps & { uniformNodeColor?: string, uniformEdgeColor?: string, edgeColorNodeMetric?: string, edgeColorNodeTarget?: 'source' | 'target' }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<any, any> | null>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  
  

  const runtimeRef = useRef({ livePhysics });
  const onDoubleClickRef = useRef(onElementDoubleClick);
  useEffect(() => { onDoubleClickRef.current = onElementDoubleClick; }, [onElementDoubleClick]);
  useEffect(() => {
    runtimeRef.current = { livePhysics };
  }, [livePhysics]);

  const [clickedNode, setClickedNode] = useState<RawNode | null>(null);
  const [clickedDegree, setClickedDegree] = useState<number>(0);
  const [clickedEdge, setClickedEdge] = useState<RawEdge | null>(null);
  const [isCalculatingLayout, setIsCalculatingLayout] = useState(false);
  
  const { hiddenLegendItems, setHiddenLegendItems, isolatedLegendItem, setIsolatedLegendItem, showArrowheads, setShowArrowheads, showNodeLabels, setShowNodeLabels } = useStore();
  const hiddenItems = new Set(hiddenLegendItems);
  const setHiddenItems = (updater: (prev: Set<string>) => Set<string>) => {
    setHiddenLegendItems(Array.from(updater(new Set(hiddenLegendItems))));
  };
  const [expandedLegendItems, setExpandedLegendItems] = useState<Set<string>>(new Set());
  const [isLegendMinimized, setIsLegendMinimized] = useState(false);
  
  const clickTimers = useRef<{[key: string]: NodeJS.Timeout}>({});
  const clickCounts = useRef<{[key: string]: number}>({});
  const clickedNodeRef = useRef<RawNode | null>(null);
  const clickedEdgeRef = useRef<RawEdge | null>(null);
  const tickDrawRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    clickedNodeRef.current = clickedNode;
  }, [clickedNode]);

  useEffect(() => {
    clickedEdgeRef.current = clickedEdge;
  }, [clickedEdge]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (selectedElement) {
      if (!selectedElement.includes('-')) {
        const node = nodes.find(n => n.id === selectedElement);
        if (node) {
          setClickedNode(node);
          setClickedEdge(null);
          return;
        }
      } else {
        const parts = selectedElement.split('-');
        if (parts.length >= 2) {
           const src = parts[0];
           const tgt = parts[1];
           const edge = edges.find(e => (e.source === src && e.target === tgt) || (!directed && e.source === tgt && e.target === src));
           if (edge) {
             setClickedEdge(edge);
             setClickedNode(null);
             return;
           }
        }
      }
      setClickedNode(null);
      setClickedEdge(null);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [selectedElement, nodes, edges, directed]);

  
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setHiddenItems(() => new Set<string>());
    setClickedNode(null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [refreshKey]);

  const adjacencyListRef = useRef<Record<string, Set<string>>>({});

  const handleLegendClick = (e: React.MouseEvent, id: string, categoryIds: string[]) => {
    e.stopPropagation();

    clickCounts.current[id] = (clickCounts.current[id] || 0) + 1;

    if (clickTimers.current[id]) {
      clearTimeout(clickTimers.current[id]);
    }

    if (clickCounts.current[id] >= 3) {
      clickCounts.current[id] = 0;
      setIsolatedLegendItem(null);
      setHiddenItems(prev => {
        const next = new Set(prev);
        categoryIds.forEach(cid => next.delete(cid));
        return next;
      });
      handleZoomFit(); // optionally fit all
    } else {
      clickTimers.current[id] = setTimeout(() => {
        const count = clickCounts.current[id];
        clickCounts.current[id] = 0;
        delete clickTimers.current[id];

        if (count === 1) {
          setHiddenItems(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          });
        } else if (count === 2) {
          if (isolatedLegendItem === id) {
            setIsolatedLegendItem(null);
            setHiddenItems(prev => {
              const next = new Set(prev);
              categoryIds.forEach(cid => next.delete(cid));
              return next;
            });
            handleZoomFit();
          } else {
            setIsolatedLegendItem(id);
            setHiddenItems(prev => {
              const next = new Set(prev);
              next.delete(id);
              return next;
            });
            
            if (!svgRef.current || !zoomBehaviorRef.current || !simulationRef.current || !containerRef.current) return;
            const svg = d3.select(svgRef.current);
            const width = containerRef.current.clientWidth;
            const height = containerRef.current.clientHeight;
            
            const graphNodes = simulationRef.current.nodes().filter((d: any) => {
              if (id.startsWith('community:')) {
                 const c = id.split('community:')[1];
                 const net = netMap.get(d.id);
                 let comm;
                 if (nodeColorBase === 'louvain') comm = net?.louvain;
                 else if (nodeColorBase === 'leiden') comm = net?.leiden;
                 else comm = communityMap[d.id] ?? d.community ?? net?.louvain ?? net?.leiden;
                 return String(comm) === String(c);
              }
              if (id.startsWith('type:')) {
                 const t = id.split('type:')[1];
                 return d.type === t;
              }
              if (id === 'element:standard') {
                 return !(bipartite && (d.type === 'B' || d.group === 1));
              }
              if (id === 'element:bipartite') {
                 return bipartite && (d.type === 'B' || d.group === 1);
              }
              return false;
            });
            
            if (graphNodes.length > 0) {
              const minX = d3.min(graphNodes, (d: any) => d.x - (d.currentRadius || 0)) || 0;
              const minY = d3.min(graphNodes, (d: any) => d.y - (d.currentRadius || 0)) || 0;
              const maxX = d3.max(graphNodes, (d: any) => d.x + (d.currentRadius || 0)) || 0;
              const maxY = d3.max(graphNodes, (d: any) => d.y + (d.currentRadius || 0)) || 0;

              const dx = maxX - minX;
              const dy = maxY - minY;
              const x = (minX + maxX) / 2;
              const y = (minY + maxY) / 2;
              
              if (dx > 0 && dy > 0) {
                const scale = Math.max(0.1, Math.min(4, 0.9 / Math.max(dx / width, dy / height)));
                const translate = [width / 2 - scale * x, height / 2 - scale * y];
                svg.transition().duration(750).call(
                  zoomBehaviorRef.current.transform, 
                  d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
                );
              }
            }
          }
        }
      }, 300);
    }
  };

  const elementLegendItems = [
    { id: 'element:standard', label: 'Standard Node', Icon: () => <div className={`w-3 h-3 rounded-full border ${isDarkMode ? 'border-[#E4E3E0] bg-transparent' : 'border-[#141414] bg-transparent'}`}></div> },
    ...(bipartite ? [{ id: 'element:bipartite', label: 'Bipartite Node', Icon: () => <div className={`w-3 h-3 border ${isDarkMode ? 'border-[#E4E3E0] bg-transparent' : 'border-[#141414] bg-transparent'}`}></div> }] : []),
    { id: 'element:edges', label: directed ? 'Directed Edge' : 'Undirected Edge', Icon: () => (
      <div className="w-3 relative flex items-center justify-center">
        <div className={`w-full h-[1px] ${isDarkMode ? 'bg-[#bbb]' : 'bg-[#141414]'}`}></div>
        {directed && <div className={`absolute right-0 translate-x-[2px] w-0 h-0 border-y-[3px] border-y-transparent border-l-[4px] ${isDarkMode ? 'border-l-[#bbb]' : 'border-l-[#141414]'} opacity-80`}></div>}
      </div>
    )}
  ];
  const elementLegendIds = elementLegendItems.map(item => item.id);
    const customLabels = useMemo(() => Array.from(new Set(Object.values(communityMap || {}).filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })), [communityMap]);
  const louvainLabels = useMemo(() => Array.from(new Set((networkMetrics || []).map(m => m.louvain).filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })), [networkMetrics]);
  const leidenLabels = useMemo(() => Array.from(new Set((networkMetrics || []).map(m => m.leiden).filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })), [networkMetrics]);

  const customColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    customLabels.forEach((label, i) => { map[label] = COMMUNITY_COLORS[i % COMMUNITY_COLORS.length] || COMMUNITY_COLORS[0]; });
    return map;
  }, [customLabels]);
  const louvainColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    louvainLabels.forEach((label, i) => { map[label] = COMMUNITY_COLORS[i % COMMUNITY_COLORS.length] || COMMUNITY_COLORS[0]; });
    return map;
  }, [louvainLabels]);
  const leidenColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    leidenLabels.forEach((label, i) => { map[label] = COMMUNITY_COLORS[i % COMMUNITY_COLORS.length] || COMMUNITY_COLORS[0]; });
    return map;
  }, [leidenLabels]);

  const communityLabels = useMemo(() => {
    if (nodeColorBase === 'louvain') return louvainLabels;
    if (nodeColorBase === 'leiden') return leidenLabels;
    return customLabels;
  }, [nodeColorBase, customLabels, louvainLabels, leidenLabels]);

  const communityColorMap = useMemo(() => {
    if (nodeColorBase === 'louvain') return louvainColorMap;
    if (nodeColorBase === 'leiden') return leidenColorMap;
    return customColorMap;
  }, [nodeColorBase, customColorMap, louvainColorMap, leidenColorMap]);
  const communityLegendIds = communityLabels.map(c => `community:${c}`);

  const typeLabels = useMemo(() => {
    return Array.from(new Set(nodes.map(n => n.type).filter(Boolean))) as string[];
  }, [nodes]);

  const typeColorScale = useMemo(() => d3.scaleOrdinal(d3.schemeCategory10), []);

  const netMap = useMemo(() => new Map((networkMetrics || []).map((m: any) => [m.id, m])), [networkMetrics]);

  const getShouldShowArrowhead = useCallback((d: any) => {
    if (!directed) return false;

    const srcId = typeof d.source === 'object' ? d.source.id : d.source;
    const tgtId = typeof d.target === 'object' ? d.target.id : d.target;

    // 1. Global toggle in Legend
    if (showArrowheads) return true;

    // 2. Node is selected (clickedNode or selectedElement is a node ID)
    // Shows arrowheads for incoming (which nodes connect to them) and outgoing (what they connect to)
    const activeNodeId = clickedNodeRef.current?.id || (selectedElement && !selectedElement.includes('-') ? selectedElement : null);
    if (activeNodeId && (srcId === activeNodeId || tgtId === activeNodeId)) {
      return true;
    }

    // 3. Edge is selected
    if (clickedEdgeRef.current) {
      const cSrc = typeof clickedEdgeRef.current.source === 'object' ? (clickedEdgeRef.current.source as any).id : clickedEdgeRef.current.source;
      const cTgt = typeof clickedEdgeRef.current.target === 'object' ? (clickedEdgeRef.current.target as any).id : clickedEdgeRef.current.target;
      if (srcId === cSrc && tgtId === cTgt) return true;
    }
    if (selectedElement && selectedElement.includes('-')) {
      const parts = selectedElement.split('-');
      if ((srcId === parts[0] && tgtId === parts[1]) || (!directed && srcId === parts[1] && tgtId === parts[0])) {
        return true;
      }
    }

    // 4. Selected / Isolated Community (custom and calculated)
    if (isolatedLegendItem && isolatedLegendItem.startsWith('community:')) {
      const commVal = isolatedLegendItem.split('community:')[1];
      
      const getNodeComm = (nodeId: string) => {
        const net = netMap.get(nodeId);
        if (nodeColorBase === 'louvain') return net?.louvain;
        if (nodeColorBase === 'leiden') return net?.leiden;
        if (nodeColorBase === 'infomap') return net?.infomap;
        if (nodeColorBase === 'fast_greedy') return net?.fast_greedy;
        if (nodeColorBase === 'label_propagation') return net?.label_propagation;
        if (nodeColorBase === 'walktrap') return net?.walktrap;
        if (nodeColorBase === 'eigenvector') return net?.eigenvector;
        if (nodeColorBase === 'spinglass') return net?.spinglass;
        return communityMap[nodeId] ?? net?.community ?? net?.louvain ?? net?.leiden;
      };

      const srcComm = getNodeComm(srcId);
      const tgtComm = getNodeComm(tgtId);

      if (String(srcComm) === String(commVal) || String(tgtComm) === String(commVal)) {
        return true;
      }
    }

    // 5. Search Query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (String(srcId).toLowerCase().includes(q) || String(tgtId).toLowerCase().includes(q)) {
        return true;
      }
    }

    return false;
  }, [directed, showArrowheads, selectedElement, isolatedLegendItem, netMap, nodeColorBase, communityMap, searchQuery]);

  const getShouldShowArrowheadRef = useRef(getShouldShowArrowhead);
  useEffect(() => {
    getShouldShowArrowheadRef.current = getShouldShowArrowhead;
  }, [getShouldShowArrowhead]);

  const legendCategories = useMemo(() => {
    if ((nodeColorBase === 'custom' || nodeColorBase === 'louvain' || nodeColorBase === 'leiden') && communityLabels.length > 0) {
      return {
        title: nodeColorBase === 'custom' ? 'Custom Communities' : (nodeColorBase === 'louvain' ? 'Louvain Communities' : 'Leiden Communities'),
        items: communityLabels.map(label => ({
          label,
          id: `community:${label}`,
          color: communityColorMap[label],
          nodes: nodes.filter(n => {
             if (nodeColorBase === 'custom') return communityMap[n.id] === label;
             const net = netMap.get(n.id);
             return net && net[nodeColorBase] === label;
          }).map(n => n.label || n.name || n.id),
          allIds: communityLegendIds
        }))
      };
    } else if (nodeColorBase === 'type' && typeLabels.length > 0) {
      return {
        title: 'Types',
        items: typeLabels.map(label => ({
          label,
          id: `type:${label}`,
          color: typeColorScale(label),
          nodes: nodes.filter(n => n.type === label).map(n => n.label || n.name || n.id),
          allIds: typeLabels.map(t => `type:${t}`)
        }))
      };
    }
    return null;
  }, [nodeColorBase, communityLabels, communityColorMap, communityMap, typeLabels, typeColorScale, nodes, communityLegendIds, netMap]);

  const maxEigen = useMemo(() => d3.max(networkMetrics, (d: any) => parseFloat(d.eigenvector)) || 1, [networkMetrics]);
  const minEigen = useMemo(() => d3.min(networkMetrics, (d: any) => parseFloat(d.eigenvector)) || 0, [networkMetrics]);
  const maxPageRank = useMemo(() => d3.max(networkMetrics, (d: any) => parseFloat(d.pagerank)) || 1, [networkMetrics]);
  const minPageRank = useMemo(() => d3.min(networkMetrics, (d: any) => parseFloat(d.pagerank)) || 0, [networkMetrics]);
  const maxBetweenness = useMemo(() => d3.max(networkMetrics, (d: any) => parseFloat(d.betweenness)) || 1, [networkMetrics]);
  const maxCloseness = useMemo(() => d3.max(networkMetrics, (d: any) => parseFloat(d.closeness)) || 1, [networkMetrics]);
  const maxClustering = useMemo(() => d3.max(networkMetrics, (d: any) => parseFloat(d.clustering)) || 1, [networkMetrics]);
  const maxDegreeCent = useMemo(() => d3.max(networkMetrics, (d: any) => parseFloat(d.degreeCentrality || d.inDegreeCentrality || 0)) || 1, [networkMetrics]);

  const eigenColorScale = useMemo(() => d3.scaleSequential(isDarkMode ? d3.interpolatePurples : d3.interpolatePurples).domain([minEigen, maxEigen]), [isDarkMode, minEigen, maxEigen]);
  const prColorScale = useMemo(() => d3.scaleSequential(isDarkMode ? d3.interpolateGreens : d3.interpolateGreens).domain([minPageRank, maxPageRank]), [isDarkMode, minPageRank, maxPageRank]);
  const betweennessColorScale = useMemo(() => d3.scaleSequential(isDarkMode ? d3.interpolateOranges : d3.interpolateOranges).domain([0, maxBetweenness]), [isDarkMode, maxBetweenness]);
  const closenessColorScale = useMemo(() => d3.scaleSequential(isDarkMode ? d3.interpolateBlues : d3.interpolateBlues).domain([0, maxCloseness]), [isDarkMode, maxCloseness]);
  const clusteringColorScale = useMemo(() => d3.scaleSequential(isDarkMode ? d3.interpolateReds : d3.interpolateReds).domain([0, maxClustering]), [isDarkMode, maxClustering]);
  const degreeCentColorScale = useMemo(() => d3.scaleSequential(isDarkMode ? d3.interpolateYlOrBr : d3.interpolateYlOrBr).domain([0, maxDegreeCent]), [isDarkMode, maxDegreeCent]);

  const getNodeColor = useCallback((d: any) => {
    const net = netMap.get(d.id);
    const defaultNodeColor = isDarkMode ? '#E4E3E0' : '#141414';
    if (nodeColorBase === 'uniform') {
      if (!isDarkMode && (uniformNodeColor === '#cccccc' || uniformNodeColor === '#bbb' || uniformNodeColor === '#bbbbbb')) {
        return '#141414';
      }
      return uniformNodeColor;
    }
    if (nodeColorBase === 'custom') return customColorMap[communityMap[d.id] ?? d.community] || defaultNodeColor;
    if (nodeColorBase === 'louvain' && net?.louvain) return louvainColorMap[net.louvain] || defaultNodeColor;
    if (nodeColorBase === 'leiden' && net?.leiden) return leidenColorMap[net.leiden] || defaultNodeColor;
    if (nodeColorBase === 'type' && d.type) return typeColorScale(d.type);
    if (nodeColorBase === 'eigenvector' && net?.eigenvector !== undefined) return eigenColorScale(parseFloat(net.eigenvector));
    if (nodeColorBase === 'pagerank' && net?.pagerank !== undefined) return prColorScale(parseFloat(net.pagerank));
    if (nodeColorBase === 'betweenness' && net?.betweenness !== undefined) return betweennessColorScale(parseFloat(net.betweenness));
    if (nodeColorBase === 'closeness' && net?.closeness !== undefined) return closenessColorScale(parseFloat(net.closeness));
    if (nodeColorBase === 'clustering' && net?.clustering !== undefined) return clusteringColorScale(parseFloat(net.clustering));
    if (nodeColorBase === 'degreeCentrality' && net?.degreeCentrality !== undefined) return degreeCentColorScale(parseFloat(net.degreeCentrality));
    if (nodeColorBase === 'inDegreeCentrality' && net?.inDegreeCentrality !== undefined) return degreeCentColorScale(parseFloat(net.inDegreeCentrality));
    if (nodeColorBase === 'outDegreeCentrality' && net?.outDegreeCentrality !== undefined) return degreeCentColorScale(parseFloat(net.outDegreeCentrality));
    return defaultNodeColor;
  }, [isDarkMode, nodeColorBase, uniformNodeColor, customColorMap, louvainColorMap, leidenColorMap, communityMap, typeColorScale, eigenColorScale, prColorScale, betweennessColorScale, closenessColorScale, clusteringColorScale, degreeCentColorScale, netMap]);

  const maxRaw = useMemo(() => d3.max(edges, (d: any) => Number(d.weight_raw) || 0) || 1, [edges]);
  const maxSec = useMemo(() => d3.max(edges, (d: any) => Number(d.weight_secondary) || 0) || 1, [edges]);
  const rawColorScale = useMemo(() => d3.scaleSequential(isDarkMode ? d3.interpolateGnBu : d3.interpolateBlues).domain([0, maxRaw]), [isDarkMode, maxRaw]);
  const secColorScale = useMemo(() => d3.scaleSequential(isDarkMode ? d3.interpolateOrRd : d3.interpolateOranges).domain([0, maxSec]), [isDarkMode, maxSec]);

  const getEdgeColor = useCallback((d: any) => {
    if (edgeColorBase === 'nodeMetric' && edgeColorNodeMetric) {
      const targetId = edgeColorNodeTarget === 'source' ? (d.source.id || d.source) : (d.target.id || d.target);
      const net = netMap.get(targetId);
      const mBase = edgeColorNodeMetric;
      const defaultColor = isDarkMode ? '#eeeeee' : '#141414';
      if (mBase === 'custom') return customColorMap[communityMap[targetId]] || defaultColor;
      if (mBase === 'louvain' && net?.louvain) return louvainColorMap[net.louvain] || defaultColor;
      if (mBase === 'leiden' && net?.leiden) return leidenColorMap[net.leiden] || defaultColor;
      if (mBase === 'type') {
         const t = nodes.find(n => n.id === targetId)?.type;
         if (t) return typeColorScale(t);
      }
      if (mBase === 'eigenvector' && net?.eigenvector !== undefined) return eigenColorScale(parseFloat(net.eigenvector));
      if (mBase === 'pagerank' && net?.pagerank !== undefined) return prColorScale(parseFloat(net.pagerank));
      if (mBase === 'betweenness' && net?.betweenness !== undefined) return betweennessColorScale(parseFloat(net.betweenness));
      if (mBase === 'closeness' && net?.closeness !== undefined) return closenessColorScale(parseFloat(net.closeness));
      if (mBase === 'clustering' && net?.clustering !== undefined) return clusteringColorScale(parseFloat(net.clustering));
      if (mBase === 'degreeCentrality' && net?.degreeCentrality !== undefined) return degreeCentColorScale(parseFloat(net.degreeCentrality));
      if (mBase === 'inDegreeCentrality' && net?.inDegreeCentrality !== undefined) return degreeCentColorScale(parseFloat(net.inDegreeCentrality));
      if (mBase === 'outDegreeCentrality' && net?.outDegreeCentrality !== undefined) return degreeCentColorScale(parseFloat(net.outDegreeCentrality));
    }
    
    if (edgeColorBase === 'weight_raw' && d.weight_raw !== undefined) return rawColorScale(Number(d.weight_raw));
    if (edgeColorBase === 'weight_secondary' && d.weight_secondary !== undefined) return secColorScale(Number(d.weight_secondary));
    if (edgeColorBase === 'uniform') {
      if (isDarkMode) {
        if (uniformEdgeColor === '#000000' || uniformEdgeColor === '#000' || uniformEdgeColor === '#141414' || uniformEdgeColor === '#222222') {
          return '#888888';
        }
      } else {
        if (uniformEdgeColor === '#cccccc' || uniformEdgeColor === '#E4E3E0' || uniformEdgeColor === '#ffffff' || uniformEdgeColor === '#fff') {
          return '#333333';
        }
      }
      return uniformEdgeColor;
    }
    return isDarkMode ? '#888888' : '#333333';
  }, [edgeColorBase, uniformEdgeColor, edgeColorNodeMetric, edgeColorNodeTarget, nodes, netMap, customColorMap, louvainColorMap, leidenColorMap, communityMap, typeColorScale, eigenColorScale, prColorScale, betweennessColorScale, closenessColorScale, clusteringColorScale, degreeCentColorScale, rawColorScale, secColorScale, isDarkMode]);

  const getEdgeOpacity = useCallback((d: any) => {
    if (edgeOpacityBase === 'weight_raw' && d.weight_raw !== undefined) return 0.1 + 0.9 * (Number(d.weight_raw) / maxRaw);
    if (edgeOpacityBase === 'weight_secondary' && d.weight_secondary !== undefined) return 0.1 + 0.9 * (Number(d.weight_secondary) / maxSec);
    return edgeOpacity;
  }, [edgeOpacityBase, maxRaw, maxSec, edgeOpacity]);

  const handleZoomFit = () => {
    if (!svgRef.current || !zoomBehaviorRef.current || !simulationRef.current || !containerRef.current) return;
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    if (width <= 0 || height <= 0) return;
    
    const svg = d3.select(svgRef.current);
    const graphNodes = simulationRef.current.nodes();
    if (graphNodes.length === 0) return;
    
    const minX = d3.min(graphNodes, (d: any) => d.x - (d.currentRadius || 0)) || 0;
    const minY = d3.min(graphNodes, (d: any) => d.y - (d.currentRadius || 0)) || 0;
    const maxX = d3.max(graphNodes, (d: any) => d.x + (d.currentRadius || 0)) || 0;
    const maxY = d3.max(graphNodes, (d: any) => d.y + (d.currentRadius || 0)) || 0;

    const dx = maxX - minX;
    const dy = maxY - minY;
    const x = (minX + maxX) / 2;
    const y = (minY + maxY) / 2;
    
    if (dx === 0 || dy === 0) return;

    const scale = Math.max(0.1, Math.min(4, 0.9 / Math.max(dx / width, dy / height)));
    const translate = [width / 2 - scale * x, height / 2 - scale * y];

    svg.transition().duration(750).call(
      zoomBehaviorRef.current.transform, 
      d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
    );
  };

  useEffect(() => {
    if (!selectedElement || !svgRef.current || !zoomBehaviorRef.current || !simulationRef.current || !containerRef.current) return;
    
    let cancelled = false;
    const focusElement = () => {
      if (cancelled) return;
      if (!containerRef.current || !svgRef.current || !zoomBehaviorRef.current || !simulationRef.current) return;
      
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      if (width <= 0 || height <= 0) {
        requestAnimationFrame(focusElement);
        return;
      }
      
      const svg = d3.select(svgRef.current);
      const graphNodes = simulationRef.current.nodes();
      if (!graphNodes || graphNodes.length === 0) return;
      
      let targetNodes = [];
      if (!selectedElement.includes('-')) {
        const n = graphNodes.find((d: any) => d.id === selectedElement);
        if (n) targetNodes.push(n);
      } else {
        const parts = selectedElement.split('-');
        if (parts.length >= 2) {
          const src = parts[0];
          const tgt = parts[1];
          const n1 = graphNodes.find((d: any) => d.id === src);
          const n2 = graphNodes.find((d: any) => d.id === tgt);
          if (n1) targetNodes.push(n1);
          if (n2) targetNodes.push(n2);
        }
      }
      
      if (targetNodes.length > 0) {
        const minX = d3.min(targetNodes, (d: any) => d.x - (d.currentRadius || 0)) || 0;
        const minY = d3.min(targetNodes, (d: any) => d.y - (d.currentRadius || 0)) || 0;
        const maxX = d3.max(targetNodes, (d: any) => d.x + (d.currentRadius || 0)) || 0;
        const maxY = d3.max(targetNodes, (d: any) => d.y + (d.currentRadius || 0)) || 0;
        
        const dx = maxX - minX;
        const dy = maxY - minY;
        const x = (minX + maxX) / 2;
        const y = (minY + maxY) / 2;
        
        const scale = (dx === 0 && dy === 0) ? 2 : Math.max(0.1, Math.min(2.5, 0.9 / Math.max(dx / width, dy / height)));
        const translate = [width / 2 - scale * x, height / 2 - scale * y];
        
        svg.transition().duration(750).call(
          zoomBehaviorRef.current.transform, 
          d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
        );
      }
    };
    
    focusElement();
    return () => { cancelled = true; };
  }, [selectedElement]);

  // ResizeObserver to handle container tab toggles and layout resizes
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          if (simulationRef.current) {
            simulationRef.current.force('center', d3.forceCenter(width / 2, height / 2));
            simulationRef.current.alpha(0.05).restart();
          }
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // 1. Initial Graph Setup & Rendering
  useEffect(() => {
    if (!containerRef.current || !svgRef.current) return;
    
    setClickedNode(null); // Reset highlighted click on re-render
    
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove(); // Clear previous drawing

    // Setup zoom
    const zoomGroup = svg.append('g').attr('class', 'zoom-group');
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.01, 10])
      .on('zoom', (e) => {
        zoomGroup.attr('transform', e.transform);
      });
    zoomBehaviorRef.current = zoom;
    svg.call(zoom);

    // Define markers for directed edges
    if (directed) {
      svg.append("defs").append("marker")
        .attr("id", "arrowhead")
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 5) // Point is at 10, so ref it to 5, we offset edge dynamically
        .attr("refY", 0)
        .attr("markerWidth", 10)
        .attr("markerHeight", 10)
        .attr("orient", "auto")
        .attr("markerUnits", "userSpaceOnUse")
        .append("path")
        .attr("class", "arrowhead-path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", isDarkMode ? "#eeeeee" : "#141414")
        .attr("opacity", isDarkMode ? 0.9 : 0.6);
    }

    // Provide a background rect to catch clicks for deselecting
    zoomGroup.append("rect")
      .attr("width", width * 10)
      .attr("height", height * 10)
      .attr("x", -width * 4)
      .attr("y", -height * 4)
      .style("fill", "transparent")
      .on("click", () => {
        setClickedNode(null);
        setClickedEdge(null);
        if (onClearSelection) onClearSelection();
      });

    const degreeMap: Record<string, number> = {};
    if (nodeSizeBase === 'degree') {
      nodes.forEach(n => degreeMap[n.id] = 0);
      edges.forEach(e => {
        if (degreeMap[e.source] !== undefined) degreeMap[e.source]++;
        if (degreeMap[e.target] !== undefined) degreeMap[e.target]++;
      });
    }

    // Store existing node positions from previous simulation to prevent layout jump
    const prevPositions = new Map<string, { x?: number; y?: number; vx?: number; vy?: number; fx?: number; fy?: number }>();
    if (simulationRef.current) {
      simulationRef.current.nodes().forEach((n: any) => {
        if (n.id && n.x !== undefined && n.y !== undefined) {
          prevPositions.set(n.id, { x: n.x, y: n.y, vx: n.vx, vy: n.vy, fx: n.fx, fy: n.fy });
        }
      });
    }

    // Deep copy data for D3 mutation
    const graphNodes = nodes.map(d => {
      const gNode: any = { ...d };
      const net = netMap.get(d.id);
      
      const prevPos = prevPositions.get(d.id);
      if (prevPos) {
        gNode.x = prevPos.x;
        gNode.y = prevPos.y;
        gNode.vx = prevPos.vx;
        gNode.vy = prevPos.vy;
        if (prevPos.fx !== undefined) gNode.fx = prevPos.fx;
        if (prevPos.fy !== undefined) gNode.fy = prevPos.fy;
      }
      
      let baseVal = 10;
      if (nodeSizeBase === 'abundance') baseVal = gNode.abundance || 10;
      else if (nodeSizeBase === 'degree') baseVal = (degreeMap[d.id] || 0) * 5;
      else if (nodeSizeBase === 'eigenvector') baseVal = (parseFloat(net?.eigenvector || "0")) * 50;
      else if (nodeSizeBase === 'pagerank') baseVal = (parseFloat(net?.pagerank || "0")) * 500;
      else if (nodeSizeBase === 'betweenness') baseVal = (parseFloat(net?.betweenness || "0")) * 100;
      else if (nodeSizeBase === 'closeness') baseVal = (parseFloat(net?.closeness || "0")) * 100;
      else if (nodeSizeBase === 'clustering') baseVal = (parseFloat(net?.clustering || "0")) * 20;
      else if (nodeSizeBase === 'degreeCentrality') baseVal = (parseFloat(net?.degreeCentrality || "0")) * 100;
      else if (nodeSizeBase === 'inDegreeCentrality') baseVal = (parseFloat(net?.inDegreeCentrality || "0")) * 100;
      else if (nodeSizeBase === 'outDegreeCentrality') baseVal = (parseFloat(net?.outDegreeCentrality || "0")) * 100;
      else if (nodeSizeBase === 'uniform') baseVal = 5;

      gNode.currentRadius = nodeSizeMult * Math.max(Math.log(baseVal + 2), 1) + 2;
      return gNode;
    });
    
    const graphLinks = edges.map((d: any) => {
      let w = 1;
      if (edgeWeightBase === 'weight_raw') w = d.weight_raw !== undefined ? Number(d.weight_raw) : 1;
      else if (edgeWeightBase === 'weight_secondary') w = d.weight_secondary !== undefined ? Number(d.weight_secondary) : 1;
      return { 
        source: d.source, 
        target: d.target, 
        weight: w,
        weight_raw: d.weight_raw,
        weight_secondary: d.weight_secondary
      };
    });

    // Precalculate neighbors for fast lookup on click
    const adjacencyList: Record<string, Set<string>> = {};
    graphNodes.forEach(n => { adjacencyList[n.id] = new Set(); });
    graphLinks.forEach(l => {
      adjacencyList[l.source as string]?.add(l.target as string);
      adjacencyList[l.target as string]?.add(l.source as string);
    });
    adjacencyListRef.current = adjacencyList;

    const maxWeight = d3.max(graphLinks, (d: void | any) => (d as any).weight) || 1;
    const strokeWidthScale = d3.scaleLinear().domain([0, maxWeight]).range([0.5, 4]);

    const simulation = d3.forceSimulation(graphNodes as d3.SimulationNodeDatum[])
      .force('link', d3.forceLink(graphLinks).id((d: any) => d.id).distance(30))
      .force('charge', d3.forceManyBody().strength(forceStrength))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide().radius((d: any) => d.currentRadius + 2).iterations(graphNodes.length > 1000 ? 1 : 2));

    simulationRef.current = simulation;

    // Draw lines
    const link = zoomGroup.append('g')
      .attr('fill', 'none')
      .selectAll('path')
      .data(graphLinks)
      .join('path')
      .attr('class', 'graph-link')
      .style('cursor', 'pointer')
      .attr('stroke', (d: any) => getEdgeColor(d))
      .attr('stroke-width', (d: any) => {
         d._defaultStrokeWidth = Math.min(strokeWidthScale(d.weight || 1), 4) * edgeWeightMult;
         return `${Math.max(d._defaultStrokeWidth, 2)}px`;
      })
      .attr("marker-end", directed ? "url(#arrowhead)" : null)
      .on("click", (e: any, d: any) => {
        e.stopPropagation();
        setClickedEdge(prev => {
           if (prev && prev.source === d.source && prev.target === d.target) return null;
           setClickedNode(null);
           return d;
        });
      })
      .on("dblclick", (e: any, d: any) => {
        e.stopPropagation();
        if (onDoubleClickRef.current) {
          const srcId = typeof d.source === 'object' ? d.source.id : d.source;
          const tgtId = typeof d.target === 'object' ? d.target.id : d.target;
          onDoubleClickRef.current(`${srcId}-${tgtId}`, 'edge');
        }
      });

    // Draw circles container
    const nodeGroup = zoomGroup.append('g')
      .selectAll('.node-group')
      .data(graphNodes)
      .join('g')
      .attr('class', 'node-group');

    const isTypeB = (d: any) => d.type === 'B' || d.group === 1;

    // Filter nodes by bipolar type or unipartite
    const typeANodes = nodeGroup.filter(d => !isTypeB(d));
    const typeBNodes = nodeGroup.filter(d => isTypeB(d));

    const drawNodeShape = (selection: any, isSquare: boolean) => {
      const strokeColor = isDarkMode ? '#444444' : '#141414';
      if (isSquare) {
        return selection.append('rect')
          .attr('class', 'node-shape')
          .attr('x', (d: any) => -d.currentRadius)
          .attr('y', (d: any) => -d.currentRadius)
          .attr('width', (d: any) => d.currentRadius * 2)
          .attr('height', (d: any) => d.currentRadius * 2)
          .attr('fill', (d: any) => getNodeColor(d))
          .attr('stroke', strokeColor)
          .attr('stroke-width', 1)
          .style('cursor', 'pointer');
      } else {
        return selection.append('circle')
          .attr('class', 'node-shape')
          .attr('r', (d: any) => d.currentRadius)
          .attr('fill', (d: any) => getNodeColor(d))
          .attr('stroke', strokeColor)
          .attr('stroke-width', 1)
          .style('cursor', 'pointer');
      }
    };

    const shapeAClickParams = drawNodeShape(typeANodes, false);
    const shapeBClickParams = drawNodeShape(typeBNodes, true);

    const attachClickEvent = (selection: any) => {
      selection.on("click", (e: any, d: any) => {
        e.stopPropagation();
        setClickedNode(prev => {
           if (prev?.id === d.id) return null;
           setClickedDegree(adjacencyList[d.id]?.size || 0);
           return d;
        });
        setClickedEdge(null);
      });
      selection.on("dblclick", (e: any, d: any) => {
        e.stopPropagation();
        if (onDoubleClickRef.current) onDoubleClickRef.current(d.id, 'node');
      });
    };

    attachClickEvent(shapeAClickParams);
    attachClickEvent(shapeBClickParams);

    // Add labels
    const showLabels = showNodeLabels;
    nodeGroup.append('text')
      .text((d: any) => d.label || d.name || d.id)
      .attr('class', 'node-label')
      .attr("text-anchor", (d: any) => d.currentRadius >= 14 ? "middle" : "start")
      .attr("dx", (d: any) => d.currentRadius >= 14 ? 0 : d.currentRadius + 4)
      .attr("dy", "0.3em")
      .attr('font-size', '10px')
      .attr('font-family', 'var(--f-mono)')
      .attr('font-weight', 'bold')
      .attr("fill", (d: any) => d.currentRadius >= 14 ? (isDarkMode ? "#222" : "#fff") : (isDarkMode ? "#E4E3E0" : "#141414"))
      .style('pointer-events', 'none')
      .style('display', showLabels ? 'block' : 'none');

    // Simulation Tick
    const tickDraw = () => {
      link.attr('d', (d: any) => {
        let targetX = d.target.x;
        let targetY = d.target.y;
        
        const showArrow = getShouldShowArrowheadRef.current ? getShouldShowArrowheadRef.current(d) : false;

        if (directed) {
          const dx = d.target.x - d.source.x;
          const dy = d.target.y - d.source.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist > 0) {
            if (showArrow) {
              const r = d.target.currentRadius + 6; 
              if (dist > r) {
                targetX = d.target.x - (dx * r) / dist;
                targetY = d.target.y - (dy * r) / dist;
              }
            }
            const dr = dist * 1.5; 
            return `M${d.source.x},${d.source.y}A${dr},${dr} 0 0,1 ${targetX},${targetY}`;
          }
        }
        
        return `M${d.source.x},${d.source.y}L${targetX},${targetY}`;
      });

      nodeGroup.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    };
    
    tickDrawRef.current = tickDraw;

    simulation.on('tick', tickDraw);

    // Make nodes draggable, but respect livePhysics
    function dragstarted(event: any, d: any) {
      if (runtimeRef.current.livePhysics) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      }
    }
    
    function dragged(event: any, d: any) {
      if (runtimeRef.current.livePhysics) {
        d.fx = event.x;
        d.fy = event.y;
      } else {
        // Just move the single node without waking up physics
        d.x = event.x;
        d.y = event.y;
        tickDraw();
      }
    }
    
    function dragended(event: any, d: any) {
      if (runtimeRef.current.livePhysics) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      }
    }

    nodeGroup.call(d3.drag<any, any>()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended)
    );

    // Initial Physics Run
    if (livePhysics) {
       // eslint-disable-next-line react-hooks/set-state-in-effect
       setIsCalculatingLayout(false);
       simulation.alpha(1).restart();
    } else {
       // Static mode: compute asynchronously to prevent UI freezing
       simulation.stop();
       // eslint-disable-next-line react-hooks/set-state-in-effect
       setIsCalculatingLayout(true);
       svg.style('opacity', 0); // Hide graph during computation
       
       let ticks = 0;
       const maxTicks = 300;
       const batchSize = 50;
       
       const computeBatch = () => {
         if (!simulationRef.current) return;
         for (let i = 0; i < batchSize && ticks < maxTicks; i++) {
            simulation.tick();
            ticks++;
         }
         if (ticks < maxTicks) {
            setTimeout(computeBatch, 0);
         } else {
            tickDraw();
            svg.transition().duration(300).style('opacity', 1);
            setIsCalculatingLayout(false);
         }
       };
       setTimeout(computeBatch, 50); // small delay to allow loader to render
    }

    return () => {
      simulation.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, communityMap, directed, bipartite, refreshKey]);



  // Fast Force Update & Physics toggle
  useEffect(() => {
    if (simulationRef.current) {
      simulationRef.current.force('charge', d3.forceManyBody().strength(forceStrength));
      if (livePhysics) {
        simulationRef.current.alpha(1).restart();
        setTimeout(() => { if (simulationRef.current) simulationRef.current.alphaTarget(0); }, 1000);
      } else {
        simulationRef.current.stop();
      }
    }
  }, [forceStrength, livePhysics]);

  // Fast Node Sizing Update
  useEffect(() => {
    if (!svgRef.current || !simulationRef.current) return;
    
    const svg = d3.select(svgRef.current);
    const simNodes = simulationRef.current.nodes();
    if (simNodes.length === 0) return;

    const degreeMap: Record<string, number> = {};
    if (nodeSizeBase === 'degree') {
      nodes.forEach(n => degreeMap[n.id] = 0);
      edges.forEach(e => {
        if (degreeMap[e.source] !== undefined) degreeMap[e.source]++;
        if (degreeMap[e.target] !== undefined) degreeMap[e.target]++;
      });
    }

    simNodes.forEach((d: any) => {
      const net = networkMetrics.find(m => m.id === d.id);
      let baseVal = 10;
      if (nodeSizeBase === 'abundance') baseVal = d.abundance || 10;
      else if (nodeSizeBase === 'degree') baseVal = (degreeMap[d.id] || 0) * 5;
      else if (nodeSizeBase === 'eigenvector') baseVal = (parseFloat(net?.eigenvector || "0")) * 50;
      else if (nodeSizeBase === 'pagerank') baseVal = (parseFloat(net?.pagerank || "0")) * 500;
      else if (nodeSizeBase === 'betweenness') baseVal = (parseFloat(net?.betweenness || "0")) * 100;
      else if (nodeSizeBase === 'closeness') baseVal = (parseFloat(net?.closeness || "0")) * 100;
      else if (nodeSizeBase === 'clustering') baseVal = (parseFloat(net?.clustering || "0")) * 20;
      else if (nodeSizeBase === 'degreeCentrality') baseVal = (parseFloat(net?.degreeCentrality || "0")) * 100;
      else if (nodeSizeBase === 'inDegreeCentrality') baseVal = (parseFloat(net?.inDegreeCentrality || "0")) * 100;
      else if (nodeSizeBase === 'outDegreeCentrality') baseVal = (parseFloat(net?.outDegreeCentrality || "0")) * 100;
      else if (nodeSizeBase === 'uniform') baseVal = 5;

      d.currentRadius = nodeSizeMult * Math.max(Math.log(baseVal + 2), 1) + 2;
    });

    svg.selectAll('rect.node-shape')
      .attr('x', (d: any) => -d.currentRadius)
      .attr('y', (d: any) => -d.currentRadius)
      .attr('width', (d: any) => d.currentRadius * 2)
      .attr('height', (d: any) => d.currentRadius * 2);
      
    svg.selectAll('circle.node-shape')
      .attr('r', (d: any) => d.currentRadius);

    svg.selectAll('.node-label')
      .attr("text-anchor", (d: any) => d.currentRadius >= 14 ? "middle" : "start")
      .attr("dx", (d: any) => d.currentRadius >= 14 ? 0 : d.currentRadius + 4)
      .attr("fill", (d: any) => d.currentRadius >= 14 ? (isDarkMode ? "#222" : "#fff") : (isDarkMode ? "#ddd" : "#141414"));

    simulationRef.current.force('collide', d3.forceCollide().radius((d: any) => d.currentRadius + 2).iterations(2));
    
    if (livePhysics) {
      simulationRef.current.alphaTarget(0.1).restart();
      setTimeout(() => { if (simulationRef.current) simulationRef.current.alphaTarget(0); }, 1000);
    }
  }, [nodeSizeBase, nodeSizeMult, networkMetrics, nodes, edges, isDarkMode, livePhysics]);

  // 3. Fast Dark Mode Styling Update
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    
    const defaultNodeColor = isDarkMode ? '#bbbbbb' : '#141414';
    
    svg.selectAll('.graph-link')
      .attr('stroke', (d: any) => getEdgeColor(d));

    svg.selectAll('.node-shape')
      .attr('fill', (d: any) => getNodeColor(d))
      .attr('stroke', isDarkMode ? '#222' : '#141414');

    svg.selectAll('.node-label')
      .attr("fill", (d: any) => d.currentRadius >= 14 ? (isDarkMode ? "#222" : "#fff") : (isDarkMode ? "#ddd" : "#141414"));

    svg.selectAll('.arrowhead-path')
      .attr("fill", isDarkMode ? "#eeeeee" : "#141414")
      .attr("opacity", isDarkMode ? 0.9 : 0.6);
  }, [isDarkMode, communityMap, communityColorMap, getNodeColor, getEdgeColor]);

  // 4. Highlight Node Effect & Legend Visibility
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    
    const nodeGroup = svg.selectAll('.node-group');
    const link = svg.selectAll('.graph-link');
    const labels = svg.selectAll('.node-label');
    
    const isNodeHidden = (d: any) => {
      const isBipartiteNode = bipartite && (d.type === 'B' || d.group === 1);
      if (isBipartiteNode && hiddenItems.has('element:bipartite')) return true;
      if (!isBipartiteNode && hiddenItems.has('element:standard')) return true;
      
      const net = netMap.get(d.id);
      let comm;
      if (nodeColorBase === 'louvain') {
          comm = net ? net.louvain : undefined;
      } else if (nodeColorBase === 'leiden') {
          comm = net ? net.leiden : undefined;
      } else {
          comm = communityMap[d.id] ?? d.community ?? net?.louvain ?? net?.leiden;
      }

      if (comm !== undefined && hiddenItems.has(`community:${comm}`)) return true;

      if (d.type && hiddenItems.has(`type:${d.type}`)) return true;
      
      return false;
    };

    const isNodeInIsolatedGroup = (d: any) => {
      if (!isolatedLegendItem) return false;
      const isBipartiteNode = bipartite && (d.type === 'B' || d.group === 1);
      
      if (isolatedLegendItem === 'element:bipartite') return isBipartiteNode;
      if (isolatedLegendItem === 'element:standard') return !isBipartiteNode;
      
      if (isolatedLegendItem.startsWith('community:')) {
         const c = isolatedLegendItem.split('community:')[1];
         const net = netMap.get(d.id);
         let comm;
         if (nodeColorBase === 'louvain') {
             comm = net ? net.louvain : undefined;
         } else if (nodeColorBase === 'leiden') {
             comm = net ? net.leiden : undefined;
         } else {
             comm = communityMap[d.id] ?? d.community ?? net?.louvain ?? net?.leiden;
         }
         return String(comm) === String(c);
      }
      if (isolatedLegendItem.startsWith('type:')) {
         const t = isolatedLegendItem.split('type:')[1];
         return String(d.type) === String(t);
      }
      return false;
    };

    const hiddenNodeIds = new Set<string>();
    nodes.forEach(n => {
       if (isNodeHidden(n)) hiddenNodeIds.add(n.id);
    });

    const adjacencyList = adjacencyListRef.current;
    const showLabels = showNodeLabels;
    
    const q = searchQuery.toLowerCase();

    nodeGroup.style('opacity', (d: any) => {
      if (isNodeHidden(d)) return 0;
      if (isolatedLegendItem) {
        return isNodeInIsolatedGroup(d) ? nodeOpacity : nodeOpacity * 0.1;
      }
      if (clickedNode) {
        const neighbors = adjacencyList[clickedNode.id] || new Set();
        return (d.id === clickedNode.id || neighbors.has(d.id)) ? nodeOpacity : nodeOpacity * 0.1;
      }
      if (clickedEdge) {
        const cSrc = typeof clickedEdge.source === 'object' ? (clickedEdge.source as any).id : clickedEdge.source;
        const cTgt = typeof clickedEdge.target === 'object' ? (clickedEdge.target as any).id : clickedEdge.target;
        return (d.id === cSrc || d.id === cTgt) ? nodeOpacity : nodeOpacity * 0.1;
      }
      if (selectedElement) {
        if (d.id === selectedElement) return nodeOpacity;
        if (selectedElement.includes('-')) {
          const parts = selectedElement.split('-');
          // Best effort to check if node is part of selected edge
          if (parts.includes(String(d.id))) return nodeOpacity;
        }
        return nodeOpacity * 0.1;
      }
      if (q) {
        const matches = String(d.id).toLowerCase().includes(q) || String(d.label || d.name || "").toLowerCase().includes(q);
        return matches ? nodeOpacity : nodeOpacity * 0.1;
      }
      return nodeOpacity;
    }).style('display', (d: any) => isNodeHidden(d) ? 'none' : '');

    link.style('opacity', (d: any) => {
      if (hiddenItems.has('element:edges')) return 0;
      const srcId = typeof d.source === 'object' ? d.source.id : d.source;
      const tgtId = typeof d.target === 'object' ? d.target.id : d.target;
      const baseOpacity = getEdgeOpacity(d);

      if (isolatedLegendItem) {
        if (isolatedLegendItem.startsWith('element:') && isolatedLegendItem !== 'element:edges') {
          return baseOpacity * 0.05;
        }
        if (isolatedLegendItem === 'element:edges') {
          return baseOpacity;
        }
        const srcNode = nodes.find(n => n.id === srcId);
        const tgtNode = nodes.find(n => n.id === tgtId);
        if (srcNode && tgtNode && isNodeInIsolatedGroup(srcNode) && isNodeInIsolatedGroup(tgtNode)) {
          return baseOpacity;
        }
        return baseOpacity * 0.05;
      }

      if (clickedNode) {
        return (srcId === clickedNode.id || tgtId === clickedNode.id) ? baseOpacity : baseOpacity * 0.1;
      }
      if (clickedEdge) {
        const cSrc = typeof clickedEdge.source === 'object' ? (clickedEdge.source as any).id : clickedEdge.source;
        const cTgt = typeof clickedEdge.target === 'object' ? (clickedEdge.target as any).id : clickedEdge.target;
        return (srcId === cSrc && tgtId === cTgt) ? baseOpacity : baseOpacity * 0.1;
      }
      if (selectedElement) {
        if (`${srcId}-${tgtId}` === selectedElement || `${tgtId}-${srcId}` === selectedElement) return baseOpacity;
        if (srcId === selectedElement || tgtId === selectedElement) return baseOpacity;
        return baseOpacity * 0.1;
      }
      if (q) {
        const matches = String(srcId).toLowerCase().includes(q) || String(tgtId).toLowerCase().includes(q);
        return matches ? baseOpacity : baseOpacity * 0.1;
      }
      return baseOpacity;
    }).style('display', (d: any) => {
      if (hiddenItems.has('element:edges')) return 'none';
      return '';
    }).attr('stroke', (d: any) => getEdgeColor(d))
      .style('stroke-width', (d: any) => {
      let w = 1;
      if (edgeWeightBase === 'weight_raw') w = d.weight_raw !== undefined ? Number(d.weight_raw) : 1;
      else if (edgeWeightBase === 'weight_secondary') w = d.weight_secondary !== undefined ? Number(d.weight_secondary) : 1;
      
      const maxW = edgeWeightBase === 'weight_raw' ? maxRaw : (edgeWeightBase === 'weight_secondary' ? maxSec : 1);
      const normalizedW = maxW > 0 ? (w / maxW) : 1;
      
      // Calculate dynamic stroke width similar to strokeWidthScale (0.5 to 4)
      const currentStrokeWidth = Math.min(0.5 + (3.5 * normalizedW), 4) * edgeWeightMult;
      const defaultStroke = Math.max(currentStrokeWidth, 2); // Ensure it's thick enough to click easily

      const srcId = typeof d.source === 'object' ? d.source.id : d.source;
      const tgtId = typeof d.target === 'object' ? d.target.id : d.target;
      if (clickedNode && (srcId === clickedNode.id || tgtId === clickedNode.id)) {
        return `${Math.min(defaultStroke * 1.5, 6)}px`;
      }
      if (clickedEdge) {
        const cSrc = typeof clickedEdge.source === 'object' ? (clickedEdge.source as any).id : clickedEdge.source;
        const cTgt = typeof clickedEdge.target === 'object' ? (clickedEdge.target as any).id : clickedEdge.target;
        if (srcId === cSrc && tgtId === cTgt) {
          return `${Math.min(defaultStroke * 1.5, 6)}px`;
        }
      }
      if (selectedElement) {
        if (`${srcId}-${tgtId}` === selectedElement || `${tgtId}-${srcId}` === selectedElement || srcId === selectedElement || tgtId === selectedElement) {
          return `${Math.min(defaultStroke * 1.5, 6)}px`;
        }
      }
      if (q && (String(srcId).toLowerCase().includes(q) || String(tgtId).toLowerCase().includes(q))) {
        return `${Math.min(defaultStroke * 1.5, 6)}px`;
      }
      return `${defaultStroke}px`;
    }).attr('marker-end', (d: any) => {
      return getShouldShowArrowhead(d) ? "url(#arrowhead)" : null;
    });

    labels.style('opacity', (d: any) => {
      if (!showNodeLabels || isNodeHidden(d)) return 0;
      if (isolatedLegendItem) {
        return isNodeInIsolatedGroup(d) ? 1 : 0.1;
      }
      if (clickedNode) {
        const neighbors = adjacencyList[clickedNode.id] || new Set();
        return (d.id === clickedNode.id || neighbors.has(d.id)) ? 1 : 0.1;
      }
      if (clickedEdge) {
        const cSrc = typeof clickedEdge.source === 'object' ? (clickedEdge.source as any).id : clickedEdge.source;
        const cTgt = typeof clickedEdge.target === 'object' ? (clickedEdge.target as any).id : clickedEdge.target;
        return (d.id === cSrc || d.id === cTgt) ? 1 : 0.1;
      }
      if (selectedElement) {
        if (d.id === selectedElement) return 1;
        if (selectedElement.includes('-')) {
          const parts = selectedElement.split('-');
          if (parts.includes(String(d.id))) return 1;
        }
        return 0.1;
      }
      if (q) {
        const matches = String(d.id).toLowerCase().includes(q) || String(d.label || d.name || "").toLowerCase().includes(q);
        return matches ? 1 : 0.1;
      }
      return 1;
    }).style('display', (d: any) => {
      if (!showNodeLabels) return 'none';
      if (isNodeHidden(d)) return 'none';
      if (isolatedLegendItem) {
        return isNodeInIsolatedGroup(d) ? 'block' : 'none';
      }
      if (clickedNode) {
        const neighbors = adjacencyList[clickedNode.id] || new Set();
        return (d.id === clickedNode.id || neighbors.has(d.id)) ? 'block' : 'none';
      }
      if (clickedEdge) {
        const cSrc = typeof clickedEdge.source === 'object' ? (clickedEdge.source as any).id : clickedEdge.source;
        const cTgt = typeof clickedEdge.target === 'object' ? (clickedEdge.target as any).id : clickedEdge.target;
        return (d.id === cSrc || d.id === cTgt) ? 'block' : 'none';
      }
      if (selectedElement) {
        if (d.id === selectedElement) return 'block';
        if (selectedElement.includes('-')) {
          const parts = selectedElement.split('-');
          if (parts.includes(String(d.id))) return 'block';
        }
        return 'none';
      }
      if (q) {
        const matches = String(d.id).toLowerCase().includes(q) || String(d.label || d.name || "").toLowerCase().includes(q);
        return matches ? 'block' : 'none';
      }
      return showLabels ? 'block' : 'none';
    });

    if (tickDrawRef.current) {
        tickDrawRef.current();
    }

  }, [clickedNode, clickedEdge, selectedElement, hiddenItems, isolatedLegendItem, communityMap, nodes, bipartite, refreshKey, isDarkMode, directed, edges.length, nodeOpacity, edgeOpacity, searchQuery, getEdgeOpacity, getEdgeColor, edgeWeightBase, edgeWeightMult, maxRaw, maxSec, nodeColorBase, networkMetrics, showArrowheads, showNodeLabels, getShouldShowArrowhead]);

  return (
    <div ref={containerRef} className="w-full h-full relative cursor-crosshair">
            <svg ref={svgRef} id="network-graph-svg" className="w-full h-full block" />
      
      {isCalculatingLayout && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/10 dark:bg-white/5 backdrop-blur-sm z-50">
           <div className="w-6 h-6 border-2 border-t-transparent border-[#141414] dark:border-[#E4E3E0] rounded-full animate-spin mb-4"></div>
           <span className="text-[10px] font-bold uppercase tracking-widest font-mono">Calculating Layout...</span>
        </div>
      )}

      {/* Tools Menu */}
      <div className="absolute top-6 right-6 flex flex-col space-y-2">
        <button 
          onClick={handleZoomFit}
          className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border transition-colors ${
            isDarkMode 
              ? 'bg-[#141414] border-[#333] text-[#E4E3E0] hover:bg-[#E4E3E0] hover:text-[#141414]' 
              : 'bg-white border-[#141414] text-[#141414] hover:bg-[#141414] hover:text-white'
          }`}
        >
          [ FIT ZOOM ]
        </button>
        <button 
          onClick={() => {
            // Reset D3 node positions so graphology/d3 recalculates from scratch
            nodes.forEach((n: any) => {
              n.x = undefined;
              n.y = undefined;
              n.vx = undefined;
              n.vy = undefined;
              n.fx = undefined;
              n.fy = undefined;
            });
            onRefresh && onRefresh();
          }}
          className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border transition-colors ${
            isDarkMode 
              ? 'bg-[#141414] border-[#333] text-[#E4E3E0] hover:bg-[#E4E3E0] hover:text-[#141414]' 
              : 'bg-white border-[#141414] text-[#141414] hover:bg-[#141414] hover:text-white'
          }`}
        >
          [ REFRESH ]
        </button>
      </div>

      {clickedNode && (() => {
        const net = netMap.get(clickedNode.id);
        return (
          <div className="absolute bottom-6 right-6 flex space-x-2">
              <div className={`p-3 w-56 shadow-none border transition-colors ${
                isDarkMode ? 'bg-[#141414] border-[#333] text-[#E4E3E0]' : 'bg-white border-[#141414] text-[#141414]'
              }`}>
                  <div className={`text-[10px] font-bold uppercase tracking-widest mb-2 opacity-70 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>Node Details</div>
                  <div className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                          <span className="opacity-50 uppercase font-bold">NODE</span>
                          <span className="font-mono font-bold truncate max-w-[120px] text-right" title={clickedNode.label || clickedNode.name || clickedNode.id}>{clickedNode.label || clickedNode.name || clickedNode.id}</span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                          <span className="opacity-50 uppercase font-bold">ABUNDANCE</span>
                          <span className="font-mono font-bold">{clickedNode.abundance.toFixed(3)}</span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                          <span className="opacity-50 uppercase font-bold">DEGREE (Abs)</span>
                          <span className="font-mono font-bold">{clickedDegree}</span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                          <span className="opacity-50 uppercase font-bold">COMMUNITY</span>
                          <span className="font-mono font-bold">
                              <div className="w-3 h-3 inline-block align-middle ml-1" style={{backgroundColor: customColorMap[communityMap[clickedNode.id]] || (isDarkMode ? '#bbbbbb' : '#141414')}}></div>
                          </span>
                      </div>
                      
                      {Object.keys(clickedNode).filter(k => !['id', 'name', 'label', 'abundance', 'community', 'x', 'y', 'vx', 'vy', 'index', 'fx', 'fy', 'currentRadius', '_defaultStrokeWidth', 'type'].includes(k)).map(key => (
                        <div key={key} className="flex justify-between text-[10px]">
                          <span className="opacity-50 uppercase font-bold truncate max-w-[80px]" title={key}>{key}</span>
                          <span className="font-mono font-bold truncate max-w-[100px] text-right" title={String((clickedNode as any)[key])}>{String((clickedNode as any)[key])}</span>
                        </div>
                      ))}
                      {net?.degreeCentrality !== undefined && (
                        <div className="flex justify-between text-[10px]">
                            <span className="opacity-50 uppercase font-bold" title="Degree Centrality">DEGREE CENT</span>
                            <span className="font-mono font-bold">{parseFloat(net.degreeCentrality).toFixed(4)}</span>
                        </div>
                      )}
                      {net?.inDegreeCentrality !== undefined && (
                        <div className="flex justify-between text-[10px]">
                            <span className="opacity-50 uppercase font-bold" title="In-Degree Centrality">IN-DEG CENT</span>
                            <span className="font-mono font-bold">{parseFloat(net.inDegreeCentrality).toFixed(4)}</span>
                        </div>
                      )}
                      {net?.outDegreeCentrality !== undefined && (
                        <div className="flex justify-between text-[10px]">
                            <span className="opacity-50 uppercase font-bold" title="Out-Degree Centrality">OUT-DEG CENT</span>
                            <span className="font-mono font-bold">{parseFloat(net.outDegreeCentrality).toFixed(4)}</span>
                        </div>
                      )}
                      {net?.betweenness !== undefined && (
                        <div className="flex justify-between text-[10px]">
                            <span className="opacity-50 uppercase font-bold" title="Betweenness Centrality">BETWEENNESS</span>
                            <span className="font-mono font-bold">{parseFloat(net.betweenness).toFixed(4)}</span>
                        </div>
                      )}
                      {net?.closeness !== undefined && (
                        <div className="flex justify-between text-[10px]">
                            <span className="opacity-50 uppercase font-bold" title="Closeness Centrality">CLOSENESS</span>
                            <span className="font-mono font-bold">{parseFloat(net.closeness).toFixed(4)}</span>
                        </div>
                      )}
                      {net?.clustering !== undefined && (
                        <div className="flex justify-between text-[10px]">
                            <span className="opacity-50 uppercase font-bold" title="Clustering Coefficient">CLUSTERING</span>
                            <span className="font-mono font-bold">{parseFloat(net.clustering).toFixed(4)}</span>
                        </div>
                      )}
                      {net?.pagerank !== undefined && net?.pagerank !== "0" && (
                        <div className="flex justify-between text-[10px]">
                            <span className="opacity-50 uppercase font-bold" title="PageRank">PAGERANK</span>
                            <span className="font-mono font-bold">{parseFloat(net.pagerank).toFixed(4)}</span>
                        </div>
                      )}
                      {net?.eigenvector !== undefined && net?.eigenvector !== "0" && (
                        <div className="flex justify-between text-[10px]">
                            <span className="opacity-50 uppercase font-bold" title="Eigenvector Centrality">EIGENVECTOR</span>
                            <span className="font-mono font-bold">{parseFloat(net.eigenvector).toFixed(4)}</span>
                        </div>
                      )}
                  </div>
              </div>
          </div>
        );
      })()}

      {clickedEdge && (
        <div className="absolute bottom-6 right-6 flex space-x-2">
            <div className={`p-3 w-56 shadow-none border transition-colors ${
              isDarkMode ? 'bg-[#141414] border-[#333] text-[#E4E3E0]' : 'bg-white border-[#141414] text-[#141414]'
            }`}>
                <div className={`text-[10px] font-bold uppercase tracking-widest mb-2 opacity-70 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>Edge Details</div>
                <div className="space-y-1">
                    <div className="flex justify-between text-[10px] items-center">
                        <span className="opacity-50 uppercase font-bold">SOURCE</span>
                        <span className="font-mono font-bold truncate max-w-[120px] text-right" title={typeof clickedEdge.source === 'object' ? (clickedEdge.source as any).id : clickedEdge.source}>
                            {typeof clickedEdge.source === 'object' ? (clickedEdge.source as any).id : clickedEdge.source}
                        </span>
                    </div>
                    <div className="flex justify-between text-[10px] items-center">
                        <span className="opacity-50 uppercase font-bold">TARGET</span>
                        <span className="font-mono font-bold truncate max-w-[120px] text-right" title={typeof clickedEdge.target === 'object' ? (clickedEdge.target as any).id : clickedEdge.target}>
                            {typeof clickedEdge.target === 'object' ? (clickedEdge.target as any).id : clickedEdge.target}
                        </span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                        <span className="opacity-50 uppercase font-bold">RAW WT</span>
                        <span className="font-mono font-bold">{clickedEdge.weight_raw || '-'}</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                        <span className="opacity-50 uppercase font-bold">SEC WT</span>
                        <span className="font-mono font-bold">{clickedEdge.weight_secondary || '-'}</span>
                    </div>
                    {Object.keys(clickedEdge).filter(k => !['source', 'target', 'weight', 'weight_raw', 'weight_secondary', 'index', '_defaultStrokeWidth'].includes(k)).map(key => (
                        <div key={key} className="flex justify-between text-[10px]">
                          <span className="opacity-50 uppercase font-bold truncate max-w-[80px]" title={key}>{key}</span>
                          <span className="font-mono font-bold truncate max-w-[100px] text-right" title={String((clickedEdge as any)[key])}>{String((clickedEdge as any)[key])}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      )}
      
      {/* Legend Map */}
      <div className={`absolute top-6 left-6 border shadow-sm flex flex-col transition-colors ${isDarkMode ? 'bg-[#141414]/90 border-[#333] text-[#E4E3E0]' : 'bg-white/90 border-[#d0d0d0] text-[#141414]'}`} style={{ backdropFilter: 'blur(4px)', width: isLegendMinimized ? 'auto' : '220px' }}>
        <div className="flex items-center justify-between p-2 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5" onClick={() => setIsLegendMinimized(!isLegendMinimized)}>
          <span className="text-[10px] font-bold uppercase tracking-widest opacity-70 px-1">Legend</span>
          <button className="opacity-70 hover:opacity-100 ml-4">
            {isLegendMinimized ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>
        
        {!isLegendMinimized && (
          <div className={`p-3 pt-2 text-[10px] space-y-3 ${isDarkMode ? 'border-[#333]' : 'border-[#d0d0d0]'} border-t`}>
            
            <div>
              <div className="opacity-50 uppercase font-bold mb-1">Elements</div>
              <div className="space-y-1">
                {elementLegendItems.map(item => {
                  const isHidden = hiddenItems.has(item.id) || (isolatedLegendItem !== null && isolatedLegendItem !== item.id);
                  return (
                    <div 
                      key={item.id}
                      className={`flex items-center space-x-2 cursor-pointer p-1 -mx-1 rounded-sm transition-opacity ${isHidden ? 'opacity-40 line-through' : 'opacity-100 hover:bg-black/5 dark:hover:bg-white/10'}`}
                      onClick={(e) => handleLegendClick(e, item.id, elementLegendIds)}
                    >
                      <item.Icon />
                      <span>{item.label}</span>
                    </div>
                  );
                })}
                <div 
                  className={`flex items-center justify-between cursor-pointer p-1 -mx-1 rounded-sm transition-all ${
                    showNodeLabels 
                      ? 'opacity-100 font-bold bg-black/5 dark:bg-white/10' 
                      : 'opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowNodeLabels(!showNodeLabels);
                  }}
                  title="Click to toggle node labels on graph"
                >
                  <div className="flex items-center space-x-2">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className={showNodeLabels ? 'text-[#b4ff39]' : ''}>
                      <path d="M2 12l3.5-8L9 12M3.2 9h4.6M10.5 12V8.5a1.5 1.5 0 1 1 3 0V12M10.5 10h3" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>Node Labels</span>
                  </div>
                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border transition-colors ${
                    showNodeLabels 
                      ? 'bg-[#b4ff39] text-[#141414] border-[#b4ff39] font-bold' 
                      : 'bg-transparent text-current opacity-70 border-current/30'
                  }`}>
                    {showNodeLabels ? 'ON' : 'OFF'}
                  </span>
                </div>
                {directed && (
                  <div 
                    className={`flex items-center justify-between cursor-pointer p-1 -mx-1 rounded-sm transition-all ${
                      showArrowheads 
                        ? 'opacity-100 font-bold bg-black/5 dark:bg-white/10' 
                        : 'opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowArrowheads(!showArrowheads);
                    }}
                    title="Click to toggle arrowheads on all directed edges"
                  >
                    <div className="flex items-center space-x-2">
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className={showArrowheads ? 'text-[#b4ff39]' : ''}>
                        <path d="M2 8h11M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span>Arrowheads</span>
                    </div>
                    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border transition-colors ${
                      showArrowheads 
                        ? 'bg-[#b4ff39] text-[#141414] border-[#b4ff39] font-bold' 
                        : 'bg-transparent text-current opacity-70 border-current/30'
                    }`}>
                      {showArrowheads ? 'ON' : 'OFF'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {legendCategories && (
            <div>
              <div className="opacity-50 uppercase font-bold mb-1 flex items-center justify-between">
                <span>{legendCategories.title}</span>
              </div>
              <div className="space-y-1 max-h-[150px] overflow-y-auto pr-1">
                {legendCategories.items.map((item, i) => {
                  const isHidden = hiddenItems.has(item.id) || (isolatedLegendItem !== null && isolatedLegendItem !== item.id);
                  return (
                    <div 
                      key={i}
                      className={`flex items-center space-x-2 cursor-pointer p-1 -mx-1 rounded-sm transition-opacity ${isHidden ? 'opacity-40 line-through' : 'opacity-100 hover:bg-black/5 dark:hover:bg-white/10'}`}
                      onClick={(e) => handleLegendClick(e, item.id, item.allIds)}
                      title="Click to toggle visibility, double-click to isolate, triple-click to reset"
                    >
                      <div 
                        className="w-3 h-3 rounded-full flex-shrink-0" 
                        style={{ backgroundColor: item.color }}
                      ></div>
                      <span className="flex-grow select-none">{item.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
