import Graph from 'graphology';
import seedrandomPkg from 'seedrandom';
import { normalize_communities } from '@/lib/communityUtils';

const seedrandom = (typeof seedrandomPkg === 'function') ? seedrandomPkg : (seedrandomPkg as any).default || seedrandomPkg;

export interface BipartitePartitions {
  setA: Set<string>;
  setB: Set<string>;
  partitionMap: Map<string, 'A' | 'B'>;
}

export interface BipartiteMetricsResult {
  bipartitePartition: 'Set A' | 'Set B';
  bipartiteNormDegree: string;
  bipartiteClustering: string;
  bipartiteRedundancy: string;
  bipartiteProjectionDegree: number;
}

export interface BipartiteLouvainResult {
  communities: Record<string, string>;
  modularity: number;
}

/**
 * Identifies or infers the bipartite partition (Set A / Set B) for nodes in a graph.
 */
export function getBipartitePartitions(graph: Graph): BipartitePartitions {
  const setA = new Set<string>();
  const setB = new Set<string>();
  const partitionMap = new Map<string, 'A' | 'B'>();

  graph.forEachNode((node, attrs) => {
    if (attrs.type === 'B' || attrs.group === 1) {
      setB.add(node);
      partitionMap.set(node, 'B');
    } else if (attrs.type === 'A' || attrs.group === 0) {
      setA.add(node);
      partitionMap.set(node, 'A');
    }
  });

  // If some nodes are unassigned, use 2-coloring / BFS graph traversal
  graph.forEachNode((node) => {
    if (partitionMap.has(node)) return;

    const queue: string[] = [node];
    partitionMap.set(node, 'A');
    setA.add(node);

    while (queue.length > 0) {
      const curr = queue.shift()!;
      const currPart = partitionMap.get(curr)!;
      const nextPart: 'A' | 'B' = currPart === 'A' ? 'B' : 'A';

      graph.forEachNeighbor(curr, (neighbor) => {
        if (!partitionMap.has(neighbor)) {
          partitionMap.set(neighbor, nextPart);
          if (nextPart === 'A') setA.add(neighbor);
          else setB.add(neighbor);
          queue.push(neighbor);
        }
      });
    }
  });

  return { setA, setB, partitionMap };
}

/**
 * Computes Barber's Bipartite Louvain Community Detection algorithm.
 * Optimizes Barber's Bipartite Modularity Q_B = (1/m) * sum_{i in A, j in B} (M_ij - gamma * d_i * d_j / m) * delta(c_i, c_j)
 */
export function computeBipartiteLouvain(
  graph: Graph,
  options?: { resolution?: number; seed?: number }
): BipartiteLouvainResult {
  const resolution = options?.resolution ?? 1.0;
  const rng = seedrandom(String(options?.seed ?? 42));

  const partitions = getBipartitePartitions(graph);
  const nodes = graph.nodes();
  if (nodes.length === 0) return { communities: {}, modularity: 0 };

  let totalWeight = 0;
  const nodeDegrees = new Map<string, number>();

  graph.forEachNode((node) => {
    let deg = 0;
    graph.forEachEdge(node, (_, attrs) => {
      deg += attrs.weight || 1;
    });
    nodeDegrees.set(node, deg);
  });

  graph.forEachEdge((_, attrs) => {
    totalWeight += attrs.weight || 1;
  });

  if (totalWeight === 0) {
    const defaultComm: Record<string, string> = {};
    nodes.forEach((n, idx) => { defaultComm[n] = `Cluster ${idx + 1}`; });
    return { communities: defaultComm, modularity: 0 };
  }

  // Initial community assignments: each node in its own community
  const communityAssignment = new Map<string, number>();
  nodes.forEach((node, i) => communityAssignment.set(node, i));

  // Community total degree trackers by partition
  const commDegreeA = new Map<number, number>();
  const commDegreeB = new Map<number, number>();

  nodes.forEach((node) => {
    const comm = communityAssignment.get(node)!;
    const deg = nodeDegrees.get(node) || 0;
    const isSetA = partitions.partitionMap.get(node) === 'A';
    if (isSetA) {
      commDegreeA.set(comm, (commDegreeA.get(comm) || 0) + deg);
    } else {
      commDegreeB.set(comm, (commDegreeB.get(comm) || 0) + deg);
    }
  });

  // Local moves pass
  let improvement = true;
  let passCount = 0;
  const maxPasses = 20;

  const shuffledNodes = [...nodes];

  while (improvement && passCount < maxPasses) {
    improvement = false;
    passCount++;

    for (let i = shuffledNodes.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffledNodes[i], shuffledNodes[j]] = [shuffledNodes[j], shuffledNodes[i]];
    }

    for (const node of shuffledNodes) {
      const currentComm = communityAssignment.get(node)!;
      const nodeDeg = nodeDegrees.get(node) || 0;
      const isSetA = partitions.partitionMap.get(node) === 'A';

      // Find edge weights from node to neighboring communities
      const neighborCommWeights = new Map<number, number>();
      graph.forEachEdge(node, (_, attrs, source, target) => {
        const neighbor = source === node ? target : source;
        const nComm = communityAssignment.get(neighbor)!;
        const w = attrs.weight || 1;
        neighborCommWeights.set(nComm, (neighborCommWeights.get(nComm) || 0) + w);
      });

      // Best community search
      let bestComm = currentComm;
      let maxGain = 0;

      // Degree of opposite partition in current community
      const currentOppositeDegree = isSetA
        ? (commDegreeB.get(currentComm) || 0)
        : (commDegreeA.get(currentComm) || 0);

      const k_node_currComm = neighborCommWeights.get(currentComm) || 0;
      const removeCost = (k_node_currComm / totalWeight) - (resolution * nodeDeg * currentOppositeDegree) / (totalWeight * totalWeight);

      // Evaluate candidate communities
      const candidateComms = new Set<number>([currentComm, ...neighborCommWeights.keys()]);

      candidateComms.forEach((candidate) => {
        if (candidate === currentComm) return;

        const candidateOppositeDegree = isSetA
          ? (commDegreeB.get(candidate) || 0)
          : (commDegreeA.get(candidate) || 0);

        const k_node_cand = neighborCommWeights.get(candidate) || 0;
        const addGain = (k_node_cand / totalWeight) - (resolution * nodeDeg * candidateOppositeDegree) / (totalWeight * totalWeight);

        const deltaQ = addGain - removeCost;
        if (deltaQ > maxGain) {
          maxGain = deltaQ;
          bestComm = candidate;
        }
      });

      if (bestComm !== currentComm && maxGain > 1e-7) {
        improvement = true;
        // Update community degree trackers
        if (isSetA) {
          commDegreeA.set(currentComm, (commDegreeA.get(currentComm) || 0) - nodeDeg);
          commDegreeA.set(bestComm, (commDegreeA.get(bestComm) || 0) + nodeDeg);
        } else {
          commDegreeB.set(currentComm, (commDegreeB.get(currentComm) || 0) - nodeDeg);
          commDegreeB.set(bestComm, (commDegreeB.get(bestComm) || 0) + nodeDeg);
        }
        communityAssignment.set(node, bestComm);
      }
    }
  }

  // Calculate Barber's Bipartite Modularity Q_B
  let modularity = 0;
  graph.forEachEdge((_, attrs, source, target) => {
    const c1 = communityAssignment.get(source);
    const c2 = communityAssignment.get(target);
    if (c1 !== undefined && c1 === c2) {
      const w = attrs.weight || 1;
      const d1 = nodeDegrees.get(source) || 0;
      const d2 = nodeDegrees.get(target) || 0;
      modularity += (w / totalWeight) - (resolution * d1 * d2) / (totalWeight * totalWeight);
    }
  });

  const rawCommMap: Record<string, number> = {};
  communityAssignment.forEach((comm, node) => {
    rawCommMap[node] = comm;
  });

  const normalized = normalize_communities(rawCommMap);
  const finalCommunities: Record<string, string> = {};
  Object.keys(normalized).forEach((node) => {
    finalCommunities[node] = `Cluster ${normalized[node] + 1}`;
  });

  return { communities: finalCommunities, modularity };
}

/**
 * Computes custom bipartite graph metrics:
 * 1. Partition Set A / Set B
 * 2. Normalized Bipartite Degree
 * 3. Square (4-Cycle) Bipartite Clustering Coefficient (Robins-Alexander / Zhang)
 * 4. Bipartite Redundancy Coefficient
 * 5. One-Mode Projection Degree
 */
export function computeBipartiteMetrics(graph: Graph): Record<string, BipartiteMetricsResult> {
  const partitions = getBipartitePartitions(graph);
  const sizeA = Math.max(1, partitions.setA.size);
  const sizeB = Math.max(1, partitions.setB.size);

  const results: Record<string, BipartiteMetricsResult> = {};

  graph.forEachNode((node) => {
    const isSetA = partitions.partitionMap.get(node) === 'A';
    const oppositeSize = isSetA ? sizeB : sizeA;

    const neighbors = graph.neighbors(node);
    const deg = neighbors.length;

    // 1. Normalized degree
    const normDeg = (deg / oppositeSize).toFixed(4);

    // 2. Square (4-cycle) Bipartite Clustering
    let numCycles = 0;
    let maxPossibleCycles = 0;

    for (let i = 0; i < neighbors.length; i++) {
      for (let j = i + 1; j < neighbors.length; j++) {
        const v = neighbors[i];
        const w = neighbors[j];
        const vNeighbors = new Set(graph.neighbors(v));
        const wNeighbors = new Set(graph.neighbors(w));

        let sharedCount = 0;
        vNeighbors.forEach((nbr) => {
          if (nbr !== node && wNeighbors.has(nbr)) {
            sharedCount++;
          }
        });

        numCycles += sharedCount;
        const possible = (vNeighbors.size - 1) + (wNeighbors.size - 1) - sharedCount;
        maxPossibleCycles += Math.max(0, possible);
      }
    }

    const clustering = maxPossibleCycles > 0 ? (numCycles / maxPossibleCycles).toFixed(6) : '0.000000';

    // 3. Bipartite Redundancy
    let redundantCount = 0;
    neighbors.forEach((nbr) => {
      const nbrNbrs = graph.neighbors(nbr);
      const hasOtherShared = nbrNbrs.some((otherNode) => {
        if (otherNode === node) return false;
        const otherNbrs = graph.neighbors(otherNode);
        return otherNbrs.some((target) => target !== nbr && graph.hasEdge(node, target));
      });
      if (hasOtherShared) redundantCount++;
    });

    const redundancy = deg > 0 ? (redundantCount / deg).toFixed(4) : '0.000000';

    // 4. One-mode projection degree
    const projectedNeighbors = new Set<string>();
    neighbors.forEach((nbr) => {
      graph.forEachNeighbor(nbr, (coNbr) => {
        if (coNbr !== node) {
          projectedNeighbors.add(coNbr);
        }
      });
    });

    results[node] = {
      bipartitePartition: isSetA ? 'Set A' : 'Set B',
      bipartiteNormDegree: normDeg,
      bipartiteClustering: clustering,
      bipartiteRedundancy: redundancy,
      bipartiteProjectionDegree: projectedNeighbors.size
    };
  });

  return results;
}
