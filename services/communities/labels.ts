/** Keep model block numbers local to each bipartite node type in displayed results. */
export function communityMembershipLabels(
  nodeIds: string[], membership: number[], algorithm: string,
  partitions?: Array<string | number>, provenance: Record<string, unknown> = {},
): Record<string, string> {
  if (nodeIds.length !== membership.length) throw new Error('Community response did not include aligned memberships.');
  if (algorithm !== 'lbm') {
    return Object.fromEntries(nodeIds.map((id, index) => [id, `Community ${membership[index] + 1}`]));
  }
  if (!partitions || partitions.length !== nodeIds.length) throw new Error('Sparse LBM response is missing aligned node partitions.');
  const partitionNames = [...new Set(partitions.map(String))].sort();
  if (partitionNames.length !== 2) throw new Error('Sparse LBM response requires two node partitions.');
  const rowPartition = typeof provenance.rowPartition === 'string' ? provenance.rowPartition : partitionNames[0];
  const columnPartition = typeof provenance.columnPartition === 'string' ? provenance.columnPartition : partitionNames[1];
  const labelsByType = [rowPartition, columnPartition].map((partition) =>
    [...new Set(membership.filter((_, index) => String(partitions[index]) === partition))].sort((a, b) => a - b));
  return Object.fromEntries(nodeIds.map((id, index) => {
    const type = String(partitions[index]) === rowPartition ? 0 : 1;
    return [id, `Node Type ${type + 1} Community ${labelsByType[type].indexOf(membership[index]) + 1}`];
  }));
}
