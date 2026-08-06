import Graph from 'graphology';
import seedrandomPkg from 'seedrandom';
import { normalize_communities } from './communityUtils';

const seedrandom = (typeof seedrandomPkg === 'function') ? seedrandomPkg : (seedrandomPkg as any).default || seedrandomPkg;

/** Small tolerance threshold for floating-point comparisons. */
export const EPSILON = 1e-10;

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

export interface BipartiteLouvainOptions {
  resolution?: number;
  seed?: number;
  maxPasses?: number;
  maxLevels?: number;
  epsilon?: number;
}

export interface BipartiteLouvainResult {
  communities: Record<string, string>;
  modularity: number;
}

interface SuperNode {
  id: string;
  comm: number;
  partition: 'A' | 'B';
}

/**
 * Validates and normalizes convergence and parameter options for bipartite Louvain optimization.
 */
function validateOptions(options?: BipartiteLouvainOptions) {
  const resolution = options?.resolution ?? 1.0;
  if (typeof resolution !== 'number' || !Number.isFinite(resolution) || resolution < 0) {
    throw new Error(`Invalid resolution parameter (${resolution}). Resolution must be a non-negative finite number.`);
  }

  const seed = options?.seed ?? 42;
  if (typeof seed !== 'number' || !Number.isFinite(seed)) {
    throw new Error(`Invalid seed parameter (${seed}). Seed must be a finite number.`);
  }

  const maxPasses = options?.maxPasses ?? 25;
  if (typeof maxPasses !== 'number' || !Number.isInteger(maxPasses) || maxPasses < 1) {
    throw new Error(`Invalid maxPasses parameter (${maxPasses}). maxPasses must be a positive integer.`);
  }

  const maxLevels = options?.maxLevels ?? 15;
  if (typeof maxLevels !== 'number' || !Number.isInteger(maxLevels) || maxLevels < 1) {
    throw new Error(`Invalid maxLevels parameter (${maxLevels}). maxLevels must be a positive integer.`);
  }

  const epsilon = options?.epsilon ?? EPSILON;
  if (typeof epsilon !== 'number' || !Number.isFinite(epsilon) || epsilon <= 0) {
    throw new Error(`Invalid epsilon parameter (${epsilon}). Epsilon must be a positive finite number.`);
  }

  return { resolution, seed, maxPasses, maxLevels, epsilon };
}

/**
 * Identifies or infers the bipartite partition (Set A / Set B) for nodes in a graph.
 *
 * Requirements & Invariants:
 * - Supports undirected graphs only.
 * - Respects explicit node attributes `type` ("A"/"0" or "B"/"1") and `group` (0/"0"/"A" or 1/"1"/"B").
 * - Detects and rejects contradictory partition metadata.
 * - Uses BFS 2-coloring with a pointer head (no array shifts) for unassigned nodes.
 * - Validates edge endpoints across all components and connected nodes.
 * - Validates edge weights (must be non-negative finite numbers). Zero-weight edges are permitted.
 * - Throws descriptive errors containing node or edge identifiers.
 */
export function getBipartitePartitions(graph: Graph): BipartitePartitions {
  if (graph.type === 'directed' || graph.type === 'mixed') {
    throw new Error(`Bipartite algorithms only support undirected graphs. Received graph type: "${graph.type}".`);
  }

  const setA = new Set<string>();
  const setB = new Set<string>();
  const partitionMap = new Map<string, 'A' | 'B'>();

  // 1. Process explicit node metadata
  graph.forEachNode((node, attrs) => {
    let explicitType: 'A' | 'B' | null = null;
    let explicitGroup: 'A' | 'B' | null = null;

    if (attrs.type !== undefined && attrs.type !== null) {
      const typeStr = String(attrs.type).trim().toUpperCase();
      if (typeStr === 'A' || typeStr === '0') explicitType = 'A';
      else if (typeStr === 'B' || typeStr === '1') explicitType = 'B';
      else {
        throw new Error(`Invalid partition type "${attrs.type}" for node "${node}".`);
      }
    }

    if (attrs.group !== undefined && attrs.group !== null) {
      const groupStr = String(attrs.group).trim().toUpperCase();
      if (attrs.group === 0 || groupStr === '0' || groupStr === 'A') explicitGroup = 'A';
      else if (attrs.group === 1 || groupStr === '1' || groupStr === 'B') explicitGroup = 'B';
      else {
        throw new Error(`Invalid partition group "${attrs.group}" for node "${node}".`);
      }
    }

    if (explicitType && explicitGroup && explicitType !== explicitGroup) {
      throw new Error(`Node "${node}" has contradictory partition metadata: type="${attrs.type}", group=${attrs.group}.`);
    }

    const partition = explicitType || explicitGroup;
    if (partition) {
      partitionMap.set(node, partition);
      if (partition === 'A') setA.add(node);
      else setB.add(node);
    }
  });

  // 2. BFS 2-coloring for unassigned nodes with visited tracking to prevent O(V(V+E)) re-traversal
  const visited = new Set<string>();

  graph.forEachNode((startNode) => {
    if (visited.has(startNode)) return;

    if (!partitionMap.has(startNode)) {
      partitionMap.set(startNode, 'A');
      setA.add(startNode);
    }

    const queue: string[] = [startNode];
    let head = 0;
    visited.add(startNode);

    while (head < queue.length) {
      const curr = queue[head++];
      const currPart = partitionMap.get(curr)!;
      const nextPart: 'A' | 'B' = currPart === 'A' ? 'B' : 'A';

      graph.forEachNeighbor(curr, (neighbor) => {
        const neighborPart = partitionMap.get(neighbor);
        if (!neighborPart) {
          partitionMap.set(neighbor, nextPart);
          if (nextPart === 'A') setA.add(neighbor);
          else setB.add(neighbor);
        } else if (neighborPart !== nextPart) {
          throw new Error(`Graph is not bipartite: edge connects node "${curr}" (${currPart}) and node "${neighbor}" (${neighborPart}) in the same partition "${currPart}".`);
        }

        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      });
    }
  });

  // 3. Edge validation pass (validate bipartite condition & edge weights)
  graph.forEachEdge((edge, attrs, source, target) => {
    const weight = attrs.weight ?? 1;
    if (typeof weight !== 'number' || Number.isNaN(weight) || !Number.isFinite(weight) || weight < 0) {
      throw new Error(`Invalid edge weight (${weight}) for edge "${edge}". Edge weight must be a non-negative finite number.`);
    }

    const partSource = partitionMap.get(source);
    const partTarget = partitionMap.get(target);
    if (partSource && partTarget && partSource === partTarget) {
      throw new Error(`Graph is not bipartite: edge "${edge}" connects nodes "${source}" and "${target}" in the same partition "${partSource}".`);
    }
  });

  return { setA, setB, partitionMap };
}

/**
 * Computes Barber's Bipartite Modularity Q_B for a given community assignment:
 * Q_B = sum_c ( e_c / m - resolution * (K_{A,c} * K_{B,c}) / m^2 )
 *
 * where:
 * - m = total graph edge weight
 * - e_c = total edge weight within community c
 * - K_{A,c} = total weighted degree of Set A nodes in community c
 * - K_{B,c} = total weighted degree of Set B nodes in community c
 * - resolution = resolution parameter (gamma)
 */
export function calculateBarberModularity(
  graph: Graph,
  communityAssignment: Map<string, number>,
  partitions: BipartitePartitions,
  resolution: number = 1.0,
  epsilon: number = EPSILON
): number {
  if (typeof resolution !== 'number' || !Number.isFinite(resolution) || resolution < 0) {
    throw new Error(`Invalid resolution parameter (${resolution}).`);
  }
  if (typeof epsilon !== 'number' || !Number.isFinite(epsilon) || epsilon <= 0) {
    throw new Error(`Invalid epsilon parameter (${epsilon}).`);
  }

  let totalWeight = 0;
  const nodeDegrees = new Map<string, number>();

  graph.forEachNode((node) => {
    const partition = partitions.partitionMap.get(node);
    const community = communityAssignment.get(node);

    if (partition !== 'A' && partition !== 'B') {
      throw new Error(`Invalid partition for node "${node}". Partition must be 'A' or 'B'.`);
    }

    if (typeof community !== 'number' || !Number.isFinite(community)) {
      throw new Error(`Invalid community assignment for node "${node}".`);
    }

    if (
      partitions.setA.has(node) !== (partition === 'A') ||
      partitions.setB.has(node) !== (partition === 'B')
    ) {
      throw new Error(`Partition sets disagree with partitionMap for node "${node}".`);
    }

    nodeDegrees.set(node, 0);
  });

  graph.forEachEdge((edge, attrs, source, target) => {
    const w = attrs.weight ?? 1;
    if (typeof w !== 'number' || Number.isNaN(w) || !Number.isFinite(w) || w < 0) {
      throw new Error(`Invalid edge weight (${w}) for edge "${edge}".`);
    }

    const partS = partitions.partitionMap.get(source);
    const partT = partitions.partitionMap.get(target);
    if (partS && partT && partS === partT) {
      throw new Error(`Graph is not bipartite: edge "${edge}" connects nodes in the same partition "${partS}".`);
    }

    totalWeight += w;
    nodeDegrees.set(source, (nodeDegrees.get(source) || 0) + w);
    nodeDegrees.set(target, (nodeDegrees.get(target) || 0) + w);
  });

  if (totalWeight === 0) return 0;

  const e_c = new Map<number, number>();
  const K_Ac = new Map<number, number>();
  const K_Bc = new Map<number, number>();

  graph.forEachNode((node) => {
    const comm = communityAssignment.get(node)!;
    const deg = nodeDegrees.get(node) || 0;
    const isSetA = partitions.partitionMap.get(node) === 'A';
    if (isSetA) {
      K_Ac.set(comm, (K_Ac.get(comm) || 0) + deg);
    } else {
      K_Bc.set(comm, (K_Bc.get(comm) || 0) + deg);
    }
  });

  graph.forEachEdge((_, attrs, source, target) => {
    const c1 = communityAssignment.get(source);
    const c2 = communityAssignment.get(target);
    if (c1 !== undefined && c1 === c2) {
      const w = attrs.weight ?? 1;
      e_c.set(c1, (e_c.get(c1) || 0) + w);
    }
  });

  const allComms = new Set<number>([...K_Ac.keys(), ...K_Bc.keys()]);
  let modularity = 0;

  allComms.forEach((comm) => {
    const ec = e_c.get(comm) || 0;
    const kA = K_Ac.get(comm) || 0;
    const kB = K_Bc.get(comm) || 0;
    modularity += (ec / totalWeight) - (resolution * kA * kB) / (totalWeight * totalWeight);
  });

  if (Math.abs(modularity) < epsilon) {
    modularity = 0;
  }

  return modularity;
}

/**
 * Multilevel Barber's Bipartite Louvain Community Detection algorithm.
 *
 * Architectural details:
 * 1. Phase 1 (Local Moves): Move nodes (or supernodes) between communities using standard remove-and-reinsert
 *    evaluation to maximize Barber's Bipartite Modularity Q_B. Supports creating new singleton communities.
 * 2. Phase 2 (Multilevel Coarsening): Group nodes by (community, partition).
 *    To preserve bipartite structure, Set A and Set B nodes in the same community form distinct supernodes.
 *    Coarse undirected edges are accumulated without double counting.
 * 3. Best Assignment Preservation: Tracks best-known global assignment and modularity. Reverts and stops
 *    if a pass or coarsening level fails to improve modularity by > epsilon.
 */
export function computeBipartiteLouvain(
  graph: Graph,
  options?: BipartiteLouvainOptions
): BipartiteLouvainResult {
  const { resolution, seed, maxPasses, maxLevels, epsilon } = validateOptions(options);
  const rng = seedrandom(String(seed));

  const partitions = getBipartitePartitions(graph);
  const nodes = graph.nodes();
  if (nodes.length === 0) return { communities: {}, modularity: 0 };

  // Calculate total edge weight
  let totalWeight = 0;
  graph.forEachEdge((_, attrs) => {
    totalWeight += attrs.weight ?? 1;
  });

  if (totalWeight === 0) {
    const defaultComm: Record<string, string> = {};
    nodes.forEach((n, idx) => { defaultComm[n] = `Cluster ${idx + 1}`; });
    return { communities: defaultComm, modularity: 0 };
  }

  // Level 0 representation
  let currentLevelNodes: SuperNode[] = nodes.map((node, i) => ({
    id: node,
    comm: i,
    partition: partitions.partitionMap.get(node)!
  }));

  let nextCommId = nodes.length;

  // Track original node -> current supernode ID
  const nodeToSuperNodeMap = new Map<string, string>();
  nodes.forEach((node) => nodeToSuperNodeMap.set(node, node));

  // Adjacency for current level supernodes: Map<u_id, Map<v_id, edgeWeight>>
  let currentAdj = new Map<string, Map<string, number>>();
  currentLevelNodes.forEach((sn) => currentAdj.set(sn.id, new Map<string, number>()));

  graph.forEachEdge((_, attrs, source, target) => {
    const w = attrs.weight ?? 1;
    if (w === 0) return;
    currentAdj.get(source)!.set(target, (currentAdj.get(source)!.get(target) || 0) + w);
    currentAdj.get(target)!.set(source, (currentAdj.get(target)!.get(source) || 0) + w);
  });

  let globalCommunityMap = new Map<string, number>();
  nodes.forEach((node, idx) => globalCommunityMap.set(node, idx));

  let bestModularity = calculateBarberModularity(graph, globalCommunityMap, partitions, resolution, epsilon);
  let bestCommunityMap = new Map(globalCommunityMap);

  let level = 0;

  while (level < maxLevels) {
    level++;

    // Calculate supernode weighted degrees for current level
    const nodeDegrees = new Map<string, number>();
    currentLevelNodes.forEach((sn) => {
      let deg = 0;
      const neighbors = currentAdj.get(sn.id);
      if (neighbors) {
        neighbors.forEach((w) => { deg += w; });
      }
      nodeDegrees.set(sn.id, deg);
    });

    // Initialize community degree trackers
    const commDegreeA = new Map<number, number>();
    const commDegreeB = new Map<number, number>();
    const commAssignment = new Map<string, number>();

    currentLevelNodes.forEach((sn) => {
      commAssignment.set(sn.id, sn.comm);
      const deg = nodeDegrees.get(sn.id) || 0;
      if (sn.partition === 'A') {
        commDegreeA.set(sn.comm, (commDegreeA.get(sn.comm) || 0) + deg);
      } else {
        commDegreeB.set(sn.comm, (commDegreeB.get(sn.comm) || 0) + deg);
      }
    });

    // Phase 1: Local moves pass
    let improvement = true;
    let passCount = 0;
    const levelNodesList = [...currentLevelNodes];

    while (improvement && passCount < maxPasses) {
      improvement = false;
      passCount++;

      // Seeded shuffle
      for (let i = levelNodesList.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [levelNodesList[i], levelNodesList[j]] = [levelNodesList[j], levelNodesList[i]];
      }

      for (const sn of levelNodesList) {
        const currComm = commAssignment.get(sn.id)!;
        const deg = nodeDegrees.get(sn.id) || 0;
        const isSetA = sn.partition === 'A';

        // 1. Calculate weights to neighboring communities
        const neighborCommWeights = new Map<number, number>();
        const neighbors = currentAdj.get(sn.id);
        if (neighbors) {
          neighbors.forEach((w, neighborId) => {
            const nComm = commAssignment.get(neighborId)!;
            neighborCommWeights.set(nComm, (neighborCommWeights.get(nComm) || 0) + w);
          });
        }

        // 2. Temporarily remove node from current community
        const k_node_curr = neighborCommWeights.get(currComm) || 0;
        if (isSetA) {
          commDegreeA.set(currComm, (commDegreeA.get(currComm) || 0) - deg);
        } else {
          commDegreeB.set(currComm, (commDegreeB.get(currComm) || 0) - deg);
        }

        // 3. Evaluate candidate gains
        // Gain from reinserting into candidate community C:
        // deltaQ = (k_{node, C} / m) - resolution * (deg * K_{opposite, C}) / m^2
        const currOppDegAfterRemove = isSetA ? (commDegreeB.get(currComm) || 0) : (commDegreeA.get(currComm) || 0);
        const gainCurrComm = (k_node_curr / totalWeight) - (resolution * deg * currOppDegAfterRemove) / (totalWeight * totalWeight);

        let bestComm = currComm;
        let maxCandidateGain = gainCurrComm;

        // Candidate communities: current community + neighbor communities
        const candidateComms = Array.from(new Set<number>([currComm, ...neighborCommWeights.keys()]));

        candidateComms.forEach((candidate) => {
          if (candidate === currComm) return;

          const candOppDeg = isSetA ? (commDegreeB.get(candidate) || 0) : (commDegreeA.get(candidate) || 0);
          const k_node_cand = neighborCommWeights.get(candidate) || 0;
          const candGain = (k_node_cand / totalWeight) - (resolution * deg * candOppDeg) / (totalWeight * totalWeight);

          if (candGain > maxCandidateGain + epsilon) {
            maxCandidateGain = candGain;
            bestComm = candidate;
          } else if (Math.abs(candGain - maxCandidateGain) <= epsilon) {
            // Deterministic tie-breaking: prefer current community, else lower community ID
            if (bestComm !== currComm) {
              if (candidate === currComm || candidate < bestComm) {
                bestComm = candidate;
                maxCandidateGain = candGain;
              }
            }
          }
        });

        // Evaluate singleton creation option (gain = 0 for empty community)
        const singletonGain = 0;
        let isSingletonSelected = false;
        if (singletonGain > maxCandidateGain + epsilon) {
          maxCandidateGain = singletonGain;
          isSingletonSelected = true;
        }

        // 4. Move node to best candidate or reinsert back into currComm
        if (isSingletonSelected) {
          const freshComm = nextCommId++;
          commAssignment.set(sn.id, freshComm);
          if (isSetA) {
            commDegreeA.set(freshComm, deg);
          } else {
            commDegreeB.set(freshComm, deg);
          }
          improvement = true;
        } else if (bestComm !== currComm && maxCandidateGain - gainCurrComm > epsilon) {
          commAssignment.set(sn.id, bestComm);
          if (isSetA) {
            commDegreeA.set(bestComm, (commDegreeA.get(bestComm) || 0) + deg);
          } else {
            commDegreeB.set(bestComm, (commDegreeB.get(bestComm) || 0) + deg);
          }
          improvement = true;
        } else {
          // Reinsert into currComm
          commAssignment.set(sn.id, currComm);
          if (isSetA) {
            commDegreeA.set(currComm, (commDegreeA.get(currComm) || 0) + deg);
          } else {
            commDegreeB.set(currComm, (commDegreeB.get(currComm) || 0) + deg);
          }
        }
      }
    }

    // Update global node community assignments for evaluation
    const candidateGlobalMap = new Map<string, number>();
    nodes.forEach((node) => {
      const snId = nodeToSuperNodeMap.get(node)!;
      const finalC = commAssignment.get(snId)!;
      candidateGlobalMap.set(node, finalC);
    });

    const newModularity = calculateBarberModularity(graph, candidateGlobalMap, partitions, resolution, epsilon);

    if (newModularity > bestModularity + epsilon) {
      bestModularity = newModularity;
      bestCommunityMap = new Map(candidateGlobalMap);
      globalCommunityMap = candidateGlobalMap;
    } else {
      // Revert to best assignment and stop optimization
      break;
    }

    // Phase 2: Multilevel coarsening
    // Group supernodes by (community, partition) to preserve bipartite structure
    const nextSuperNodeMap = new Map<string, SuperNode>();
    const oldSuperToNewSuper = new Map<string, string>();

    currentLevelNodes.forEach((sn) => {
      const assignedC = commAssignment.get(sn.id)!;
      const superKey = `${assignedC}_${sn.partition}`;
      if (!nextSuperNodeMap.has(superKey)) {
        nextSuperNodeMap.set(superKey, {
          id: superKey,
          comm: assignedC,
          partition: sn.partition
        });
      }
      oldSuperToNewSuper.set(sn.id, superKey);
    });

    // If coarsening resulted in no reduction of supernode count, stop
    if (nextSuperNodeMap.size === currentLevelNodes.length) {
      break;
    }

    // Update original node -> supernode map
    nodes.forEach((node) => {
      const oldSN = nodeToSuperNodeMap.get(node)!;
      const newSN = oldSuperToNewSuper.get(oldSN)!;
      nodeToSuperNodeMap.set(node, newSN);
    });

    // Build new level adjacency without double-counting undirected coarse edges
    // Iterate over Set A supernodes and their Set B neighbors
    const coarseEdges = new Map<string, number>();

    currentLevelNodes.forEach((sn) => {
      if (sn.partition !== 'A') return;
      const uNew = oldSuperToNewSuper.get(sn.id)!;
      const neighbors = currentAdj.get(sn.id);
      if (neighbors) {
        neighbors.forEach((w, neighborId) => {
          const vNew = oldSuperToNewSuper.get(neighborId)!;
          if (uNew !== vNew) {
            const edgeKey = `${uNew}___${vNew}`;
            coarseEdges.set(edgeKey, (coarseEdges.get(edgeKey) || 0) + w);
          }
        });
      }
    });

    const nextAdj = new Map<string, Map<string, number>>();
    nextSuperNodeMap.forEach((sn) => nextAdj.set(sn.id, new Map<string, number>()));

    coarseEdges.forEach((w, edgeKey) => {
      const [uNew, vNew] = edgeKey.split('___');
      nextAdj.get(uNew)!.set(vNew, w);
      nextAdj.get(vNew)!.set(uNew, w);
    });

    currentLevelNodes = Array.from(nextSuperNodeMap.values());
    currentAdj = nextAdj;
  }

  // Format final community assignment
  const rawCommMap: Record<string, number> = {};
  bestCommunityMap.forEach((comm, node) => {
    rawCommMap[node] = comm;
  });

  const normalized = normalize_communities(rawCommMap);
  const finalCommunities: Record<string, string> = {};
  Object.keys(normalized).forEach((node) => {
    finalCommunities[node] = `Cluster ${normalized[node] + 1}`;
  });

  if (Math.abs(bestModularity) < epsilon) {
    bestModularity = 0;
  }

  return { communities: finalCommunities, modularity: bestModularity };
}

/**
 * Computes custom bipartite graph metrics:
 * 1. Partition Set A / Set B
 * 2. Normalized Bipartite Degree (unweighted: uniqueNeighborCount / oppositePartitionSize)
 * 3. Zhang Node-Level Square (4-Cycle) Bipartite Clustering Coefficient
 * 4. Bipartite Redundancy Coefficient
 * 5. One-Mode Projection Degree (unweighted: unique same-partition nodes reachable via opposite partition)
 *
 * Performance note & worst-case complexity:
 * Caches neighbor lists and Sets once per calculation to avoid repeated graph traversal.
 * Worst-case time complexity per node for clustering and redundancy is O(deg(u)^2 * min(deg(v_i), deg(v_j))).
 * This is efficient for sparse and low-to-medium degree nodes; for ultra-dense hubs, complexity is quadratic
 * in node degree.
 */
export function computeBipartiteMetrics(graph: Graph): Record<string, BipartiteMetricsResult> {
  const partitions = getBipartitePartitions(graph);
  const sizeA = partitions.setA.size;
  const sizeB = partitions.setB.size;

  const results: Record<string, BipartiteMetricsResult> = {};

  // Cache neighbor arrays and neighbor Sets once per calculation
  const neighborsMap = new Map<string, string[]>();
  const neighborSetsMap = new Map<string, Set<string>>();

  graph.forEachNode((node) => {
    const nbrs = graph.neighbors(node);
    neighborsMap.set(node, nbrs);
    neighborSetsMap.set(node, new Set(nbrs));
  });

  graph.forEachNode((node) => {
    const isSetA = partitions.partitionMap.get(node) === 'A';
    const oppositeSize = isSetA ? sizeB : sizeA;

    const nbrs = neighborsMap.get(node) || [];
    const deg = nbrs.length;

    // 1. Normalized Bipartite Degree
    const normDegVal = oppositeSize > 0 ? (deg / oppositeSize) : 0;
    const normDeg = normDegVal.toFixed(4);

    // 2. Zhang Node-Level Square (4-Cycle) Bipartite Clustering Coefficient
    let numSum = 0;
    let denSum = 0;

    for (let i = 0; i < deg; i++) {
      for (let j = i + 1; j < deg; j++) {
        const vI = nbrs[i];
        const vJ = nbrs[j];
        const setI = neighborSetsMap.get(vI)!;
        const setJ = neighborSetsMap.get(vJ)!;

        const smaller = setI.size <= setJ.size ? setI : setJ;
        const larger = smaller === setI ? setJ : setI;

        let q_ij = 0;
        smaller.forEach((nbr) => {
          if (nbr !== node && larger.has(nbr)) {
            q_ij++;
          }
        });

        const a_ij = (setI.size - 1) + (setJ.size - 1) - q_ij;
        numSum += q_ij;
        denSum += a_ij;
      }
    }

    const clusteringVal = denSum > 0 ? (numSum / denSum) : 0;
    const clustering = clusteringVal.toFixed(6);

    // 3. Bipartite Redundancy Coefficient
    const totalPairs = (deg * (deg - 1)) / 2;
    let redundantPairCount = 0;

    if (deg >= 2) {
      for (let i = 0; i < deg; i++) {
        for (let j = i + 1; j < deg; j++) {
          const vI = nbrs[i];
          const vJ = nbrs[j];
          const setI = neighborSetsMap.get(vI)!;
          const setJ = neighborSetsMap.get(vJ)!;

          const smaller = setI.size <= setJ.size ? setI : setJ;
          const larger = smaller === setI ? setJ : setI;

          let isRedundant = false;
          for (const w of smaller) {
            if (w !== node && larger.has(w)) {
              isRedundant = true;
              break;
            }
          }
          if (isRedundant) redundantPairCount++;
        }
      }
    }

    const redundancyVal = totalPairs > 0 ? (redundantPairCount / totalPairs) : 0;
    const redundancy = redundancyVal.toFixed(4);

    // 4. One-Mode Projection Degree
    const projectedNeighbors = new Set<string>();
    const focalPartition = partitions.partitionMap.get(node)!;

    nbrs.forEach((v) => {
      const vNbrs = neighborsMap.get(v) || [];
      vNbrs.forEach((w) => {
        if (w !== node && partitions.partitionMap.get(w) === focalPartition) {
          projectedNeighbors.add(w);
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
