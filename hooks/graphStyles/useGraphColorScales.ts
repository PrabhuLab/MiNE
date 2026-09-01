import { useMemo } from 'react';
import * as d3 from 'd3';
import type { RawNode } from '@/store/useStore';
import type { LegendMetricScale } from '@/services/graphStyles/types';
import { numericExtent } from '@/lib/utils';

interface GraphColorScaleOptions {
  nodes: RawNode[];
  networkMetrics: any[];
  nodeColorBase: string;
  customNodeAttribute?: string;
  customIsNumeric: boolean;
  legendColorOverrides: Record<string, string>;
}

export function useGraphColorScales({
  nodes,
  networkMetrics,
  nodeColorBase,
  customNodeAttribute,
  customIsNumeric,
  legendColorOverrides,
}: GraphColorScaleOptions) {
  const scaleKey = `scale:node:${nodeColorBase === 'custom' ? customNodeAttribute || 'custom' : nodeColorBase}`;
  const minColor = legendColorOverrides[`${scaleKey}:min`] || '#440154';
  const maxColor = legendColorOverrides[`${scaleKey}:max`] || '#fde725';
  const interpolator = useMemo(() => d3.interpolateRgb(minColor, maxColor), [maxColor, minColor]);
  const mergedNodes = useMemo(() => {
    const metricsById = new Map(networkMetrics.map((entry) => [String(entry.id), entry]));
    return nodes.map((node) => ({ ...node, ...(metricsById.get(String(node.id)) || {}) }));
  }, [networkMetrics, nodes]);
  const customNumericDomain = useMemo(() => {
    if (!customIsNumeric || !customNodeAttribute) return [0, 1] as [number, number];
    const extent = numericExtent(mergedNodes.map((node) => Number(node[customNodeAttribute])));
    if (!extent) return [0, 1] as [number, number];
    const [min, max] = extent;
    return [min, max === min ? min + 1 : max] as [number, number];
  }, [customIsNumeric, customNodeAttribute, mergedNodes]);
  const customNumericColorScale = useMemo(
    () => d3.scaleSequential(interpolator).domain(customNumericDomain),
    [customNumericDomain, interpolator],
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
  const eigenColorScale = useMemo(
    () => d3.scaleSequential(interpolator).domain([minEigen, maxEigen]),
    [interpolator, minEigen, maxEigen],
  );
  const prColorScale = useMemo(
    () => d3.scaleSequential(interpolator).domain([minPageRank, maxPageRank]),
    [interpolator, minPageRank, maxPageRank],
  );
  const betweennessColorScale = useMemo(
    () => d3.scaleSequential(interpolator).domain([0, maxBetweenness]),
    [interpolator, maxBetweenness],
  );
  const closenessColorScale = useMemo(
    () => d3.scaleSequential(interpolator).domain([0, maxCloseness]),
    [interpolator, maxCloseness],
  );
  const clusteringColorScale = useMemo(
    () => d3.scaleSequential(interpolator).domain([0, maxClustering]),
    [interpolator, maxClustering],
  );
  const degreeCentColorScale = useMemo(
    () => d3.scaleSequential(interpolator).domain([0, maxDegreeCent]),
    [interpolator, maxDegreeCent],
  );
  const legendMetricScale: LegendMetricScale | null = useMemo(() => {
    if (nodeColorBase === 'custom' && customNodeAttribute && customIsNumeric) {
      const [min, max] = customNumericDomain;
      return { title: `Node color · ${customNodeAttribute}`, visual: 'color', min, max, ticks: [min, (min + max) / 2, max], scale: customNumericColorScale, colors: { min: minColor, max: maxColor }, colorKeys: { min: `${scaleKey}:min`, max: `${scaleKey}:max` } };
    }
    if (nodeColorBase === 'eigenvector') {
      return { title: 'Node color · Eigenvector Centrality', visual: 'color', min: minEigen, max: maxEigen, ticks: [minEigen, (minEigen + maxEigen) / 2, maxEigen], scale: eigenColorScale, colors: { min: minColor, max: maxColor }, colorKeys: { min: `${scaleKey}:min`, max: `${scaleKey}:max` } };
    }
    if (nodeColorBase === 'pagerank') {
      return { title: 'Node color · PageRank', visual: 'color', min: minPageRank, max: maxPageRank, ticks: [minPageRank, (minPageRank + maxPageRank) / 2, maxPageRank], scale: prColorScale, colors: { min: minColor, max: maxColor }, colorKeys: { min: `${scaleKey}:min`, max: `${scaleKey}:max` } };
    }
    if (nodeColorBase === 'betweenness') {
      return { title: 'Node color · Betweenness Centrality', visual: 'color', min: 0, max: maxBetweenness, ticks: [0, maxBetweenness / 2, maxBetweenness], scale: betweennessColorScale, colors: { min: minColor, max: maxColor }, colorKeys: { min: `${scaleKey}:min`, max: `${scaleKey}:max` } };
    }
    if (nodeColorBase === 'closeness') {
      return { title: 'Node color · Closeness Centrality', visual: 'color', min: 0, max: maxCloseness, ticks: [0, maxCloseness / 2, maxCloseness], scale: closenessColorScale, colors: { min: minColor, max: maxColor }, colorKeys: { min: `${scaleKey}:min`, max: `${scaleKey}:max` } };
    }
    if (nodeColorBase === 'clustering') {
      return { title: 'Node color · Clustering Coefficient', visual: 'color', min: 0, max: maxClustering, ticks: [0, maxClustering / 2, maxClustering], scale: clusteringColorScale, colors: { min: minColor, max: maxColor }, colorKeys: { min: `${scaleKey}:min`, max: `${scaleKey}:max` } };
    }
    if (nodeColorBase === 'degreeCentrality' || nodeColorBase === 'degree') {
      return { title: 'Node color · Degree Centrality', visual: 'color', min: 0, max: maxDegreeCent, ticks: [0, maxDegreeCent / 2, maxDegreeCent], scale: degreeCentColorScale, colors: { min: minColor, max: maxColor }, colorKeys: { min: `${scaleKey}:min`, max: `${scaleKey}:max` } };
    }
    if (nodeColorBase === 'inDegreeCentrality') {
      return { title: 'Node color · In-Degree Centrality', visual: 'color', min: 0, max: maxDegreeCent, ticks: [0, maxDegreeCent / 2, maxDegreeCent], scale: degreeCentColorScale, colors: { min: minColor, max: maxColor }, colorKeys: { min: `${scaleKey}:min`, max: `${scaleKey}:max` } };
    }
    if (nodeColorBase === 'outDegreeCentrality') {
      return { title: 'Node color · Out-Degree Centrality', visual: 'color', min: 0, max: maxDegreeCent, ticks: [0, maxDegreeCent / 2, maxDegreeCent], scale: degreeCentColorScale, colors: { min: minColor, max: maxColor }, colorKeys: { min: `${scaleKey}:min`, max: `${scaleKey}:max` } };
    }
    return null;
  }, [
    nodeColorBase, customNodeAttribute, customIsNumeric, customNumericDomain,
    customNumericColorScale,
    minEigen, maxEigen, eigenColorScale, minPageRank, maxPageRank, prColorScale,
    maxBetweenness, betweennessColorScale, maxCloseness, closenessColorScale,
    maxClustering, clusteringColorScale, maxDegreeCent, degreeCentColorScale, minColor, maxColor, scaleKey,
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
    legendMetricScale,
  };
}
