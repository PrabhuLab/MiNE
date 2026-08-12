import React, { useMemo, useState } from 'react';
import { useStore } from '@/store/useStore';
import { SyncInput } from '@/components/ui/SyncInput';
import { CustomSlider } from '@/components/ui/CustomSlider';
import { availableNumericCustomEdgeAttributes } from '@/lib/graphIO';
import { METRIC_REGISTRY, isMetricCompatible } from '@/services/metrics/registry';
import type { MetricGraphContext, MetricsSelection } from '@/services/metrics/types';

interface CalculationControlsProps {
  metricsToRun: MetricsSelection;
  setMetricsToRun: React.Dispatch<React.SetStateAction<MetricsSelection>>;
  runSelectedMetrics: (metricIds?: string[]) => void;
  metricsLoading: boolean;
  metricContext: MetricGraphContext;
  staleMetricIds: string[];
  metricWarnings: Record<string, string>;
  rawEdges: any[];
  layoutControls?: React.ReactNode;
}

export const CalculationControls = ({ metricsToRun, setMetricsToRun, runSelectedMetrics, metricsLoading, metricContext, staleMetricIds, metricWarnings, rawEdges, layoutControls }: CalculationControlsProps) => {
  const { filters, setFilter, isDarkMode, directed } = useStore();
  const [activeControlTab, setActiveControlTab] = useState<'communities' | 'metrics' | 'layout'>('communities');
  const compatible = useMemo(() => METRIC_REGISTRY.filter((metric) => isMetricCompatible(metric, metricContext)), [metricContext]);
  const customWeights = useMemo(() => availableNumericCustomEdgeAttributes(rawEdges), [rawEdges]);
  const selectedMetricCount = compatible.filter((metric) => metricsToRun[metric.id]).length;

  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-[10px] font-bold uppercase tracking-widest opacity-70 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>Calculations</h3>
        {staleMetricIds.length > 0 && <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-500 border border-amber-500/30 rounded-sm">{staleMetricIds.length} stale</span>}
      </div>
      <div className="flex border-b mb-4">
        {(['communities', 'metrics', 'layout'] as const).map((tab) => (
          <button key={tab} className={`flex-1 text-[9px] font-bold uppercase tracking-widest py-2 border-b-2 transition-colors ${activeControlTab === tab ? (isDarkMode ? 'border-[#E4E3E0] text-[#E4E3E0]' : 'border-[#141414] text-[#141414]') : 'border-transparent text-[#888]'}`} onClick={() => setActiveControlTab(tab)}>
            {tab}
          </button>
        ))}
      </div>

      {activeControlTab === 'communities' && (
        <div className="space-y-5">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input type="checkbox" checked={Boolean(metricsToRun.louvain)} onChange={(event) => setMetricsToRun((current) => ({ ...current, louvain: event.target.checked }))} className="accent-[#141414] dark:accent-[#E4E3E0] w-3 h-3" />
            <span className="text-[10px] uppercase font-mono tracking-wider">Louvain + node ΔQ</span>
          </label>
          {metricsToRun.louvain && (
            <div className={`pt-4 border-t border-dotted ${isDarkMode ? 'border-[#555]' : 'border-[#ccc]'}`}>
              <label className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest mb-2">
                <span>Louvain Resolution</span>
                <SyncInput className="w-12 bg-transparent border-b text-right font-mono outline-none" value={filters.resolution} onChange={(value: number) => setFilter('resolution', value)} step="0.1" />
              </label>
              <CustomSlider min="0.1" max="5" step="0.1" value={filters.resolution} onChange={(value: number) => setFilter('resolution', value)} isDarkMode={isDarkMode} />
            </div>
          )}
          <button onClick={() => runSelectedMetrics(['louvain'])} disabled={metricsLoading || !metricsToRun.louvain || !metricContext.hasEdges} className="w-full py-2 text-[10px] uppercase font-bold tracking-widest border disabled:opacity-40">
            {metricsLoading ? 'Computing…' : 'Run Communities'}
          </button>
        </div>
      )}

      {activeControlTab === 'metrics' && (
        <div className="max-h-[28rem] overflow-y-auto overflow-x-hidden pr-1 space-y-4">
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-widest mb-2">Metric Weight Source</label>
            <select value={filters.metricWeightAttribute} onChange={(event) => setFilter('metricWeightAttribute', event.target.value)} className={`w-full bg-transparent border p-2 text-[10px] font-mono ${isDarkMode ? 'border-[#333]' : 'border-[#141414]'}`}>
              <option value="weight_raw">Raw / Absolute</option>
              <option value="weight_secondary">{directed ? 'Directed / Conditional' : 'Secondary / Transformed'}</option>
              {customWeights.map((attribute) => <option key={attribute} value={attribute}>Custom: {attribute}</option>)}
            </select>
          </div>
          {(['graph', 'node', 'edge', 'layout'] as const).map((scope) => {
            const definitions = compatible.filter((metric) => metric.scope === scope);
            if (!definitions.length) return null;
            return (
              <div key={scope}>
                <div className="text-[9px] font-bold uppercase tracking-[0.16em] opacity-60 mb-2">{scope === 'layout' ? 'Layout quality' : `${scope} metrics`}</div>
                <div className="space-y-2">
                  {definitions.map((metric) => (
                    <label key={metric.id} className="flex items-start gap-2 cursor-pointer">
                      <input type="checkbox" checked={Boolean(metricsToRun[metric.id])} onChange={(event) => setMetricsToRun((current) => ({ ...current, [metric.id]: event.target.checked }))} className="mt-0.5 accent-[#141414] dark:accent-[#E4E3E0] w-3 h-3" />
                      <span className="min-w-0 flex-1 text-[10px] uppercase font-mono tracking-wider">
                        {metric.label}
                        <span className="ml-1 opacity-45">· {metric.cost}</span>
                        {staleMetricIds.includes(metric.id) && <span className="ml-1 text-amber-500">· stale</span>}
                        {metricWarnings[metric.id] && <span className="block normal-case text-red-500 mt-1 break-words">{metricWarnings[metric.id]}</span>}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
          <button onClick={() => runSelectedMetrics()} disabled={metricsLoading || selectedMetricCount === 0} className={`sticky bottom-0 w-full py-2 text-[10px] uppercase font-bold tracking-widest border shadow-sm disabled:opacity-40 ${isDarkMode ? 'bg-[#E4E3E0] text-[#141414] border-[#E4E3E0]' : 'bg-[#141414] text-white border-[#141414]'}`}>
            {metricsLoading ? 'Computing…' : `Calculate ${selectedMetricCount || ''} Metric${selectedMetricCount === 1 ? '' : 's'}`}
          </button>
        </div>
      )}

      {activeControlTab === 'layout' && (layoutControls || <div className="text-[10px] font-mono opacity-60">Layout controller unavailable.</div>)}
    </div>
  );
};
