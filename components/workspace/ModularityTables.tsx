'use client';

import React, { useMemo } from 'react';
import { useStore } from '@/store/useStore';

interface ModularityTablesProps {
  rows: any[];
  graphMetrics: Record<string, any>;
  onNodeDoubleClick: (id: string, type: 'node') => void;
}

const number = (value: unknown): number => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const format = (value: unknown): string => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  return Math.abs(numeric) >= 1000 ? numeric.toLocaleString() : Number(numeric.toPrecision(8)).toString();
};

export function ModularityTables({ rows, graphMetrics, onNodeDoubleClick }: ModularityTablesProps) {
  const { isDarkMode, selectedElement, setSelectedElement } = useStore();
  const nodeRows = useMemo(() => rows
    .filter((row) => Number.isFinite(Number(row.louvainDeltaQ ?? row.deltaQ)))
    .map((row) => ({
      ...row,
      louvainDeltaQ: number(row.louvainDeltaQ ?? row.deltaQ),
      modularityContribution: Number.isFinite(Number(row.modularityContribution))
        ? number(row.modularityContribution)
        : number(row.louvainDeltaQ ?? row.deltaQ) / 2,
      withinCommunityWeight: number(row.withinCommunityWeight ?? row.k_i_in),
      nodeStrength: number(row.nodeStrength ?? row.nodeDegree),
      communityStrength: number(row.communityStrength ?? row.communityDegree),
    }))
    .sort((a, b) => b.louvainDeltaQ - a.louvainDeltaQ), [rows]);

  const communityRows = useMemo(() => {
    const groups = new Map<string, { community: string; nodes: number; internalWeight: number; communityStrength: number; modularityContribution: number; meanDeltaQ: number }>();
    nodeRows.forEach((row) => {
      const community = String(row.community ?? row.community_louvain ?? row.louvain ?? 'Unassigned');
      const current = groups.get(community) || { community, nodes: 0, internalWeight: 0, communityStrength: 0, modularityContribution: 0, meanDeltaQ: 0 };
      current.nodes += 1;
      current.internalWeight += row.withinCommunityWeight / 2;
      current.communityStrength = Math.max(current.communityStrength, row.communityStrength);
      current.modularityContribution += row.modularityContribution;
      current.meanDeltaQ += row.louvainDeltaQ;
      groups.set(community, current);
    });
    return Array.from(groups.values()).map((row) => ({ ...row, meanDeltaQ: row.nodes ? row.meanDeltaQ / row.nodes : 0 }))
      .sort((a, b) => b.modularityContribution - a.modularityContribution);
  }, [nodeRows]);

  const qualityEntry = Object.entries(graphMetrics).find(([key, value]) => (
    (key === 'louvainModularity' || key === 'community_louvain_quality' || key.endsWith('_louvain_quality'))
    && Number.isFinite(Number(value))
  ));
  const quality = qualityEntry ? Number(qualityEntry[1]) : null;
  const contributionSum = nodeRows.reduce((sum, row) => sum + row.modularityContribution, 0);

  if (!nodeRows.length) {
    return <div className="flex h-full items-center justify-center p-8 text-center font-mono text-xs opacity-55">Run Louvain to populate node ΔQ and modularity tables.</div>;
  }

  const headerClass = isDarkMode ? 'bg-[#222] border-[#444]' : 'bg-[#f0f0f0] border-[#ccc]';
  const borderClass = isDarkMode ? 'border-[#333]' : 'border-[#ddd]';
  return (
    <div className="mine-scroll-container flex h-full min-h-0 flex-col overflow-auto">
      <div className={`grid shrink-0 grid-cols-2 border-b ${borderClass}`}>
        <div className={`p-3 ${isDarkMode ? 'border-[#333]' : 'border-[#ddd]'} border-r`}>
          <div className="text-[9px] font-bold uppercase tracking-widest opacity-55">Louvain Modularity Q</div>
          <div className="mt-1 font-mono text-sm">{quality === null ? '—' : format(quality)}</div>
        </div>
        <div className="p-3">
          <div className="text-[9px] font-bold uppercase tracking-widest opacity-55">Visible Node Contribution Sum</div>
          <div className="mt-1 font-mono text-sm">{format(contributionSum)}</div>
        </div>
      </div>

      <section className="shrink-0">
        <h3 className="border-b border-black/10 px-3 py-2 text-[9px] font-bold uppercase tracking-[0.16em] opacity-65 dark:border-white/10">Community Modularity</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className={`border-b ${headerClass}`}><tr>{['Community', 'Nodes', 'Internal Weight', 'Community Strength', 'Contribution to Q', 'Mean ΔQ'].map((label) => <th key={label} className="whitespace-nowrap p-2 text-[9px] uppercase tracking-wider">{label}</th>)}</tr></thead>
            <tbody>{communityRows.map((row) => <tr key={row.community} className={`border-b ${borderClass}`}><td className="p-2 font-mono">{row.community}</td><td className="p-2 font-mono">{row.nodes}</td><td className="p-2 font-mono">{format(row.internalWeight)}</td><td className="p-2 font-mono">{format(row.communityStrength)}</td><td className="p-2 font-mono">{format(row.modularityContribution)}</td><td className="p-2 font-mono">{format(row.meanDeltaQ)}</td></tr>)}</tbody>
          </table>
        </div>
      </section>

      <section className="min-h-56 flex-1">
        <h3 className="border-y border-black/10 px-3 py-2 text-[9px] font-bold uppercase tracking-[0.16em] opacity-65 dark:border-white/10">Node Modularity</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className={`sticky top-0 border-b ${headerClass}`}><tr>{['Node', 'Label', 'Community', 'Degree', 'Node Strength', 'Within-Community Weight', 'Community Strength', 'Louvain ΔQ', 'Contribution to Q'].map((label) => <th key={label} className="whitespace-nowrap p-2 text-[9px] uppercase tracking-wider">{label}</th>)}</tr></thead>
            <tbody>{nodeRows.map((row) => {
              const id = String(row.id);
              const selected = selectedElement === id;
              return <tr key={id} onClick={() => setSelectedElement(id)} onDoubleClick={() => onNodeDoubleClick(id, 'node')} className={`cursor-pointer border-b ${borderClass} ${selected ? 'bg-[#b4ff39]/30 font-semibold' : isDarkMode ? 'hover:bg-[#333]' : 'hover:bg-[#f9f9f9]'}`}><td className="p-2 font-mono">{id}</td><td className="p-2">{row.label || row.name || '—'}</td><td className="p-2 font-mono">{row.community ?? row.community_louvain ?? row.louvain ?? '—'}</td><td className="p-2 font-mono">{format(row.degree)}</td><td className="p-2 font-mono">{format(row.nodeStrength)}</td><td className="p-2 font-mono">{format(row.withinCommunityWeight)}</td><td className="p-2 font-mono">{format(row.communityStrength)}</td><td className="p-2 font-mono">{format(row.louvainDeltaQ)}</td><td className="p-2 font-mono">{format(row.modularityContribution)}</td></tr>;
            })}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
