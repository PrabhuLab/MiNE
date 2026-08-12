import React, { useEffect, useMemo } from 'react';
import { getCommunityDisplayMap, getDistinctColor } from '@/lib/communityUtils';
import { useStore } from '@/store/useStore';

interface WorkspaceDataTableProps {
  dataTab: 'nodes' | 'edges';
  tableData: any[];
  tableDataEdges: any[];
  networkMetrics: any[];
  handleSort: (key: string) => void;
  sortConfig: { key: string; direction: "asc" | "desc" } | null;
  handleElementDoubleClick: (
    id: string,
    type: "node" | "edge",
    endpoints?: { source: string; target: string }
  ) => void;
}

export const WorkspaceDataTable = ({
  dataTab,
  tableData,
  tableDataEdges,
  networkMetrics,
  handleSort,
  sortConfig,
  handleElementDoubleClick
}: WorkspaceDataTableProps) => {
  const { isDarkMode, directed, selectedElement, setSelectedElement, communityMap } = useStore();

  const communityDisplay = useMemo(
    () => getCommunityDisplayMap(tableData, communityMap, networkMetrics),
    [tableData, communityMap, networkMetrics]
  );

  const displayMap = communityDisplay.displayMap;

  const hasInDegree = networkMetrics.some(m => m.inDegree !== undefined) || (directed && tableData.length > 0);
  const hasOutDegree = networkMetrics.some(m => m.outDegree !== undefined) || (directed && tableData.length > 0);
  const hasDegree = networkMetrics.some(m => m.degree !== undefined) || (!directed && tableData.length > 0);
  const hasInDegreeCent = networkMetrics.some(m => m.inDegreeCentrality !== undefined);
  const hasOutDegreeCent = networkMetrics.some(m => m.outDegreeCentrality !== undefined);
  const hasDegreeCent = networkMetrics.some(m => m.degreeCentrality !== undefined);
  const hasEigenvectorCent = networkMetrics.some(m => m.eigenvector !== undefined);
  const hasPagerankCent = networkMetrics.some(m => m.pagerank !== undefined);
  const hasLouvain = networkMetrics.some(m => m.louvain !== undefined);
  const hasDeltaQ = hasLouvain && tableData.some((node) => node.mod?.deltaQ !== undefined);

  // Auto scroll selected row into view when selectedElement is present
  useEffect(() => {
    if (selectedElement) {
      const rowEl = document.getElementById(`row-${selectedElement}`);
      if (rowEl) {
        rowEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedElement]);

  return (
    <div className="flex-1 w-full h-full overflow-auto">
      {dataTab === "nodes" && (
        <table className={`w-full text-left text-xs border-collapse ${isDarkMode ? "text-[#ddd]" : "text-[#333]"}`}>
          <thead className={`sticky top-0 shadow-sm z-10 ${isDarkMode ? "bg-[#222] border-b border-[#444]" : "bg-[#f0f0f0] border-b border-[#ccc]"}`}>
            <tr>
              <th className="p-3 font-bold uppercase tracking-wider cursor-pointer hover:bg-black/5 dark:hover:bg-white/5" onClick={() => handleSort("id")}>
                Node ID {sortConfig?.key === "id" && (sortConfig.direction === "asc" ? "↑" : "↓")}
              </th>
              <th className="p-3 font-bold uppercase tracking-wider cursor-pointer hover:bg-black/5 dark:hover:bg-white/5" onClick={() => handleSort("label")}>
                Label {sortConfig?.key === "label" && (sortConfig.direction === "asc" ? "↑" : "↓")}
              </th>
              <th className="p-3 font-bold uppercase tracking-wider cursor-pointer hover:bg-black/5 dark:hover:bg-white/5" onClick={() => handleSort("abundance")}>
                Abundance {sortConfig?.key === "abundance" && (sortConfig.direction === "asc" ? "↑" : "↓")}
              </th>
              {directed ? (
                <>
                  {hasInDegree && (
                    <th className="p-3 font-bold uppercase tracking-wider cursor-pointer hover:bg-black/5 dark:hover:bg-white/5" onClick={() => handleSort("inDegree")}>
                      In Degree {sortConfig?.key === "inDegree" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                    </th>
                  )}
                  {hasOutDegree && (
                    <th className="p-3 font-bold uppercase tracking-wider cursor-pointer hover:bg-black/5 dark:hover:bg-white/5" onClick={() => handleSort("outDegree")}>
                      Out Degree {sortConfig?.key === "outDegree" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                    </th>
                  )}
                  {hasInDegreeCent && (
                    <th className="p-3 font-bold uppercase tracking-wider cursor-pointer hover:bg-black/5 dark:hover:bg-white/5" onClick={() => handleSort("inDegreeCentrality")}>
                      In Deg Cent {sortConfig?.key === "inDegreeCentrality" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                    </th>
                  )}
                  {hasOutDegreeCent && (
                    <th className="p-3 font-bold uppercase tracking-wider cursor-pointer hover:bg-black/5 dark:hover:bg-white/5" onClick={() => handleSort("outDegreeCentrality")}>
                      Out Deg Cent {sortConfig?.key === "outDegreeCentrality" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                    </th>
                  )}
                </>
              ) : (
                <>
                  {hasDegree && (
                    <th className="p-3 font-bold uppercase tracking-wider cursor-pointer hover:bg-black/5 dark:hover:bg-white/5" onClick={() => handleSort("degree")}>
                      Degree {sortConfig?.key === "degree" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                    </th>
                  )}
                  {hasDegreeCent && (
                    <th className="p-3 font-bold uppercase tracking-wider cursor-pointer hover:bg-black/5 dark:hover:bg-white/5" onClick={() => handleSort("degreeCentrality")}>
                      Degree Cent {sortConfig?.key === "degreeCentrality" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                    </th>
                  )}
                </>
              )}
              {hasEigenvectorCent && (
                <th className="p-3 font-bold uppercase tracking-wider cursor-pointer hover:bg-black/5 dark:hover:bg-white/5" onClick={() => handleSort("eigenvector")}>
                  Eigenvector {sortConfig?.key === "eigenvector" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                </th>
              )}
              {hasPagerankCent && (
                <th className="p-3 font-bold uppercase tracking-wider cursor-pointer hover:bg-black/5 dark:hover:bg-white/5" onClick={() => handleSort("pagerank")}>
                  PageRank {sortConfig?.key === "pagerank" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                </th>
              )}
              <th className="p-3 font-bold uppercase tracking-wider cursor-pointer hover:bg-black/5 dark:hover:bg-white/5" onClick={() => handleSort("community")}>
                Community {sortConfig?.key === "community" && (sortConfig.direction === "asc" ? "↑" : "↓")}
              </th>
              {hasLouvain && (
                <th className="p-3 font-bold uppercase tracking-wider cursor-pointer hover:bg-black/5 dark:hover:bg-white/5" onClick={() => handleSort("louvain")}>
                  Louvain {sortConfig?.key === "louvain" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                </th>
              )}
              {hasDeltaQ && (
                <th className="p-3 font-bold uppercase tracking-wider cursor-pointer hover:bg-black/5 dark:hover:bg-white/5" onClick={() => handleSort("deltaQ")}>
                  ΔQ Contribution {sortConfig?.key === "deltaQ" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {tableData.map((node, idx) => {
              const isSelected = selectedElement === node.id;
              const dispIdx = displayMap[node.id] ?? -1;
              const commColor = getDistinctColor(dispIdx);

              return (
                <tr 
                  id={`row-${node.id}`}
                  key={idx} 
                  className={`border-t transition-colors cursor-pointer ${
                    isDarkMode ? 'border-[#333]' : 'border-[#ccc]'
                  } ${
                    isSelected ? (isDarkMode ? 'bg-[#b4ff39]/20 font-semibold' : 'bg-[#b4ff39]/40 font-semibold') : (isDarkMode ? 'hover:bg-[#333]' : 'hover:bg-[#f9f9f9]')
                  }`}
                  onClick={() => setSelectedElement(node.id)}
                  onDoubleClick={() => handleElementDoubleClick(node.id, "node")}
                >
                  <td className="p-2 font-mono break-all">{node.id}</td>
                  <td className="p-2 break-all">{node.label || node.name || "-"}</td>
                  <td className="p-2 font-mono">{node.abundance || 0}</td>
                  {directed ? (
                    <>
                      {hasInDegree && <td className="p-2 font-mono">{node.net.inDegree ?? 0}</td>}
                      {hasOutDegree && <td className="p-2 font-mono">{node.net.outDegree ?? 0}</td>}
                      {hasInDegreeCent && <td className="p-2 font-mono">{node.net.inDegreeCentrality || 0}</td>}
                      {hasOutDegreeCent && <td className="p-2 font-mono">{node.net.outDegreeCentrality || 0}</td>}
                    </>
                  ) : (
                    <>
                      {hasDegree && <td className="p-2 font-mono">{node.net.degree ?? 0}</td>}
                      {hasDegreeCent && <td className="p-2 font-mono">{node.net.degreeCentrality || 0}</td>}
                    </>
                  )}
                  {hasEigenvectorCent && <td className="p-2 font-mono">{node.net.eigenvector || 0}</td>}
                  {hasPagerankCent && <td className="p-2 font-mono">{node.net.pagerank || 0}</td>}
                  <td className="p-2">
                    {dispIdx >= 0 ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white shadow-xs" style={{ backgroundColor: commColor }}>
                        {dispIdx}
                      </span>
                    ) : "-"}
                  </td>
                  {hasLouvain && <td className="p-2 font-mono">{node.net.louvain || "-"}</td>}
                  {hasDeltaQ && <td className="p-2 font-mono">{node.mod.deltaQ}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {dataTab === "edges" && (
        <table className={`w-full text-left text-xs border-collapse ${isDarkMode ? "text-[#ddd]" : "text-[#333]"}`}>
          <thead className={`sticky top-0 shadow-sm z-10 ${isDarkMode ? "bg-[#222] border-b border-[#444]" : "bg-[#f0f0f0] border-b border-[#ccc]"}`}>
            <tr>
              <th className="p-3 font-bold uppercase tracking-wider cursor-pointer hover:bg-black/5 dark:hover:bg-white/5" onClick={() => handleSort("source")}>
                Source {sortConfig?.key === "source" && (sortConfig.direction === "asc" ? "↑" : "↓")}
              </th>
              <th className="p-3 font-bold uppercase tracking-wider cursor-pointer hover:bg-black/5 dark:hover:bg-white/5" onClick={() => handleSort("target")}>
                Target {sortConfig?.key === "target" && (sortConfig.direction === "asc" ? "↑" : "↓")}
              </th>
              <th className="p-3 font-bold uppercase tracking-wider cursor-pointer hover:bg-black/5 dark:hover:bg-white/5" onClick={() => handleSort("weight_raw")}>
                Primary Weight {sortConfig?.key === "weight_raw" && (sortConfig.direction === "asc" ? "↑" : "↓")}
              </th>
              <th className="p-3 font-bold uppercase tracking-wider cursor-pointer hover:bg-black/5 dark:hover:bg-white/5" onClick={() => handleSort("weight_secondary")}>
                Secondary Weight {sortConfig?.key === "weight_secondary" && (sortConfig.direction === "asc" ? "↑" : "↓")}
              </th>
            </tr>
          </thead>
          <tbody>
            {tableDataEdges.map((edge, idx) => {
              const edgeId = `${edge.source}-${edge.target}`;
              const isSelected = selectedElement === edgeId || selectedElement === `${edge.target}-${edge.source}`;
              return (
                <tr 
                  id={`row-${edgeId}`}
                  key={idx} 
                  className={`border-t transition-colors cursor-pointer ${
                    isDarkMode ? 'border-[#333]' : 'border-[#ccc]'
                  } ${
                    isSelected ? (isDarkMode ? 'bg-[#b4ff39]/20 font-semibold' : 'bg-[#b4ff39]/40 font-semibold') : (isDarkMode ? 'hover:bg-[#333]' : 'hover:bg-[#f9f9f9]')
                  }`}
                  onClick={() => setSelectedElement(edgeId)}
                  onDoubleClick={() => handleElementDoubleClick(edgeId, "edge", {
                    source: edge.source,
                    target: edge.target,
                  })}
                >
                  <td className="p-2 font-mono break-all">{edge.source}</td>
                  <td className="p-2 font-mono break-all">{edge.target}</td>
                  <td className="p-2 font-mono">{edge.weight_raw || 0}</td>
                  <td className="p-2 font-mono">{edge.weight_secondary || 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
};
