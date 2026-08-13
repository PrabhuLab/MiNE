import React from 'react';
import { BaseStepProps, TopologyType } from '../types';

interface StepTopologyProps extends BaseStepProps {
  topology: TopologyType | null;
  setTopology: (topology: TopologyType) => void;
}

export const StepTopology: React.FC<StepTopologyProps> = ({
  isDarkMode,
  topology,
  setTopology,
  onNext,
}) => {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="font-mono text-[10px] font-bold bg-[#141414] text-white px-2 py-0.5">STEP 01</div>
        <h3 className="text-sm font-bold uppercase tracking-widest">Select Network Topology</h3>
      </div>
      <div className="ml-14 grid grid-cols-2 gap-4">
        {(['Unipartite', 'Bipartite'] as TopologyType[]).map((cat) => (
          <label
            key={cat}
            className={`cursor-pointer min-h-[100px] border p-4 flex flex-col items-start justify-center gap-2 transition-all ${
              topology === cat
                ? isDarkMode
                  ? 'border-[#E4E3E0] bg-[#E4E3E0] text-[#141414] shadow-[inset_2px_2px_0_0_rgba(0,0,0,0.2)]'
                  : 'border-[#141414] bg-[#141414] text-[#E4E3E0] shadow-[inset_2px_2px_0_0_rgba(255,255,255,0.2)]'
                : isDarkMode
                ? 'border-[#333] bg-[#141414] text-[#E4E3E0] hover:bg-white/5'
                : 'border-[#141414] bg-white text-[#141414] hover:bg-black/5'
            }`}
          >
            <input
              type="radio"
              value={cat}
              className="hidden"
              checked={topology === cat}
              onChange={() => setTopology(cat)}
            />
            <span className="font-bold uppercase tracking-widest text-xs">
              {cat} ({cat === 'Unipartite' ? '1-Mode' : '2-Mode'})
            </span>
          </label>
        ))}
        <div className="col-span-2 mt-6 flex justify-end">
          <button
            onClick={onNext}
            disabled={!topology}
            className={`px-6 py-3 text-[10px] font-bold uppercase tracking-widest hover:invert transition-all border ${
              isDarkMode ? 'bg-[#E4E3E0] text-[#141414] border-[#E4E3E0]' : 'bg-[#141414] text-[#E4E3E0] border-[#141414]'
            } disabled:opacity-40 disabled:hover:invert-0`}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};
