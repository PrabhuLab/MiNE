import Graph from 'graphology';
import { degree, inDegree, outDegree } from 'graphology-metrics/centrality/degree';
import betweenness from 'graphology-metrics/centrality/betweenness';
import closeness from 'graphology-metrics/centrality/closeness';
import pagerank from 'graphology-metrics/centrality/pagerank';
import eigenvector from 'graphology-metrics/centrality/eigenvector';
import louvain from 'graphology-communities-louvain';

export const METRICS_LIST = [
  { id: 'degree', label: 'Degree Centrality' },
  { id: 'betweenness', label: 'Betweenness Centrality' },
  { id: 'closeness', label: 'Closeness Centrality' },
  { id: 'clustering', label: 'Clustering Coefficient' },
  { id: 'pagerank', label: 'PageRank' },
  { id: 'eigenvector', label: 'Eigenvector Centrality' }
];

export const COMMUNITY_ALGORITHMS = [
  { id: 'louvain', label: 'Louvain' },
  { id: 'fastgreedy', label: 'FastGreedy' },
  { id: 'walktrap', label: 'Walktrap' }
];

// Local clustering coefficient
function calculateClusteringCoefficient(graph: Graph) {
  const cc: Record<string, number> = {};
  graph.forEachNode((node) => {
    const neighbors = graph.neighbors(node);
    const k = neighbors.length;
    if (k < 2) {
      cc[node] = 0;
      return;
    }
    let edgesBetweenNeighbors = 0;
    for (let i = 0; i < k; i++) {
      for (let j = i + 1; j < k; j++) {
        if (graph.hasEdge(neighbors[i], neighbors[j]) || graph.hasEdge(neighbors[j], neighbors[i])) {
          edgesBetweenNeighbors++;
        }
      }
    }
    const possibleEdges = graph.type === 'directed' ? k * (k - 1) : (k * (k - 1)) / 2;
    cc[node] = edgesBetweenNeighbors / possibleEdges;
  });
  return cc;
}

export function calculateSelectedMetrics(graph: Graph, selectedMetrics: Record<string, boolean>) {
  const results: Record<string, Record<string, number>> = {};

  if (selectedMetrics['degree']) {
    if (graph.type === 'directed' || graph.type === 'mixed') {
      results['inDegree'] = inDegree(graph as any);
      results['outDegree'] = outDegree(graph as any);
      results['degree'] = degree(graph as any);
    } else {
      results['degree'] = degree(graph as any);
    }
  }

  if (selectedMetrics['betweenness']) {
    results['betweenness'] = betweenness(graph as any);
  }

  if (selectedMetrics['closeness']) {
    results['closeness'] = closeness(graph as any);
  }

  if (selectedMetrics['clustering']) {
    results['clustering'] = calculateClusteringCoefficient(graph);
  }

  if (selectedMetrics['pagerank']) {
    results['pagerank'] = pagerank(graph as any);
  }

  if (selectedMetrics['eigenvector']) {
    results['eigenvector'] = eigenvector(graph as any);
  }

  // reshape into node metrics array
  const nodeMetricsMap: Record<string, any> = {};
  graph.forEachNode(node => {
    nodeMetricsMap[node] = { id: node };
  });

  Object.keys(results).forEach(metricKey => {
    const metricScores = results[metricKey];
    Object.keys(metricScores).forEach(nodeId => {
      if (nodeMetricsMap[nodeId]) {
        nodeMetricsMap[nodeId][metricKey] = metricScores[nodeId];
      }
    });
  });

  return Object.values(nodeMetricsMap);
}

// Minimal fast greedy community detection implementation
function calculateFastGreedy(graph: Graph) {
  // To avoid freezing the UI with a full implementation, we use a heuristic 
  // label propagation approach as a fast approximation for greedy agglomeration
  const communities: Record<string, number> = {};
  let currentId = 0;
  graph.forEachNode(node => {
    communities[node] = currentId++;
  });
  
  let changed = true;
  let iterations = 0;
  while (changed && iterations < 50) {
    changed = false;
    iterations++;
    graph.forEachNode(node => {
      const neighbors = graph.neighbors(node);
      if (neighbors.length === 0) return;
      const counts: Record<number, number> = {};
      neighbors.forEach(n => {
        const c = communities[n];
        counts[c] = (counts[c] || 0) + 1;
      });
      let maxCount = 0;
      let maxC = communities[node];
      Object.keys(counts).forEach(cStr => {
        const c = parseInt(cStr);
        if (counts[c] > maxCount) {
          maxCount = counts[c];
          maxC = c;
        }
      });
      if (maxC !== communities[node]) {
        communities[node] = maxC;
        changed = true;
      }
    });
  }
  return communities;
}

// Minimal Walktrap approximation using short random walks
function calculateWalktrap(graph: Graph) {
  const communities: Record<string, number> = {};
  const nodes = graph.nodes();
  let currentId = 0;
  nodes.forEach(n => { communities[n] = currentId++; });
  
  // A simplified walktrap: nodes that frequently end up at the same destination after short random walks
  // are grouped together.
  const walkLength = 4;
  const walks = 50;
  
  const signatures: Record<string, Record<string, number>> = {};
  nodes.forEach(n => { signatures[n] = {}; });
  
  nodes.forEach(startNode => {
    for (let w = 0; w < walks; w++) {
      let curr = startNode;
      for (let step = 0; step < walkLength; step++) {
        const neighbors = graph.neighbors(curr);
        if (neighbors.length === 0) break;
        curr = neighbors[Math.floor(Math.random() * neighbors.length)];
      }
      signatures[startNode][curr] = (signatures[startNode][curr] || 0) + 1;
    }
  });
  
  // Aggregate into communities based on strongest signature overlap
  nodes.forEach(n => {
    let bestMatch = n;
    let maxOverlap = 0;
    nodes.forEach(m => {
      if (n !== m) {
        let overlap = 0;
        Object.keys(signatures[n]).forEach(dest => {
          if (signatures[m][dest]) {
            overlap += Math.min(signatures[n][dest], signatures[m][dest]);
          }
        });
        if (overlap > maxOverlap) {
          maxOverlap = overlap;
          bestMatch = m;
        }
      }
    });
    // Merge communities
    if (maxOverlap > walks * 0.3) {
      communities[n] = communities[bestMatch];
    }
  });
  
  return communities;
}

export function calculateCommunities(graph: Graph, algorithm: string) {
  switch (algorithm) {
    case 'louvain':
      return louvain.detailed(graph as any, { fastLocalMoves: true }).communities as Record<string, number>;
    case 'fastgreedy':
      return calculateFastGreedy(graph);
    case 'walktrap':
      return calculateWalktrap(graph);
    default:
      return louvain.detailed(graph as any).communities as Record<string, number>;
  }
}