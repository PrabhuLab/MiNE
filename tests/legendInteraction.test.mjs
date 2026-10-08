import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { UndirectedGraph } from 'graphology';
import { createSigmaNodeReducer, createSigmaEdgeReducer } from '../components/graph/sigma/reducers.ts';
import { isSecondaryNode } from '../services/graphPresentation/visibility.ts';
import { sortLegendEntries } from '../services/graphPresentation/legendOrdering.ts';

const require = createRequire(import.meta.url);
function load(path, overrides) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } });
  const exports = {};
  new Function('require', 'exports', compiled.outputText)((name) => overrides[name] ?? require(name), exports);
  return exports;
}
const { getD3NodePresentation, getD3EdgePresentation } = load('../components/graph/d3/presentation.ts', {
  '@/services/graphPresentation/visibility': { isSecondaryNode },
});

for (const id of ['community:0', 'attribute:node:cluster:A', 'type:mineral']) {
  test(`both renderers highlight ${id} without hiding other groups`, () => {
    const context = {
      bipartite: false, directed: false, hiddenItems: new Set(), isolatedLegendItem: null,
      isolatedCommunityId: null, selectedCommunityId: id, displayMap: { a: 0, b: 0, c: 1, d: 1 },
      clickedNodeId: null, clickedEdge: null, clickedNodeRef: { current: null }, clickedEdgeRef: { current: null },
      selectedNeighborSet: new Set(), searchMatchSet: new Set(), focusedEdgeNodeSet: new Set(),
      showNodeLabels: false, nodeOpacity: 1,
      legendNodeMembership: new Map([[id, new Set(['a', 'b'])]]), legendEdgeMembership: new Map(),
      legendVisibility: { isNodeVisible: () => true, isEdgeVisible: () => true }, getShouldShowArrowhead: () => false,
    };
    const refs = { current: context };
    const graph = new UndirectedGraph();
    const nodeStates = new Map();
    const sigmaNode = createSigmaNodeReducer(refs);
    for (const key of ['a', 'b', 'c', 'd']) {
      graph.addNode(key);
      const result = getD3NodePresentation({ id: key }, context);
      nodeStates.set(key, result);
      assert.equal(result.hidden, false);
      assert.equal(result.opacity, key === 'a' || key === 'b' ? 1 : 0.1);
      assert.equal(sigmaNode(key, { opacity: 1 }).opacity, result.opacity);
    }
    graph.addEdgeWithKey('ab', 'a', 'b', { rawEdge: { key: 'ab', source: 'a', target: 'b' } });
    graph.addEdgeWithKey('cd', 'c', 'd', { rawEdge: { key: 'cd', source: 'c', target: 'd' } });
    const sigmaEdge = createSigmaEdgeReducer(graph, refs);
    for (const [key, source, target] of [['ab', 'a', 'b'], ['cd', 'c', 'd']]) {
      const result = getD3EdgePresentation(source, target, { key, source, target }, 0.5, context, nodeStates);
      assert.equal(result.hidden, false);
      assert.equal(result.opacity, key === 'ab' ? 0.75 : 0.05);
      assert.equal(sigmaEdge(key, { opacity: 0.5 }).opacity, result.opacity);
    }
    context.selectedCommunityId = null;
    assert.equal(getD3NodePresentation({ id: 'c' }, context).opacity, 1);
    assert.equal(sigmaNode('c', { opacity: 1 }).opacity, 1);
  });
}

test('edge attribute groups highlight only matching edges in both renderers', () => {
  const id = 'attribute:edge:cluster:A';
  const context = {
    selectedCommunityId: id, isolatedCommunityId: null, isolatedLegendItem: null, displayMap: {},
    clickedNodeId: null, clickedEdge: null, clickedNodeRef: { current: null }, clickedEdgeRef: { current: null },
    directed: false, focusedEdgeNodeSet: new Set(), legendNodeMembership: new Map(),
    legendEdgeMembership: new Map([[id, new Set(['ab'])]]),
    legendVisibility: { isEdgeVisible: () => true }, getShouldShowArrowhead: () => false,
  };
  const graph = new UndirectedGraph();
  ['a', 'b', 'c'].forEach((key) => graph.addNode(key));
  graph.addEdgeWithKey('ab', 'a', 'b', { rawEdge: { key: 'ab', source: 'a', target: 'b' } });
  graph.addEdgeWithKey('bc', 'b', 'c', { rawEdge: { key: 'bc', source: 'b', target: 'c' } });
  const sigmaEdge = createSigmaEdgeReducer(graph, { current: context });
  for (const [key, source, target] of [['ab', 'a', 'b'], ['bc', 'b', 'c']]) {
    const result = getD3EdgePresentation(source, target, { key, source, target }, 0.5, context, new Map());
    assert.equal(result.hidden, false);
    assert.equal(result.opacity, key === 'ab' ? 0.75 : 0.05);
    assert.equal(sigmaEdge(key, { opacity: 0.5 }).opacity, result.opacity);
  }
});

test('group clicks respond immediately, double clicks isolate, and element rows keep their original actions and tooltip', async () => {
  const rows = [];
  const runtime = require('react/jsx-runtime');
  const capture = (factory) => (type, props, ...rest) => {
    if (props?.title?.startsWith('Single-click')) rows.push(props);
    return factory(type, props, ...rest);
  };
  const { default: GraphLegend } = load('../components/graph/GraphLegend.tsx', {
    'react/jsx-runtime': { ...runtime, jsx: capture(runtime.jsx), jsxs: capture(runtime.jsxs) },
    '@/services/graphPresentation/legendOrdering': { sortLegendEntries },
    '@/store/useStore': { useStore: (selector) => selector({ setLegendColor: () => {} }) },
  });
  const calls = [];
  renderToStaticMarkup(React.createElement(GraphLegend, {
    elementLegendItems: [{ id: 'element:standard', label: 'Node Type 1', Icon: () => null }],
    elementLegendIds: ['element:standard'], hiddenItems: new Set(), isolatedLegendItem: null,
    selectedCommunityId: 'community:0', isolatedCommunityId: null,
    onCommunitySingleClick: (id) => calls.push(['highlight', id]), onCommunityDoubleClick: (id) => calls.push(['isolate', id]),
    onElementSingleClick: (id) => calls.push(['hide', id]), onElementDoubleClick: (id) => calls.push(['element isolate', id]),
    showNodeLabels: false, setShowNodeLabels: () => {}, directed: false, showArrowheads: false, setShowArrowheads: () => {},
    legendCategories: [{ title: 'Communities', items: [{ id: 'community:0', label: 'Community 1', color: '#aaa', allIds: ['community:0'] }] }],
    isLegendMinimized: false, setIsLegendMinimized: () => {},
  }));
  const group = rows.find((row) => row.title.includes('highlight'));
  const element = rows.find((row) => row.title.includes('show/hide'));
  assert.equal(group.title, 'Single-click to highlight, double-click to isolate and zoom');
  assert.match(group.className, /font-bold/);
  const event = (detail) => ({ detail, stopPropagation: () => {} });
  group.onClick(event(1));
  assert.deepEqual(calls, [['highlight', 'community:0']]);
  group.onClick(event(2));
  assert.deepEqual(calls.at(-1), ['isolate', 'community:0']);
  element.onClick(event(1));
  await new Promise((resolve) => setTimeout(resolve, 275));
  assert.deepEqual(calls.at(-1), ['hide', 'element:standard']);
  element.onClick(event(1));
  element.onClick(event(2));
  await new Promise((resolve) => setTimeout(resolve, 275));
  assert.deepEqual(calls.slice(2), [['hide', 'element:standard'], ['element isolate', 'element:standard']]);
  assert.equal(element.title, 'Single-click to toggle show/hide, double-click to isolate');
});
