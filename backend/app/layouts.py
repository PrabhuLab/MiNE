import math
import random

import igraph as ig
from fa2 import ForceAtlas2

from .config import Settings
from .errors import incompatible
from .models import AnalyzeRequest
from .normalize import normalize_positions


SUPPORTED_LAYOUTS = ("auto", "drl", "fruchtermanReingold", "kamadaKawai", "sugiyama", "forceatlas2", "random")


def compute_layout(
    graph: ig.Graph,
    request: AnalyzeRequest,
    settings: Settings,
    warnings: dict[str, str],
) -> tuple[list[float], list[float]] | None:
    spec = request.layout
    if spec is None:
        return None
    count = graph.vcount()
    if count <= 1:
        return [0.0] * count, [0.0] * count

    ig.set_random_number_generator(random.Random(spec.seed))
    weights = request.edge_weights
    algorithm = spec.algorithm
    if algorithm == "auto":
        if request.directed and graph.is_dag():
            algorithm = "sugiyama"
        elif count >= min(2000, settings.fr_max_nodes + 1):
            algorithm = "drl"
        else:
            algorithm = "fruchtermanReingold"
    if weights and any(weight <= 0 for weight in weights) and algorithm not in {"random", "sugiyama"}:
        warnings["layoutWeights"] = "The layout used equal edge weights because the selected weights include zero or negative values."
        weights = None

    try:
        if algorithm == "drl":
            layout = graph.layout_drl(weights=weights)
        elif algorithm == "fruchtermanReingold":
            if count > settings.fr_max_nodes:
                raise incompatible("layout_size_gate", f"Fruchterman–Reingold is limited to {settings.fr_max_nodes} nodes. Use DrL.")
            layout = graph.layout_fruchterman_reingold(weights=weights, niter=spec.iterations, grid="auto")
        elif algorithm == "kamadaKawai":
            if count > settings.kk_max_nodes:
                raise incompatible("layout_size_gate", f"Kamada–Kawai is limited to {settings.kk_max_nodes} nodes. Use DrL.")
            layout = graph.layout_kamada_kawai(weights=weights)
        elif algorithm == "random":
            rng = random.Random(spec.seed)
            layout = [(rng.uniform(-1, 1), rng.uniform(-1, 1)) for _ in range(count)]
        elif algorithm == "sugiyama":
            if not request.directed:
                raise incompatible("sugiyama_layout", "Sugiyama requires a directed graph.")
            # igraph appends dummy vertices for edge bends after all original vertices.
            layout = graph.layout_sugiyama().coords[:count]
        elif algorithm == "forceatlas2":
            undirected = graph.as_undirected(mode="each") if graph.is_directed() else graph
            engine = ForceAtlas2.inferSettings(undirected, verbose=False, seed=spec.seed)
            layout = engine.forceatlas2_igraph_layout(undirected, weight_attr="weight" if weights else None)
        else:  # pragma: no cover - pydantic prevents this
            raise incompatible("layout_unknown", f"Unsupported layout: {spec.algorithm}")
    except (ValueError, ig.InternalError) as exc:
        raise incompatible("layout_failed", f"{algorithm} failed: {exc}") from exc

    coordinates = [(float(point[0]), float(point[1])) for point in layout]
    if len(coordinates) != count or any(not math.isfinite(x) or not math.isfinite(y) for x, y in coordinates):
        raise incompatible("layout_coordinates", "The selected layout returned incomplete or non-finite coordinates.")
    return normalize_positions(coordinates, spec.normalize)
