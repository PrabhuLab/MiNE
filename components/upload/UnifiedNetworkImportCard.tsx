'use client';

import type { ChangeEvent } from 'react';

interface Props {
  isDarkMode: boolean;
  files: File[];
  importing: boolean;
  onFilesChange: (files: File[]) => void;
  onImport: () => void;
}

export function UnifiedNetworkImportCard({ isDarkMode, files, importing, onFilesChange, onImport }: Props) {
  return (
    <section className={`order-2 border p-6 ${isDarkMode ? 'border-[#333] bg-[#141414]' : 'border-[#141414] bg-white'}`}>
      <h2 className="mb-2 text-xl font-black uppercase tracking-tighter">Upload a Network</h2>
      <p className="mb-5 text-[10px] font-mono opacity-60">JSON / ALL-IN-ONE JSON / GRAPHML / GEXF / NODE + EDGE CSV / CSV ZIP</p>
      <label className={`flex min-h-28 cursor-pointer items-center justify-center border border-dashed ${isDarkMode ? 'border-[#E4E3E0]/50' : 'border-[#141414]'}`}>
        <div className="text-center">
          <div className="text-[10px] font-bold uppercase tracking-widest">Select network file(s)</div>
          <div className="mt-2 text-[10px] font-mono opacity-60">{files.map((file) => file.name).join(', ') || 'Choose one network file, or nodes.csv + edges.csv'}</div>
        </div>
        <input type="file" multiple accept=".json,.graphml,.xml,.gexf,.zip,.csv" className="hidden" onChange={(event: ChangeEvent<HTMLInputElement>) => onFilesChange(Array.from(event.target.files || []))} />
      </label>
      <button disabled={!files.length || importing} onClick={onImport} className={`mt-4 w-full border px-4 py-3 text-[10px] font-bold uppercase tracking-widest disabled:opacity-40 ${isDarkMode ? 'border-[#E4E3E0] text-[#E4E3E0]' : 'border-[#141414] bg-[#141414] text-white'}`}>
        {importing ? 'Loading…' : 'Import Network'}
      </button>
    </section>
  );
}
