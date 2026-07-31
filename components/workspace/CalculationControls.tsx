import React, { useState } from 'react';
import { useStore } from '@/store/useStore';
import { SyncInput } from '@/components/ui/SyncInput';
import { CustomSlider } from '@/components/ui/CustomSlider';

interface CalculationControlsProps {
  metricsToRun: any;
  setMetricsToRun: React.Dispatch<React.SetStateAction<any>>;
  runSelectedMetrics: () => void;
  metricsLoading: boolean;
}

export const CalculationControls = ({ metricsToRun, setMetricsToRun, runSelectedMetrics, metricsLoading }: CalculationControlsProps) => {
  const { filters, setFilter, isDarkMode, directed } = useStore();
  const [activeControlTab, setActiveControlTab] = useState<"communities" | "metrics">("communities");

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
      <h3 className={`text-[10px] font-bold uppercase tracking-widest opacity-70 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>Calculations</h3>
    </div>
      <div className="flex border-b mb-6">
      <button 
        className={`flex-1 text-[10px] font-bold uppercase tracking-widest py-2 border-b-2 transition-colors ${activeControlTab === "communities" ? (isDarkMode ? "border-[#E4E3E0] text-[#E4E3E0]" : "border-[#141414] text-[#141414]") : (isDarkMode ? "border-transparent text-[#888] hover:text-[#ccc]" : "border-transparent text-[#888] hover:text-[#444]")}`}
        onClick={() => setActiveControlTab("communities")}
      >
        Communities
      </button>
      <button 
        className={`flex-1 text-[10px] font-bold uppercase tracking-widest py-2 border-b-2 transition-colors ${activeControlTab === "metrics" ? (isDarkMode ? "border-[#E4E3E0] text-[#E4E3E0]" : "border-[#141414] text-[#141414]") : (isDarkMode ? "border-transparent text-[#888] hover:text-[#ccc]" : "border-transparent text-[#888] hover:text-[#444]")}`}
        onClick={() => setActiveControlTab("metrics")}
      >
        Metrics
      </button>
    </div>

      {activeControlTab === "communities" && (
        <div className="space-y-5">
          <div className="group">
            <label className={`block text-[10px] font-bold uppercase tracking-widest mb-4 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>
              Community Detection Algorithms
            </label>
            <div className="space-y-3">
              {[
                { key: "louvain", label: "Louvain" },
                { key: "leiden", label: "Leiden" }
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(metricsToRun as any)[key]}
                    onChange={(e) => setMetricsToRun((prev: any) => ({ ...prev, [key]: e.target.checked }))}
                    className="accent-[#141414] dark:accent-[#E4E3E0] w-3 h-3"
                  />
                  <span className={`text-[10px] uppercase font-mono tracking-wider ${isDarkMode ? 'text-[#aaa]' : 'text-[#555]'}`}>
                    {label}
                  </span>
                </label>
              ))}
            </div>

            {metricsToRun.louvain && (
              <div className={`mt-4 pt-4 border-t border-dotted ${isDarkMode ? 'border-[#555]' : 'border-[#ccc]'}`}>
                <label className={`flex items-center justify-between text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>
                  <span>Louvain Resolution</span>
                  <SyncInput 
                    className={`w-12 bg-transparent border-b text-right font-mono outline-none ${isDarkMode ? 'border-[#333] focus:border-[#E4E3E0] text-[#E4E3E0]' : 'border-[#ccc] focus:border-[#141414] text-[#141414]'}`}
                    value={filters.resolution}
                    onChange={(v: number) => setFilter('resolution', v)}
                    step="0.1"
                  />
                </label>
                <CustomSlider
                  min="0.1" max="5.0" step="0.1"
                  value={filters.resolution}
                  onChange={(v: number) => setFilter('resolution', v)}
                  isDarkMode={isDarkMode}
                />
              </div>
            )}

            <button
              onClick={runSelectedMetrics}
              disabled={metricsLoading || (!metricsToRun.louvain && !metricsToRun.leiden)}
              className={`mt-6 w-full py-2 text-[10px] uppercase font-bold tracking-widest border transition-colors ${
                metricsLoading 
                ? "opacity-50 cursor-not-allowed border-gray-400 text-gray-400" 
                : (isDarkMode ? "border-[#E4E3E0] text-[#E4E3E0] hover:bg-[#E4E3E0] hover:text-[#141414]" : "border-[#141414] text-[#141414] hover:bg-[#141414] hover:text-white")
              }`}
            >
              {metricsLoading ? "Computing..." : "Run Communities"}
            </button>
          </div>
        </div>
      )}

      {activeControlTab === "metrics" && (
        <div className="space-y-5">
          <div className="group">
            <label className={`block text-[10px] font-bold uppercase tracking-widest mb-4 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>
              Select Metrics to Compute
            </label>
            <div className="space-y-3">
              {[
                { key: "degree", label: directed ? "In/Out Degree Centrality" : "Degree Centrality" },
                { key: "betweenness", label: "Betweenness Centrality" },
                { key: "closeness", label: "Closeness Centrality" },
                { key: "clustering", label: "Clustering Coefficient" },
                { key: "pagerank", label: "PageRank" },
                { key: "eigenvector", label: "Eigenvector Centrality" }
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(metricsToRun as any)[key]}
                    onChange={(e) => setMetricsToRun((prev: any) => ({ ...prev, [key]: e.target.checked }))}
                    className="accent-[#141414] dark:accent-[#E4E3E0] w-3 h-3"
                  />
                  <span className={`text-[10px] uppercase font-mono tracking-wider ${isDarkMode ? 'text-[#aaa]' : 'text-[#555]'}`}>
                    {label}
                  </span>
                </label>
              ))}
            </div>
            <button
              onClick={runSelectedMetrics}
              disabled={metricsLoading || !Object.values({ ...metricsToRun, louvain: false, leiden: false }).some(v => v)}
              className={`mt-6 w-full py-2 text-[10px] uppercase font-bold tracking-widest border transition-colors ${
                metricsLoading 
                ? "opacity-50 cursor-not-allowed border-gray-400 text-gray-400" 
                : (isDarkMode ? "border-[#E4E3E0] text-[#E4E3E0] hover:bg-[#E4E3E0] hover:text-[#141414]" : "border-[#141414] text-[#141414] hover:bg-[#141414] hover:text-white")
              }`}
            >
              {metricsLoading ? "Computing..." : "Run Metrics"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
