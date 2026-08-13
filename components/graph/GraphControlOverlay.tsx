'use client';

import React from 'react';

interface GraphControlOverlayProps {
  isDarkMode?: boolean;
  onZoomFit?: () => void;
  onResetView?: () => void;
  onRefreshGraph: () => void;
  isCalculatingLayout?: boolean;
  activeRenderer?: 'd3' | 'sigma';
  onSwitchRenderer?: (engine: 'd3' | 'sigma') => void;
  isRendererSwitching?: boolean;
}

export default function GraphControlOverlay({
  isDarkMode,
  onZoomFit,
  onResetView,
  onRefreshGraph,
  isCalculatingLayout,
  activeRenderer = 'd3',
  onSwitchRenderer,
  isRendererSwitching,
}: GraphControlOverlayProps) {
  const handleReset = onResetView || onZoomFit;
  return (
    <>
      {(isCalculatingLayout || isRendererSwitching) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 dark:bg-black/60 backdrop-blur-md z-50">
          <div className="w-8 h-8 border-2 border-t-transparent border-[#141414] dark:border-[#E4E3E0] rounded-full animate-spin mb-4"></div>
          <span className="text-[11px] font-bold uppercase tracking-widest font-mono text-[#141414] dark:text-[#E4E3E0]">
            {isRendererSwitching ? 'Switching Renderer...' : 'Calculating Layout...'}
          </span>
        </div>
      )}

      {/* Tools Menu */}
      <div className="absolute top-6 right-6 flex flex-col space-y-2 z-10">
        <button
          onClick={handleReset}
          className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border transition-colors ${
            isDarkMode
              ? 'bg-[#141414] border-[#333] text-[#E4E3E0] hover:bg-[#E4E3E0] hover:text-[#141414]'
              : 'bg-white border-[#141414] text-[#141414] hover:bg-[#141414] hover:text-white'
          }`}
          title="Clear temporary isolation and fit all currently visible nodes"
        >
          [ RESET VIEW ]
        </button>
        <button
          onClick={onRefreshGraph}
          className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border transition-colors ${
            isDarkMode
              ? 'bg-[#141414] border-[#333] text-[#E4E3E0] hover:bg-[#E4E3E0] hover:text-[#141414]'
              : 'bg-white border-[#141414] text-[#141414] hover:bg-[#141414] hover:text-white'
          }`}
        >
          [ REFRESH ]
        </button>
      </div>
    </>
  );
}
