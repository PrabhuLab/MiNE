from __future__ import annotations

from collections import defaultdict
from importlib.metadata import version as package_version
from itertools import combinations
from pathlib import Path
from typing import Any, Iterable

import requests
from openmindat import GeomaterialRetriever, LocalitiesRetriever, MindatApi

from .errors import ApiError
from .models import MindatDataset, MindatDatasetRequest, MindatNetworkRequest

MINDAT_API_ROOT = "https://api.mindat.org"
LOOKUP_BATCH_SIZE = 100
OCCURRENCE_PAGE_SIZE = 500
RESERVED_FIELDS = {
    "mineral": {"id", "name"},
    "locality": {"id", "txt"},
    "occurrence": {"id", "min", "loc"},
}


def _safe_openmindat_api(token: str) -> MindatApi:
    """Create OpenMindat's API client without its interactive key-file setup."""
    clean_token = token.strip()
    if clean_token.lower().startswith("token "):
        clean_token = clean_token[6:].strip()
    if not clean_token:
        raise ApiError(422, "mindat_token", "Enter a Mindat API token.")

    # OpenMindat 0.1.x prompts and writes .apikey.yaml in MindatApi.__init__.
    # Request-scoped credentials must never be persisted, so initialize the
    # package client explicitly while retaining its API retrieval implementation.
    client = object.__new__(MindatApi)
    client._api_key = clean_token
    client.endpoint = ""
    client.MINDAT_API_URL = MINDAT_API_ROOT
    client._headers = {"Authorization": f"Token {clean_token}"}
    client.params = {"format": "json"}
    client.data_dir = str(Path("/tmp/mindat_data"))
    return client


def _records(client: MindatApi, endpoint: str, params: dict[str, Any]) -> list[dict[str, Any]]:
    try:
        payload = client.get_mindat_json(dict(params), endpoint, VERBOSE=0)
    except requests.RequestException as exc:
        raise ApiError(502, "mindat_unavailable", "Mindat could not be reached. Try again shortly.") from exc
    except ValueError as exc:
        detail = str(exc).strip()
        raise ApiError(502, "mindat_request", detail or "Mindat could not complete the request.") from exc

    results = payload.get("results") if isinstance(payload, dict) else None
    if not isinstance(results, list):
        raise ApiError(502, "mindat_response", "Mindat returned an unexpected response.")
    if len(results) == 1 and isinstance(results[0], dict) and "detail" in results[0] and "id" not in results[0]:
        detail = str(results[0].get("detail") or "").lower()
        if any(word in detail for word in ("auth", "credential", "token", "permission")):
            raise ApiError(401, "mindat_token", "Mindat rejected the API token. Check that it is active and has API access.")
        if any(word in detail for word in ("rate", "throttl")):
            raise ApiError(429, "mindat_rate_limit", "Mindat rate-limited the request. Wait briefly and try again.")
        raise ApiError(502, "mindat_response", "Mindat could not complete the request.")
    if any(not isinstance(record, dict) for record in results):
        raise ApiError(502, "mindat_response", "Mindat returned an unexpected response.")
    return results


def _chunks(values: list[int], size: int) -> Iterable[list[int]]:
    for index in range(0, len(values), size):
        yield values[index:index + size]


def _positive_int(value: Any) -> int | None:
    try:
        parsed = int(value)
        return parsed if parsed > 0 else None
    except (TypeError, ValueError):
        return None


def _record_map(records: list[dict[str, Any]]) -> dict[int, dict[str, Any]]:
    return {
        record_id: record
        for record in records
        if (record_id := _positive_int(record.get("id"))) is not None
    }


def _fetch_geomaterials(client: MindatApi, request: MindatDatasetRequest) -> tuple[list[dict[str, Any]], bool]:
    filters = request.filters
    search_requested = bool(
        filters.mineral_ids or filters.name.strip() or filters.keywords.strip()
        or filters.include_elements or filters.exclude_elements
    )
    if not search_requested:
        return [], False

    retriever = GeomaterialRetriever()
    if filters.mineral_ids:
        retriever.id_in(",".join(map(str, filters.mineral_ids)))
    if filters.name.strip():
        retriever.name(filters.name.strip())
    if filters.keywords.strip():
        retriever.q(filters.keywords.strip())
    if filters.include_elements:
        retriever.elements_inc(",".join(filters.include_elements))
    if filters.exclude_elements:
        retriever.elements_exc(",".join(filters.exclude_elements))
    if filters.essential_elements_only:
        retriever.el_essential(True)
    retriever.fields("*").ordering("id").page_size(request.max_geomaterials).page(1)
    return _records(client, retriever.end_point, retriever._params)[:request.max_geomaterials], True


def _fetch_occurrences(
    client: MindatApi,
    mineral_ids: list[int],
    locality_ids: list[int],
    maximum: int,
    include_questioned: bool,
) -> list[dict[str, Any]]:
    occurrences_by_id: dict[int, dict[str, Any]] = {}
    mineral_batches = list(_chunks(mineral_ids, LOOKUP_BATCH_SIZE)) if mineral_ids else [[]]
    for mineral_batch in mineral_batches:
        page = 1
        while len(occurrences_by_id) < maximum:
            page_size = min(OCCURRENCE_PAGE_SIZE, maximum - len(occurrences_by_id))
            params: dict[str, Any] = {
                "fields": "*", "format": "json", "ordering": "id", "page": page, "page-size": page_size,
            }
            if mineral_batch:
                params["min"] = ",".join(map(str, mineral_batch))
            if locality_ids:
                params["loc"] = ",".join(map(str, locality_ids))
            if not include_questioned:
                params["questioned"] = 0
            batch = _records(client, "v1/occurrences", params)
            for record in batch:
                occurrence_id = _positive_int(record.get("id"))
                if occurrence_id and _positive_int(record.get("min")) and _positive_int(record.get("loc")):
                    occurrences_by_id[occurrence_id] = record
                    if len(occurrences_by_id) >= maximum:
                        break
            if len(batch) < page_size:
                break
            page += 1
        if len(occurrences_by_id) >= maximum:
            break
    return [occurrences_by_id[key] for key in sorted(occurrences_by_id)]


def _fetch_records_by_ids(
    client: MindatApi,
    record_type: str,
    ids: list[int],
) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for batch in _chunks(ids, LOOKUP_BATCH_SIZE):
        if record_type == "mineral":
            retriever = GeomaterialRetriever().id_in(",".join(map(str, batch))).fields("*").page_size(len(batch)).page(1)
        else:
            retriever = LocalitiesRetriever().id_in(",".join(map(str, batch))).fields("*").page_size(len(batch)).page(1)
        records.extend(_records(client, retriever.end_point, retriever._params))
    return records


def _field_catalog(records: list[dict[str, Any]], scope: str) -> list[str]:
    reserved = RESERVED_FIELDS[scope]
    return sorted(
        {str(field) for record in records for field in record if field not in reserved and not str(field).startswith("_")},
        key=str.casefold,
    )


def fetch_mindat_dataset(request: MindatDatasetRequest) -> MindatDataset:
    client = _safe_openmindat_api(request.api_token.get_secret_value())
    geomaterials, geomaterial_search_requested = _fetch_geomaterials(client, request)
    searched_mineral_ids = sorted(_record_map(geomaterials))

    # A completed geomaterial search with zero matches must not fall through to
    # an unfiltered occurrence query.
    if geomaterial_search_requested and not searched_mineral_ids:
        occurrences: list[dict[str, Any]] = []
    else:
        occurrences = _fetch_occurrences(
            client,
            searched_mineral_ids,
            request.filters.locality_ids,
            request.max_occurrences,
            request.include_questioned,
        )

    occurrence_mineral_ids = sorted({_positive_int(record.get("min")) for record in occurrences} - {None})
    occurrence_locality_ids = sorted({_positive_int(record.get("loc")) for record in occurrences} - {None})
    minerals_by_id = _record_map(geomaterials)
    missing_mineral_ids = [value for value in occurrence_mineral_ids if value not in minerals_by_id]
    minerals_by_id.update(_record_map(_fetch_records_by_ids(client, "mineral", missing_mineral_ids)))
    locality_ids = sorted(set(occurrence_locality_ids) | set(request.filters.locality_ids))
    localities_by_id = _record_map(_fetch_records_by_ids(client, "locality", locality_ids))
    ordered_minerals = [minerals_by_id[key] for key in sorted(minerals_by_id)]
    ordered_localities = [localities_by_id[key] for key in sorted(localities_by_id)]

    return MindatDataset(
        query={
            "filters": request.filters.model_dump(by_alias=True),
            "maxGeomaterials": request.max_geomaterials,
            "maxOccurrences": request.max_occurrences,
            "includeQuestioned": request.include_questioned,
            "openMindatVersion": package_version("openmindat"),
        },
        attribute_catalog={
            "mineral": _field_catalog(ordered_minerals, "mineral"),
            "locality": _field_catalog(ordered_localities, "locality"),
            "occurrence": _field_catalog(occurrences, "occurrence"),
        },
        geomaterials=ordered_minerals,
        localities=ordered_localities,
        occurrences=occurrences,
    )


def _validated_fields(requested: Iterable[str], allowed: set[str], scope: str) -> list[str]:
    fields = list(dict.fromkeys(requested))
    invalid = sorted(set(fields) - allowed)
    if invalid:
        raise ApiError(422, "mindat_attributes", f"Unsupported Mindat {scope} attributes: {', '.join(invalid)}")
    return fields


def _attribute_value(value: Any) -> str | int | float | bool | None:
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float, str)):
        return value
    if isinstance(value, (list, tuple, set)):
        return ", ".join(str(item) for item in value if item is not None)
    if isinstance(value, dict):
        return ", ".join(f"{key}: {value[key]}" for key in sorted(value))
    return str(value)


def _selected_attributes(record: dict[str, Any], fields: list[str]) -> dict[str, Any]:
    return {
        field: normalized
        for field in fields
        if (normalized := _attribute_value(record.get(field))) is not None
    }


def _aggregate_occurrence_attributes(records: list[dict[str, Any]], fields: list[str]) -> dict[str, Any]:
    aggregated: dict[str, Any] = {}
    for field in fields:
        values = [_attribute_value(record.get(field)) for record in records]
        present = list(dict.fromkeys(value for value in values if value is not None))
        if not present:
            continue
        if field in {"typeloc", "questioned"}:
            aggregated[field] = any(bool(int(value)) for value in present)
        elif field in {"quality", "rarity"} and all(isinstance(value, (int, float)) for value in present):
            aggregated[field] = max(present)
        elif field == "datemodify":
            aggregated[field] = max(str(value) for value in present)
        else:
            aggregated[field] = present[0] if len(present) == 1 else " | ".join(map(str, present))
    return aggregated


def _mineral_node(record: dict[str, Any], fields: list[str]) -> dict[str, Any]:
    mineral_id = int(record["id"])
    label = str(record.get("name") or "").strip() or f"Mindat mineral {mineral_id}"
    return {
        "id": f"mineral:{mineral_id}", "name": label, "label": label, "type": "Mineral",
        "mindat_id": mineral_id, "mindat_url": f"https://www.mindat.org/min-{mineral_id}.html",
        **_selected_attributes(record, fields),
    }


def _locality_node(record: dict[str, Any], fields: list[str]) -> dict[str, Any]:
    locality_id = int(record["id"])
    label = str(record.get("txt") or "").strip() or f"Mindat locality {locality_id}"
    return {
        "id": f"locality:{locality_id}", "name": label, "label": label, "type": "Locality",
        "mindat_id": locality_id, "mindat_url": f"https://www.mindat.org/loc-{locality_id}.html",
        **_selected_attributes(record, fields),
    }


def _bipartite_edges(occurrences: list[dict[str, Any]], fields: list[str]) -> list[dict[str, Any]]:
    by_pair: dict[tuple[int, int], list[dict[str, Any]]] = defaultdict(list)
    for occurrence in occurrences:
        mineral_id = _positive_int(occurrence.get("min"))
        locality_id = _positive_int(occurrence.get("loc"))
        if mineral_id and locality_id:
            by_pair[(mineral_id, locality_id)].append(occurrence)
    return [
        {
            "key": f"occurrence:{mineral_id}:{locality_id}",
            "source": f"mineral:{mineral_id}", "target": f"locality:{locality_id}",
            "weight_raw": len(records), "occurrence_count": len(records),
            "occurrence_ids": ",".join(str(record["id"]) for record in records),
            "mindat_mineral_id": mineral_id, "mindat_locality_id": locality_id,
            **_aggregate_occurrence_attributes(records, fields),
        }
        for (mineral_id, locality_id), records in sorted(by_pair.items())
    ]


def _projection_edges(
    occurrences: list[dict[str, Any]], topology: str, occurrence_fields: list[str], max_edges: int,
    counterpart_records: dict[int, dict[str, Any]],
) -> list[dict[str, Any]]:
    project_field, shared_field = ("min", "loc") if topology == "mineral" else ("loc", "min")
    prefix = "mineral" if topology == "mineral" else "locality"
    shared_prefix = "locality" if topology == "mineral" else "mineral"
    groups: dict[int, dict[int, list[dict[str, Any]]]] = defaultdict(lambda: defaultdict(list))
    for occurrence in occurrences:
        project_id = _positive_int(occurrence.get(project_field))
        shared_id = _positive_int(occurrence.get(shared_field))
        if project_id and shared_id:
            groups[shared_id][project_id].append(occurrence)

    edge_groups: dict[tuple[int, int], list[int]] = defaultdict(list)
    edge_occurrences: dict[tuple[int, int], list[dict[str, Any]]] = defaultdict(list)
    for shared_id, members in sorted(groups.items()):
        for source_id, target_id in combinations(sorted(members), 2):
            pair = (source_id, target_id)
            if pair not in edge_groups and len(edge_groups) >= max_edges:
                raise ApiError(
                    413, "mindat_projection_too_large",
                    f"This projection exceeds the {max_edges:,}-edge safety limit. Narrow the Mindat search or lower Maximum Occurrences.",
                )
            edge_groups[pair].append(shared_id)
            edge_occurrences[pair].extend(members[source_id])
            edge_occurrences[pair].extend(members[target_id])

    edges: list[dict[str, Any]] = []
    for (source_id, target_id), shared_ids in sorted(edge_groups.items()):
        shared_labels = [
            str(counterpart_records.get(shared_id, {}).get("txt" if topology == "mineral" else "name") or shared_id)
            for shared_id in shared_ids
        ]
        records = edge_occurrences[(source_id, target_id)]
        edges.append({
            "key": f"{prefix}-projection:{source_id}:{target_id}",
            "source": f"{prefix}:{source_id}", "target": f"{prefix}:{target_id}",
            "weight_raw": len(shared_ids), f"shared_{shared_prefix}_count": len(shared_ids),
            f"shared_{shared_prefix}_ids": ",".join(map(str, shared_ids)),
            f"shared_{shared_prefix}s": " | ".join(shared_labels),
            "occurrence_count": len({record.get("id") for record in records}),
            "occurrence_ids": ",".join(str(value) for value in sorted({record.get("id") for record in records if record.get("id") is not None})),
            **_aggregate_occurrence_attributes(records, occurrence_fields),
        })
    return edges


def build_mindat_network(request: MindatNetworkRequest, max_projection_edges: int) -> dict[str, Any]:
    dataset = request.dataset
    mineral_fields = _validated_fields(request.attributes.mineral, set(dataset.attribute_catalog.get("mineral", [])), "mineral")
    locality_fields = _validated_fields(request.attributes.locality, set(dataset.attribute_catalog.get("locality", [])), "locality")
    occurrence_fields = _validated_fields(request.attributes.occurrence, set(dataset.attribute_catalog.get("occurrence", [])), "occurrence")
    occurrences = dataset.occurrences
    minerals_by_id = _record_map(dataset.geomaterials)
    localities_by_id = _record_map(dataset.localities)
    occurrence_mineral_ids = {_positive_int(record.get("min")) for record in occurrences} - {None}
    occurrence_locality_ids = {_positive_int(record.get("loc")) for record in occurrences} - {None}
    for mineral_id in occurrence_mineral_ids:
        minerals_by_id.setdefault(mineral_id, {"id": mineral_id})
    for locality_id in occurrence_locality_ids:
        localities_by_id.setdefault(locality_id, {"id": locality_id})
    mineral_ids = sorted(minerals_by_id)
    locality_ids = sorted(localities_by_id)

    if request.topology == "bipartite":
        nodes = [
            {**_mineral_node(minerals_by_id[mineral_id], mineral_fields), "partition": "A"}
            for mineral_id in mineral_ids
        ] + [
            {**_locality_node(localities_by_id[locality_id], locality_fields), "partition": "B"}
            for locality_id in locality_ids
        ]
        edges = _bipartite_edges(occurrences, occurrence_fields)
    elif request.topology == "mineral":
        nodes = [_mineral_node(minerals_by_id[mineral_id], mineral_fields) for mineral_id in mineral_ids]
        edges = _projection_edges(occurrences, request.topology, occurrence_fields, max_projection_edges, localities_by_id)
    else:
        nodes = [_locality_node(localities_by_id[locality_id], locality_fields) for locality_id in locality_ids]
        edges = _projection_edges(occurrences, request.topology, occurrence_fields, max_projection_edges, minerals_by_id)

    return {
        "nodes": nodes,
        "edges": edges,
        "topology": request.topology,
        "bipartite": request.topology == "bipartite",
        "occurrenceCount": len(occurrences),
        "mineralCount": len(mineral_ids),
        "localityCount": len(locality_ids),
    }
