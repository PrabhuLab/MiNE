import pytest
from pydantic import SecretStr, ValidationError

from app.mindat import _fetch_geomaterials, build_mindat_network, fetch_mindat_dataset
from app.models import (
    MindatAttributeSelection,
    MindatDataset,
    MindatDatasetRequest,
    MindatNetworkRequest,
    MindatSearchFilters,
)


OCCURRENCES = [
    {"id": 10, "min": 3337, "loc": 3154, "typeloc": 1, "questioned": 0, "quality": 1},
    {"id": 11, "min": 3337, "loc": 3154, "typeloc": 0, "questioned": 1, "quality": 2},
    {"id": 12, "min": 4060, "loc": 3154, "typeloc": 0, "questioned": 0, "quality": 0},
    {"id": 13, "min": 3337, "loc": 9000, "typeloc": 0, "questioned": 0, "quality": 1},
    {"id": 14, "min": 4060, "loc": 9000, "typeloc": 0, "questioned": 0, "quality": 1},
    {"id": 15, "min": 5000, "loc": 9000, "typeloc": 0, "questioned": 0, "quality": 1},
]
MINERALS = [
    {"id": 3337, "name": "Quartz", "ima_formula": "SiO2", "ima_status": ["APPROVED"]},
    {"id": 4060, "name": "Calcite", "ima_formula": "CaCO3"},
    {"id": 5000, "name": "Pyrite", "ima_formula": "FeS2"},
]
LOCALITIES = [
    {"id": 3154, "txt": "Falun Mine", "country": "Sweden", "latitude": 60.6},
    {"id": 9000, "txt": "Test Quarry", "country": "USA", "latitude": 40.1},
]


def source_dataset() -> MindatDataset:
    return MindatDataset(
        query={"filters": {"includeElements": ["Fe"]}},
        attribute_catalog={
            "mineral": ["ima_formula", "ima_status"],
            "locality": ["country", "latitude"],
            "occurrence": ["typeloc", "questioned", "quality"],
        },
        geomaterials=MINERALS,
        localities=LOCALITIES,
        occurrences=OCCURRENCES,
    )


def request(topology: str) -> MindatNetworkRequest:
    return MindatNetworkRequest(
        dataset=source_dataset(), topology=topology,
        attributes=MindatAttributeSelection(
            mineral=["ima_formula", "ima_status"], locality=["country", "latitude"],
            occurrence=["typeloc", "questioned", "quality"],
        ),
    )


def test_bipartite_network_keeps_selected_node_and_aggregated_edge_attributes():
    network = build_mindat_network(request("bipartite"), 100)
    assert network["bipartite"] is True
    assert [node["id"] for node in network["nodes"]] == [
        "mineral:3337", "mineral:4060", "mineral:5000", "locality:3154", "locality:9000",
    ]
    quartz = network["nodes"][0]
    assert quartz["ima_formula"] == "SiO2"
    assert quartz["ima_status"] == "APPROVED"
    edge = network["edges"][0]
    assert edge["weight_raw"] == 2
    assert edge["occurrence_ids"] == "10,11"
    assert edge["typeloc"] is True
    assert edge["questioned"] is True
    assert edge["quality"] == 2


def test_mineral_projection_connects_minerals_by_shared_localities():
    network = build_mindat_network(request("mineral"), 100)
    assert network["bipartite"] is False
    assert [node["id"] for node in network["nodes"]] == ["mineral:3337", "mineral:4060", "mineral:5000"]
    edge = next(item for item in network["edges"] if item["source"] == "mineral:3337" and item["target"] == "mineral:4060")
    assert edge["weight_raw"] == 2
    assert edge["shared_locality_count"] == 2
    assert edge["shared_locality_ids"] == "3154,9000"


def test_locality_projection_connects_localities_by_shared_minerals():
    network = build_mindat_network(request("locality"), 100)
    assert network["bipartite"] is False
    assert [node["id"] for node in network["nodes"]] == ["locality:3154", "locality:9000"]
    assert network["edges"][0]["weight_raw"] == 2
    assert network["edges"][0]["shared_mineral_ids"] == "3337,4060"


def test_openmindat_geomaterial_search_uses_only_package_supported_filters(monkeypatch):
    captured = {}

    def fake_records(_client, endpoint, params):
        captured.update({"endpoint": endpoint, "params": params})
        return [{"id": 5000, "name": "Pyrite", "mindat_formula": "FeS2"}]

    monkeypatch.setattr("app.mindat._records", fake_records)
    dataset_request = MindatDatasetRequest(
        api_token=SecretStr("request-only-token"),
        filters=MindatSearchFilters(
            mineral_ids=[5000], name="pyr*", keywords="sulfide", include_elements=["Fe"],
            exclude_elements=["Pb"], essential_elements_only=True,
        ),
        max_geomaterials=50,
    )
    records, searched = _fetch_geomaterials(object(), dataset_request)
    assert searched is True
    assert records[0]["name"] == "Pyrite"
    assert captured["endpoint"] == "v1/geomaterials"
    assert {
        "id_in": "5000", "name": "pyr*", "q": "sulfide", "el_inc": "Fe", "el_exc": "Pb",
        "el_essential": True, "fields": "*", "ordering": "id", "page-size": 50, "page": 1,
    }.items() <= captured["params"].items()


def test_unsupported_formula_filter_is_not_accepted_as_an_openmindat_search_mode():
    with pytest.raises(ValidationError):
        MindatSearchFilters.model_validate({"name": "Pyrite", "formula": "FeS2"})


def test_created_json_contains_all_returned_fields_and_dynamic_attribute_catalog(monkeypatch):
    monkeypatch.setattr("app.mindat._safe_openmindat_api", lambda _token: object())
    monkeypatch.setattr("app.mindat._fetch_geomaterials", lambda _client, _request: (MINERALS, True))
    monkeypatch.setattr("app.mindat._fetch_occurrences", lambda *_args: OCCURRENCES)
    monkeypatch.setattr(
        "app.mindat._fetch_records_by_ids",
        lambda _client, record_type, _ids: [] if record_type == "mineral" else LOCALITIES,
    )
    dataset = fetch_mindat_dataset(MindatDatasetRequest(
        api_token=SecretStr("request-only-token"),
        filters=MindatSearchFilters(include_elements=["Fe"]),
    ))
    assert dataset.format == "mindat-json"
    assert dataset.geomaterials[2]["ima_formula"] == "FeS2"
    assert "ima_formula" in dataset.attribute_catalog["mineral"]
    assert "quality" in dataset.attribute_catalog["occurrence"]
    assert "request-only-token" not in str(dataset.model_dump(by_alias=True))


def test_mindat_dataset_endpoint_keeps_token_out_of_created_json(client, monkeypatch):
    def fake_fetch(_request):
        return source_dataset()

    monkeypatch.setattr("app.main.fetch_mindat_dataset", fake_fetch)
    response = client.post("/v1/mindat/dataset", json={
        "apiToken": "request-only-token",
        "filters": {
            "mineralIds": [], "localityIds": [], "name": "Pyrite", "keywords": "",
            "includeElements": ["Fe"], "excludeElements": ["Pb"], "essentialElementsOnly": True,
        },
        "maxGeomaterials": 50, "maxOccurrences": 250, "includeQuestioned": False,
    })
    assert response.status_code == 200, response.text
    assert response.json()["format"] == "mindat-json"
    assert "request-only-token" not in response.text


def test_mindat_network_endpoint_builds_from_created_json(client, monkeypatch):
    captured = {}

    def fake_build(network_request, max_projection_edges):
        captured["request"] = network_request
        captured["limit"] = max_projection_edges
        return {"nodes": [], "edges": [], "topology": "mineral", "bipartite": False, "occurrenceCount": 0, "mineralCount": 0, "localityCount": 0}

    monkeypatch.setattr("app.main.build_mindat_network", fake_build)
    response = client.post("/v1/mindat/network", json={
        "dataset": source_dataset().model_dump(by_alias=True), "topology": "mineral",
        "attributes": {"mineral": ["ima_formula"], "locality": [], "occurrence": ["quality"]},
    })
    assert response.status_code == 200, response.text
    assert response.json()["topology"] == "mineral"
    assert captured["request"].dataset.format == "mindat-json"
    assert captured["request"].attributes.mineral == ["ima_formula"]
    assert captured["limit"] > 0
