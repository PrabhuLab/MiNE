import assert from 'node:assert/strict';
import test from 'node:test';
import { UndirectedGraph } from 'graphology';

import { effectiveComputationEngine, effectiveRenderer, isLargeGraph } from '../services/engines/policy.ts';
import { buildAttributeRegistry, edgeColorDescriptors, edgeWeightDescriptors, nodeColorDescriptors, nodeSizeDescriptors } from '../services/attributes/registry.ts';
import { communityResultStyleSelection } from '../services/communities/types.ts';
import { automaticLouvainOnce, resetAutomaticLouvainForTests, shouldRunAutomaticLouvain, validSavedLouvainKey } from '../services/communities/automatic.ts';
import { migrateComputationPreference, migrateRendererPreference, migrateWorkspaceFilters } from '../services/graphIO/migrations.ts';
import { computeGraphLegendVisibility, computeLegendVisibility, legendItemId } from '../services/graphPresentation/legendVisibility.ts';
import { sortLegendEntries } from '../services/graphPresentation/legendOrdering.ts';
import { liveNumericValue } from '../services/graphStyles/liveUpdate.ts';
import { staleCalculationIds } from '../services/metrics/validity.ts';
import { degreeByNode, logarithmicNodeSize } from '../services/graphStyles/size.ts';
import { computeActiveNetwork, computeCommunityMetrics, computeTableDataEdges, computeTableDataNodes, filterNetworkByEdgeMetric, filterNetworkByNodeMetric } from '../lib/workspaceUtils.ts';
import { detectCustomAttributeType } from '../services/graphIO/customAttributes.ts';

test('large-graph boundaries prefer Cloud for auto routing without disabling Browser', () => {
  assert.equal(effectiveComputationEngine(6_999, 14_999, 'browser'), 'browser');
  assert.equal(effectiveComputationEngine(7_000, 14_999, 'browser'), 'browser');
  assert.equal(effectiveComputationEngine(6_999, 15_000, 'browser'), 'browser');
  assert.equal(effectiveComputationEngine(7_000, 15_000, 'auto'), 'cloud');
  assert.equal(effectiveComputationEngine(7_000, 15_000, 'cloud'), 'cloud');
  assert.equal(isLargeGraph(7_000, 0), true);
});

test('filtering does not affect a raw-count engine decision', () => {
  const nodes = Array.from({ length: 7_000 }, (_, index) => ({ id: String(index) }));
  const edges = [{ source: '0', target: '1', weight_raw: 1 }];
  const active = computeActiveNetwork(nodes, edges, { removedNodes: '0', edgeFilter: null });
  assert.equal(active.validNodes.length, 0);
  assert.equal(isLargeGraph(nodes.length, edges.length), true);
  assert.equal(effectiveComputationEngine(nodes.length, edges.length, 'browser'), 'browser');
});

test('rendering is independent from the resolved computation engine', () => {
  assert.equal(effectiveRenderer('sigma', 'browser'), 'sigma');
  assert.equal(effectiveRenderer('d3', 'cloud'), 'd3');
  assert.equal(effectiveRenderer('auto', 'browser'), 'd3');
  assert.equal(effectiveRenderer('auto', 'cloud'), 'sigma');
});

test('workspace migration maps legacy renderer and first edge filter', () => {
  const edges = [{ source: 'a', target: 'b', weight_raw: 2 }, { source: 'b', target: 'c', weight_raw: 8 }];
  assert.equal(migrateComputationPreference({ rendererEngine: 'd3' }, 10, 10), 'browser');
  assert.equal(migrateComputationPreference({ rendererEngine: 'sigma' }, 10, 10), 'cloud');
  assert.equal(migrateComputationPreference({ rendererEngine: 'auto' }, 7_000, 0), 'cloud');
  assert.equal(migrateRendererPreference({ rendererEngine: 'd3' }), 'd3');
  assert.equal(migrateRendererPreference({ rendererEngine: 'sigma' }), 'sigma');
  assert.equal(migrateRendererPreference({ rendererEngine: 'auto' }), 'auto');
  assert.deepEqual(migrateWorkspaceFilters({ weightFilters: [{ id: 'one', type: 'weight_raw', cutoff: 3 }, { id: 'two', type: 'weight_raw', cutoff: 7 }] }, edges), { attribute: 'weight_raw', min: 3, max: 8 });
});

test('attribute compatibility follows declared semantic type and scope', () => {
  const metadata = [
    { name: 'kind', label: 'Kind', scope: 'node', origin: 'uploaded', detectedType: 'nominal', selectedType: 'nominal', presentCount: 2 },
    { name: 'flag', label: 'Flag', scope: 'node', origin: 'uploaded', detectedType: 'binary', selectedType: 'binary', presentCount: 2 },
    { name: 'score', label: 'Score', scope: 'node', origin: 'metric', detectedType: 'continuous', selectedType: 'continuous', presentCount: 2 },
    { name: 'community_louvain', label: 'Louvain', scope: 'node', origin: 'community', detectedType: 'nominal', selectedType: 'nominal', presentCount: 2 },
    { name: 'class', label: 'Class', scope: 'edge', origin: 'uploaded', detectedType: 'ordinal', selectedType: 'ordinal', presentCount: 1 },
    { name: 'strength', label: 'Strength', scope: 'edge', origin: 'metric', detectedType: 'discrete', selectedType: 'discrete', presentCount: 1 },
  ];
  const registry = buildAttributeRegistry({ nodes: [{ kind: 'a', flag: true, score: 1, community_louvain: 'A' }, { kind: 'b', flag: false, score: 2, community_louvain: 'B' }], edges: [{ class: 'x', strength: 3 }], metadata });
  assert.deepEqual(nodeColorDescriptors(registry).map((item) => item.name), ['kind', 'flag', 'score', 'community_louvain']);
  assert.deepEqual(nodeSizeDescriptors(registry).map((item) => item.name), ['kind', 'flag', 'score', 'community_louvain']);
  assert.deepEqual(edgeColorDescriptors(registry).map((item) => item.name), ['class', 'strength']);
  assert.deepEqual(edgeWeightDescriptors(registry).map((item) => item.name), ['class', 'strength']);
});

test('sparse zero/one indicator attributes are detected as binary', () => {
  assert.equal(detectCustomAttributeType(['1', '', null, '1']), 'binary');
  assert.equal(detectCustomAttributeType(['0', '', undefined]), 'binary');
  assert.equal(detectCustomAttributeType(['0', '1', '0']), 'binary');
  assert.equal(detectCustomAttributeType(['2', '3']), 'binary');
  assert.equal(detectCustomAttributeType(['1', '2', '3']), 'discrete');
});

test('degree uses the shared logarithmic size transform without amplification', () => {
  const nodes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const degree = degreeByNode(nodes, [{ source: 'a', target: 'b' }, { source: 'a', target: 'c' }]);
  assert.deepEqual(degree, { a: 2, b: 1, c: 1 });
  assert.equal(logarithmicNodeSize(degree.a, 3), 3 * Math.log(4) + 2);
});

test('degree and calculated numerical metrics filter nodes without recalculating the source metric', () => {
  const nodes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const edges = [{ source: 'a', target: 'b' }, { source: 'b', target: 'c' }];
  const metrics = [{ id: 'a', degree: 1, pagerank: 0.2 }, { id: 'b', degree: 2, pagerank: 0.6 }, { id: 'c', degree: 1, pagerank: 0.2 }];
  const byDegree = filterNetworkByNodeMetric(nodes, edges, { attribute: 'degree', min: 2, max: 2 }, metrics);
  assert.deepEqual(byDegree.validNodes.map((node) => node.id), ['b']);
  assert.deepEqual(byDegree.validEdges, []);
  const byMetric = filterNetworkByNodeMetric(nodes, edges, { attribute: 'pagerank', min: 0.5, max: 1 }, metrics);
  assert.deepEqual(byMetric.validNodes.map((node) => node.id), ['b']);
  assert.equal(metrics[1].pagerank, 0.6);
});

test('calculated numerical edge metrics filter presentation edges without changing nodes', () => {
  const nodes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const edges = [{ key: 'ab', source: 'a', target: 'b' }, { key: 'bc', source: 'b', target: 'c' }];
  const result = filterNetworkByEdgeMetric(nodes, edges, { attribute: 'edgeBetweenness', min: 0.5, max: 1, source: 'metric' }, [
    { key: 'ab', edgeBetweenness: 0.25 }, { key: 'bc', edgeBetweenness: 0.75 },
  ]);
  assert.deepEqual(result.validNodes, nodes);
  assert.deepEqual(result.validEdges.map((edge) => edge.key), ['bc']);
});

test('node modularity contributions follow the igraph matrix formula and sum to Q', () => {
  const graph = new UndirectedGraph();
  graph.addNode('a'); graph.addNode('b'); graph.addNode('c'); graph.addNode('d');
  graph.addEdge('a', 'b', { weight: 1 });
  graph.addEdge('c', 'd', { weight: 1 });
  const metrics = computeCommunityMetrics(graph, { a: 0, b: 0, c: 1, d: 1 }, false, 1);
  assert.ok(metrics.every((entry) => Math.abs(entry.louvainDeltaQ - 0.25) < 1e-12));
  assert.ok(Math.abs(metrics.reduce((sum, entry) => sum + entry.modularityContribution, 0) - 0.5) < 1e-12);
  const resolutionTwo = computeCommunityMetrics(graph, { a: 0, b: 0, c: 1, d: 1 }, false, 2);
  assert.ok(Math.abs(resolutionTwo.reduce((sum, entry) => sum + entry.modularityContribution, 0)) < 1e-12);
});

test('community completion selects node color and source-derived edge color', () => {
  assert.deepEqual(communityResultStyleSelection('community_leiden'), {
    customNodeAttribute: 'community_leiden',
    nodeColorBase: 'custom',
    edgeColorBase: 'nodeMetric',
    edgeColorNodeMetric: 'custom:community_leiden',
    edgeColorNodeTarget: 'source',
  });
});

test('legend visibility has node- and edge-attribute hide/isolate parity', () => {
  const nodes = ['a', 'b', 'c', 'd'];
  const edges = [
    { id: 'ab', source: 'a', target: 'b' },
    { id: 'bc', source: 'b', target: 'c' },
    { id: 'cd', source: 'c', target: 'd' },
  ];
  const red = legendItemId('node', 'kind', 'red / blue');
  const strong = legendItemId('edge', 'class', 'strong:edge');
  const nodeMembership = new Map([[red, new Set(['a', 'b'])]]);
  const edgeMembership = new Map([[strong, new Set(['bc'])]]);
  const hidden = computeLegendVisibility({ nodeIds: nodes, edges, hiddenItemIds: [red], isolatedItemId: null, nodeMembership, edgeMembership });
  assert.deepEqual([...hidden.visibleNodeIds], ['c', 'd']);
  assert.deepEqual([...hidden.visibleEdgeIds], ['cd']);
  const isolatedNode = computeLegendVisibility({ nodeIds: nodes, edges, hiddenItemIds: [], isolatedItemId: red, nodeMembership, edgeMembership });
  assert.deepEqual([...isolatedNode.visibleNodeIds], ['a', 'b', 'c']);
  assert.deepEqual([...isolatedNode.visibleEdgeIds], ['ab', 'bc']);
  const isolatedEdge = computeLegendVisibility({ nodeIds: nodes, edges, hiddenItemIds: [], isolatedItemId: strong, nodeMembership, edgeMembership });
  assert.deepEqual([...isolatedEdge.visibleNodeIds], ['b', 'c']);
  assert.deepEqual([...isolatedEdge.visibleEdgeIds], ['bc']);
  assert.match(red, /^attribute:node:/);
  assert.ok(red.includes('%2F'));
});

test('legend communities and metrics use alphabetical and numerical ordering', () => {
  const communities = [
    { label: 'Community 10' },
    { label: 'zebra' },
    { label: 'Community 2' },
    { label: 'alpha' },
  ];
  const metrics = [
    { title: 'Metric 12' },
    { title: 'metric 2' },
    { title: 'Degree' },
  ];

  assert.deepEqual(
    sortLegendEntries(communities, (entry) => entry.label).map((entry) => entry.label),
    ['alpha', 'Community 2', 'Community 10', 'zebra'],
  );
  assert.deepEqual(
    sortLegendEntries(metrics, (entry) => entry.title).map((entry) => entry.title),
    ['Degree', 'metric 2', 'Metric 12'],
  );
  assert.deepEqual(communities.map((entry) => entry.label), [
    'Community 10',
    'zebra',
    'Community 2',
    'alpha',
  ]);
});

test('Edges element isolation hides nodes and retains visible edges', () => {
  const result = computeGraphLegendVisibility({
    nodes: [{ id: 'a' }, { id: 'b' }, { id: 'isolated' }],
    edges: [{ id: 'ab', source: 'a', target: 'b' }],
    bipartite: false,
    isSecondaryNode: () => false,
    displayMap: {},
    hiddenItemIds: [],
    isolatedItemId: 'element:edges',
  });
  assert.deepEqual([...result.visibleNodeIds], []);
  assert.deepEqual([...result.visibleEdgeIds], ['ab']);
});

test('built-in bipartite node element isolation keeps only the selected partition', () => {
  const input = {
    nodes: [{ id: 'a1', partition: 'A' }, { id: 'a2', partition: 'A' }, { id: 'b1', partition: 'B' }],
    edges: [{ id: 'a1b1', source: 'a1', target: 'b1' }, { id: 'a2b1', source: 'a2', target: 'b1' }],
    bipartite: true,
    isSecondaryNode: (node) => node.partition === 'B',
    displayMap: {},
    hiddenItemIds: [],
  };
  const primary = computeGraphLegendVisibility({ ...input, isolatedItemId: 'element:standard' });
  assert.deepEqual([...primary.visibleNodeIds], ['a1', 'a2']);
  assert.deepEqual([...primary.visibleEdgeIds], []);
  const secondary = computeGraphLegendVisibility({ ...input, isolatedItemId: 'element:bipartite' });
  assert.deepEqual([...secondary.visibleNodeIds], ['b1']);
  assert.deepEqual([...secondary.visibleEdgeIds], []);
});

test('automatic Louvain is de-duplicated and valid saved results are reused', async () => {
  resetAutomaticLouvainForTests();
  let calls = 0;
  const create = async () => { calls += 1; return 'done'; };
  const [first, second] = await Promise.all([automaticLouvainOnce('graph-1', create), automaticLouvainOnce('graph-1', create)]);
  assert.equal(first, 'done');
  assert.equal(second, 'done');
  assert.equal(calls, 1);
  assert.equal(validSavedLouvainKey({
    validity: { community_louvain: { graphRevision: 'g', filterRevision: 'f', calculatedAt: 'now' } },
    graphRevision: 'g', filterRevision: 'f', nodeIds: ['a', 'b'],
    nodes: { a: { community_louvain: 'A', louvainDeltaQ: 0.1 }, b: { community_louvain: 'B', louvainDeltaQ: 0.2 } },
  }), 'community_louvain');
});

test('automatic Louvain is skipped at either inclusive raw-count cutoff', () => {
  assert.equal(shouldRunAutomaticLouvain(6_999, 14_999), true);
  assert.equal(shouldRunAutomaticLouvain(7_000, 14_999), false);
  assert.equal(shouldRunAutomaticLouvain(6_999, 15_000), false);
  assert.equal(shouldRunAutomaticLouvain(7_000, 15_000), false);
});

test('stale calculations require a prior result and an applied topology revision change', () => {
  assert.deepEqual(staleCalculationIds({}, 'g', 'f2'), []);
  const validity = { community_louvain: { graphRevision: 'g', filterRevision: 'f1', calculatedAt: 'now' } };
  assert.deepEqual(staleCalculationIds(validity, 'g', 'f1'), []);
  assert.deepEqual(staleCalculationIds(validity, 'g', 'f2'), ['community_louvain']);
  assert.deepEqual(staleCalculationIds(validity, 'other-graph', 'f2'), []);
});

test('numeric customization values always enter draft state for live or deferred application', () => {
  assert.equal(liveNumericValue('2.5', true), 2.5);
  assert.equal(liveNumericValue('2.5', false), 2.5);
  assert.equal(liveNumericValue('', true), undefined);
});

test('metric projections flatten node and edge result records for tables', () => {
  const nodes = computeTableDataNodes([{ id: 'a', name: 'A' }], [{ id: 'a', pagerank: 0.4 }], [{ id: 'a', community_leiden: 'Cluster 1' }], {}, '', null);
  const edges = computeTableDataEdges([{ key: 'ab', source: 'a', target: 'b', weight_raw: 2 }], [{ key: 'ab', edgeBetweenness: 0.7 }], '', null);
  assert.equal(nodes[0].pagerank, 0.4);
  assert.equal(nodes[0].community_leiden, 'Cluster 1');
  assert.equal(edges[0].edgeBetweenness, 0.7);
});
