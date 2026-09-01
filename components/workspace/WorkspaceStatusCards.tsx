'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useStore } from '@/store/useStore';

function StatusCard({ title, collapsed, setCollapsed, children }: { title: string; collapsed: boolean; setCollapsed: (value: boolean) => void; children: React.ReactNode }) {
  const isDarkMode = useStore((state) => state.isDarkMode);
  return (
    <section className={`w-56 border shadow-lg ${isDarkMode ? 'border-[#444] bg-[#181818]/95 text-[#E4E3E0]' : 'border-[#141414] bg-white/95 text-[#141414]'}`}>
      <button type="button" onClick={() => setCollapsed(!collapsed)} aria-expanded={!collapsed} className="flex w-full items-center justify-between px-3 py-2 text-[9px] font-bold uppercase tracking-widest">
        {title}{collapsed ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {!collapsed && <div className="border-t border-current/20 p-3 text-[10px] font-mono">{children}</div>}
    </section>
  );
}

export function WorkspaceStatusCards(props: {
  activeNodeCount: number;
  rawNodeCount: number;
  activeEdgeCount: number;
  rawEdgeCount: number;
  engine: 'browser' | 'cloud';
  renderer: 'd3' | 'sigma';
  filteredOut: string[];
  showFilteredOut: boolean;
}) {
  const [statisticsCollapsed, setStatisticsCollapsed] = useState(false);
  const [filteredCollapsed, setFilteredCollapsed] = useState(true);
  return (
    <div className="pointer-events-auto absolute bottom-4 left-4 z-40 flex flex-col gap-2">
      <StatusCard title="Network Statistics" collapsed={statisticsCollapsed} setCollapsed={setStatisticsCollapsed}>
        <div className="flex justify-between"><span>Nodes</span><span>{props.activeNodeCount} / {props.rawNodeCount}</span></div>
        <div className="mt-1 flex justify-between"><span>Edges</span><span>{props.activeEdgeCount} / {props.rawEdgeCount}</span></div>
        <div className="mt-1 flex justify-between"><span>Engine</span><span className="uppercase">{props.engine}</span></div>
        <div className="mt-1 flex justify-between"><span>Renderer</span><span className="uppercase">{props.renderer}</span></div>
      </StatusCard>
      {props.showFilteredOut && <StatusCard title="Filtered Out" collapsed={filteredCollapsed} setCollapsed={setFilteredCollapsed}>
        <div className="mine-scroll-container max-h-28 break-words">{props.filteredOut.length ? props.filteredOut.join(', ') : 'None'}</div>
      </StatusCard>}
    </div>
  );
}
