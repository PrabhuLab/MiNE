interface RevisionNode { id: unknown }
interface RevisionEdge { source: unknown; target: unknown; weight_raw?: unknown; weight_secondary?: unknown; weight?: unknown; key?: unknown; [key: string]: unknown }

export interface GraphRevisions {
  graphRevision: string;
  nodeOrderHash: string;
  edgeOrderHash: string;
  nodeCount: number;
  edgeCount: number;
}

// Two independent 32-bit FNV-1a streams avoid allocating a graph-sized
// serialization while retaining a compact, stable 64-bit ordering token.
class IncrementalHash {
  private first = 0x811c9dc5;
  private second = 0x9e3779b9;

  add(value: unknown): void {
    const text = value === null ? '<null>' : value === undefined ? '<undefined>' : String(value);
    for (let index = 0; index < text.length; index += 1) {
      const code = text.charCodeAt(index);
      this.first ^= code;
      this.first = Math.imul(this.first, 0x01000193);
      this.second ^= code + index;
      this.second = Math.imul(this.second, 0x85ebca6b);
    }
    this.first ^= 0xff;
    this.first = Math.imul(this.first, 0x01000193);
    this.second ^= 0x9d;
    this.second = Math.imul(this.second, 0xc2b2ae35);
  }

  digest(): string {
    return `${(this.first >>> 0).toString(36)}${(this.second >>> 0).toString(36)}`;
  }
}

export function computeGraphRevisions(
  nodes: readonly RevisionNode[],
  edges: readonly RevisionEdge[],
  directed: boolean,
  includeWeights = true,
  weightAttribute = 'weight_raw',
): GraphRevisions {
  const nodeHash = new IncrementalHash();
  const edgeHash = new IncrementalHash();
  const topologyHash = new IncrementalHash();
  topologyHash.add(directed ? 'directed' : 'undirected');
  topologyHash.add(nodes.length);
  topologyHash.add(edges.length);
  if (includeWeights) topologyHash.add(weightAttribute);

  for (const node of nodes) {
    nodeHash.add(node.id);
    topologyHash.add(node.id);
  }
  for (const edge of edges) {
    edgeHash.add(edge.key ?? '');
    edgeHash.add(edge.source);
    edgeHash.add(edge.target);
    topologyHash.add(edge.source);
    topologyHash.add(edge.target);
    if (includeWeights) {
      const weight = edge[weightAttribute] ?? edge.weight_raw ?? edge.weight ?? 1;
      edgeHash.add(weight);
      topologyHash.add(weight);
    }
  }

  return {
    graphRevision: `${nodes.length}:${edges.length}:${topologyHash.digest()}`,
    nodeOrderHash: nodeHash.digest(),
    edgeOrderHash: edgeHash.digest(),
    nodeCount: nodes.length,
    edgeCount: edges.length,
  };
}
