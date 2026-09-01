'use client';

import React, { useMemo, useState } from 'react';
import { useStore } from '@/store/useStore';
import { SyncInput } from '@/components/ui/SyncInput';
import {
  buildAttributeRegistry,
  edgeColorDescriptors,
  edgeWeightDescriptors,
  nodeColorDescriptors,
  nodeSizeDescriptors,
} from '@/services/attributes/registry';
import { hasSecondaryWeightChannel } from '@/services/attributes/weights';

export function CustomizationControls() {
  const { filters, setFilter, isDarkMode, bipartite, rawNodes, rawEdges, customAttributes } = useStore();
  const [tab, setTab] = useState<'nodes' | 'edges'>('nodes');
  const registry = useMemo(() => buildAttributeRegistry({ nodes: rawNodes, edges: rawEdges, metadata: customAttributes }), [customAttributes, rawEdges, rawNodes]);
  const nodeColors = nodeColorDescriptors(registry);
  const nodeSizes = nodeSizeDescriptors(registry);
  const edgeColors = edgeColorDescriptors(registry);
  const edgeWeights = edgeWeightDescriptors(registry);
  const secondaryPresent = hasSecondaryWeightChannel(rawEdges);
  const inputClass = `w-16 border-b bg-transparent text-right font-mono outline-none ${isDarkMode ? 'border-[#555]' : 'border-[#aaa]'}`;
  const selectClass = `w-full border bg-transparent p-2 text-xs font-mono ${isDarkMode ? 'border-[#444] [&>option]:bg-[#181818]' : 'border-[#141414] [&>option]:bg-white'}`;

  const nodeColorValue = filters.nodeColorBase === 'custom' && filters.customNodeAttribute ? `attribute:${filters.customNodeAttribute}` : filters.nodeColorBase;
  const nodeSizeValue = filters.nodeSizeBase === 'custom' && filters.customNodeSizeAttribute ? `attribute:${filters.customNodeSizeAttribute}` : filters.nodeSizeBase;
  const edgeColorValue = filters.edgeColorBase === 'nodeMetric' && filters.edgeColorNodeMetric.startsWith('custom:')
    ? `node:${filters.edgeColorNodeMetric.slice('custom:'.length)}`
    : filters.edgeColorBase;

  return (
    <section>
      <h3 className="mb-4 text-[10px] font-bold uppercase tracking-widest opacity-70">Visual Customization</h3>
      <div className="mb-5 flex border-b">
        {(['nodes', 'edges'] as const).map((value) => <button key={value} onClick={() => setTab(value)} className={`flex-1 border-b-2 py-2 text-[9px] font-bold uppercase tracking-widest ${tab === value ? (isDarkMode ? 'border-[#E4E3E0]' : 'border-[#141414]') : 'border-transparent opacity-50'}`}>{value}</button>)}
      </div>

      {tab === 'nodes' && <div className="space-y-5">
        <label className="block text-[10px] font-bold uppercase tracking-widest">Node Color By
          <select value={nodeColorValue} onChange={(event) => {
            const value = event.target.value;
            if (value.startsWith('attribute:')) {
              setFilter('customNodeAttribute', value.slice('attribute:'.length));
              setFilter('nodeColorBase', 'custom');
            } else setFilter('nodeColorBase', value);
          }} className={`mt-2 ${selectClass}`}>
            <option value="uniform">Theme Default</option>
            {bipartite && <option value="partition">Node Type 1 / Node Type 2</option>}
            {nodeColors.map((descriptor) => <option key={descriptor.name} value={`attribute:${descriptor.name}`}>{descriptor.label}</option>)}
          </select>
        </label>

        <label className="block text-[10px] font-bold uppercase tracking-widest">Node Size By
          <select value={nodeSizeValue} onChange={(event) => {
            const value = event.target.value;
            if (value.startsWith('attribute:')) {
              setFilter('customNodeSizeAttribute', value.slice('attribute:'.length));
              setFilter('nodeSizeBase', 'custom');
            } else setFilter('nodeSizeBase', value);
          }} className={`mt-2 ${selectClass}`}>
            <option value="degree">Degree</option>
            {nodeSizes.map((descriptor) => <option key={descriptor.name} value={`attribute:${descriptor.name}`}>{descriptor.label}</option>)}
          </select>
        </label>

        <label className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest"><span>Node Size</span><SyncInput live={filters.liveUpdate} value={filters.nodeSize} onChange={(value: number) => setFilter('nodeSize', value)} step="0.5" className={inputClass} /></label>
        {bipartite && <label className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest"><span>Node Type 2 Size</span><SyncInput live={filters.liveUpdate} value={filters.bipartiteNodeSize} onChange={(value: number) => setFilter('bipartiteNodeSize', value)} step="0.5" className={inputClass} /></label>}
        <label className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest"><span>Node Opacity</span><SyncInput live={filters.liveUpdate} value={filters.nodeOpacity} onChange={(value: number) => setFilter('nodeOpacity', Math.max(0, Math.min(1, value)))} step="0.05" className={inputClass} /></label>
        <label className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest"><span>Node Repulsion</span><SyncInput live={filters.liveUpdate} value={filters.forceStrength} onChange={(value: number) => setFilter('forceStrength', value)} step="10" className={inputClass} /></label>
      </div>}

      {tab === 'edges' && <div className="space-y-5">
        <label className="block text-[10px] font-bold uppercase tracking-widest">Edge Color By
          <select value={edgeColorValue} onChange={(event) => {
            const value = event.target.value;
            if (value.startsWith('node:')) {
              setFilter('edgeColorBase', 'nodeMetric');
              setFilter('edgeColorNodeMetric', `custom:${value.slice('node:'.length)}`);
            } else setFilter('edgeColorBase', value);
          }} className={`mt-2 ${selectClass}`}>
            <option value="uniform">Theme Default</option>
            <option value="weight_raw">Weight</option>
            {secondaryPresent && <option value="weight_secondary">Secondary Weight</option>}
            {edgeColors.map((descriptor) => <option key={`edge-${descriptor.name}`} value={`edge:${descriptor.name}`}>{descriptor.label}</option>)}
            {nodeColors.map((descriptor) => <option key={`node-${descriptor.name}`} value={`node:${descriptor.name}`}>{descriptor.label} (Node)</option>)}
          </select>
        </label>
        {filters.edgeColorBase === 'nodeMetric' && <div className="grid grid-cols-2 border text-[9px] font-bold uppercase"><button onClick={() => setFilter('edgeColorNodeTarget', 'source')} className={`p-2 ${filters.edgeColorNodeTarget === 'source' ? 'bg-current/10' : 'opacity-50'}`}>Source Node</button><button onClick={() => setFilter('edgeColorNodeTarget', 'target')} className={`border-l p-2 ${filters.edgeColorNodeTarget === 'target' ? 'bg-current/10' : 'opacity-50'}`}>Target Node</button></div>}

        <label className="block text-[10px] font-bold uppercase tracking-widest">Edge Weight By
          <select value={filters.edgeWeightBase} onChange={(event) => setFilter('edgeWeightBase', event.target.value)} className={`mt-2 ${selectClass}`}>
            <option value="weight_raw">Weight</option>
            {secondaryPresent && <option value="weight_secondary">Secondary Weight</option>}
            {edgeWeights.map((descriptor) => <option key={descriptor.name} value={`edge:${descriptor.name}`}>{descriptor.label}</option>)}
          </select>
        </label>
        <label className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest"><span>Thickness Multiplier</span><SyncInput live={filters.liveUpdate} value={filters.edgeWeight} onChange={(value: number) => setFilter('edgeWeight', value)} step="0.5" className={inputClass} /></label>
        <label className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest"><span>Edge Opacity</span><SyncInput live={filters.liveUpdate} value={filters.edgeOpacity} onChange={(value: number) => setFilter('edgeOpacity', Math.max(0, Math.min(1, value)))} step="0.05" className={inputClass} /></label>
      </div>}
    </section>
  );
}
