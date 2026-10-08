import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { registerSigmaInteractions } from '../components/graph/sigma/interactions.ts';

function interactions() {
  const handlers = new Map();
  const calls = [];
  registerSigmaInteractions({
    sigma: { on: (name, handler) => handlers.set(name, handler), getNodeDisplayData: () => ({ opacity: 1 }) },
    graph: { hasNode: () => true, getNodeAttribute: () => 0 },
    displayMap: {}, clickedNodeRef: { current: null },
    beginDrag: () => calls.push('drag'), endDrag: () => {},
    setClickedNode: () => calls.push('node'), setClickedEdge: () => calls.push('edge'),
    setClickedDegree: () => {}, setTooltip: () => {},
    onClearSelection: () => calls.push('clear'), onElementDoubleClick: () => calls.push('navigate'),
  });
  return { calls, emit: (name, x = 0, y = 0) => handlers.get(name)({ node: 'a', event: { x, y }, preventSigmaDefault: () => calls.push('prevent') }) };
}

test('a blank-space click clears selection while tolerating small pointer jitter', () => {
  const { calls, emit } = interactions();
  emit('downStage', 10, 10);
  emit('moveBody', 12, 11);
  emit('upStage', 12, 11);
  emit('clickStage', 12, 11);
  assert.deepEqual(calls, ['node', 'edge', 'clear']);
});

test('panning preserves isolation even with one move or a return to the starting point', () => {
  const { calls, emit } = interactions();
  emit('downStage', 10, 10);
  emit('moveBody', 60, 10);
  emit('moveBody', 10, 10);
  emit('upStage', 10, 10);
  emit('clickStage', 10, 10);
  assert.deepEqual(calls, []);
  emit('doubleClickStage');
  assert.deepEqual(calls, ['prevent']);
  calls.length = 0;
  emit('downStage', 10, 10);
  emit('upStage', 60, 10);
  emit('clickStage', 60, 10);
  assert.deepEqual(calls, []);
  emit('downStage');
  emit('upStage');
  emit('clickStage');
  assert.ok(calls.includes('clear'));
});

test('node dragging does not clear isolation, select, or navigate on release', () => {
  const { calls, emit } = interactions();
  emit('downNode');
  emit('nodeDragStart');
  emit('nodeDragEnd');
  emit('upStage');
  emit('clickStage');
  emit('clickNode');
  emit('doubleClickNode');
  assert.deepEqual(calls, ['drag', 'prevent']);
});

test('a click immediately after a pan clears isolation even when Sigma classifies it as a double click', () => {
  const { calls, emit } = interactions();
  emit('downStage');
  emit('moveBody', 60, 10);
  emit('upStage', 60, 10);
  emit('clickStage', 60, 10);
  assert.deepEqual(calls, []);
  emit('downStage', 60, 10);
  emit('upStage', 60, 10);
  emit('doubleClickStage', 60, 10);
  assert.deepEqual(calls, ['node', 'edge', 'clear']);
});

test('clearing workspace selection removes every isolation without changing hidden groups or data', () => {
  const require = createRequire(import.meta.url);
  const state = { selectedElement: 'a', selectedCommunityId: 'community:1', isolatedCommunityId: 'community:1', isolatedLegendItem: 'node-type:1', hiddenLegendItems: ['hidden'], rawNodes: [{ id: 'a' }] };
  const useStore = (selector) => selector({ setSelectedElement: (id) => { state.selectedElement = id; } });
  useStore.setState = (patch) => Object.assign(state, patch);
  const exports = {};
  const source = readFileSync(new URL('../hooks/useWorkspaceSelection.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
  new Function('require', 'exports', compiled.outputText)((name) => name === '@/store/useStore' ? { useStore } : require(name), exports);
  let selection;
  function Capture() { selection = exports.useWorkspaceSelection(); return null; }
  renderToStaticMarkup(React.createElement(Capture));
  selection.clearSelection();
  assert.deepEqual(state, { selectedElement: null, selectedCommunityId: null, isolatedCommunityId: null, isolatedLegendItem: null, hiddenLegendItems: ['hidden'], rawNodes: [{ id: 'a' }] });
});
