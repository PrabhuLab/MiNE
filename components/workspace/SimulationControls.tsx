import React from 'react';
import { useStore } from '@/store/useStore';
import { SegmentedToggle } from '@/components/ui/SegmentedToggle';

export const SimulationControls = ({ setAppliedFilters }: { setAppliedFilters: (val: any) => void }) => {
  const { filters, setFilter, isDarkMode,  } = useStore();

  return (
    <div>
      <h3 className={`text-[10px] font-bold uppercase tracking-widest mb-4 opacity-70 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>Simulation Parameters</h3>
      <div className="flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase text-[10px]">Live Update Controls</label>
            <SegmentedToggle 
              checked={filters.liveUpdate}
              onChange={(v: boolean) => setFilter('liveUpdate', v)}
              isDarkMode={isDarkMode}
              ariaLabel="Live Update Controls"
            />
          </div>

          {!filters.liveUpdate && (
            <div className="flex flex-col space-y-2">
              <div className="px-2.5 py-1.5 border border-amber-500/40 bg-amber-500/10 text-amber-500 text-[10px] uppercase font-bold tracking-widest rounded-sm flex items-center justify-between">
                <span>Pending Recalculation</span>
                <span className="text-[9px] opacity-75">(Deferred)</span>
              </div>
              <button 
                onClick={() => setAppliedFilters(useStore.getState().filters)}
                className={`w-full py-2 text-[10px] font-bold uppercase tracking-widest border transition-colors ${isDarkMode ? 'bg-[#141414] border-[#b4ff39] text-[#b4ff39] hover:bg-[#b4ff39] hover:text-[#141414]' : 'bg-white border-[#141414] text-[#141414] hover:bg-[#141414] hover:text-white'}`}
              >
                Apply Changes
              </button>
            </div>
          )}
            
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase text-[10px]">Enable Live Physics</label>
            <SegmentedToggle 
              checked={filters.livePhysics}
              onChange={(v: boolean) => setFilter('livePhysics', v)}
              isDarkMode={isDarkMode}
              ariaLabel="Enable Live Physics"
            />
          </div>
            
          
      </div>
    </div>
  );
};
