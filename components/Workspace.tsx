'use client';

import React, { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useStore, RawNode, RawEdge } from '@/store/useStore';
import Graph from 'graphology';
import louvainPkg from 'graphology-communities-louvain';
import pagerankPkg from 'graphology-metrics/centrality/pagerank';
import eigenvectorPkg from 'graphology-metrics/centrality/eigenvector';
import * as d3 from 'd3';
import seedrandomPkg from 'seedrandom';

// Handle Next.js ESM/CJS interop for graphology plugins
const louvain = (typeof louvainPkg === 'function') ? louvainPkg : (louvainPkg as any).default || louvainPkg;
const pagerank = (typeof pagerankPkg === 'function') ? pagerankPkg : (pagerankPkg as any).default || pagerankPkg;
const eigenvector = (typeof eigenvectorPkg === 'function') ? eigenvectorPkg : (eigenvectorPkg as any).default || eigenvectorPkg;
const seedrandom = (typeof seedrandomPkg === 'function') ? seedrandomPkg : (seedrandomPkg as any).default || seedrandomPkg;
import { normalize_communities, COMMUNITY_COLORS, getCommunityColor } from '@/lib/communityUtils';
import { ChevronLeft, ChevronRight, Sun, Moon, Download } from 'lucide-react';
import { exportSvg, exportImage, exportCsv, exportJson, exportCsvZip, exportGraphML, exportWorkspaceSettings } from '@/lib/exportUtils';


// Dynamically import D3Graph so it only runs on the client due to canvas/SVG dependencies
const D3Graph = dynamic(() => import('./D3Graph'), { ssr: false });

const SyncInput = ({ value, onChange, step, className }: any) => {
  const liveUpdate = useStore(state => state.filters.liveUpdate);
  const [localVal, setLocalVal] = useState(value);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setLocalVal(value), [value]);

  return (
    <input 
      type="number"
      className={`text-inherit ${className}`}
      value={localVal}
      onChange={e => {
        setLocalVal(e.target.value);
        if (liveUpdate) onChange(Number(e.target.value));
      }}
      onBlur={() => onChange(Number(localVal))}
      onKeyDown={e => e.key === 'Enter' && onChange(Number(localVal))}
      step={step}
    />
  );
};

const SyncTextInput = ({ value, onChange, className, placeholder, list, options }: any) => {
  const liveUpdate = useStore(state => state.filters.liveUpdate);
  const [localVal, setLocalVal] = useState(value);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setLocalVal(value), [value]);

  // Support comma-separated autocomplete
  const tokens = typeof localVal === 'string' ? localVal.split(',') : [];
  const lastToken = tokens.length > 0 ? tokens[tokens.length - 1].trim() : '';
  const prefix = tokens.length > 1 ? tokens.slice(0, -1).join(', ') + ', ' : '';

  return (
    <>
      <input 
        type="text"
        className={`text-inherit ${className}`}
        value={localVal}
        onChange={e => {
          setLocalVal(e.target.value);
          if (liveUpdate) onChange(e.target.value);
        }}
        onBlur={() => onChange(localVal)}
        onKeyDown={e => e.key === 'Enter' && onChange(localVal)}
        placeholder={placeholder}
        list={list}
      />
      {list && options && lastToken.length >= 1 && (
        <datalist id={list}>
          {options
            .filter((opt: any) => String(opt.value).toLowerCase().includes(lastToken.toLowerCase()) || String(opt.label).toLowerCase().includes(lastToken.toLowerCase()))
            .slice(0, 15)
            .map((opt: any, idx: number) => (
              <option key={idx} value={prefix + opt.value}>{opt.label}</option>
            ))}
        </datalist>
      )}
    </>
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
  const liveUpdate = useStore(state => state.filters.liveUpdate);
  const [localVal, setLocalVal] = useState(value);
  
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setLocalVal(value), [value]);

  const handleChange = (e: any) => {
    const val = Number(e.target.value);
    setLocalVal(val);
    if (liveUpdate) {
      onChange(val);
    }
  };

  const handleRelease = () => {
    if (localVal !== value) {
      onChange(localVal);
    }
  };

  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={localVal}
      onChange={handleChange}
      onMouseUp={handleRelease}
      onTouchEnd={handleRelease}
      onKeyUp={handleRelease}
      className={`w-full h-1 appearance-none outline-none cursor-pointer rounded-full ${
        isDarkMode
          ? 'bg-[#555] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-[#b4ff39] [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-[#b4ff39] [&::-webkit-slider-thumb]:rounded-full [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:bg-[#b4ff39] [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:rounded-full'
          : 'bg-[#ccc] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-[#141414] [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-[#141414] [&::-webkit-slider-thumb]:rounded-full [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:bg-[#141414] [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:rounded-full'
      }`}
    />
  );
};

export default function Workspace() {
  const { rawNodes, rawEdges, filters, setFilter, communityMap, setCommunityMap, directed, bipartite, isDarkMode, setIsDarkMode, searchQuery, setSearchQuery, selectedElement, setSelectedElement, projectName } = useStore();
  
  const hasType = useMemo(() => rawNodes.some(n => !!n.type), [rawNodes]);
  const hasAbundance = useMemo(() => rawNodes.some(n => n.abundance !== undefined && n.abundance !== null), [rawNodes]);
  const hasSecondaryWeight = useMemo(() => rawEdges.some(e => e.weight_secondary !== undefined && e.weight_secondary !== null), [rawEdges]);
  
  useEffect(() => {
    if (!hasType && filters.nodeColorBase === 'type') setFilter('nodeColorBase', 'community');
    if (!hasAbundance && filters.nodeSizeBase === 'abundance') setFilter('nodeSizeBase', 'degree');
    if (!hasSecondaryWeight && filters.edgeColorBase === 'weight_secondary') setFilter('edgeColorBase', 'uniform');
    if (!hasSecondaryWeight && filters.edgeWeightBase === 'weight_secondary') setFilter('edgeWeightBase', 'weight_raw');
    if (!hasSecondaryWeight && filters.edgeOpacityBase === 'weight_secondary') setFilter('edgeOpacityBase', 'uniform');
  }, [hasType, hasAbundance, hasSecondaryWeight, filters.nodeColorBase, filters.nodeSizeBase, filters.edgeColorBase, filters.edgeWeightBase, filters.edgeOpacityBase, setFilter]);
  
  const [refreshKey, setRefreshKey] = useState(0);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [nodeMetrics, setNodeMetrics] = useState<any[]>([]);
  const [networkMetrics, setNetworkMetrics] = useState<any[]>([]);
  const [modularity, setModularity] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"graph" | "data">("graph");
  const [dataTab, setDataTab] = useState<"nodes" | "edges">("nodes");
  const [activeControlTab, setActiveControlTab] = useState<"nodes" | "edges">("nodes");
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: "asc" | "desc" } | null>(null);

  const [appliedFilters, setAppliedFilters] = useState(filters);
  useEffect(() => {
    if (filters.liveUpdate) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAppliedFilters(filters);
    }
  }, [filters, filters.liveUpdate]);

  const handleImportWorkspace = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.type !== 'workspace_state') {
          throw new Error('Invalid workspace file.');
        }
        
        useStore.setState({
          projectName: json.projectName || 'NEW_PROJECT_NAME',
          directed: !!json.directed,
          bipartite: !!json.bipartite,
          filters: json.filters,
          rawNodes: json.rawNodes || [],
          rawEdges: json.rawEdges || []
        });
      } catch (err: any) {
        alert('Failed to import workspace: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleElementDoubleClick = (id: string, type: "node" | "edge") => {
    setSelectedElement(id);
    setActiveTab("data");
    setDataTab(type + "s" as any);
  };





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
      appliedFilters.removedNodes.split(',')
        .map(s => s.trim())
        .filter(Boolean)
    );

    const filteredEdges = rawEdges.filter(e => {
      // Check all weight filters
      const passesWeightFilters = appliedFilters.weightFilters.every(filter => {
        const val = e[filter.type];
        if (val === undefined || val === null) return true; // If edge doesn't have this weight, don't filter it out
        return val >= filter.cutoff;
      });

      return passesWeightFilters &&
        !removedSet.has(e.source) &&
        !removedSet.has(e.target);
    });

    const nodesWithEdges = new Set<string>();
    filteredEdges.forEach(e => {
      nodesWithEdges.add(e.source);
      nodesWithEdges.add(e.target);
    });

    const filteredNodes = rawNodes.filter(n => 
      nodesWithEdges.has(n.id) && !removedSet.has(n.id)
    );

    const validNodeIds = new Set(filteredNodes.map(n => n.id));
    const strictlyValidEdges = filteredEdges.filter(e => validNodeIds.has(e.source) && validNodeIds.has(e.target));

    return { validNodes: filteredNodes, validEdges: strictlyValidEdges };
  }, [rawNodes, rawEdges, appliedFilters.weightFilters, appliedFilters.removedNodes]);

  // Compute Communities and Metrics
  useEffect(() => {
    if (validNodes.length === 0 || validEdges.length === 0) return;

    try {
      const graph = new Graph({ type: directed ? "directed" : "undirected", multi: false, allowSelfLoops: false });
      
      validNodes.forEach(n => {
        if (!graph.hasNode(n.id)) graph.addNode(n.id, { ...n });
      });
      
      validEdges.forEach(e => {
        if (graph.hasNode(e.source) && graph.hasNode(e.target)) {
          if (!graph.hasEdge(e.source, e.target)) {
            graph.addEdge(e.source, e.target, { weight: e.weight_raw || 1 });
          }
        }
      });

      let newCommunityMap: Record<string, any> = {};
      let modularityVal = null;

      if (appliedFilters.recalculateCommunities) {
        const options = { 
          rng: seedrandom(appliedFilters.louvainSeed || 42),
          resolution: appliedFilters.resolution || 1.0, 
          getEdgeWeight: "weight",
          fastLocalMoves: true
        };
        const details = louvain.detailed(graph, options);
        const norm = normalize_communities(details.communities as Record<string, number>);
        Object.keys(norm).forEach(k => {
          newCommunityMap[k] = `Cluster ${norm[k] + 1}`;
        });
        modularityVal = details.modularity;
      } else {
        // Use pre-existing communities from nodes if present
        validNodes.forEach(n => {
          if (n.community !== undefined && n.community !== null && n.community !== "") {
            newCommunityMap[n.id] = String(n.community);
          }
        });
      }

      // eslint-disable-next-line react-hooks/set-state-in-effect
      setModularity(modularityVal);
       
      setCommunityMap(newCommunityMap);

      // Delta Q Calculation
      let sumWeights = 0;
      graph.forEachEdge((e, atts) => { sumWeights += (atts.weight || 1); });
      
      const metrics = graph.nodes().map(nodeId => {
        const comm = newCommunityMap[nodeId] || "";
        
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
      setNodeMetrics(metrics);

      // Network Metrics (Degree, Eigenvector, PageRank)
      let pr: Record<string, number> = {};
      let eig: Record<string, number> = {};
      try { pr = pagerank(graph); } catch (e) { console.warn("PageRank failed", e); }
      try { eig = eigenvector(graph); } catch (e) { console.warn("Eigenvector failed", e); }
      
      const netMetrics = graph.nodes().map(nodeId => {
        return {
          id: nodeId,
          degree: graph.degree ? graph.degree(nodeId) : 0,
          inDegree: directed && graph.inDegree ? graph.inDegree(nodeId) : 0,
          outDegree: directed && graph.outDegree ? graph.outDegree(nodeId) : 0,
          pagerank: pr[nodeId] ? pr[nodeId].toFixed(6) : "0",
          eigenvector: eig[nodeId] ? eig[nodeId].toFixed(6) : "0",
        };
      });
      setNetworkMetrics(netMetrics);
    } catch (err) {
      console.warn("Community calculation skipped/failed:", err);
    }
  }, [validNodes, validEdges, appliedFilters.recalculateCommunities, appliedFilters.resolution, appliedFilters.edgeWeightBase, directed, setCommunityMap, appliedFilters.louvainSeed]);

  const allCommunityLabels = useMemo(() => Array.from(new Set(Object.values(communityMap))) as string[], [communityMap]);

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


  const tableData = useMemo(() => {
    let data = validNodes.map(node => {
      const net = networkMetrics.find(m => m.id === node.id) || {};
      const mod = nodeMetrics.find(m => m.id === node.id) || {};
      const comm = mod.community || communityMap[node.id] || "";
      return { ...node, net, mod, comm };
    });

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter(d => 
        String(d.id).toLowerCase().includes(q) || 
        String(d.label || d.name || "").toLowerCase().includes(q)
      );
    }

    if (sortConfig) {
      data.sort((a, b) => {
        let aVal: any = a.id;
        let bVal: any = b.id;

        if (sortConfig.key === "id") {
          aVal = a.id; bVal = b.id;
        } else if (sortConfig.key === "label") {
          aVal = a.label || a.name || ""; bVal = b.label || b.name || "";
        } else if (sortConfig.key === "abundance") {
          aVal = a.abundance || 0; bVal = b.abundance || 0;
        } else if (sortConfig.key === "degree") {
          aVal = a.net.degree || 0; bVal = b.net.degree || 0;
        } else if (sortConfig.key === "inDegree") {
          aVal = a.net.inDegree || 0; bVal = b.net.inDegree || 0;
        } else if (sortConfig.key === "outDegree") {
          aVal = a.net.outDegree || 0; bVal = b.net.outDegree || 0;
        } else if (sortConfig.key === "eigenvector") {
          aVal = parseFloat(a.net.eigenvector) || 0; bVal = parseFloat(b.net.eigenvector) || 0;
        } else if (sortConfig.key === "pagerank") {
          aVal = parseFloat(a.net.pagerank) || 0; bVal = parseFloat(b.net.pagerank) || 0;
        } else if (sortConfig.key === "community") {
          aVal = a.comm; bVal = b.comm;
        } else if (sortConfig.key === "deltaQ") {
          aVal = parseFloat(a.mod.deltaQ) || 0; bVal = parseFloat(b.mod.deltaQ) || 0;
        }

        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return data;
  }, [validNodes, networkMetrics, nodeMetrics, communityMap, sortConfig, searchQuery]);

  const tableDataEdges = useMemo(() => {
    let data = validEdges;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter(d => 
        String(d.source).toLowerCase().includes(q) || 
        String(d.target).toLowerCase().includes(q)
      );
    }
    
    if (sortConfig) {
      data = [...data].sort((a, b) => {
        let aVal: any = a.source;
        let bVal: any = b.source;

        if (sortConfig.key === "source") {
          aVal = a.source; bVal = b.source;
        } else if (sortConfig.key === "target") {
          aVal = a.target; bVal = b.target;
        } else if (sortConfig.key === "weight_raw") {
          aVal = a.weight_raw; bVal = b.weight_raw;
        } else if (sortConfig.key === "weight_secondary") {
          aVal = a.weight_secondary; bVal = b.weight_secondary;
        }

        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return data;
  }, [validEdges, sortConfig, searchQuery]);

  const handleExport = (format: string) => {
    setShowExportMenu(false);
    if (activeTab === "graph") {
      const svgElement = document.getElementById('network-graph-svg') as SVGSVGElement | null;
      if (format === 'svg') exportSvg(svgElement, `${projectName}.svg`);
      else if (format === 'png') exportImage(svgElement, 'png', `${projectName}.png`, isDarkMode);
      else if (format === 'jpeg') exportImage(svgElement, 'jpeg', `${projectName}.jpg`, isDarkMode);
      else if (format === 'json') {
        exportJson({ nodes: validNodes, edges: validEdges }, `${projectName}.json`);
      } else if (format === 'csvzip') {
        exportCsvZip(validNodes, validEdges, `${projectName}_data.zip`);
      } else if (format === 'graphml') {
        exportGraphML(validNodes, validEdges, directed, `${projectName}.graphml`);
      } else if (format === 'settings') {
        const workspaceState = {
          type: 'workspace_state',
          projectName,
          directed,
          bipartite,
          isDarkMode,
          filters,
          rawNodes,
          rawEdges
        };
        exportWorkspaceSettings(workspaceState, `${projectName}_workspace.json`);
      }
    } else {
      if (format === 'csv') {
        if (dataTab === 'nodes') {
          const flatNodes = tableData.map(d => ({
            id: d.id, name: d.name, label: d.label, type: d.type, abundance: d.abundance, community: d.comm,
            degree: d.net?.degree, inDegree: d.net?.inDegree, outDegree: d.net?.outDegree,
            eigenvector: d.net?.eigenvector, pagerank: d.net?.pagerank, deltaQ: d.mod?.deltaQ
          }));
          exportCsv(flatNodes, `${projectName}_nodes.csv`);
        } else {
          exportCsv(tableDataEdges, `${projectName}_edges.csv`);
        }
      } else if (format === 'csvzip_table') {
        const flatNodes = tableData.map(d => ({
          id: d.id, name: d.name, label: d.label, type: d.type, abundance: d.abundance, community: d.comm,
          degree: d.net?.degree, inDegree: d.net?.inDegree, outDegree: d.net?.outDegree,
          eigenvector: d.net?.eigenvector, pagerank: d.net?.pagerank, deltaQ: d.mod?.deltaQ
        }));
        exportCsvZip(flatNodes, tableDataEdges, `${projectName}_table_data.zip`);
      }
    }
  };

  const handleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  useEffect(() => {
    if (activeTab === "data" && selectedElement) {
      setTimeout(() => {
        const el = document.getElementById(`row-${selectedElement}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  }, [activeTab, selectedElement, dataTab]);

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
              <label className={`p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`} title="Import Workspace">
                <Download size={16} className="rotate-180" />
                <input type="file" accept=".json" className="hidden" onChange={handleImportWorkspace} />
              </label>
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
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-[10px] font-bold uppercase tracking-widest opacity-70 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>Search & Select</h3>
              <label className="flex items-center space-x-2 text-[10px] font-bold uppercase tracking-widest cursor-pointer">
                <span className={isDarkMode ? 'text-[#888]' : 'text-[#666]'}>Edges</span>
                <SegmentedToggle 
                   checked={filters.searchEdges}
                   onChange={(v: boolean) => setFilter('searchEdges', v)}
                   isDarkMode={isDarkMode}
                />
              </label>
            </div>
            <div className="group mb-6">
               <input 
                 type="text"
                 placeholder={filters.searchEdges ? "Search nodes/edges..." : "Search nodes..."}
                 value={searchQuery}
                 onChange={(e) => {
                   const val = e.target.value;
                   setSearchQuery(val);
                   if (val && (rawNodes.some(n => String(n.id) === val) || (filters.searchEdges && rawEdges.some(edge => `${edge.source}-${edge.target}` === val)))) {
                     setSelectedElement(val);
                   }
                 }}
                 className={`w-full bg-transparent border p-2 text-[10px] uppercase font-bold tracking-widest outline-none transition-colors ${isDarkMode ? 'border-[#333] focus:border-[#E4E3E0] text-[#E4E3E0]' : 'border-[#141414] focus:border-black text-[#141414]'}`}
                 list="search-autocomplete"
               />
               {searchQuery && searchQuery.length >= 1 && (
                 <datalist id="search-autocomplete">
                   {rawNodes
                     .filter(n => String(n.id).toLowerCase().includes(searchQuery.toLowerCase()) || String(n.label || n.name || n.id).toLowerCase().includes(searchQuery.toLowerCase()))
                     .slice(0, 15)
                     .map(node => (
                     <option key={`search-node-${node.id}`} value={node.id}>{node.label || node.name || node.id}</option>
                   ))}
                   {filters.searchEdges && rawEdges
                     .filter(e => `${e.source}-${e.target}`.toLowerCase().includes(searchQuery.toLowerCase()))
                     .slice(0, 15)
                     .map((edge, idx) => (
                     <option key={`search-edge-${idx}`} value={`${edge.source}-${edge.target}`}>{`${edge.source} -> ${edge.target}`}</option>
                   ))}
                 </datalist>
               )}
            </div>
            </div>

        {/* Visualization Controls */}
        <div>
          <h3 className={`text-[10px] font-bold uppercase tracking-widest mb-4 opacity-70 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>Simulation Params</h3>
          
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase text-[10px]">Auto-Detect Communities (Louvain)</label>
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
                   <label className="text-xs font-bold uppercase text-[10px]">Live Update Controls</label>
                   <SegmentedToggle 
                     checked={filters.liveUpdate}
                     onChange={(v: boolean) => setFilter('liveUpdate', v)}
                     isDarkMode={isDarkMode}
                   />
                 </div>

                 {!filters.liveUpdate && (
                   <button 
                     onClick={() => setAppliedFilters(useStore.getState().filters)}
                     className={`w-full py-2 text-[10px] font-bold uppercase tracking-widest border transition-colors ${isDarkMode ? 'bg-[#141414] border-[#b4ff39] text-[#b4ff39] hover:bg-[#b4ff39] hover:text-[#141414]' : 'bg-white border-[#141414] text-[#141414] hover:bg-[#141414] hover:text-white'}`}
                   >
                     Apply Changes
                   </button>
                 )}
                 
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

            <div className="group border-t border-dotted pt-4 mt-4 transition-colors ${isDarkMode ? 'border-[#555]' : 'border-[#888]'}">
              <label className={`flex items-center justify-between text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>
                <span>Node Repulsion</span>
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
                {/* Network Element Controls */}
        <div className="mt-8">
          <div className="flex text-[10px] uppercase font-bold tracking-widest bg-transparent border border-[#141414] dark:border-[#333] shadow-sm mb-6 overflow-hidden">
            <button 
              onClick={() => setActiveControlTab("nodes")}
              className={`flex-1 py-2 transition-colors ${activeControlTab === "nodes" ? (isDarkMode ? "bg-[#333] text-white" : "bg-[#141414] text-white") : (isDarkMode ? "text-[#888] hover:bg-[#222]" : "text-[#888] hover:bg-[#f5f5f5]")}`}
            >
              Node Controls
            </button>
            <button 
              onClick={() => setActiveControlTab("edges")}
              className={`flex-1 py-2 transition-colors border-l border-[#141414] dark:border-[#333] ${activeControlTab === "edges" ? (isDarkMode ? "bg-[#333] text-white" : "bg-[#141414] text-white") : (isDarkMode ? "text-[#888] hover:bg-[#222]" : "text-[#888] hover:bg-[#f5f5f5]")}`}
            >
              Edge Controls
            </button>
          </div>

          {activeControlTab === "nodes" && (
            <div className="space-y-5">
              <div className="group">
                <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>Node Color Based On</label>
                <select 
                  value={filters.nodeColorBase} 
                  onChange={e => setFilter('nodeColorBase', e.target.value)} 
                  className={`w-full bg-transparent border p-2 text-xs font-mono outline-none transition-colors mb-4 ${isDarkMode ? 'border-[#333] focus:border-[#E4E3E0] text-[#E4E3E0] [&>option]:bg-[#1a1a1a]' : 'border-[#141414] focus:border-black text-[#141414] [&>option]:bg-white'}`}
                >
                  <option value="community">Community</option>
                  {hasType && <option value="type">Node Type</option>}
                  <option value="eigenvector">Eigenvector Centrality</option>
                  <option value="pagerank">PageRank</option>
                  <option value="uniform">Uniform Color</option>
                </select>
              </div>
              <div className="group">
                <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>Node Size Based On</label>
                <select 
                  value={filters.nodeSizeBase} 
                  onChange={e => setFilter('nodeSizeBase', e.target.value)} 
                  className={`w-full bg-transparent border p-2 text-xs font-mono outline-none transition-colors mb-4 ${isDarkMode ? 'border-[#333] focus:border-[#E4E3E0] text-[#E4E3E0] [&>option]:bg-[#1a1a1a]' : 'border-[#141414] focus:border-black text-[#141414] [&>option]:bg-white'}`}
                >
                  {hasAbundance && <option value="abundance">Abundance</option>}
                  <option value="degree">Degree</option>
                  <option value="eigenvector">Eigenvector Centrality</option>
                  <option value="pagerank">PageRank</option>
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
              </div>
            </div>
          )}

          {activeControlTab === "edges" && (
            <div className="space-y-5">
              <div className="group">
                <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>Edge Color Based On</label>
                <select 
                  value={filters.edgeColorBase} 
                  onChange={e => setFilter('edgeColorBase', e.target.value)} 
                  className={`w-full bg-transparent border p-2 text-xs font-mono outline-none transition-colors mb-4 ${isDarkMode ? 'border-[#333] focus:border-[#E4E3E0] text-[#E4E3E0] [&>option]:bg-[#1a1a1a]' : 'border-[#141414] focus:border-black text-[#141414] [&>option]:bg-white'}`}
                >
                  <option value="uniform">Uniform Color</option>
                  <option value="weight_raw">Primary Weight (Matrix 1)</option>
                  {hasSecondaryWeight && <option value="weight_secondary">Secondary Weight (Matrix 2)</option>}
                </select>
              </div>
              
              <div className="group">
                <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>Thickness Based On</label>
                <select 
                  value={filters.edgeWeightBase} 
                  onChange={e => setFilter('edgeWeightBase', e.target.value)} 
                  className={`w-full bg-transparent border p-2 text-xs font-mono outline-none transition-colors mb-4 ${isDarkMode ? 'border-[#333] focus:border-[#E4E3E0] text-[#E4E3E0] [&>option]:bg-[#1a1a1a]' : 'border-[#141414] focus:border-black text-[#141414] [&>option]:bg-white'}`}
                >
                  <option value="weight_raw">Primary Weight (Matrix 1)</option>
                  {hasSecondaryWeight && <option value="weight_secondary">Secondary Weight (Matrix 2)</option>}
                  <option value="uniform">Uniform</option>
                </select>
                <label className={`flex items-center justify-between text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>
                  <span>Thickness Scale</span>
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
              </div>
              <div className="group">
                <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>Transparency Based On</label>
                <select 
                  value={filters.edgeOpacityBase} 
                  onChange={e => setFilter('edgeOpacityBase', e.target.value)} 
                  className={`w-full bg-transparent border p-2 text-xs font-mono outline-none transition-colors mb-4 ${isDarkMode ? 'border-[#333] focus:border-[#E4E3E0] text-[#E4E3E0] [&>option]:bg-[#1a1a1a]' : 'border-[#141414] focus:border-black text-[#141414] [&>option]:bg-white'}`}
                >
                  <option value="uniform">Uniform</option>
                  <option value="weight_raw">Primary Weight (Matrix 1)</option>
                  {hasSecondaryWeight && <option value="weight_secondary">Secondary Weight (Matrix 2)</option>}
                </select>
                <label className={`flex items-center justify-between text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>
                  <span>Transparency Scale</span>
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
            </div>
          )}
        </div>  </div>

        <div className="mt-auto space-y-6 pt-8">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-[10px] font-bold uppercase tracking-widest opacity-70 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>Filter Logic Layer</h3>
              <button 
                onClick={() => {
                  setFilter('weightFilters', [...filters.weightFilters, { id: `filter-${Date.now()}`, type: 'weight_raw', cutoff: 0 }]);
                }}
                className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 border transition-colors ${isDarkMode ? 'border-[#333] hover:bg-[#333] text-[#E4E3E0]' : 'border-[#ccc] hover:bg-[#eee] text-[#141414]'}`}
              >
                + Add Filter
              </button>
            </div>
          
            <div className="space-y-6">
              {filters.weightFilters.map((wf, idx) => (
                <div key={wf.id} className="group relative border p-3 rounded-sm border-[#e0e0e0] dark:border-[#333]">
                  <button 
                    onClick={() => {
                      setFilter('weightFilters', filters.weightFilters.filter(f => f.id !== wf.id));
                    }}
                    className={`absolute top-2 right-2 text-xs opacity-50 hover:opacity-100 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}
                  >
                    ×
                  </button>
                  <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>Weight Source</label>
                  <select 
                    value={wf.type}
                    onChange={(e) => {
                      const newFilters = [...filters.weightFilters];
                      newFilters[idx] = { ...wf, type: e.target.value as any, cutoff: 0 };
                      setFilter('weightFilters', newFilters);
                    }}
                    className={`w-full bg-transparent border p-2 text-xs font-mono outline-none transition-colors mb-4 ${isDarkMode ? 'border-[#333] focus:border-[#E4E3E0] text-[#E4E3E0] [&>option]:bg-[#1a1a1a]' : 'border-[#141414] focus:border-black text-[#141414] [&>option]:bg-white'}`}
                  >
                    <option value="weight_raw">Primary Weight</option>
                    {hasSecondaryWeight && <option value="weight_secondary">Secondary Weight</option>}
                  </select>

                  <label className={`flex items-center justify-between text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>
                    <span>Cutoff Threshold</span>
                    <SyncInput 
                      className={`w-14 bg-transparent border-b text-right font-mono outline-none ${isDarkMode ? 'border-[#333] focus:border-[#E4E3E0] text-[#E4E3E0]' : 'border-[#ccc] focus:border-[#141414] text-[#141414]'}`}
                      value={wf.cutoff}
                      onChange={(v: number) => {
                        const newFilters = [...filters.weightFilters];
                        newFilters[idx] = { ...wf, cutoff: v };
                        setFilter('weightFilters', newFilters);
                      }}
                      step={wf.type === 'weight_secondary' ? (maxRelWeight <= 1.0 ? 0.01 : 0.1) : 1}
                    />
                  </label>
                  <CustomSlider
                    min="0" max={wf.type === 'weight_secondary' ? maxRelWeight : maxRawWeight} step={wf.type === 'weight_secondary' ? (maxRelWeight <= 1.0 ? 0.01 : 0.1) : 1}
                    value={wf.cutoff}
                    onChange={(v: number) => {
                      const newFilters = [...filters.weightFilters];
                      newFilters[idx] = { ...wf, cutoff: v };
                      setFilter('weightFilters', newFilters);
                    }}
                    isDarkMode={isDarkMode}
                  />
                  <div className="flex justify-between text-[9px] mt-2 opacity-50 font-mono">
                    <span>0</span>
                    <span>{wf.type === 'weight_secondary' ? maxRelWeight : maxRawWeight}</span>
                  </div>
                </div>
              ))}
              
              {/* Manual Node Removal */}
              <div className="group">
                 <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>Node Removal (ID, comma separated)</label>
                 <SyncTextInput
                    placeholder="e.g. Ag, Au, Al"
                   value={filters.removedNodes}
                   onChange={(v: string) => setFilter('removedNodes', v)}
                   className={`w-full bg-transparent border p-2 text-xs font-mono outline-none transition-colors ${isDarkMode ? 'border-[#333] focus:border-[#E4E3E0] text-[#E4E3E0]' : 'border-[#141414] focus:border-black text-[#141414]'}`}
                   list="removal-autocomplete"
                   options={rawNodes.map((n) => ({ value: n.id, label: n.label || n.name || n.id }))}
                 />
              </div>
            </div>
          </div>

          <div className={`border-t border-dotted pt-4 transition-colors ${isDarkMode ? 'border-[#555]' : 'border-[#888]'}`}>
            <div className="flex justify-between text-[11px] mb-1">
              <span>Active Nodes</span>
              <span className="font-mono">{validNodes.length} / {rawNodes.length}</span>
            </div>
            <div className="flex justify-between text-[11px] mb-1">
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
      <section className={`flex-1 relative overflow-hidden h-full flex flex-col transition-colors ${isDarkMode ? "bg-[#000]" : "bg-white"}`}>
        {/* Top Navigation Bar */}
        <div className={`flex items-center justify-between px-6 py-3 border-b z-50 ${isDarkMode ? "bg-[#222] border-[#444]" : "bg-[#f0f0f0] border-[#ccc]"}`}>
          <div className="flex text-[10px] uppercase font-bold tracking-widest bg-white dark:bg-[#141414] border border-[#141414] dark:border-[#333] shadow-sm">
            <button 
              className={`px-6 py-2 transition-colors ${activeTab === "graph" ? (isDarkMode ? "bg-[#333] text-white" : "bg-[#141414] text-white") : (isDarkMode ? "text-[#888] hover:bg-[#222]" : "text-[#888] hover:bg-[#f5f5f5]")}`}
              onClick={() => setActiveTab("graph")}
            >
              Graph
            </button>
            <button 
              className={`px-6 py-2 transition-colors border-l border-[#141414] dark:border-[#333] ${activeTab === "data" ? (isDarkMode ? "bg-[#333] text-white" : "bg-[#141414] text-white") : (isDarkMode ? "text-[#888] hover:bg-[#222]" : "text-[#888] hover:bg-[#f5f5f5]")}`}
              onClick={() => setActiveTab("data")}
            >
              Data
            </button>
          </div>
          
          <div className="flex items-center space-x-6">
            {activeTab === "data" && (
              <>
                {typeof modularity === "number" && !isNaN(modularity) && (
                  <div className="flex items-center space-x-2 text-[10px] font-bold uppercase tracking-widest mr-4">
                    <span className="opacity-60">Modularity (Q):</span>
                    <span className={`font-mono px-2 py-1 rounded ${isDarkMode ? "bg-white/10" : "bg-black/5"}`}>
                      {modularity.toFixed(4)}
                    </span>
                  </div>
                )}
                <div className="flex text-[10px] uppercase font-bold tracking-widest bg-white dark:bg-[#141414] border border-[#141414] dark:border-[#333] shadow-sm">
                  <button 
                    className={`px-4 py-2 transition-colors ${dataTab === "nodes" ? (isDarkMode ? "bg-[#333] text-white" : "bg-[#141414] text-white") : (isDarkMode ? "text-[#888] hover:bg-[#222]" : "text-[#888] hover:bg-[#f5f5f5]")}`}
                    onClick={() => setDataTab("nodes")}
                  >
                    Nodes
                  </button>
                  <button 
                    className={`px-4 py-2 transition-colors border-l border-[#141414] dark:border-[#333] ${dataTab === "edges" ? (isDarkMode ? "bg-[#333] text-white" : "bg-[#141414] text-white") : (isDarkMode ? "text-[#888] hover:bg-[#222]" : "text-[#888] hover:bg-[#f5f5f5]")}`}
                    onClick={() => setDataTab("edges")}
                  >
                    Edges
                  </button>
                </div>
              </>
            )}
            
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className={`flex items-center space-x-2 px-4 py-2 border text-[10px] uppercase font-bold tracking-widest transition-colors shadow-sm ${isDarkMode ? "bg-[#141414] border-[#333] text-[#E4E3E0] hover:bg-[#333]" : "bg-white border-[#141414] text-[#141414] hover:bg-black/5"}`}
              >
                <Download size={14} />
                <span>Export</span>
              </button>
              
              {showExportMenu && (
                <div 
                  className={`absolute right-0 mt-2 w-48 border shadow-lg z-50 flex flex-col text-[10px] uppercase font-bold tracking-widest ${isDarkMode ? 'bg-[#141414] border-[#333]' : 'bg-white border-[#ccc]'}`}
                  onMouseLeave={() => setShowExportMenu(false)}
                >
                  {activeTab === 'graph' ? (
                    <>
                      <button onClick={() => handleExport('svg')} className={`text-left px-4 py-3 hover:opacity-100 transition-opacity opacity-70 ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}>Export as SVG</button>
                      <button onClick={() => handleExport('png')} className={`text-left px-4 py-3 hover:opacity-100 transition-opacity opacity-70 ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}>Export as PNG</button>
                      <button onClick={() => handleExport('jpeg')} className={`text-left px-4 py-3 hover:opacity-100 transition-opacity opacity-70 ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}>Export as JPG</button>
                      <div className={`h-px w-full ${isDarkMode ? 'bg-[#333]' : 'bg-[#eee]'}`}></div>
                      <button onClick={() => handleExport('json')} className={`text-left px-4 py-3 hover:opacity-100 transition-opacity opacity-70 ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}>Export JSON</button>
                      <button onClick={() => handleExport('graphml')} className={`text-left px-4 py-3 hover:opacity-100 transition-opacity opacity-70 ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}>Export GraphML</button>
                      <button onClick={() => handleExport('csvzip')} className={`text-left px-4 py-3 hover:opacity-100 transition-opacity opacity-70 ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}>Export Node/Edge CSV (ZIP)</button>
                      <div className={`h-px w-full ${isDarkMode ? 'bg-[#333]' : 'bg-[#eee]'}`}></div>
                      <button onClick={() => handleExport('settings')} className={`text-left px-4 py-3 hover:opacity-100 transition-opacity opacity-70 ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}>Export Settings</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => handleExport('csv')} className={`text-left px-4 py-3 hover:opacity-100 transition-opacity opacity-70 ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}>Export Table CSV</button>
                      <button onClick={() => handleExport('csvzip_table')} className={`text-left px-4 py-3 hover:opacity-100 transition-opacity opacity-70 ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}>Export Node/Edge Table CSV (ZIP)</button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {validNodes.length > 0 ? (
          <>
            {activeTab === "graph" && (
              <div className="flex-1 w-full h-full relative">
                <D3Graph 
                  nodes={validNodes} 
                  edges={validEdges} 
                  communityMap={communityMap}
                  networkMetrics={networkMetrics}
                  nodeSizeMult={appliedFilters.nodeSize || 3}
                  nodeSizeBase={appliedFilters.nodeSizeBase || "abundance"}
                  nodeColorBase={appliedFilters.nodeColorBase || "community"}
                  edgeWeightMult={appliedFilters.edgeWeight || 1}
                  edgeWeightBase={appliedFilters.edgeWeightBase || "weight_raw"}
                  edgeColorBase={appliedFilters.edgeColorBase || "uniform"}
                  edgeOpacity={appliedFilters.edgeOpacity || 0.8}
                  edgeOpacityBase={appliedFilters.edgeOpacityBase || "uniform"}
                  forceStrength={appliedFilters.forceStrength || -100}
                  directed={directed}
                  bipartite={bipartite}
                  livePhysics={appliedFilters.livePhysics}
                  isFrozen={appliedFilters.isFrozen}
                  isDarkMode={isDarkMode}
                  refreshKey={refreshKey}
                  onRefresh={() => setRefreshKey(k => k + 1)}
                  onElementDoubleClick={handleElementDoubleClick}
                  onClearSelection={() => setSelectedElement(null)}
                  searchQuery={searchQuery}
                  selectedElement={selectedElement}
                />
              </div>
            )}
            
            {activeTab === "data" && (
              <div className="flex-1 w-full h-full overflow-auto">
                {dataTab === "nodes" && (
                  <table className={`w-full text-left text-xs border-collapse ${isDarkMode ? "text-[#ddd]" : "text-[#333]"}`}>
                    <thead className={`sticky top-0 shadow-sm z-10 ${isDarkMode ? "bg-[#222] border-b border-[#444]" : "bg-[#f0f0f0] border-b border-[#ccc]"}`}>
                      <tr>
                        <th className="p-3 font-bold uppercase tracking-wider cursor-pointer hover:bg-black/5 dark:hover:bg-white/5" onClick={() => handleSort("id")}>
                          Node ID {sortConfig?.key === "id" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                        </th>
                        <th className="p-3 font-bold uppercase tracking-wider cursor-pointer hover:bg-black/5 dark:hover:bg-white/5" onClick={() => handleSort("label")}>
                          Label {sortConfig?.key === "label" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                        </th>
                        <th className="p-3 font-bold uppercase tracking-wider cursor-pointer hover:bg-black/5 dark:hover:bg-white/5" onClick={() => handleSort("abundance")}>
                          Abundance {sortConfig?.key === "abundance" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                        </th>
                        {directed ? (
                          <>
                            <th className="p-3 font-bold uppercase tracking-wider cursor-pointer hover:bg-black/5 dark:hover:bg-white/5" onClick={() => handleSort("inDegree")}>
                              In Degree {sortConfig?.key === "inDegree" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                            </th>
                            <th className="p-3 font-bold uppercase tracking-wider cursor-pointer hover:bg-black/5 dark:hover:bg-white/5" onClick={() => handleSort("outDegree")}>
                              Out Degree {sortConfig?.key === "outDegree" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                            </th>
                          </>
                        ) : (
                          <th className="p-3 font-bold uppercase tracking-wider cursor-pointer hover:bg-black/5 dark:hover:bg-white/5" onClick={() => handleSort("degree")}>
                            Degree {sortConfig?.key === "degree" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                          </th>
                        )}
                        <th className="p-3 font-bold uppercase tracking-wider cursor-pointer hover:bg-black/5 dark:hover:bg-white/5" onClick={() => handleSort("eigenvector")}>
                          Eigenvector {sortConfig?.key === "eigenvector" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                        </th>
                        <th className="p-3 font-bold uppercase tracking-wider cursor-pointer hover:bg-black/5 dark:hover:bg-white/5" onClick={() => handleSort("pagerank")}>
                          PageRank {sortConfig?.key === "pagerank" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                        </th>
                        <th className="p-3 font-bold uppercase tracking-wider cursor-pointer hover:bg-black/5 dark:hover:bg-white/5" onClick={() => handleSort("community")}>
                          Community {sortConfig?.key === "community" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                        </th>
                        <th className="p-3 font-bold uppercase tracking-wider cursor-pointer hover:bg-black/5 dark:hover:bg-white/5" onClick={() => handleSort("deltaQ")}>
                          ΔQ {sortConfig?.key === "deltaQ" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableData.map(node => {
                        const isSelected = selectedElement === node.id;
                        return (
                          <tr 
                            id={`row-${node.id}`} 
                            key={node.id} 
                            onDoubleClick={() => {
                              setSelectedElement(node.id);
                              setActiveTab("graph");
                            }}
                            className={`border-b cursor-pointer ${isSelected ? (isDarkMode ? "bg-[#333] border-[#555]" : "bg-[#ccc] border-[#aaa]") : (isDarkMode ? "border-[#333] hover:bg-[#1a1a1a]" : "border-[#eee] hover:bg-[#fcfcfc]")}`}
                          >
                            <td className="p-2 font-mono font-bold">{node.id}</td>
                            <td className="p-2">{node.label || node.name || "-"}</td>
                            <td className="p-2 font-mono">{node.abundance || "-"}</td>
                            {directed ? (
                              <>
                                <td className="p-2 font-mono">{node.net.inDegree || 0}</td>
                                <td className="p-2 font-mono">{node.net.outDegree || 0}</td>
                              </>
                            ) : (
                              <td className="p-2 font-mono">{node.net.degree || 0}</td>
                            )}
                            <td className="p-2 font-mono">{node.net.eigenvector || 0}</td>
                            <td className="p-2 font-mono">{node.net.pagerank || 0}</td>
                            <td className="p-2">
                              <div className="flex items-center space-x-2">
                                {node.comm && <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getCommunityColor(node.comm, allCommunityLabels) }} />}
                                <span>{node.comm || "-"}</span>
                              </div>
                            </td>
                            <td className="p-2 font-mono">{node.mod.deltaQ || "-"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}

                {dataTab === "edges" && (
                  <table className={`w-full text-left text-xs border-collapse ${isDarkMode ? "text-[#ddd]" : "text-[#333]"}`}>
                    <thead className={`sticky top-0 shadow-sm z-10 ${isDarkMode ? "bg-[#222] border-b border-[#444]" : "bg-[#f0f0f0] border-b border-[#ccc]"}`}>
                      <tr>
                        <th className="p-3 font-bold uppercase tracking-wider cursor-pointer hover:bg-black/5 dark:hover:bg-white/5" onClick={() => handleSort("source")}>
                          Source {sortConfig?.key === "source" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                        </th>
                        <th className="p-3 font-bold uppercase tracking-wider cursor-pointer hover:bg-black/5 dark:hover:bg-white/5" onClick={() => handleSort("target")}>
                          Target {sortConfig?.key === "target" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                        </th>
                        <th className="p-3 font-bold uppercase tracking-wider cursor-pointer hover:bg-black/5 dark:hover:bg-white/5" onClick={() => handleSort("weight_raw")}>
                          Primary Weight {sortConfig?.key === "weight_raw" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                        </th>
                        <th className="p-3 font-bold uppercase tracking-wider cursor-pointer hover:bg-black/5 dark:hover:bg-white/5" onClick={() => handleSort("weight_secondary")}>
                          Secondary Weight {sortConfig?.key === "weight_secondary" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableDataEdges.map((edge, idx) => {
                        const edgeId = `${edge.source}-${edge.target}`;
                        const isSelected = selectedElement === edgeId;
                        return (
                          <tr 
                            id={`row-${edgeId}`} 
                            key={idx} 
                            onDoubleClick={() => {
                              setSelectedElement(edgeId);
                              setActiveTab("graph");
                            }}
                            className={`border-b cursor-pointer ${isSelected ? (isDarkMode ? "bg-[#333] border-[#555]" : "bg-[#ccc] border-[#aaa]") : (isDarkMode ? "border-[#333] hover:bg-[#1a1a1a]" : "border-[#eee] hover:bg-[#fcfcfc]")}`}
                          >
                            <td className="p-2 font-mono">{edge.source}</td>
                            <td className="p-2 font-mono">{edge.target}</td>
                            <td className="p-2 font-mono">{edge.weight_raw}</td>
                            <td className="p-2 font-mono">{edge.weight_secondary || "-"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
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
