import math
import random
import igraph as ig

from .config import Settings
from .errors import incompatible
from .models import AnalyzeRequest
from .normalize import normalize_positions


SUPPORTED_LAYOUTS = ("auto", "drl", "fruchtermanReingold", "kamadaKawai", "bipartite", "sugiyama", "circular")


def _seed_igraph(seed: int) -> None:
    ig.set_random_number_generator(random.Random(seed))


def compute_layout(
    graph: ig.Graph,
    request: AnalyzeRequest,
    settings: Settings,
    warnings: dict[str, str],
) -> tuple[list[float], list[float]] | None:
    spec = request.layout
    if spec is None:
        return None
    _seed_igraph(spec.seed)
    weights = request.edge_weights
    algorithm = spec.algorithm
    if algorithm == "auto":
        if request.bipartite and request.partitions is not None:
            algorithm = "bipartite"
        elif request.directed and graph.is_dag():
            algorithm = "sugiyama"
        elif graph.vcount() >= 2000:
            algorithm = "drl"
        else:
            algorithm = "fruchtermanReingold"
    try:
        if algorithm == "drl":
            layout = graph.layout_drl(weights=weights)
        elif algorithm == "fruchtermanReingold":
            if graph.vcount() > settings.fr_max_nodes:
                raise incompatible("layout_size_gate", f"Fruchterman-Reingold is limited to {settings.fr_max_nodes} nodes; use DrL.")
            layout = graph.layout_fruchterman_reingold(weights=weights, niter=spec.iterations, grid="auto")
        elif algorithm == "kamadaKawai":
            layout = graph.layout_kamada_kawai(weights=weights)
        elif algorithm == "circular":
            layout = graph.layout_circle()
        elif algorithm == "random":
            rng = random.Random(spec.seed)
            layout = [(rng.uniform(-1, 1), rng.uniform(-1, 1)) for _ in range(graph.vcount())]
        elif algorithm == "bipartite":
            if not request.bipartite or request.partitions is None:
                raise incompatible("bipartite_layout", "Bipartite layout requires bipartite=true and an aligned partitions array.")
            first = request.partitions[0] if request.partitions else 0
            types = [value != first for value in request.partitions]
            layout = graph.layout_bipartite(types=types)
        elif algorithm == "sugiyama":
            if not request.directed:
                raise incompatible("sugiyama_layout", "Sugiyama requires a directed graph.")
            layout = graph.layout_sugiyama()
        else:  # pragma: no cover - pydantic prevents this
            raise incompatible("layout_unknown", f"Unsupported layout: {spec.algorithm}")
    except (ValueError, ig.InternalError) as exc:
        if algorithm in {"drl", "fruchtermanReingold", "kamadaKawai"}:
            warnings["layoutFallback"] = f"{algorithm} failed ({exc}); deterministic random coordinates were used."
            rng = random.Random(spec.seed)
            layout = [(rng.uniform(-1, 1), rng.uniform(-1, 1)) for _ in range(graph.vcount())]
        else:
            raise incompatible("layout_failed", f"{algorithm} failed: {exc}") from exc

    coordinates = [(float(point[0]), float(point[1])) for point in layout]
    if len(coordinates) != graph.vcount() or any(not math.isfinite(x) or not math.isfinite(y) for x, y in coordinates):
        warnings["coordinateFallback"] = "The selected layout returned incomplete coordinates; deterministic random coordinates were used."
        rng = random.Random(spec.seed)
        coordinates = [(rng.uniform(-1, 1), rng.uniform(-1, 1)) for _ in range(graph.vcount())]
    return normalize_positions(coordinates, spec.normalize)
