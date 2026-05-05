export function normalize_communities(communities: Record<string, number>): Record<string, number> {
  let mappedCommunities = { ...communities };

  // Identify groups used by small clusters (2-10)
  let usedNumbers = new Set(
    Object.values(communities).filter((v) => v >= 2 && v <= 10)
  );

  // Identify groups used by large clusters (>10)
  let largeValues = [
    ...new Set(Object.values(communities).filter((v) => v > 10))
  ].sort((a, b) => a - b);

  // Find available numbers in the 2-10 range
  let availableNumbers = new Set(
    Array.from({ length: 9 }, (_, i) => i + 2).filter((i) => !usedNumbers.has(i))
  );

  // Map large group IDs to available small IDs
  let mapping: Record<number, number> = {};
  for (let value of largeValues) {
    if (availableNumbers.size === 0) break;
    let minAvailable = Array.from(availableNumbers)[0];
    mapping[value] = minAvailable;
    availableNumbers.delete(minAvailable);
  }

  // Apply mapping
  for (let key in communities) {
    if (communities[key] > 10) {
      mappedCommunities[key] = mapping[communities[key]] ?? communities[key];
    }
  }

  // Recalculate frequencies to sort by size
  let countMap: Record<number, number> = {};
  for (let value of Object.values(mappedCommunities)) {
    if (value !== -1) {
      countMap[value] = (countMap[value] || 0) + 1;
    }
  }

  // Sort groups by abundance
  let sortedGroups = Object.entries(countMap).sort((a, b) => b[1] - a[1]);

  // Create final mapping (Top groups get indices 0-10)
  let finalMapping: Record<number, number> = {};
  sortedGroups.forEach(([originalValue, count], index) => {
    if (index <= 10) {
      finalMapping[Number(originalValue)] = index;
    }
  });

  // Apply final mapping
  for (let key in mappedCommunities) {
    if (mappedCommunities[key] !== -1) {
      mappedCommunities[key] = finalMapping[mappedCommunities[key]] ?? mappedCommunities[key];
    }
  }

  return mappedCommunities;
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
