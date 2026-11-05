import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
let store;
const exports = {};
const source = readFileSync(new URL('../components/workspace/WorkspaceDataTable.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } });
new Function('require', 'exports', compiled.outputText)(
  (name) => name === '@/store/useStore' ? { useStore: () => store } : require(name), exports,
);
const nodes = Array.from({ length: 250 }, (_, index) => ({ id: `n${index}` }));
const edges = nodes.map((node, index) => ({ source: node.id, target: `t${index}` }));
const render = (dataTab, selectedElement, active = true) => {
  store = { isDarkMode: false, directed: false, selectedElement, setSelectedElement: () => {} };
  return renderToStaticMarkup(React.createElement(exports.WorkspaceDataTable, {
    active, dataTab, tableData: nodes, tableDataEdges: edges, edgeMetrics: [],
    handleSort: () => {}, sortConfig: null, handleElementDoubleClick: () => {},
  }));
};

test('selected nodes render on their page without an effect', () => {
  const html = render('nodes', 'n205');
  assert.ok(html.includes('id="row-n205"'));
  assert.ok(html.includes('201–250 of 250'));
  assert.ok(!html.includes('id="row-n0"'));
  assert.ok(render('nodes', 'n205', false).includes('id="row-n0"'));
});

test('edge selection recognizes reversed endpoints and missing selection keeps the first page', () => {
  assert.ok(render('edges', 't125-n125').includes('id="row-n125-t125"'));
  assert.ok(render('edges', 'missing').includes('id="row-n0-t0"'));
});
