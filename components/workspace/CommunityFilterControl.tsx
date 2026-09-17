'use client';

import React from 'react';
import { useStore, type RawNode } from '@/store/useStore';

export function CommunityFilterControl({ nodes, networkMetrics }: { nodes: RawNode[]; networkMetrics: Array<Record<string, any>> }) {
  const { filters, setFilter, customAttributes, isDarkMode } = useStore();
  const filter = filters.communityFilter;
  const attributes = customAttributes.filter((entry) => entry.scope === 'node' &&
    (entry.origin === 'community' || entry.name === filters.communityAttribute || ['binary', 'nominal', 'ordinal'].includes(entry.selectedType)));
  const metrics = new Map(networkMetrics.map((row) => [String(row.id), row]));
  const counts = new Map<string, number>();
  if (filter) nodes.forEach((node) => {
    const value = metrics.get(String(node.id))?.[filter.attribute] ?? node[filter.attribute];
    if (value == null || value === '') return;
    const key = String(value);
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  filter?.excludedValues.forEach((value) => { if (!counts.has(value)) counts.set(value, 0); });

  return <div>
    <label className="block text-[10px] font-bold uppercase tracking-widest">Filter Communities
      <select value={filter?.attribute || ''} onChange={(event) => setFilter('communityFilter', event.target.value ? { attribute: event.target.value, excludedValues: [] } : null)}
        className={`mt-2 w-full border bg-transparent p-2 text-xs font-mono ${isDarkMode ? 'border-[#444] [&>option]:bg-[#181818]' : 'border-[#141414] [&>option]:bg-white'}`}>
        <option value="">No community filter</option>
        {attributes.map((entry) => <option key={entry.name} value={entry.name}>{entry.label || entry.name}</option>)}
      </select>
    </label>
    {filter && <>
      <p className="my-2 text-[9px] opacity-65">Check communities to exclude from the graph and tables. Calculations stay unchanged.</p>
      <div className="max-h-40 space-y-2 overflow-y-auto">
        {Array.from(counts).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })).map(([value, count]) => <label key={value} className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={filter.excludedValues.includes(value)} onChange={(event) => setFilter('communityFilter', { ...filter, excludedValues: event.target.checked ? [...filter.excludedValues, value] : filter.excludedValues.filter((entry) => entry !== value) })} />
          <span className="min-w-0 break-words">{value}</span><span className="ml-auto shrink-0 opacity-55">{count} nodes</span>
        </label>)}
      </div>
      {filter.excludedValues.length > 0 && <button className="mt-2 text-xs underline" onClick={() => setFilter('communityFilter', { ...filter, excludedValues: [] })}>Show all communities</button>}
    </>}
  </div>;
}
