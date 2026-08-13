'use client';

import React from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

export interface ElementLegendItem {
  id: string;
  label: string;
  Icon: React.ComponentType;
}

export interface LegendCategoryItem {
  label: string;
  id: string;
  color: string;
  nodes?: string[];
  allIds: string[];
}

export interface LegendCategories {
  title: string;
  items: LegendCategoryItem[];
}

interface GraphLegendProps {
  isDarkMode?: boolean;
  elementLegendItems: ElementLegendItem[];
  elementLegendIds: string[];
  hiddenItems: Set<string>;
  isolatedLegendItem: string | null;
  handleLegendClick: (e: React.MouseEvent, id: string, categoryIds: string[]) => void;
  showNodeLabels: boolean;
  setShowNodeLabels: (val: boolean) => void;
  directed: boolean;
  showArrowheads: boolean;
  setShowArrowheads: (val: boolean) => void;
  legendCategories: LegendCategories | null;
  isLegendMinimized: boolean;
  setIsLegendMinimized: (val: boolean) => void;
}

export default function GraphLegend({
  isDarkMode,
  elementLegendItems,
  elementLegendIds,
  hiddenItems,
  isolatedLegendItem,
  handleLegendClick,
  showNodeLabels,
  setShowNodeLabels,
  directed,
  showArrowheads,
  setShowArrowheads,
  legendCategories,
  isLegendMinimized,
  setIsLegendMinimized,
}: GraphLegendProps) {
  return (
    <div
      className={`absolute top-6 left-6 border shadow-sm flex flex-col transition-colors z-10 ${
        isDarkMode
          ? 'bg-[#141414]/90 border-[#333] text-[#E4E3E0]'
          : 'bg-white/90 border-[#d0d0d0] text-[#141414]'
      }`}
      style={{ backdropFilter: 'blur(4px)', width: isLegendMinimized ? 'auto' : '220px' }}
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
          <div>
            <div className="opacity-50 uppercase font-bold mb-1">Elements</div>
            <div className="space-y-1">
              {elementLegendItems.map((item) => {
                const isHidden =
                  hiddenItems.has(item.id) ||
                  (isolatedLegendItem !== null && isolatedLegendItem !== item.id);
                return (
                  <div
                    key={item.id}
                    className={`flex items-center space-x-2 cursor-pointer p-1 -mx-1 rounded-sm transition-opacity ${
                      isHidden ? 'opacity-40 line-through' : 'opacity-100 hover:bg-black/5 dark:hover:bg-white/10'
                    }`}
                    onClick={(e) => handleLegendClick(e, item.id, elementLegendIds)}
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

          {legendCategories && (
            <div>
              <div className="opacity-50 uppercase font-bold mb-1 flex items-center justify-between">
                <span>{legendCategories.title}</span>
              </div>
              <div className="space-y-1 max-h-[150px] overflow-y-auto pr-1">
                {legendCategories.items.map((item, i) => {
                  const isHidden =
                    hiddenItems.has(item.id) ||
                    (isolatedLegendItem !== null && isolatedLegendItem !== item.id);
                  return (
                    <div
                      key={i}
                      className={`flex items-center space-x-2 cursor-pointer p-1 -mx-1 rounded-sm transition-opacity ${
                        isHidden ? 'opacity-40 line-through' : 'opacity-100 hover:bg-black/5 dark:hover:bg-white/10'
                      }`}
                      onClick={(e) => handleLegendClick(e, item.id, item.allIds)}
                      title="Click to toggle visibility, double-click to isolate, triple-click to reset"
                    >
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: item.color }}
                      ></div>
                      <span className="flex-grow select-none">{item.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
