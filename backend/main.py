"""
main.py — FastAPI backend for the Urban Flood Nowcasting prototype.

Endpoints:
  GET  /api/scenarios                        list available scenarios
  GET  /api/scenario/{name}                  full time-series payload
  GET  /api/scenario/{name}/timestep/{t}     single timestep (t in minutes, 0..180 step 15)
  GET  /api/graph                            static node/edge metadata (for reference)
  GET  /api/route?scenario=&t=&from_id=&to_id=&avoid_flood=true

Routing: rather than standing up a full OSRM server (whose graph is baked at
build time and awkward to re-weight live), we run Dijkstra directly on the
same street graph used for the flood layer. This makes "avoid flooded
streets" a live, per-request recompute — exactly what the demo needs.

Run:
    pip install -r requirements.txt --break-system-packages
    python generate_mock_data.py
    uvicorn main:app --reload --port 8000
"""

import heapq
import json
import math
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

DATA_DIR = Path(__file__).parent / "data"
SCENARIOS = ["normal", "severe_storm", "severe_blockage"]

app = FastAPI(title="Urban Flood Nowcasting API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # hackathon prototype only — tighten before any real deployment
    allow_methods=["*"],
    allow_headers=["*"],
)

_cache = {}

def load_scenario(name: str):
    if name not in SCENARIOS:
        raise HTTPException(404, f"Unknown scenario '{name}'. Options: {SCENARIOS}")
    if name not in _cache:
        path = DATA_DIR / f"{name}.json"
        if not path.exists():
            raise HTTPException(
                500,
                f"Data file {path.name} not found — run generate_mock_data.py first.",
            )
        _cache[name] = json.loads(path.read_text())
    return _cache[name]

def load_graph():
    if "_graph" not in _cache:
        _cache["_graph"] = json.loads((DATA_DIR / "graph.json").read_text())
    return _cache["_graph"]


@app.get("/api/scenarios")
def list_scenarios():
    return {"scenarios": SCENARIOS, "timesteps_min": list(range(0, 181, 15))}


@app.get("/api/scenario/{name}")
def get_scenario(name: str):
    return load_scenario(name)


@app.get("/api/scenario/{name}/timestep/{t}")
def get_timestep(name: str, t: int):
    data = load_scenario(name)
    key = f"t{t}"
    if key not in data:
        raise HTTPException(404, f"No timestep t={t}. Valid: 0..180 step 15.")
    return data[key]


@app.get("/api/graph")
def get_graph():
    return load_graph()


def haversine_m(lat1, lon1, lat2, lon2):
    R = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def dijkstra(nodes: dict, adj: dict, start: str, end: str):
    dist = {n: math.inf for n in nodes}
    prev = {}
    dist[start] = 0
    pq = [(0, start)]
    visited = set()
    while pq:
        d, u = heapq.heappop(pq)
        if u in visited:
            continue
        visited.add(u)
        if u == end:
            break
        for v, w in adj.get(u, []):
            nd = d + w
            if nd < dist[v]:
                dist[v] = nd
                prev[v] = u
                heapq.heappush(pq, (nd, v))
    if dist[end] == math.inf:
        return None, math.inf
    path = [end]
    while path[-1] != start:
        path.append(prev[path[-1]])
    path.reverse()
    return path, dist[end]


@app.get("/api/route")
def get_route(
    scenario: str = Query(...),
    t: int = Query(...),
    from_id: str = Query(..., alias="from"),
    to_id: str = Query(..., alias="to"),
):
    """
    Returns two routes over the SAME street graph at the requested timestep:
      - "standard": shortest path by distance only, ignoring flooding
      - "safe":     shortest path where flooded segments are heavily penalised
    so the frontend can draw both and show where they diverge.
    """
    graph = load_graph()
    nodes = graph["nodes"]
    if from_id not in nodes or to_id not in nodes:
        raise HTTPException(400, "from/to must be valid node ids, e.g. N0_0")

    timestep = get_timestep(scenario, t)
    flooded_edges = {
        f["properties"]["id"]
        for f in timestep["streets"]["features"]
        if f["properties"]["flooded"]
    }

    adj_standard = {}
    adj_safe = {}
    for e in graph["edges"]:
        a, b = nodes[e["from"]], nodes[e["to"]]
        dist_m = haversine_m(a["lat"], a["lon"], b["lat"], b["lon"])
        penalty = 5000 if e["id"] in flooded_edges else 0  # heavy but finite penalty
        for u, v in ((e["from"], e["to"]), (e["to"], e["from"])):
            adj_standard.setdefault(u, []).append((v, dist_m))
            adj_safe.setdefault(u, []).append((v, dist_m + penalty))

    std_path, std_dist = dijkstra(nodes, adj_standard, from_id, to_id)
    safe_path, safe_dist = dijkstra(nodes, adj_safe, from_id, to_id)

    def path_to_geojson(path):
        if not path:
            return None
        coords = [[nodes[n]["lon"], nodes[n]["lat"]] for n in path]
        crosses_flood = any(
            f"E_{path[i]}_{path[i+1]}" in flooded_edges or f"E_{path[i+1]}_{path[i]}" in flooded_edges
            for i in range(len(path) - 1)
        )
        return {
            "type": "Feature",
            "geometry": {"type": "LineString", "coordinates": coords},
            "properties": {"node_path": path, "crosses_flooded_segment": crosses_flood},
        }

    return {
        "scenario": scenario,
        "t_min": t,
        "standard_route": path_to_geojson(std_path),
        "safe_route": path_to_geojson(safe_path),
        "standard_distance_m": round(std_dist, 1) if std_path else None,
        "safe_distance_m": round(safe_dist, 1) if safe_path else None,
    }


@app.get("/")
def root():
    return {
        "service": "Urban Flood Nowcasting API",
        "docs": "/docs",
        "scenarios": SCENARIOS,
    }
