'use client';

import React from 'react';

interface GraphControlOverlayProps {
  isDarkMode?: boolean;
  onZoomFit: () => void;
  onRefreshGraph: () => void;
  isCalculatingLayout?: boolean;
}

export default function GraphControlOverlay({
  isDarkMode,
  onZoomFit,
  onRefreshGraph,
  isCalculatingLayout,
}: GraphControlOverlayProps) {
  return (
    <>
      {isCalculatingLayout && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/10 dark:bg-white/5 backdrop-blur-sm z-50">
          <div className="w-6 h-6 border-2 border-t-transparent border-[#141414] dark:border-[#E4E3E0] rounded-full animate-spin mb-4"></div>
          <span className="text-[10px] font-bold uppercase tracking-widest font-mono">
            Calculating Layout...
          </span>
        </div>
      )}

      {/* Tools Menu */}
      <div className="absolute top-6 right-6 flex flex-col space-y-2 z-10">
        <button
          onClick={onZoomFit}
          className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border transition-colors ${
            isDarkMode
              ? 'bg-[#141414] border-[#333] text-[#E4E3E0] hover:bg-[#E4E3E0] hover:text-[#141414]'
              : 'bg-white border-[#141414] text-[#141414] hover:bg-[#141414] hover:text-white'
          }`}
        >
          [ FIT ZOOM ]
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
