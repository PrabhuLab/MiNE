import Graph from 'graphology';
import { parse as parseGraphML } from 'graphology-graphml';
import { parse as parseGEXF } from 'graphology-gexf';
import { isBipartiteBy } from 'graphology-bipartite';
import JSZip from 'jszip';
import Papa from 'papaparse';
import type {
  ImportedMetricsBundle,
  RawEdge,
  RawNode,
} from '@/store/useStore';
import { cleanAttributes, meaningful, numeric } from '@/services/graphIO/attributes';
import { explicitPartitionRole, orderPartitionValues } from '@/services/graphPresentation/visibility';
import {
  EMPTY_METRICS,
  GRAPH_IO_VERSION,
  NETWORK_WORKSPACE_FORMAT,
  WORKSPACE_SETTINGS_FORMAT,
  type ParsedNetwork,
} from '@/services/graphIO/types';

export {
  GRAPH_IO_VERSION,
  NETWORK_WORKSPACE_FORMAT,
  WORKSPACE_SETTINGS_FORMAT,
} from '@/services/graphIO/types';
export type {
  AllInOneDocument,
  ParsedNetwork,
  WorkspaceSettingsDocument,
} from '@/services/graphIO/types';
export { writeGraphML } from '@/services/graphIO/graphml';
export { writeGexf } from '@/services/graphIO/gexf';
export { createMetricsBundle } from '@/services/graphIO/metrics';
export {
  availableCustomEdgeAttributes,
  availableCustomNodeAttributes,
  availableNumericCustomEdgeAttributes,
  detectCustomAttributeType,
  inferCustomEdgeAttributes,
  inferCustomNodeAttributes,
  mergeCustomAttributeMetadata,
} from '@/services/graphIO/customAttributes';
export { buildAllInOne, createRandomClusterAllInOne } from '@/services/graphIO/allInOne';

export function graphFromRaw(
  nodes: RawNode[],
  edges: RawEdge[],
  directed: boolean,
  bipartite: boolean,
): Graph {
  const graph = new (Graph as any)({ type: directed ? 'directed' : 'undirected', multi: false, allowSelfLoops: true });
  graph.setAttribute('directed', directed);
  graph.setAttribute('bipartite', bipartite);
  graph.setAttribute('weighted', edges.some((edge) => numeric(edge.weight_raw, 1) !== 1 || numeric(edge.weight_secondary, 1) !== 1));
  graph.setAttribute('partitionAttribute', 'partition');

  const partitionValueSet = new Set<string>();
  if (bipartite) {
    nodes.forEach((node) => {
      let val: string | undefined = undefined;
      if (meaningful(node.partition)) {
        const role = explicitPartitionRole(node.partition);
        val = role !== null ? (role ? 'B' : 'A') : String(node.partition);
      } else if (node.bipartite !== undefined && typeof node.bipartite !== 'object') {
        const role = explicitPartitionRole(node.bipartite);
        val = role !== null ? (role ? 'B' : 'A') : String(node.bipartite);
      } else if (node.set !== undefined) {
        const role = explicitPartitionRole(node.set);
        if (role !== null) val = role ? 'B' : 'A';
      } else if (node.type === 'A' || node.type === 'B') {
        val = node.type;
      }
      if (meaningful(val)) partitionValueSet.add(String(val));
    });
  }
  const partitionValues = new Map(orderPartitionValues(partitionValueSet).map((value, index) => [value, index]));

  nodes.forEach((node, index) => {
    const id = String(node.id ?? `node_${index}`);
    if (graph.hasNode(id)) return;
    const attributes = cleanAttributes({ ...node });
    delete attributes.id;
    attributes.label = node.label ?? node.name ?? id;
    attributes.name = node.name ?? node.label ?? id;
    attributes.abundance = numeric(node.abundance, 10);
    if (bipartite) {
      if (!meaningful(attributes.partition)) {
        if (node.bipartite !== undefined && typeof node.bipartite !== 'object') {
          const role = explicitPartitionRole(node.bipartite);
          attributes.partition = role !== null ? (role ? 'B' : 'A') : 'A';
        } else if (node.set !== undefined) {
          const role = explicitPartitionRole(node.set);
          attributes.partition = role !== null ? (role ? 'B' : 'A') : 'A';
        } else if (node.type === 'A' || node.type === 'B') {
          attributes.partition = node.type;
        } else {
          attributes.partition = 'A';
        }
      } else {
        const role = explicitPartitionRole(attributes.partition);
        if (role !== null) attributes.partition = role ? 'B' : 'A';
      }
      attributes.partitionIndex = partitionValues.get(String(attributes.partition)) ?? (attributes.partition === 'B' ? 1 : 0);
    }
    graph.addNode(id, attributes);
  });

  edges.forEach((edge, index) => {
    const source = String(edge.source);
    const target = String(edge.target);
    if (!graph.hasNode(source) || !graph.hasNode(target)) return;
    if (!graph.multi && graph.hasEdge(source, target)) return;
    const attributes = cleanAttributes({ ...edge });
    delete attributes.source;
    delete attributes.target;
    const rawWeight = edge.weight_raw ?? edge.weight ?? edge.raw_weight ?? edge.absolute ?? edge.count;
    const secondaryWeight = edge.weight_secondary
      ?? edge.secondary_weight
      ?? edge.conditional
      ?? edge.percentage
      ?? edge.percent
      ?? edge.pct
      ?? edge.log1p;
    attributes.weight_raw = numeric(rawWeight, 1);
    attributes.weight_secondary = numeric(secondaryWeight, attributes.weight_raw);
    attributes.weight = attributes.weight_raw;
    graph.addEdgeWithKey(String(edge.key ?? `e${index}`), source, target, attributes);
  });

  return graph;
}

export function canonicalExportGraph(
  sourceGraph: Graph,
  rawNodes: RawNode[],
  rawEdges: RawEdge[],
  metrics: ImportedMetricsBundle,
  directed: boolean,
  bipartite: boolean,
): Graph {
  const graph = graphFromRaw(rawNodes, rawEdges, directed, bipartite);
  const sourcePositions = new Map<string, { x?: number; y?: number }>();
  sourceGraph.forEachNode((node, attrs) => sourcePositions.set(node, { x: attrs.x, y: attrs.y }));

  graph.forEachNode((node) => {
    const pos = sourcePositions.get(node);
    const metricAttributes = metrics.nodes[node] || {};
    const { partition: _mPart, partitionIndex: _mPartIdx, ...cleanMetricAttrs } = metricAttributes;
    graph.mergeNodeAttributes(node, cleanAttributes({ ...cleanMetricAttrs, ...pos }));
  });

  graph.forEachEdge((edge, attrs, source, target) => {
    const metricAttributes = metrics.edges[edge]
      || metrics.edges[`${source}->${target}`]
      || metrics.edges[`${source}--${target}`]
      || {};
    graph.mergeEdgeAttributes(edge, cleanAttributes({ ...attrs, ...metricAttributes }));
  });

  graph.mergeAttributes(cleanAttributes({
    ...metrics.graph,
    metricsMetadata: metrics.metadata,
    directed,
    bipartite,
  }));
  return graph;
}

export function graphToRaw(graph: Graph): { nodes: RawNode[]; edges: RawEdge[] } {
  const nodes: RawNode[] = graph.mapNodes((id, attrs) => ({
    ...cleanAttributes(attrs),
    id: String(id),
    name: String(attrs.name ?? attrs.label ?? id),
    label: String(attrs.label ?? attrs.name ?? id),
    abundance: numeric(attrs.abundance ?? attrs.size, 10),
  })) as RawNode[];

  const edges: RawEdge[] = graph.mapEdges((key, attrs, source, target) => ({
    ...cleanAttributes(attrs),
    key,
    source: String(source),
    target: String(target),
    weight_raw: numeric(attrs.weight_raw ?? attrs.weight, 1),
    weight_secondary: numeric(attrs.weight_secondary ?? attrs.weight_raw ?? attrs.weight, 1),
  })) as RawEdge[];

  return { nodes, edges };
}

function graphFromSerialized(serialized: any): Graph {
  if (!serialized || !Array.isArray(serialized.nodes) || !Array.isArray(serialized.edges)) {
    throw new Error('Invalid Graphology JSON: missing serialized nodes or edges.');
  }
  const options = serialized.options || {};
  const graph = new (Graph as any)({
    type: options.type || 'mixed',
    multi: Boolean(options.multi),
    allowSelfLoops: options.allowSelfLoops !== false,
  });
  graph.import(serialized);
  return graph;
}

function normalizeParsedGraph(graph: Graph, metadata: Record<string, any> = {}): ParsedNetwork {
  let embeddedGraphMetrics: Record<string, any> = {};
  let embeddedMetricsMetadata: Record<string, any> = {};
  graph.forEachNode((node, attrs) => {
    if (typeof attrs.__mineGraphMetrics === 'string') {
      try { embeddedGraphMetrics = JSON.parse(attrs.__mineGraphMetrics); } catch { /* retain the graph even if embedded metadata is malformed */ }
    }
    if (typeof attrs.__mineMetricsMetadata === 'string') {
      try { embeddedMetricsMetadata = JSON.parse(attrs.__mineMetricsMetadata); } catch { /* retain the graph even if embedded metadata is malformed */ }
    }
    if (attrs.__mineGraphMetrics !== undefined || attrs.__mineMetricsMetadata !== undefined) {
      graph.removeNodeAttribute(node, '__mineGraphMetrics');
      graph.removeNodeAttribute(node, '__mineMetricsMetadata');
    }
  });
  if (Object.keys(embeddedGraphMetrics).length) graph.mergeAttributes(embeddedGraphMetrics);
  if (Object.keys(embeddedMetricsMetadata).length && !graph.hasAttribute('metricsMetadata')) {
    graph.setAttribute('metricsMetadata', JSON.stringify(embeddedMetricsMetadata));
  }
  const booleanValue = (value: unknown, fallback: boolean) => {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'string') return value.trim().toLowerCase() === 'true' || value.trim() === '1';
    return Boolean(value);
  };
  const directed = booleanValue(metadata.directed ?? graph.getAttribute('directed'), graph.type === 'directed');
  const partitionValues = new Set<string>();
  graph.forEachNode((node, attrs) => {
    if (!meaningful(attrs.partition)) {
      const legacyPartition = attrs.bipartite ?? attrs.set ?? attrs.group
        ?? (attrs.type === 'A' || attrs.type === 'B' ? attrs.type : undefined);
      if (meaningful(legacyPartition)) graph.setNodeAttribute(node, 'partition', legacyPartition);
    }
    const normalizedAttrs = graph.getNodeAttributes(node);
    if (meaningful(normalizedAttrs.partition)) partitionValues.add(String(normalizedAttrs.partition));
  });
  let bipartite = booleanValue(metadata.bipartite ?? graph.getAttribute('bipartite'), false);
  if (!bipartite && partitionValues.size === 2) {
    try {
      bipartite = isBipartiteBy(graph, 'partition');
    } catch {
      bipartite = false;
    }
  }
  if (bipartite && partitionValues.size) {
    const partitionIndexes = new Map(orderPartitionValues(partitionValues).map((value, index) => [value, index]));
    graph.forEachNode((node, attrs) => {
      if (meaningful(attrs.partition)) {
        const role = explicitPartitionRole(attrs.partition);
        if (role !== null) {
          graph.setNodeAttribute(node, 'partition', role ? 'B' : 'A');
          graph.setNodeAttribute(node, 'partitionIndex', role ? 1 : 0);
        } else {
          graph.setNodeAttribute(node, 'partitionIndex', partitionIndexes.get(String(attrs.partition)) ?? 0);
        }
      } else {
        graph.setNodeAttribute(node, 'partition', 'A');
        graph.setNodeAttribute(node, 'partitionIndex', 0);
      }
    });
    graph.setAttribute('partitionAttribute', 'partition');
  } else if (bipartite) {
    graph.forEachNode((node, attrs) => {
      const role = explicitPartitionRole(attrs.partition);
      graph.setNodeAttribute(node, 'partition', role ? 'B' : 'A');
      graph.setNodeAttribute(node, 'partitionIndex', role ? 1 : 0);
    });
    graph.setAttribute('partitionAttribute', 'partition');
  }
  const weighted = booleanValue(
    metadata.weighted ?? graph.getAttribute('weighted'),
    graph.someEdge((_edge, attrs) => numeric(attrs.weight_raw ?? attrs.weight, 1) !== 1),
  );
  graph.setAttribute('directed', directed);
  graph.setAttribute('bipartite', bipartite);
  graph.setAttribute('weighted', weighted);
  const metricNames = new Set([
    'community', 'deltaQ', 'k_i_in', 'nodeDegree', 'communityDegree', 'degree', 'inDegree', 'outDegree',
    'degreeCentrality', 'inDegreeCentrality', 'outDegreeCentrality', 'betweenness', 'closeness', 'clustering',
    'pagerank', 'eigenvector', 'eccentricity', 'weightedDegree', 'weightedInDegree', 'weightedOutDegree',
    'hub', 'authority', 'louvain', 'edgeBetweenness', 'disparity',
    'simmelianStrength', 'chiSquare', 'gSquare',
  ]);
  const metrics: ImportedMetricsBundle = { graph: {}, nodes: {}, edges: {}, metadata: {} };
  graph.forEachNode((node, attrs) => {
    const values = Object.fromEntries(Object.entries(attrs).filter(([key]) => metricNames.has(key)));
    if (Object.keys(values).length) metrics.nodes[node] = values;
  });
  graph.forEachEdge((edge, attrs, source, target) => {
    const values = Object.fromEntries(Object.entries(attrs).filter(([key]) => metricNames.has(key)));
    if (Object.keys(values).length) metrics.edges[edge || `${source}->${target}`] = values;
  });
  Object.entries(graph.getAttributes()).forEach(([key, value]) => {
    if (!['directed', 'bipartite', 'weighted', 'partitionAttribute', 'metricsMetadata'].includes(key)) metrics.graph[key] = value;
  });
  const rawMetadata = graph.getAttribute('metricsMetadata');
  if (typeof rawMetadata === 'string') {
    try { metrics.metadata = JSON.parse(rawMetadata); } catch { /* preserve valid graph even if metadata is opaque */ }
  }
  const hasMetrics = Object.keys(metrics.graph).length || Object.keys(metrics.nodes).length || Object.keys(metrics.edges).length || Object.keys(metrics.metadata).length;
  return { graph, directed, bipartite, weighted, metrics: hasMetrics ? metrics : null, workspace: null };
}

function parseJSONDocument(data: any): ParsedNetwork {
  if (data?.format === WORKSPACE_SETTINGS_FORMAT) {
    throw new Error('Workspace Settings JSON changes settings only and must be imported from Workspace controls.');
  }

  if (data?.format === NETWORK_WORKSPACE_FORMAT) {
    if (data.version !== GRAPH_IO_VERSION) throw new Error(`Unsupported All-in-One JSON version: ${data.version}`);
    const graph = graphFromSerialized(data.graph);
    const parsed = normalizeParsedGraph(graph, data.workspace?.graphMode || {});
    parsed.metrics = data.metrics || { ...EMPTY_METRICS };
    parsed.workspace = data.workspace || null;
    parsed.projectName = data.workspace?.projectName;
    return parsed;
  }

  if (Array.isArray(data?.nodes) && data.nodes.every((node: any) => 'key' in node)) {
    return normalizeParsedGraph(graphFromSerialized(data));
  }

  if (Array.isArray(data?.nodes) && Array.isArray(data?.edges)) {
    const directed = Boolean(data.directed ?? data.metadata?.directed);
    const bipartite = Boolean(data.bipartite ?? data.metadata?.bipartite);
    return normalizeParsedGraph(graphFromRaw(data.nodes, data.edges, directed, bipartite), { directed, bipartite });
  }

  throw new Error('Unrecognized JSON network format.');
}

async function parseCsvZip(file: File): Promise<ParsedNetwork> {
  const zip = await JSZip.loadAsync(file);
  const nodesEntry = zip.file('nodes.csv');
  const edgesEntry = zip.file('edges.csv');
  if (!nodesEntry || !edgesEntry) throw new Error('CSV ZIP must contain nodes.csv and edges.csv.');
  const [nodesText, edgesText, metadataText] = await Promise.all([
    nodesEntry.async('string'),
    edgesEntry.async('string'),
    zip.file('metadata.json')?.async('string') || Promise.resolve('{}'),
  ]);
  const parseRows = (text: string) => Papa.parse<Record<string, any>>(text, { header: true, skipEmptyLines: true, dynamicTyping: true }).data;
  const metadata = JSON.parse(metadataText || '{}');
  const parsed = normalizeParsedGraph(
    graphFromRaw(parseRows(nodesText) as RawNode[], parseRows(edgesText) as RawEdge[], Boolean(metadata.directed), Boolean(metadata.bipartite)),
    metadata,
  );
  if (metadata.metrics) {
    parsed.metrics = parsed.metrics || { ...EMPTY_METRICS, graph: {}, nodes: {}, edges: {}, metadata: {} };
    parsed.metrics.graph = { ...parsed.metrics.graph, ...(metadata.metrics.graph || {}) };
    parsed.metrics.metadata = { ...parsed.metrics.metadata, ...(metadata.metrics.metadata || {}) };
  }
  return parsed;
}

async function parseCsvPair(files: File[]): Promise<ParsedNetwork> {
  const nodesFile = files.find((file) => /nodes?\.csv$/i.test(file.name));
  const edgesFile = files.find((file) => /edges?\.csv$/i.test(file.name));
  if (!nodesFile || !edgesFile) throw new Error('Select both nodes.csv and edges.csv, or use the canonical CSV ZIP.');
  const parseRows = async (file: File) => Papa.parse<Record<string, any>>(await file.text(), { header: true, skipEmptyLines: true, dynamicTyping: true }).data;
  const [nodes, edges] = await Promise.all([parseRows(nodesFile), parseRows(edgesFile)]);
  const directed = edges.some((edge: any) => edge.directed === true);
  const bipartite = nodes.some((node: any) => meaningful(node.partition) && explicitPartitionRole(node.partition) !== null);
  return normalizeParsedGraph(graphFromRaw(nodes as RawNode[], edges as RawEdge[], directed, bipartite), { directed, bipartite });
}

export async function parseNetworkFiles(files: File[]): Promise<ParsedNetwork> {
  if (!files.length) throw new Error('No network file selected.');
  if (files.length > 1 || files[0].name.toLowerCase().endsWith('.csv')) return parseCsvPair(files);
  const file = files[0];
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.zip')) return parseCsvZip(file);
  const text = await file.text();
  if (lower.endsWith('.graphml') || lower.endsWith('.xml')) {
    return normalizeParsedGraph(parseGraphML(Graph as any, text, { addMissingNodes: true }) as Graph);
  }
  if (lower.endsWith('.gexf')) {
    return normalizeParsedGraph(parseGEXF(Graph as any, text, { addMissingNodes: true, allowUndeclaredAttributes: true }) as Graph);
  }
  return parseJSONDocument(JSON.parse(text));
}

export async function buildCsvZip(graph: Graph, metrics: ImportedMetricsBundle): Promise<Blob> {
  const raw = graphToRaw(graph);
  const zip = new JSZip();
  const withUnifiedFields = (rows: Record<string, any>[]) => {
    const fields = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
    return { fields, data: rows.map((row) => fields.map((field) => row[field] ?? '')) };
  };
  zip.file('nodes.csv', Papa.unparse(withUnifiedFields(raw.nodes)));
  zip.file('edges.csv', Papa.unparse(withUnifiedFields(raw.edges)));
  zip.file('metadata.json', JSON.stringify({
    format: 'graphology-csv-zip',
    version: GRAPH_IO_VERSION,
    directed: graph.type === 'directed',
    bipartite: Boolean(graph.getAttribute('bipartite')),
    weighted: Boolean(graph.getAttribute('weighted')),
    graph: graph.getAttributes(),
    metrics: { graph: metrics.graph, metadata: metrics.metadata },
  }, null, 2));
  return zip.generateAsync({ type: 'blob' });
}
