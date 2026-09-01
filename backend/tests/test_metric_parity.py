import math
import pytest
from conftest import request_payload


def analyze(client, **updates):
    response = client.post("/v1/analyze", json=request_payload(**updates))
    assert response.status_code == 200, response.text
    return response.json()


def test_undirected_path_matches_graphology_normalization(client):
    result = analyze(client, edgeWeights=[1, 1], metricIds=["density", "simpleSize", "weightedSize", "degree", "betweenness", "closeness", "pagerank"])
    assert result["graphMetrics"]["density"] == pytest.approx(2 / 3)
    assert result["graphMetrics"]["simpleSize"] == 2
    assert result["graphMetrics"]["weightedSize"] == 2
    assert result["nodeMetrics"]["degreeCentrality"] == pytest.approx([0.5, 1.0, 0.5])
    assert result["nodeMetrics"]["betweenness"] == pytest.approx([0.0, 1.0, 0.0])
    assert sum(result["nodeMetrics"]["pagerank"]) == pytest.approx(1.0)


def test_directed_degree_and_pagerank_order_match_index_contract(client):
    result = analyze(client, directed=True, edgeWeights=[1, 1], metricIds=["degree", "pagerank", "hits"])
    assert result["nodeMetrics"]["inDegreeCentrality"] == pytest.approx([0.0, 0.5, 0.5])
    assert result["nodeMetrics"]["outDegreeCentrality"] == pytest.approx([0.5, 0.5, 0.0])
    assert result["nodeMetrics"]["pagerank"][2] > result["nodeMetrics"]["pagerank"][1] > result["nodeMetrics"]["pagerank"][0]
    assert sum(result["nodeMetrics"]["hub"]) == pytest.approx(1.0)
    assert sum(result["nodeMetrics"]["authority"]) == pytest.approx(1.0)


def test_weight_semantics_preserve_current_mine_behavior(client):
    result = analyze(client, edgeWeights=[2, 4], metricIds=["weightedDegree", "weightedSize", "diameter"])
    assert result["nodeMetrics"]["weightedDegree"] == pytest.approx([2, 6, 4])
    assert result["graphMetrics"]["weightedSize"] == 6
    assert result["graphMetrics"]["diameter"] == pytest.approx(2)


def test_nonpositive_distance_weights_are_rejected_not_inverted(client):
    response = client.post("/v1/analyze", json=request_payload(edgeWeights=[0, 2], metricIds=["betweenness"]))
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "invalid_metric_weights"


def test_disconnected_and_bipartite_fixture(client):
    result = analyze(
        client, nodeIds=["a0", "b0", "a1", "b1", "isolated"],
        edgeSources=[0, 1, 2], edgeTargets=[1, 2, 3], edgeWeights=[1, 1, 1], edgeKeys=["e0", "e1", "e2"],
        bipartite=True, metricIds=["degree", "closeness", "eccentricity", "louvain"],
    )
    assert len(result["nodeMetrics"]["louvain"]) == 5
    assert result["nodeMetrics"]["degreeCentrality"][-1] == 0
    assert result["nodeMetrics"]["closeness"][-1] in (0, None)
    assert result["nodeMetrics"]["eccentricity"][-1] in (0, None)


def test_edge_metric_order_is_input_edge_order(client):
    result = analyze(client, edgeKeys=["second", "first"], edgeWeights=[1, 1], metricIds=["edgeBetweenness"])
    assert len(result["edgeMetrics"]["edgeBetweenness"]) == 2
    assert all(math.isfinite(value) for value in result["edgeMetrics"]["edgeBetweenness"])


def test_modularity_uses_explicit_membership_and_louvain_is_separately_named(client):
    result = analyze(client, edgeWeights=[1, 1], communities=[0, 0, 1], metricIds=["modularity", "louvain"], randomSeed=7)
    assert math.isfinite(result["graphMetrics"]["modularity"])
    assert math.isfinite(result["graphMetrics"]["louvainModularity"])
    assert len(result["nodeMetrics"]["louvain"]) == 3


def test_exact_metric_size_gate_never_returns_an_approximation(client, monkeypatch):
    from app.main import settings
    monkeypatch.setattr(settings, "betweenness_max_nodes", 2)
    response = client.post("/v1/analyze", json=request_payload(metricIds=["betweenness"]))
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "metric_size_gate"
    assert "betweennessApprox" not in response.text


def test_eigenvector_uses_graphology_l2_normalization(client):
    result = analyze(
        client, edgeSources=[0, 1, 2], edgeTargets=[1, 2, 0], edgeWeights=[1, 1, 1], edgeKeys=["e0", "e1", "e2"],
        metricIds=["eigenvector"],
    )
    values = result["nodeMetrics"]["eigenvector"]
    assert math.sqrt(sum(value * value for value in values)) == pytest.approx(1.0)
