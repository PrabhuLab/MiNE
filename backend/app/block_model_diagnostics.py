"""Serializable SparseBM fits and selection history, without retaining model objects."""
import hashlib
import json
import math
import platform
from types import FunctionType
from importlib.metadata import version
from typing import Any

from .config import get_settings
from .models import AnalyzeRequest


def model_score(model, rows: int, columns: int | None, limit: int | None) -> dict[str, Any]:
    if columns is None:
        counts = {"clusters": int(model.n_clusters)}
        groups = counts["clusters"]
        terms = {"groupProportions": (groups - 1) / 2 * math.log(rows),
                 "blockProbabilities": groups ** 2 / 2 * math.log(rows * (rows - 1))}
    else:
        counts = {"rowClusters": int(model.n_row_clusters), "columnClusters": int(model.n_column_clusters)}
        k, l = counts.values()
        groups = k + l
        terms = {"rowProportions": (k - 1) / 2 * math.log(rows),
                 "columnProportions": (l - 1) / 2 * math.log(columns),
                 "blockProbabilities": k * l / 2 * math.log(rows * columns)}
    trained = bool(model.trained_successfully_)
    finite = lambda value: float(value) if math.isfinite(float(value)) else None
    return {**counts, "totalGroups": groups, "trainedSuccessfully": trained,
            "withinLimit": limit is None or groups <= limit,
            "fitScore": finite(model.loglikelihood_) if trained else None,
            "penaltyTerms": terms, "penalty": sum(terms.values()),
            "icl": finite(model.get_ICL()) if trained else None}


def fit_selection(algorithm: str, matrix, limit: int, **fit_options):
    from sparsebm import LBM, SBM, ModelSelection

    history = []
    rows, columns = matrix.shape[0], matrix.shape[1] if algorithm == "LBM" else None

    class RecordedSelection(ModelSelection):
        # The pinned library exposes no callback. Keep recording local to this
        # selection instance rather than patching library globals.
        def _explore_strategy(self, strategy):
            if not history:
                for entry in self.model_explored.values():
                    history.append({**model_score(entry["model"], rows, columns, limit), "strategy": "initial"})
            return super()._explore_strategy(strategy)

        def _select_and_train_best_model(self, model, strategy, **kwargs):
            partition = ("row" if kwargs.get("type") == 0 else "column") if columns is not None else "nodes"

            def record(candidate, phase):
                history.append({**model_score(candidate, rows, columns, limit),
                                "strategy": strategy, "partition": partition, "phase": phase})

            class RecordedModel(LBM if algorithm == "LBM" else SBM):
                def _fit_single(self, *args, **options):
                    result = super()._fit_single(*args, **options)
                    record(self, "screening" if options.get("early_stop") is not None else "refitted")
                    return result

            def wrap(propose):
                def recorded(*args, **options):
                    score, candidate = propose(*args, **options)
                    record(candidate, "proposal")
                    candidate.__class__ = RecordedModel
                    return score, candidate
                return recorded

            original = ModelSelection._select_and_train_best_model
            namespace = dict(original.__globals__)
            for name in ("lbm_merge_group", "lbm_split_group", "sbm_merge_group", "sbm_split_group"):
                namespace[name] = wrap(namespace[name])
            # Run the unchanged library method with local proposal callbacks.
            recorded_select = FunctionType(original.__code__, namespace, original.__name__, original.__defaults__, original.__closure__)
            return recorded_select(self, model, strategy, **kwargs)

    selection = RecordedSelection(algorithm, n_clusters_max=limit, use_gpu=False, plot=False).fit(matrix, **fit_options)
    # Also include final retained models, including a fit stopped before a hook.
    for _, model in selection.items():
        summary = model_score(model, rows, columns, limit)
        if not any(all(entry.get(key) == value for key, value in summary.items()) for entry in history):
            history.append({**summary, "strategy": "retained"})
    return selection, history


def input_snapshot(request: AnalyzeRequest, row_nodes: list[int], column_nodes: list[int] | None) -> dict[str, Any]:
    partitions = [str(value) for value in request.partitions] if column_nodes is not None else None
    # Canonical identity is independent of node/edge ordering and undirected
    # edge orientation. It hashes exactly the binary network used by the fit.
    digest = hashlib.sha256()
    def add(value):
        digest.update(json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8") + b"\n")
    add({"directed": request.directed, "bipartite": request.bipartite, "adjacency": "binary"})
    for node, partition in sorted(zip(request.node_ids, partitions or [None] * len(request.node_ids))):
        add([node, partition])
    pairs = [tuple(sorted((request.node_ids[a], request.node_ids[b])))
             for a, b in zip(request.edge_sources, request.edge_targets)]
    for pair in sorted(pairs):
        add(pair)
    return {"fingerprint": digest.hexdigest(), "fingerprintKind": "sha256-binary-network-v1",
            "nodeIds": request.node_ids, "edgeSources": request.edge_sources, "edgeTargets": request.edge_targets,
            "partitions": partitions, "rowNodeIds": [request.node_ids[i] for i in row_nodes],
            "columnNodeIds": [request.node_ids[i] for i in column_nodes] if column_nodes is not None else None,
            "graphRevision": request.graph_revision, "filterRevision": request.filter_revision,
            "nodeOrderHash": request.node_order_hash, "edgeOrderHash": request.edge_order_hash}


def fitted_diagnostics(request: AnalyzeRequest, model, row_nodes: list[int], column_nodes: list[int] | None,
                       limit: int | None, candidates: list[dict[str, Any]]) -> dict[str, Any]:
    import numpy as np

    columns = len(column_nodes) if column_nodes is not None else None
    selected = model_score(model, len(row_nodes), columns, limit)
    def array(value):
        values = np.asarray(value, dtype=float)
        if not np.isfinite(values).all():
            raise ValueError("SparseBM returned non-finite fitted probabilities.")
        return values.tolist()
    selected.update(blockProbabilities=array(model.group_connection_probabilities), modelSettings=model.get_params())
    if column_nodes is None:
        selected.update(labels=[int(label) for label in model.labels],
                        softMemberships=array(model.predict_proba), groupProportions=array(model.group_membership_probability))
    else:
        selected.update(rowLabels=[int(label) for label in model.row_labels], columnLabels=[int(label) for label in model.column_labels],
                        rowSoftMemberships=array(model.row_predict_proba), columnSoftMemberships=array(model.column_predict_proba),
                        rowGroupProportions=array(model.row_group_membership_probability),
                        columnGroupProportions=array(model.column_group_membership_probability))
    if not candidates:
        candidates = [{**model_score(model, len(row_nodes), columns, limit), "strategy": "manual"}]
    candidates = [{**candidate, "candidateIndex": index,
                   "deltaIcl": selected["icl"] - candidate["icl"] if selected["icl"] is not None and candidate["icl"] is not None else None}
                  for index, candidate in enumerate(candidates)]
    return {"schemaVersion": "mine-block-model-1", "algorithm": request.community.algorithm, "labelBase": 0,
            "input": input_snapshot(request, row_nodes, column_nodes),
            "settings": request.community.model_dump(by_alias=True), "selectedModel": selected, "candidates": candidates,
            "search": {"effectiveMaxGroups": limit, "selectedAtLimit": limit is not None and selected["totalGroups"] == limit,
                       "historyCoverage": "initial, split/merge proposals, early-stop screening, fully-refitted candidates, and final retained models",
                       "scoreConvention": "SparseBM variational objective minus its implemented ICL penalty",
                       "convergenceConvention": "trainedSuccessfully is SparseBM's flag, not an independent convergence test"},
            "softwareVersions": {"mineBackend": get_settings().backend_version, "python": platform.python_version(),
                                 **{name: version(name) for name in ("sparsebm", "numpy", "scipy")}}}
