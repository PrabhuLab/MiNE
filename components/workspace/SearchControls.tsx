import React from 'react';
import { useStore } from '@/store/useStore';
import { SegmentedToggle } from '@/components/ui/SegmentedToggle';

export const SearchControls = () => {
  const { filters, setFilter, isDarkMode, searchQuery, setSearchQuery, rawNodes, rawEdges, setSelectedElement } = useStore();

  return (
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
      <div className="group">
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
  );
};
