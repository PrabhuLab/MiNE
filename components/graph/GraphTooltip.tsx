'use client';

import React from 'react';
import type { TooltipData } from '@/services/graphInteraction/types';

export type { TooltipData } from '@/services/graphInteraction/types';

interface GraphTooltipProps {
  tooltip: TooltipData | null;
  isDarkMode?: boolean;
}

export default function GraphTooltip({ tooltip, isDarkMode }: GraphTooltipProps) {
  if (!tooltip) return null;

  return (
    <div
      className={`fixed z-50 pointer-events-none p-2 rounded shadow-md border text-[10px] font-mono ${
        isDarkMode
          ? 'bg-[#141414]/95 border-[#333] text-[#E4E3E0]'
          : 'bg-white/95 border-[#141414] text-[#141414]'
      }`}
      style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}
    >
      <div className="font-bold border-b border-current/20 pb-1 mb-1">{tooltip.title}</div>
      {tooltip.items?.map((item, idx) => (
        <div key={idx} className="flex justify-between gap-3">
          <span className="opacity-60">{item.label}:</span>
          <span className="font-bold">{item.value}</span>
        </div>
      ))}
    </div>
  );
}
