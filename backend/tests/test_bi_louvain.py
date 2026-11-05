import pytest

from conftest import request_payload


def payload(**updates):
    return request_payload(
        **({"metricIds": [], "bipartite": True, "nodeIds": ["r0", "c0", "r1", "c1", "isolated"],
            "partitions": ["row", "col", "row", "col", "row"],
            "edgeSources": [1, 2], "edgeTargets": [0, 3], "edgeWeights": [2.0, 1.0],
            "community": {"algorithm": "biLouvain", "seed": 42}} | updates))


def test_bi_louvain_capability(client):
    capability = next(item for item in client.get('/v1/capabilities').json()['communityAlgorithms'] if item['id'] == 'biLouvain')
    assert capability['bipartite'] and capability['weighted']
    assert not capability['directed']


@pytest.mark.parametrize('weighted', [False, True])
def test_bi_louvain_shared_labels_quality_and_seed(client, weighted):
    data = payload(community={"algorithm": "biLouvain", "seed": 42,
                              "weightChannel": "weight_raw" if weighted else "unweighted"})
    responses = [client.post('/v1/community', json=data) for _ in range(2)]
    assert all(response.status_code == 200 for response in responses), responses[0].text
    result = responses[0].json()['community']
    membership = result['membership']
    assert membership == responses[1].json()['community']['membership']
    assert len(membership) == 5
    assert membership[0] == membership[1]
    assert membership[2] == membership[3]
    assert membership[0] != membership[2]
    assert result['quality'] == pytest.approx(4 / 9 if weighted else 0.5)
    assert result['provenance']['objective'] == 'barberModularity'


def test_square_biadjacency(client):
    response = client.post('/v1/community', json=payload(nodeIds=['r0', 'c0', 'r1', 'c1'], partitions=[0, 1, 0, 1]))
    assert response.status_code == 200, response.text
    assert response.json()['community']['quality'] == pytest.approx(0.5)


@pytest.mark.parametrize('updates', [
    {'bipartite': False}, {'partitions': None}, {'partitions': [0] * 5},
    {'directed': True}, {'edgeSources': [0, 2], 'edgeTargets': [2, 3]},
    {'edgeWeights': [-1, 1], 'community': {'algorithm': 'biLouvain', 'weightChannel': 'weight_raw'}},
    {'edgeWeights': [0, 0], 'community': {'algorithm': 'biLouvain', 'weightChannel': 'weight_raw'}},
])
def test_bi_louvain_rejects_invalid_graphs(client, updates):
    response = client.post('/v1/community', json=payload(**updates))
    assert response.status_code == 422, response.text
