import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { METRIC_BY_ID } from '@/services/metrics/registry';

const formatValue = (value: unknown): string => {
  if (typeof value === 'number') return Number.isFinite(value) ? (Math.abs(value) >= 1000 ? value.toLocaleString() : Number(value.toPrecision(7)).toString()) : String(value);
  if (Array.isArray(value)) return value.map(formatValue).join(' – ');
  if (value && typeof value === 'object') return Object.entries(value).map(([key, item]) => `${key}: ${formatValue(item)}`).join(' · ');
  return String(value);
};

export function GraphMetricCarousel({ metrics }: { metrics: Record<string, any> }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const entries = Object.entries(metrics).filter(([, value]) => value !== null && value !== undefined);
  if (!entries.length) return null;
  const scroll = (direction: -1 | 1) => scrollerRef.current?.scrollBy({ left: direction * 420, behavior: 'smooth' });
  return (
    <div className="relative flex w-full min-w-0 items-stretch border-b border-black/15 dark:border-white/15 bg-black/[0.02] dark:bg-white/[0.02]">
      <button type="button" aria-label="Previous network metrics" onClick={() => scroll(-1)} className="shrink-0 px-2 border-r border-black/15 dark:border-white/15 hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center">
        <ChevronLeft size={14} />
      </button>
      <div ref={scrollerRef} className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain scroll-smooth px-2 py-1.5">
        <div className="flex w-max gap-2 snap-x snap-mandatory">
        {entries.map(([id, value]) => (
          <div key={id} className="w-44 shrink-0 snap-start border border-black/15 dark:border-white/15 px-2.5 py-1 flex flex-col justify-center bg-white/50 dark:bg-black/20">
            <div className="text-[8.5px] font-bold uppercase tracking-[0.14em] opacity-55 truncate">{METRIC_BY_ID.get(id)?.label || labelFallback(id)}</div>
            <div className="mt-0.5 text-[11px] font-mono break-words line-clamp-1 leading-tight">{formatValue(value)}</div>
          </div>
        ))}
        </div>
      </div>
      <button type="button" aria-label="Next network metrics" onClick={() => scroll(1)} className="shrink-0 px-2 border-l border-black/15 dark:border-white/15 hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center">
        <ChevronRight size={14} />
      </button>
    </div>
  );
}

function labelFallback(id: string): string {
  return id.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (letter) => letter.toUpperCase());
}
