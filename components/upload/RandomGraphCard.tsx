'use client';

export interface RandomGraphOptions {
  order: number;
  size: number;
  clusters: number;
  clusterDensity: number;
}

interface Props {
  isDarkMode: boolean;
  options: RandomGraphOptions;
  generating: boolean;
  onChange: (options: RandomGraphOptions) => void;
  onGenerate: () => void;
}

export function RandomGraphCard({ isDarkMode, options, generating, onChange, onGenerate }: Props) {
  return (
    <section className={`order-3 border p-6 ${isDarkMode ? 'border-[#333] bg-[#141414]' : 'border-[#141414] bg-white'}`}>
      <h2 className="mb-2 text-xl font-black uppercase tracking-tighter">Generate a Random Graph</h2>
      <p className="mb-5 text-[10px] font-mono opacity-60">Create a simple undirected clustered fixture and initialize it through the same canonical import path.</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {([
          ['order', 'Nodes', 1, 10000, 1],
          ['size', 'Edges', 0, 49995000, 1],
          ['clusters', 'Clusters', 1, 100, 1],
          ['clusterDensity', 'Cluster Density', 0, 1, 0.05],
        ] as const).map(([key, label, min, max, step]) => (
          <label key={key} className="text-[10px] font-bold uppercase tracking-widest">
            {label}
            <input type="number" min={min} max={max} step={step} value={options[key]} onChange={(event) => onChange({ ...options, [key]: Number(event.target.value) })} className={`mt-2 w-full border px-3 py-2 font-mono ${isDarkMode ? 'border-[#333] bg-[#1a1a1a]' : 'border-[#141414] bg-white'}`} />
          </label>
        ))}
      </div>
      <button onClick={onGenerate} disabled={generating} className="mt-4 border border-current px-5 py-3 text-[10px] font-bold uppercase tracking-widest disabled:opacity-40">
        {generating ? 'Generating…' : 'Generate Random Graph'}
      </button>
    </section>
  );
}
