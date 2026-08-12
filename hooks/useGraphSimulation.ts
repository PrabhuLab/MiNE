'use client';

import { useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import type Graph from 'graphology';
import { useStore, RawNode, RawEdge } from '@/store/useStore';
import { TooltipData } from '@/components/graph/GraphTooltip';

interface UseGraphSimulationProps {
  graph: Graph | null;
  containerRef: React.RefObject<HTMLDivElement | null>;
  svgRef: React.RefObject<SVGSVGElement | null>;
  nodes: RawNode[];
  edges: RawEdge[];
  communityMap: Record<string, string>;
  networkMetrics?: any[];
  nodeSizeMult: number;
  bipartiteNodeSizeMult?: number;
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
  getShouldShowArrowhead: (edge: any) => boolean;
  getNodeColor: (node: any) => string;
  getEdgeColor: (edge: any) => string;
  getEdgeOpacity: (edge: any) => number;
  netMap: Map<string, any>;
  displayMap: Record<string, number>;
  maxRaw: number;
  maxSec: number;
  clickedNode: RawNode | null;
  setClickedNode: React.Dispatch<React.SetStateAction<RawNode | null>>;
  clickedEdge: RawEdge | null;
  setClickedEdge: React.Dispatch<React.SetStateAction<RawEdge | null>>;
  setClickedDegree: (deg: number) => void;
  setTooltip: React.Dispatch<React.SetStateAction<TooltipData | null>>;
  isCalculatingLayout: boolean;
  setIsCalculatingLayout: (val: boolean) => void;
  registerD3TickListener?: (cb: () => void) => () => void;
  beginDrag?: (id: string, x: number, y: number) => void;
  movePinnedNode?: (id: string, x: number, y: number) => void;
  endDrag?: (id: string) => void;
  d3NodesRef?: React.RefObject<any[]>;
  d3LinksRef?: React.RefObject<any[]>;
  d3NodesMapRef?: React.RefObject<Map<string, any>>;
}

export function useGraphSimulation({
  graph,
  containerRef,
  svgRef,
  nodes,
  edges,
  communityMap,
  nodeSizeMult,
  bipartiteNodeSizeMult = 2,
  nodeSizeBase = 'abundance',
  edgeWeightMult = 1,
  nodeOpacity = 1,
  directed,
  bipartite,
  livePhysics,
  isDarkMode,
  refreshKey,
  onElementDoubleClick,
  onClearSelection,
  showNodeLabels,
  getNodeColor,
  getEdgeColor,
  getEdgeOpacity,
  netMap,
  setClickedNode,
  setClickedEdge,
  setClickedDegree,
  setTooltip,
  setIsCalculatingLayout,
  registerD3TickListener,
  beginDrag,
  movePinnedNode,
  endDrag,
  d3NodesRef,
  d3LinksRef,
  d3NodesMapRef,
}: UseGraphSimulationProps) {
  const zoomGroupRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const nodeGroupRef = useRef<d3.Selection<SVGGElement, any, SVGGElement, unknown> | null>(null);
  const edgeGroupRef = useRef<d3.Selection<SVGPathElement, any, SVGGElement, unknown> | null>(null);
  const tickDrawRef = useRef<(() => void) | null>(null);
  const onDoubleClickRef = useRef(onElementDoubleClick);
  useEffect(() => { onDoubleClickRef.current = onElementDoubleClick; }, [onElementDoubleClick]);

  const fitD3NodeSet = useCallback((nodeIds: string[], duration = 450) => {
    if (!svgRef.current || !containerRef.current || !zoomBehaviorRef.current || !zoomGroupRef.current) return;
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    if (width <= 0 || height <= 0) return;

    const svg = d3.select(svgRef.current);
    const zoomBehavior = zoomBehaviorRef.current;
    const applyTransform = (transform: d3.ZoomTransform) => {
      if (duration <= 0) {
        svg.call(zoomBehavior.transform, transform);
      } else {
        svg.transition().duration(duration).call(zoomBehavior.transform, transform);
      }
    };

    if (!nodeIds || nodeIds.length === 0) {
      applyTransform(d3.zoomIdentity);
      return;
    }

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let validCount = 0;

    nodeIds.forEach((id) => {
      let x = 0, y = 0;
      const simulationNode = d3NodesMapRef?.current?.get(id);
      if (livePhysics && simulationNode) {
        x = simulationNode.x;
        y = simulationNode.y;
      } else if (graph && graph.hasNode(id)) {
        x = graph.getNodeAttribute(id, 'x');
        y = graph.getNodeAttribute(id, 'y');
      } else {
        const n = nodes.find((item) => item.id === id);
        if (!n) return;
        x = n.x ?? 0;
        y = n.y ?? 0;
      }
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      validCount++;
    });

    if (validCount === 0 || minX === Infinity) {
      applyTransform(d3.zoomIdentity);
      return;
    }

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    if (validCount === 1) {
      const scale = 1.5;
      const translate = [width / 2 - scale * cx, height / 2 - scale * cy];
      applyTransform(d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale));
      return;
    }

    const dx = Math.max(20, maxX - minX);
    const dy = Math.max(20, maxY - minY);
    const padding = 0.75;
    const scale = Math.max(0.1, Math.min(4, padding / Math.max(dx / width, dy / height)));
    const translate = [width / 2 - scale * cx, height / 2 - scale * cy];

    applyTransform(d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale));
  }, [graph, nodes, svgRef, containerRef, livePhysics, d3NodesMapRef]);

  const handleZoomFit = useCallback(() => {
    const allIds = nodes.map((n) => n.id);
    fitD3NodeSet(allIds);
  }, [nodes, fitD3NodeSet]);

  // Main D3 SVG Rendering Pipeline
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;
    const svg = d3.select(svgRef.current);
    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 600;

    svg.selectAll('*').remove();

    const defs = svg.append('defs');
    defs
      .append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 18)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', isDarkMode ? '#888888' : '#666666');

    const zoomGroup = svg.append('g').attr('class', 'zoom-group');
    zoomGroupRef.current = zoomGroup;

    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .extent([[0, 0], [width, height]])
      .scaleExtent([0.05, 8])
      .on('zoom', (e) => {
        zoomGroup.attr('transform', e.transform);
      });

    zoomBehaviorRef.current = zoomBehavior;
    svg.call(zoomBehavior as any);

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

    // O(1) Map lookup for shared simulation node objects
    const sharedD3NodesMap = d3NodesMapRef?.current;
    const graphNodes = nodes.map((d) => {
      let x = 0, y = 0;
      let sharedNode = sharedD3NodesMap?.get(d.id);
      if (sharedNode) {
        x = sharedNode.x;
        y = sharedNode.y;
      } else if (graph && graph.hasNode(d.id)) {
        x = graph.getNodeAttribute(d.id, 'x');
        y = graph.getNodeAttribute(d.id, 'y');
      } else {
        x = d.x ?? (Math.random() - 0.5) * 600;
        y = d.y ?? (Math.random() - 0.5) * 600;
      }

      let baseVal = 10;
      if (nodeSizeBase === 'uniform') baseVal = 10;
      else if (nodeSizeBase === 'abundance') baseVal = d.abundance ?? 10;
      else if (nodeSizeBase === 'degree') baseVal = (degreeMap[d.id] || 0) * 5;

      const isSecondary = bipartite && (Number(d.partitionIndex) === 1 || d.partition === 'B' || d.partition === 1 || d.type === 'B' || d.type === 'secondary' || d.group === 1 || (d as any).bipartite === 1);
      const mult = isSecondary ? bipartiteNodeSizeMult : nodeSizeMult;
      const logVal = Math.log(Math.max(0, baseVal) + 2);
      const currentRadius = Math.max(2, Math.min(45, mult * logVal + 1));

      if (!sharedNode) {
        sharedNode = {
          id: d.id,
          x,
          y,
          vx: 0,
          vy: 0,
        };
        sharedD3NodesMap?.set(d.id, sharedNode);
      }

      const {
        x: _x,
        y: _y,
        vx: _vx,
        vy: _vy,
        fx: _fx,
        fy: _fy,
        ...metadata
      } = d as RawNode & d3.SimulationNodeDatum;
      Object.assign(sharedNode, metadata);
      sharedNode.currentRadius = currentRadius;
      return sharedNode;
    });

    const sharedD3Links = d3LinksRef?.current;
    const renderNodeMap = new Map(graphNodes.map((node: any) => [node.id, node]));
    const graphEdges = livePhysics && sharedD3Links?.length
      ? sharedD3Links
      : edges
          .map((edge) => ({
            source: renderNodeMap.get(edge.source),
            target: renderNodeMap.get(edge.target),
            rawEdge: edge,
            weight: edge.weight_raw ?? 1,
          }))
          .filter((edge) => edge.source && edge.target);

    const maxWeight = d3.max(edges, (d) => Number(d.weight_raw || 1)) || 1;
    const strokeWidthScale = d3.scaleLinear().domain([0, maxWeight]).range([0.5, 4]);

    const link = zoomGroup
      .append('g')
      .attr('fill', 'none')
      .selectAll('path')
      .data(graphEdges)
      .join('path')
      .attr('class', 'graph-link')
      .style('cursor', 'pointer')
      .attr('stroke', (d: any) => getEdgeColor(d.rawEdge || d))
      .attr('stroke-opacity', (d: any) => getEdgeOpacity(d.rawEdge || d))
      .attr('stroke-width', (d: any) => {
        const w = Number(d.weight_raw || d.rawEdge?.weight_raw || 1);
        const defaultWidth = Math.min(strokeWidthScale(w), 4) * edgeWeightMult;
        return `${Math.max(defaultWidth, 2)}px`;
      })
      .attr('marker-end', directed ? 'url(#arrowhead)' : null)
      .on('click', (e: any, d: any) => {
        e.stopPropagation();
        const raw = d.rawEdge || d;
        setClickedEdge((prev) => {
          if (prev && prev.source === raw.source && prev.target === raw.target) return null;
          setClickedNode(null);
          return raw;
        });
      })
      .on('dblclick', (e: any, d: any) => {
        e.stopPropagation();
        const srcId = typeof d.source === 'object' ? d.source.id : d.source;
        const tgtId = typeof d.target === 'object' ? d.target.id : d.target;
        if (onDoubleClickRef.current) {
          onDoubleClickRef.current(`${srcId}-${tgtId}`, 'edge');
        }
      })
      .on('mouseenter', (e: any, d: any) => {
        const srcId = typeof d.source === 'object' ? d.source.id : d.source;
        const tgtId = typeof d.target === 'object' ? d.target.id : d.target;
        const raw = d.rawEdge || d;
        setTooltip({
          x: e.clientX,
          y: e.clientY,
          title: `Edge: ${srcId} → ${tgtId}`,
          items: [
            ...(raw.weight_raw ? [{ label: 'Raw Weight', value: raw.weight_raw }] : []),
            ...(raw.weight_secondary ? [{ label: 'Secondary Weight', value: raw.weight_secondary }] : []),
          ],
        });
      })
      .on('mousemove', (e: any) => {
        setTooltip((prev: TooltipData | null) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : null));
      })
      .on('mouseleave', () => {
        setTooltip(null);
      });

    edgeGroupRef.current = link as any;

    const nodeGroup = zoomGroup
      .append('g')
      .selectAll('.node-group')
      .data(graphNodes)
      .join('g')
      .attr('class', 'node-group')
      .attr('transform', (d: any) => `translate(${d.x},${d.y})`);

    nodeGroupRef.current = nodeGroup as any;

    const strokeColor = isDarkMode ? '#ffffff' : '#141414';

    nodeGroup.each(function (d: any) {
      const g = d3.select(this);
      const isSquare = bipartite && (Number(d.partitionIndex) === 1 || d.partition === 'B' || d.partition === 1 || d.type === 'B' || d.type === 'secondary' || d.group === 1 || (d as any).bipartite === 1);

      if (isSquare) {
        g.append('rect')
          .attr('class', 'node-shape')
          .attr('x', -d.currentRadius)
          .attr('y', -d.currentRadius)
          .attr('width', d.currentRadius * 2)
          .attr('height', d.currentRadius * 2)
          .attr('rx', Math.min(3, d.currentRadius * 0.2))
          .attr('ry', Math.min(3, d.currentRadius * 0.2))
          .attr('fill', getNodeColor(d))
          .attr('opacity', nodeOpacity)
          .attr('stroke', strokeColor)
          .attr('stroke-width', 1.5)
          .style('cursor', 'pointer');
      } else {
        g.append('circle')
          .attr('class', 'node-shape')
          .attr('r', d.currentRadius)
          .attr('fill', getNodeColor(d))
          .attr('opacity', nodeOpacity)
          .attr('stroke', strokeColor)
          .attr('stroke-width', 1.5)
          .style('cursor', 'pointer');
      }
    });

    nodeGroup.on('click', (e: any, d: any) => {
      e.stopPropagation();
      setClickedNode((prev) => {
        if (prev?.id === d.id) return null;
        setClickedDegree(graph?.degree(d.id) || 0);
        return d;
      });
      setClickedEdge(null);
    });

    nodeGroup.on('dblclick', (e: any, d: any) => {
      e.stopPropagation();
      if (onDoubleClickRef.current) onDoubleClickRef.current(d.id, 'node');
    });

    nodeGroup.on('mouseenter', (e: any, d: any) => {
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
        ],
      });
    });

    nodeGroup.on('mousemove', (e: any) => {
      setTooltip((prev: TooltipData | null) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : null));
    });

    nodeGroup.on('mouseleave', () => {
      setTooltip(null);
    });

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
      .attr('fill', isDarkMode ? '#ffffff' : '#141414')
      .style('pointer-events', 'none')
      .style('display', showNodeLabels ? 'block' : 'none');

    // Streamlined D3 Drag Lifecycle: beginDrag (reheat ONCE on start), movePinnedNode (move only), endDrag
    nodeGroup.call(
      d3
        .drag<any, any>()
        .on('start', (e: any, d: any) => {
          if (beginDrag) beginDrag(d.id, d.x, d.y);
        })
        .on('drag', (e: any, d: any) => {
          if (movePinnedNode) movePinnedNode(d.id, e.x, e.y);
        })
        .on('end', (e: any, d: any) => {
          if (endDrag) endDrag(d.id);
        })
    );

    // Direct D3 Tick Drawing reading d.x, d.y, d.source.x/y, d.target.x/y directly from simulation objects
    const tickDraw = () => {
      nodeGroup.attr('transform', (d: any) => `translate(${d.x},${d.y})`);

      link.attr('d', (d: any) => {
        const sx = d.source.x;
        const sy = d.source.y;
        const tx = d.target.x;
        const ty = d.target.y;

        if (directed) {
          const dx = tx - sx;
          const dy = ty - sy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0) {
            const dr = dist * 1.5;
            return `M${sx},${sy}A${dr},${dr} 0 0,1 ${tx},${ty}`;
          }
        }
        return `M${sx},${sy}L${tx},${ty}`;
      });
    };

    tickDrawRef.current = tickDraw;
    tickDraw();
    fitD3NodeSet(graphNodes.map((node: any) => node.id), 0);
    setIsCalculatingLayout(false);

    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [
    graph,
    nodes,
    edges,
    communityMap,
    directed,
    bipartite,
    livePhysics,
    refreshKey,
    containerRef,
    svgRef,
    fitD3NodeSet,
    nodeSizeMult,
    bipartiteNodeSizeMult,
    nodeSizeBase,
    edgeWeightMult,
    nodeOpacity,
    isDarkMode,
    showNodeLabels,
    getNodeColor,
    getEdgeColor,
    getEdgeOpacity,
  ]);

  // Subscribe to direct D3 physics ticks for fast SVG DOM updates
  useEffect(() => {
    if (!registerD3TickListener) return;
    const unbind = registerD3TickListener(() => {
      if (tickDrawRef.current) {
        tickDrawRef.current();
      }
    });
    return unbind;
  }, [registerD3TickListener]);

  return {
    handleZoomFit,
  };
}
