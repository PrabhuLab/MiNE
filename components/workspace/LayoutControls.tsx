'use client';

import React from 'react';
import type { LayoutAlgorithm, LayoutSettings } from '@/services/layouts/types';

interface Props {
  algorithm: LayoutAlgorithm;
  setAlgorithm: (algorithm: LayoutAlgorithm) => void;
  settings: LayoutSettings;
  updateAlgorithmSettings: (values: Record<string, any>) => void;
  running: boolean;
  error: string | null;
  start: () => void;
  bipartite?: boolean;
  directed?: boolean;
}

export function LayoutControls(props: Props) {
  const current: any = props.settings[props.algorithm] || {};
  const update = (key: string, value: number) => props.updateAlgorithmSettings({ [key]: value });
  return (
    <div className="mine-scroll-container max-h-[30rem] space-y-4 pr-1">
      <label className="block text-[9px] font-bold uppercase tracking-widest">Layout Algorithm
        <select value={props.algorithm} onChange={(event) => props.setAlgorithm(event.target.value as LayoutAlgorithm)} className="mt-2 w-full border bg-transparent p-2 text-[10px] font-mono">
          <option value="d3Force">D3 Force (Local)</option>
          <option value="fruchtermanReingold">Fruchterman–Reingold</option>
          <option value="drl">DrL</option>
          <option value="kamadaKawai">Kamada–Kawai</option>
          {props.bipartite && <option value="bipartite">Bipartite</option>}
          {props.directed && <option value="sugiyama">Sugiyama</option>}
          <option value="cloudCircular">Circle</option>
        </select>
      </label>
      {['fruchtermanReingold', 'drl', 'kamadaKawai'].includes(props.algorithm) && <label className="flex items-center justify-between text-[9px] font-bold uppercase">Seed<input type="number" value={current.seed ?? 42} onChange={(event) => update('seed', Number(event.target.value))} className="w-20 border bg-transparent p-1 text-right font-mono" /></label>}
      {props.algorithm === 'fruchtermanReingold' && <label className="flex items-center justify-between text-[9px] font-bold uppercase">Iterations<input type="number" min={1} value={current.iterations ?? 500} onChange={(event) => update('iterations', Number(event.target.value))} className="w-20 border bg-transparent p-1 text-right font-mono" /></label>}
      {props.error && <div className="border border-red-500/40 bg-red-500/10 p-2 text-[9px] font-mono text-red-500">{props.error}</div>}
      <button onClick={props.start} disabled={props.running} className="w-full border py-2 text-[9px] font-bold uppercase tracking-widest disabled:opacity-40">{props.running ? 'Applying…' : 'Apply Layout'}</button>
      <p className="text-[9px] font-mono opacity-55">Cloud layouts run only when Apply Layout is pressed. D3 Force uses MiNE&apos;s familiar local force layout. Applying a layout pauses Live Physics; turning it back on resumes the shared D3 simulation with either renderer.</p>
    </div>
  );
}
