import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


def request_payload(**updates):
    payload = {
        "schemaVersion": "mine-igraph-1",
        "requestId": "request-1",
        "graphRevision": "graph-r1",
        "filterRevision": "filter-r1",
        "nodeOrderHash": "nodes-h1",
        "edgeOrderHash": "edges-h1",
        "directed": False,
        "bipartite": False,
        "nodeIds": ["a", "b", "c"],
        "edgeSources": [0, 1],
        "edgeTargets": [1, 2],
        "edgeWeights": [1.0, 2.0],
        "edgeKeys": ["e0", "e1"],
        "metricIds": ["degree"],
    }
    payload.update(updates)
    return payload
