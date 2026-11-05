import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { computeActiveNetwork } from '../lib/workspaceUtils.ts';
import { graphSettings } from '../services/graphStyles/liveUpdate.ts';
import { computeGraphRevisions } from '../services/cloud/revision.ts';
import { isSecondaryNode } from '../services/graphPresentation/visibility.ts';
import { updateGraphColors } from '../services/graphStyles/colors.ts';

const require = createRequire(import.meta.url);
function hookHarness(path, overrides) {
  const slots = [];
  let cursor = 0, dirty = false, pending = [];
  const changed = (before, after) => !before || after.some((value, index) => !Object.is(value, before[index]));
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, value => {
        const next = typeof value === 'function' ? value(slots[index].value) : value;
        if (!Object.is(next, slots[index].value)) { slots[index].value = next; dirty = true; }
      }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ||= { current: initial }; },
    useMemo(fn, deps) {
      const index = cursor++;
      if (changed(slots[index]?.deps, deps)) slots[index] = { value: fn(), deps };
      return slots[index].value;
    },
    useCallback(fn, deps) { return react.useMemo(() => fn, deps); },
    useEffect(fn, deps) {
      const index = cursor++;
      if (changed(slots[index]?.deps, deps)) pending.push(() => {
        slots[index]?.cleanup?.();
        slots[index] = { deps, cleanup: fn() };
      });
    },
  };
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } });
  const exports = {};
  new Function('require', 'exports', compiled.outputText)(name => name === 'react' ? react : overrides[name] ?? require(name), exports);
  const hook = Object.values(exports)[0];
  return {
    render(props) {
      let result, iterations = 0;
      do {
        assert.ok(iterations++ < 20, 'hook must settle');
        cursor = 0; dirty = false; pending = [];
        result = hook(props);
        pending.forEach(effect => effect());
      } while (dirty);
      return result;
    },
    close() { slots.forEach(slot => slot?.cleanup?.()); },
  };
}

test('slider graph work waits for a frame and unchanged edge membership preserves analysis inputs', () => {
  const frames = new Map();
  let id = 0;
  const original = [globalThis.requestAnimationFrame, globalThis.cancelAnimationFrame];
  globalThis.requestAnimationFrame = fn => { frames.set(++id, fn); return id; };
  globalThis.cancelAnimationFrame = key => frames.delete(key);
  const flush = () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(fn => fn()); };
  let state = { rawNodes: [{ id: 'a' }, { id: 'b' }], rawEdges: [{ source: 'a', target: 'b', score: 5 }], filters: { liveUpdate: true }, setFilter() {} };
  const harness = hookHarness('../hooks/useGraphFilters.ts', {
    '@/store/useStore': { useStore: () => state }, '@/lib/workspaceUtils': { computeActiveNetwork }, '@/services/graphStyles/liveUpdate': { graphSettings },
  });
  try {
    const initial = harness.render();
    for (const min of [1, 2, 3]) {
      state = { ...state, filters: { liveUpdate: true, edgeFilter: { attribute: 'score', min, max: 10 } } };
      assert.equal(harness.render().validEdges, initial.validEdges);
    }
    assert.equal(frames.size, 1);
    flush();
    assert.equal(harness.render().validEdges, initial.validEdges);
    state = { ...state, filters: { liveUpdate: true, edgeFilter: { attribute: 'score', min: 6, max: 10 } } };
    assert.equal(harness.render().validEdges, initial.validEdges);
    flush();
    assert.equal(harness.render().validEdges.length, 0);
    // Replacing a dataset must never apply the previous frame's filter to it.
    state = { ...state, rawNodes: [{ id: 'new-a' }, { id: 'new-b' }], rawEdges: [{ source: 'new-a', target: 'new-b', score: 1 }], filters: { liveUpdate: true } };
    assert.equal(harness.render().validEdges.length, 1);
  } finally {
    harness.close();
    [globalThis.requestAnimationFrame, globalThis.cancelAnimationFrame] = original;
  }
});

test('positioned filtering keeps renderer readiness and static layout revision stable', async () => {
  const harness = hookHarness('../hooks/useSharedGraph.ts', {
    '@/services/layouts/d3Worker': { computeForceDirectedLayoutAsync() { throw new Error('Positioned filters must not run layout'); } },
    '@/services/graphStyles/colors': { updateGraphColors }, '@/services/graphPresentation/visibility': { isSecondaryNode },
    '@/services/cloud/revision': { computeGraphRevisions }, '@/services/cloud/config': { shouldUseCloud: () => false },
  });
  const nodes = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 10, y: 10 }, { id: 'c', x: 20, y: 20 }];
  const edges = [{ source: 'a', target: 'b' }, { source: 'b', target: 'c' }];
  const props = { nodes, edges, graphRevision: 'raw', directed: false, bipartite: false, getNodeColor: () => '#000', getNodeSize: () => 5, getEdgeColor: () => '#000', getEdgeSize: () => 1, getEdgeOpacity: () => 1, getShouldShowArrowhead: () => false };
  try {
    harness.render(props);
    await new Promise(resolve => setTimeout(resolve, 0));
    const initial = harness.render(props);
    assert.equal(initial.isReady, true);
    const filteredProps = { ...props, nodes: nodes.slice(0, 2), edges: edges.slice(0, 1) };
    const filtered = harness.render(filteredProps);
    assert.equal(filtered.isReady, true);
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(harness.render(filteredProps).staticLayoutRevision, initial.staticLayoutRevision);
    assert.equal(filtered.graph, initial.graph);
    harness.render(props);
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(harness.render(props).staticLayoutRevision, initial.staticLayoutRevision);
    assert.equal(initial.graph.order, 3);
    const replacement = { ...props, graphRevision: 'replacement' };
    harness.render(replacement);
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(harness.render(replacement).staticLayoutRevision, initial.staticLayoutRevision + 1);
  } finally { harness.close(); }
});
