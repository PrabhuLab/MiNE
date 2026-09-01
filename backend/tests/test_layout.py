import math
from conftest import request_payload


def test_seeded_random_layout_is_deterministic_complete_and_finite(client):
    payload = request_payload(metricIds=[], layout={"algorithm": "random", "seed": 17, "normalize": True})
    first = client.post("/v1/analyze", json=payload).json()["positions"]
    second = client.post("/v1/analyze", json=payload).json()["positions"]
    assert first == second
    assert len(first["x"]) == len(payload["nodeIds"])
    assert all(math.isfinite(value) for value in first["x"] + first["y"])
    assert max(abs(value) for value in first["x"] + first["y"]) <= 1


def test_layout_includes_isolated_vertices(client):
    payload = request_payload(
        nodeIds=["a", "b", "isolated"], edgeSources=[0], edgeTargets=[1], edgeWeights=[1], edgeKeys=["e0"],
        metricIds=[], layout={"algorithm": "circular", "seed": 42, "normalize": True},
    )
    response = client.post("/v1/analyze", json=payload)
    assert response.status_code == 200, response.text
    positions = response.json()["positions"]
    assert len(positions["x"]) == 3
    assert all(math.isfinite(value) for value in positions["x"] + positions["y"])


def test_bipartite_layout_requires_semantic_partition(client):
    payload = request_payload(
        bipartite=True, partitions=[0, 1, 0], metricIds=[],
        layout={"algorithm": "bipartite", "seed": 42, "normalize": True},
    )
    response = client.post("/v1/analyze", json=payload)
    assert response.status_code == 200, response.text
    assert len(response.json()["positions"]["x"]) == 3


def test_drl_and_fruchterman_reingold_return_complete_finite_coordinates(client):
    for algorithm in ("drl", "fruchtermanReingold"):
        payload = request_payload(metricIds=[], layout={"algorithm": algorithm, "seed": 23, "normalize": True})
        response = client.post("/v1/analyze", json=payload)
        assert response.status_code == 200, response.text
        positions = response.json()["positions"]
        assert len(positions["x"]) == 3
        assert all(math.isfinite(value) for value in positions["x"] + positions["y"])
