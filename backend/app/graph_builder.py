import math
from dataclasses import dataclass
import igraph as ig

from .config import Settings
from .errors import bad_request, too_large
from .models import AnalyzeRequest


@dataclass(frozen=True)
class BuiltGraph:
    graph: ig.Graph
    weights: list[float] | None
    edge_keys: list[str]


def validate_request(request: AnalyzeRequest, settings: Settings) -> None:
    node_count = len(request.node_ids)
    edge_count = len(request.edge_sources)
    if node_count > settings.max_nodes:
        raise too_large("max_nodes", f"Graph has {node_count} nodes; configured maximum is {settings.max_nodes}.")
    if edge_count > settings.max_edges:
        raise too_large("max_edges", f"Graph has {edge_count} edges; configured maximum is {settings.max_edges}.")
    if len(request.edge_targets) != edge_count:
        raise bad_request("edge_array_length", "edgeSources and edgeTargets must have equal lengths.")
    if len(set(request.node_ids)) != node_count:
        raise bad_request("duplicate_node_id", "nodeIds must be unique.")
    if request.edge_weights is not None:
        if len(request.edge_weights) != edge_count:
            raise bad_request("weight_array_length", "edgeWeights must align with the edge arrays.")
        if not all(math.isfinite(weight) for weight in request.edge_weights):
            raise bad_request("non_finite_weight", "edgeWeights must contain only finite values.")
    if request.edge_keys is not None:
        if len(request.edge_keys) != edge_count:
            raise bad_request("edge_key_length", "edgeKeys must align with the edge arrays.")
        if len(set(request.edge_keys)) != edge_count:
            raise bad_request("duplicate_edge_key", "edgeKeys must be unique.")
    for name, values in (("communities", request.communities), ("partitions", request.partitions), ("initialX", request.initial_x), ("initialY", request.initial_y)):
        if values is not None and len(values) != node_count:
            raise bad_request("node_array_length", f"{name} must align with nodeIds.")
    if (request.initial_x is None) != (request.initial_y is None):
        raise bad_request("initial_coordinates", "initialX and initialY must be supplied together.")
    if request.initial_x is not None and not all(math.isfinite(value) for value in request.initial_x + request.initial_y):
        raise bad_request("initial_coordinates", "Initial coordinates must be finite.")

    seen: set[tuple[int, int]] = set()
    for index, (source, target) in enumerate(zip(request.edge_sources, request.edge_targets)):
        if source < 0 or source >= node_count or target < 0 or target >= node_count:
            raise bad_request("endpoint_bounds", f"Edge {index} endpoint is outside nodeIds.")
        if source == target:
            raise bad_request("self_loop", f"Edge {index} is a self-loop; MiNE cloud analysis uses simple-graph semantics.")
        pair = (source, target) if request.directed or source < target else (target, source)
        if pair in seen:
            raise bad_request("parallel_edge", f"Edge {index} is parallel to an earlier edge; topology was not changed.")
        seen.add(pair)


def build_graph(request: AnalyzeRequest, settings: Settings) -> BuiltGraph:
    validate_request(request, settings)
    graph = ig.Graph(
        n=len(request.node_ids),
        edges=zip(request.edge_sources, request.edge_targets),
        directed=request.directed,
    )
    graph.vs["name"] = request.node_ids
    edge_keys = request.edge_keys or [f"e{index}" for index in range(graph.ecount())]
    graph.es["key"] = edge_keys
    if request.edge_weights is not None:
        graph.es["weight"] = request.edge_weights
    return BuiltGraph(graph=graph, weights=request.edge_weights, edge_keys=edge_keys)
