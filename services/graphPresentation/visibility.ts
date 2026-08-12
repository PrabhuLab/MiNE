function explicitPartitionRole(value: unknown): boolean | null {
  if (value === undefined || value === null || value === '') return null;
  const normalized = String(value).trim().toUpperCase();
  if (['1', 'B', 'SECONDARY', 'RIGHT', 'TARGET'].includes(normalized)) return true;
  if (['0', 'A', 'PRIMARY', 'LEFT', 'SOURCE'].includes(normalized)) return false;
  return null;
}

export function orderPartitionValues(values: Iterable<unknown>): string[] {
  return Array.from(new Set(Array.from(values, (value) => String(value)))).sort((left, right) => {
    const leftRole = explicitPartitionRole(left);
    const rightRole = explicitPartitionRole(right);
    if (leftRole !== null && rightRole !== null && leftRole !== rightRole) return leftRole ? 1 : -1;
    if (leftRole === false || rightRole === true) return -1;
    if (leftRole === true || rightRole === false) return 1;
    return left.localeCompare(right, undefined, { numeric: true });
  });
}

export function isSecondaryNode(node: any, isBipartite: boolean): boolean {
  if (!isBipartite || !node) return false;
  // Explicit partition semantics must win over an index assigned from input
  // order. Incidence matrices often list partition B before partition A.
  for (const value of [node.partition, node.bipartite, node.set]) {
    const role = explicitPartitionRole(value);
    if (role !== null) return role;
  }
  if (node.partitionIndex !== undefined && node.partitionIndex !== null) {
    return Number(node.partitionIndex) === 1;
  }
  for (const value of [node.type, node.group]) {
    const role = explicitPartitionRole(value);
    if (role !== null) return role;
  }
  return false;
}
