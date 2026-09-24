import assert from 'node:assert/strict';
import test from 'node:test';
import { communityMembershipLabels } from '../services/communities/labels.ts';

test('ordinary community results use Community labels', () => {
  for (const algorithm of ['louvain', 'infomap', 'labelPropagation', 'walktrap', 'fastGreedy', 'sbm']) {
    assert.deepEqual(communityMembershipLabels(['a', 'b'], [0, 2], algorithm), { a: 'Community 1', b: 'Community 3' });
  }
});

test('LBM labels count communities separately in each node type even when node order starts with type 2', () => {
  assert.deepEqual(communityMembershipLabels(
    ['b1', 'a1', 'b2', 'a2', 'a3'], [3, 1, 4, 0, 1], 'lbm', ['B', 'A', 'B', 'A', 'A'],
    { rowPartition: 'A', columnPartition: 'B' },
  ), {
    b1: 'Node Type 2 Community 1', a1: 'Node Type 1 Community 2',
    b2: 'Node Type 2 Community 2', a2: 'Node Type 1 Community 1',
    a3: 'Node Type 1 Community 2',
  });
});
