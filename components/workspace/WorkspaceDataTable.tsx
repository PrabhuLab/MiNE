import React from 'react';
import { getCommunityColor } from '@/lib/communityUtils';
import { useStore } from '@/store/useStore';

interface WorkspaceDataTableProps {
  dataTab: 'nodes' | 'edges';
  tableData: any[];
  tableDataEdges: any[];
  networkMetrics: any[];
  handleSort: (key: string) => void;
  sortConfig: { key: string; direction: "asc" | "desc" } | null;
  handleElementDoubleClick: (id: string, type: "node" | "edge") => void;
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
  const { isDarkMode, directed, selectedElement } = useStore();
  const { communityMap } = useStore();
  const allCommunityLabels = React.useMemo(() => Array.from(new Set(Object.values(communityMap))) as string[], [communityMap]);

  const hasInDegree = networkMetrics.some(m => m.inDegree !== undefined) || (directed && tableData.length > 0);
  const hasOutDegree = networkMetrics.some(m => m.outDegree !== undefined) || (directed && tableData.length > 0);
  const hasDegree = networkMetrics.some(m => m.degree !== undefined) || (!directed && tableData.length > 0);
  const hasInDegreeCent = networkMetrics.some(m => m.inDegreeCentrality !== undefined);
  const hasOutDegreeCent = networkMetrics.some(m => m.outDegreeCentrality !== undefined);
  const hasDegreeCent = networkMetrics.some(m => m.degreeCentrality !== undefined);
  const hasBetweennessCent = networkMetrics.some(m => m.betweenness !== undefined);
  const hasClosenessCent = networkMetrics.some(m => m.closeness !== undefined);
  const hasClusteringCoeff = networkMetrics.some(m => m.clustering !== undefined);
  const hasEigenvectorCent = networkMetrics.some(m => m.eigenvector !== undefined);
  const hasPagerankCent = networkMetrics.some(m => m.pagerank !== undefined);
  const hasLouvain = networkMetrics.some(m => m.louvain !== undefined);

  const hasBipartitePartition = networkMetrics.some(m => m.bipartitePartition !== undefined);
  const hasBipartiteNormDeg = networkMetrics.some(m => m.bipartiteNormDegree !== undefined);
  const hasBipartiteClustering = networkMetrics.some(m => m.bipartiteClustering !== undefined);
  const hasBipartiteRedundancy = networkMetrics.some(m => m.bipartiteRedundancy !== undefined);
  const hasBipartiteProjDeg = networkMetrics.some(m => m.bipartiteProjectionDegree !== undefined);

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
              {hasBipartitePartition && (
                <th className="p-3 font-bold uppercase tracking-wider cursor-pointer hover:bg-black/5 dark:hover:bg-white/5" onClick={() => handleSort("bipartitePartition")}>
                  Partition {sortConfig?.key === "bipartitePartition" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                </th>
              )}
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
              {hasBipartiteNormDeg && (
                <th className="p-3 font-bold uppercase tracking-wider cursor-pointer hover:bg-black/5 dark:hover:bg-white/5" onClick={() => handleSort("bipartiteNormDegree")}>
                  Bip. Norm Deg {sortConfig?.key === "bipartiteNormDegree" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                </th>
              )}
              {hasBetweennessCent && (
                <th className="p-3 font-bold uppercase tracking-wider cursor-pointer hover:bg-black/5 dark:hover:bg-white/5" onClick={() => handleSort("betweenness")}>
                  Betweenness {sortConfig?.key === "betweenness" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                </th>
              )}
              {hasClosenessCent && (
                <th className="p-3 font-bold uppercase tracking-wider cursor-pointer hover:bg-black/5 dark:hover:bg-white/5" onClick={() => handleSort("closeness")}>
                  Closeness {sortConfig?.key === "closeness" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                </th>
              )}
              {hasClusteringCoeff && (
                <th className="p-3 font-bold uppercase tracking-wider cursor-pointer hover:bg-black/5 dark:hover:bg-white/5" onClick={() => handleSort("clustering")}>
                  Clustering {sortConfig?.key === "clustering" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                </th>
              )}
              {hasBipartiteClustering && (
                <th className="p-3 font-bold uppercase tracking-wider cursor-pointer hover:bg-black/5 dark:hover:bg-white/5" onClick={() => handleSort("bipartiteClustering")}>
                  Bip. C4 Clustering {sortConfig?.key === "bipartiteClustering" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                </th>
              )}
              {hasBipartiteRedundancy && (
                <th className="p-3 font-bold uppercase tracking-wider cursor-pointer hover:bg-black/5 dark:hover:bg-white/5" onClick={() => handleSort("bipartiteRedundancy")}>
                  Bip. Redundancy {sortConfig?.key === "bipartiteRedundancy" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                </th>
              )}
              {hasBipartiteProjDeg && (
                <th className="p-3 font-bold uppercase tracking-wider cursor-pointer hover:bg-black/5 dark:hover:bg-white/5" onClick={() => handleSort("bipartiteProjectionDegree")}>
                  Proj. Degree {sortConfig?.key === "bipartiteProjectionDegree" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                </th>
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
              <th className="p-3 font-bold uppercase tracking-wider cursor-pointer hover:bg-black/5 dark:hover:bg-white/5" onClick={() => handleSort("deltaQ")}>
                Mod. Contribution {sortConfig?.key === "deltaQ" && (sortConfig.direction === "asc" ? "↑" : "↓")}
              </th>
            </tr>
          </thead>
          <tbody>
            {tableData.map((node, idx) => {
              const isSelected = selectedElement === node.id;
              return (
                <tr 
                  id={`row-${node.id}`}
                  key={idx} 
                  className={`border-t transition-colors cursor-pointer ${
                    isDarkMode ? 'border-[#333]' : 'border-[#ccc]'
                  } ${
                    isSelected ? (isDarkMode ? 'bg-[#b4ff39]/20' : 'bg-[#b4ff39]/40') : (isDarkMode ? 'hover:bg-[#333]' : 'hover:bg-[#f9f9f9]')
                  }`}
                  onDoubleClick={() => handleElementDoubleClick(node.id, "node")}
                >
                  <td className="p-2 font-mono break-all">{node.id}</td>
                  <td className="p-2 break-all">{node.label || node.name || "-"}</td>
                  <td className="p-2 font-mono">{node.abundance || 0}</td>
                  {hasBipartitePartition && <td className="p-2 font-mono">{node.net.bipartitePartition || "-"}</td>}
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
                  {hasBipartiteNormDeg && <td className="p-2 font-mono">{node.net.bipartiteNormDegree || 0}</td>}
                  {hasBetweennessCent && <td className="p-2 font-mono">{node.net.betweenness || 0}</td>}
                  {hasClosenessCent && <td className="p-2 font-mono">{node.net.closeness || 0}</td>}
                  {hasClusteringCoeff && <td className="p-2 font-mono">{node.net.clustering || 0}</td>}
                  {hasBipartiteClustering && <td className="p-2 font-mono">{node.net.bipartiteClustering || 0}</td>}
                  {hasBipartiteRedundancy && <td className="p-2 font-mono">{node.net.bipartiteRedundancy || 0}</td>}
                  {hasBipartiteProjDeg && <td className="p-2 font-mono">{node.net.bipartiteProjectionDegree || 0}</td>}
                  {hasEigenvectorCent && <td className="p-2 font-mono">{node.net.eigenvector || 0}</td>}
                  {hasPagerankCent && <td className="p-2 font-mono">{node.net.pagerank || 0}</td>}
                  <td className="p-2">
                    {node.comm ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold text-[#141414]" style={{ backgroundColor: getCommunityColor(node.comm, allCommunityLabels) }}>
                        {node.comm}
                      </span>
                    ) : "-"}
                  </td>
                  {hasLouvain && <td className="p-2 font-mono">{node.net.louvain || "-"}</td>}
                  <td className="p-2 font-mono">{node.mod.deltaQ || 0}</td>
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
                    isSelected ? (isDarkMode ? 'bg-[#b4ff39]/20' : 'bg-[#b4ff39]/40') : (isDarkMode ? 'hover:bg-[#333]' : 'hover:bg-[#f9f9f9]')
                  }`}
                  onDoubleClick={() => handleElementDoubleClick(edgeId, "edge")}
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
