from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator


def to_camel(value: str) -> str:
    head, *tail = value.split("_")
    return head + "".join(part.title() for part in tail)


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")


class LayoutSpec(ApiModel):
    algorithm: Literal["auto", "drl", "fruchtermanReingold", "kamadaKawai", "bipartite", "sugiyama", "circular", "random"]
    seed: int = 42
    normalize: bool = True
    iterations: int = Field(default=500, ge=1, le=10000)


class CommunitySpec(ApiModel):
    algorithm: Literal["louvain", "infomap", "labelPropagation", "walktrap", "fastGreedy", "sbm", "lbm"]
    weight_channel: Literal["unweighted", "weight_raw", "weight_secondary"] = "unweighted"
    resolution: float = Field(default=1.0, gt=0)
    iterations: int = Field(default=2, ge=-1, le=1000)
    trials: int = Field(default=10, ge=1, le=1000)
    steps: int = Field(default=4, ge=1, le=1000)
    seed: int = 42
    clusters: int = Field(default=5, ge=2, le=100)


class AnalyzeRequest(ApiModel):
    schema_version: Literal["mine-igraph-1"]
    request_id: str | None = Field(default=None, min_length=1, max_length=200)
    graph_revision: str = Field(min_length=1, max_length=200)
    filter_revision: str = Field(min_length=1, max_length=200)
    node_order_hash: str = Field(min_length=1, max_length=100)
    edge_order_hash: str = Field(min_length=1, max_length=100)
    directed: bool = False
    bipartite: bool = False
    node_ids: list[str]
    edge_sources: list[int]
    edge_targets: list[int]
    edge_weights: list[float] | None = None
    edge_keys: list[str] | None = None
    communities: list[str | int] | None = None
    partitions: list[str | int] | None = None
    initial_x: list[float] | None = None
    initial_y: list[float] | None = None
    metric_ids: list[str] = Field(default_factory=list)
    layout: LayoutSpec | None = None
    community: CommunitySpec | None = None
    resolution: float = 1.0
    random_seed: int = 42

    @model_validator(mode="after")
    def operation_requested(self):
        if not self.metric_ids and self.layout is None and self.community is None:
            raise ValueError("At least one metric, community operation, or layout must be requested.")
        return self


class Positions(ApiModel):
    x: list[float]
    y: list[float]


class CommunityResult(ApiModel):
    algorithm: str
    label: str
    membership: list[int]
    quality: float | None = None
    provenance: dict[str, Any] = Field(default_factory=dict)


class AnalyzeResponse(ApiModel):
    schema_version: Literal["mine-igraph-1"] = "mine-igraph-1"
    request_id: str | None = None
    graph_revision: str
    filter_revision: str
    node_order_hash: str
    edge_order_hash: str
    node_count: int
    edge_count: int
    positions: Positions | None = None
    community: CommunityResult | None = None
    node_metrics: dict[str, list[float | int | str | None]] = Field(default_factory=dict)
    edge_metrics: dict[str, list[float | int | str | None]] = Field(default_factory=dict)
    graph_metrics: dict[str, Any] = Field(default_factory=dict)
    validity: dict[str, Any] = Field(default_factory=dict)
    warnings: dict[str, str] = Field(default_factory=dict)
    timings: dict[str, float] = Field(default_factory=dict)
