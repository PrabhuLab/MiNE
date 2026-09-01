import random
import time
from typing import Any

import igraph as ig

from .errors import incompatible
from .models import AnalyzeRequest, CommunityResult


COMMUNITY_CAPABILITIES: list[dict[str, Any]] = [
    {"id": "louvain", "label": "Louvain", "directed": False, "weighted": True, "parameters": ["resolution", "seed"]},
    {"id": "infomap", "label": "Infomap", "directed": True, "weighted": True, "parameters": ["trials", "seed"]},
    {"id": "labelPropagation", "label": "Label Propagation", "directed": True, "weighted": True, "parameters": ["seed"]},
    {"id": "walktrap", "label": "Walktrap", "directed": False, "weighted": True, "parameters": ["steps", "seed"]},
    {"id": "sbm", "label": "Sparse SBM", "directed": False, "weighted": False, "bipartite": False, "parameters": ["clusters", "seed"]},
    {"id": "lbm", "label": "Sparse LBM", "directed": False, "weighted": False, "bipartite": True, "parameters": ["clusters", "seed"]},
]
if hasattr(ig.Graph, "community_fastgreedy"):
    COMMUNITY_CAPABILITIES.append({"id": "fastGreedy", "label": "Fast Greedy", "directed": False, "weighted": True, "parameters": ["seed"]})


def _compute_sparse_sbm(request: AnalyzeRequest) -> list[int]:
    import numpy as np
    from scipy.sparse import coo_matrix
    from sparsebm import SBM

    node_count = len(request.node_ids)
    if request.bipartite:
        raise incompatible("sbm_graph_type", "Sparse SBM is available for unipartite graphs only. Use Sparse LBM for a bipartite graph.")
    if node_count < 2:
        raise incompatible("sbm_nodes", "Sparse SBM requires at least two nodes.")
    cluster_count = min(request.community.clusters, node_count)
    rows = request.edge_sources + request.edge_targets
    columns = request.edge_targets + request.edge_sources
    adjacency = coo_matrix((np.ones(len(rows), dtype=np.float64), (rows, columns)), shape=(node_count, node_count)).tocsr()
    np.random.seed(request.community.seed)
    model = SBM(
        cluster_count, max_iter=1000, n_init=10, n_init_total_run=1,
        n_iter_early_stop=10, verbosity=0, use_gpu=False,
    )
    model.fit(adjacency, symmetric=True)
    if not model.trained_successfully_:
        raise incompatible("sbm_convergence", "Sparse SBM did not converge for this graph and block count. Try fewer blocks or another seed.")
    return [int(value) for value in model.labels]


def _compute_sparse_lbm(request: AnalyzeRequest) -> tuple[list[int], dict[str, int]]:
    import numpy as np
    from scipy.sparse import coo_matrix
    from sparsebm import LBM

    if not request.bipartite:
        raise incompatible("lbm_graph_type", "Sparse LBM is available for bipartite graphs only.")
    if request.partitions is None:
        raise incompatible("lbm_partitions", "Sparse LBM requires one partition value for every node.")
    partition_values = list(dict.fromkeys(str(value) for value in request.partitions))
    if len(partition_values) != 2:
        raise incompatible("lbm_partitions", "Sparse LBM requires exactly two non-empty node partitions.")
    row_nodes = [index for index, value in enumerate(request.partitions) if str(value) == partition_values[0]]
    column_nodes = [index for index, value in enumerate(request.partitions) if str(value) == partition_values[1]]
    if len(row_nodes) < 2 or len(column_nodes) < 2:
        raise incompatible("lbm_partition_size", "Sparse LBM requires at least two nodes in each partition.")
    row_index = {node: index for index, node in enumerate(row_nodes)}
    column_index = {node: index for index, node in enumerate(column_nodes)}
    matrix_rows: list[int] = []
    matrix_columns: list[int] = []
    for source, target in zip(request.edge_sources, request.edge_targets):
        if source in row_index and target in column_index:
            matrix_rows.append(row_index[source]); matrix_columns.append(column_index[target])
        elif target in row_index and source in column_index:
            matrix_rows.append(row_index[target]); matrix_columns.append(column_index[source])
        else:
            raise incompatible("lbm_cross_partition_edges", "Sparse LBM requires every edge to connect the two node partitions.")
    matrix = coo_matrix(
        (np.ones(len(matrix_rows), dtype=np.float64), (matrix_rows, matrix_columns)),
        shape=(len(row_nodes), len(column_nodes)),
    ).tocsr()
    row_clusters = min(request.community.clusters, len(row_nodes))
    column_clusters = min(request.community.clusters, len(column_nodes))
    np.random.seed(request.community.seed)
    model = LBM(
        row_clusters, column_clusters, max_iter=1000, n_init=10,
        n_init_total_run=1, n_iter_early_stop=10, verbosity=0, use_gpu=False,
    )
    model.fit(matrix)
    if not model.trained_successfully_:
        raise incompatible("lbm_convergence", "Sparse LBM did not converge for this graph and block count. Try fewer blocks or another seed.")
    memberships = [0] * len(request.node_ids)
    for node, label in zip(row_nodes, model.row_labels): memberships[node] = int(label)
    column_offset = max((int(value) for value in model.row_labels), default=-1) + 1
    for node, label in zip(column_nodes, model.column_labels): memberships[node] = column_offset + int(label)
    return memberships, {"rowClusters": row_clusters, "columnClusters": column_clusters}


def compute_community(graph: ig.Graph, request: AnalyzeRequest) -> tuple[CommunityResult | None, float]:
    spec = request.community
    if spec is None:
        return None, 0.0
    if graph.ecount() == 0:
        raise incompatible("community_edges", "Community detection requires at least one edge.")
    if request.directed and spec.algorithm in {"louvain", "walktrap", "fastGreedy", "sbm", "lbm"}:
        raise incompatible("community_direction", f"{spec.algorithm} requires an undirected graph.")
    weights = request.edge_weights if spec.weight_channel != "unweighted" else None
    if spec.algorithm in {"sbm", "lbm"} and spec.weight_channel != "unweighted":
        raise incompatible("sparsebm_weights", f"{spec.algorithm} currently supports unweighted binary adjacency only. Select None for Community Weight.")
    if weights is not None and any(weight < 0 for weight in weights):
        raise incompatible("community_weights", "Community weights must be non-negative.")

    ig.set_random_number_generator(random.Random(spec.seed))
    started = time.perf_counter()
    try:
        sparse_provenance: dict[str, Any] = {}
        if spec.algorithm == "sbm":
            memberships = _compute_sparse_sbm(request)
            clustering = None
        elif spec.algorithm == "lbm":
            memberships, sparse_provenance = _compute_sparse_lbm(request)
            clustering = None
        elif spec.algorithm == "louvain":
            clustering = graph.community_multilevel(weights=weights, resolution=spec.resolution)
        elif spec.algorithm == "infomap":
            clustering = graph.community_infomap(edge_weights=weights, trials=spec.trials)
        elif spec.algorithm == "labelPropagation":
            clustering = graph.community_label_propagation(weights=weights)
        elif spec.algorithm == "walktrap":
            clustering = graph.community_walktrap(weights=weights, steps=spec.steps).as_clustering()
        elif spec.algorithm == "fastGreedy" and hasattr(graph, "community_fastgreedy"):
            clustering = graph.community_fastgreedy(weights=weights).as_clustering()
        else:  # pragma: no cover - pydantic prevents this
            raise incompatible("community_unknown", f"Unsupported community algorithm: {spec.algorithm}")
    except (ValueError, ig.InternalError) as exc:
        raise incompatible("community_failed", f"{spec.algorithm} failed: {exc}") from exc

    quality = None
    if clustering is not None:
        memberships = [int(value) for value in clustering.membership]
        try:
            quality = float(clustering.modularity)
        except (AttributeError, TypeError, ValueError):
            quality = None
    elapsed = (time.perf_counter() - started) * 1000
    definition = next(item for item in COMMUNITY_CAPABILITIES if item["id"] == spec.algorithm)
    result = CommunityResult(
        algorithm=spec.algorithm,
        label=definition["label"],
        membership=memberships,
        quality=quality,
        provenance={
            "engine": "sparsebm" if spec.algorithm in {"sbm", "lbm"} else "python-igraph",
            "weightChannel": spec.weight_channel,
            "resolution": spec.resolution,
            "iterations": spec.iterations,
            "trials": spec.trials,
            "steps": spec.steps,
            "seed": spec.seed,
            "clusters": spec.clusters,
            **sparse_provenance,
        },
    )
    return result, elapsed
