import Graph, { UndirectedGraph } from 'graphology';
import type { SerializedGraph } from 'graphology-types';
import { parse as parseGraphML } from 'graphology-graphml';
import { parse as parseGEXF, write as writeGEXF } from 'graphology-gexf';
import clusters from 'graphology-generators/random/clusters';
import { isBipartiteBy } from 'graphology-bipartite';
import JSZip from 'jszip';
import Papa from 'papaparse';
import type {
  CustomAttributeType,
  CustomAttributeMetadata,
  ImportedMetricsBundle,
  RawEdge,
  RawNode,
  WorkspaceFilters,
} from '@/store/useStore';

export const NETWORK_WORKSPACE_FORMAT = 'network-workspace' as const;
export const WORKSPACE_SETTINGS_FORMAT = 'workspace-settings' as const;
export const GRAPH_IO_VERSION = 1 as const;

export interface WorkspaceSettingsDocument {
  format: typeof WORKSPACE_SETTINGS_FORMAT;
  version: typeof GRAPH_IO_VERSION;
  projectName: string;
  rendererEngine: 'auto' | 'd3' | 'sigma';
  graphMode: { directed: boolean; bipartite: boolean; weighted: boolean };
  filters: WorkspaceFilters;
  appearance: {
    isDarkMode: boolean;
    showNodeLabels: boolean;
    showArrowheads: boolean;
    communityMap: Record<string, string>;
    customAttributes?: CustomAttributeMetadata[];
  };
  visibility: {
    hiddenLegendItems: string[];
    isolatedLegendItem: string | null;
    isolatedCommunityId: string | null;
  };
  calculations: { selected: Record<string, boolean> };
  layout: { livePhysics: boolean; forceStrength: number };
}

export interface AllInOneDocument {
  format: typeof NETWORK_WORKSPACE_FORMAT;
  version: typeof GRAPH_IO_VERSION;
  graph: SerializedGraph;
  metrics: ImportedMetricsBundle;
  workspace: WorkspaceSettingsDocument;
}

export interface ParsedNetwork {
  graph: Graph;
  directed: boolean;
  bipartite: boolean;
  weighted: boolean;
  metrics: ImportedMetricsBundle | null;
  workspace: WorkspaceSettingsDocument | null;
  projectName?: string;
}

const EMPTY_METRICS: ImportedMetricsBundle = {
  graph: {},
  nodes: {},
  edges: {},
  metadata: {},
};

function meaningful(value: unknown): boolean {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function numeric(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function serializableValue(value: any): any {
  if (value === undefined || typeof value === 'function') return undefined;
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function cleanAttributes(attributes: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  Object.entries(attributes || {}).forEach(([key, value]) => {
    if (key === 'rawNode' || key === 'rawEdge') return;
    const cleaned = serializableValue(value);
    if (cleaned !== undefined) result[key] = cleaned;
  });
  return result;
}

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

  const partitionValues = new Map<string, number>();
  if (bipartite) {
    nodes.forEach((node) => {
      const value = meaningful(node.partition)
        ? node.partition
        : node.bipartite ?? node.group ?? (node.type === 'A' || node.type === 'B' ? node.type : undefined);
      if (meaningful(value) && !partitionValues.has(String(value))) partitionValues.set(String(value), partitionValues.size);
    });
  }

  nodes.forEach((node, index) => {
    const id = String(node.id ?? `node_${index}`);
    if (graph.hasNode(id)) return;
    const attributes = cleanAttributes({ ...node });
    delete attributes.id;
    attributes.label = node.label || node.name || id;
    attributes.name = node.name || node.label || id;
    attributes.abundance = numeric(node.abundance, 10);
    if (bipartite && !meaningful(attributes.partition)) {
      const legacyPartition = node.bipartite ?? node.group ?? (node.type === 'A' || node.type === 'B' ? node.type : undefined);
      if (meaningful(legacyPartition)) attributes.partition = legacyPartition;
    }
    if (bipartite && meaningful(attributes.partition)) {
      attributes.partitionIndex = partitionValues.get(String(attributes.partition)) ?? 0;
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
    attributes.weight_raw = numeric(edge.weight_raw, 1);
    attributes.weight_secondary = numeric(edge.weight_secondary, attributes.weight_raw);
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
    graph.mergeNodeAttributes(node, cleanAttributes({ ...metricAttributes, ...pos }));
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
  const directed = metadata.directed ?? graph.getAttribute('directed') ?? graph.type === 'directed';
  const partitionValues = new Set<string>();
  graph.forEachNode((_node, attrs) => {
    if (meaningful(attrs.partition)) partitionValues.add(String(attrs.partition));
  });
  let bipartite = Boolean(metadata.bipartite ?? graph.getAttribute('bipartite'));
  if (!bipartite && partitionValues.size === 2) {
    try {
      bipartite = isBipartiteBy(graph, 'partition');
    } catch {
      bipartite = false;
    }
  }
  if (bipartite && partitionValues.size) {
    const partitionIndexes = new Map(Array.from(partitionValues).map((value, index) => [value, index]));
    graph.forEachNode((node, attrs) => {
      if (meaningful(attrs.partition)) graph.setNodeAttribute(node, 'partitionIndex', partitionIndexes.get(String(attrs.partition)) ?? 0);
    });
    graph.setAttribute('partitionAttribute', 'partition');
  }
  const weighted = Boolean(
    metadata.weighted
      ?? graph.getAttribute('weighted')
      ?? graph.someEdge((_edge, attrs) => numeric(attrs.weight_raw ?? attrs.weight, 1) !== 1),
  );
  const metricNames = new Set([
    'community', 'deltaQ', 'k_i_in', 'nodeDegree', 'communityDegree', 'degree', 'inDegree', 'outDegree',
    'degreeCentrality', 'inDegreeCentrality', 'outDegreeCentrality', 'betweenness', 'closeness', 'clustering',
    'pagerank', 'eigenvector', 'eccentricity', 'weightedDegree', 'louvain', 'edgeBetweenness', 'disparity',
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
  return normalizeParsedGraph(
    graphFromRaw(parseRows(nodesText) as RawNode[], parseRows(edgesText) as RawEdge[], Boolean(metadata.directed), Boolean(metadata.bipartite)),
    metadata,
  );
}

async function parseCsvPair(files: File[]): Promise<ParsedNetwork> {
  const nodesFile = files.find((file) => /nodes?\.csv$/i.test(file.name));
  const edgesFile = files.find((file) => /edges?\.csv$/i.test(file.name));
  if (!nodesFile || !edgesFile) throw new Error('Select both nodes.csv and edges.csv, or use the canonical CSV ZIP.');
  const parseRows = async (file: File) => Papa.parse<Record<string, any>>(await file.text(), { header: true, skipEmptyLines: true, dynamicTyping: true }).data;
  const [nodes, edges] = await Promise.all([parseRows(nodesFile), parseRows(edgesFile)]);
  const directed = edges.some((edge: any) => edge.directed === true);
  const bipartite = nodes.some((node: any) => meaningful(node.partition));
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

export function createMetricsBundle(
  networkMetrics: any[],
  nodeMetrics: any[],
  edgeMetrics: any[],
  graphMetrics: Record<string, any>,
  metadata: Record<string, any>,
): ImportedMetricsBundle {
  const nodes: Record<string, Record<string, any>> = {};
  networkMetrics.forEach((entry) => { if (entry?.id !== undefined) nodes[String(entry.id)] = { ...entry }; });
  nodeMetrics.forEach((entry) => {
    if (entry?.id === undefined) return;
    nodes[String(entry.id)] = { ...(nodes[String(entry.id)] || {}), ...entry };
  });
  const edges: Record<string, Record<string, any>> = {};
  edgeMetrics.forEach((entry, index) => {
    const key = String(entry.key ?? (entry.source !== undefined ? `${entry.source}->${entry.target}` : index));
    edges[key] = { ...entry };
  });
  const calculatedGraphMetrics = Object.fromEntries(
    Object.entries(graphMetrics).filter(([, value]) => value !== null && value !== undefined && !(typeof value === 'number' && !Number.isFinite(value))),
  );
  return { graph: calculatedGraphMetrics, nodes, edges, metadata: { ...metadata } };
}

export function buildAllInOne(graph: Graph, metrics: ImportedMetricsBundle, workspace: WorkspaceSettingsDocument): AllInOneDocument {
  return { format: NETWORK_WORKSPACE_FORMAT, version: GRAPH_IO_VERSION, graph: graph.export(), metrics, workspace };
}

function xmlEscape(value: unknown): string {
  return String(value ?? '').replace(/[<>&'"]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[char]!));
}

function graphMlType(values: any[]): string {
  const meaningfulValues = values.filter(meaningful);
  if (meaningfulValues.length && meaningfulValues.every((value) => typeof value === 'boolean')) return 'boolean';
  if (meaningfulValues.length && meaningfulValues.every((value) => Number.isInteger(Number(value)))) return 'long';
  if (meaningfulValues.length && meaningfulValues.every((value) => Number.isFinite(Number(value)))) return 'double';
  return 'string';
}

export function writeGraphML(graph: Graph): string {
  const nodeKeys = new Set<string>();
  const edgeKeys = new Set<string>();
  const graphKeys = new Set<string>(Object.keys(graph.getAttributes()));
  graph.forEachNode((_node, attrs) => Object.keys(attrs).forEach((key) => nodeKeys.add(key)));
  graph.forEachEdge((_edge, attrs) => Object.keys(attrs).forEach((key) => edgeKeys.add(key)));
  const definitions: string[] = [];
  const nodeIds = new Map<string, string>();
  const edgeIds = new Map<string, string>();
  const graphIds = new Map<string, string>();
  Array.from(nodeKeys).sort().forEach((key, index) => {
    const id = `n${index}`; nodeIds.set(key, id);
    definitions.push(`<key id="${id}" for="node" attr.name="${xmlEscape(key)}" attr.type="${graphMlType(graph.mapNodes((_n, attrs) => attrs[key]))}"/>`);
  });
  Array.from(edgeKeys).sort().forEach((key, index) => {
    const id = `e${index}`; edgeIds.set(key, id);
    definitions.push(`<key id="${id}" for="edge" attr.name="${xmlEscape(key)}" attr.type="${graphMlType(graph.mapEdges((_e, attrs) => attrs[key]))}"/>`);
  });
  Array.from(graphKeys).sort().forEach((key, index) => {
    const id = `g${index}`; graphIds.set(key, id);
    definitions.push(`<key id="${id}" for="graph" attr.name="${xmlEscape(key)}" attr.type="${graphMlType([graph.getAttribute(key)])}"/>`);
  });
  const dataXml = (attrs: Record<string, any>, ids: Map<string, string>) => Object.entries(attrs)
    .filter(([key, value]) => ids.has(key) && meaningful(value))
    .map(([key, value]) => `<data key="${ids.get(key)}">${xmlEscape(serializableValue(value))}</data>`).join('');
  const nodes = graph.mapNodes((node, attrs) => `<node id="${xmlEscape(node)}">${dataXml(attrs, nodeIds)}</node>`).join('');
  const edges = graph.mapEdges((edge, attrs, source, target) => `<edge id="${xmlEscape(edge)}" source="${xmlEscape(source)}" target="${xmlEscape(target)}">${dataXml(attrs, edgeIds)}</edge>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><graphml xmlns="http://graphml.graphdrawing.org/xmlns">${definitions.join('')}<graph id="G" edgedefault="${graph.type === 'directed' ? 'directed' : 'undirected'}">${dataXml(graph.getAttributes(), graphIds)}${nodes}${edges}</graph></graphml>`;
}

export function writeGexf(graph: Graph): string {
  return writeGEXF(graph, {
    pretty: true,
    version: '1.3',
    formatNode: (_key: string, attrs: Record<string, any>) => ({
      label: String(attrs.label ?? attrs.name ?? ''),
      attributes: cleanAttributes(attrs),
      viz: {
        color: attrs.color,
        x: Number.isFinite(Number(attrs.x)) ? Number(attrs.x) : undefined,
        y: Number.isFinite(Number(attrs.y)) ? Number(attrs.y) : undefined,
        size: Number.isFinite(Number(attrs.size)) ? Number(attrs.size) : undefined,
        shape: attrs.shape,
      },
    }),
    formatEdge: (_key: string, attrs: Record<string, any>) => ({
      label: attrs.label,
      attributes: cleanAttributes(attrs),
      weight: numeric(attrs.weight_raw ?? attrs.weight, 1),
      viz: { color: attrs.color, thickness: attrs.size },
    }),
  } as any);
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

export function detectCustomAttributeType(values: unknown[]): CustomAttributeType {
  const distinct = Array.from(new Set(values.filter(meaningful).map((value) => typeof value === 'string' ? value.trim() : value)));
  if (distinct.length === 2) return 'binary';
  if (distinct.length && distinct.every((value) => Number.isFinite(Number(value)))) {
    return distinct.every((value) => Number.isInteger(Number(value))) ? 'discrete' : 'continuous';
  }
  return 'nominal';
}

export function availableCustomNodeAttributes(nodes: RawNode[]): string[] {
  const consumed = new Set([
    'id', 'name', 'label', 'source', 'target', 'weight', 'weight_raw', 'weight_secondary',
    'partition', 'partitionIndex', 'type', 'group', 'bipartite', 'set', 'community', 'abundance', 'x', 'y',
    'louvain', 'deltaQ', 'k_i_in', 'nodeDegree', 'communityDegree', 'degree', 'inDegree', 'outDegree',
    'degreeCentrality', 'inDegreeCentrality', 'outDegreeCentrality', 'betweenness', 'closeness', 'clustering',
    'pagerank', 'eigenvector', 'eccentricity', 'weightedDegree',
  ]);
  const keys = new Set<string>();
  nodes.forEach((node) => Object.keys(node).forEach((key) => { if (!consumed.has(key)) keys.add(key); }));
  return Array.from(keys).sort();
}

export function createRandomClusterAllInOne(
  options: { order: number; size: number; clusters: number; clusterDensity: number },
  workspace: WorkspaceSettingsDocument,
): AllInOneDocument {
  const graph = clusters(UndirectedGraph as any, options) as Graph;
  graph.forEachNode((node, attrs) => graph.mergeNodeAttributes(node, {
    label: `Node ${node}`,
    name: `Node ${node}`,
    abundance: 10,
    community: attrs.cluster,
  }));
  graph.forEachEdge((edge) => graph.mergeEdgeAttributes(edge, { weight: 1, weight_raw: 1, weight_secondary: 1 }));
  graph.setAttribute('directed', false);
  graph.setAttribute('bipartite', false);
  graph.setAttribute('weighted', false);
  return buildAllInOne(graph, { ...EMPTY_METRICS }, { ...workspace, graphMode: { directed: false, bipartite: false, weighted: false } });
}
