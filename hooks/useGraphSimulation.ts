'use client';

import { useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import type Graph from 'graphology';
import { useStore, RawNode, RawEdge } from '@/store/useStore';
import type { TooltipData } from '@/services/graphInteraction/types';
import {
  getD3EdgePresentation,
  getD3NodePresentation,
  type D3PresentationContext,
} from '@/components/graph/d3/presentation';
import { isSecondaryNode } from '@/services/graphPresentation/visibility';

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
  layoutRevision?: number;
  onRefresh?: () => void;
  onElementDoubleClick?: (id: string, type: 'node' | 'edge') => void;
  onClearSelection?: () => void;
  searchQuery?: string;
  selectedElement?: string | null;
  hiddenItems: Set<string>;
  isolatedLegendItem: string | null;
  selectedCommunityId: string | null;
  isolatedCommunityId: string | null;
  hoveredCommunityId: string | null;
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
  focusedEdgeNodeSet: Set<string>;
  fitNodeIds: string[];
  getNodeSize: (node: RawNode) => number;
  getEdgeSize: (edge: RawEdge) => number;
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
  nodeOpacity = 1,
  directed,
  bipartite,
  livePhysics,
  isDarkMode,
  refreshKey,
  layoutRevision,
  onElementDoubleClick,
  onClearSelection,
  searchQuery = '',
  hiddenItems,
  isolatedLegendItem,
  selectedCommunityId,
  isolatedCommunityId,
  hoveredCommunityId,
  showArrowheads,
  showNodeLabels,
  getShouldShowArrowhead,
  getNodeColor,
  getEdgeColor,
  getEdgeOpacity,
  netMap,
  displayMap,
  clickedNode,
  setClickedNode,
  clickedEdge,
  setClickedEdge,
  focusedEdgeNodeSet,
  fitNodeIds,
  getNodeSize,
  getEdgeSize,
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
  const lastTopologyKeyRef = useRef<string | null>(null);
  const onDoubleClickRef = useRef(onElementDoubleClick);
  useEffect(() => { onDoubleClickRef.current = onElementDoubleClick; }, [onElementDoubleClick]);
  const pendingFitRef = useRef<{ nodeIds: string[]; duration: number } | null>(null);

  const fitD3NodeSet = useCallback((nodeIds: string[], duration = 450, isAutoReapply = false) => {
    if (!isAutoReapply) {
      pendingFitRef.current = { nodeIds, duration };
    }
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
    const scale = Math.max(0.000001, Math.min(1000, padding / Math.max(dx / width, dy / height)));
    const translate = [width / 2 - scale * cx, height / 2 - scale * cy];

    applyTransform(d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale));
  }, [graph, nodes, svgRef, containerRef, livePhysics, d3NodesMapRef]);

  const handleZoomFit = useCallback(() => {
    fitD3NodeSet(fitNodeIds);
  }, [fitNodeIds, fitD3NodeSet]);

  // Main D3 SVG Rendering Pipeline
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;
    const svg = d3.select(svgRef.current);
    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 600;
    const previousTransform = d3.zoomTransform(svgRef.current);
    const topologyKey = JSON.stringify([
      nodes.map((node) => node.id),
      edges.map((edge) => [edge.source, edge.target]),
    ]);
    const shouldFitTopology = lastTopologyKeyRef.current !== topologyKey;

    svg.selectAll('*').remove();

    const defs = svg.append('defs');
    defs
      .append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 10)
      .attr('refY', 0)
      .attr('markerWidth', 8)
      .attr('markerHeight', 8)
      .attr('markerUnits', 'userSpaceOnUse')
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', isDarkMode ? '#888888' : '#666666');

    const zoomGroup = svg.append('g').attr('class', 'zoom-group');
    zoomGroupRef.current = zoomGroup;

    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .extent([[0, 0], [width, height]])
      .scaleExtent([0.000001, 1000])
      .on('zoom', (e) => {
        zoomGroup.attr('transform', e.transform);
      });

    zoomBehaviorRef.current = zoomBehavior;
    svg.call(zoomBehavior as any);

    zoomGroup
      .append('rect')
      .attr('width', width * 100000)
      .attr('height', height * 100000)
      .attr('x', -width * 50000)
      .attr('y', -height * 50000)
      .style('fill', 'transparent')
      .on('click', () => {
        setClickedNode(null);
        setClickedEdge(null);
        if (onClearSelection) onClearSelection();
      });
    // O(1) Map lookup for shared simulation node objects
    const sharedD3NodesMap = d3NodesMapRef?.current;
    const graphNodes = nodes.map((d) => {
      let x = 0, y = 0;
      let sharedNode = sharedD3NodesMap?.get(d.id);
      if (livePhysics && sharedNode) {
        x = sharedNode.x;
        y = sharedNode.y;
      } else if (graph && graph.hasNode(d.id)) {
        x = graph.getNodeAttribute(d.id, 'x');
        y = graph.getNodeAttribute(d.id, 'y');
      } else {
        x = d.x ?? (Math.random() - 0.5) * 600;
        y = d.y ?? (Math.random() - 0.5) * 600;
      }

      const baseRadius = Math.max(2, Number(getNodeSize(d)) || 2);

      if (!sharedNode) {
        sharedNode = {
          id: d.id,
          x,
          y,
          vx: 0,
          vy: 0,
        };
        sharedD3NodesMap?.set(d.id, sharedNode);
      } else if (!livePhysics) {
        // Static-layout recomputations write through Graphology. Keep the
        // shared node cache aligned so an old/paused physics position cannot
        // mask the newly applied offline layout.
        sharedNode.x = x;
        sharedNode.y = y;
        sharedNode.vx = 0;
        sharedNode.vy = 0;
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
      sharedNode.baseRadius = baseRadius;
      return sharedNode;
    });

    // Sigma sizes nodes in screen pixels. D3 circles live inside the zoomed
    // graph coordinate system, so using the same raw radius makes nodes nearly
    // disappear when a large topology is initially fitted (often at k=0.05).
    // Normalize against the transform that will be active after this render;
    // subsequent user zooming can still enlarge/shrink nodes naturally.
    const fitIdSet = new Set(fitNodeIds.length > 0 ? fitNodeIds : graphNodes.map((node: any) => String(node.id)));
    const fittedGraphNodes = graphNodes.filter((node: any) => fitIdSet.has(String(node.id)));
    let referenceScale = Math.max(0.05, Number(previousTransform.k) || 1);
    if (shouldFitTopology && fittedGraphNodes.length === 1) {
      referenceScale = 1.5;
    } else if (shouldFitTopology && fittedGraphNodes.length > 1) {
      const minX = d3.min(fittedGraphNodes, (node: any) => Number(node.x)) ?? 0;
      const maxX = d3.max(fittedGraphNodes, (node: any) => Number(node.x)) ?? 0;
      const minY = d3.min(fittedGraphNodes, (node: any) => Number(node.y)) ?? 0;
      const maxY = d3.max(fittedGraphNodes, (node: any) => Number(node.y)) ?? 0;
      const dx = Math.max(20, maxX - minX);
      const dy = Math.max(20, maxY - minY);
      referenceScale = Math.max(0.1, Math.min(4, 0.75 / Math.max(dx / width, dy / height)));
    }
    graphNodes.forEach((node: any) => {
      node.currentRadius = node.baseRadius / referenceScale;
      node.presentationScale = referenceScale;
    });

    const sharedD3Links = d3LinksRef?.current;
    const renderNodeMap = new Map(graphNodes.map((node: any) => [node.id, node]));
    const endpointId = (endpoint: any) => String(typeof endpoint === 'object' ? endpoint?.id : endpoint);
    const edgeKey = (source: string, target: string) => directed || source <= target
      ? `${source}\u0000${target}`
      : `${target}\u0000${source}`;
    const renderedEdgeKeys = new Set(edges.map((edge) => edgeKey(String(edge.source), String(edge.target))));
    const graphEdges = livePhysics && sharedD3Links?.length
      ? sharedD3Links.flatMap((link: any) => {
          const sourceId = endpointId(link.source);
          const targetId = endpointId(link.target);
          const source = renderNodeMap.get(sourceId);
          const target = renderNodeMap.get(targetId);
          if (!source || !target || !renderedEdgeKeys.has(edgeKey(sourceId, targetId))) return [];
          const rawEdge = link.rawEdge || edges.find((edge) => (
            edgeKey(String(edge.source), String(edge.target)) === edgeKey(sourceId, targetId)
          )) || {
            source: sourceId,
            target: targetId,
            weight_raw: Number(link.weight ?? link.weight_raw ?? 1),
            weight_secondary: Number(link.weight_secondary ?? 0),
          };
          return [{ ...link, source, target, rawEdge }];
        })
      : edges
          .map((edge) => ({
            source: renderNodeMap.get(edge.source),
            target: renderNodeMap.get(edge.target),
            rawEdge: edge,
            weight: edge.weight_raw ?? 1,
          }))
          .filter((edge) => edge.source && edge.target);

    const selectedNeighborSet = new Set<string>();
    if (clickedNode && graph?.hasNode(clickedNode.id)) {
      graph.neighbors(clickedNode.id).forEach((id) => selectedNeighborSet.add(String(id)));
    }
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const searchMatchSet = new Set<string>();
    if (normalizedSearch) {
      graphNodes.forEach((node: any) => {
        if (String(node.id).toLowerCase().includes(normalizedSearch)
          || String(node.label || node.name || '').toLowerCase().includes(normalizedSearch)) {
          searchMatchSet.add(String(node.id));
        }
      });
    }
    const presentationContext: D3PresentationContext = {
      bipartite,
      directed,
      hiddenItems,
      isolatedLegendItem,
      selectedCommunityId,
      isolatedCommunityId,
      hoveredCommunityId,
      displayMap,
      clickedNodeId: clickedNode?.id || null,
      clickedEdge,
      selectedNeighborSet,
      searchMatchSet,
      focusedEdgeNodeSet,
      showNodeLabels,
      nodeOpacity,
    };
    const nodePresentation = new Map(graphNodes.map((node: any) => [
      String(node.id),
      getD3NodePresentation(node as RawNode, presentationContext),
    ]));
    const edgePresentation = (edge: any) => {
      const source = endpointId(edge.source);
      const target = endpointId(edge.target);
      const rawEdge = (edge.rawEdge || edge) as RawEdge;
      return getD3EdgePresentation(
        source,
        target,
        rawEdge,
        getEdgeOpacity(rawEdge),
        presentationContext,
        nodePresentation,
      );
    };

    const link = zoomGroup
      .append('g')
      .attr('fill', 'none')
      .selectAll('path')
      .data(graphEdges)
      .join('path')
      .attr('class', 'graph-link')
      .style('cursor', 'pointer')
      .style('display', (d: any) => edgePresentation(d).hidden ? 'none' : null)
      .attr('stroke', (d: any) => getEdgeColor(d.rawEdge || d))
      .attr('stroke-opacity', (d: any) => edgePresentation(d).opacity)
      .attr('stroke-width', (d: any) => `${Math.max(0.25, Number(getEdgeSize(d.rawEdge || d)) || 0.25)}px`)
      .attr('marker-end', (d: any) => (
        directed && getShouldShowArrowhead(d.rawEdge || d)
          ? 'url(#arrowhead)'
          : null
      ))
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
      .style('display', (d: any) => nodePresentation.get(String(d.id))?.hidden ? 'none' : null)
      .attr('transform', (d: any) => `translate(${d.x},${d.y})`);

    nodeGroupRef.current = nodeGroup as any;

    const strokeColor = isDarkMode ? '#ffffff' : '#141414';

    nodeGroup.each(function (d: any) {
      const g = d3.select(this);
      const isSquare = isSecondaryNode(d, bipartite);
      const presentation = nodePresentation.get(String(d.id));
      const strokeWidth = presentation?.focused ? 2.5 : presentation?.neighbor || presentation?.communityMember ? 2 : 1.5;

      if (isSquare) {
        g.append('rect')
          .attr('class', 'node-shape')
          .attr('x', -d.currentRadius)
          .attr('y', -d.currentRadius)
          .attr('width', d.currentRadius * 2)
          .attr('height', d.currentRadius * 2)
          .attr('rx', Math.min(3, d.baseRadius * 0.2) / d.presentationScale)
          .attr('ry', Math.min(3, d.baseRadius * 0.2) / d.presentationScale)
          .attr('fill', getNodeColor(d))
          .attr('opacity', presentation?.opacity ?? nodeOpacity)
          .attr('stroke', strokeColor)
          .attr('stroke-width', strokeWidth / d.presentationScale)
          .style('cursor', 'pointer');
      } else {
        g.append('circle')
          .attr('class', 'node-shape')
          .attr('r', d.currentRadius)
          .attr('fill', getNodeColor(d))
          .attr('opacity', presentation?.opacity ?? nodeOpacity)
          .attr('stroke', strokeColor)
          .attr('stroke-width', strokeWidth / d.presentationScale)
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
      .attr('text-anchor', (d: any) => (d.baseRadius >= 14 ? 'middle' : 'start'))
      .attr('dx', (d: any) => (d.baseRadius >= 14 ? 0 : d.currentRadius + (4 / d.presentationScale)))
      .attr('dy', '0.3em')
      .attr('font-size', (d: any) => `${10 / d.presentationScale}px`)
      .attr('font-family', 'var(--f-mono)')
      .attr('font-weight', 'bold')
      .attr('fill', isDarkMode ? '#ffffff' : '#141414')
      .style('pointer-events', 'none')
      .style('display', (d: any) => nodePresentation.get(String(d.id))?.labelVisible ? 'block' : 'none');

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
          const dist = Math.hypot(dx, dy);
          if (dist > 0) {
            // A quadratic curve gives a stable tangent at each endpoint. Trim
            // both ends along those tangents so the arrow tip terminates at
            // the target node boundary instead of its center.
            const normalX = -dy / dist;
            const normalY = dx / dist;
            const bend = Math.min(80, Math.max(12, dist * 0.2));
            const controlX = (sx + tx) / 2 + normalX * bend;
            const controlY = (sy + ty) / 2 + normalY * bend;

            const sourceTangentX = controlX - sx;
            const sourceTangentY = controlY - sy;
            const sourceTangentLength = Math.hypot(sourceTangentX, sourceTangentY) || 1;
            const targetTangentX = tx - controlX;
            const targetTangentY = ty - controlY;
            const targetTangentLength = Math.hypot(targetTangentX, targetTangentY) || 1;
            const boundaryDistance = (node: any, tangentX: number, tangentY: number, tangentLength: number) => {
              const radius = Math.max(0, Number(node.currentRadius) || 0) + 1;
              const isSquare = isSecondaryNode(node, bipartite);
              if (!isSquare) return radius;
              const unitX = Math.abs(tangentX / tangentLength);
              const unitY = Math.abs(tangentY / tangentLength);
              return radius / Math.max(unitX, unitY, 0.0001);
            };
            const sourceRadius = boundaryDistance(d.source, sourceTangentX, sourceTangentY, sourceTangentLength);
            const targetRadius = boundaryDistance(d.target, targetTangentX, targetTangentY, targetTangentLength);
            const startX = sx + (sourceTangentX / sourceTangentLength) * sourceRadius;
            const startY = sy + (sourceTangentY / sourceTangentLength) * sourceRadius;
            const endX = tx - (targetTangentX / targetTangentLength) * targetRadius;
            const endY = ty - (targetTangentY / targetTangentLength) * targetRadius;

            return `M${startX},${startY}Q${controlX},${controlY} ${endX},${endY}`;
          }
        }
        return `M${sx},${sy}L${tx},${ty}`;
      });
    };

    tickDrawRef.current = tickDraw;
    tickDraw();
    if (pendingFitRef.current) {
      const pending = pendingFitRef.current;
      pendingFitRef.current = null;
      fitD3NodeSet(pending.nodeIds, pending.duration, true);
    } else if (shouldFitTopology) {
      fitD3NodeSet(fitNodeIds.length > 0 ? fitNodeIds : graphNodes.map((node: any) => node.id), 0, true);
    } else {
      svg.call(zoomBehavior.transform, previousTransform);
    }
    lastTopologyKeyRef.current = topologyKey;
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
    layoutRevision,
    containerRef,
    svgRef,
    fitD3NodeSet,
    nodeOpacity,
    isDarkMode,
    searchQuery,
    hiddenItems,
    isolatedLegendItem,
    selectedCommunityId,
    isolatedCommunityId,
    hoveredCommunityId,
    showArrowheads,
    showNodeLabels,
    getShouldShowArrowhead,
    getNodeColor,
    getEdgeColor,
    getEdgeOpacity,
    displayMap,
    clickedNode,
    clickedEdge,
    focusedEdgeNodeSet,
    fitNodeIds,
    getNodeSize,
    getEdgeSize,
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
    fitD3NodeSet,
  };
}
