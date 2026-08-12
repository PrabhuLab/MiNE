import React from 'react';
import { useStore } from '@/store/useStore';
import { SegmentedToggle } from '@/components/ui/SegmentedToggle';

export const SearchControls = () => {
  const { filters, setFilter, isDarkMode, searchQuery, setSearchQuery, rawNodes, rawEdges, setSelectedElement } = useStore();
  const findMatches = (value: string) => {
    const query = value.trim().toLowerCase();
    if (!query) return { nodes: [], edges: [] };
    return {
      nodes: rawNodes.filter((node) => (
        String(node.id).toLowerCase().includes(query)
        || String(node.label || node.name || '').toLowerCase().includes(query)
      )),
      edges: filters.searchEdges
        ? rawEdges.filter((edge) => `${edge.source}-${edge.target}`.toLowerCase().includes(query))
        : [],
    };
  };

  const updateSearchSelection = (value: string, selectFirst = false) => {
    setSearchQuery(value);
    const query = value.trim().toLowerCase();
    if (!query) {
      setSelectedElement(null);
      return;
    }

    const matches = findMatches(value);
    const exactNode = matches.nodes.find((node) => (
      String(node.id).toLowerCase() === query
      || String(node.label || node.name || '').toLowerCase() === query
    ));
    const exactEdge = matches.edges.find((edge) => `${edge.source}-${edge.target}`.toLowerCase() === query);
    const target = exactNode?.id
      || (exactEdge ? `${exactEdge.source}-${exactEdge.target}` : null)
      || (selectFirst ? matches.nodes[0]?.id || (matches.edges[0] ? `${matches.edges[0].source}-${matches.edges[0].target}` : null) : null);
    setSelectedElement(target ? String(target) : null);
  };

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
              ariaLabel="Search Edges"
          />
        </label>
      </div>
      <div className="group">
          <input 
            type="text"
            placeholder={filters.searchEdges ? "Search nodes/edges..." : "Search nodes..."}
            value={searchQuery}
            onChange={(e) => updateSearchSelection(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') updateSearchSelection(e.currentTarget.value, true);
              if (e.key === 'Escape') updateSearchSelection('');
            }}
            className={`w-full bg-transparent border p-2 text-[10px] uppercase font-bold tracking-widest outline-none transition-colors ${isDarkMode ? 'border-[#333] focus:border-[#E4E3E0] text-[#E4E3E0]' : 'border-[#141414] focus:border-black text-[#141414]'}`}
            list="search-autocomplete"
          />
          {searchQuery && searchQuery.length >= 1 && (
            <datalist id="search-autocomplete">
              {findMatches(searchQuery).nodes
                .slice(0, 15)
                .map(node => (
                <option key={`search-node-${node.id}`} value={node.id}>{node.label || node.name || node.id}</option>
              ))}
              {filters.searchEdges && findMatches(searchQuery).edges
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
