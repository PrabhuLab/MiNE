'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { RawNode, RawEdge } from '@/store/useStore';
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
  isFrozen?: boolean;
  isDarkMode?: boolean;
  refreshKey?: number;
  onRefresh?: () => void;
  onElementDoubleClick?: (id: string, type: "node" | "edge") => void;
  onClearSelection?: () => void;
  searchQuery?: string;
  selectedElement?: string | null;
}

export default function D3Graph({ nodes, edges, communityMap, networkMetrics = [], nodeSizeMult, nodeSizeBase = 'abundance', nodeColorBase = 'community', edgeWeightMult = 1, edgeWeightBase = 'weight_raw', edgeColorBase = 'uniform', nodeOpacity = 1, edgeOpacity = 0.8, edgeOpacityBase = 'uniform', forceStrength, directed, bipartite, livePhysics, isFrozen, isDarkMode, refreshKey, onRefresh, onElementDoubleClick, onClearSelection, searchQuery = "", selectedElement = null }: D3GraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<any, any> | null>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  
  

  const runtimeRef = useRef({ livePhysics, isFrozen });
  useEffect(() => {
    runtimeRef.current = { livePhysics, isFrozen };
  }, [livePhysics, isFrozen]);

  const [clickedNode, setClickedNode] = useState<RawNode | null>(null);
  const [clickedDegree, setClickedDegree] = useState<number>(0);
  const [clickedEdge, setClickedEdge] = useState<RawEdge | null>(null);
  
  const [hiddenItems, setHiddenItems] = useState<Set<string>>(new Set());
  const [isLegendMinimized, setIsLegendMinimized] = useState(false);
  const clickTimers = useRef<{[key: string]: NodeJS.Timeout}>({});
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
    setHiddenItems(new Set());
    setClickedNode(null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [refreshKey]);

  const adjacencyListRef = useRef<Record<string, Set<string>>>({});

  const handleLegendClick = (e: React.MouseEvent, id: string, categoryIds: string[]) => {
    e.stopPropagation();
    if (clickTimers.current[id]) {
      clearTimeout(clickTimers.current[id]);
      delete clickTimers.current[id];
      // Double click: Isolate this item within its category, or reset if already isolated
      setHiddenItems(prev => {
        const next = new Set(prev);
        
        // Check if it's already exactly isolated (all others hidden, this one shown)
        let isIsolated = !prev.has(id);
        if (isIsolated) {
          for (const cid of categoryIds) {
            if (cid !== id && !prev.has(cid)) {
              isIsolated = false;
              break;
            }
          }
        }
        
        if (isIsolated) {
          // Reset: show all in category
          categoryIds.forEach(cid => next.delete(cid));
        } else {
          // Isolate: hide all except id
          categoryIds.forEach(cid => {
            if (cid !== id) next.add(cid);
            else next.delete(cid);
          });
        }
        
        return next;
      });
    } else {
      clickTimers.current[id] = setTimeout(() => {
        delete clickTimers.current[id];
        // Single click: Toggle
        setHiddenItems(prev => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        });
      }, 250);
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
  const communityLabels = useMemo(() => (Array.from(new Set(Object.values(communityMap))) as string[]).sort((a, b) => 
    a.toString().localeCompare(b.toString(), undefined, { numeric: true, sensitivity: 'base' })
  ), [communityMap]);
  const communityLegendIds = communityLabels.map(c => `community:${c}`);
  
  const communityColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    communityLabels.forEach((label, i) => {
      map[label] = COMMUNITY_COLORS[i % COMMUNITY_COLORS.length] || COMMUNITY_COLORS[0];
    });
    return map;
  }, [communityLabels]);

  const typeColorScale = useMemo(() => d3.scaleOrdinal(d3.schemeCategory10), []);

  const maxEigen = useMemo(() => d3.max(networkMetrics, (d: any) => parseFloat(d.eigenvector)) || 1, [networkMetrics]);
  const minEigen = useMemo(() => d3.min(networkMetrics, (d: any) => parseFloat(d.eigenvector)) || 0, [networkMetrics]);
  const maxPageRank = useMemo(() => d3.max(networkMetrics, (d: any) => parseFloat(d.pagerank)) || 1, [networkMetrics]);
  const minPageRank = useMemo(() => d3.min(networkMetrics, (d: any) => parseFloat(d.pagerank)) || 0, [networkMetrics]);

  const eigenColorScale = useMemo(() => d3.scaleSequential(isDarkMode ? d3.interpolatePurples : d3.interpolatePurples).domain([minEigen, maxEigen]), [isDarkMode, minEigen, maxEigen]);
  const prColorScale = useMemo(() => d3.scaleSequential(isDarkMode ? d3.interpolateGreens : d3.interpolateGreens).domain([minPageRank, maxPageRank]), [isDarkMode, minPageRank, maxPageRank]);

  const getNodeColor = useCallback((d: any) => {
    const net = networkMetrics.find(m => m.id === d.id);
    const defaultNodeColor = isDarkMode ? '#bbbbbb' : '#141414';
    if (nodeColorBase === 'community') return communityColorMap[communityMap[d.id]] || defaultNodeColor;
    if (nodeColorBase === 'type' && d.type) return typeColorScale(d.type);
    if (nodeColorBase === 'eigenvector' && net?.eigenvector !== undefined) return eigenColorScale(parseFloat(net.eigenvector));
    if (nodeColorBase === 'pagerank' && net?.pagerank !== undefined) return prColorScale(parseFloat(net.pagerank));
    return defaultNodeColor;
  }, [isDarkMode, nodeColorBase, communityColorMap, communityMap, typeColorScale, eigenColorScale, prColorScale, networkMetrics]);

  const maxRaw = useMemo(() => d3.max(edges, (d: any) => Number(d.weight_raw) || 0) || 1, [edges]);
  const maxSec = useMemo(() => d3.max(edges, (d: any) => Number(d.weight_secondary) || 0) || 1, [edges]);
  const rawColorScale = useMemo(() => d3.scaleSequential(isDarkMode ? d3.interpolateGnBu : d3.interpolateBlues).domain([0, maxRaw]), [isDarkMode, maxRaw]);
  const secColorScale = useMemo(() => d3.scaleSequential(isDarkMode ? d3.interpolateOrRd : d3.interpolateOranges).domain([0, maxSec]), [isDarkMode, maxSec]);

  const getEdgeColor = useCallback((d: any) => {
    if (edgeColorBase === 'weight_raw' && d.weight_raw !== undefined) return rawColorScale(Number(d.weight_raw));
    if (edgeColorBase === 'weight_secondary' && d.weight_secondary !== undefined) return secColorScale(Number(d.weight_secondary));
    return isDarkMode ? '#eeeeee' : '#141414';
  }, [edgeColorBase, rawColorScale, secColorScale, isDarkMode]);

  const getEdgeOpacity = useCallback((d: any) => {
    if (edgeOpacityBase === 'weight_raw' && d.weight_raw !== undefined) return 0.1 + 0.9 * (Number(d.weight_raw) / maxRaw);
    if (edgeOpacityBase === 'weight_secondary' && d.weight_secondary !== undefined) return 0.1 + 0.9 * (Number(d.weight_secondary) / maxSec);
    return edgeOpacity;
  }, [edgeOpacityBase, maxRaw, maxSec, edgeOpacity]);

  const handleZoomFit = () => {
    if (!svgRef.current || !zoomBehaviorRef.current || !simulationRef.current || !containerRef.current) return;
    const svg = d3.select(svgRef.current);
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    
    const graphNodes = simulationRef.current.nodes();
    if(graphNodes.length === 0) return;
    
    const minX = d3.min(graphNodes, d => d.x - (d.currentRadius || 0)) || 0;
    const minY = d3.min(graphNodes, d => d.y - (d.currentRadius || 0)) || 0;
    const maxX = d3.max(graphNodes, d => d.x + (d.currentRadius || 0)) || 0;
    const maxY = d3.max(graphNodes, d => d.y + (d.currentRadius || 0)) || 0;

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
      .scaleExtent([0.1, 4])
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

    // Deep copy data for D3 mutation
    const graphNodes = nodes.map(d => {
      const gNode: any = { ...d };
      const net = networkMetrics.find(m => m.id === d.id);
      
      let baseVal = 10;
      if (nodeSizeBase === 'abundance') baseVal = gNode.abundance || 10;
      else if (nodeSizeBase === 'degree') baseVal = (degreeMap[d.id] || 0) * 5;
      else if (nodeSizeBase === 'eigenvector') baseVal = (parseFloat(net?.eigenvector || "0")) * 50;
      else if (nodeSizeBase === 'pagerank') baseVal = (parseFloat(net?.pagerank || "0")) * 500;
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
      .force('collide', d3.forceCollide().radius((d: any) => d.currentRadius + 2).iterations(2));

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
      .attr("marker-end", (directed && graphLinks.length < 500) ? "url(#arrowhead)" : null)
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
        if (onElementDoubleClick) {
          const srcId = typeof d.source === 'object' ? d.source.id : d.source;
          const tgtId = typeof d.target === 'object' ? d.target.id : d.target;
          onElementDoubleClick(`${srcId}-${tgtId}`, "edge");
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
      const defaultNodeColor = isDarkMode ? '#bbbbbb' : '#141414';
      if (isSquare) {
        return selection.append('rect')
          .attr('class', 'node-shape')
          .attr('x', (d: any) => -d.currentRadius)
          .attr('y', (d: any) => -d.currentRadius)
          .attr('width', (d: any) => d.currentRadius * 2)
          .attr('height', (d: any) => d.currentRadius * 2)
          .attr('fill', (d: any) => getNodeColor(d))
          .attr('stroke', isDarkMode ? '#222' : '#141414')
          .attr('stroke-width', 0.5)
          .style('cursor', 'pointer');
      } else {
        return selection.append('circle')
          .attr('class', 'node-shape')
          .attr('r', (d: any) => d.currentRadius)
          .attr('fill', (d: any) => getNodeColor(d))
          .attr('stroke', isDarkMode ? '#222' : '#141414')
          .attr('stroke-width', 0.5)
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
        if (onElementDoubleClick) onElementDoubleClick(d.id, "node");
      });
    };

    attachClickEvent(shapeAClickParams);
    attachClickEvent(shapeBClickParams);

    // Add labels (only if node count is small or emphasize on large nodes)
    const showLabels = graphNodes.length < 300;
    nodeGroup.append('text')
      .text((d: any) => d.label || d.name || d.id)
      .attr('class', 'node-label')
      .attr("text-anchor", (d: any) => d.currentRadius >= 14 ? "middle" : "start")
      .attr("dx", (d: any) => d.currentRadius >= 14 ? 0 : d.currentRadius + 4)
      .attr("dy", "0.3em")
      .attr('font-size', '10px')
      .attr('font-family', 'var(--f-mono)')
      .attr('font-weight', 'bold')
      .attr("fill", (d: any) => d.currentRadius >= 14 ? (isDarkMode ? "#222" : "#fff") : (isDarkMode ? "#ddd" : "#141414"))
      .style('pointer-events', 'none')
      .style('display', showLabels ? 'block' : 'none');

    // Simulation Tick
    const defaultArrows = directed && graphLinks.length < 500;
    const tickDraw = () => {
      link.attr('d', (d: any) => {
        let targetX = d.target.x;
        let targetY = d.target.y;
        
        let showArrow = defaultArrows;
        if (clickedNodeRef.current) {
          const srcId = typeof d.source === 'object' ? d.source.id : d.source;
          const tgtId = typeof d.target === 'object' ? d.target.id : d.target;
          showArrow = directed && (srcId === clickedNodeRef.current.id || tgtId === clickedNodeRef.current.id);
        } else if (clickedEdgeRef.current) {
          const srcId = typeof d.source === 'object' ? d.source.id : d.source;
          const tgtId = typeof d.target === 'object' ? d.target.id : d.target;
          const cEdgeSrc = typeof clickedEdgeRef.current.source === 'object' ? (clickedEdgeRef.current.source as any).id : clickedEdgeRef.current.source;
          const cEdgeTgt = typeof clickedEdgeRef.current.target === 'object' ? (clickedEdgeRef.current.target as any).id : clickedEdgeRef.current.target;
          showArrow = directed && (srcId === cEdgeSrc && tgtId === cEdgeTgt);
        }

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
      if (runtimeRef.current.livePhysics && !runtimeRef.current.isFrozen) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      }
    }
    
    function dragged(event: any, d: any) {
      if (runtimeRef.current.livePhysics && !runtimeRef.current.isFrozen) {
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
      if (runtimeRef.current.livePhysics && !runtimeRef.current.isFrozen) {
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
       simulation.alpha(1).restart();
    } else if (isFrozen) {
       simulation.stop();
       tickDraw();
    } else {
       // Static mode: compute synchronously to prevent lag from constant re-rendering
       simulation.stop();
       for (let i = 0; i < 300; i++) {
          simulation.tick();
       }
       tickDraw();
    }

    return () => {
      simulation.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, communityMap, forceStrength, nodeSizeMult, directed, bipartite, refreshKey]);

  // 2. Play/Pause/Freeze Physics
  useEffect(() => {
    const sim = simulationRef.current;
    if (!sim) return;
    
    if (isFrozen) {
      sim.stop();
    } else if (livePhysics) {
      sim.alpha(1).restart();
    }
    // If not livePhysics but not frozen, let it settle naturally.
  }, [livePhysics, isFrozen]);

  // 3. Fast Dark Mode Styling Update
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    
    const defaultNodeColor = isDarkMode ? '#bbbbbb' : '#141414';
    
    svg.selectAll('.graph-link')
      .attr('stroke', isDarkMode ? '#eeeeee' : '#141414');

    svg.selectAll('.node-shape')
      .attr('fill', (d: any) => getNodeColor(d))
      .attr('stroke', isDarkMode ? '#222' : '#141414');

    svg.selectAll('.node-label')
      .attr("fill", (d: any) => d.currentRadius >= 14 ? (isDarkMode ? "#222" : "#fff") : (isDarkMode ? "#ddd" : "#141414"));

    svg.selectAll('.arrowhead-path')
      .attr("fill", isDarkMode ? "#eeeeee" : "#141414")
      .attr("opacity", isDarkMode ? 0.9 : 0.6);
  }, [isDarkMode, communityMap, communityColorMap, getNodeColor]);

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
      
      const comm = communityMap[d.id];
      if (comm && hiddenItems.has(`community:${comm}`)) return true;
      
      return false;
    };

    const hiddenNodeIds = new Set<string>();
    nodes.forEach(n => {
       if (isNodeHidden(n)) hiddenNodeIds.add(n.id);
    });

    const adjacencyList = adjacencyListRef.current;
    const showLabels = nodes.length < 300;
    
    const q = searchQuery.toLowerCase();

    nodeGroup.style('opacity', (d: any) => {
      if (isNodeHidden(d)) return 0;
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
      if (!directed) return null;
      const srcId = typeof d.source === 'object' ? d.source.id : d.source;
      const tgtId = typeof d.target === 'object' ? d.target.id : d.target;
      if (clickedNode && (srcId === clickedNode.id || tgtId === clickedNode.id)) {
        return "url(#arrowhead)";
      }
      if (clickedEdge) {
        const cSrc = typeof clickedEdge.source === 'object' ? (clickedEdge.source as any).id : clickedEdge.source;
        const cTgt = typeof clickedEdge.target === 'object' ? (clickedEdge.target as any).id : clickedEdge.target;
        if (srcId === cSrc && tgtId === cTgt) {
          return "url(#arrowhead)";
        }
      }
      if (selectedElement && (`${srcId}-${tgtId}` === selectedElement || srcId === selectedElement || tgtId === selectedElement)) {
        return "url(#arrowhead)";
      }
      if (q && (String(srcId).toLowerCase().includes(q) || String(tgtId).toLowerCase().includes(q))) {
        return "url(#arrowhead)";
      }
      if (!clickedNode && !clickedEdge && !q && !selectedElement && edges.length < 500) {
        return "url(#arrowhead)";
      }
      return null;
    });

    labels.style('opacity', (d: any) => {
      if (isNodeHidden(d)) return 0;
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
      if (isNodeHidden(d)) return 'none';
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

  }, [clickedNode, clickedEdge, selectedElement, hiddenItems, communityMap, nodes, bipartite, refreshKey, isDarkMode, directed, edges.length, nodeOpacity, edgeOpacity, searchQuery, getEdgeOpacity, getEdgeColor, edgeWeightBase, edgeWeightMult, maxRaw, maxSec]);

  return (
    <div ref={containerRef} className="w-full h-full relative cursor-crosshair">
      <svg ref={svgRef} id="network-graph-svg" className="w-full h-full block" />
      
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

      {clickedNode && (
        <div className="absolute bottom-6 right-6 flex space-x-2">
            <div className={`p-3 w-48 shadow-none border transition-colors ${
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
                        <span className="opacity-50 uppercase font-bold">DEGREE</span>
                        <span className="font-mono font-bold">{clickedDegree}</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                        <span className="opacity-50 uppercase font-bold">COMMUNITY</span>
                        <span className="font-mono font-bold">
                            <div className="w-3 h-3 inline-block align-middle ml-1" style={{backgroundColor: communityColorMap[communityMap[clickedNode.id]] || (isDarkMode ? '#bbbbbb' : '#141414')}}></div>
                        </span>
                    </div>
                </div>
            </div>
        </div>
      )}

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
                  const isHidden = hiddenItems.has(item.id);
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
              </div>
            </div>

            {communityLabels.length > 0 && (
            <div>
              <div className="opacity-50 uppercase font-bold mb-1 flex items-center justify-between">
                <span>Communities</span>
              </div>
              <div className="space-y-1 max-h-[150px] overflow-y-auto pr-1">
                {communityLabels.map((label, i) => {
                  const id = `community:${label}`;
                  const isHidden = hiddenItems.has(id);
                  return (
                    <div 
                      key={i} 
                      className={`flex items-center space-x-2 cursor-pointer p-1 -mx-1 rounded-sm transition-opacity ${isHidden ? 'opacity-40 line-through' : 'opacity-100 hover:bg-black/5 dark:hover:bg-white/10'}`}
                      onClick={(e) => handleLegendClick(e, id, communityLegendIds)}
                    >
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: communityColorMap[label] }}></div>
                      <span>{label}</span>
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
