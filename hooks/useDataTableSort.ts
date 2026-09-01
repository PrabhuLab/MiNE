import { useMemo, useState } from 'react';
import { computeTableDataEdges, computeTableDataNodes } from '@/lib/workspaceUtils';
import { useStore } from '@/store/useStore';
import { isSecondaryNode } from '@/services/graphPresentation/visibility';
import { computeGraphLegendVisibility } from '@/services/graphPresentation/legendVisibility';

export function useDataTableSort(
  validNodes: any[],
  validEdges: any[],
  networkMetrics: any[],
  nodeMetrics: any[],
  edgeMetrics: any[] = [],
  legendNodeMembership: Map<string, Set<string>> = new Map(),
  legendEdgeMembership: Map<string, Set<string>> = new Map(),
) {
  const { communityMap, searchQuery, setSearchQuery, hiddenLegendItems, isolatedLegendItem, isolatedCommunityId, bipartite } = useStore();
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const visibility = useMemo(() => {
    return computeGraphLegendVisibility({
      nodes: validNodes,
      edges: validEdges.map((edge) => ({ id: String(edge.key ?? `${edge.source}->${edge.target}`), source: String(edge.source), target: String(edge.target) })),
      bipartite,
      isSecondaryNode: (node) => isSecondaryNode(node, bipartite),
      displayMap: {},
      hiddenItemIds: hiddenLegendItems,
      isolatedItemId: isolatedLegendItem || isolatedCommunityId,
      nodeMembership: legendNodeMembership,
      edgeMembership: legendEdgeMembership,
    });
  }, [bipartite, hiddenLegendItems, isolatedCommunityId, isolatedLegendItem, legendEdgeMembership, legendNodeMembership, validEdges, validNodes]);

  const filteredNodes = useMemo(() => validNodes.filter((node) => visibility.isNodeVisible(node.id)), [validNodes, visibility]);
  const filteredEdges = useMemo(() => validEdges.filter((edge) => visibility.isEdgeVisible(String(edge.key ?? `${edge.source}->${edge.target}`))), [validEdges, visibility]);

  const tableData = useMemo(
    () => computeTableDataNodes(filteredNodes, networkMetrics, nodeMetrics, communityMap, searchQuery, sortConfig),
    [communityMap, filteredNodes, networkMetrics, nodeMetrics, searchQuery, sortConfig],
  );
  const tableDataEdges = useMemo(
    () => computeTableDataEdges(filteredEdges, edgeMetrics, searchQuery, sortConfig),
    [edgeMetrics, filteredEdges, searchQuery, sortConfig],
  );

  return { searchQuery, setSearchQuery, sortConfig, setSortConfig, tableData, tableDataEdges, visibility };
}
