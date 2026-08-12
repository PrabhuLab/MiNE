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
    <div className="relative flex w-full min-w-0 items-stretch border-b border-black/15 dark:border-white/15">
      <button type="button" aria-label="Previous network metrics" onClick={() => scroll(-1)} className="shrink-0 px-2 border-r border-black/15 dark:border-white/15 hover:bg-black/5 dark:hover:bg-white/10">
        <ChevronLeft size={15} />
      </button>
      <div ref={scrollerRef} className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain scroll-smooth px-3 py-3" style={{ scrollbarGutter: 'stable' }}>
        <div className="flex w-max gap-3 snap-x snap-mandatory">
        {entries.map(([id, value]) => (
          <div key={id} className="w-48 shrink-0 snap-start border border-black/20 dark:border-white/20 px-3 py-2">
            <div className="text-[9px] font-bold uppercase tracking-[0.16em] opacity-55">{METRIC_BY_ID.get(id)?.label || labelFallback(id)}</div>
            <div className="mt-1 text-xs font-mono break-words">{formatValue(value)}</div>
          </div>
        ))}
        </div>
      </div>
      <button type="button" aria-label="Next network metrics" onClick={() => scroll(1)} className="shrink-0 px-2 border-l border-black/15 dark:border-white/15 hover:bg-black/5 dark:hover:bg-white/10">
        <ChevronRight size={15} />
      </button>
    </div>
  );
}

function labelFallback(id: string): string {
  return id.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (letter) => letter.toUpperCase());
}
