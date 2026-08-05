import { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { computeCommunityMetrics } from '@/lib/workspaceUtils';
import { computeBipartiteLouvain, computeBipartiteMetrics } from '@/lib/bipartiteUtils';
import Graph from 'graphology';
import louvainPkg from 'graphology-communities-louvain';
import pagerankPkg from 'graphology-metrics/centrality/pagerank';
import eigenvectorPkg from 'graphology-metrics/centrality/eigenvector';
import betweennessPkg from 'graphology-metrics/centrality/betweenness';
import closenessPkg from 'graphology-metrics/centrality/closeness';
import * as degreePkg from 'graphology-metrics/centrality/degree';
import seedrandomPkg from 'seedrandom';
import { normalize_communities } from '@/lib/communityUtils';

// Handle Next.js ESM/CJS interop for graphology plugins
const louvain = (typeof louvainPkg === 'function') ? louvainPkg : (louvainPkg as any).default || louvainPkg;
const pagerank = (typeof pagerankPkg === 'function') ? pagerankPkg : (pagerankPkg as any).default || pagerankPkg;
const eigenvector = (typeof eigenvectorPkg === 'function') ? eigenvectorPkg : (eigenvectorPkg as any).default || eigenvectorPkg;
const betweenness = (typeof betweennessPkg === 'function') ? betweennessPkg : (betweennessPkg as any).default || betweennessPkg;
const closeness = (typeof closenessPkg === 'function') ? closenessPkg : (closenessPkg as any).default || closenessPkg;
const degreeCentrality = degreePkg.degreeCentrality || (degreePkg as any).default?.degreeCentrality;
const inDegreeCentrality = degreePkg.inDegreeCentrality || (degreePkg as any).default?.inDegreeCentrality;
const outDegreeCentrality = degreePkg.outDegreeCentrality || (degreePkg as any).default?.outDegreeCentrality;
const seedrandom = (typeof seedrandomPkg === 'function') ? seedrandomPkg : (seedrandomPkg as any).default || seedrandomPkg;

export function useGraphMetrics(validNodes: any[], validEdges: any[], appliedFilters: any, rawNodes: any[]) {
  const { directed, bipartite, communityMap, setCommunityMap, setFilter } = useStore();
  
  const [networkMetrics, setNetworkMetrics] = useState<any[]>([]);
  const [nodeMetrics, setNodeMetrics] = useState<any[]>([]);
  
  const [modularity, setModularity] = useState<number | null>(null);
  
  const [metricsToRun, setMetricsToRun] = useState({
    louvain: false,
    degree: false,
    betweenness: false,
    closeness: false,
    clustering: false,
    pagerank: false,
    eigenvector: false
  });
  const [metricsLoading, setMetricsLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setNetworkMetrics([]);
      setMetricsToRun({
        louvain: false,
        degree: false,
        betweenness: false,
        closeness: false,
        clustering: false,
        pagerank: false,
        eigenvector: false
      });
      setFilter('nodeColorBase', 'custom');
      setFilter('nodeSizeBase', 'abundance');
      setFilter('edgeColorBase', 'uniform');
      setFilter('edgeColorNodeMetric', 'custom');
    }, 0);
    return () => clearTimeout(timer);
  }, [rawNodes, setFilter]);

  // Compute Communities and Metrics
  useEffect(() => {
    if (validNodes.length === 0 || validEdges.length === 0) return;

    try {
      const graph = new Graph({ type: directed ? "directed" : "undirected", multi: false, allowSelfLoops: false });
      
      validNodes.forEach(n => {
        if (!graph.hasNode(n.id)) graph.addNode(n.id, { ...n });
      });
      
      validEdges.forEach(e => {
        if (graph.hasNode(e.source) && graph.hasNode(e.target)) {
          if (!graph.hasEdge(e.source, e.target)) {
            graph.addEdge(e.source, e.target, { weight: e.weight_raw || 1 });
          }
        }
      });

      let newCommunityMap: Record<string, any> = {};
      
      validNodes.forEach(n => {
        if (n.community !== undefined && n.community !== null && n.community !== "") {
          newCommunityMap[n.id] = String(n.community);
        }
      });

      setCommunityMap(newCommunityMap);

      const metrics = computeCommunityMetrics(graph, newCommunityMap, directed);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNodeMetrics(metrics);

      setNetworkMetrics(prev => {
        if (prev.length === 0) {
          return graph.nodes().map(nodeId => {
            return {
              id: nodeId,
              degree: graph.degree ? graph.degree(nodeId) : 0,
              inDegree: directed && graph.inDegree ? graph.inDegree(nodeId) : 0,
              outDegree: directed && graph.outDegree ? graph.outDegree(nodeId) : 0
            };
          });
        }
        
        const currentMap = new Map(prev.map(m => [m.id, m]));
        return graph.nodes().map(nodeId => {
          const old = currentMap.get(nodeId) || {};
          return {
            ...old,
            id: nodeId,
            degree: graph.degree ? graph.degree(nodeId) : 0,
            inDegree: directed && graph.inDegree ? graph.inDegree(nodeId) : 0,
            outDegree: directed && graph.outDegree ? graph.outDegree(nodeId) : 0
          };
        });
      });
    } catch (err) {
      console.warn("Community calculation skipped/failed:", err);
    }
  }, [validNodes, validEdges, directed, setCommunityMap]);

  const runSelectedMetrics = () => {
    if (validNodes.length === 0 || validEdges.length === 0) return;
    setMetricsLoading(true);
    
    // We defer to let the UI update the loading state
    setTimeout(() => {
      try {
        const graph = new Graph({ type: directed ? "directed" : "undirected", multi: false, allowSelfLoops: false });
        
        validNodes.forEach(n => {
          if (!graph.hasNode(n.id)) graph.addNode(n.id, { ...n });
        });
        
        validEdges.forEach(e => {
          if (graph.hasNode(e.source) && graph.hasNode(e.target)) {
            if (!graph.hasEdge(e.source, e.target)) {
              graph.addEdge(e.source, e.target, { weight: e.weight_raw || 1 });
            }
          }
        });

        const newMetrics: Record<string, any> = {};
        graph.forEachNode(node => {
          newMetrics[node] = {};
        });

        const runLouvain = metricsToRun.louvain || appliedFilters?.nodeColorBase === 'louvain';
        if (runLouvain) {
          try {
            if (bipartite) {
              const details = computeBipartiteLouvain(graph, {
                resolution: appliedFilters?.resolution || 1.0,
                seed: appliedFilters?.louvainSeed || 42
              });
              Object.keys(details.communities).forEach(node => {
                newMetrics[node].louvain = details.communities[node];
              });
              setModularity(details.modularity);
            } else {
              const options = { 
                rng: seedrandom(appliedFilters?.louvainSeed || 42),
                resolution: appliedFilters?.resolution || 1.0, 
                getEdgeWeight: "weight",
                fastLocalMoves: true
              };
              const details = louvain.detailed(graph, options);
              const norm = normalize_communities(details.communities as Record<string, number>);
              Object.keys(norm).forEach(node => {
                newMetrics[node].louvain = `Cluster ${norm[node] + 1}`;
              });
              setModularity(details.modularity);
            }
          } catch (e) { console.warn("Community detection failed", e); }
        }

        if (bipartite) {
          try {
            const bipMetrics = computeBipartiteMetrics(graph);
            Object.keys(bipMetrics).forEach(node => {
              newMetrics[node].bipartitePartition = bipMetrics[node].bipartitePartition;
              newMetrics[node].bipartiteNormDegree = bipMetrics[node].bipartiteNormDegree;
              newMetrics[node].bipartiteClustering = bipMetrics[node].bipartiteClustering;
              newMetrics[node].bipartiteRedundancy = bipMetrics[node].bipartiteRedundancy;
              newMetrics[node].bipartiteProjectionDegree = bipMetrics[node].bipartiteProjectionDegree;
            });
          } catch (e) { console.warn("Bipartite metrics calculation failed", e); }
        }

        if (metricsToRun.degree) {
          try {
            if (directed) {
              const inDeg = inDegreeCentrality(graph);
              const outDeg = outDegreeCentrality(graph);
              Object.keys(inDeg).forEach(node => {
                newMetrics[node].inDegreeCentrality = inDeg[node].toFixed(6);
              });
              Object.keys(outDeg).forEach(node => {
                newMetrics[node].outDegreeCentrality = outDeg[node].toFixed(6);
              });
            } else {
              const deg = degreeCentrality(graph);
              Object.keys(deg).forEach(node => {
                newMetrics[node].degreeCentrality = deg[node].toFixed(6);
              });
            }
          } catch (e) { console.warn("Degree Centrality failed", e); }
        }

        if (metricsToRun.betweenness) {
          try {
            const bet = betweenness(graph);
            Object.keys(bet).forEach(node => {
              newMetrics[node].betweenness = bet[node].toFixed(6);
            });
          } catch (e) { console.warn("Betweenness Centrality failed", e); }
        }

        if (metricsToRun.closeness) {
          try {
            const clo = closeness(graph);
            Object.keys(clo).forEach(node => {
              newMetrics[node].closeness = clo[node].toFixed(6);
            });
          } catch (e) { console.warn("Closeness Centrality failed", e); }
        }

        if (metricsToRun.clustering) {
          try {
            // Manual local clustering coefficient calculation
            graph.forEachNode(node => {
              const neighbors = graph.neighbors(node);
              const k = neighbors.length;
              if (k < 2) {
                newMetrics[node].clustering = "0.000000";
              } else {
                let edgesBetween = 0;
                for (let i = 0; i < k; i++) {
                  for (let j = i + 1; j < k; j++) {
                    if (graph.hasEdge(neighbors[i], neighbors[j]) || graph.hasEdge(neighbors[j], neighbors[i])) {
                      edgesBetween++;
                    }
                  }
                }
                const possibleEdges = directed ? k * (k - 1) : (k * (k - 1)) / 2;
                newMetrics[node].clustering = (edgesBetween / possibleEdges).toFixed(6);
              }
            });
          } catch (e) { console.warn("Clustering Coefficient failed", e); }
        }

        if (metricsToRun.pagerank) {
          try {
            const pr = pagerank(graph);
            Object.keys(pr).forEach(node => {
              newMetrics[node].pagerank = pr[node].toFixed(6);
            });
          } catch (e) { console.warn("PageRank failed", e); }
        }

        if (metricsToRun.eigenvector) {
          try {
            const eig = eigenvector(graph);
            Object.keys(eig).forEach(node => {
              newMetrics[node].eigenvector = eig[node].toFixed(6);
            });
          } catch (e) { console.warn("Eigenvector Centrality failed", e); }
        }

        setNetworkMetrics(prev => {
          const currentMap = new Map(prev.map(m => [m.id, m]));
          return graph.nodes().map(nodeId => {
            const old = currentMap.get(nodeId) || { id: nodeId };
            return {
              ...old,
              ...newMetrics[nodeId]
            };
          });
        });
      } catch (err) {
        console.error("Failed to run metrics:", err);
      } finally {
        setMetricsLoading(false);
      }
    }, 100);
  };

  // Auto recalculate active metrics or Louvain when validNodes, validEdges, or filter parameters change
  useEffect(() => {
    const isLouvainActive = metricsToRun.louvain || appliedFilters?.nodeColorBase === 'louvain';
    const hasAnyMetricActive = Object.values(metricsToRun).some(Boolean) || isLouvainActive;

    if (hasAnyMetricActive && validNodes.length > 0 && validEdges.length > 0) {
      const timer = setTimeout(() => {
        runSelectedMetrics();
      }, 0);
      return () => clearTimeout(timer);
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [validNodes, validEdges, appliedFilters?.resolution, appliedFilters?.louvainSeed, appliedFilters?.nodeColorBase, metricsToRun]);

  return {
    networkMetrics,
    nodeMetrics,
    modularity,
    metricsToRun,
    setMetricsToRun,
    metricsLoading,
    runSelectedMetrics,
  };
}
