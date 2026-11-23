'use client';

import React from 'react';
import type { LayoutAlgorithm, LayoutSettings } from '@/services/layouts/types';

interface Props {
  algorithm: LayoutAlgorithm;
  setAlgorithm: (algorithm: LayoutAlgorithm) => void;
  settings: Partial<Record<LayoutAlgorithm, LayoutSettings>>;
  updateAlgorithmSettings: (values: LayoutSettings) => void;
  running: boolean;
  error: string | null;
  warning: string | null;
  start: () => Promise<void>;
  cancel: () => void;
  directed: boolean;
  cloudRouted: boolean;
  ready: boolean;
}

export function LayoutControls(props: Props) {
  const current = props.settings[props.algorithm] || {};
  const update = (key: 'seed' | 'iterations', value: number) => {
    if (Number.isSafeInteger(value)) props.updateAlgorithmSettings({ [key]: value });
  };
  return (
    <div className="mine-scroll-container max-h-[30rem] space-y-4 pr-1">
      <label className="block text-[9px] font-bold uppercase tracking-widest">Layout Algorithm
        <select aria-label="Layout algorithm" value={props.algorithm} disabled={props.running} onChange={(event) => props.setAlgorithm(event.target.value as LayoutAlgorithm)} className="mt-2 w-full border bg-transparent p-2 text-[10px] font-mono">
          <option value="d3Force">D3 Force (Local)</option>
          <option value="forceatlas2">ForceAtlas2 (Automatic)</option>
          {props.cloudRouted && <>
            <option value="fruchtermanReingold">Fruchterman–Reingold</option>
            <option value="drl">DrL</option>
            <option value="kamadaKawai">Kamada–Kawai</option>
            {props.directed && <option value="sugiyama">Sugiyama</option>}
          </>}
        </select>
      </label>
      {['fruchtermanReingold', 'drl', 'kamadaKawai'].includes(props.algorithm) && <label className="flex items-center justify-between text-[9px] font-bold uppercase">Seed<input type="number" value={current.seed ?? 42} onChange={(event) => update('seed', Number(event.target.value))} className="w-20 border bg-transparent p-1 text-right font-mono" /></label>}
      {props.algorithm === 'fruchtermanReingold' && <label className="flex items-center justify-between text-[9px] font-bold uppercase">Iterations<input type="number" min={1} max={10000} value={current.iterations ?? 500} onChange={(event) => update('iterations', Number(event.target.value))} className="w-20 border bg-transparent p-1 text-right font-mono" /></label>}
      {props.error && <div role="alert" className="border border-red-500/40 bg-red-500/10 p-2 text-[9px] font-mono text-red-500">{props.error}</div>}
      {props.warning && <div role="status" className="border border-amber-500/30 bg-amber-500/10 p-2 text-[9px] font-mono text-amber-600">{props.warning}</div>}
      <button onClick={props.start} disabled={props.running || !props.ready || (props.algorithm === 'fruchtermanReingold' && (current.iterations !== undefined && (current.iterations < 1 || current.iterations > 10000)))} className="w-full border py-2 text-[9px] font-bold uppercase tracking-widest disabled:opacity-40">{props.running ? 'Applying…' : 'Apply Layout'}</button>
      {props.running && <button type="button" onClick={props.cancel} className="w-full border py-2 text-[9px] font-bold uppercase tracking-widest">Cancel layout</button>}
      {props.running && props.cloudRouted && props.algorithm !== 'd3Force' && <p className="text-[9px] opacity-70">Cloud processing may continue after you cancel.</p>}
      <p className="text-[9px] font-mono opacity-55">Applying a layout pauses Live Physics.</p>
    </div>
  );
}
