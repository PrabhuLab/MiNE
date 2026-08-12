import { useMemo } from 'react';
import * as d3 from 'd3';
import type { RawNode } from '@/store/useStore';
import type { LegendMetricScale } from '@/services/graphStyles/types';

interface GraphColorScaleOptions {
  nodes: RawNode[];
  networkMetrics: any[];
  nodeColorBase: string;
  customNodeAttribute?: string;
  customIsNumeric: boolean;
}

export function useGraphColorScales({
  nodes,
  networkMetrics,
  nodeColorBase,
  customNodeAttribute,
  customIsNumeric,
}: GraphColorScaleOptions) {
  const customNumericDomain = useMemo(() => {
    if (!customIsNumeric || !customNodeAttribute) return [0, 1] as [number, number];
    const values = nodes.map((node) => Number(node[customNodeAttribute])).filter(Number.isFinite);
    if (!values.length) return [0, 1] as [number, number];
    const min = Math.min(...values);
    const max = Math.max(...values);
    return [min, max === min ? min + 1 : max] as [number, number];
  }, [customIsNumeric, customNodeAttribute, nodes]);
  const customNumericColorScale = useMemo(
    () => d3.scaleSequential(d3.interpolateViridis).domain(customNumericDomain),
    [customNumericDomain],
  );

  const maxEigen = useMemo(
    () => d3.max(networkMetrics, (entry: any) => parseFloat(entry.eigenvector)) || 1,
    [networkMetrics],
  );
  const minEigen = useMemo(
    () => d3.min(networkMetrics, (entry: any) => parseFloat(entry.eigenvector)) || 0,
    [networkMetrics],
  );
  const maxPageRank = useMemo(
    () => d3.max(networkMetrics, (entry: any) => parseFloat(entry.pagerank)) || 1,
    [networkMetrics],
  );
  const minPageRank = useMemo(
    () => d3.min(networkMetrics, (entry: any) => parseFloat(entry.pagerank)) || 0,
    [networkMetrics],
  );
  const maxBetweenness = useMemo(
    () => d3.max(networkMetrics, (entry: any) => parseFloat(entry.betweenness)) || 1,
    [networkMetrics],
  );
  const maxCloseness = useMemo(
    () => d3.max(networkMetrics, (entry: any) => parseFloat(entry.closeness)) || 1,
    [networkMetrics],
  );
  const maxClustering = useMemo(
    () => d3.max(networkMetrics, (entry: any) => parseFloat(entry.clustering)) || 1,
    [networkMetrics],
  );
  const maxDegreeCent = useMemo(
    () => d3.max(networkMetrics, (entry: any) =>
      parseFloat(entry.degreeCentrality || entry.inDegreeCentrality || entry.degree || 0)) || 1,
    [networkMetrics],
  );
  const maxAbundance = useMemo(
    () => d3.max(nodes, (entry: any) => parseFloat(entry.abundance || 0)) || 1,
    [nodes],
  );
  const minAbundance = useMemo(
    () => d3.min(nodes, (entry: any) => parseFloat(entry.abundance || 0)) || 0,
    [nodes],
  );

  const eigenColorScale = useMemo(
    () => d3.scaleSequential(d3.interpolatePurples).domain([minEigen, maxEigen]),
    [minEigen, maxEigen],
  );
  const prColorScale = useMemo(
    () => d3.scaleSequential(d3.interpolateGreens).domain([minPageRank, maxPageRank]),
    [minPageRank, maxPageRank],
  );
  const betweennessColorScale = useMemo(
    () => d3.scaleSequential(d3.interpolateOranges).domain([0, maxBetweenness]),
    [maxBetweenness],
  );
  const closenessColorScale = useMemo(
    () => d3.scaleSequential(d3.interpolateBlues).domain([0, maxCloseness]),
    [maxCloseness],
  );
  const clusteringColorScale = useMemo(
    () => d3.scaleSequential(d3.interpolateReds).domain([0, maxClustering]),
    [maxClustering],
  );
  const degreeCentColorScale = useMemo(
    () => d3.scaleSequential(d3.interpolateYlOrBr).domain([0, maxDegreeCent]),
    [maxDegreeCent],
  );
  const abundanceColorScale = useMemo(
    () => d3.scaleSequential(d3.interpolateViridis).domain([minAbundance, maxAbundance]),
    [minAbundance, maxAbundance],
  );

  const legendMetricScale: LegendMetricScale | null = useMemo(() => {
    if (nodeColorBase === 'custom' && customNodeAttribute && customIsNumeric) {
      const [min, max] = customNumericDomain;
      return { title: customNodeAttribute, min, max, ticks: [min, (min + max) / 2, max], scale: customNumericColorScale };
    }
    if (nodeColorBase === 'abundance') {
      return { title: 'Abundance', min: minAbundance, max: maxAbundance, ticks: [minAbundance, (minAbundance + maxAbundance) / 2, maxAbundance], scale: abundanceColorScale };
    }
    if (nodeColorBase === 'eigenvector') {
      return { title: 'Eigenvector Centrality', min: minEigen, max: maxEigen, ticks: [minEigen, (minEigen + maxEigen) / 2, maxEigen], scale: eigenColorScale };
    }
    if (nodeColorBase === 'pagerank') {
      return { title: 'PageRank', min: minPageRank, max: maxPageRank, ticks: [minPageRank, (minPageRank + maxPageRank) / 2, maxPageRank], scale: prColorScale };
    }
    if (nodeColorBase === 'betweenness') {
      return { title: 'Betweenness Centrality', min: 0, max: maxBetweenness, ticks: [0, maxBetweenness / 2, maxBetweenness], scale: betweennessColorScale };
    }
    if (nodeColorBase === 'closeness') {
      return { title: 'Closeness Centrality', min: 0, max: maxCloseness, ticks: [0, maxCloseness / 2, maxCloseness], scale: closenessColorScale };
    }
    if (nodeColorBase === 'clustering') {
      return { title: 'Clustering Coefficient', min: 0, max: maxClustering, ticks: [0, maxClustering / 2, maxClustering], scale: clusteringColorScale };
    }
    if (nodeColorBase === 'degreeCentrality' || nodeColorBase === 'degree') {
      return { title: 'Degree Centrality', min: 0, max: maxDegreeCent, ticks: [0, maxDegreeCent / 2, maxDegreeCent], scale: degreeCentColorScale };
    }
    if (nodeColorBase === 'inDegreeCentrality') {
      return { title: 'In-Degree Centrality', min: 0, max: maxDegreeCent, ticks: [0, maxDegreeCent / 2, maxDegreeCent], scale: degreeCentColorScale };
    }
    if (nodeColorBase === 'outDegreeCentrality') {
      return { title: 'Out-Degree Centrality', min: 0, max: maxDegreeCent, ticks: [0, maxDegreeCent / 2, maxDegreeCent], scale: degreeCentColorScale };
    }
    return null;
  }, [
    nodeColorBase, customNodeAttribute, customIsNumeric, customNumericDomain,
    customNumericColorScale, minAbundance, maxAbundance, abundanceColorScale,
    minEigen, maxEigen, eigenColorScale, minPageRank, maxPageRank, prColorScale,
    maxBetweenness, betweennessColorScale, maxCloseness, closenessColorScale,
    maxClustering, clusteringColorScale, maxDegreeCent, degreeCentColorScale,
  ]);

  return {
    customNumericDomain,
    customNumericColorScale,
    minEigen,
    maxEigen,
    eigenColorScale,
    minPageRank,
    maxPageRank,
    prColorScale,
    maxBetweenness,
    betweennessColorScale,
    maxCloseness,
    closenessColorScale,
    maxClustering,
    clusteringColorScale,
    maxDegreeCent,
    degreeCentColorScale,
    minAbundance,
    maxAbundance,
    abundanceColorScale,
    legendMetricScale,
  };
}
