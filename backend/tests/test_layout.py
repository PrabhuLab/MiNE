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
        metricIds=[], layout={"algorithm": "forceatlas2", "seed": 42, "normalize": True},
    )
    response = client.post("/v1/analyze", json=payload)
    assert response.status_code == 200, response.text
    positions = response.json()["positions"]
    assert len(positions["x"]) == 3
    assert all(math.isfinite(value) for value in positions["x"] + positions["y"])


def test_sugiyama_preserves_real_node_layers_when_an_edge_skips_a_layer(client):
    for algorithm in ("sugiyama", "auto"):
        payload = request_payload(
            directed=True, metricIds=[], edgeSources=[0, 1, 0], edgeTargets=[1, 2, 2],
            edgeWeights=[1, 1, 1], edgeKeys=["a", "b", "c"], layout={"algorithm": algorithm},
        )
        response = client.post("/v1/analyze", json=payload)
        assert response.status_code == 200, response.text
        layers = response.json()["positions"]["y"]
        assert len(layers) == 3
        assert layers[1] - layers[0] == layers[2] - layers[1] != 0


def test_force_layouts_return_complete_finite_coordinates(client):
    for algorithm in ("drl", "fruchtermanReingold", "kamadaKawai", "forceatlas2"):
        payload = request_payload(metricIds=[], layout={"algorithm": algorithm, "seed": 23, "normalize": True})
        response = client.post("/v1/analyze", json=payload)
        assert response.status_code == 200, response.text
        positions = response.json()["positions"]
        assert len(positions["x"]) == 3
        assert all(math.isfinite(value) for value in positions["x"] + positions["y"])
