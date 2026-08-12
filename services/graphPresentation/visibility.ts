export function isSecondaryNode(node: any, isBipartite: boolean): boolean {
  if (!isBipartite || !node) return false;
  if (node.partitionIndex !== undefined && node.partitionIndex !== null) {
    return Number(node.partitionIndex) === 1;
  }
  const type = String(node.type || '').toUpperCase();
  const group = String(node.group || '').toUpperCase();
  const bipartite = String(node.bipartite || '').toUpperCase();
  const set = String(node.set || '').toUpperCase();
  const partition = String(node.partition || '').toUpperCase();
  return partition === '1' || partition === 'B' || partition === 'SECONDARY'
    || type === 'B' || type === 'SECONDARY'
    || group === '1' || group === 'B'
    || bipartite === '1' || bipartite === 'B' || bipartite === 'SECONDARY'
    || set === '1' || set === 'B';
}
