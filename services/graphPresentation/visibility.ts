export function explicitPartitionRole(value: unknown): boolean | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
    return null;
  }
  const normalized = String(value).trim().toUpperCase();
  if (['1', 'B', 'SECONDARY', 'RIGHT', 'TARGET', 'TRUE'].includes(normalized)) return true;
  if (['0', 'A', 'PRIMARY', 'LEFT', 'SOURCE', 'FALSE'].includes(normalized)) return false;
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
    if (Number(node.partitionIndex) === 1) return true;
    if (Number(node.partitionIndex) === 0) return false;
  }
  if (node.type !== undefined && node.type !== null && typeof node.type === 'string') {
    const normType = node.type.trim().toUpperCase();
    if (['B', 'SECONDARY', 'RIGHT', 'TARGET'].includes(normType)) return true;
    if (['A', 'PRIMARY', 'LEFT', 'SOURCE'].includes(normType)) return false;
  }
  return false;
}
