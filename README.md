# MiNE — Mineral Network Explorer

MiNE is an interactive network visualization and analysis workspace for scientific data. It imports matrix, list, and graph-exchange formats into one canonical Graphology model, preserves supported metadata, and provides a consistent Browser/Cloud workflow.

## Architecture and behavior

- **Browser computation:** Graphology runs analysis in the client; browser community detection supports Louvain.
- **Cloud computation:** the Python service performs curated igraph community, metric, and static-layout operations.
- **Numeric metric filtering:** Degree, numeric uploaded attributes, calculated node centralities, Louvain node terms, and calculated edge metrics can filter the graph and data tables without invalidating the result used as the filter source.
- **Louvain modularity detail:** Browser and Cloud results include per-node Louvain ΔQ, within-community weight, node/community strength, and an igraph-compatible modularity contribution. The Modularity data view summarizes both communities and nodes, and node contributions sum to the network Q.
- **Independent rendering:** D3 or Sigma can render either computation mode from the same persistent Graphology model. Live Physics uses the shared D3 force simulation with either renderer.
- **Large-graph routing policy:** Cloud is recommended at **7,000 or more raw nodes OR 15,000 or more raw edges**, but Browser remains selectable and is the sequential fallback for supported Cloud calculations. Large-graph classification always uses imported raw counts, so filtering cannot change it.
- Initial Louvain runs automatically only below the large-graph cutoffs. At or above either cutoff, it remains available as an explicit calculation in Cloud or Browser.
- Communities, selected metrics, and layouts run only from their explicit action buttons. Live Update applies visual/filter/physics edits and never starts analysis.
- The Cloud layout panel includes MiNE's local D3 Force option plus Auto, Fruchterman–Reingold, DrL, Kamada–Kawai, Bipartite, Sugiyama, and Circle when compatible.
- Cloud communities include Louvain, Leiden, Infomap, Label Propagation, and Walktrap when reported by the backend capability endpoint. Browser mode retains Louvain only.

## Universal Matrix Parsing

MiNE supports:

- adjacency and weighted adjacency matrices;
- incidence matrices;
- dual-adjacency matrices with genuine Primary and Secondary weight channels;
- adjacency lists and directed/undirected edge lists;
- optional paired node and edge metadata CSV files;
- Graphology JSON and MiNE All-in-One JSON;
- GraphML and GEXF;
- canonical `nodes.csv` + `edges.csv` pairs and CSV ZIP exports.

Secondary Weight remains absent unless it was explicitly supplied by the source. An uploaded field named `abundance` is preserved as ordinary numeric metadata; degree is the built-in topology size field.

## Local development

### Frontend

Node.js 20 or newer is recommended.

```bash
git clone https://github.com/PrabhuLab/MiNE.git
cd MiNE
npm install
cp .env.local.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The frontend can run without the Cloud service at any graph size, although large Browser calculations may be slower.

### Cloud backend

The backend requires Python 3.12.

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -e '.[test]'
pytest
uvicorn app.main:app --host 0.0.0.0 --port 8080 --workers 1
```

Set `NEXT_PUBLIC_MINE_IGRAPH_API_URL=http://127.0.0.1:8080` in `.env.local`, then restart the frontend. Deployment and resource-limit notes are in [backend/README.md](backend/README.md).

## Verification

```bash
npm test
npm run lint
npm run build
backend/.venv/bin/python -m pytest -q
```

## Citation

If you use MiNE, cite:

> Don Ngo and Anirudh Prabhu. *MiNE: Mineral Network Explorer*. Version 1.0.0, 2026. https://github.com/PrabhuLab/MiNE

Machine-readable citation metadata, author ORCIDs, and the release date are available in [CITATION.cff](CITATION.cff).
