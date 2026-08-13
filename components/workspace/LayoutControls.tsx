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
  stop: () => void;
  inferForceAtlas2: () => void;
}

const Numeric = ({ label, value, onChange, step = 0.1 }: { label: string; value: number | undefined; onChange: (value: number) => void; step?: number }) => (
  <label className="flex items-center justify-between gap-2 text-[9px] uppercase font-bold tracking-wider">
    <span>{label}</span>
    <input type="number" value={value ?? ''} step={step} onChange={(event) => onChange(Number(event.target.value))} className="w-20 bg-transparent border px-2 py-1 font-mono text-right" />
  </label>
);

const BooleanSetting = ({ label, checked, onChange }: { label: string; checked: boolean | undefined; onChange: (value: boolean) => void }) => (
  <label className="flex items-center justify-between text-[9px] uppercase font-bold tracking-wider"><span>{label}</span><input type="checkbox" checked={Boolean(checked)} onChange={(event) => onChange(event.target.checked)} /></label>
);

export function LayoutControls(props: Props) {
  const current: any = props.settings[props.algorithm] || {};
  const update = (key: string, value: any) => props.updateAlgorithmSettings({ [key]: value });
  return (
    <div className="max-h-[30rem] overflow-y-auto pr-1 space-y-4">
      <div>
        <label className="block text-[9px] font-bold uppercase tracking-widest mb-2">Layout Algorithm</label>
        <select value={props.algorithm} onChange={(event) => props.setAlgorithm(event.target.value as LayoutAlgorithm)} className="w-full bg-transparent border p-2 text-[10px] font-mono">
          <option value="random">Random</option><option value="circular">Circular</option><option value="circlepack">Circlepack</option><option value="noverlap">Noverlap</option><option value="forceatlas2">ForceAtlas2</option>
        </select>
      </div>
      {['random', 'circular', 'circlepack'].includes(props.algorithm) && <><Numeric label="Center" value={current.center} onChange={(value) => update('center', value)} /><Numeric label="Scale" value={current.scale} onChange={(value) => update('scale', value)} step={1} /></>}
      {props.algorithm === 'noverlap' && <>
        <Numeric label="Grid Size" value={current.gridSize} onChange={(value) => update('gridSize', value)} step={1} /><Numeric label="Margin" value={current.margin} onChange={(value) => update('margin', value)} /><Numeric label="Expansion" value={current.expansion} onChange={(value) => update('expansion', value)} /><Numeric label="Ratio" value={current.ratio} onChange={(value) => update('ratio', value)} /><Numeric label="Speed" value={current.speed} onChange={(value) => update('speed', value)} />
      </>}
      {props.algorithm === 'forceatlas2' && <>
        <button onClick={props.inferForceAtlas2} className="w-full py-2 border text-[9px] uppercase font-bold tracking-widest">Infer Settings</button>
        <BooleanSetting label="Adjust Sizes" checked={current.adjustSizes} onChange={(value) => update('adjustSizes', value)} /><BooleanSetting label="Barnes-Hut" checked={current.barnesHutOptimize} onChange={(value) => update('barnesHutOptimize', value)} /><Numeric label="Barnes-Hut Theta" value={current.barnesHutTheta} onChange={(value) => update('barnesHutTheta', value)} /><Numeric label="Edge Weight Influence" value={current.edgeWeightInfluence} onChange={(value) => update('edgeWeightInfluence', value)} /><Numeric label="Gravity" value={current.gravity} onChange={(value) => update('gravity', value)} /><BooleanSetting label="LinLog Mode" checked={current.linLogMode} onChange={(value) => update('linLogMode', value)} /><BooleanSetting label="Outbound Attraction" checked={current.outboundAttractionDistribution} onChange={(value) => update('outboundAttractionDistribution', value)} /><Numeric label="Scaling Ratio" value={current.scalingRatio} onChange={(value) => update('scalingRatio', value)} /><Numeric label="Slow Down" value={current.slowDown} onChange={(value) => update('slowDown', value)} /><BooleanSetting label="Strong Gravity" checked={current.strongGravityMode} onChange={(value) => update('strongGravityMode', value)} />
      </>}
      {props.error && <div className="text-[9px] font-mono text-red-500 break-words">{props.error}</div>}
      <div className="grid grid-cols-2 gap-2">
        <button onClick={props.start} disabled={props.running} className="py-2 border text-[9px] uppercase font-bold disabled:opacity-40">Start / Apply</button>
        <button onClick={props.stop} disabled={!props.running} className="py-2 border text-[9px] uppercase font-bold disabled:opacity-40">Stop</button>
      </div>
      <p className="text-[9px] font-mono opacity-55">Continuous layouts disable Live Physics. Stop preserves the current coordinates.</p>
    </div>
  );
}
