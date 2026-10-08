import assert from 'node:assert/strict';
import test from 'node:test';
import { computeForceDirectedLayout } from '../lib/layoutUtils.ts';
import { computeForceDirectedLayoutAsync } from '../services/layouts/d3Worker.ts';

const messages = [];
globalThis.self = { postMessage: (data) => messages.push(data) };
await import('../services/layouts/d3.worker.ts');
const command = (data) => { self.onmessage({ data }); return messages.pop(); };
const nodes = [{ id: 'a', x: 0, y: 0, size: 5 }, { id: 'b', x: 100, y: 0, size: 5 }];
const edges = [{ source: 'a', target: 'b', weight_raw: 1 }];

test('static worker preserves the existing force layout and reports invalid endpoints', () => {
  assert.deepEqual(command({ type: 'static', nodes, edges, directed: false, forceStrength: -100 }).positions,
    computeForceDirectedLayout(nodes, edges, false, -100));
  assert.ok(command({ type: 'static', nodes, edges: [{ source: 'a', target: 'missing' }], forceStrength: -100 }).error);
});

test('live physics only advances when requested, pins exactly, releases and cools', () => {
  assert.equal(command({ type: 'start', nodes: structuredClone(nodes), links: structuredClone(edges), forceStrength: -100 }), undefined);
  const first = command({ type: 'tick' });
  assert.equal(first.positions.length, 4);
  assert.ok(Array.from(first.positions).every(Number.isFinite));
  assert.equal(first.running, true);
  command({ type: 'pin', id: 'a', x: 12, y: 34 });
  const pinned = command({ type: 'tick' });
  assert.deepEqual(Array.from(pinned.positions.slice(0, 2)), [12, 34]);
  command({ type: 'release', id: 'a' });
  let settled;
  for (let index = 0; index < 400; index += 1) settled = command({ type: 'tick' });
  assert.equal(settled.running, false);
  assert.notDeepEqual(Array.from(settled.positions.slice(0, 2)), [12, 34]);
  command({ type: 'strength', forceStrength: -200 });
  assert.equal(command({ type: 'tick' }).running, true);
  command({ type: 'pin', id: 'a', x: -10, y: 20 });
  assert.equal(command({ type: 'tick' }).running, true);
  assert.deepEqual(messages, []);
});

test('static layout cancellation and worker failure terminate the worker', async () => {
  let worker;
  globalThis.Worker = class {
    constructor() { worker = this; }
    postMessage(data) { this.request = data; }
    terminate() { this.terminated = true; }
  };
  const cancelled = new AbortController();
  const pending = computeForceDirectedLayoutAsync(nodes, edges, false, -100, cancelled.signal);
  cancelled.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(worker.terminated, true);
  const failed = computeForceDirectedLayoutAsync(nodes, edges, false, -100, new AbortController().signal);
  worker.onmessage({ data: { error: 'Invalid graph' } });
  await assert.rejects(failed, /Invalid graph/);
  assert.equal(worker.terminated, true);
  const completed = computeForceDirectedLayoutAsync(nodes, edges, false, -100, new AbortController().signal);
  const positions = new Map([['a', { x: 1, y: 2 }]]);
  worker.onmessage({ data: { positions } });
  assert.equal(await completed, positions);
  assert.equal(worker.terminated, true);
});
