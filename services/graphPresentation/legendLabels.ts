/** null means no legend hover; otherwise only members may display labels. */
export function hoveredLegendLabelVisible(
  hoveredId: string | null,
  nodeId: string,
  displayIndex: number,
  nodeType: unknown,
  secondary: boolean,
  membership: Map<string, Set<string>>,
): boolean | null {
  if (!hoveredId) return null;
  if (hoveredId.startsWith('community:')) return String(displayIndex) === hoveredId.slice('community:'.length);
  if (hoveredId.startsWith('type:')) return String(nodeType) === hoveredId.slice('type:'.length);
  if (hoveredId === 'element:standard') return !secondary;
  if (hoveredId === 'element:bipartite') return secondary;
  return membership.get(hoveredId)?.has(nodeId) ?? false;
}
