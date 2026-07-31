import React from 'react';
import { useStore } from '@/store/useStore';
import { SyncTextInput } from '@/components/ui/SyncInput';
import { CustomSlider } from '@/components/ui/CustomSlider';

interface FilterControlsProps {
  maxRelWeight: number;
  maxRawWeight: number;
  hasSecondaryWeight: boolean;
  validNodes: any[];
  rawNodes: any[];
  validEdges: any[];
  rawEdges: any[];
  removedNodesString: string;
  removedNodesCount: number;
}

export const FilterControls = ({
  maxRelWeight,
  maxRawWeight,
  hasSecondaryWeight,
  validNodes,
  rawNodes,
  validEdges,
  rawEdges,
  removedNodesString,
  removedNodesCount
}: FilterControlsProps) => {
  const { filters, setFilter, isDarkMode } = useStore();

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
        {filters.weightFilters.map((wf: any, idx: number) => (
          <div key={wf.id} className="group relative border p-3 rounded-sm border-[#e0e0e0] dark:border-[#333]">
            <button 
              onClick={() => {
                setFilter('weightFilters', filters.weightFilters.filter((f: any) => f.id !== wf.id));
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
              <option value="weight_raw">Primary Weight (Raw)</option>
              {hasSecondaryWeight && <option value="weight_secondary">Secondary Weight (Relative)</option>}
            </select>
            
            <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>Minimum Cutoff</label>
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
            <div className={`mt-2 flex justify-between text-xs font-mono opacity-50 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>
              <span>0</span>
              <span>{wf.cutoff.toFixed(wf.type === 'weight_secondary' ? 2 : 0)}</span>
              <span>{wf.type === 'weight_secondary' ? maxRelWeight : maxRawWeight}</span>
            </div>
          </div>
        ))}
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
