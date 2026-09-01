'use client';

import React from 'react';
import { useStore } from '@/store/useStore';
import { SyncTextInput } from '@/components/ui/SyncInput';

export function FilterControls({ rawNodes }: { rawNodes: any[] }) {
  const { filters, setFilter, isDarkMode } = useStore();
  return (
    <div>
      <h3 className="mb-3 text-[10px] font-bold uppercase tracking-widest opacity-70">Manual Node Removal</h3>
      <SyncTextInput
        value={filters.removedNodes}
        onChange={(value: string) => setFilter('removedNodes', value)}
        placeholder="e.g. NodeA, NodeB"
        className={`w-full border bg-transparent p-2 text-xs font-mono outline-none ${isDarkMode ? 'border-[#444] text-[#E4E3E0]' : 'border-[#141414] text-[#141414]'}`}
        list="removed-nodes-autocomplete"
        options={rawNodes.map((node) => ({ value: node.id, label: node.label || node.name || node.id }))}
        live={filters.liveUpdate}
      />
      <p className="mt-2 text-[9px] font-mono opacity-55">Comma-separated stable node IDs.</p>
    </div>
  );
}
