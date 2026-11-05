import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import Papa from 'papaparse';
import { constructGraph } from '../components/upload/utils/graphConstructors.ts';

const parseFixture = async (name) => {
  const csv = await readFile(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
  return Papa.parse(csv, { skipEmptyLines: true }).data;
};

const baseMapping = {
  sourceCol: '', adjSourceCol: '', targetCol: '', weightRawCol: '', weightSecCol: '',
  nodeIdCol: 'Mode #', nodeLabelCol: 'Mode Name', nodePartitionCol: '', nodeCommunityCol: '',
  rowHeadersCol: 0, colHeadersRow: 0, dataStartRow: 1, dataStartCol: 1,
};

test('incidence metadata patches labels and custom fields without replacing identity or partition', async () => {
  const matrix = await parseFixture('incidence-mode-metadata.csv');
  const nodes = await parseFixture('mode-node-metadata.csv');
  const graph = constructGraph({ matrix, nodes }, 'Incidence Matrix', baseMapping, false, 'Bipartite', false);

  const p1 = graph.nodes.find((node) => node.id === 'p1');
  assert.equal(p1?.name, 'Stellar');
  assert.equal(p1?.label, 'Stellar');
  assert.equal(p1?.partition, 'B');
  assert.equal(p1?.Primary, 'Yes');
  assert.equal(p1?.Abiotic, 'Yes');
  assert.equal(p1?.Water, 'No');
  assert.equal(graph.nodes.find((node) => node.id === 'Quartz')?.partition, 'A');
  assert.equal(graph.nodes.find((node) => node.id === 'Calcite')?.partition, 'A');
  assert.equal(graph.nodes.some((node) => node.id === 'not-in-topology'), false);
});

test('explicit numeric zero partitions survive metadata patching', () => {
  const graph = constructGraph({
    edges: [['source', 'target'], ['a', 'b']],
    nodes: [['id', 'label'], ['a', 'Alpha'], ['b', 'Beta']],
  }, 'Bipartite Edge List', {
    ...baseMapping,
    sourceCol: 'source', targetCol: 'target', nodeIdCol: 'id', nodeLabelCol: 'label',
  }, false, 'Bipartite', false);
  assert.equal(graph.nodes.find((node) => node.id === 'a')?.partition, 'A');
  assert.equal(graph.nodes.find((node) => node.id === 'b')?.partition, 'B');

  const explicitZero = constructGraph({
    edges: [['source', 'target'], ['a', 'b']],
    nodes: [['id', 'partition'], ['a', 0], ['b', 1]],
  }, 'Bipartite Edge List', {
    ...baseMapping,
    sourceCol: 'source', targetCol: 'target', nodeIdCol: 'id', nodeLabelCol: '', nodePartitionCol: 'partition',
  }, false, 'Bipartite', false);
  assert.equal(explicitZero.nodes.find((node) => node.id === 'a')?.partition, 0);
  assert.equal(explicitZero.nodes.find((node) => node.id === 'b')?.partition, 1);
});

test('optional node and edge metadata enrich every matrix/list structure without consuming custom columns', () => {
  const nodes = [['id', 'label', 'role'], ['a', 'Alpha', 'producer'], ['b', 'Beta', 'consumer']];
  const additionalEdges = [['source', 'target', 'confidence'], ['a', 'b', 'high']];
  const mapping = { ...baseMapping, sourceCol: 'source', targetCol: 'target', weightRawCol: '', nodeIdCol: 'id', nodeLabelCol: 'label' };
  const cases = [
    ['Adjacency Matrix', { matrix: [['id', 'a', 'b'], ['a', 0, 1], ['b', 1, 0]], nodes, additionalEdges }, 'Unipartite', false],
    ['Incidence Matrix', { matrix: [['id', 'b'], ['a', 1]], nodes, additionalEdges }, 'Bipartite', false],
    ['Adjacency List', { adjList: [['source', 'neighbors'], ['a', 'b'], ['b', 'a']], nodes, additionalEdges }, 'Unipartite', false],
    ['Dual Adjacency Matrix', {
      counts: [['id', 'a', 'b'], ['a', 0, 2], ['b', 2, 0]],
      percentages: [['id', 'a', 'b'], ['a', 0, 0.5], ['b', 0.5, 0]],
      nodes,
      additionalEdges,
    }, 'Unipartite', true],
  ];

  for (const [format, data, topology, weighted] of cases) {
    const graph = constructGraph(data, format, { ...mapping, adjSourceCol: 'source' }, false, topology, weighted);
    assert.equal(graph.nodes.find((node) => node.id === 'a')?.role, 'producer', `${format} node metadata`);
    assert.equal(graph.edges.find((edge) => edge.source === 'a' && edge.target === 'b')?.confidence, 'high', `${format} edge metadata`);
  }
});

test('secondary weights remain absent unless the input explicitly supplies them', () => {
  const adjacency = constructGraph(
    { matrix: [['id', 'a', 'b'], ['a', 0, 2], ['b', 2, 0]] },
    'Single Weighted Adjacency Matrix',
    baseMapping,
    false,
    'Unipartite',
    true,
  );
  assert.equal(adjacency.edges.every((edge) => edge.weight_secondary === undefined), true);

  const dual = constructGraph({
    counts: [['id', 'a', 'b'], ['a', 0, 2], ['b', 2, 0]],
    percentages: [['id', 'a', 'b'], ['a', 0, 0.5], ['b', 0.5, 0]],
  }, 'Dual Adjacency Matrix', baseMapping, false, 'Unipartite', true);
  assert.equal(dual.edges.every((edge) => edge.weight_secondary === 0.5), true);

  const edgeList = constructGraph({ edges: [['source', 'target', 'primary', 'secondary'], ['a', 'b', 4, 0.25]] }, 'Weighted Edge List', {
    ...baseMapping,
    sourceCol: 'source', targetCol: 'target', weightRawCol: 'primary', weightSecCol: 'secondary',
  }, false, 'Unipartite', true);
  assert.equal(edgeList.edges[0].weight_secondary, 0.25);
});

test('multiple metadata lists use independent mappings and preserve bipartite topology', () => {
  const metadataTables = [
    { name: 'left.csv', kind: 'nodes', data: [['left_id', 'title', 'role'], ['a', 'Alpha', 'producer']], mapping: { ...baseMapping, nodeIdCol: 'left_id', nodeLabelCol: 'title' } },
    { name: 'right.csv', kind: 'nodes', data: [['right_id', 'name', 'category'], ['b', 'Beta', 'mineral']], mapping: { ...baseMapping, nodeIdCol: 'right_id', nodeLabelCol: 'name' } },
    { name: 'labels.csv', kind: 'nodes', data: [['key', 'label', 'role'], ['a', '', 'updated']], mapping: { ...baseMapping, nodeIdCol: 'key', nodeLabelCol: 'label' } },
    { name: 'weights.csv', kind: 'edges', data: [['from', 'to', 'strength'], ['a', 'b', 5]], mapping: { ...baseMapping, sourceCol: 'from', targetCol: 'to', weightRawCol: 'strength' } },
    { name: 'confidence.csv', kind: 'edges', data: [['src', 'dst', 'confidence', 'weight'], ['b', 'a', 'high', ''], ['x', 'y', 'ignored', 9]], mapping: { ...baseMapping, sourceCol: 'src', targetCol: 'dst', weightRawCol: 'weight' } },
  ];
  for (const [format, data] of [
    ['Incidence Matrix', { matrix: [['id', 'b'], ['a', 1]] }],
    ['Bipartite Edge List', { edges: [['source', 'target'], ['a', 'b']] }],
  ]) {
    const graph = constructGraph({ ...data, metadataTables }, format, { ...baseMapping, sourceCol: 'source', targetCol: 'target' }, false, 'Bipartite', true);
    assert.equal(graph.nodes.length, 2);
    assert.equal(graph.edges.length, 1);
    assert.equal(graph.nodes.find((node) => node.id === 'a').label, 'Alpha');
    assert.equal(graph.nodes.find((node) => node.id === 'a').role, 'updated');
    assert.equal(graph.nodes.find((node) => node.id === 'a').partition, 'A');
    assert.equal(graph.nodes.find((node) => node.id === 'b').label, 'Beta');
    assert.equal(graph.nodes.find((node) => node.id === 'b').category, 'mineral');
    assert.equal(graph.nodes.find((node) => node.id === 'b').partition, 'B');
    assert.equal(graph.edges[0].weight_raw, 5);
    assert.equal(graph.edges[0].confidence, 'high');
  }
  const directed = constructGraph({ edges: [['source', 'target'], ['a', 'b']], metadataTables }, 'Directed Bipartite Edge List', { ...baseMapping, sourceCol: 'source', targetCol: 'target' }, true, 'Bipartite', true);
  assert.equal(directed.edges[0].weight_raw, 5);
  assert.equal(directed.edges[0].confidence, undefined);
});


test('ignored mappings do not read an unnamed CSV column as partition, community, or weight', () => {
  const mapping = { ...baseMapping, nodeIdCol: 'id', nodeLabelCol: '', sourceCol: 'source', targetCol: 'target' };
  const graph = constructGraph({
    matrix: [['id', 'p1', 'p2'], ['Quartz', 1, 1]],
    metadataTables: [
      { kind: 'nodes', data: [['id', ''], ['p1', '2'], ['p2', '7']], mapping },
      { kind: 'edges', data: [['source', 'target', ''], ['Quartz', 'p1', '99']], mapping },
    ],
  }, 'Incidence Matrix', mapping, false, 'Bipartite', false);
  assert.deepEqual(graph.nodes.map((node) => node.partition), ['B', 'B', 'A']);
  assert.equal(graph.nodes[0].name, 'p1');
  assert.equal(graph.nodes[0].community, undefined);
  assert.equal(graph.edges[0].weight_raw, 1);
  assert.equal(graph.edges[0].weight_secondary, undefined);
});
