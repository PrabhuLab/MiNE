import json
import math

import numpy as np
import pytest

from app.block_model_diagnostics import fit_selection, input_snapshot
from app.models import AnalyzeRequest
from conftest import request_payload


def lbm_payload(**settings):
    return request_payload(
        metricIds=[], bipartite=True,
        nodeIds=["b1", "a1", "a2", "a3", "a4", "b2", "b3"],
        edgeSources=[1, 1, 2, 2, 3, 4], edgeTargets=[0, 5, 0, 5, 6, 6],
        edgeWeights=None, edgeKeys=None, partitions=["B", "A", "A", "A", "A", "B", "B"],
        community={"algorithm": "lbm", "weightChannel": "unweighted", "clusters": 2, "columnClusters": 2, "seed": 42, **settings},
    )


@pytest.mark.parametrize("algorithm", ["sbm", "lbm"])
def test_real_fitted_parameters_and_scores_survive_json(client, algorithm):
    payload = lbm_payload() if algorithm == "lbm" else request_payload(
        metricIds=[], edgeWeights=None, community={"algorithm": "sbm", "clusters": 2, "seed": 42},
    )
    response = client.post("/v1/community", json=payload)
    assert response.status_code == 200, response.text
    community = response.json()["community"]
    diagnostics = json.loads(json.dumps(community["diagnostics"], allow_nan=False))
    assert diagnostics["schemaVersion"] == "mine-block-model-1"
    assert diagnostics["input"]["nodeIds"] == payload["nodeIds"]
    assert diagnostics["settings"]["seed"] == 42
    assert diagnostics["softwareVersions"]["sparsebm"] == "1.6.7"
    assert len(diagnostics["input"]["fingerprint"]) == 64
    model = diagnostics["selectedModel"]
    assert model["fitScore"] - model["penalty"] == pytest.approx(model["icl"])
    assert sum(model["penaltyTerms"].values()) == pytest.approx(model["penalty"])
    probabilities = np.array(model["blockProbabilities"])
    assert probabilities.shape == (2, 2)
    assert np.all((probabilities >= 0) & (probabilities <= 1))
    if algorithm == "lbm":
        assert diagnostics["input"]["rowNodeIds"] == ["a1", "a2", "a3", "a4"]
        assert diagnostics["input"]["columnNodeIds"] == ["b1", "b2", "b3"]
        labels = {}
        for prefix in ("row", "column"):
            soft = np.array(model[f"{prefix}SoftMemberships"])
            np.testing.assert_allclose(soft.sum(axis=1), 1)
            assert soft.argmax(axis=1).tolist() == model[f"{prefix}Labels"]
            assert sum(model[f"{prefix}GroupProportions"]) == pytest.approx(1)
            labels.update(zip(diagnostics["input"][f"{prefix}NodeIds"], model[f"{prefix}Labels"]))
        offset = community["provenance"]["columnLabelOffset"]
        assert community["membership"] == [labels[node] + (offset if partition == "B" else 0)
                                             for node, partition in zip(payload["nodeIds"], payload["partitions"])]
    else:
        np.testing.assert_allclose(np.array(model["softMemberships"]).sum(axis=1), 1)
        assert np.argmax(model["softMemberships"], axis=1).tolist() == model["labels"] == community["membership"]
        assert sum(model["groupProportions"]) == pytest.approx(1)
    assert diagnostics["candidates"][0]["strategy"] == "manual"
    repeated = client.post("/v1/community", json=payload).json()["community"]["diagnostics"]
    assert repeated["selectedModel"] == model
    assert repeated["input"]["fingerprint"] == diagnostics["input"]["fingerprint"]


def test_icl_history_includes_refitted_proposals_and_boundary_status(client):
    response = client.post("/v1/community", json=lbm_payload(blockSelection="icl", maxClusters=4))
    assert response.status_code == 200, response.text
    diagnostics = response.json()["community"]["diagnostics"]
    scores = diagnostics["candidates"]
    assert any(candidate["strategy"] == "initial" for candidate in scores)
    assert any(candidate["strategy"] == "split" for candidate in scores)
    assert {"proposal", "screening", "refitted"}.issubset({candidate.get("phase") for candidate in scores})
    assert diagnostics["search"]["effectiveMaxGroups"] == 4
    assert diagnostics["selectedModel"]["totalGroups"] <= 4
    for score in scores:
        assert math.isfinite(score["fitScore"]) and math.isfinite(score["icl"])
        assert score["fitScore"] - score["penalty"] == pytest.approx(score["icl"])
        assert score["withinLimit"] == (score["totalGroups"] <= 4)
    assert diagnostics["search"]["selectedAtLimit"] == (diagnostics["selectedModel"]["totalGroups"] == 4)
    # Split-and-merge can explore beyond the cap. Keep those scores too.
    assert any(not candidate["withinLimit"] for candidate in scores)


def test_input_fingerprint_tracks_binary_topology_and_partitions_not_order():
    payload = lbm_payload()
    original = AnalyzeRequest.model_validate(payload)
    first = input_snapshot(original, [1, 2, 3, 4], [0, 5, 6])
    order = [6, 4, 2, 0, 5, 3, 1]
    lookup = {old: new for new, old in enumerate(order)}
    reordered = AnalyzeRequest.model_validate({**payload,
        "nodeIds": [payload["nodeIds"][i] for i in order],
        "partitions": [payload["partitions"][i] for i in order],
        "edgeSources": [lookup[i] for i in reversed(payload["edgeTargets"])],
        "edgeTargets": [lookup[i] for i in reversed(payload["edgeSources"])],
    })
    second = input_snapshot(reordered, [i for i, p in enumerate(reordered.partitions) if p == "A"],
                            [i for i, p in enumerate(reordered.partitions) if p == "B"])
    assert second["fingerprint"] == first["fingerprint"]
    assert second["nodeIds"] != first["nodeIds"]
    changed = original.model_copy(update={"edge_sources": original.edge_sources[:-1], "edge_targets": original.edge_targets[:-1]})
    assert input_snapshot(changed, [1, 2, 3, 4], [0, 5, 6])["fingerprint"] != first["fingerprint"]
    changed = original.model_copy(update={"partitions": ["A" if p == "B" else "B" for p in original.partitions]})
    assert input_snapshot(changed, [1, 2, 3, 4], [0, 5, 6])["fingerprint"] != first["fingerprint"]


@pytest.mark.parametrize("algorithm", ["SBM", "LBM"])
def test_history_capture_does_not_change_library_selection(algorithm):
    from scipy.sparse import csr_matrix
    from sparsebm import ModelSelection

    matrix = csr_matrix([[0, 1, 0, 0], [1, 0, 0, 0], [0, 0, 0, 1], [0, 0, 1, 0]])
    options = {"symmetric": True} if algorithm == "SBM" else {}
    np.random.seed(42)
    original = ModelSelection(algorithm, n_clusters_max=4, use_gpu=False, plot=False).fit(matrix, **options)
    np.random.seed(42)
    recorded, history = fit_selection(algorithm, matrix, 4, **options)
    assert history
    assert [key for key, _ in recorded.items()] == [key for key, _ in original.items()]
    for (_, actual), (_, expected) in zip(recorded.items(), original.items()):
        assert actual.get_ICL() == expected.get_ICL()
        np.testing.assert_array_equal(actual.group_connection_probabilities, expected.group_connection_probabilities)
