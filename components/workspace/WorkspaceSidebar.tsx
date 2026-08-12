import React from 'react';
import { useStore } from '@/store/useStore';
import { ChevronRight, ChevronLeft, Sun, Moon, Download } from 'lucide-react';

import { SimulationControls } from './SimulationControls';
import { SearchControls } from './SearchControls';
import { CustomizationControls } from './CustomizationControls';
import { CalculationControls } from './CalculationControls';
import { FilterControls } from './FilterControls';

interface WorkspaceSidebarProps {
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (v: boolean) => void;
  handleImportWorkspace: (e: React.ChangeEvent<HTMLInputElement>) => void;
  metricsToRun: any;
  setMetricsToRun: React.Dispatch<React.SetStateAction<any>>;
  runSelectedMetrics: () => void;
  metricsLoading: boolean;
  hasType: boolean;
  hasAbundance: boolean;
  hasSecondaryWeight: boolean;
  validNodes: any[];
  networkMetrics: any[];
  rawNodes: any[];
  validEdges: any[];
  rawEdges: any[];
  removedNodesString: string;
  removedNodesCount: number;
  setAppliedFilters: (val: any) => void;
}

export const WorkspaceSidebar = ({
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  handleImportWorkspace,
  metricsToRun,
  setMetricsToRun,
  runSelectedMetrics,
  metricsLoading,
  hasType,
  hasAbundance,
  hasSecondaryWeight,
  validNodes,
  networkMetrics,
  rawNodes,
  validEdges,
  rawEdges,
  removedNodesString,
  removedNodesCount,
  setAppliedFilters
}: WorkspaceSidebarProps) => {
  const { isDarkMode, setIsDarkMode } = useStore();

  if (isSidebarCollapsed) {
    return (
      <div className={`border-r shrink-0 flex flex-col items-center py-4 space-y-4 transition-colors ${isDarkMode ? 'border-[#333] bg-[#000]' : 'border-[#141414] bg-[#E4E3E0]'} w-12`}>
        <button 
          onClick={() => setIsSidebarCollapsed(false)}
          className={`p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}
          title="Expand Sidebar"
        >
          <ChevronRight size={18} />
        </button>
        <button 
          onClick={() => setIsDarkMode(!isDarkMode)}
          className={`p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}
          title="Toggle Theme"
        >
          {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    );
  }

  return (
    <aside className={`w-72 border-r flex flex-col p-6 space-y-6 shrink-0 overflow-y-auto transition-colors ${isDarkMode ? 'border-[#333] bg-[#000]' : 'border-[#141414] bg-[#E4E3E0]'}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-widest">Controls</h2>
        <div className="flex items-center space-x-2">
          <label className={`p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`} title="Import Workspace Settings JSON (settings only)">
            <Download size={16} className="rotate-180" />
            <input type="file" accept=".json" className="hidden" onChange={handleImportWorkspace} />
          </label>
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}
            title="Toggle Theme"
          >
            {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button 
            onClick={() => setIsSidebarCollapsed(true)}
            className={`p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}
            title="Collapse Sidebar"
          >
            <ChevronLeft size={16} />
          </button>
        </div>
      </div>

      <SimulationControls setAppliedFilters={setAppliedFilters} />
         
      <div className={`h-px w-full my-4 ${isDarkMode ? 'bg-[#333]' : 'bg-[#ccc]'}`}></div>

      <SearchControls />
         
      <div className={`h-px w-full my-4 ${isDarkMode ? 'bg-[#333]' : 'bg-[#ccc]'}`}></div>

      <CustomizationControls 
        networkMetrics={networkMetrics}
        hasType={hasType}
        hasAbundance={hasAbundance}
        hasSecondaryWeight={hasSecondaryWeight}
      />
         
      <div className={`h-px w-full my-4 ${isDarkMode ? 'bg-[#333]' : 'bg-[#ccc]'}`}></div>

      <CalculationControls 
        metricsToRun={metricsToRun}
        setMetricsToRun={setMetricsToRun}
        runSelectedMetrics={runSelectedMetrics}
        metricsLoading={metricsLoading}
      />
         
      <div className={`h-px w-full my-4 ${isDarkMode ? 'bg-[#333]' : 'bg-[#ccc]'}`}></div>

      <FilterControls 
        hasSecondaryWeight={hasSecondaryWeight}
        validNodes={validNodes}
        rawNodes={rawNodes}
        validEdges={validEdges}
        rawEdges={rawEdges}
        removedNodesString={removedNodesString}
        removedNodesCount={removedNodesCount}
      />
    </aside>
  );
};
