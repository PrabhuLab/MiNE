import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import ts from 'typescript';
import { readFileSync } from 'node:fs';
import { liveNumericValue } from '../services/graphStyles/liveUpdate.ts';
import { fitSigmaNodeSet } from '../components/graph/sigma/camera.ts';

test('clearing a numeric control restores its value on blur instead of committing zero', () => {
  let localValue = 5;
  const hooks = { ...React, useState: () => [localValue, value => { localValue = value; }], useEffect() {}, useRef: () => ({ current: false }) };
  const source = readFileSync(new URL('../components/ui/SyncInput.tsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } });
  const exports = {};
  new Function('require', 'exports', compiled.outputText)(name => {
    if (name === 'react') return hooks;
    if (name === '@/services/graphStyles/liveUpdate') return { liveNumericValue };
    throw new Error(name);
  }, exports);
  const changes = [];
  const props = { value: 5, onChange: value => changes.push(value), live: true };
  exports.SyncInput(props).props.onChange({ target: { value: '' } });
  exports.SyncInput(props).props.onBlur();
  assert.equal(localValue, 5);
  assert.deepEqual(changes, []);
  exports.SyncInput(props).props.onChange({ target: { value: '0' } });
  assert.deepEqual(changes, [0]);
});

test('Sigma camera respects reduced motion and retains normal motion otherwise', () => {
  const original = globalThis.window;
  const durations = [];
  const sigma = { resize() {}, getDimensions: () => ({ width: 100, height: 100 }), getCamera: () => ({ animate: (_state, options) => durations.push(options.duration) }) };
  try {
    globalThis.window = { matchMedia: () => ({ matches: true }) };
    fitSigmaNodeSet(sigma, {}, {}, [], 200);
    globalThis.window = { matchMedia: () => ({ matches: false }) };
    fitSigmaNodeSet(sigma, {}, {}, [], 200);
    assert.deepEqual(durations, [0, 200]);
  } finally { globalThis.window = original; }
});

test('failed workspace restoration retains the previously loaded network', () => {
  const source = readFileSync(new URL('../components/upload/SmartUploadWizard.tsx', import.meta.url), 'utf8');
  const ast = ts.createSourceFile('wizard.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let declaration;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'applyParsedNetwork') declaration = node;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  const compiled = ts.transpileModule(`const ${declaration.getText(ast)};`, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
  const previous = { rawNodes: [{ id: 'existing' }], filters: { liveUpdate: true } };
  let state = previous;
  const useStore = { getState: () => state, setState: next => { state = { ...state, ...next }; } };
  const dependencies = {
    useStore, restoreBlockModelRuns: () => [], graphToRaw: () => ({ nodes: [{ id: 'new' }], edges: [] }),
    inferCustomNodeAttributes: () => [], inferCustomEdgeAttributes: () => [], resetCommunityColorCache() {},
    clearStore: () => { state = { rawNodes: [], filters: {} }; }, migrateWorkspaceFilters: () => null,
    migrateComputationPreference: () => 'browser', migrateRendererPreference: () => 'd3',
    mergeCustomAttributeMetadata: () => [], networkFiles: [], router: { push() {} },
  };
  const apply = new Function(...Object.keys(dependencies), `${compiled.outputText}; return applyParsedNetwork;`)(...Object.values(dependencies));
  assert.throws(() => apply({ workspace: {}, metrics: null, graph: {} }));
  assert.deepEqual(state.rawNodes, previous.rawNodes);
  assert.equal(state.filters, previous.filters);
});

function loadUploadComponent(file) {
  const source = readFileSync(new URL(`../components/upload/${file}.tsx`, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } });
  const exports = {};
  new Function('require', 'exports', compiled.outputText)(name => {
    if (name === 'react') return { ...React, useState: value => [value, () => {}] };
    throw new Error(name);
  }, exports);
  return exports;
}

function elements(node) {
  if (!node || typeof node !== 'object') return [];
  return [node, ...React.Children.toArray(node.props?.children).flatMap(elements)];
}

test('drop zones accept supported files and reject wrong formats or excess single files', () => {
  const { FileDropzone } = loadUploadComponent('FileDropzone');
  const changes = [];
  const zone = FileDropzone({ accept: '.csv', className: '', onFiles: files => changes.push(files) });
  let prevented = 0;
  const drop = names => zone.props.onDrop({ preventDefault() { prevented++; }, dataTransfer: { files: names.map(name => ({ name })) } });
  drop(['nodes.CSV']);
  drop(['network.json']);
  drop(['nodes.csv', 'edges.csv']);
  drop([]);
  assert.equal(prevented, 4);
  assert.deepEqual(changes, [[{ name: 'nodes.CSV' }]]);
  FileDropzone({ accept: '.csv', multiple: true, className: '', onFiles: files => changes.push(files) }).props.onDrop({ preventDefault() {}, dataTransfer: { files: [{ name: 'nodes.csv' }, { name: 'edges.csv' }] } });
  assert.equal(changes[1].length, 2);
});

test('topology selection exposes a way back to upload options', () => {
  const { StepTopology } = loadUploadComponent('steps/StepTopology');
  let backs = 0;
  const props = { topology: 'Bipartite', setTopology() {}, onBack() { backs++; } };
  const back = elements(StepTopology(props)).find(node => node.type === 'button' && node.props.children === 'Back to upload options');
  back.props.onClick();
  assert.equal(backs, 1);
  assert.equal(elements(StepTopology({ ...props, topology: null })).some(node => node.props.children === 'Back to upload options'), false);
});

test('mapping indices allow zero and previews display zero-based row and column coordinates', () => {
  const { StepDataMapping } = loadUploadComponent('steps/StepDataMapping');
  const changes = [];
  const mapping = { rowHeadersCol: 0, colHeadersRow: 0, dataStartRow: 1, dataStartCol: 1 };
  const tree = StepDataMapping({ format: 'Adjacency Matrix', mapping, parsedData: { matrix: [['Name', 'A'], ['A', 1]] }, previewGraph: { nodes: [], edges: [] }, setMapping: update => changes.push(update(mapping)) });
  const nodes = elements(tree);
  const inputs = nodes.filter(node => node.type === 'input' && node.props.type === 'number');
  assert.equal(inputs.length, 4);
  for (const input of inputs) { assert.equal(input.props.min, 0); input.props.onChange({ target: { value: '0' } }); }
  assert.ok(changes.every(next => Object.values(next).every(value => value === 0 || value === 1)));
  const rows = nodes.filter(node => node.type === 'tr');
  assert.deepEqual(elements(rows[0]).filter(node => node.type === 'th').map(node => node.props.children), ['Row / Col', 0, 1]);
  assert.equal(elements(rows[1]).find(node => node.type === 'th').props.children, '0');
  assert.equal(elements(rows[2]).find(node => node.type === 'th').props.children, 1);
});
