'use client';

import React, { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useStore, RawNode, RawEdge } from '@/store/useStore';
import * as d3 from 'd3';
import { getCommunityColor } from '@/lib/communityUtils';
import { ChevronLeft, ChevronRight, Sun, Moon, Download } from 'lucide-react';
import { exportSvg, exportImage, exportCsv, exportJson, exportCsvZip, exportGraphML, exportWorkspaceSettings } from '@/lib/exportUtils';
import { 
  computeMaxRelWeight, 
  computeMaxRawWeight,
} from '@/lib/workspaceUtils';
import { useGraphFilters } from '@/hooks/useGraphFilters';
import { useGraphMetrics } from '@/hooks/useGraphMetrics';
import { useDataTableSort } from '@/hooks/useDataTableSort';

// Dynamically import D3Graph so it only runs on the client due to canvas/SVG dependencies
const D3Graph = dynamic(() => import('./D3Graph'), { ssr: false });
import { SyncInput, SyncTextInput } from '@/components/ui/SyncInput';
import { SegmentedToggle } from '@/components/ui/SegmentedToggle';
import { CustomSlider } from '@/components/ui/CustomSlider';

import { WorkspaceSidebar } from "@/components/workspace/WorkspaceSidebar";
import { WorkspaceDataTable } from "@/components/workspace/WorkspaceDataTable";

export default function Workspace() {
  const { rawNodes, rawEdges, filters, setFilter, communityMap, setCommunityMap, directed, bipartite, isDarkMode, setIsDarkMode, selectedElement, setSelectedElement, projectName } = useStore();

  const {
    appliedFilters,
    setAppliedFilters,
    validNodes,
    validEdges,
    hasType,
    hasAbundance,
    hasSecondaryWeight
  } = useGraphFilters();

  const {
    networkMetrics,
    nodeMetrics,
    modularity,
    metricsToRun,
    setMetricsToRun,
    metricsLoading,
    runSelectedMetrics
  } = useGraphMetrics(validNodes, validEdges, appliedFilters, rawNodes);

  const {
    searchQuery,
    setSearchQuery,
    sortConfig,
    setSortConfig,
    tableData,
    tableDataEdges
  } = useDataTableSort(validNodes, validEdges, networkMetrics, nodeMetrics);

  const hasEigenvector = networkMetrics.some(m => m.eigenvector !== undefined);
  const hasPageRank = networkMetrics.some(m => m.pagerank !== undefined);
  const hasBetweenness = networkMetrics.some(m => m.betweenness !== undefined);
  const hasCloseness = networkMetrics.some(m => m.closeness !== undefined);
  const hasClustering = networkMetrics.some(m => m.clustering !== undefined);
  const hasInDegreeCent = networkMetrics.some(m => m.inDegreeCentrality !== undefined);
  const hasOutDegreeCent = networkMetrics.some(m => m.outDegreeCentrality !== undefined);
  const hasDegreeCent = networkMetrics.some(m => m.degreeCentrality !== undefined);

  const [refreshKey, setRefreshKey] = useState(0);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<"graph" | "data">("graph");
  const [dataTab, setDataTab] = useState<"nodes" | "edges">("nodes");
  const [activeControlTab, setActiveControlTab] = useState<"nodes" | "edges" | "communities" | "metrics">("nodes");
  const [showExportMenu, setShowExportMenu] = useState(false);

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
    if (activeTab === "data") {
      setActiveTab("graph");
    } else {
      setActiveTab("data");
      setDataTab(type + "s" as any);
    }
  };

  // Compute max relative weight for slider dynamically
  const maxRelWeight = useMemo(() => computeMaxRelWeight(rawEdges), [rawEdges]);

  // Compute max absolute weight for slider dynamically
  const maxRawWeight = useMemo(() => computeMaxRawWeight(rawEdges), [rawEdges]);

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
        let el = document.getElementById(`row-${selectedElement}`);
        if (!el && selectedElement.includes('-')) {
          const parts = selectedElement.split('-');
          if (parts.length === 2) {
            el = document.getElementById(`row-${parts[1]}-${parts[0]}`);
          }
        }
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 120);
    }
  }, [activeTab, selectedElement, dataTab]);

  return (
    <div className={`flex flex-1 overflow-hidden h-full w-full transition-colors ${isDarkMode ? 'bg-[#141414] text-[#E4E3E0]' : 'bg-[#E4E3E0] text-[#141414]'}`}>
      {/* SIDEBAR CONTROL PANEL */}
      
      <WorkspaceSidebar 
        networkMetrics={networkMetrics}
        isSidebarCollapsed={isSidebarCollapsed}
        setIsSidebarCollapsed={setIsSidebarCollapsed}
        handleImportWorkspace={handleImportWorkspace}
        metricsToRun={metricsToRun}
        setMetricsToRun={setMetricsToRun}
        runSelectedMetrics={runSelectedMetrics}
        metricsLoading={metricsLoading}
        maxRelWeight={maxRelWeight}
        maxRawWeight={maxRawWeight}
        hasType={hasType}
        hasAbundance={hasAbundance}
        hasSecondaryWeight={hasSecondaryWeight}
        validNodes={validNodes}
        rawNodes={rawNodes}
        validEdges={validEdges}
        rawEdges={rawEdges}
        removedNodesString={removedNodesString}
        removedNodesCount={removedNodesCount}
        setAppliedFilters={setAppliedFilters}
      />

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
            <div className={`flex-1 w-full h-full relative ${activeTab === "graph" ? "block" : "hidden"}`}>
              <D3Graph 
                nodes={validNodes} 
                edges={validEdges} 
                communityMap={communityMap}
                networkMetrics={networkMetrics}
                nodeSizeMult={appliedFilters.nodeSize || 3}
                nodeSizeBase={appliedFilters.nodeSizeBase || "abundance"}
                nodeColorBase={appliedFilters.nodeColorBase || "custom"}
                uniformNodeColor={appliedFilters.uniformNodeColor || "#cccccc"}
                uniformEdgeColor={appliedFilters.uniformEdgeColor || "#888888"}
                edgeWeightMult={appliedFilters.edgeWeight || 1}
                edgeWeightBase={appliedFilters.edgeWeightBase || "weight_raw"}
                edgeColorBase={appliedFilters.edgeColorBase || "uniform"}
                edgeColorNodeMetric={appliedFilters.edgeColorNodeMetric || "custom"}
                edgeColorNodeTarget={appliedFilters.edgeColorNodeTarget || "source"}
                edgeOpacity={appliedFilters.edgeOpacity ?? 0.3}
                edgeOpacityBase={appliedFilters.edgeOpacityBase || "uniform"}
                forceStrength={appliedFilters.forceStrength || -100}
                directed={directed}
                bipartite={bipartite}
                livePhysics={appliedFilters.livePhysics}
                isDarkMode={isDarkMode}
                refreshKey={refreshKey}
                onRefresh={() => {
                  setRefreshKey(k => k + 1);
                }}
                onElementDoubleClick={handleElementDoubleClick}
                onClearSelection={() => setSelectedElement(null)}
                searchQuery={searchQuery}
                selectedElement={selectedElement}
              />
            </div>
            
            <div className={`flex-1 w-full h-full overflow-hidden ${activeTab === "data" ? "block" : "hidden"}`}>
              <WorkspaceDataTable dataTab={dataTab} tableData={tableData} tableDataEdges={tableDataEdges} networkMetrics={networkMetrics} handleSort={handleSort} sortConfig={sortConfig} handleElementDoubleClick={handleElementDoubleClick} />
            </div>
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
