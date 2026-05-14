'use client';

import React, { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useStore, RawNode, RawEdge } from '@/store/useStore';
import Graph from 'graphology';
import louvainPkg from 'graphology-communities-louvain';
import * as d3 from 'd3';
import seedrandomPkg from 'seedrandom';
import { normalize_communities } from '@/lib/communityUtils';
import { ChevronLeft, ChevronRight, Sun, Moon } from 'lucide-react';

// Handle Next.js ESM/CJS interop for graphology-communities-louvain
const louvain = (typeof louvainPkg === 'function') ? louvainPkg : (louvainPkg as any).default || louvainPkg;
const seedrandom = (typeof seedrandomPkg === 'function') ? seedrandomPkg : (seedrandomPkg as any).default || seedrandomPkg;


// Dynamically import D3Graph so it only runs on the client due to canvas/SVG dependencies
const D3Graph = dynamic(() => import('./D3Graph'), { ssr: false });

const SyncInput = ({ value, onChange, step, className }: any) => {
  const [localVal, setLocalVal] = useState(value);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setLocalVal(value), [value]);

  return (
    <input 
      type="number"
      className={`text-inherit ${className}`}
      value={localVal}
      onChange={e => setLocalVal(e.target.value)}
      onBlur={() => onChange(Number(localVal))}
      onKeyDown={e => e.key === 'Enter' && onChange(Number(localVal))}
      step={step}
    />
  );
};

const SyncTextInput = ({ value, onChange, className, placeholder }: any) => {
  const [localVal, setLocalVal] = useState(value);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setLocalVal(value), [value]);

  return (
    <input 
      type="text"
      className={`text-inherit ${className}`}
      value={localVal}
      onChange={e => setLocalVal(e.target.value)}
      onBlur={() => onChange(localVal)}
      onKeyDown={e => e.key === 'Enter' && onChange(localVal)}
      placeholder={placeholder}
    />
  );
};

const SegmentedToggle = ({ checked, onChange, isDarkMode }: any) => {
  return (
    <div 
      onClick={() => onChange(!checked)}
      className={`cursor-pointer flex items-center border text-[9px] font-bold uppercase transition-colors ${
        isDarkMode ? 'border-[#555]' : 'border-[#ccc]'
      }`}
    >
      <div className={`px-2 py-1 ${!checked ? (isDarkMode ? 'bg-[#E4E3E0] text-[#141414]' : 'bg-[#141414] text-white') : 'opacity-50'}`}>OFF</div>
      <div className={`px-2 py-1 ${checked ? (isDarkMode ? 'bg-[#b4ff39] text-[#141414]' : 'bg-[#141414] text-white') : 'opacity-50'}`}>ON</div>
    </div>
  );
};

const CustomSlider = ({ min, max, step, value, onChange, isDarkMode }: any) => {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className={`w-full h-1 appearance-none outline-none cursor-pointer rounded-full ${
        isDarkMode
          ? 'bg-[#555] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-[#b4ff39] [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-[#b4ff39] [&::-webkit-slider-thumb]:rounded-full [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:bg-[#b4ff39] [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:rounded-full'
          : 'bg-[#ccc] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-[#141414] [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-[#141414] [&::-webkit-slider-thumb]:rounded-full [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:bg-[#141414] [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:rounded-full'
      }`}
    />
  );
};

export default function Workspace() {
  const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

  const { rawNodes, rawEdges, filters, setFilter, communityMap, setCommunityMap, directed, bipartite, isDarkMode, setIsDarkMode } = useStore();
  
  const [refreshKey, setRefreshKey] = useState(0);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [nodeMetrics, setNodeMetrics] = useState<any[]>([]);
  const [networkMetrics, setNetworkMetrics] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'graph' | 'data'>('graph');

  // When live physics is toggled, force a full refresh (reset layout)
  useEffect(() => {
    rawNodes.forEach((n: any) => {
      n.x = undefined;
      n.y = undefined;
      n.vx = undefined;
      n.vy = undefined;
      n.fx = undefined;
      n.fy = undefined;
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRefreshKey(k => k + 1);
  }, [filters.livePhysics, rawNodes]);

  // Compute max relative weight for slider dynamically
  const maxRelWeight = useMemo(() => {
    if (!rawEdges || rawEdges.length === 0) return 100;
    const m = d3.max(rawEdges, e => e.weight_secondary);
    return m ? Number(m.toFixed(2)) : 100;
  }, [rawEdges]);

  // Compute max absolute weight for slider dynamically
  const maxRawWeight = useMemo(() => {
    if (!rawEdges || rawEdges.length === 0) return 500;
    const m = d3.max(rawEdges, e => e.weight_raw);
    return m ? Math.ceil(m) : 500;
  }, [rawEdges]);

  // Compute Active Network
  const { validNodes, validEdges } = useMemo(() => {
    const removedSet = new Set(
      filters.removedNodes.split(',')
        .map(s => s.trim())
        .filter(Boolean)
    );

    const filteredEdges = rawEdges.filter(e => 
      e.weight_secondary >= filters.relCutoff &&
      e.weight_raw >= filters.absCutoff &&
      !removedSet.has(e.source) &&
      !removedSet.has(e.target)
      // in graphology, we might want to also avoid adding edges if source==target, but parsed already prevents it
    );

    const nodesWithEdges = new Set<string>();
    filteredEdges.forEach(e => {
      nodesWithEdges.add(e.source);
      nodesWithEdges.add(e.target);
    });

    const filteredNodes = rawNodes.filter(n => 
      nodesWithEdges.has(n.id) && !removedSet.has(n.id)
    );

    return { validNodes: filteredNodes, validEdges: filteredEdges };
  }, [rawNodes, rawEdges, filters.relCutoff, filters.absCutoff, filters.removedNodes]);

  // Compute Communities
  useEffect(() => {
    if (!filters.recalculateCommunities) return;
    if (validNodes.length === 0 || validEdges.length === 0) return;

    try {
      const graph = new Graph({ type: directed ? 'directed' : 'undirected', multi: false, allowSelfLoops: false });
      
      validNodes.forEach(n => {
        if (!graph.hasNode(n.id)) graph.addNode(n.id);
      });

      validEdges.forEach(e => {
        if (graph.hasNode(e.source) && graph.hasNode(e.target)) {
          let weight = 1;
          if (filters.edgeWeightBase === 'weight_raw') weight = Number(e.weight_raw);
          else if (filters.edgeWeightBase === 'weight_secondary') weight = Number(e.weight_secondary);

          if (!graph.hasEdge(e.source, e.target)) {
            graph.addEdge(e.source, e.target, { weight });
          } else {
            // If the edge already exists (e.g., reverse direction in an undirected graph), 
            // sum the weights to preserve total interaction strength.
            const existingWeight = graph.getEdgeAttribute(e.source, e.target, 'weight');
            graph.setEdgeAttribute(e.source, e.target, 'weight', existingWeight + weight);
          }
        }
      });

      const options = { 
        rng: seedrandom(42), // Use the default seed 42 as in the observable notebook
        resolution: filters.resolution || 1.0, 
        getEdgeWeight: 'weight',
        fastLocalMoves: true
      };
      
      const details = louvain.detailed(graph, options);
      const communities = normalize_communities(details.communities as Record<string, number>);
      
      const newCommunityMap: Record<string, string> = {};
      
      // Assign deterministic color based on community ID
      for (const [nodeId, communityId] of Object.entries(communities)) {
        newCommunityMap[nodeId] = colorScale(communityId.toString());
      }

      setCommunityMap(newCommunityMap);

      // Delta Q Calculation
      let sumWeights = 0;
      graph.forEachEdge((e, atts) => { sumWeights += (atts.weight || 1); });
      
      const metrics = graph.nodes().map(nodeId => {
        const comm = newCommunityMap[nodeId] || '';
        
        if (directed) {
          const totalWeight = sumWeights;
          let nodeInDegree = 0;
          let nodeOutDegree = 0;
          
          graph.forEachInEdge(nodeId, (e, atts) => { nodeInDegree += (atts.weight || 1); });
          graph.forEachOutEdge(nodeId, (e, atts) => { nodeOutDegree += (atts.weight || 1); });

          let commInDegree = 0;
          let commOutDegree = 0;
          graph.forEachNode(n => {
            if (newCommunityMap[n] === comm) {
              graph.forEachInEdge(n, (e, atts) => { commInDegree += (atts.weight || 1); });
              graph.forEachOutEdge(n, (e, atts) => { commOutDegree += (atts.weight || 1); });
            }
          });

          let k_in_from_comm = 0;
          let k_out_to_comm = 0;
          graph.forEachInEdge(nodeId, (e, atts, source) => {
            if (newCommunityMap[source] === comm) k_in_from_comm += (atts.weight || 1);
          });
          graph.forEachOutEdge(nodeId, (e, atts, source, target) => {
            if (newCommunityMap[target] === comm) k_out_to_comm += (atts.weight || 1);
          });
          
          const deltaQ = totalWeight > 0 ? 
            ((k_in_from_comm + k_out_to_comm) / totalWeight) - 
            ((nodeOutDegree * commInDegree + nodeInDegree * commOutDegree) / Math.pow(totalWeight, 2)) : 0;
            
          return {
            id: nodeId,
            community: comm,
            k_i_in: (k_in_from_comm + k_out_to_comm).toFixed(4),
            nodeDegree: `↓${nodeInDegree.toFixed(2)} ↑${nodeOutDegree.toFixed(2)}`,
            communityDegree: `↓${commInDegree.toFixed(2)} ↑${commOutDegree.toFixed(2)}`,
            deltaQ: deltaQ.toFixed(6)
          };
        } else {
          const totalWeight2m = sumWeights * 2;
          let nodeDegree = 0;
          graph.forEachEdge(nodeId, (e, atts) => { nodeDegree += (atts.weight || 1); });
          
          let communityDegree = 0;
          graph.forEachNode(n => {
            if (newCommunityMap[n] === comm) {
              graph.forEachEdge(n, (e, atts) => { communityDegree += (atts.weight || 1); });
            }
          });

          let k_i_in = 0;
          graph.forEachEdge(nodeId, (edge, atts, source, target) => {
            const neighbor = source === nodeId ? target : source;
            if (newCommunityMap[neighbor] === comm) {
              k_i_in += (atts.weight || 1);
            }
          });

          const deltaQ = totalWeight2m > 0 ? (k_i_in / totalWeight2m) - ((nodeDegree * communityDegree) / Math.pow(totalWeight2m, 2)) : 0;
          
          return {
            id: nodeId,
            community: comm,
            k_i_in: k_i_in.toFixed(4),
            nodeDegree: nodeDegree.toFixed(4),
            communityDegree: communityDegree.toFixed(4),
            deltaQ: deltaQ.toFixed(6)
          };
        }
      });
      
      // sort by deltaQ descending
      metrics.sort((a,b) => parseFloat(b.deltaQ) - parseFloat(a.deltaQ));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNodeMetrics(metrics);
    } catch (err) {
      console.warn("Community calculation skipped/failed:", err);
    }
  }, [validNodes, validEdges, filters.recalculateCommunities, filters.resolution, filters.edgeWeightBase, directed, setCommunityMap]);

  // Compute Network Metrics
  useEffect(() => {
    if (validNodes.length === 0 || validEdges.length === 0) return;
    
    try {
      const graph = new Graph({ type: directed ? 'directed' : 'undirected', multi: false, allowSelfLoops: false });
      
      validNodes.forEach(n => {
        if (!graph.hasNode(n.id)) graph.addNode(n.id);
      });

      validEdges.forEach(e => {
        if (graph.hasNode(e.source) && graph.hasNode(e.target)) {
          let weight = 1;
          if (filters.edgeWeightBase === 'weight_raw') weight = Number(e.weight_raw);
          else if (filters.edgeWeightBase === 'weight_secondary') weight = Number(e.weight_secondary);

          if (!graph.hasEdge(e.source, e.target)) {
            graph.addEdge(e.source, e.target, { weight });
          } else {
            const existingWeight = graph.getEdgeAttribute(e.source, e.target, 'weight');
            graph.setEdgeAttribute(e.source, e.target, 'weight', existingWeight + weight);
          }
        }
      });

      const pagerankValue = require('graphology-metrics/centrality/pagerank')(graph, {
        attributes: { weight: 'weight' },
        maxIterations: 1000
      });

      let eigenvectorValue: Record<string, number> = {};
      try {
        eigenvectorValue = require('graphology-metrics/centrality/eigenvector')(graph, {
          attributes: { weight: 'weight' },
          maxIterations: 1000,
          tolerance: 1e-4
        });
      } catch (err) {
        console.warn("Eigenvector calculation failed:", err);
      }

      const metrics = graph.nodes().map(nodeId => {
        const degree = graph.degree(nodeId);
        const inDegree = directed ? graph.inDegree(nodeId) : degree;
        const outDegree = directed ? graph.outDegree(nodeId) : degree;
        const pr = pagerankValue[nodeId] || 0;
        const ev = eigenvectorValue[nodeId] || 0;
        
        return {
          id: nodeId,
          degree,
          inDegree,
          outDegree,
          pagerank: pr.toFixed(6),
          eigenvector: ev.toFixed(6)
        };
      });

      metrics.sort((a,b) => parseFloat(b.pagerank) - parseFloat(a.pagerank));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNetworkMetrics(metrics);
    } catch (err) {
      console.warn("Network metrics calculation failed:", err);
    }
  }, [validNodes, validEdges, filters.edgeWeightBase, directed]);

  const { removedNodesString, removedNodesCount } = useMemo(() => {
    const visibleNodeIds = new Set(validNodes.map(n => n.id));
    const removedNodesList = rawNodes
      .filter(n => !visibleNodeIds.has(n.id))
      .map(n => n.name || n.id);
    return {
      removedNodesString: removedNodesList.join(', '),
      removedNodesCount: removedNodesList.length
    };
  }, [rawNodes, validNodes]);

  return (
    <div className={`flex flex-1 overflow-hidden h-full w-full transition-colors ${isDarkMode ? 'bg-[#141414] text-[#E4E3E0]' : 'bg-[#E4E3E0] text-[#141414]'}`}>
      {/* SIDEBAR CONTROL PANEL */}
      
      {isSidebarCollapsed ? (
        <div className={`border-r shrink-0 flex flex-col items-center py-4 space-y-4 transition-colors ${isDarkMode ? 'border-[#333] bg-[#000]' : 'border-[#141414] bg-[#E4E3E0]'} w-12`}>
          <button 
            onClick={() => setIsSidebarCollapsed(false)}
            className={`p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}
            title="Expand Sidebar"
          >
            <ChevronRight size={18} />
          </button>
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}
            title="Toggle Theme"
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      ) : (
        <aside className={`w-72 border-r flex flex-col p-6 space-y-8 shrink-0 overflow-y-auto transition-colors ${isDarkMode ? 'border-[#333] bg-[#000]' : 'border-[#141414] bg-[#E4E3E0]'}`}>
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-widest">Controls</h2>
            <div className="flex items-center space-x-2">
              <button 
                onClick={() => setIsDarkMode(!isDarkMode)}
                className={`p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}
                title="Toggle Theme"
              >
                {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              <button 
                onClick={() => setIsSidebarCollapsed(true)}
                className={`p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}
                title="Collapse Sidebar"
              >
                <ChevronLeft size={16} />
              </button>
            </div>
          </div>
          <div>
            <h3 className={`text-[10px] font-bold uppercase tracking-widest mb-4 opacity-70 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>Filter Logic Layer</h3>
          
          <div className="space-y-6">
            {/* Filter: Relative Weight Cutoff */}
            <div className="group">
              <label className={`flex items-center justify-between text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>
                <span>Edge Cutoff by Relative</span>
                <SyncInput 
                  className={`w-14 bg-transparent border-b text-right font-mono outline-none ${isDarkMode ? 'border-[#333] focus:border-[#E4E3E0] text-[#E4E3E0]' : 'border-[#ccc] focus:border-[#141414] text-[#141414]'}`}
                  value={filters.relCutoff}
                  onChange={(v: number) => setFilter('relCutoff', v)}
                  step={maxRelWeight <= 1.0 ? 0.01 : 0.1}
                />
              </label>
              <CustomSlider
                min="0" max={maxRelWeight} step={maxRelWeight <= 1.0 ? 0.01 : 0.1}
                value={filters.relCutoff}
                onChange={(v: number) => setFilter('relCutoff', v)}
                isDarkMode={isDarkMode}
              />
              <div className="flex justify-between text-[9px] mt-2 opacity-50 font-mono">
                <span>0</span>
                <span>{maxRelWeight}</span>
              </div>
            </div>

            {/* Filter: Absolute Cutoff */}
            <div className="group">
              <label className={`flex items-center justify-between text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>
                <span>Absolute Cutoff</span>
                <SyncInput 
                  className={`w-14 bg-transparent border-b text-right font-mono outline-none ${isDarkMode ? 'border-[#333] focus:border-[#E4E3E0] text-[#E4E3E0]' : 'border-[#ccc] focus:border-[#141414] text-[#141414]'}`}
                  value={filters.absCutoff}
                  onChange={(v: number) => setFilter('absCutoff', v)}
                  step="1"
                />
              </label>
              <CustomSlider
                min="0" max={maxRawWeight} step="1"
                value={filters.absCutoff}
                onChange={(v: number) => setFilter('absCutoff', v)}
                isDarkMode={isDarkMode}
              />
              <div className="flex justify-between text-[9px] mt-2 opacity-50 font-mono">
                <span>0</span>
                <span>{maxRawWeight}</span>
              </div>
            </div>

            {/* Manual Node Removal */}
            <div className="group">
               <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>Node Removal (ID)</label>
               <SyncTextInput 
                 placeholder="e.g. Ag, Au, Al"
                 value={filters.removedNodes}
                 onChange={(v: string) => setFilter('removedNodes', v)}
                 className={`w-full bg-transparent border p-2 text-xs font-mono outline-none transition-colors ${isDarkMode ? 'border-[#333] focus:border-[#E4E3E0] text-[#E4E3E0]' : 'border-[#141414] focus:border-black text-[#141414]'}`}
               />
            </div>
          </div>
        </div>

        {/* Visualization Controls */}
        <div>
          <h3 className={`text-[10px] font-bold uppercase tracking-widest mb-4 opacity-70 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>Simulation Params</h3>
          
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase text-[10px]">Louvain Colors</label>
              <SegmentedToggle 
                checked={filters.recalculateCommunities}
                onChange={(v: boolean) => setFilter('recalculateCommunities', v)}
                isDarkMode={isDarkMode}
              />
            </div>

            <div className="group">
              <label className={`flex items-center justify-between text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>
                <span>Louvain Resolution</span>
                <SyncInput 
                  className={`w-12 bg-transparent border-b text-right font-mono outline-none ${isDarkMode ? 'border-[#333] focus:border-[#E4E3E0] text-[#E4E3E0]' : 'border-[#ccc] focus:border-[#141414] text-[#141414]'}`}
                  value={filters.resolution}
                  onChange={(v: number) => setFilter('resolution', v)}
                  step="0.1"
                />
              </label>
              <CustomSlider
                min="0.1" max="5.0" step="0.1"
                value={filters.resolution}
                onChange={(v: number) => setFilter('resolution', v)}
                isDarkMode={isDarkMode}
              />
            </div>
            
            <div className={`group border-t border-dotted pt-4 mt-4 transition-colors ${isDarkMode ? 'border-[#555]' : 'border-[#888]'}`}>
              <div className="flex flex-col space-y-4">
                 <div className="flex items-center justify-between">
                   <label className="text-xs font-bold uppercase text-[10px]">Enable Live Physics</label>
                   <SegmentedToggle 
                     checked={filters.livePhysics}
                     onChange={(v: boolean) => setFilter('livePhysics', v)}
                     isDarkMode={isDarkMode}
                   />
                 </div>
                 
                 <div className="flex items-center justify-between">
                   <label className="text-xs font-bold uppercase text-[10px]">Freeze Layout</label>
                   <SegmentedToggle 
                     checked={filters.isFrozen}
                     onChange={(v: boolean) => setFilter('isFrozen', v)}
                     isDarkMode={isDarkMode}
                   />
                 </div>
              </div>
            </div>

            <div className="group">
              <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>Node Size Based On</label>
              <select 
                value={filters.nodeSizeBase} 
                onChange={e => setFilter('nodeSizeBase', e.target.value)} 
                className={`w-full bg-transparent border p-2 text-xs font-mono outline-none transition-colors mb-4 ${isDarkMode ? 'border-[#333] focus:border-[#E4E3E0] text-[#E4E3E0] [&>option]:bg-[#1a1a1a]' : 'border-[#141414] focus:border-black text-[#141414] [&>option]:bg-white'}`}
              >
                <option value="abundance">Abundance</option>
                <option value="degree">Degree</option>
                <option value="uniform">Uniform</option>
              </select>
              
              <label className={`flex items-center justify-between text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>
                <span>Node Size Scale</span>
                <SyncInput 
                  className={`w-12 bg-transparent border-b text-right font-mono outline-none ${isDarkMode ? 'border-[#333] focus:border-[#E4E3E0] text-[#E4E3E0]' : 'border-[#ccc] focus:border-[#141414] text-[#141414]'}`}
                  value={filters.nodeSize}
                  onChange={(v: number) => setFilter('nodeSize', v)}
                  step="0.5"
                />
              </label>
              <CustomSlider
                min="1" max="10" step="0.5"
                value={filters.nodeSize}
                onChange={(v: number) => setFilter('nodeSize', v)}
                isDarkMode={isDarkMode}
              />

              <label className={`flex items-center justify-between text-[10px] font-bold uppercase tracking-widest mb-2 mt-4 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>
                <span>Node Opacity</span>
                <SyncInput 
                  className={`w-12 bg-transparent border-b text-right font-mono outline-none ${isDarkMode ? 'border-[#333] focus:border-[#E4E3E0] text-[#E4E3E0]' : 'border-[#ccc] focus:border-[#141414] text-[#141414]'}`}
                  value={filters.nodeOpacity}
                  onChange={(v: number) => setFilter('nodeOpacity', v)}
                  step="0.1"
                />
              </label>
              <CustomSlider
                min="0.1" max="1.0" step="0.1"
                value={filters.nodeOpacity}
                onChange={(v: number) => setFilter('nodeOpacity', v)}
                isDarkMode={isDarkMode}
              />
            </div>

            <div className="group">
              <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>Edge Weight Based On</label>
              <select 
                value={filters.edgeWeightBase} 
                onChange={e => setFilter('edgeWeightBase', e.target.value)} 
                className={`w-full bg-transparent border p-2 text-xs font-mono outline-none transition-colors mb-4 ${isDarkMode ? 'border-[#333] focus:border-[#E4E3E0] text-[#E4E3E0] [&>option]:bg-[#1a1a1a]' : 'border-[#141414] focus:border-black text-[#141414] [&>option]:bg-white'}`}
              >
                <option value="weight_raw">Primary Weight (Matrix 1)</option>
                <option value="weight_secondary">Secondary Weight (Matrix 2)</option>
                <option value="uniform">Unweighted (Uniform)</option>
              </select>

              <label className={`flex items-center justify-between text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>
                <span>Edge Weight Scale</span>
                <SyncInput 
                  className={`w-12 bg-transparent border-b text-right font-mono outline-none ${isDarkMode ? 'border-[#333] focus:border-[#E4E3E0] text-[#E4E3E0]' : 'border-[#ccc] focus:border-[#141414] text-[#141414]'}`}
                  value={filters.edgeWeight}
                  onChange={(v: number) => setFilter('edgeWeight', v)}
                  step="0.5"
                />
              </label>
              <CustomSlider
                min="0.5" max="10" step="0.5"
                value={filters.edgeWeight}
                onChange={(v: number) => setFilter('edgeWeight', v)}
                isDarkMode={isDarkMode}
              />
              
              <label className={`flex items-center justify-between text-[10px] font-bold uppercase tracking-widest mb-2 mt-4 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>
                <span>Edge Opacity</span>
                <SyncInput 
                  className={`w-12 bg-transparent border-b text-right font-mono outline-none ${isDarkMode ? 'border-[#333] focus:border-[#E4E3E0] text-[#E4E3E0]' : 'border-[#ccc] focus:border-[#141414] text-[#141414]'}`}
                  value={filters.edgeOpacity}
                  onChange={(v: number) => setFilter('edgeOpacity', v)}
                  step="0.1"
                />
              </label>
              <CustomSlider
                min="0.1" max="1.0" step="0.1"
                value={filters.edgeOpacity}
                onChange={(v: number) => setFilter('edgeOpacity', v)}
                isDarkMode={isDarkMode}
              />
            </div>

            <div className="group">
              <label className={`flex items-center justify-between text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>
                <span>Radial Force</span>
                <SyncInput 
                  className={`w-14 bg-transparent border-b text-right font-mono outline-none ${isDarkMode ? 'border-[#333] focus:border-[#E4E3E0] text-[#E4E3E0]' : 'border-[#ccc] focus:border-[#141414] text-[#141414]'}`}
                  value={filters.forceStrength}
                  onChange={(v: number) => setFilter('forceStrength', v)}
                  step="10"
                />
              </label>
              <CustomSlider
                min="-300" max="-10" step="10"
                value={filters.forceStrength}
                onChange={(v: number) => setFilter('forceStrength', v)}
                isDarkMode={isDarkMode}
              />
            </div>
          </div>
        </div>

        <div className="mt-auto">
          <div className={`border-t border-dotted pt-4 transition-colors ${isDarkMode ? 'border-[#555]' : 'border-[#888]'}`}>
            <div className="flex justify-between text-[11px] mb-1">
              <span>Active Nodes</span>
              <span className="font-mono">{validNodes.length} / {rawNodes.length}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span>Active Edges</span>
              <span className="font-mono">{validEdges.length} / {rawEdges.length}</span>
            </div>
          </div>
          
          <div style={{ marginTop: '20px', padding: '10px', backgroundColor: isDarkMode ? '#1a1a1a' : '#f5f5f5', borderRadius: '4px' }}>
            <label style={{ fontWeight: 'bold', fontSize: '14px', color: isDarkMode ? '#ddd' : '#333' }}>
              Filtered out elements 
              <span style={{ fontWeight: 'normal', fontSize: '12px', display: 'block', color: isDarkMode ? '#888' : '#666' }}>
                (No valid connections above current thresholds):
              </span>
            </label>
            <div style={{ 
              marginTop: '8px', 
              fontSize: '13px', 
              color: isDarkMode ? '#666' : '#888', 
              fontStyle: 'italic',
              maxHeight: '100px', 
              overflowY: 'auto',
              wordWrap: 'break-word'
            }}>
              {removedNodesCount > 0 ? removedNodesString : "None"}
            </div>
          </div>
        </div>
      </aside>
      )}

      {/* MAIN VIEWPORT */}
      <section className={`flex-1 relative overflow-hidden h-full flex flex-col transition-colors ${isDarkMode ? 'bg-[#000]' : 'bg-white'}`}>
        {/* Toggle Graph / Data */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex text-[10px] uppercase font-bold tracking-widest bg-white dark:bg-[#141414] border border-[#141414] dark:border-[#333] shadow-sm">
          <button 
            className={`px-6 py-2 transition-colors ${activeTab === 'graph' ? (isDarkMode ? 'bg-[#333] text-white' : 'bg-[#141414] text-white') : (isDarkMode ? 'text-[#888] hover:bg-[#222]' : 'text-[#888] hover:bg-[#f5f5f5]')}`}
            onClick={() => setActiveTab('graph')}
          >
            Graph
          </button>
          <button 
            className={`px-6 py-2 transition-colors border-l border-[#141414] dark:border-[#333] ${activeTab === 'data' ? (isDarkMode ? 'bg-[#333] text-white' : 'bg-[#141414] text-white') : (isDarkMode ? 'text-[#888] hover:bg-[#222]' : 'text-[#888] hover:bg-[#f5f5f5]')}`}
            onClick={() => setActiveTab('data')}
          >
            Data
          </button>
        </div>

        {validNodes.length > 0 ? (
          <>
            {activeTab === 'graph' && (
              <div className="flex-1 w-full h-full">
                <D3Graph 
                  nodes={validNodes} 
                  edges={validEdges} 
                  communityMap={communityMap}
                  nodeSizeMult={filters.nodeSize || 3}
                  edgeWeightMult={filters.edgeWeight || 1}
                  nodeOpacity={filters.nodeOpacity}
                  edgeOpacity={filters.edgeOpacity}
                  nodeSizeBase={filters.nodeSizeBase || 'abundance'}
                  edgeWeightBase={filters.edgeWeightBase || 'weight_raw'}
                  forceStrength={filters.forceStrength || -100}
                  directed={directed}
                  bipartite={bipartite}
                  livePhysics={filters.livePhysics}
                  isFrozen={filters.isFrozen}
                  isDarkMode={isDarkMode}
                  refreshKey={refreshKey}
                  onRefresh={() => setRefreshKey(k => k + 1)}
                />
              </div>
            )}
            
            {activeTab === 'data' && (
              <div className="flex-1 w-full h-full pt-16 overflow-auto">
                <table className={`w-full text-left text-xs border-collapse ${isDarkMode ? 'text-[#ddd]' : 'text-[#333]'}`}>
                  <thead className={`sticky top-0 shadow-sm z-10 ${isDarkMode ? 'bg-[#222] border-b border-[#444]' : 'bg-[#f0f0f0] border-b border-[#ccc]'}`}>
                    <tr>
                      <th className="p-3 font-bold uppercase tracking-wider">Node ID</th>
                      <th className="p-3 font-bold uppercase tracking-wider">Label</th>
                      <th className="p-3 font-bold uppercase tracking-wider">Abundance</th>
                      {directed ? (
                        <>
                          <th className="p-3 font-bold uppercase tracking-wider">In Degree</th>
                          <th className="p-3 font-bold uppercase tracking-wider">Out Degree</th>
                        </>
                      ) : (
                        <th className="p-3 font-bold uppercase tracking-wider">Degree</th>
                      )}
                      <th className="p-3 font-bold uppercase tracking-wider">Eigenvector</th>
                      <th className="p-3 font-bold uppercase tracking-wider">PageRank</th>
                      <th className="p-3 font-bold uppercase tracking-wider">Community</th>
                      <th className="p-3 font-bold uppercase tracking-wider">ΔQ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validNodes.map(node => {
                      const net = networkMetrics.find(m => m.id === node.id) || {};
                      const mod = nodeMetrics.find(m => m.id === node.id) || {};
                      const comm = mod.community || communityMap[node.id] || '';
                      
                      return (
                        <tr key={node.id} className={`border-b ${isDarkMode ? 'border-[#333] hover:bg-[#1a1a1a]' : 'border-[#eee] hover:bg-[#fcfcfc]'}`}>
                          <td className="p-2 font-mono font-bold">{node.id}</td>
                          <td className="p-2">{node.label || node.name || '-'}</td>
                          <td className="p-2 font-mono">{node.abundance || '-'}</td>
                          {directed ? (
                            <>
                              <td className="p-2 font-mono">{net.inDegree || 0}</td>
                              <td className="p-2 font-mono">{net.outDegree || 0}</td>
                            </>
                          ) : (
                            <td className="p-2 font-mono">{net.degree || 0}</td>
                          )}
                          <td className="p-2 font-mono">{net.eigenvector || 0}</td>
                          <td className="p-2 font-mono">{net.pagerank || 0}</td>
                          <td className="p-2">
                            <div className="flex items-center space-x-2">
                              {comm && <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colorScale(comm.toString()) }} />}
                              <span>{comm || '-'}</span>
                            </div>
                          </td>
                          <td className="p-2 font-mono">{mod.deltaQ || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center font-mono text-sm opacity-50">
            <span>NO DATA // ADJUST FILTERS</span>
          </div>
        )}
      </section>
    </div>
  );
}
