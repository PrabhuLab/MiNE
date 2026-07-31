import React from 'react';
import { BaseStepProps } from '../types';

interface StepWeightsProps extends BaseStepProps {
  isWeighted: boolean;
  setIsWeighted: (isWeighted: boolean) => void;
}

export const StepWeights: React.FC<StepWeightsProps> = ({
  isDarkMode,
  isWeighted,
  setIsWeighted,
  onNext,
  onBack,
}) => {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="font-mono text-[10px] font-bold bg-[#141414] text-white px-2 py-0.5">STEP 02</div>
        <h3 className="text-sm font-bold uppercase tracking-widest">Does the network have weights?</h3>
      </div>
      <div className="ml-14 grid grid-cols-2 gap-4">
        <label
          className={`cursor-pointer min-h-[100px] border p-4 flex flex-col items-start justify-center gap-2 transition-all ${
            isWeighted === true
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
            className="hidden"
            checked={isWeighted === true}
            onChange={() => setIsWeighted(true)}
          />
          <span className="font-bold uppercase tracking-widest text-xs">Weighted</span>
        </label>
        <label
          className={`cursor-pointer min-h-[100px] border p-4 flex flex-col items-start justify-center gap-2 transition-all ${
            isWeighted === false
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
            className="hidden"
            checked={isWeighted === false}
            onChange={() => setIsWeighted(false)}
          />
          <span className="font-bold uppercase tracking-widest text-xs">Unweighted</span>
        </label>
        <div className="col-span-2 mt-6 flex justify-between">
          <button
            onClick={onBack}
            className={`border border-transparent text-[10px] font-bold px-6 py-3 uppercase tracking-widest transition-all ${
              isDarkMode ? 'text-[#E4E3E0] hover:border-[#E4E3E0]' : 'text-[#141414] hover:border-[#141414]'
            }`}
          >
            Back
          </button>
          <button
            onClick={onNext}
            className={`px-6 py-3 text-[10px] font-bold uppercase tracking-widest hover:invert transition-all border ${
              isDarkMode ? 'bg-[#E4E3E0] text-[#141414] border-[#E4E3E0]' : 'bg-[#141414] text-[#E4E3E0] border-[#141414]'
            }`}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};
