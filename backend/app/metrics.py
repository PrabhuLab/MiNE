from dataclasses import asdict, dataclass
import math
import random
import time
from typing import Callable, Literal
import igraph as ig

from .config import Settings
from .errors import incompatible
from .models import AnalyzeRequest
from .normalize import finite_array, finite_or_none


@dataclass(frozen=True)
class MetricDefinition:
    id: str
    result_attributes: tuple[str, ...]
    directed: bool
    undirected: bool
    weighted: bool
    unweighted: bool
    bipartite: bool
    exact: bool
    max_nodes_setting: str | None
    max_edges_setting: str | None
    weight_interpretation: Literal["none", "strength", "distance", "sum"]
    normalization: str


DEFINITIONS = (
    MetricDefinition("density", ("density",), True, True, True, True, True, True, None, None, "none", "igraph simple-graph density"),
    MetricDefinition("diameter", ("diameter",), True, True, True, True, True, True, "diameter_max_nodes", None, "none", "MiNE parity: unweighted; null represents infinite disconnected result"),
    MetricDefinition("extent", ("extent",), True, True, True, True, True, True, None, None, "none", "min/max selected edge weight"),
    MetricDefinition("simpleSize", ("simpleSize",), True, True, True, True, True, True, None, None, "none", "edge count"),
    MetricDefinition("weightedSize", ("weightedSize",), True, True, True, False, True, True, None, None, "sum", "sum of selected weights"),
    MetricDefinition("eccentricity", ("eccentricity",), True, True, True, True, True, True, "eccentricity_max_nodes", None, "none", "MiNE parity: unweighted; null represents infinity"),
    MetricDefinition("weightedDegree", ("weightedDegree", "weightedInDegree", "weightedOutDegree"), True, True, True, False, True, True, None, None, "strength", "raw incident strength"),
    MetricDefinition("degree", ("degreeCentrality", "inDegreeCentrality", "outDegreeCentrality"), True, True, True, True, True, True, None, None, "none", "degree divided by n-1"),
    MetricDefinition("betweenness", ("betweenness",), True, True, True, True, True, True, "betweenness_max_nodes", "betweenness_max_edges", "distance", "Graphology-compatible normalized exact score"),
    MetricDefinition("edgeBetweenness", ("edgeBetweenness",), True, True, True, True, True, True, "edge_betweenness_max_nodes", "edge_betweenness_max_edges", "distance", "Graphology-compatible normalized exact score"),
    MetricDefinition("closeness", ("closeness",), True, True, True, True, True, True, "closeness_max_nodes", None, "none", "MiNE parity: unweighted Wasserman-Faust"),
    MetricDefinition("eigenvector", ("eigenvector",), True, True, True, True, False, True, None, None, "strength", "Graphology parity: Euclidean norm is one"),
    MetricDefinition("hits", ("hub", "authority"), True, False, True, True, True, True, None, None, "strength", "Graphology parity: each score vector sums to one"),
    MetricDefinition("pagerank", ("pagerank",), True, True, True, True, True, True, None, None, "strength", "damping 0.85; scores sum to one"),
    MetricDefinition(
        "louvain",
        ("louvain", "louvainDeltaQ", "modularityContribution", "withinCommunityWeight", "nodeStrength", "communityStrength", "louvainModularity"),
        False, True, True, True, True, True, None, None, "strength",
        "igraph multilevel membership and sparse per-node modularity-matrix terms; seeded RNG",
    ),
    MetricDefinition("modularity", ("modularity",), True, True, True, True, True, True, None, None, "strength", "MiNE parity: provided membership at resolution 1.0"),
)
REGISTRY = {definition.id: definition for definition in DEFINITIONS}


def capabilities(settings: Settings) -> list[dict]:
    output = []
    for definition in DEFINITIONS:
        item = asdict(definition)
        item["max_nodes"] = getattr(settings, definition.max_nodes_setting) if definition.max_nodes_setting else settings.max_nodes
        item["max_edges"] = getattr(settings, definition.max_edges_setting) if definition.max_edges_setting else settings.max_edges
        output.append(item)
    return output


def _positive_weights(request: AnalyzeRequest, metric_id: str) -> list[float] | None:
    weights = request.edge_weights
    if weights is not None and any(weight <= 0 for weight in weights):
        raise incompatible("invalid_metric_weights", f"{metric_id} uses weights as distances and requires strictly positive values; weights were not inverted.")
    return weights


def _communities(request: AnalyzeRequest) -> list[int]:
    if request.communities is None:
        raise incompatible("communities_required", "modularity requires an aligned communities array or a Louvain result in the same request.")
    ids: dict[str, int] = {}
    return [ids.setdefault(str(value), len(ids)) for value in request.communities]


def _normalized_betweenness(values: list[float], n: int, directed: bool) -> list[float]:
    denominator = (n - 1) * (n - 2)
    if not directed:
        denominator /= 2
    return [value / denominator if denominator > 0 else 0.0 for value in values]


def _normalized_edge_betweenness(values: list[float], n: int, directed: bool) -> list[float]:
    denominator = n * (n - 1)
    if not directed:
        denominator /= 2
    return [value / denominator if denominator > 0 else 0.0 for value in values]


def _graphology_eccentricity(graph: ig.Graph, directed: bool) -> list[float | None]:
    mode = "out" if directed else "all"
    matrix = graph.distances(mode=mode)
    output: list[float | None] = []
    for distances in matrix:
        output.append(None if any(math.isinf(value) for value in distances) else max(distances, default=math.inf))
    return output


def _graphology_closeness(graph: ig.Graph, directed: bool) -> list[float]:
    # Graphology's NeighborhoodIndex('inbound') traverses incoming edges.
    matrix = graph.distances(mode="in" if directed else "all")
    n = graph.vcount()
    output: list[float] = []
    for index, distances in enumerate(matrix):
        reachable = [distance for target, distance in enumerate(distances) if target != index and math.isfinite(distance)]
        total = sum(reachable)
        count = len(reachable)
        output.append((count / total) * (count / (n - 1)) if total > 0 and n > 1 else 0.0)
    return output


def _l2_normalize(values: list[float]) -> list[float]:
    norm = math.sqrt(sum(value * value for value in values))
    return [value / norm for value in values] if norm > 0 else values


def _sum_normalize(values: list[float]) -> list[float]:
    total = sum(values)
    return [value / total for value in values] if total != 0 else values


def _louvain_node_modularity_terms(
    graph: ig.Graph,
    membership: list[int],
    weights: list[float] | None,
    resolution: float,
) -> dict[str, list[float]]:
    """Sparse row sums of igraph's undirected modularity matrix.

    The node contributions sum to the same Q returned by igraph without
    materializing the dense ``modularity_matrix`` result.
    """
    edge_weights = weights if weights is not None else [1.0] * graph.ecount()
    total_weight = float(sum(edge_weights))
    strengths = [float(value) for value in graph.strength(mode="all", weights=weights)]
    community_strengths: dict[int, float] = {}
    for community, strength in zip(membership, strengths):
        community_strengths[community] = community_strengths.get(community, 0.0) + strength

    within = [0.0] * graph.vcount()
    for (source, target), weight in zip(graph.get_edgelist(), edge_weights):
        if membership[source] != membership[target]:
            continue
        within[source] += weight
        within[target] += weight

    deltas: list[float] = []
    contributions: list[float] = []
    aligned_community_strengths: list[float] = []
    for index, community in enumerate(membership):
        community_strength = community_strengths[community]
        delta = (
            within[index] / total_weight
            - resolution * strengths[index] * community_strength / (2 * total_weight * total_weight)
        ) if total_weight > 0 else 0.0
        deltas.append(delta)
        contributions.append(delta / 2)
        aligned_community_strengths.append(community_strength)
    return {
        "louvainDeltaQ": finite_array(deltas),
        "modularityContribution": finite_array(contributions),
        "withinCommunityWeight": finite_array(within),
        "nodeStrength": finite_array(strengths),
        "communityStrength": finite_array(aligned_community_strengths),
    }


def compute_metrics(graph: ig.Graph, request: AnalyzeRequest, settings: Settings):
    node_metrics: dict[str, list] = {}
    edge_metrics: dict[str, list] = {}
    graph_metrics: dict[str, object] = {}
    warnings: dict[str, str] = {}
    timings: dict[str, float] = {}
    calculated_ids: list[str] = []
    membership: list[int] | None = None

    for metric_id in dict.fromkeys(request.metric_ids):
        definition = REGISTRY.get(metric_id)
        if definition is None:
            warnings[metric_id] = "Metric is not supported by the igraph backend; use the browser engine for this metric."
            continue
        if request.directed and not definition.directed:
            warnings[metric_id] = "Metric is not supported for directed graphs by the cloud engine."
            continue
        if not request.directed and not definition.undirected:
            warnings[metric_id] = "Metric is not supported for undirected graphs by the cloud engine."
            continue
        if request.bipartite and not definition.bipartite:
            warnings[metric_id] = "Metric is not supported for bipartite graphs by the cloud engine."
            continue
        max_nodes = getattr(settings, definition.max_nodes_setting) if definition.max_nodes_setting else settings.max_nodes
        max_edges = getattr(settings, definition.max_edges_setting) if definition.max_edges_setting else settings.max_edges
        if graph.vcount() > max_nodes or graph.ecount() > max_edges:
            raise incompatible("metric_size_gate", f"Exact {metric_id} is limited to {max_nodes} nodes and {max_edges} edges; no approximation was returned under the exact ID.")
        started = time.perf_counter()
        weights = request.edge_weights
        n = graph.vcount()
        if metric_id == "density":
            graph_metrics["density"] = finite_or_none(graph.density(loops=False))
        elif metric_id == "diameter":
            values = _graphology_eccentricity(graph, request.directed)
            graph_metrics["diameter"] = max(values) if values and all(value is not None for value in values) else None
            if graph_metrics["diameter"] is None: warnings["diameter"] = "MiNE's disconnected diameter is infinite and is encoded as null in JSON."
        elif metric_id == "extent":
            values = weights if weights is not None else [1.0] * graph.ecount()
            graph_metrics["extent"] = [min(values), max(values)] if values else [0.0, 0.0]
        elif metric_id == "simpleSize":
            graph_metrics["simpleSize"] = graph.ecount()
        elif metric_id == "weightedSize":
            graph_metrics["weightedSize"] = sum(weights if weights is not None else [1.0] * graph.ecount())
        elif metric_id == "eccentricity":
            node_metrics["eccentricity"] = _graphology_eccentricity(graph, request.directed)
            if any(value is None for value in node_metrics["eccentricity"]): warnings["eccentricity"] = "Infinite eccentricities are encoded as null in JSON."
        elif metric_id == "weightedDegree":
            node_metrics["weightedDegree"] = finite_array(graph.strength(mode="all", weights=weights))
            if request.directed:
                node_metrics["weightedInDegree"] = finite_array(graph.strength(mode="in", weights=weights))
                node_metrics["weightedOutDegree"] = finite_array(graph.strength(mode="out", weights=weights))
        elif metric_id == "degree":
            denominator = max(1, n - 1)
            node_metrics["degreeCentrality"] = [value / denominator for value in graph.degree(mode="all")]
            if request.directed:
                node_metrics["inDegreeCentrality"] = [value / denominator for value in graph.degree(mode="in")]
                node_metrics["outDegreeCentrality"] = [value / denominator for value in graph.degree(mode="out")]
        elif metric_id == "betweenness":
            values = graph.betweenness(directed=request.directed, weights=_positive_weights(request, metric_id))
            node_metrics["betweenness"] = finite_array(_normalized_betweenness(values, n, request.directed))
        elif metric_id == "edgeBetweenness":
            values = graph.edge_betweenness(directed=request.directed, weights=_positive_weights(request, metric_id))
            edge_metrics["edgeBetweenness"] = finite_array(_normalized_edge_betweenness(values, n, request.directed))
        elif metric_id == "closeness":
            node_metrics["closeness"] = _graphology_closeness(graph, request.directed)
        elif metric_id == "eigenvector":
            values = graph.eigenvector_centrality(directed=request.directed, weights=weights, scale=True)
            node_metrics["eigenvector"] = finite_array(_l2_normalize(values))
        elif metric_id == "hits":
            node_metrics["hub"] = finite_array(_sum_normalize(graph.hub_score(weights=weights, scale=True)))
            node_metrics["authority"] = finite_array(_sum_normalize(graph.authority_score(weights=weights, scale=True)))
        elif metric_id == "pagerank":
            node_metrics["pagerank"] = finite_array(graph.pagerank(directed=request.directed, damping=0.85, weights=weights))
        elif metric_id == "louvain":
            if weights is not None and any(weight < 0 for weight in weights):
                raise incompatible("invalid_metric_weights", "Louvain requires non-negative strength weights.")
            ig.set_random_number_generator(random.Random(request.random_seed))
            clustering = graph.community_multilevel(weights=weights, resolution=request.resolution)
            membership = list(clustering.membership)
            node_metrics["louvain"] = membership
            node_metrics.update(_louvain_node_modularity_terms(graph, membership, weights, request.resolution))
            graph_metrics["louvainModularity"] = finite_or_none(clustering.modularity)
        elif metric_id == "modularity":
            values = membership if membership is not None else _communities(request)
            graph_metrics["modularity"] = finite_or_none(graph.modularity(values, weights=weights, resolution=1.0, directed=request.directed))
        timings[f"metric.{metric_id}Ms"] = round((time.perf_counter() - started) * 1000, 3)
        calculated_ids.append(metric_id)
    return node_metrics, edge_metrics, graph_metrics, warnings, timings, calculated_ids
