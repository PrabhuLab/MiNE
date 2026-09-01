'use client';

import React, { useMemo, useState } from 'react';
import { useStore } from '@/store/useStore';
import { availableNumericCustomEdgeAttributes } from '@/lib/graphIO';
import { METRIC_REGISTRY, isMetricCompatible } from '@/services/metrics/registry';
import type { MetricGraphContext, MetricsSelection } from '@/services/metrics/types';
import { isCloudMetricSupported, resolveComputeEngine } from '@/services/cloud/config';
import { DEFAULT_COMMUNITY_SETTINGS, type CommunitySettings } from '@/services/communities/types';
import type { CommunityAlgorithm } from '@/services/cloud/types';
import { weightChannelMetadata } from '@/services/attributes/weights';

interface CalculationControlsProps {
  metricsToRun: MetricsSelection;
  setMetricsToRun: React.Dispatch<React.SetStateAction<MetricsSelection>>;
  runSelectedMetrics: (metricIds?: string[]) => void;
  runCommunity: (settings: CommunitySettings) => void;
  metricsLoading: boolean;
  metricContext: MetricGraphContext;
  staleMetricIds: string[];
  metricWarnings: Record<string, string>;
  rawEdges: any[];
  nodeCount: number;
  edgeCount: number;
  layoutControls?: React.ReactNode;
}

const COMMUNITY_OPTIONS: Array<{ id: CommunityAlgorithm; label: string; directed: boolean; graphType?: 'unipartite' | 'bipartite' }> = [
  { id: 'louvain', label: 'Louvain', directed: false },
  { id: 'infomap', label: 'Infomap', directed: true },
  { id: 'labelPropagation', label: 'Label Propagation', directed: true },
  { id: 'walktrap', label: 'Walktrap', directed: false },
  { id: 'fastGreedy', label: 'Fast Greedy', directed: false },
  { id: 'sbm', label: 'Sparse SBM', directed: false, graphType: 'unipartite' },
  { id: 'lbm', label: 'Sparse LBM', directed: false, graphType: 'bipartite' },
];

const NumberField = ({ label, value, onChange, step = 1, min }: { label: string; value: number; onChange: (value: number) => void; step?: number; min?: number }) => (
  <label className="flex items-center justify-between gap-2 text-[9px] font-bold uppercase tracking-widest">
    <span>{label}</span>
    <input type="number" value={value} min={min} step={step} onChange={(event) => onChange(Number(event.target.value))} className="w-20 border bg-transparent p-1 text-right font-mono" />
  </label>
);

export function CalculationControls(props: CalculationControlsProps) {
  const { filters, setFilter, isDarkMode, directed, bipartite, computeEngine } = useStore();
  const [activeControlTab, setActiveControlTab] = useState<'communities' | 'metrics' | 'layout'>('communities');
  const [communitySettings, setCommunitySettings] = useState<CommunitySettings>(DEFAULT_COMMUNITY_SETTINGS);
  const compatible = useMemo(() => METRIC_REGISTRY.filter((metric) => isMetricCompatible(metric, props.metricContext)), [props.metricContext]);
  const customWeights = useMemo(() => availableNumericCustomEdgeAttributes(props.rawEdges), [props.rawEdges]);
  const weightChannels = weightChannelMetadata(props.rawEdges);
  const cloudResolved = resolveComputeEngine(props.nodeCount, props.edgeCount, computeEngine) === 'cloud';
  const selectedMetricCount = compatible.filter((metric) => props.metricsToRun[metric.id]).length;
  const tabs = props.layoutControls ? (['communities', 'metrics', 'layout'] as const) : (['communities', 'metrics'] as const);

  const communityOptions = COMMUNITY_OPTIONS.filter((option) =>
    (!directed || option.directed)
    && (!option.graphType || (option.graphType === 'bipartite') === bipartite)
    && (cloudResolved || option.id === 'louvain'),
  );
  const selectedCommunityAlgorithm = communityOptions.some((option) => option.id === communitySettings.algorithm)
    ? communitySettings.algorithm
    : (communityOptions[0]?.id || 'louvain');
  const displayedTab = activeControlTab === 'layout' && !props.layoutControls ? 'communities' : activeControlTab;
  const updateCommunity = <K extends keyof CommunitySettings>(key: K, value: CommunitySettings[K]) => setCommunitySettings((current) => ({ ...current, [key]: value }));

  return (
    <div className="min-w-0">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[10px] font-bold uppercase tracking-widest opacity-70">Calculations</h3>
        {props.staleMetricIds.length > 0 && <span className="border border-amber-500/30 bg-amber-500/20 px-2 py-0.5 text-[9px] font-bold uppercase text-amber-500">{props.staleMetricIds.length} stale</span>}
      </div>
      {props.metricWarnings.fallback && <div className="mb-3 border border-amber-500/30 bg-amber-500/10 p-2 text-[9px] font-mono text-amber-600">{props.metricWarnings.fallback}</div>}
      <div className="mb-4 flex border-b">
        {tabs.map((tab) => <button key={tab} className={`flex-1 border-b-2 py-2 text-[9px] font-bold uppercase tracking-widest ${displayedTab === tab ? (isDarkMode ? 'border-[#E4E3E0]' : 'border-[#141414]') : 'border-transparent text-[#888]'}`} onClick={() => setActiveControlTab(tab)}>{tab}</button>)}
      </div>

      {displayedTab === 'communities' && (
        <div className="space-y-4">
          {props.metricWarnings.community && <div className="border border-red-500/40 bg-red-500/10 p-2 text-[9px] font-mono text-red-500">{props.metricWarnings.community}</div>}
          <label className="block text-[9px] font-bold uppercase tracking-widest">Algorithm
            <select value={selectedCommunityAlgorithm} onChange={(event) => updateCommunity('algorithm', event.target.value as CommunityAlgorithm)} className={`mt-2 w-full border bg-transparent p-2 text-[10px] font-mono ${isDarkMode ? 'border-[#444] [&>option]:bg-[#181818]' : 'border-[#141414] [&>option]:bg-white'}`}>
              {communityOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>
          <label className="block text-[9px] font-bold uppercase tracking-widest">Community Weight
            <select value={['sbm', 'lbm'].includes(selectedCommunityAlgorithm) ? 'unweighted' : communitySettings.weightChannel} onChange={(event) => updateCommunity('weightChannel', event.target.value as CommunitySettings['weightChannel'])} className={`mt-2 w-full border bg-transparent p-2 text-[10px] font-mono ${isDarkMode ? 'border-[#444] [&>option]:bg-[#181818]' : 'border-[#141414] [&>option]:bg-white'}`}>
              <option value="unweighted">None</option>{!['sbm', 'lbm'].includes(selectedCommunityAlgorithm) && weightChannels.primary && <option value="weight_raw">Primary</option>}{!['sbm', 'lbm'].includes(selectedCommunityAlgorithm) && weightChannels.secondary && <option value="weight_secondary">Secondary</option>}
            </select>
          </label>
          {selectedCommunityAlgorithm === 'louvain' && <NumberField label="Resolution" value={communitySettings.resolution} min={0.01} step={0.1} onChange={(value) => updateCommunity('resolution', value)} />}
          {selectedCommunityAlgorithm === 'infomap' && <NumberField label="Trials" value={communitySettings.trials} min={1} onChange={(value) => updateCommunity('trials', value)} />}
          {selectedCommunityAlgorithm === 'walktrap' && <NumberField label="Walk Steps" value={communitySettings.steps} min={1} onChange={(value) => updateCommunity('steps', value)} />}
          {['sbm', 'lbm'].includes(selectedCommunityAlgorithm) && <NumberField label={selectedCommunityAlgorithm === 'lbm' ? 'Blocks per partition' : 'Blocks'} value={communitySettings.clusters} min={2} onChange={(value) => updateCommunity('clusters', Math.max(2, Math.round(value)))} />}
          <NumberField label="Seed" value={communitySettings.seed} onChange={(value) => updateCommunity('seed', value)} />
          <button onClick={() => props.runCommunity({ ...communitySettings, algorithm: selectedCommunityAlgorithm, weightChannel: ['sbm', 'lbm'].includes(selectedCommunityAlgorithm) ? 'unweighted' : communitySettings.weightChannel })} disabled={props.metricsLoading || !props.metricContext.hasEdges || !communityOptions.length} className="w-full border py-2 text-[10px] font-bold uppercase tracking-widest disabled:opacity-40">{props.metricsLoading ? 'Computing…' : 'Run Communities'}</button>
        </div>
      )}

      {displayedTab === 'metrics' && (
        <div className="mine-scroll-container max-h-[28rem] space-y-4 pr-1">
          {props.metricWarnings.cloud && <div className="border border-red-500/40 bg-red-500/10 p-2 text-[9px] font-mono text-red-500">{props.metricWarnings.cloud}</div>}
          <label className="block text-[9px] font-bold uppercase tracking-widest">Metric Weight Source
            <select value={filters.metricWeightAttribute} onChange={(event) => setFilter('metricWeightAttribute', event.target.value)} className={`mt-2 w-full border bg-transparent p-2 text-[10px] font-mono ${isDarkMode ? 'border-[#444]' : 'border-[#141414]'}`}>
              <option value="weight_raw">Weight</option>{weightChannels.secondary && <option value="weight_secondary">Secondary Weight</option>}{customWeights.map((attribute) => <option key={attribute} value={attribute}>{attribute}</option>)}
            </select>
          </label>
          {(['graph', 'node', 'edge', 'layout'] as const).map((scope) => {
            const definitions = compatible.filter((metric) => metric.scope === scope);
            if (!definitions.length) return null;
            return <div key={scope}><div className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] opacity-60">{scope === 'layout' ? 'Layout quality' : `${scope} metrics`}</div><div className="space-y-2">{definitions.map((metric) => {
              const browserOnly = cloudResolved && !isCloudMetricSupported(metric.id);
              return <label key={metric.id} className="flex items-start gap-2 text-[10px] font-mono uppercase"><input type="checkbox" checked={Boolean(props.metricsToRun[metric.id])} onChange={(event) => props.setMetricsToRun((current) => ({ ...current, [metric.id]: event.target.checked }))} /><span>{metric.label}<span className="ml-1 opacity-45">· {metric.cost}</span>{browserOnly && <span className="block normal-case text-amber-600">Browser-only; this run will use Browser</span>}{props.staleMetricIds.includes(metric.id) && <span className="ml-1 text-amber-500">· stale—calculate again</span>}{props.metricWarnings[metric.id] && <span className="block normal-case text-red-500">{props.metricWarnings[metric.id]}</span>}</span></label>;
            })}</div></div>;
          })}
          <button onClick={() => props.runSelectedMetrics()} disabled={props.metricsLoading || selectedMetricCount === 0} className={`sticky bottom-0 w-full border py-2 text-[10px] font-bold uppercase tracking-widest disabled:opacity-40 ${isDarkMode ? 'bg-[#E4E3E0] text-[#141414]' : 'bg-[#141414] text-white'}`}>{props.metricsLoading ? 'Computing…' : `Calculate ${selectedMetricCount || ''} Metric${selectedMetricCount === 1 ? '' : 's'}`}</button>
        </div>
      )}

      {displayedTab === 'layout' && props.layoutControls}
    </div>
  );
}
