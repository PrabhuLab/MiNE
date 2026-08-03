'use client';

import { useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import { RawNode, RawEdge } from '@/store/useStore';
import { TooltipData } from '@/components/graph/GraphTooltip';

interface UseGraphSimulationProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  svgRef: React.RefObject<SVGSVGElement | null>;
  nodes: RawNode[];
  edges: RawEdge[];
  communityMap: Record<string, string>;
  networkMetrics?: any[];
  nodeSizeMult: number;
  nodeSizeBase?: string;
  nodeColorBase?: string;
  uniformNodeColor?: string;
  uniformEdgeColor?: string;
  edgeWeightMult?: number;
  edgeWeightBase?: string;
  edgeColorBase?: string;
  edgeColorNodeMetric?: string;
  edgeColorNodeTarget?: 'source' | 'target';
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
  onElementDoubleClick?: (id: string, type: 'node' | 'edge') => void;
  onClearSelection?: () => void;
  searchQuery?: string;
  selectedElement?: string | null;
  hiddenItems: Set<string>;
  isolatedLegendItem: string | null;
  showArrowheads: boolean;
  showNodeLabels: boolean;
  getShouldShowArrowhead: (d: any) => boolean;
  getNodeColor: (d: any) => string;
  getEdgeColor: (d: any) => string;
  getEdgeOpacity: (d: any) => number;
  netMap: Map<string, any>;
  maxRaw: number;
  maxSec: number;
  clickedNode: RawNode | null;
  setClickedNode: React.Dispatch<React.SetStateAction<RawNode | null>>;
  clickedEdge: RawEdge | null;
  setClickedEdge: React.Dispatch<React.SetStateAction<RawEdge | null>>;
  setClickedDegree: React.Dispatch<React.SetStateAction<number>>;
  setTooltip: React.Dispatch<React.SetStateAction<TooltipData | null>>;
  isCalculatingLayout: boolean;
  setIsCalculatingLayout: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useGraphSimulation({
  containerRef,
  svgRef,
  nodes,
  edges,
  communityMap,
  networkMetrics = [],
  nodeSizeMult,
  nodeSizeBase = 'abundance',
  nodeColorBase = 'custom',
  nodeOpacity = 1,
  edgeOpacity = 0.3,
  edgeWeightMult = 1,
  edgeWeightBase = 'weight_raw',
  forceStrength,
  directed,
  bipartite,
  livePhysics,
  isDarkMode,
  refreshKey,
  onRefresh,
  onElementDoubleClick,
  onClearSelection,
  searchQuery = '',
  selectedElement = null,
  hiddenItems,
  isolatedLegendItem,
  showArrowheads,
  showNodeLabels,
  getShouldShowArrowhead,
  getNodeColor,
  getEdgeColor,
  getEdgeOpacity,
  netMap,
  maxRaw,
  maxSec,
  clickedNode,
  setClickedNode,
  clickedEdge,
  setClickedEdge,
  setClickedDegree,
  setTooltip,
  setIsCalculatingLayout,
}: UseGraphSimulationProps) {
  const simulationRef = useRef<d3.Simulation<any, any> | null>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const adjacencyListRef = useRef<Record<string, Set<string>>>({});
  const tickDrawRef = useRef<(() => void) | null>(null);

  const runtimeRef = useRef({ livePhysics });
  useEffect(() => {
    runtimeRef.current = { livePhysics };
  }, [livePhysics]);

  const onDoubleClickRef = useRef(onElementDoubleClick);
  useEffect(() => {
    onDoubleClickRef.current = onElementDoubleClick;
  }, [onElementDoubleClick]);

  const getShouldShowArrowheadRef = useRef(getShouldShowArrowhead);
  useEffect(() => {
    getShouldShowArrowheadRef.current = getShouldShowArrowhead;
  }, [getShouldShowArrowhead]);

  const isNodeHidden = useCallback((d: any) => {
    const isBipartiteNode = bipartite && (d.type === 'B' || d.group === 1);
    if (isBipartiteNode && hiddenItems.has('element:bipartite')) return true;
    if (!isBipartiteNode && hiddenItems.has('element:standard')) return true;

    const net = netMap.get(d.id);
    let comm;
    if (nodeColorBase === 'louvain') {
      comm = net ? net.louvain : undefined;
    } else {
      comm = communityMap[d.id] ?? d.community ?? net?.louvain;
    }

    if (comm !== undefined && hiddenItems.has(`community:${comm}`)) return true;
    if (d.type && hiddenItems.has(`type:${d.type}`)) return true;

    return false;
  }, [bipartite, hiddenItems, netMap, nodeColorBase, communityMap]);

  const isNodeInIsolatedGroup = useCallback((d: any, isolatedItem: string | null = isolatedLegendItem) => {
    if (!isolatedItem) return false;
    const isBipartiteNode = bipartite && (d.type === 'B' || d.group === 1);

    if (isolatedItem === 'element:bipartite') return isBipartiteNode;
    if (isolatedItem === 'element:standard') return !isBipartiteNode;

    if (isolatedItem.startsWith('community:')) {
      const c = isolatedItem.split('community:')[1];
      const net = netMap.get(d.id);
      let comm;
      if (nodeColorBase === 'louvain') {
        comm = net ? net.louvain : undefined;
      } else {
        comm = communityMap[d.id] ?? d.community ?? net?.louvain;
      }
      return String(comm) === String(c);
    }
    if (isolatedItem.startsWith('type:')) {
      const t = isolatedItem.split('type:')[1];
      return String(d.type) === String(t);
    }
    return false;
  }, [bipartite, isolatedLegendItem, netMap, nodeColorBase, communityMap]);

  const handleZoomFit = useCallback((targetNodeIds?: string[]) => {
    if (!svgRef.current || !zoomBehaviorRef.current || !simulationRef.current || !containerRef.current) return;
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    if (width <= 0 || height <= 0) return;

    const svg = d3.select(svgRef.current);
    let graphNodes = simulationRef.current.nodes();
    if (graphNodes.length === 0) return;

    if (targetNodeIds && targetNodeIds.length > 0) {
      const targetSet = new Set(targetNodeIds);
      const filtered = graphNodes.filter((d: any) => targetSet.has(d.id));
      if (filtered.length > 0) graphNodes = filtered;
    } else if (isolatedLegendItem) {
      const filtered = graphNodes.filter((d: any) => isNodeInIsolatedGroup(d, isolatedLegendItem));
      if (filtered.length > 0) graphNodes = filtered;
    } else {
      const filtered = graphNodes.filter((d: any) => !isNodeHidden(d));
      if (filtered.length > 0) graphNodes = filtered;
    }

    const minX = d3.min(graphNodes, (d: any) => (d.x ?? 0) - (d.currentRadius || 0)) ?? 0;
    const minY = d3.min(graphNodes, (d: any) => (d.y ?? 0) - (d.currentRadius || 0)) ?? 0;
    const maxX = d3.max(graphNodes, (d: any) => (d.x ?? 0) + (d.currentRadius || 0)) ?? 0;
    const maxY = d3.max(graphNodes, (d: any) => (d.y ?? 0) + (d.currentRadius || 0)) ?? 0;

    const dx = maxX - minX;
    const dy = maxY - minY;
    const x = (minX + maxX) / 2;
    const y = (minY + maxY) / 2;

    if (dx === 0 && dy === 0) return;

    const scale = Math.max(0.1, Math.min(3.5, 0.85 / Math.max((dx || 1) / width, (dy || 1) / height)));
    const translate = [width / 2 - scale * x, height / 2 - scale * y];

    svg.transition().duration(750).call(
      zoomBehaviorRef.current.transform,
      d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
    );
  }, [containerRef, svgRef, isolatedLegendItem, isNodeInIsolatedGroup, isNodeHidden]);

  // Selected element auto-focus
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

      const targetNodes = [];
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

        const scale = dx === 0 && dy === 0 ? 2 : Math.max(0.1, Math.min(2.5, 0.9 / Math.max(dx / width, dy / height)));
        const translate = [width / 2 - scale * x, height / 2 - scale * y];

        svg.transition().duration(750).call(
          zoomBehaviorRef.current.transform,
          d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
        );
      }
    };

    focusElement();
    return () => {
      cancelled = true;
    };
  }, [selectedElement, containerRef, svgRef]);

  // Container ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
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
  }, [containerRef]);

  // Initial Graph Setup & Rendering
  useEffect(() => {
    if (!containerRef.current || !svgRef.current) return;

    setClickedNode(null);

    const rect = containerRef.current.getBoundingClientRect();
    const width = containerRef.current.clientWidth || rect.width || 800;
    const height = containerRef.current.clientHeight || rect.height || 600;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const zoomGroup = svg.append('g').attr('class', 'zoom-group');
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.01, 10])
      .on('zoom', (e) => {
        zoomGroup.attr('transform', e.transform);
      });
    zoomBehaviorRef.current = zoom;
    svg.call(zoom);

    if (directed) {
      svg
        .append('defs')
        .append('marker')
        .attr('id', 'arrowhead')
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 5)
        .attr('refY', 0)
        .attr('markerWidth', 10)
        .attr('markerHeight', 10)
        .attr('orient', 'auto')
        .attr('markerUnits', 'userSpaceOnUse')
        .append('path')
        .attr('class', 'arrowhead-path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', isDarkMode ? '#eeeeee' : '#141414')
        .attr('opacity', isDarkMode ? 0.9 : 0.6);
    }

    zoomGroup
      .append('rect')
      .attr('width', width * 10)
      .attr('height', height * 10)
      .attr('x', -width * 4)
      .attr('y', -height * 4)
      .style('fill', 'transparent')
      .on('click', () => {
        setClickedNode(null);
        setClickedEdge(null);
        if (onClearSelection) onClearSelection();
      });

    const degreeMap: Record<string, number> = {};
    if (nodeSizeBase === 'degree') {
      nodes.forEach((n) => (degreeMap[n.id] = 0));
      edges.forEach((e) => {
        if (degreeMap[e.source] !== undefined) degreeMap[e.source]++;
        if (degreeMap[e.target] !== undefined) degreeMap[e.target]++;
      });
    }

    const prevPositions = new Map<string, { x?: number; y?: number; vx?: number; vy?: number; fx?: number; fy?: number }>();
    if (simulationRef.current) {
      simulationRef.current.nodes().forEach((n: any) => {
        if (n.id && n.x !== undefined && n.y !== undefined) {
          prevPositions.set(n.id, { x: n.x, y: n.y, vx: n.vx, vy: n.vy, fx: n.fx, fy: n.fy });
        }
      });
    }

    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.35 || 250;
    const unpositionedNodes = nodes.filter((n) => !prevPositions.has(n.id));
    const unpositionedCount = unpositionedNodes.length;
    let unpositionedIndex = 0;

    const graphNodes = nodes.map((d) => {
      const gNode: any = { ...d };
      const net = netMap.get(d.id);

      const prevPos = prevPositions.get(d.id);
      if (prevPos && prevPos.x !== undefined && prevPos.y !== undefined) {
        gNode.x = prevPos.x;
        gNode.y = prevPos.y;
        gNode.vx = prevPos.vx;
        gNode.vy = prevPos.vy;
        if (prevPos.fx !== undefined) gNode.fx = prevPos.fx;
        if (prevPos.fy !== undefined) gNode.fy = prevPos.fy;
      } else {
        const angle = (unpositionedIndex / Math.max(1, unpositionedCount)) * 2 * Math.PI;
        const r = radius * (0.2 + 0.8 * Math.random());
        gNode.x = centerX + r * Math.cos(angle);
        gNode.y = centerY + r * Math.sin(angle);
        unpositionedIndex++;
      }

      let baseVal = 10;
      if (nodeSizeBase === 'abundance') baseVal = gNode.abundance || 10;
      else if (nodeSizeBase === 'degree') baseVal = (degreeMap[d.id] || 0) * 5;
      else if (nodeSizeBase === 'eigenvector') baseVal = parseFloat(net?.eigenvector || '0') * 50;
      else if (nodeSizeBase === 'pagerank') baseVal = parseFloat(net?.pagerank || '0') * 500;
      else if (nodeSizeBase === 'betweenness') baseVal = parseFloat(net?.betweenness || '0') * 100;
      else if (nodeSizeBase === 'closeness') baseVal = parseFloat(net?.closeness || '0') * 100;
      else if (nodeSizeBase === 'clustering') baseVal = parseFloat(net?.clustering || '0') * 20;
      else if (nodeSizeBase === 'degreeCentrality') baseVal = parseFloat(net?.degreeCentrality || '0') * 100;
      else if (nodeSizeBase === 'inDegreeCentrality') baseVal = parseFloat(net?.inDegreeCentrality || '0') * 100;
      else if (nodeSizeBase === 'outDegreeCentrality') baseVal = parseFloat(net?.outDegreeCentrality || '0') * 100;
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
        weight_secondary: d.weight_secondary,
      };
    });

    const adjacencyList: Record<string, Set<string>> = {};
    graphNodes.forEach((n) => {
      adjacencyList[n.id] = new Set();
    });
    graphLinks.forEach((l) => {
      adjacencyList[l.source as string]?.add(l.target as string);
      adjacencyList[l.target as string]?.add(l.source as string);
    });
    adjacencyListRef.current = adjacencyList;

    const maxWeight = d3.max(graphLinks, (d: void | any) => (d as any).weight) || 1;
    const strokeWidthScale = d3.scaleLinear().domain([0, maxWeight]).range([0.5, 4]);
    const initialLinkDistance = Math.max(50, Math.min(180, 1200 / Math.sqrt(graphNodes.length || 1)));

    // Extract communities to compute cluster anchor positions
    const commSet = new Set<string>();
    graphNodes.forEach((d: any) => {
      const net = netMap.get(d.id);
      let comm;
      if (nodeColorBase === 'louvain') {
        comm = net ? net.louvain : undefined;
      } else {
        comm = communityMap[d.id] ?? d.community ?? net?.louvain;
      }
      if (comm !== undefined && comm !== null && String(comm) !== '') commSet.add(String(comm));
    });
    const uniqueComms = Array.from(commSet);
    const commCount = uniqueComms.length;

    const commAnchorMap: Record<string, { x: number; y: number }> = {};
    const clusterRadius = Math.min(width, height) * 0.3;
    uniqueComms.forEach((c, idx) => {
      const angle = (idx / Math.max(1, commCount)) * 2 * Math.PI;
      commAnchorMap[c] = {
        x: centerX + clusterRadius * Math.cos(angle),
        y: centerY + clusterRadius * Math.sin(angle),
      };
    });

    const simulation = d3
      .forceSimulation(graphNodes as d3.SimulationNodeDatum[])
      .force(
        'link',
        d3
          .forceLink(graphLinks)
          .id((d: any) => d.id)
          .distance((d: any) => {
            const srcId = typeof d.source === 'object' ? d.source.id : d.source;
            const tgtId = typeof d.target === 'object' ? d.target.id : d.target;
            const srcDeg = adjacencyList[srcId]?.size || 1;
            const tgtDeg = adjacencyList[tgtId]?.size || 1;
            const avgDeg = (srcDeg + tgtDeg) / 2;
            return Math.max(45, Math.min(220, initialLinkDistance + avgDeg * 2));
          })
          .strength(0.35)
      )
      .force(
        'charge',
        d3
          .forceManyBody()
          .strength((d: any) => {
            const base = forceStrength || -250;
            const deg = adjacencyList[d.id]?.size || 1;
            return base * (1 + Math.log2(deg));
          })
          .distanceMin(15)
          .distanceMax(1800)
      )
      .force('center', d3.forceCenter(centerX, centerY).strength(0.05))
      .force(
        'collide',
        d3
          .forceCollide()
          .radius((d: any) => (d.currentRadius || 8) + 6)
          .strength(0.8)
          .iterations(3)
      );

    if (bipartite) {
      simulation.force(
        'bipartiteX',
        d3
          .forceX((d: any) => {
            const isB = d.type === 'B' || d.group === 1;
            return isB ? centerX + 260 : centerX - 260;
          })
          .strength(0.4)
      );
    } else if (commCount > 1) {
      simulation.force(
        'clusterX',
        d3
          .forceX((d: any) => {
            const net = netMap.get(d.id);
            let comm;
            if (nodeColorBase === 'louvain') {
              comm = net ? net.louvain : undefined;
            } else {
              comm = communityMap[d.id] ?? d.community ?? net?.louvain;
            }
            if (comm !== undefined && commAnchorMap[String(comm)]) {
              return commAnchorMap[String(comm)].x;
            }
            return centerX;
          })
          .strength(0.12)
      );
      simulation.force(
        'clusterY',
        d3
          .forceY((d: any) => {
            const net = netMap.get(d.id);
            let comm;
            if (nodeColorBase === 'louvain') {
              comm = net ? net.louvain : undefined;
            } else {
              comm = communityMap[d.id] ?? d.community ?? net?.louvain;
            }
            if (comm !== undefined && commAnchorMap[String(comm)]) {
              return commAnchorMap[String(comm)].y;
            }
            return centerY;
          })
          .strength(0.12)
      );
    }

    simulationRef.current = simulation;

    const link = zoomGroup
      .append('g')
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
      .attr('marker-end', directed ? 'url(#arrowhead)' : null)
      .on('click', (e: any, d: any) => {
        e.stopPropagation();
        setClickedEdge((prev) => {
          if (prev && prev.source === d.source && prev.target === d.target) return null;
          setClickedNode(null);
          return d;
        });
      })
      .on('dblclick', (e: any, d: any) => {
        e.stopPropagation();
        if (onDoubleClickRef.current) {
          const srcId = typeof d.source === 'object' ? d.source.id : d.source;
          const tgtId = typeof d.target === 'object' ? d.target.id : d.target;
          onDoubleClickRef.current(`${srcId}-${tgtId}`, 'edge');
        }
      })
      .on('mouseenter', (e: any, d: any) => {
        const srcId = typeof d.source === 'object' ? d.source.id : d.source;
        const tgtId = typeof d.target === 'object' ? d.target.id : d.target;
        setTooltip({
          x: e.clientX,
          y: e.clientY,
          title: `Edge: ${srcId} → ${tgtId}`,
          items: [
            ...(d.weight ? [{ label: 'Weight', value: d.weight }] : []),
            ...(d.weight_raw ? [{ label: 'Raw Weight', value: d.weight_raw }] : []),
            ...(d.weight_secondary ? [{ label: 'Secondary Weight', value: d.weight_secondary }] : []),
          ],
        });
      })
      .on('mousemove', (e: any) => {
        setTooltip((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : null));
      })
      .on('mouseleave', () => {
        setTooltip(null);
      });

    const nodeGroup = zoomGroup
      .append('g')
      .selectAll('.node-group')
      .data(graphNodes)
      .join('g')
      .attr('class', 'node-group');

    const isTypeB = (d: any) => d.type === 'B' || d.group === 1;

    const typeANodes = nodeGroup.filter((d) => !isTypeB(d));
    const typeBNodes = nodeGroup.filter((d) => isTypeB(d));

    const drawNodeShape = (selection: any, isSquare: boolean) => {
      const strokeColor = isDarkMode ? '#444444' : '#141414';
      if (isSquare) {
        return selection
          .append('rect')
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
        return selection
          .append('circle')
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
      selection.on('click', (e: any, d: any) => {
        e.stopPropagation();
        setClickedNode((prev) => {
          if (prev?.id === d.id) return null;
          setClickedDegree(adjacencyList[d.id]?.size || 0);
          return d;
        });
        setClickedEdge(null);
      });
      selection.on('dblclick', (e: any, d: any) => {
        e.stopPropagation();
        if (onDoubleClickRef.current) onDoubleClickRef.current(d.id, 'node');
      });
      selection.on('mouseenter', (e: any, d: any) => {
        const net = netMap.get(d.id);
        const comm = communityMap[d.id] ?? d.community ?? net?.community;
        setTooltip({
          x: e.clientX,
          y: e.clientY,
          title: d.label || d.name || d.id,
          items: [
            { label: 'ID', value: d.id },
            ...(d.type ? [{ label: 'Type', value: d.type }] : []),
            ...(comm ? [{ label: 'Community', value: comm }] : []),
            ...(net?.degree !== undefined ? [{ label: 'Degree', value: net.degree }] : []),
            ...(net?.betweenness !== undefined ? [{ label: 'Betweenness', value: parseFloat(net.betweenness).toFixed(4) }] : []),
            ...(net?.closeness !== undefined ? [{ label: 'Closeness', value: parseFloat(net.closeness).toFixed(4) }] : []),
            ...(net?.eigenvector !== undefined ? [{ label: 'Eigenvector', value: parseFloat(net.eigenvector).toFixed(4) }] : []),
          ],
        });
      });
      selection.on('mousemove', (e: any) => {
        setTooltip((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : null));
      });
      selection.on('mouseleave', () => {
        setTooltip(null);
      });
    };

    attachClickEvent(shapeAClickParams);
    attachClickEvent(shapeBClickParams);

    const showLabels = showNodeLabels;
    nodeGroup
      .append('text')
      .text((d: any) => d.label || d.name || d.id)
      .attr('class', 'node-label')
      .attr('text-anchor', (d: any) => (d.currentRadius >= 14 ? 'middle' : 'start'))
      .attr('dx', (d: any) => (d.currentRadius >= 14 ? 0 : d.currentRadius + 4))
      .attr('dy', '0.3em')
      .attr('font-size', '10px')
      .attr('font-family', 'var(--f-mono)')
      .attr('font-weight', 'bold')
      .attr('fill', (d: any) => (d.currentRadius >= 14 ? (isDarkMode ? '#222' : '#fff') : isDarkMode ? '#E4E3E0' : '#141414'))
      .style('pointer-events', 'none')
      .style('display', showLabels ? 'block' : 'none');

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

    nodeGroup.call(d3.drag<any, any>().on('start', dragstarted).on('drag', dragged).on('end', dragended));

    if (livePhysics) {
      setIsCalculatingLayout(false);
      simulation.alpha(1).restart();
    } else {
      simulation.stop();
      setIsCalculatingLayout(true);
      svg.style('opacity', 0);

      let ticks = 0;
      const maxTicks = 350;
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
          setTimeout(() => {
            handleZoomFit();
          }, 350);
        }
      };
      setTimeout(computeBatch, 20);
    }

    return () => {
      simulation.stop();
    };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [nodes, edges, communityMap, directed, bipartite, refreshKey, containerRef, svgRef]);

  // Fast Force Update & Physics toggle
  useEffect(() => {
    if (simulationRef.current) {
      const adjacencyList = adjacencyListRef.current;
      simulationRef.current.force(
        'charge',
        d3
          .forceManyBody()
          .strength((d: any) => {
            const base = forceStrength || -250;
            const deg = adjacencyList[d.id]?.size || 1;
            return base * (1 + Math.log2(deg));
          })
          .distanceMin(15)
          .distanceMax(1800)
      );
      if (livePhysics) {
        simulationRef.current.alpha(1).restart();
        setTimeout(() => {
          if (simulationRef.current) simulationRef.current.alphaTarget(0);
        }, 1000);
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
      nodes.forEach((n) => (degreeMap[n.id] = 0));
      edges.forEach((e) => {
        if (degreeMap[e.source] !== undefined) degreeMap[e.source]++;
        if (degreeMap[e.target] !== undefined) degreeMap[e.target]++;
      });
    }

    simNodes.forEach((d: any) => {
      const net = networkMetrics.find((m) => m.id === d.id);
      let baseVal = 10;
      if (nodeSizeBase === 'abundance') baseVal = d.abundance || 10;
      else if (nodeSizeBase === 'degree') baseVal = (degreeMap[d.id] || 0) * 5;
      else if (nodeSizeBase === 'eigenvector') baseVal = parseFloat(net?.eigenvector || '0') * 50;
      else if (nodeSizeBase === 'pagerank') baseVal = parseFloat(net?.pagerank || '0') * 500;
      else if (nodeSizeBase === 'betweenness') baseVal = parseFloat(net?.betweenness || '0') * 100;
      else if (nodeSizeBase === 'closeness') baseVal = parseFloat(net?.closeness || '0') * 100;
      else if (nodeSizeBase === 'clustering') baseVal = parseFloat(net?.clustering || '0') * 20;
      else if (nodeSizeBase === 'degreeCentrality') baseVal = parseFloat(net?.degreeCentrality || '0') * 100;
      else if (nodeSizeBase === 'inDegreeCentrality') baseVal = parseFloat(net?.inDegreeCentrality || '0') * 100;
      else if (nodeSizeBase === 'outDegreeCentrality') baseVal = parseFloat(net?.outDegreeCentrality || '0') * 100;
      else if (nodeSizeBase === 'uniform') baseVal = 5;

      d.currentRadius = nodeSizeMult * Math.max(Math.log(baseVal + 2), 1) + 2;
    });

    svg
      .selectAll('rect.node-shape')
      .attr('x', (d: any) => -d.currentRadius)
      .attr('y', (d: any) => -d.currentRadius)
      .attr('width', (d: any) => d.currentRadius * 2)
      .attr('height', (d: any) => d.currentRadius * 2);

    svg.selectAll('circle.node-shape').attr('r', (d: any) => d.currentRadius);

    svg
      .selectAll('.node-label')
      .attr('text-anchor', (d: any) => (d.currentRadius >= 14 ? 'middle' : 'start'))
      .attr('dx', (d: any) => (d.currentRadius >= 14 ? 0 : d.currentRadius + 4))
      .attr('fill', (d: any) => (d.currentRadius >= 14 ? (isDarkMode ? '#222' : '#fff') : isDarkMode ? '#ddd' : '#141414'));

    simulationRef.current.force('collide', d3.forceCollide().radius((d: any) => d.currentRadius + 2).iterations(2));

    if (livePhysics) {
      simulationRef.current.alphaTarget(0.1).restart();
      setTimeout(() => {
        if (simulationRef.current) simulationRef.current.alphaTarget(0);
      }, 1000);
    }
  }, [nodeSizeBase, nodeSizeMult, networkMetrics, nodes, edges, isDarkMode, livePhysics, svgRef]);

  // Fast Dark Mode Styling Update
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);

    svg.selectAll('.graph-link').attr('stroke', (d: any) => getEdgeColor(d));

    svg
      .selectAll('.node-shape')
      .attr('fill', (d: any) => getNodeColor(d))
      .attr('stroke', isDarkMode ? '#222' : '#141414');

    svg
      .selectAll('.node-label')
      .attr('fill', (d: any) => (d.currentRadius >= 14 ? (isDarkMode ? '#222' : '#fff') : isDarkMode ? '#ddd' : '#141414'));

    svg
      .selectAll('.arrowhead-path')
      .attr('fill', isDarkMode ? '#eeeeee' : '#141414')
      .attr('opacity', isDarkMode ? 0.9 : 0.6);
  }, [isDarkMode, getNodeColor, getEdgeColor, svgRef]);

  // Highlight Node Effect & Legend Visibility
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);

    const nodeGroup = svg.selectAll('.node-group');
    const link = svg.selectAll('.graph-link');
    const labels = svg.selectAll('.node-label');

    const adjacencyList = adjacencyListRef.current;
    const showLabels = showNodeLabels;
    const q = searchQuery.toLowerCase();

    nodeGroup
      .style('opacity', (d: any) => {
        if (isNodeHidden(d)) return 0;
        if (isolatedLegendItem) {
          return isNodeInIsolatedGroup(d) ? nodeOpacity : nodeOpacity * 0.1;
        }
        if (clickedNode) {
          const neighbors = adjacencyList[clickedNode.id] || new Set();
          return d.id === clickedNode.id || neighbors.has(d.id) ? nodeOpacity : nodeOpacity * 0.1;
        }
        if (clickedEdge) {
          const cSrc = typeof clickedEdge.source === 'object' ? (clickedEdge.source as any).id : clickedEdge.source;
          const cTgt = typeof clickedEdge.target === 'object' ? (clickedEdge.target as any).id : clickedEdge.target;
          return d.id === cSrc || d.id === cTgt ? nodeOpacity : nodeOpacity * 0.1;
        }
        if (selectedElement) {
          if (d.id === selectedElement) return nodeOpacity;
          if (selectedElement.includes('-')) {
            const parts = selectedElement.split('-');
            if (parts.includes(String(d.id))) return nodeOpacity;
          }
          return nodeOpacity * 0.1;
        }
        if (q) {
          const matches = String(d.id).toLowerCase().includes(q) || String(d.label || d.name || '').toLowerCase().includes(q);
          return matches ? nodeOpacity : nodeOpacity * 0.1;
        }
        return nodeOpacity;
      })
      .style('display', (d: any) => (isNodeHidden(d) ? 'none' : ''));

    link
      .style('opacity', (d: any) => {
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
          const srcNode = nodes.find((n) => n.id === srcId);
          const tgtNode = nodes.find((n) => n.id === tgtId);
          if (srcNode && tgtNode && isNodeInIsolatedGroup(srcNode) && isNodeInIsolatedGroup(tgtNode)) {
            return baseOpacity;
          }
          return baseOpacity * 0.05;
        }

        if (clickedNode) {
          return srcId === clickedNode.id || tgtId === clickedNode.id ? baseOpacity : baseOpacity * 0.1;
        }
        if (clickedEdge) {
          const cSrc = typeof clickedEdge.source === 'object' ? (clickedEdge.source as any).id : clickedEdge.source;
          const cTgt = typeof clickedEdge.target === 'object' ? (clickedEdge.target as any).id : clickedEdge.target;
          return srcId === cSrc && tgtId === cTgt ? baseOpacity : baseOpacity * 0.1;
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
      })
      .style('display', () => (hiddenItems.has('element:edges') ? 'none' : ''))
      .attr('stroke', (d: any) => getEdgeColor(d))
      .style('stroke-width', (d: any) => {
        let w = 1;
        if (edgeWeightBase === 'weight_raw') w = d.weight_raw !== undefined ? Number(d.weight_raw) : 1;
        else if (edgeWeightBase === 'weight_secondary') w = d.weight_secondary !== undefined ? Number(d.weight_secondary) : 1;

        const maxW = edgeWeightBase === 'weight_raw' ? maxRaw : edgeWeightBase === 'weight_secondary' ? maxSec : 1;
        const normalizedW = maxW > 0 ? w / maxW : 1;

        const currentStrokeWidth = Math.min(0.5 + 3.5 * normalizedW, 4) * edgeWeightMult;
        const defaultStroke = Math.max(currentStrokeWidth, 2);

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
      })
      .attr('marker-end', (d: any) => (getShouldShowArrowhead(d) ? 'url(#arrowhead)' : null));

    labels
      .style('opacity', (d: any) => {
        if (!showNodeLabels || isNodeHidden(d)) return 0;
        if (isolatedLegendItem) {
          return isNodeInIsolatedGroup(d) ? 1 : 0.1;
        }
        if (clickedNode) {
          const neighbors = adjacencyList[clickedNode.id] || new Set();
          return d.id === clickedNode.id || neighbors.has(d.id) ? 1 : 0.1;
        }
        if (clickedEdge) {
          const cSrc = typeof clickedEdge.source === 'object' ? (clickedEdge.source as any).id : clickedEdge.source;
          const cTgt = typeof clickedEdge.target === 'object' ? (clickedEdge.target as any).id : clickedEdge.target;
          return d.id === cSrc || d.id === cTgt ? 1 : 0.1;
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
          const matches = String(d.id).toLowerCase().includes(q) || String(d.label || d.name || '').toLowerCase().includes(q);
          return matches ? 1 : 0.1;
        }
        return 1;
      })
      .style('display', (d: any) => {
        if (!showNodeLabels) return 'none';
        if (isNodeHidden(d)) return 'none';
        if (isolatedLegendItem) {
          return isNodeInIsolatedGroup(d) ? 'block' : 'none';
        }
        if (clickedNode) {
          const neighbors = adjacencyList[clickedNode.id] || new Set();
          return d.id === clickedNode.id || neighbors.has(d.id) ? 'block' : 'none';
        }
        if (clickedEdge) {
          const cSrc = typeof clickedEdge.source === 'object' ? (clickedEdge.source as any).id : clickedEdge.source;
          const cTgt = typeof clickedEdge.target === 'object' ? (clickedEdge.target as any).id : clickedEdge.target;
          return d.id === cSrc || d.id === cTgt ? 'block' : 'none';
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
          const matches = String(d.id).toLowerCase().includes(q) || String(d.label || d.name || '').toLowerCase().includes(q);
          return matches ? 'block' : 'none';
        }
        return showLabels ? 'block' : 'none';
      });

    if (tickDrawRef.current) {
      tickDrawRef.current();
    }
  }, [
    clickedNode,
    clickedEdge,
    selectedElement,
    hiddenItems,
    isolatedLegendItem,
    isNodeHidden,
    isNodeInIsolatedGroup,
    communityMap,
    nodes,
    bipartite,
    refreshKey,
    isDarkMode,
    directed,
    edges.length,
    nodeOpacity,
    edgeOpacity,
    searchQuery,
    getEdgeOpacity,
    getEdgeColor,
    edgeWeightBase,
    edgeWeightMult,
    maxRaw,
    maxSec,
    nodeColorBase,
    networkMetrics,
    showArrowheads,
    showNodeLabels,
    getShouldShowArrowhead,
    netMap,
    svgRef,
  ]);

  return {
    simulationRef,
    zoomBehaviorRef,
    handleZoomFit,
  };
}
