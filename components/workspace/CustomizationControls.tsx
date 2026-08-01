import React from 'react';
import { useStore } from '@/store/useStore';
import { SyncInput } from '@/components/ui/SyncInput';
import { CustomSlider } from '@/components/ui/CustomSlider';

interface CustomizationControlsProps {
  networkMetrics: any[];
  hasType: boolean;
  hasAbundance: boolean;
  hasSecondaryWeight: boolean;
  maxRelWeight: number;
  maxRawWeight: number;
}

export const CustomizationControls = ({
  networkMetrics,
  hasType,
  hasAbundance,
  hasSecondaryWeight,
  maxRelWeight,
  maxRawWeight
}: CustomizationControlsProps) => {
  const { filters, setFilter, isDarkMode } = useStore();
  const [activeControlTab, setActiveControlTab] = React.useState('nodes');
  const hasLouvain = networkMetrics.some(m => m.louvain !== undefined);
  const hasLeiden = networkMetrics.some(m => m.leiden !== undefined);
  const hasDegree = networkMetrics.some(m => m.degree !== undefined || m.inDegree !== undefined || m.degreeCentrality !== undefined || m.inDegreeCentrality !== undefined) || networkMetrics.length > 0;
  const hasEigen = networkMetrics.some(m => m.eigenvector !== undefined);
  const hasPageRank = networkMetrics.some(m => m.pagerank !== undefined);
  const hasBetweenness = networkMetrics.some(m => m.betweenness !== undefined);
  const hasCloseness = networkMetrics.some(m => m.closeness !== undefined);
  const hasClustering = networkMetrics.some(m => m.clustering !== undefined);


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
            <option value="custom">Custom Community</option>
            {hasType && <option value="type">Node Type</option>}
            {hasLouvain && <option value="louvain">Louvain</option>}
            {hasLeiden && <option value="leiden">Leiden</option>}
            {hasDegree && <option value="degreeCentrality">Node Degree</option>}
            {hasEigen && <option value="eigenvector">Eigenvector Centrality</option>}
            {hasPageRank && <option value="pagerank">PageRank</option>}
            {hasBetweenness && <option value="betweenness">Betweenness Centrality</option>}
            {hasCloseness && <option value="closeness">Closeness Centrality</option>}
            {hasClustering && <option value="clustering">Clustering Coefficient</option>}
            <option value="uniform">Uniform</option>
          </select>
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
            {hasAbundance && <option value="abundance">Abundance</option>}
            {hasDegree && <option value="degree">Node Degree</option>}
            {hasEigen && <option value="eigenvector">Eigenvector Centrality</option>}
            {hasPageRank && <option value="pagerank">PageRank</option>}
            {hasBetweenness && <option value="betweenness">Betweenness Centrality</option>}
            {hasCloseness && <option value="closeness">Closeness Centrality</option>}
            {hasClustering && <option value="clustering">Clustering Coefficient</option>}
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
            <option value="weight_raw">Primary Weight</option>
            {hasSecondaryWeight && <option value="weight_secondary">Secondary Weight</option>}
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
              <option value="custom">Custom Community</option>
              {hasType && <option value="type">Node Type</option>}
              {hasLouvain && <option value="louvain">Louvain</option>}
              {hasLeiden && <option value="leiden">Leiden</option>}
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
            <option value="weight_raw">Primary Weight</option>
            {hasSecondaryWeight && <option value="weight_secondary">Secondary Weight</option>}
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
            <option value="weight_raw">Primary Weight</option>
            {hasSecondaryWeight && <option value="weight_secondary">Secondary Weight</option>}
          </select>
        </div>
        <div className="group pt-2">
          <label className={`flex items-center justify-between text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>
            <span>Base Opacity</span>
            <SyncInput 
              className={`w-14 bg-transparent border-b text-right font-mono outline-none ${isDarkMode ? 'border-[#333] focus:border-[#E4E3E0] text-[#E4E3E0]' : 'border-[#ccc] focus:border-[#141414] text-[#141414]'}`}
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
    </div>
  );
};
