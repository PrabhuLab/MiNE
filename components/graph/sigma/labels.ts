export function shouldRenderSigmaLabels(
  showNodeLabels: boolean,
  selectedElement: string | null,
  clickedNode: unknown,
  searchQuery: string,
  hoveredLegendId: string | null = null,
): boolean {
  return Boolean(hoveredLegendId || showNodeLabels || selectedElement || clickedNode || searchQuery.trim());
}
