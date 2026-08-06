export function normalize_communities(communities: Record<string, number>): Record<string, number> {
  const countMap: Record<number, number> = {};
  for (const node in communities) {
    const commId = communities[node];
    if (commId !== -1 && commId !== undefined && commId !== null && Number.isFinite(commId)) {
      countMap[commId] = (countMap[commId] || 0) + 1;
    }
  }

  const sortedCommunityIds = Object.keys(countMap)
    .map(Number)
    .sort((a, b) => {
      const sizeDiff = countMap[b] - countMap[a];
      if (sizeDiff !== 0) return sizeDiff;
      return a - b;
    });

  const idToNormalizedIndexMap = new Map<number, number>();
  sortedCommunityIds.forEach((origId, index) => {
    idToNormalizedIndexMap.set(origId, index);
  });

  const normalizedCommunities: Record<string, number> = {};
  for (const node in communities) {
    const origId = communities[node];
    if (origId === -1 || origId === undefined || origId === null || !Number.isFinite(origId)) {
      normalizedCommunities[node] = -1;
    } else {
      normalizedCommunities[node] = idToNormalizedIndexMap.get(origId) ?? origId;
    }
  }

  return normalizedCommunities;
}

export const COMMUNITY_COLORS = [
  "#ff7f0e",
  "#d62728",
  "#2ca02c",  
  "#1f77b4",
  "#8c564b",
  "#e377c2",
  "#9467bd",
  "#bcbd22",
  "#17becf",
  "#f4a261",
  "#e63946",
  "#a8dadc",
  "#1d3557",
  "#457b9d",
  "#7f7f7f"
];

export function getCommunityColor(community: string | number, allCommunities: string[]): string {
  const index = allCommunities.indexOf(String(community));
  if (index === -1) return COMMUNITY_COLORS[0];
  if (index < COMMUNITY_COLORS.length) {
    return COMMUNITY_COLORS[index];
  }
  const hue = (index * 137.508) % 360;
  const sat = 70 + (index % 3) * 10;
  const light = 45 + (index % 4) * 8;
  return `hsl(${hue.toFixed(1)}, ${sat}%, ${light}%)`;
}
