'use client';

import React, { useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { buildAttributeRegistry } from '@/services/attributes/registry';
import { numericExtent } from '@/lib/utils';

interface NodeMetricFilterControlProps {
  nodes: any[];
  networkMetrics: any[];
}

const labelFallback = (key: string) => key
  .replace(/_/g, ' ')
  .replace(/([a-z])([A-Z])/g, '$1 $2')
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const LABELS: Record<string, string> = {
  degree: 'Degree',
  inDegree: 'In Degree',
  outDegree: 'Out Degree',
  louvainDeltaQ: 'Louvain ΔQ',
  modularityContribution: 'Modularity Contribution',
  withinCommunityWeight: 'Within-Community Weight',
  nodeStrength: 'Node Strength',
  communityStrength: 'Community Strength',
};

const rangeOf = (values: unknown[]) => {
  const finite = values.map(Number).filter(Number.isFinite);
  const extent = numericExtent(finite) || [0, 1];
  const [minimum, rawMaximum] = extent;
  const maximum = rawMaximum === minimum ? minimum + 1 : rawMaximum;
  const integral = finite.length > 0 && finite.every(Number.isInteger);
  return { minimum, maximum, step: integral ? 1 : Math.max((maximum - minimum) / 200, 0.000001) };
};

export function NodeMetricFilterControl({ nodes, networkMetrics }: NodeMetricFilterControlProps) {
  const { customAttributes, filters, setFilter, isDarkMode } = useStore();
  const metricsByNode = useMemo(() => new Map(networkMetrics.map((entry) => [String(entry.id), entry])), [networkMetrics]);
  const records = useMemo(() => nodes.map((node) => ({ ...node, ...(metricsByNode.get(String(node.id)) || {}) })), [metricsByNode, nodes]);
  const registry = useMemo(() => buildAttributeRegistry({ nodes: records, edges: [], metadata: customAttributes }), [customAttributes, records]);

  const options = useMemo(() => {
    const labels = new Map<string, string>();
    ['degree', 'inDegree', 'outDegree'].forEach((attribute) => {
      if (records.some((record) => Number.isFinite(Number(record[attribute])))) labels.set(attribute, LABELS[attribute]);
    });
    registry.filter((descriptor) => descriptor.scope === 'node' && descriptor.numeric).forEach((descriptor) => {
      if (records.some((record) => Number.isFinite(Number(record[descriptor.name])))) labels.set(descriptor.name, descriptor.label);
    });
    const metricAttributes = new Set(networkMetrics.flatMap((entry) => Object.keys(entry || {})));
    metricAttributes.forEach((attribute) => {
      if (attribute === 'id' || ['deltaQ', 'k_i_in', 'nodeDegree', 'communityDegree'].includes(attribute)) return;
      if (records.some((record) => Number.isFinite(Number(record[attribute])))) labels.set(attribute, LABELS[attribute] || labelFallback(attribute));
    });
    // Legacy all-in-one files may only contain the original deltaQ column.
    if (!labels.has('louvainDeltaQ') && records.some((record) => Number.isFinite(Number(record.deltaQ)))) labels.set('deltaQ', 'Louvain ΔQ (Legacy)');
    return Array.from(labels, ([value, label]) => ({ value, label })).sort((a, b) => {
      if (a.value === 'degree') return -1;
      if (b.value === 'degree') return 1;
      return a.label.localeCompare(b.label);
    });
  }, [networkMetrics, records, registry]);

  const selected = filters.nodeFilter;
  const selectedValues = records.map((record) => selected ? record[selected.attribute] : Number.NaN);
  const selectedRange = rangeOf(selectedValues);
  const rangeSpan = selectedRange.maximum - selectedRange.minimum;
  const minimumPercent = selected ? Math.max(0, Math.min(100, ((selected.min - selectedRange.minimum) / rangeSpan) * 100)) : 0;
  const maximumPercent = selected ? Math.max(0, Math.min(100, ((selected.max - selectedRange.minimum) / rangeSpan) * 100)) : 100;

  const choose = (attribute: string) => {
    if (!attribute) {
      setFilter('nodeFilter', null);
      return;
    }
    const extent = rangeOf(records.map((record) => record[attribute]));
    setFilter('nodeFilter', { attribute, min: extent.minimum, max: extent.maximum });
  };

  const update = (minimum: number, maximum: number) => {
    if (!selected) return;
    setFilter('nodeFilter', { ...selected, min: Math.min(minimum, maximum), max: Math.max(minimum, maximum) });
  };

  return (
    <div className="space-y-2">
      <label htmlFor="node-metric-filter-source" className="block text-[10px] font-bold uppercase tracking-widest">Filter Nodes By</label>
      <select id="node-metric-filter-source" value={selected?.attribute || ''} onChange={(event) => choose(event.target.value)} className={`w-full border bg-transparent p-2 text-[10px] font-mono ${isDarkMode ? 'border-[#444] [&>option]:bg-[#181818]' : 'border-[#141414] [&>option]:bg-white'}`}>
        <option value="">No node filter</option>
        {selected && !options.some((option) => option.value === selected.attribute) && <option value={selected.attribute}>{LABELS[selected.attribute] || labelFallback(selected.attribute)}</option>}
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      {selected && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[9px] uppercase font-bold">Minimum<input aria-label="Minimum node metric filter value" type="number" step={selectedRange.step} value={selected.min} onChange={(event) => update(Number(event.target.value), selected.max)} className={`mt-1 w-full border bg-transparent p-1 text-xs font-mono ${isDarkMode ? 'border-[#444]' : 'border-[#141414]'}`} /></label>
            <label className="text-[9px] uppercase font-bold">Maximum<input aria-label="Maximum node metric filter value" type="number" step={selectedRange.step} value={selected.max} onChange={(event) => update(selected.min, Number(event.target.value))} className={`mt-1 w-full border bg-transparent p-1 text-xs font-mono ${isDarkMode ? 'border-[#444]' : 'border-[#141414]'}`} /></label>
          </div>
          <div className="relative h-5" aria-label="Node metric filter range" style={{ '--range-track': isDarkMode ? '#666666' : '#b8b8b8', '--range-thumb': isDarkMode ? '#b4ff39' : '#141414' } as React.CSSProperties}>
            <div className={`absolute left-0 top-2 h-1 w-full ${isDarkMode ? 'bg-[#666]' : 'bg-[#b8b8b8]'}`} />
            <div className={`absolute top-2 h-1 ${isDarkMode ? 'bg-[#b4ff39]' : 'bg-[#141414]'}`} style={{ left: `${minimumPercent}%`, width: `${Math.max(0, maximumPercent - minimumPercent)}%` }} />
            <input type="range" aria-label="Minimum node metric filter slider" min={selectedRange.minimum} max={selectedRange.maximum} step={selectedRange.step} value={selected.min} onChange={(event) => update(Number(event.target.value), selected.max)} className="mine-range-end absolute left-0 top-2 w-full" />
            <input type="range" aria-label="Maximum node metric filter slider" min={selectedRange.minimum} max={selectedRange.maximum} step={selectedRange.step} value={selected.max} onChange={(event) => update(selected.min, Number(event.target.value))} className="mine-range-end absolute left-0 top-2 w-full" />
          </div>
          <div className="flex justify-between text-[9px] font-mono opacity-60"><span>{selectedRange.minimum}</span><span>{selectedRange.maximum}</span></div>
          <p className="text-[9px] font-mono opacity-55">Filters the graph and tables while preserving the metric&apos;s calculation basis.</p>
        </div>
      )}
    </div>
  );
}
