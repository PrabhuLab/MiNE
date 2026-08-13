import React from 'react';
import { useStore } from '@/store/useStore';
import { SyncTextInput } from '@/components/ui/SyncInput';
import { CustomSlider } from '@/components/ui/CustomSlider';
import { availableNumericCustomEdgeAttributes, detectCustomAttributeType } from '@/lib/graphIO';
import { numericExtent } from '@/lib/utils';

interface FilterControlsProps {
  hasSecondaryWeight: boolean;
  validNodes: any[];
  rawNodes: any[];
  validEdges: any[];
  rawEdges: any[];
  removedNodesString: string;
  removedNodesCount: number;
}

export const FilterControls = ({
  hasSecondaryWeight,
  validNodes,
  rawNodes,
  validEdges,
  rawEdges,
  removedNodesString,
  removedNodesCount
}: FilterControlsProps) => {
  const { filters, setFilter, isDarkMode, directed, customAttributes } = useStore();
  const selectedCustomMetadata = customAttributes.find((attribute) => (
    attribute.scope === 'node' && attribute.name === filters.customNodeAttribute
  ));
  const customNodeType = selectedCustomMetadata?.selectedType
    || (filters.customNodeAttribute
      ? detectCustomAttributeType(rawNodes.map((node) => node[filters.customNodeAttribute]))
      : null);
  const numericCustomNode = Boolean(
    filters.customNodeAttribute && customNodeType && ['discrete', 'continuous'].includes(customNodeType),
  );
  const customEdgeAttributes = React.useMemo(
    () => availableNumericCustomEdgeAttributes(rawEdges),
    [rawEdges],
  );
  const degreeValues = React.useMemo(() => {
    const values = new Map<string, { degree: number; inDegree: number; outDegree: number }>();
    rawNodes.forEach((node) => values.set(String(node.id), { degree: 0, inDegree: 0, outDegree: 0 }));
    rawEdges.forEach((edge) => {
      const source = values.get(String(edge.source)) || { degree: 0, inDegree: 0, outDegree: 0 };
      const target = values.get(String(edge.target)) || { degree: 0, inDegree: 0, outDegree: 0 };
      source.degree += 1;
      source.outDegree += 1;
      target.degree += 1;
      target.inDegree += 1;
      values.set(String(edge.source), source);
      values.set(String(edge.target), target);
    });
    return values;
  }, [rawEdges, rawNodes]);
  const sourceOptions = React.useMemo(() => [
    { value: 'weight_raw', label: 'Raw / Absolute Edge Weight' },
    ...(hasSecondaryWeight ? [{
      value: 'weight_secondary',
      label: directed ? 'Directed / Conditional Edge Weight' : 'Secondary / Transformed Edge Weight',
    }] : []),
    ...customEdgeAttributes.map((attribute) => ({ value: `edge:${attribute}`, label: `Custom Edge: ${attribute}` })),
    ...(numericCustomNode ? [{ value: 'node:custom', label: `Custom Node: ${filters.customNodeAttribute}` }] : []),
    { value: 'node:abundance', label: 'Node Abundance' },
    ...(!directed ? [{ value: 'node:degree', label: 'Node Degree' }] : [
      { value: 'node:inDegree', label: 'Node In-Degree' },
      { value: 'node:outDegree', label: 'Node Out-Degree' },
      { value: 'node:degree', label: 'Node Total Degree' },
    ]),
  ], [customEdgeAttributes, directed, filters.customNodeAttribute, hasSecondaryWeight, numericCustomNode]);
  const sourceValues = (type: string): number[] => {
    if (type === 'weight_raw') return rawEdges.map((edge) => Number(edge.weight_raw)).filter(Number.isFinite);
    if (type === 'weight_secondary') return rawEdges.map((edge) => Number(edge.weight_secondary)).filter(Number.isFinite);
    if (type.startsWith('edge:')) {
      const attribute = type.slice('edge:'.length);
      return rawEdges.map((edge) => Number(edge[attribute])).filter(Number.isFinite);
    }
    if (type === 'node:custom') {
      return rawNodes.map((node) => Number(node[filters.customNodeAttribute])).filter(Number.isFinite);
    }
    if (type === 'node:abundance') return rawNodes.map((node) => Number(node.abundance)).filter(Number.isFinite);
    if (type.startsWith('node:')) {
      const metric = type.slice('node:'.length) as 'degree' | 'inDegree' | 'outDegree';
      return Array.from(degreeValues.values()).map((value) => value[metric]).filter(Number.isFinite);
    }
    return [];
  };
  const sourceRange = (type: string) => {
    const values = sourceValues(type);
    if (!values.length) return { min: 0, max: 1, step: 1 };
    const [minValue, maxValue] = numericExtent(values) || [0, 1];
    const min = Math.min(0, minValue);
    const max = maxValue === min ? min + 1 : maxValue;
    const integers = values.every(Number.isInteger);
    const step = integers ? 1 : max - min <= 1 ? 0.01 : 0.1;
    return { min, max, step };
  };

  return (
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
        {filters.weightFilters.map((wf: any, idx: number) => {
          const range = sourceRange(wf.type);
          return (
          <div key={wf.id} className="group relative border p-3 rounded-sm border-[#e0e0e0] dark:border-[#333]">
            <button 
              onClick={() => {
                setFilter('weightFilters', filters.weightFilters.filter((f: any) => f.id !== wf.id));
              }}
              className={`absolute top-2 right-2 text-xs opacity-50 hover:opacity-100 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}
            >
              ×
            </button>
            <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>Filter Source</label>
            <select 
              value={wf.type}
              onChange={(e) => {
                const newFilters = [...filters.weightFilters];
                const nextRange = sourceRange(e.target.value);
                newFilters[idx] = { ...wf, type: e.target.value, cutoff: nextRange.min };
                setFilter('weightFilters', newFilters);
              }}
              className={`w-full bg-transparent border p-2 text-xs font-mono outline-none transition-colors mb-4 ${isDarkMode ? 'border-[#333] focus:border-[#E4E3E0] text-[#E4E3E0] [&>option]:bg-[#1a1a1a]' : 'border-[#141414] focus:border-black text-[#141414] [&>option]:bg-white'}`}
            >
              {sourceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            
            <div className="mb-2 flex items-center justify-between gap-3">
              <label className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>Minimum Cutoff</label>
              <input
                type="number"
                aria-label={`Minimum Cutoff ${idx + 1}`}
                min={range.min}
                max={range.max}
                step={range.step}
                value={wf.cutoff}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (!Number.isFinite(value)) return;
                  const newFilters = [...filters.weightFilters];
                  newFilters[idx] = { ...wf, cutoff: Math.min(range.max, Math.max(range.min, value)) };
                  setFilter('weightFilters', newFilters);
                }}
                className={`w-16 border bg-transparent px-1 py-0.5 text-right text-xs font-mono outline-none ${isDarkMode ? 'border-[#333] text-[#E4E3E0]' : 'border-[#141414] text-[#141414]'}`}
              />
            </div>
            <CustomSlider 
              min={range.min} max={range.max} step={range.step}
              value={wf.cutoff}
              onChange={(v: number) => {
                const newFilters = [...filters.weightFilters];
                newFilters[idx] = { ...wf, cutoff: v };
                setFilter('weightFilters', newFilters);
              }}
              isDarkMode={isDarkMode}
            />
            <div className={`mt-2 flex justify-between text-xs font-mono opacity-50 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>
              <span>{range.min.toFixed(range.step < 1 ? 2 : 0)}</span>
              <span>{wf.cutoff.toFixed(range.step < 1 ? 2 : 0)}</span>
              <span>{range.max.toFixed(range.step < 1 ? 2 : 0)}</span>
            </div>
          </div>
        );})}
      </div>
      
      

      <div className="mt-16">
        <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>Manual Node Removal</label>
        <SyncTextInput 
          value={filters.removedNodes}
          onChange={(v: string) => setFilter('removedNodes', v)}
          placeholder="e.g. NodeA, NodeB"
          className={`w-full bg-transparent border p-2 text-xs font-mono outline-none transition-colors ${isDarkMode ? 'border-[#333] focus:border-[#E4E3E0] text-[#E4E3E0]' : 'border-[#141414] focus:border-black text-[#141414]'}`}
          list="removed-nodes-autocomplete"
          options={rawNodes.map(n => ({ value: n.id, label: n.label || n.name || n.id }))}
          live={filters.liveUpdate}
        />
        <div className={`mt-3 mb-10 text-[10px] uppercase font-bold tracking-widest opacity-50 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>
          Comma-separated IDs
        </div>
      </div>
      
      

      <div className={`mt-8 border p-4 rounded-sm ${isDarkMode ? 'border-[#333] bg-[#1a1a1a]' : 'border-[#ccc] bg-[#f5f5f5]'}`}>
        <h3 className={`text-[10px] font-bold uppercase tracking-widest mb-4 opacity-70 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>Network Statistics</h3>
        <div className="flex justify-between text-[11px] mb-2">
          <span>Active Nodes</span>
          <span className="font-mono">{validNodes.length} / {rawNodes.length}</span>
        </div>
        <div className="flex justify-between text-[11px] mb-1">
          <span>Active Edges</span>
          <span className="font-mono">{validEdges.length} / {rawEdges.length}</span>
        </div>
      </div>
        
      <div style={{ marginTop: '32px', padding: '16px', backgroundColor: isDarkMode ? '#1a1a1a' : '#f5f5f5', borderRadius: '4px' }}>
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
  );
};
