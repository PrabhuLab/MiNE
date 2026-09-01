import gzip
import orjson

from conftest import request_payload


def test_health_and_capabilities(client):
    assert client.get("/health").json()["status"] == "ok"
    capabilities = client.get("/v1/capabilities").json()
    assert capabilities["schemaVersion"] == "mine-igraph-1"
    assert "pagerank" in capabilities["supportedMetricIds"]
    assert "drl" in capabilities["supportedLayoutIds"]
    algorithm_ids = {item["id"] for item in capabilities["communityAlgorithms"]}
    assert algorithm_ids >= {"louvain", "infomap", "labelPropagation", "walktrap"}
    assert "leiden" not in algorithm_ids
    assert capabilities["limits"]["maxNodes"] > 0
    assert capabilities["exactMetricThresholds"]["edgeBetweenness"]["maxNodes"] < capabilities["limits"]["maxNodes"]


def test_gzip_contract_is_compact_and_revision_aligned(client):
    payload = request_payload(metricIds=["degree", "pagerank"], layout={"algorithm": "circular", "seed": 42, "normalize": True})
    response = client.post(
        "/v1/analyze",
        content=gzip.compress(orjson.dumps(payload)),
        headers={"Content-Type": "application/json", "Content-Encoding": "gzip", "Accept-Encoding": "gzip"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["graphRevision"] == payload["graphRevision"]
    assert body["filterRevision"] == payload["filterRevision"]
    assert body["nodeOrderHash"] == payload["nodeOrderHash"]
    assert body["edgeOrderHash"] == payload["edgeOrderHash"]
    assert len(body["positions"]["x"]) == 3
    assert len(body["nodeMetrics"]["pagerank"]) == 3
    assert "nodes" not in body and "edges" not in body


def test_community_contract_preserves_node_order(client):
    payload = request_payload(metricIds=[], community={"algorithm": "louvain", "weightChannel": "weight_raw", "resolution": 1.0, "seed": 42})
    response = client.post("/v1/community", json=payload)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["community"]["algorithm"] == "louvain"
    assert len(body["community"]["membership"]) == len(payload["nodeIds"])


def test_sparse_sbm_is_available_for_unipartite_graphs(client):
    payload = request_payload(
        metricIds=[], edgeWeights=None, edgeKeys=None,
        community={"algorithm": "sbm", "weightChannel": "unweighted", "clusters": 2, "seed": 42},
    )
    response = client.post("/v1/community", json=payload)
    assert response.status_code == 200, response.text
    body = response.json()["community"]
    assert body["algorithm"] == "sbm"
    assert len(body["membership"]) == len(payload["nodeIds"])
    assert body["provenance"]["engine"] == "sparsebm"


def test_sparse_lbm_is_available_only_for_valid_bipartite_graphs(client):
    payload = request_payload(
        metricIds=[], bipartite=True,
        nodeIds=["a1", "a2", "a3", "a4", "b1", "b2", "b3"],
        edgeSources=[0, 0, 1, 1, 2, 3], edgeTargets=[4, 5, 4, 5, 6, 6],
        edgeWeights=None, edgeKeys=None, partitions=["A", "A", "A", "A", "B", "B", "B"],
        community={"algorithm": "lbm", "weightChannel": "unweighted", "clusters": 2, "seed": 42},
    )
    response = client.post("/v1/community", json=payload)
    assert response.status_code == 200, response.text
    body = response.json()["community"]
    assert body["algorithm"] == "lbm"
    assert len(body["membership"]) == 7
    assert body["provenance"]["rowClusters"] == 2
    assert body["provenance"]["columnClusters"] == 2

    wrong_graph = client.post("/v1/community", json={**payload, "bipartite": False})
    assert wrong_graph.status_code == 422
    assert wrong_graph.json()["detail"]["code"] == "lbm_graph_type"


def test_topology_validation_does_not_silently_change_graph(client):
    bad_length = client.post("/v1/analyze", json=request_payload(edgeTargets=[1])).json()
    assert bad_length["detail"]["code"] == "edge_array_length"
    self_loop = client.post("/v1/analyze", json=request_payload(edgeSources=[0, 1], edgeTargets=[0, 2]))
    assert self_loop.status_code == 400
    parallel = client.post("/v1/analyze", json=request_payload(edgeSources=[0, 1], edgeTargets=[1, 0]))
    assert parallel.status_code == 400


def test_cors_preflight_uses_github_pages_origin_not_repository_path(client):
    response = client.options(
        "/v1/analyze",
        headers={
            "Origin": "https://prabhulab.github.io",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,content-encoding",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "https://prabhulab.github.io"
