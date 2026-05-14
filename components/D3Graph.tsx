'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { RawNode, RawEdge } from '@/store/useStore';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface D3GraphProps {
  nodes: RawNode[];
  edges: RawEdge[];
  communityMap: Record<string, string>;
  nodeSizeMult: number;
  edgeWeightMult?: number;
  nodeOpacity?: number;
  edgeOpacity?: number;
  nodeSizeBase?: string;
  edgeWeightBase?: string;
  forceStrength: number;
  directed: boolean;
  bipartite: boolean;
  livePhysics?: boolean;
  isFrozen?: boolean;
  isDarkMode?: boolean;
  refreshKey?: number;
  onRefresh?: () => void;
}

export default function D3Graph({ nodes, edges, communityMap, nodeSizeMult, edgeWeightMult = 1, nodeOpacity = 1, edgeOpacity = 0.8, nodeSizeBase = 'abundance', edgeWeightBase = 'weight_raw', forceStrength, directed, bipartite, livePhysics, isFrozen, isDarkMode, refreshKey, onRefresh }: D3GraphProps) {
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
  
  const [hiddenItems, setHiddenItems] = useState<Set<string>>(new Set());
  const [isLegendMinimized, setIsLegendMinimized] = useState(false);
  const clickTimers = useRef<{[key: string]: NodeJS.Timeout}>({});
  const clickedNodeRef = useRef<RawNode | null>(null);
  const tickDrawRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    clickedNodeRef.current = clickedNode;
  }, [clickedNode]);

  
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHiddenItems(new Set());
    setClickedNode(null);
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
  const communityColors = Array.from(new Set(Object.values(communityMap))) as string[];
  const communityLegendIds = communityColors.map(c => `community:${c}`);

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
      
      let baseVal = 10;
      if (nodeSizeBase === 'abundance') baseVal = gNode.abundance || 10;
      else if (nodeSizeBase === 'degree') baseVal = (degreeMap[d.id] || 0) * 5;
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
        weight: w 
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
      .attr('stroke', isDarkMode ? '#eeeeee' : '#141414')
      .attr('stroke-opacity', 0.25)
      .attr('fill', 'none')
      .selectAll('path')
      .data(graphLinks)
      .join('path')
      .attr('class', 'graph-link')
      .attr('stroke-width', (d: any) => {
         d._defaultStrokeWidth = Math.min(strokeWidthScale(d.weight || 1), 4) * edgeWeightMult;
         return d._defaultStrokeWidth;
      })
      .attr("marker-end", (directed && graphLinks.length < 500) ? "url(#arrowhead)" : null);

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
          .attr('fill', (d: any) => communityMap[d.id] || defaultNodeColor)
          .attr('stroke', isDarkMode ? '#222' : '#141414')
          .attr('stroke-width', 0.5)
          .style('cursor', 'pointer');
      } else {
        return selection.append('circle')
          .attr('class', 'node-shape')
          .attr('r', (d: any) => d.currentRadius)
          .attr('fill', (d: any) => communityMap[d.id] || defaultNodeColor)
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
    
    if (livePhysics && !isFrozen) {
      sim.alpha(1).restart();
    } else {
      sim.stop();
    }
  }, [livePhysics, isFrozen]);

  // 3. Fast Dark Mode Styling Update
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    
    const defaultNodeColor = isDarkMode ? '#bbbbbb' : '#141414';
    
    svg.selectAll('.graph-link')
      .attr('stroke', isDarkMode ? '#eeeeee' : '#141414');

    svg.selectAll('.node-shape')
      .attr('fill', (d: any) => communityMap[d.id] || defaultNodeColor)
      .attr('stroke', isDarkMode ? '#222' : '#141414');

    svg.selectAll('.node-label')
      .attr("fill", (d: any) => d.currentRadius >= 14 ? (isDarkMode ? "#222" : "#fff") : (isDarkMode ? "#ddd" : "#141414"));

    svg.selectAll('.arrowhead-path')
      .attr("fill", isDarkMode ? "#eeeeee" : "#141414")
      .attr("opacity", isDarkMode ? 0.9 : 0.6);
  }, [isDarkMode, communityMap]);

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

    nodeGroup.style('opacity', (d: any) => {
      if (isNodeHidden(d)) return 0;
      if (clickedNode) {
        const neighbors = adjacencyList[clickedNode.id] || new Set();
        return (d.id === clickedNode.id || neighbors.has(d.id)) ? nodeOpacity : nodeOpacity * 0.1;
      }
      return nodeOpacity;
    }).style('display', (d: any) => isNodeHidden(d) ? 'none' : '');

    link.style('opacity', (d: any) => {
      if (hiddenItems.has('element:edges')) return 0;
      const srcId = typeof d.source === 'object' ? d.source.id : d.source;
      const tgtId = typeof d.target === 'object' ? d.target.id : d.target;

      if (clickedNode) {
        return (srcId === clickedNode.id || tgtId === clickedNode.id) ? edgeOpacity : edgeOpacity * 0.1;
      }
      return edgeOpacity;
    }).style('display', (d: any) => {
      if (hiddenItems.has('element:edges')) return 'none';
      return '';
    }).style('stroke-width', (d: any) => {
      if (clickedNode) {
        const src = typeof d.source === 'object' ? d.source.id : d.source;
        const tgt = typeof d.target === 'object' ? d.target.id : d.target;
        return (src === clickedNode.id || tgt === clickedNode.id) ? `${Math.min((d._defaultStrokeWidth || 1) * 1.5, 6)}px` : null;
      }
      return null;
    }).attr('marker-end', (d: any) => {
      if (!directed) return null;
      if (clickedNode) {
        const srcId = typeof d.source === 'object' ? d.source.id : d.source;
        const tgtId = typeof d.target === 'object' ? d.target.id : d.target;
        if (srcId === clickedNode.id || tgtId === clickedNode.id) return "url(#arrowhead)";
      } else if (edges.length < 500) {
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
      return 1;
    }).style('display', (d: any) => {
      if (isNodeHidden(d)) return 'none';
      if (clickedNode) {
        const neighbors = adjacencyList[clickedNode.id] || new Set();
        return (d.id === clickedNode.id || neighbors.has(d.id)) ? 'block' : 'none';
      }
      return showLabels ? 'block' : 'none';
    });

    if (tickDrawRef.current) {
        tickDrawRef.current();
    }

  }, [clickedNode, hiddenItems, communityMap, nodes, bipartite, refreshKey, isDarkMode, directed, edges.length, nodeOpacity, edgeOpacity]);

  return (
    <div ref={containerRef} className="w-full h-full relative cursor-crosshair">
      <svg ref={svgRef} className="w-full h-full block" />
      
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
                            <div className="w-3 h-3 inline-block align-middle ml-1" style={{backgroundColor: communityMap[clickedNode.id] || (isDarkMode ? '#bbbbbb' : '#141414')}}></div>
                        </span>
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

            {communityColors.length > 0 && (
            <div>
              <div className="opacity-50 uppercase font-bold mb-1 flex items-center justify-between">
                <span>Communities</span>
              </div>
              <div className="space-y-1 max-h-[150px] overflow-y-auto pr-1">
                {communityColors.map((color, i) => {
                  const id = `community:${color}`;
                  const isHidden = hiddenItems.has(id);
                  return (
                    <div 
                      key={i} 
                      className={`flex items-center space-x-2 cursor-pointer p-1 -mx-1 rounded-sm transition-opacity ${isHidden ? 'opacity-40 line-through' : 'opacity-100 hover:bg-black/5 dark:hover:bg-white/10'}`}
                      onClick={(e) => handleLegendClick(e, id, communityLegendIds)}
                    >
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }}></div>
                      <span>Cluster {i + 1}</span>
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
