export function shouldRenderSigmaLabels(
  showNodeLabels: boolean,
  selectedElement: string | null,
  clickedNode: unknown,
  searchQuery: string,
): boolean {
  return Boolean(showNodeLabels || selectedElement || clickedNode || searchQuery.trim());
}
