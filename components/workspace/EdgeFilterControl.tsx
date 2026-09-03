'use client';

import React, { useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { buildAttributeRegistry, edgeWeightDescriptors } from '@/services/attributes/registry';
import { numericExtent } from '@/lib/utils';

const rangeOf = (values: unknown[]) => {
  const finite = values.map(Number).filter(Number.isFinite);
  const extent = numericExtent(finite) || [0, 1];
  const [minimum, rawMaximum] = extent;
  const maximum = rawMaximum === minimum ? minimum + 1 : rawMaximum;
  const integral = finite.length > 0 && finite.every(Number.isInteger);
  return { minimum, maximum, step: integral ? 1 : Math.max((maximum - minimum) / 200, 0.001) };
};

export function EdgeFilterControl({ edgeMetrics = [] }: { edgeMetrics?: any[] }) {
  const { rawNodes, rawEdges, customAttributes, filters, setFilter, isDarkMode } = useStore();
  const metricByKey = useMemo(() => new Map(edgeMetrics.map((entry) => [String(entry.key), entry])), [edgeMetrics]);
  const edgeRecords = useMemo(() => rawEdges.map((edge) => ({ ...edge, ...(metricByKey.get(String(edge.key)) || {}) })), [metricByKey, rawEdges]);
  const registry = useMemo(() => buildAttributeRegistry({ nodes: rawNodes, edges: edgeRecords, metadata: customAttributes }), [customAttributes, edgeRecords, rawNodes]);
  const secondaryPresent = rawEdges.some((edge) => edge.weight_secondary !== undefined && Number.isFinite(Number(edge.weight_secondary)));
  const options = useMemo(() => [
    { value: 'weight_raw', label: 'Weight', source: 'attribute' as const },
    ...(secondaryPresent ? [{ value: 'weight_secondary', label: 'Secondary Weight', source: 'attribute' as const }] : []),
    ...edgeWeightDescriptors(registry).filter((descriptor) => descriptor.numeric).map((descriptor) => ({ value: descriptor.name, label: descriptor.label, source: descriptor.origin === 'metric' ? 'metric' as const : 'attribute' as const })),
  ].filter((option, index, values) => values.findIndex((candidate) => candidate.value === option.value) === index), [registry, secondaryPresent]);
  const selected = filters.edgeFilter;
  const selectedRange = rangeOf(edgeRecords.map((edge) => selected ? edge[selected.attribute] : Number.NaN));
  const rangeSpan = selectedRange.maximum - selectedRange.minimum;
  const minimumPercent = selected ? ((selected.min - selectedRange.minimum) / rangeSpan) * 100 : 0;
  const maximumPercent = selected ? ((selected.max - selectedRange.minimum) / rangeSpan) * 100 : 100;

  const choose = (attribute: string) => {
    if (!attribute) {
      setFilter('edgeFilter', null);
      return;
    }
    const option = options.find((candidate) => candidate.value === attribute);
    const extent = rangeOf(edgeRecords.map((edge) => edge[attribute]));
    setFilter('edgeFilter', { attribute, min: extent.minimum, max: extent.maximum, source: option?.source || 'attribute' });
  };

  const update = (minimum: number, maximum: number) => {
    if (!selected) return;
    setFilter('edgeFilter', {
      ...selected,
      min: Math.min(minimum, maximum),
      max: Math.max(minimum, maximum),
    });
  };

  return (
    <div className="space-y-2">
      <label htmlFor="edge-filter-source" className="block text-[10px] font-bold uppercase tracking-widest">Filter Edges By</label>
      <select id="edge-filter-source" value={selected?.attribute || ''} onChange={(event) => choose(event.target.value)} className={`w-full border bg-transparent p-2 text-[10px] font-mono ${isDarkMode ? 'border-[#444] [&>option]:bg-[#181818]' : 'border-[#141414] [&>option]:bg-white'}`}>
        <option value="">No edge filter</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      {selected && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[9px] uppercase font-bold">Minimum<input aria-label="Minimum edge filter value" type="number" step={selectedRange.step} value={selected.min} onChange={(event) => update(Number(event.target.value), selected.max)} className={`mt-1 w-full border bg-transparent p-1 text-xs font-mono ${isDarkMode ? 'border-[#444]' : 'border-[#141414]'}`} /></label>
            <label className="text-[9px] uppercase font-bold">Maximum<input aria-label="Maximum edge filter value" type="number" step={selectedRange.step} value={selected.max} onChange={(event) => update(selected.min, Number(event.target.value))} className={`mt-1 w-full border bg-transparent p-1 text-xs font-mono ${isDarkMode ? 'border-[#444]' : 'border-[#141414]'}`} /></label>
          </div>
          <div
            className="relative h-5"
            aria-label="Edge filter range"
            style={{ '--range-track': isDarkMode ? '#666666' : '#b8b8b8', '--range-thumb': isDarkMode ? '#b4ff39' : '#141414' } as React.CSSProperties}
          >
            <div className={`absolute left-0 top-2 h-1 w-full ${isDarkMode ? 'bg-[#666]' : 'bg-[#b8b8b8]'}`} />
            <div className={`absolute top-2 h-1 ${isDarkMode ? 'bg-[#b4ff39]' : 'bg-[#141414]'}`} style={{ left: `${minimumPercent}%`, width: `${Math.max(0, maximumPercent - minimumPercent)}%` }} />
            <input type="range" aria-label="Minimum edge filter slider" min={selectedRange.minimum} max={selectedRange.maximum} step={selectedRange.step} value={selected.min} onChange={(event) => update(Number(event.target.value), selected.max)} className="mine-range-end absolute left-0 top-2 w-full" />
            <input type="range" aria-label="Maximum edge filter slider" min={selectedRange.minimum} max={selectedRange.maximum} step={selectedRange.step} value={selected.max} onChange={(event) => update(selected.min, Number(event.target.value))} className="mine-range-end absolute left-0 top-2 w-full" />
          </div>
          <div className="flex justify-between text-[9px] font-mono opacity-60"><span>{selectedRange.minimum}</span><span>{selectedRange.maximum}</span></div>
        </div>
      )}
    </div>
  );
}
