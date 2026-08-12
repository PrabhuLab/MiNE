import React from 'react';
import { useStore } from '@/store/useStore';
import { SyncInput } from '@/components/ui/SyncInput';
import { CustomSlider } from '@/components/ui/CustomSlider';
import { availableCustomNodeAttributes, availableNumericCustomEdgeAttributes, detectCustomAttributeType } from '@/lib/graphIO';

interface CustomizationControlsProps {
  networkMetrics: any[];
  hasType: boolean;
  hasAbundance: boolean;
  hasSecondaryWeight: boolean;
}

export const CustomizationControls = ({
  networkMetrics,
  hasType,
  hasAbundance,
  hasSecondaryWeight,
}: CustomizationControlsProps) => {
  const { filters, setFilter, isDarkMode, directed, bipartite, rawNodes, rawEdges, customAttributes, setCustomAttributes } = useStore();
  const [activeControlTab, setActiveControlTab] = React.useState('nodes');
  const hasLouvain = networkMetrics.some(m => m.louvain !== undefined);
  const hasDegree = networkMetrics.some(m => m.degree !== undefined || m.inDegree !== undefined || m.degreeCentrality !== undefined || m.inDegreeCentrality !== undefined) || networkMetrics.length > 0;
  const hasEigen = networkMetrics.some(m => m.eigenvector !== undefined);
  const hasPageRank = networkMetrics.some(m => m.pagerank !== undefined);
  const hasBetweenness = networkMetrics.some(m => m.betweenness !== undefined);
  const hasCloseness = networkMetrics.some(m => m.closeness !== undefined);
  const hasClustering = networkMetrics.some(m => m.clustering !== undefined);
  const customOptions = React.useMemo(() => availableCustomNodeAttributes(rawNodes), [rawNodes]);
  const numericCustomOptions = React.useMemo(() => customOptions.filter((attribute) => {
    const values = rawNodes
      .map((node) => node[attribute])
      .filter((value) => value !== null && value !== undefined && String(value).trim() !== '');
    return values.length > 0 && values.every((value) => Number.isFinite(Number(value)));
  }), [customOptions, rawNodes]);
  const numericCustomEdgeOptions = React.useMemo(() => availableNumericCustomEdgeAttributes(rawEdges), [rawEdges]);
  const selectedCustomMetadata = customAttributes.find((attribute) => attribute.scope === 'node' && attribute.name === filters.customNodeAttribute);
  const selectCustomAttribute = (name: string) => {
    setFilter('customNodeAttribute', name);
    if (!name) return;
    const detectedType = detectCustomAttributeType(rawNodes.map((node) => node[name]));
    setCustomAttributes([
      ...customAttributes.filter((attribute) => attribute.scope !== 'node' || attribute.name !== name),
      { name, scope: 'node', detectedType, selectedType: detectedType },
    ]);
  };

  return (
    <div>
    <div className="flex items-center justify-between mb-4">
      <h3 className={`text-[10px] font-bold uppercase tracking-widest opacity-70 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>Visual Customization</h3>
    </div>
    
    <div className="flex border-b mb-6">
      <button 
        className={`flex-1 text-[10px] font-bold uppercase tracking-widest py-2 border-b-2 transition-colors ${activeControlTab === "nodes" ? (isDarkMode ? "border-[#E4E3E0] text-[#E4E3E0]" : "border-[#141414] text-[#141414]") : (isDarkMode ? "border-transparent text-[#888] hover:text-[#ccc]" : "border-transparent text-[#888] hover:text-[#444]")}`}
        onClick={() => setActiveControlTab("nodes")}
      >
        Nodes
      </button>
      <button 
        className={`flex-1 text-[10px] font-bold uppercase tracking-widest py-2 border-b-2 transition-colors ${activeControlTab === "edges" ? (isDarkMode ? "border-[#E4E3E0] text-[#E4E3E0]" : "border-[#141414] text-[#141414]") : (isDarkMode ? "border-transparent text-[#888] hover:text-[#ccc]" : "border-transparent text-[#888] hover:text-[#444]")}`}
        onClick={() => setActiveControlTab("edges")}
      >
        Edges
      </button>
    </div>

    {activeControlTab === "nodes" && (
      <div className="space-y-5">
        <div>
          <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>Node Color Coding</label>
          <select 
            value={filters.nodeColorBase}
            onChange={(e) => setFilter('nodeColorBase', e.target.value)}
            className={`w-full bg-transparent border p-2 text-xs font-mono outline-none transition-colors mb-2 ${isDarkMode ? 'border-[#333] focus:border-[#E4E3E0] text-[#E4E3E0] [&>option]:bg-[#1a1a1a]' : 'border-[#141414] focus:border-black text-[#141414] [&>option]:bg-white'}`}
          >
            <option value="custom">Custom</option>
            {hasType && <option value="type">Node Type</option>}
            {hasLouvain && <option value="louvain">Louvain</option>}
            {hasDegree && <option value="degreeCentrality">Node Degree</option>}
            {hasEigen && <option value="eigenvector">Eigenvector Centrality</option>}
            {hasPageRank && <option value="pagerank">PageRank</option>}
            {hasBetweenness && <option value="betweenness">Betweenness Centrality</option>}
            {hasCloseness && <option value="closeness">Closeness Centrality</option>}
            {hasClustering && <option value="clustering">Clustering Coefficient</option>}
            <option value="uniform">Uniform</option>
          </select>
          {filters.nodeColorBase === 'custom' && (
            <div className="grid grid-cols-2 gap-2 mb-2">
              <select value={filters.customNodeAttribute} onChange={(event) => selectCustomAttribute(event.target.value)} className={`w-full bg-transparent border p-2 text-[10px] font-mono ${isDarkMode ? 'border-[#333]' : 'border-[#141414]'}`}>
                <option value="">Community (legacy)</option>
                {customOptions.map((attribute) => <option key={attribute} value={attribute}>{attribute}</option>)}
              </select>
              <select
                disabled={!selectedCustomMetadata}
                value={selectedCustomMetadata?.selectedType || 'nominal'}
                onChange={(event) => setCustomAttributes(customAttributes.map((attribute) => attribute === selectedCustomMetadata ? { ...attribute, selectedType: event.target.value as any } : attribute))}
                className={`w-full bg-transparent border p-2 text-[10px] font-mono disabled:opacity-40 ${isDarkMode ? 'border-[#333]' : 'border-[#141414]'}`}
              >
                <option value="binary">Binary</option>
                <option value="discrete">Discrete</option>
                <option value="continuous">Continuous</option>
                <option value="nominal">Nominal</option>
                <option value="ordinal">Ordinal</option>
              </select>
            </div>
          )}
          {filters.nodeColorBase === 'uniform' && (
             <div className="flex items-center space-x-2 mt-2">
                <input 
                  type="color" 
                  value={filters.uniformNodeColor} 
                  onChange={(e) => setFilter('uniformNodeColor', e.target.value)}
                  className="w-6 h-6 p-0 border-0 cursor-pointer"
                />
                <span className={`text-[10px] uppercase tracking-widest font-bold opacity-70 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>Select Color</span>
             </div>
          )}
        </div>

        <div>
          <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>Node Size Scale</label>
          <select 
            value={filters.nodeSizeBase}
            onChange={(e) => setFilter('nodeSizeBase', e.target.value)}
            className={`w-full bg-transparent border p-2 text-xs font-mono outline-none transition-colors ${isDarkMode ? 'border-[#333] focus:border-[#E4E3E0] text-[#E4E3E0] [&>option]:bg-[#1a1a1a]' : 'border-[#141414] focus:border-black text-[#141414] [&>option]:bg-white'}`}
          >
            <option value="uniform">Uniform</option>
            {hasAbundance && <option value="abundance">Abundance</option>}
            {hasDegree && <option value="degree">Node Degree</option>}
            {hasEigen && <option value="eigenvector">Eigenvector Centrality</option>}
            {hasPageRank && <option value="pagerank">PageRank</option>}
            {hasBetweenness && <option value="betweenness">Betweenness Centrality</option>}
            {hasCloseness && <option value="closeness">Closeness Centrality</option>}
            {hasClustering && <option value="clustering">Clustering Coefficient</option>}
            {selectedCustomMetadata && ['discrete', 'continuous'].includes(selectedCustomMetadata.selectedType) && (
              <option value="custom">Custom: {selectedCustomMetadata.name}</option>
            )}
          </select>
        </div>
        
        <div className="group pt-2">
          <label className={`flex items-center justify-between text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>
            <span>Base Size Multiplier</span>
            <SyncInput 
              className={`w-14 bg-transparent border-b text-right font-mono outline-none ${isDarkMode ? 'border-[#333] focus:border-[#E4E3E0] text-[#E4E3E0]' : 'border-[#ccc] focus:border-[#141414] text-[#141414]'}`}
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

        {bipartite && (
          <div className="group pt-2">
            <label className={`flex items-center justify-between text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>
              <span>Bipartite Node Size</span>
              <SyncInput 
                className={`w-14 bg-transparent border-b text-right font-mono outline-none ${isDarkMode ? 'border-[#333] focus:border-[#E4E3E0] text-[#E4E3E0]' : 'border-[#ccc] focus:border-[#141414] text-[#141414]'}`}
                value={filters.bipartiteNodeSize ?? 2}
                onChange={(v: number) => setFilter('bipartiteNodeSize', v)}
                step="0.5"
              />
            </label>
            <CustomSlider 
              min="0.5" max="10" step="0.5"
              value={filters.bipartiteNodeSize ?? 2}
              onChange={(v: number) => setFilter('bipartiteNodeSize', v)}
              isDarkMode={isDarkMode}
            />
          </div>
        )}

        <div className="group pt-2">
          <label className={`flex items-center justify-between text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>
            <span>Node Opacity</span>
            <SyncInput 
              className={`w-14 bg-transparent border-b text-right font-mono outline-none ${isDarkMode ? 'border-[#333] focus:border-[#E4E3E0] text-[#E4E3E0]' : 'border-[#ccc] focus:border-[#141414] text-[#141414]'}`}
              value={filters.nodeOpacity ?? 1}
              onChange={(v: number) => setFilter('nodeOpacity', v)}
              step="0.05"
            />
          </label>
          <CustomSlider 
            min="0.0" max="1.0" step="0.05"
            value={filters.nodeOpacity ?? 1}
            onChange={(v: number) => setFilter('nodeOpacity', v)}
            isDarkMode={isDarkMode}
          />
        </div>

        <div className="group pt-2">
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
    )}
    {activeControlTab === "edges" && (
      <div className="space-y-5">
        <div>
          <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>Edge Color Base</label>
          <select 
            value={filters.edgeColorBase}
            onChange={(e) => {
              const val = e.target.value;
              setFilter('edgeColorBase', val);
              if (val === 'nodeMetric' && !filters.edgeColorNodeMetric) {
                setFilter('edgeColorNodeMetric', 'custom');
              }
            }}
            className={`w-full bg-transparent border p-2 text-xs font-mono outline-none transition-colors mb-2 ${isDarkMode ? 'border-[#333] focus:border-[#E4E3E0] text-[#E4E3E0] [&>option]:bg-[#1a1a1a]' : 'border-[#141414] focus:border-black text-[#141414] [&>option]:bg-white'}`}
          >
            <option value="uniform">Uniform</option>
            <option value="weight_raw">Raw / Absolute Edge Weight</option>
            {hasSecondaryWeight && <option value="weight_secondary">{directed ? 'Directed / Conditional Edge Weight' : 'Secondary / Transformed Edge Weight'}</option>}
            {numericCustomEdgeOptions.map((attribute) => <option key={`edge-color-${attribute}`} value={`edge:${attribute}`}>Custom Edge: {attribute}</option>)}
            <option value="nodeMetric">Node Metrics</option>
          </select>
          {filters.edgeColorBase === 'uniform' && (
             <div className="flex items-center space-x-2 mt-2">
                <input 
                  type="color" 
                  value={filters.uniformEdgeColor} 
                  onChange={(e) => setFilter('uniformEdgeColor', e.target.value)}
                  className="w-6 h-6 p-0 border-0 cursor-pointer"
                />
                <span className={`text-[10px] uppercase tracking-widest font-bold opacity-70 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>Select Color</span>
             </div>
          )}
          {filters.edgeColorBase === 'nodeMetric' && (
            <>
            <div className="mt-2 flex border rounded-sm overflow-hidden text-[10px] font-bold uppercase tracking-widest border-[#ccc] dark:border-[#333]">
               <button 
                 className={`flex-1 py-1 transition-colors ${filters.edgeColorNodeTarget === 'source' ? (isDarkMode ? 'bg-[#333] text-white' : 'bg-[#e0e0e0] text-[#141414]') : (isDarkMode ? 'text-[#888] hover:bg-[#222]' : 'text-[#888] hover:bg-[#f5f5f5]')}`}
                 onClick={() => setFilter('edgeColorNodeTarget', 'source')}
               >
                 Source Node
               </button>
               <button 
                 className={`flex-1 py-1 transition-colors border-l border-[#ccc] dark:border-[#333] ${filters.edgeColorNodeTarget === 'target' ? (isDarkMode ? 'bg-[#333] text-white' : 'bg-[#e0e0e0] text-[#141414]') : (isDarkMode ? 'text-[#888] hover:bg-[#222]' : 'text-[#888] hover:bg-[#f5f5f5]')}`}
                 onClick={() => setFilter('edgeColorNodeTarget', 'target')}
               >
                 Target Node
               </button>
            </div>
            <select 
              value={filters.edgeColorNodeMetric}
              onChange={(e) => setFilter('edgeColorNodeMetric', e.target.value)}
              className={`w-full bg-transparent border p-2 mt-2 text-xs font-mono outline-none transition-colors ${isDarkMode ? 'border-[#333] focus:border-[#E4E3E0] text-[#E4E3E0] [&>option]:bg-[#1a1a1a]' : 'border-[#141414] focus:border-black text-[#141414] [&>option]:bg-white'}`}
            >
              <option value="custom">Custom</option>
              {customOptions.map((attribute) => <option key={`edge-node-custom-${attribute}`} value={`custom:${attribute}`}>Custom: {attribute}</option>)}
              {hasType && <option value="type">Node Type</option>}
              {hasLouvain && <option value="louvain">Louvain</option>}
              {hasDegree && <option value="degreeCentrality">Node Degree</option>}
              {hasEigen && <option value="eigenvector">Eigenvector Centrality</option>}
              {hasPageRank && <option value="pagerank">PageRank</option>}
              {hasBetweenness && <option value="betweenness">Betweenness Centrality</option>}
              {hasCloseness && <option value="closeness">Closeness Centrality</option>}
              {hasClustering && <option value="clustering">Clustering Coefficient</option>}
            </select>
            </>
          )}
        </div>
        <div>
          <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>Edge Weight Base</label>
          <select 
            value={filters.edgeWeightBase}
            onChange={(e) => setFilter('edgeWeightBase', e.target.value)}
            className={`w-full bg-transparent border p-2 text-xs font-mono outline-none transition-colors ${isDarkMode ? 'border-[#333] focus:border-[#E4E3E0] text-[#E4E3E0] [&>option]:bg-[#1a1a1a]' : 'border-[#141414] focus:border-black text-[#141414] [&>option]:bg-white'}`}
          >
            <option value="weight_raw">Raw / Absolute Edge Weight</option>
            {hasSecondaryWeight && <option value="weight_secondary">{directed ? 'Directed / Conditional Edge Weight' : 'Secondary / Transformed Edge Weight'}</option>}
            {numericCustomEdgeOptions.map((attribute) => <option key={`edge-size-${attribute}`} value={`edge:${attribute}`}>Custom Edge: {attribute}</option>)}
            <option value="node:abundance">Node Abundance (Mean)</option>
            {numericCustomOptions.map((attribute) => <option key={`edge-size-node-${attribute}`} value={`node:${attribute}`}>Custom Node: {attribute}</option>)}
            <option value="node:degree">Node Degree (Mean)</option>
            {directed && <option value="node:inDegree">Node In-Degree (Mean)</option>}
            {directed && <option value="node:outDegree">Node Out-Degree (Mean)</option>}
            {hasEigen && <option value="metric:eigenvector">Eigenvector Centrality (Mean)</option>}
            {hasPageRank && <option value="metric:pagerank">PageRank (Mean)</option>}
            {hasBetweenness && <option value="metric:betweenness">Betweenness Centrality (Mean)</option>}
            {hasCloseness && <option value="metric:closeness">Closeness Centrality (Mean)</option>}
            {hasClustering && <option value="metric:clustering">Clustering Coefficient (Mean)</option>}
            <option value="uniform">Uniform</option>
          </select>
        </div>
        <div className="group pt-2">
          <label className={`flex items-center justify-between text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>
            <span>Thickness Multiplier</span>
            <SyncInput 
              className={`w-14 bg-transparent border-b text-right font-mono outline-none ${isDarkMode ? 'border-[#333] focus:border-[#E4E3E0] text-[#E4E3E0]' : 'border-[#ccc] focus:border-[#141414] text-[#141414]'}`}
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
        
        <div>
          <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>Edge Opacity Base</label>
          <select 
            value={filters.edgeOpacityBase}
            onChange={(e) => setFilter('edgeOpacityBase', e.target.value)}
            className={`w-full bg-transparent border p-2 text-xs font-mono outline-none transition-colors ${isDarkMode ? 'border-[#333] focus:border-[#E4E3E0] text-[#E4E3E0] [&>option]:bg-[#1a1a1a]' : 'border-[#141414] focus:border-black text-[#141414] [&>option]:bg-white'}`}
          >
            <option value="uniform">Uniform</option>
            <option value="weight_raw">Raw / Absolute Edge Weight</option>
            {hasSecondaryWeight && <option value="weight_secondary">{directed ? 'Directed / Conditional Edge Weight' : 'Secondary / Transformed Edge Weight'}</option>}
            {numericCustomEdgeOptions.map((attribute) => <option key={`edge-opacity-${attribute}`} value={`edge:${attribute}`}>Custom Edge: {attribute}</option>)}
            <option value="nodeMetric">Node Metrics</option>
          </select>
        </div>
        {filters.edgeOpacityBase === 'nodeMetric' && (
          <select
            value={filters.edgeColorNodeMetric}
            onChange={(event) => setFilter('edgeColorNodeMetric', event.target.value)}
            className={`w-full bg-transparent border p-2 text-xs font-mono outline-none transition-colors ${isDarkMode ? 'border-[#333] text-[#E4E3E0]' : 'border-[#141414] text-[#141414]'}`}
          >
            <option value="custom">Custom</option>
            {numericCustomOptions.map((attribute) => <option key={`edge-opacity-node-${attribute}`} value={`custom:${attribute}`}>Custom: {attribute}</option>)}
            <option value="degreeCentrality">Node Degree</option>
            {hasEigen && <option value="eigenvector">Eigenvector Centrality</option>}
            {hasPageRank && <option value="pagerank">PageRank</option>}
            {hasBetweenness && <option value="betweenness">Betweenness Centrality</option>}
            {hasCloseness && <option value="closeness">Closeness Centrality</option>}
            {hasClustering && <option value="clustering">Clustering Coefficient</option>}
          </select>
        )}
        <div className="group pt-2">
          <label className={`flex items-center justify-between text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>
            <span>Base Opacity</span>
            <SyncInput 
              className={`w-14 bg-transparent border-b text-right font-mono outline-none ${isDarkMode ? 'border-[#333] focus:border-[#E4E3E0] text-[#E4E3E0]' : 'border-[#ccc] focus:border-[#141414] text-[#141414]'}`}
              value={filters.edgeOpacity}
              onChange={(v: number) => setFilter('edgeOpacity', v)}
              step="0.05"
            />
          </label>
          <CustomSlider 
            min="0.0" max="1.0" step="0.05"
            value={filters.edgeOpacity}
            onChange={(v: number) => setFilter('edgeOpacity', v)}
            isDarkMode={isDarkMode}
          />
        </div>
      </div>
    )}
    </div>
  );
};
