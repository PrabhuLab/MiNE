import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLegendCategories } from '../services/graphStyles/categories.ts';
import { edgePath } from '../components/graph/d3/edgePath.ts';

const options = {
  nodes: [{ id: 'a', name: 'Alpha', type: 'mineral', kind: 'old' }, { id: 'b', name: 'Beta', type: 'mineral', kind: 'new' }],
  edges: [{ key: 'ab', source: 'a', target: 'b', class: 'link' }],
  communityDisplay: { displayMap: { a: 0, b: 1 }, rawToDisplayMap: { '42': 0, '99': 1 }, displayToRawMap: { 0: '42', 1: '99' } },
  netMap: new Map([['a', { kind: 'new' }]]),
  nodeColorBase: 'uniform', edgeColorBase: 'uniform', edgeColorNodeMetric: '', edgeColorNodeTarget: 'source',
  customAttributes: [
    { name: 'kind', scope: 'node', selectedType: 'nominal', shown: true },
    { name: 'class', scope: 'edge', selectedType: 'nominal', shown: true },
  ],
  legendColorOverrides: { 'community:42': '#123456', 'type:mineral': '#abcdef', 'attribute:kind=new': '#fedcba' },
  typeColorScale: () => '#888888',
};

test('categorical legends follow selected channels, preserve membership and honor overrides', () => {
  // Legacy shown flags must not add overlays to uniform channels.
  assert.deepEqual(buildLegendCategories(options), []);
  const communities = buildLegendCategories({ ...options, nodeColorBase: 'louvain' });
  assert.deepEqual(communities[0].items[0], {
    label: 'Community 0', id: 'community:0', color: '#123456', colorKey: 'community:42',
    nodes: ['Alpha'], nodeIds: ['a'], edgeIds: [], allIds: ['community:0', 'community:1'],
  });
  const types = buildLegendCategories({ ...options, edgeColorBase: 'nodeMetric', edgeColorNodeMetric: 'type', edgeColorNodeTarget: 'target' });
  assert.equal(types[0].title, 'Types · Edge color from target node');
  assert.equal(types[0].items[0].color, '#abcdef');
  assert.deepEqual(types[0].items[0].nodeIds, ['a', 'b']);

  const attributes = buildLegendCategories({ ...options, nodeColorBase: 'custom', customNodeAttribute: 'kind', edgeColorBase: 'edge:class' });
  assert.equal(attributes.length, 2);
  assert.equal(attributes[0].items.length, 1); // Calculated metadata overrides the uploaded value.
  assert.equal(attributes[0].items[0].color, '#fedcba');
  assert.deepEqual(attributes[0].items[0].nodeIds, ['a', 'b']);
  assert.deepEqual(attributes[1].items[0].edgeIds, ['ab']);
  const fromNode = buildLegendCategories({ ...options, edgeColorBase: 'nodeMetric', edgeColorNodeMetric: 'custom:kind' });
  assert.deepEqual(fromNode[0].items[0].nodeIds, ['a', 'b']);
  assert.equal(fromNode[0].items[0].color, '#fedcba');

  assert.deepEqual(buildLegendCategories({ ...options, nodeColorBase: 'custom', customNodeAttribute: 'kind', customAttributes: [{ name: 'kind', scope: 'node', selectedType: 'continuous' }] }), []);
  assert.deepEqual(buildLegendCategories({ ...options, nodes: [], edges: [], nodeColorBase: 'type' }), []);
});

test('D3 paths retain straight edges, finite coincident paths and circle/square boundary trimming', () => {
  const source = { x: 0, y: 0, currentRadius: 9 };
  const target = { x: 100, y: 0, currentRadius: 9, partition: 'B' };
  assert.equal(edgePath({ source, target }, false, true), 'M0,0L100,0');
  assert.equal(edgePath({ source, target: source }, true, true), 'M0,0L0,0');
  const coordinates = (path) => path.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g).map(Number);
  const circle = coordinates(edgePath({ source, target }, true, false));
  const square = coordinates(edgePath({ source, target }, true, true));
  assert.ok(Math.abs(Math.hypot(circle[0], circle[1]) - 10) < 1e-10);
  assert.ok(Math.abs(Math.hypot(100 - circle[4], circle[5]) - 10) < 1e-10);
  assert.ok(Math.abs(Math.max(Math.abs(100 - square[4]), Math.abs(square[5])) - 10) < 1e-10);
  const reverse = coordinates(edgePath({ source: target, target: source }, true, true));
  assert.ok(reverse[3] < 0 && square[3] > 0); // Reciprocal edges bend to opposite sides.
});
