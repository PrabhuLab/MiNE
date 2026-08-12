'use client';

import React, { useRef } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import type { LegendMetricScale } from '@/services/graphStyles/types';
import type { ElementLegendItem, LegendCategories, LegendCategoryItem } from './legend/types';

export type { ElementLegendItem, LegendCategories, LegendCategoryItem } from './legend/types';

export interface GraphLegendProps {
  isDarkMode?: boolean;
  elementLegendItems: ElementLegendItem[];
  elementLegendIds: string[];
  hiddenItems: Set<string>;
  isolatedLegendItem: string | null;
  selectedCommunityId?: string | null;
  isolatedCommunityId?: string | null;
  handleLegendClick?: (e: React.MouseEvent, id: string, categoryIds: string[]) => void;
  onElementSingleClick?: (id: string) => void;
  onElementDoubleClick?: (id: string) => void;
  onCommunitySingleClick?: (id: string) => void;
  onCommunityDoubleClick?: (id: string) => void;
  onCommunityHover?: (id: string | null) => void;
  showNodeLabels: boolean;
  setShowNodeLabels: (val: boolean) => void;
  directed: boolean;
  showArrowheads: boolean;
  setShowArrowheads: (val: boolean) => void;
  legendCategories: LegendCategories | null;
  legendMetricScale?: LegendMetricScale | null;
  isLegendMinimized: boolean;
  setIsLegendMinimized: (val: boolean) => void;
}

export default function GraphLegend({
  isDarkMode,
  elementLegendItems,
  elementLegendIds,
  hiddenItems,
  isolatedLegendItem,
  selectedCommunityId,
  isolatedCommunityId,
  handleLegendClick,
  onElementSingleClick,
  onElementDoubleClick,
  onCommunitySingleClick,
  onCommunityDoubleClick,
  onCommunityHover,
  showNodeLabels,
  setShowNodeLabels,
  directed,
  showArrowheads,
  setShowArrowheads,
  legendCategories,
  legendMetricScale,
  isLegendMinimized,
  setIsLegendMinimized,
}: GraphLegendProps) {
  const clickTimers = useRef<{ [key: string]: NodeJS.Timeout }>({});

  const handleElementItemClick = (e: React.MouseEvent, item: ElementLegendItem) => {
    e.stopPropagation();
    const id = item.id;

    if (e.detail === 2) {
      if (clickTimers.current[id]) {
        clearTimeout(clickTimers.current[id]);
        delete clickTimers.current[id];
      }
      if (onElementDoubleClick) {
        onElementDoubleClick(id);
      }
    } else {
      if (clickTimers.current[id]) {
        clearTimeout(clickTimers.current[id]);
      }
      clickTimers.current[id] = setTimeout(() => {
        delete clickTimers.current[id];
        if (onElementSingleClick) {
          onElementSingleClick(id);
        } else if (handleLegendClick) {
          handleLegendClick(e, id, elementLegendIds);
        }
      }, 250);
    }
  };

  const handleCategoryClick = (e: React.MouseEvent, item: LegendCategoryItem) => {
    e.stopPropagation();
    const id = item.id;

    if (e.detail === 2) {
      if (clickTimers.current[id]) {
        clearTimeout(clickTimers.current[id]);
        delete clickTimers.current[id];
      }
      if (onCommunityDoubleClick) {
        onCommunityDoubleClick(id);
      } else if (handleLegendClick) {
        handleLegendClick(e, id, item.allIds);
      }
    } else {
      if (clickTimers.current[id]) {
        clearTimeout(clickTimers.current[id]);
      }
      clickTimers.current[id] = setTimeout(() => {
        delete clickTimers.current[id];
        if (onCommunitySingleClick) {
          onCommunitySingleClick(id);
        } else if (handleLegendClick) {
          handleLegendClick(e, id, item.allIds);
        }
      }, 250);
    }
  };

  // Generate CSS linear-gradient for continuous metric scale
  const gradientCss = React.useMemo(() => {
    if (!legendMetricScale) return '';
    const { min, max, scale } = legendMetricScale;
    const steps = 10;
    const stops: string[] = [];
    for (let i = 0; i <= steps; i++) {
      const val = min + (i / steps) * (max - min);
      stops.push(scale(val));
    }
    return `linear-gradient(to right, ${stops.join(', ')})`;
  }, [legendMetricScale]);

  return (
    <div
      className={`absolute top-6 left-6 border shadow-sm flex flex-col transition-colors z-10 ${
        isDarkMode
          ? 'bg-[#141414]/90 border-[#333] text-[#E4E3E0]'
          : 'bg-white/90 border-[#d0d0d0] text-[#141414]'
      }`}
      style={{ backdropFilter: 'blur(4px)', width: isLegendMinimized ? 'auto' : '230px' }}
    >
      <div
        className="flex items-center justify-between p-2 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5"
        onClick={() => setIsLegendMinimized(!isLegendMinimized)}
      >
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-70 px-1">
          Legend
        </span>
        <button className="opacity-70 hover:opacity-100 ml-4">
          {isLegendMinimized ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>

      {!isLegendMinimized && (
        <div
          className={`p-3 pt-2 text-[10px] space-y-3 ${
            isDarkMode ? 'border-[#333]' : 'border-[#d0d0d0]'
          } border-t`}
        >
          {/* Elements Section */}
          <div>
            <div className="opacity-50 uppercase font-bold mb-1">Elements</div>
            <div className="space-y-1">
              {elementLegendItems.map((item) => {
                const isIsolated = isolatedLegendItem === item.id;
                const isHidden = hiddenItems.has(item.id);
                const isOtherIsolated = isolatedLegendItem !== null && isolatedLegendItem !== item.id;

                return (
                  <div
                    key={item.id}
                    className={`flex items-center space-x-2 cursor-pointer p-1 -mx-1 rounded-sm transition-all ${
                      isIsolated
                        ? 'bg-[#b4ff39]/20 font-bold border border-[#b4ff39]'
                        : isHidden
                        ? 'opacity-40 line-through'
                        : isOtherIsolated
                        ? 'opacity-40'
                        : 'opacity-100 hover:bg-black/5 dark:hover:bg-white/10'
                    }`}
                    onClick={(e) => handleElementItemClick(e, item)}
                    title="Single-click to toggle show/hide, double-click to isolate"
                  >
                    <item.Icon />
                    <span>{item.label}</span>
                  </div>
                );
              })}

              {/* Node Labels Toggle */}
              <div
                className={`flex items-center justify-between cursor-pointer p-1 -mx-1 rounded-sm transition-all ${
                  showNodeLabels
                    ? 'opacity-100 font-bold bg-black/5 dark:bg-white/10'
                    : 'opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5'
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowNodeLabels(!showNodeLabels);
                }}
                title="Click to toggle node labels on graph"
              >
                <div className="flex items-center space-x-2">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className={showNodeLabels ? 'text-[#b4ff39]' : ''}
                  >
                    <path
                      d="M2 12l3.5-8L9 12M3.2 9h4.6M10.5 12V8.5a1.5 1.5 0 1 1 3 0V12M10.5 10h3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>Node Labels</span>
                </div>
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded border transition-colors ${
                    showNodeLabels
                      ? 'bg-[#b4ff39] text-[#141414] border-[#b4ff39] font-bold'
                      : 'bg-transparent text-current opacity-70 border-current/30'
                  }`}
                >
                  {showNodeLabels ? 'ON' : 'OFF'}
                </span>
              </div>

              {/* Arrowheads Toggle */}
              {directed && (
                <div
                  className={`flex items-center justify-between cursor-pointer p-1 -mx-1 rounded-sm transition-all ${
                    showArrowheads
                      ? 'opacity-100 font-bold bg-black/5 dark:bg-white/10'
                      : 'opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowArrowheads(!showArrowheads);
                  }}
                  title="Click to toggle arrowheads on all directed edges"
                >
                  <div className="flex items-center space-x-2">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className={showArrowheads ? 'text-[#b4ff39]' : ''}
                    >
                      <path
                        d="M2 8h11M9 4l4 4-4 4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span>Arrowheads</span>
                  </div>
                  <span
                    className={`text-[9px] font-mono px-1.5 py-0.5 rounded border transition-colors ${
                      showArrowheads
                        ? 'bg-[#b4ff39] text-[#141414] border-[#b4ff39] font-bold'
                        : 'bg-transparent text-current opacity-70 border-current/30'
                    }`}
                  >
                    {showArrowheads ? 'ON' : 'OFF'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Continuous Metric Scale Legend */}
          {legendMetricScale ? (
            <div className="pt-1">
              <div className="opacity-50 uppercase font-bold mb-1.5">
                {legendMetricScale.title}
              </div>
              <div
                className="w-full h-3 rounded-sm border border-black/10 dark:border-white/20 mb-1"
                style={{ background: gradientCss }}
              />
              <div className="flex justify-between text-[9px] font-mono opacity-80">
                <span>{legendMetricScale.ticks[0]?.toFixed(2)}</span>
                <span>{legendMetricScale.ticks[1]?.toFixed(2)}</span>
                <span>{legendMetricScale.ticks[2]?.toFixed(2)}</span>
              </div>
            </div>
          ) : legendCategories ? (
            <div>
              <div className="opacity-50 uppercase font-bold mb-1 flex items-center justify-between">
                <span>{legendCategories.title}</span>
              </div>
              <div className="space-y-1 max-h-[160px] overflow-y-auto pr-1">
                {legendCategories.items.map((item, i) => {
                  const isIsolated = isolatedCommunityId === item.id || isolatedLegendItem === item.id;
                  const isHidden = hiddenItems.has(item.id);
                  const isOtherIsolated = isolatedCommunityId !== null && isolatedCommunityId !== item.id;

                  return (
                    <div
                      key={i}
                      className={`flex items-center space-x-2 cursor-pointer p-1 -mx-1 rounded-sm transition-all ${
                        isIsolated
                          ? 'bg-[#b4ff39]/20 font-bold border border-[#b4ff39]'
                          : isHidden
                          ? 'opacity-40 line-through'
                          : isOtherIsolated
                          ? 'opacity-40'
                          : 'opacity-100 hover:bg-black/5 dark:hover:bg-white/10'
                      }`}
                      onClick={(e) => handleCategoryClick(e, item)}
                      onMouseEnter={() => onCommunityHover && onCommunityHover(item.id)}
                      onMouseLeave={() => onCommunityHover && onCommunityHover(null)}
                      title="Single-click to toggle show/hide, double-click to isolate"
                    >
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0 border border-black/20 dark:border-white/30"
                        style={{ backgroundColor: item.color }}
                      ></div>
                      <span className="flex-grow select-none truncate">{item.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
