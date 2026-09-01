import assert from 'node:assert/strict';
import test from 'node:test';
import { CLOUD_EDGE_THRESHOLD, CLOUD_NODE_THRESHOLD, checkCloudBackend, cloudBackendHostname, resolveComputeEngine, shouldUseCloud } from '../services/cloud/config.ts';
import { computeGraphRevisions } from '../services/cloud/revision.ts';
import { validateCloudResponse } from '../services/cloud/validation.ts';
import { mergeComputeEnginePreference, persistedComputeEnginePreference } from '../services/cloud/preference.ts';

test('cloud routing respects centralized thresholds and explicit engine choice', () => {
  assert.equal(shouldUseCloud(CLOUD_NODE_THRESHOLD - 1, CLOUD_EDGE_THRESHOLD - 1, 'auto'), false);
  assert.equal(shouldUseCloud(CLOUD_NODE_THRESHOLD, 0, 'auto'), true);
  assert.equal(shouldUseCloud(1, CLOUD_EDGE_THRESHOLD, 'auto'), true);
  assert.equal(shouldUseCloud(1, 0, 'cloud'), true);
  assert.equal(shouldUseCloud(CLOUD_NODE_THRESHOLD, CLOUD_EDGE_THRESHOLD, 'browser'), true);
  assert.equal(resolveComputeEngine(3, 2, 'auto'), 'browser');
  assert.equal(resolveComputeEngine(3, 2, 'cloud'), 'cloud');
  assert.equal(resolveComputeEngine(CLOUD_NODE_THRESHOLD, 0, 'auto'), 'cloud');
  assert.equal(CLOUD_NODE_THRESHOLD, 7_000);
  assert.equal(CLOUD_EDGE_THRESHOLD, 15_000);
});

test('engine and renderer preferences persist independently', () => {
  assert.deepEqual(persistedComputeEnginePreference({ computeEngine: 'cloud', rendererEngine: 'd3' }), { computeEngine: 'cloud', rendererEngine: 'd3' });
  const restored = mergeComputeEnginePreference({ computeEngine: 'browser', rendererEngine: 'sigma' }, { computeEngine: 'auto', rendererEngine: 'auto', another: 1 });
  assert.equal(restored.computeEngine, 'browser');
  assert.equal(restored.rendererEngine, 'sigma');
  const invalid = mergeComputeEnginePreference({ computeEngine: 'invalid', rendererEngine: 'invalid' }, { computeEngine: 'cloud', rendererEngine: 'd3', another: 1 });
  assert.equal(invalid.computeEngine, 'browser');
  assert.equal(invalid.rendererEngine, 'auto');
});

test('cloud status reports missing configuration without making a request', async () => {
  let requests = 0;
  const status = await checkCloudBackend('', { fetchImpl: async () => { requests += 1; throw new Error('unexpected'); } });
  assert.equal(status.state, 'not-configured');
  assert.match(status.message, /NEXT_PUBLIC_MINE_IGRAPH_API_URL/);
  assert.equal(requests, 0);
});

test('cloud status checks health and capabilities and exposes only the hostname', async () => {
  const urls = [];
  const fetchImpl = async (url) => {
    urls.push(String(url));
    if (String(url).endsWith('/health')) return new Response(JSON.stringify({ status: 'ok', version: '0.1.0' }), { status: 200 });
    return new Response(JSON.stringify({ schemaVersion: 'mine-igraph-1', backendVersion: '0.1.0', supportedMetricIds: ['degree'], supportedLayoutIds: ['drl'], limits: {} }), { status: 200 });
  };
  const status = await checkCloudBackend('http://127.0.0.1:8080', { fetchImpl });
  assert.equal(status.state, 'available');
  assert.equal(status.hostname, '127.0.0.1:8080');
  assert.equal(cloudBackendHostname('http://localhost:8080/a/private/path?x=1'), 'localhost:8080');
  assert.deepEqual(urls.sort(), ['http://127.0.0.1:8080/health', 'http://127.0.0.1:8080/v1/capabilities']);
});

test('cloud status reports an unreachable backend without fallback semantics', async () => {
  const status = await checkCloudBackend('http://localhost:9999', { fetchImpl: async () => { throw new TypeError('connection refused'); } });
  assert.equal(status.state, 'unavailable');
  assert.match(status.message, /connection refused/);
  assert.match(status.message, /localhost:9999/);
});

test('cloud status reports a connection timeout explicitly', async () => {
  const fetchImpl = async (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
  });
  const status = await checkCloudBackend('http://localhost:9998', { fetchImpl, timeoutMs: 5 });
  assert.equal(status.state, 'unavailable');
  assert.match(status.message, /timed out/);
});

test('incremental graph revisions are stable, order-sensitive, weight-sensitive, and compact', () => {
  const nodes = [{ id: 'a' }, { id: 'b' }];
  const edges = [{ key: 'e0', source: 'a', target: 'b', weight_raw: 1 }];
  const first = computeGraphRevisions(nodes, edges, false, true);
  const same = computeGraphRevisions(nodes, edges, false, true);
  const reordered = computeGraphRevisions([...nodes].reverse(), edges, false, true);
  const reweighted = computeGraphRevisions(nodes, [{ ...edges[0], weight_raw: 2 }], false, true);
  assert.deepEqual(first, same);
  assert.notEqual(first.nodeOrderHash, reordered.nodeOrderHash);
  assert.notEqual(first.graphRevision, reweighted.graphRevision);
  assert.ok(first.graphRevision.length < 64);
});

test('cloud response validation rejects stale revisions and invalid aligned arrays', () => {
  const request = {
    schemaVersion: 'mine-igraph-1', requestId: 'request-1', graphRevision: 'g1', filterRevision: 'f1', nodeOrderHash: 'nh', edgeOrderHash: 'eh',
    directed: false, bipartite: false, nodeIds: ['a', 'b'], edgeSources: [0], edgeTargets: [1], metricIds: ['degree'],
  };
  const response = {
    schemaVersion: 'mine-igraph-1', requestId: 'request-1', graphRevision: 'g1', filterRevision: 'f1', nodeOrderHash: 'nh', edgeOrderHash: 'eh', nodeCount: 2, edgeCount: 1,
    positions: { x: [0, 1], y: [0, 1] }, nodeMetrics: { degreeCentrality: [1, 1] }, edgeMetrics: {}, graphMetrics: {}, validity: {}, warnings: {}, timings: {},
  };
  assert.doesNotThrow(() => validateCloudResponse(request, response));
  assert.throws(() => validateCloudResponse(request, { ...response, filterRevision: 'stale' }), /stale/);
  assert.throws(() => validateCloudResponse(request, { ...response, requestId: 'request-2' }), /request ID/);
  assert.throws(() => validateCloudResponse(request, { ...response, positions: { x: [0, Number.NaN], y: [0, 1] } }), /non-finite/);
  assert.throws(() => validateCloudResponse(request, { ...response, nodeMetrics: { degreeCentrality: [1] } }), /wrong array length/);
});
