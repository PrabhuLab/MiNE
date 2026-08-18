import React from 'react';
import { GripVertical, X } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { SyncInput } from '@/components/ui/SyncInput';
import { CustomSlider } from '@/components/ui/CustomSlider';
import { availableCustomEdgeAttributes, availableCustomNodeAttributes, detectCustomAttributeType } from '@/lib/graphIO';
import type { CustomAttributeType } from '@/store/useStore';

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
  const [draggedAttribute, setDraggedAttribute] = React.useState<string | null>(null);
  const hasLouvain = networkMetrics.some(m => m.louvain !== undefined);
  const hasDegree = networkMetrics.some(m => m.degree !== undefined || m.inDegree !== undefined || m.degreeCentrality !== undefined || m.inDegreeCentrality !== undefined) || networkMetrics.length > 0;
  const hasEigen = networkMetrics.some(m => m.eigenvector !== undefined);
  const hasPageRank = networkMetrics.some(m => m.pagerank !== undefined);
  const hasBetweenness = networkMetrics.some(m => m.betweenness !== undefined);
  const hasCloseness = networkMetrics.some(m => m.closeness !== undefined);
  const hasClustering = networkMetrics.some(m => m.clustering !== undefined);
  const detectedNodeOptions = React.useMemo(() => {
    const names = availableCustomNodeAttributes(rawNodes);
    if (rawNodes.some((node) => node.community !== undefined && node.community !== null && node.community !== '')) names.unshift('community');
    return names;
  }, [rawNodes]);
  const detectedEdgeOptions = React.useMemo(() => availableCustomEdgeAttributes(rawEdges), [rawEdges]);
  const customNodeOptions = React.useMemo(() => customAttributes.filter((attribute) => attribute.scope === 'node' && attribute.active === true).map((attribute) => attribute.name), [customAttributes]);
  const customEdgeOptions = React.useMemo(() => customAttributes.filter((attribute) => attribute.scope === 'edge' && attribute.active === true).map((attribute) => attribute.name), [customAttributes]);
  const numericCustomOptions = React.useMemo(() => customNodeOptions.filter((attribute) => {
    const values = rawNodes
      .map((node) => node[attribute])
      .filter((value) => value !== null && value !== undefined && String(value).trim() !== '');
    return values.length > 0 && values.every((value) => Number.isFinite(Number(value)));
  }), [customNodeOptions, rawNodes]);
  const numericCustomEdgeOptions = React.useMemo(() => customAttributes
    .filter((attribute) => attribute.scope === 'edge' && attribute.active === true && ['discrete', 'continuous'].includes(attribute.selectedType))
    .map((attribute) => attribute.name), [customAttributes]);
  const upsertAttribute = (scope: 'node' | 'edge', name: string, changes: Partial<(typeof customAttributes)[number]>) => {
    const existing = customAttributes.find((attribute) => attribute.scope === scope && attribute.name === name);
    const values = scope === 'node' ? rawNodes.map((node) => node[name]) : rawEdges.map((edge) => edge[name]);
    const detectedType = existing?.detectedType ?? detectCustomAttributeType(values);
    const next = existing
      ? customAttributes.map((attribute) => attribute === existing ? { ...attribute, ...changes } : attribute)
      : [...customAttributes, { name, source: name, scope, detectedType, selectedType: detectedType, active: false, shown: false, ...changes }];
    setCustomAttributes(next);
  };
  const selectCustomAttribute = (scope: 'node' | 'edge', name: string) => {
    setFilter('customAttributeScope', scope);
    setFilter(scope === 'node' ? 'customNodeAttribute' : 'customEdgeAttribute', name);
  };
  const addAttributeCard = () => {
    const candidate = customAttributes.find((attribute) => !attribute.active)
      ?? customAttributes.find((attribute) => attribute.active === undefined);
    if (!candidate) return;
    upsertAttribute(candidate.scope, candidate.name, { active: true, shown: false });
    selectCustomAttribute(candidate.scope, candidate.name);
  };
  const replaceAttributeCard = (current: (typeof customAttributes)[number], scope: 'node' | 'edge', name: string) => {
    if (!name || (scope === current.scope && name === current.name)) return;
    const replacement = customAttributes.find((attribute) => attribute.scope === scope && attribute.name === name);
    setCustomAttributes(customAttributes.map((attribute) => {
      if (attribute === current) return { ...attribute, active: false, shown: false, drivesCommunity: false };
      if (attribute === replacement) return { ...attribute, active: true, shown: current.shown, combine: current.combine };
      return attribute;
    }));
    selectCustomAttribute(scope, name);
  };
  const removeAttributeCard = (attribute: (typeof customAttributes)[number]) => {
    upsertAttribute(attribute.scope, attribute.name, { active: false, shown: false });
    if (attribute.scope === 'node' && filters.customNodeAttribute === attribute.name) setFilter('customNodeAttribute', customNodeOptions.find((name) => name !== attribute.name) || '');
    if (attribute.scope === 'edge' && filters.customEdgeAttribute === attribute.name) setFilter('customEdgeAttribute', customEdgeOptions.find((name) => name !== attribute.name) || '');
  };
  const attributeKey = (attribute: (typeof customAttributes)[number]) => `${attribute.scope}:${attribute.name}`;
  const reorderActiveAttributes = (targetKey: string) => {
    if (!draggedAttribute || draggedAttribute === targetKey) return;
    const active = customAttributes.filter((attribute) => attribute.active);
    const inactive = customAttributes.filter((attribute) => !attribute.active);
    const from = active.findIndex((attribute) => attributeKey(attribute) === draggedAttribute);
    const to = active.findIndex((attribute) => attributeKey(attribute) === targetKey);
    if (from < 0 || to < 0) return;
    const [moved] = active.splice(from, 1);
    active.splice(to, 0, moved);
    setCustomAttributes([...active, ...inactive]);
    setDraggedAttribute(null);
  };

  return (
    <div>
    <div className="flex items-center justify-between mb-4">
      <h3 className={`text-[10px] font-bold uppercase tracking-widest opacity-70 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>Visual Customization</h3>
    </div>

    <div className={`mb-5 border p-3 ${isDarkMode ? 'border-[#333]' : 'border-[#bbb]'}`}>
      <button onClick={addAttributeCard} disabled={!customAttributes.some((attribute) => !attribute.active)} className="w-full border border-dashed p-2 text-[10px] font-bold uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-40">+ Add Custom Attribute</button>
      <p className="mt-2 text-[9px] font-mono opacity-55">Added attributes stay available to customization controls when hidden.</p>
      <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
        {customAttributes.filter((attribute) => attribute.active).map((metadata) => {
          const { scope, name } = metadata;
          const shown = Boolean(metadata.shown);
          const scopeOptions = scope === 'node' ? detectedNodeOptions : detectedEdgeOptions;
          return (
            <div key={`${scope}:${name}`} onDragOver={(event) => event.preventDefault()} onDrop={() => reorderActiveAttributes(attributeKey(metadata))} className={`border p-2 ${draggedAttribute === attributeKey(metadata) ? 'opacity-50' : ''} ${isDarkMode ? 'border-[#444]' : 'border-[#ccc]'}`}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider">
                  <button draggable onDragStart={() => setDraggedAttribute(attributeKey(metadata))} onDragEnd={() => setDraggedAttribute(null)} className="cursor-grab p-0.5 active:cursor-grabbing" aria-label={`Reorder ${name}`} title="Drag to set priority"><GripVertical size={13} /></button>
                  Active
                </div>
                <button onClick={() => removeAttributeCard(metadata)} className="p-0.5 opacity-70 hover:opacity-100" aria-label={`Remove ${name}`} title="Remove"><X size={13} /></button>
              </div>
              <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-2">
                <select value={scope} onChange={(event) => {
                  const nextScope = event.target.value as 'node' | 'edge';
                  const nextName = (nextScope === 'node' ? detectedNodeOptions : detectedEdgeOptions)[0] || '';
                  replaceAttributeCard(metadata, nextScope, nextName);
                }} className="min-w-0 border bg-transparent p-1 text-[9px] font-mono"><option value="node">Node</option><option value="edge">Edge</option></select>
                <select value={name} onChange={(event) => replaceAttributeCard(metadata, scope, event.target.value)} className="min-w-0 border bg-transparent p-1 text-[9px] font-mono">
                  {scopeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
                <select value={metadata.selectedType} onChange={(event) => upsertAttribute(scope, name, { selectedType: event.target.value as CustomAttributeType })} className="min-w-0 border bg-transparent p-1 text-[9px] font-mono">
                  <option value="binary">Binary</option><option value="discrete">Discrete</option><option value="continuous">Continuous</option><option value="nominal">Categorical</option><option value="ordinal">Ordinal</option>
                </select>
                {scope === 'edge' ? (
                  <select value={metadata.edgeNodeTarget || 'none'} onChange={(event) => upsertAttribute(scope, name, { edgeNodeTarget: event.target.value as 'none' | 'source' | 'target' })} className="min-w-0 border bg-transparent p-1 text-[9px] font-mono"><option value="none">Edge only</option><option value="source">Source node</option><option value="target">Target node</option></select>
                ) : <div />}
                <button onClick={() => upsertAttribute(scope, name, { combine: metadata.combine === false })} className="border p-1 text-[9px] font-bold uppercase" title="When off, this attribute takes priority over overlapping attributes according to card order">Combine: {metadata.combine === false ? 'Off' : 'On'}</button>
                <button onClick={() => upsertAttribute(scope, name, { shown: !shown })} className="border p-1 text-[9px] font-bold uppercase">{shown ? 'Shown' : 'Hidden'}</button>
              </div>
            </div>
          );
        })}
      </div>
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
            value={filters.nodeColorBase === 'custom' && filters.customNodeAttribute ? `custom:${filters.customNodeAttribute}` : filters.nodeColorBase}
            onChange={(e) => {
              const value = e.target.value;
              if (value.startsWith('custom:')) {
                const attribute = value.slice('custom:'.length);
                selectCustomAttribute('node', attribute);
                upsertAttribute('node', attribute, { active: true, shown: true });
                setFilter('nodeColorBase', 'custom');
              } else setFilter('nodeColorBase', value);
            }}
            className={`w-full bg-transparent border p-2 text-xs font-mono outline-none transition-colors mb-2 ${isDarkMode ? 'border-[#333] focus:border-[#E4E3E0] text-[#E4E3E0] [&>option]:bg-[#1a1a1a]' : 'border-[#141414] focus:border-black text-[#141414] [&>option]:bg-white'}`}
          >
            {customNodeOptions.map((attribute) => <option key={`node-color-${attribute}`} value={`custom:${attribute}`}>Custom: {attribute}</option>)}
            {hasType && <option value="type">Node Type</option>}
            <option value="louvain">Louvain</option>
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
            value={filters.nodeSizeBase === 'custom' && filters.customNodeAttribute ? `custom:${filters.customNodeAttribute}` : filters.nodeSizeBase}
            onChange={(e) => {
              const value = e.target.value;
              if (value.startsWith('custom:')) {
                selectCustomAttribute('node', value.slice('custom:'.length));
                setFilter('nodeSizeBase', 'custom');
              } else setFilter('nodeSizeBase', value);
            }}
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
            {numericCustomOptions.map((attribute) => <option key={`node-size-${attribute}`} value={`custom:${attribute}`}>Custom: {attribute}</option>)}
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
            min="0" max="1" step="0.05"
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
          <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>Edge Color Coding</label>
          <select 
            value={filters.edgeColorBase}
            onChange={(e) => setFilter('edgeColorBase', e.target.value)}
            className={`w-full bg-transparent border p-2 text-xs font-mono outline-none transition-colors ${isDarkMode ? 'border-[#333] focus:border-[#E4E3E0] text-[#E4E3E0] [&>option]:bg-[#1a1a1a]' : 'border-[#141414] focus:border-black text-[#141414] [&>option]:bg-white'}`}
          >
            <option value="uniform">Uniform</option>
            <option value="weight_raw">Raw / Absolute Edge Weight</option>
            {hasSecondaryWeight && <option value="weight_secondary">{directed ? 'Directed / Conditional Edge Weight' : 'Secondary / Transformed Edge Weight'}</option>}
            {customEdgeOptions.map((attribute) => <option key={`edge-color-${attribute}`} value={`edge:${attribute}`}>Custom Edge: {attribute}</option>)}
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
              {customNodeOptions.map((attribute) => <option key={`edge-node-custom-${attribute}`} value={`custom:${attribute}`}>Custom: {attribute}</option>)}
              {hasType && <option value="type">Node Type</option>}
              <option value="louvain">Louvain</option>
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
