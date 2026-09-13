"""
generate_mock_data.py
----------------------
Builds a synthetic drainage graph over a small real-world zone (Andheri East,
Mumbai) and runs a simplified rainfall -> runoff -> pipe-routing model to
produce time-series GeoJSON for three scenarios:

    normal            - light steady rainfall, no issues
    severe_storm      - intense rainfall, drains stressed but working
    severe_blockage   - same storm, but 2 key pipes are 90% blocked

This is a deliberately simplified stand-in for a real EPA-SWMM run: it is
enough to drive a believable, fully-interactive demo without needing real
drainage-network data (which BMC does not publish) or a SWMM installation.
Swap `route_flow()` for a real solver later without touching the API layer.

Output: backend/data/<scenario>.json, each a dict of
    { "t0": {...}, "t15": {...}, ... "t180": {...} }
where each timestep has:
    nodes: GeoJSON FeatureCollection (manholes, with flood_depth_m, risk)
    edges: GeoJSON FeatureCollection (pipes, with load_ratio, status)
    streets: GeoJSON FeatureCollection (routable street graph, flooded flag)
    city_risk_score: 0-100
    alerts: [ {severity, message, node_id, eta_min} ]
"""

import json
import math
import random
from pathlib import Path

random.seed(42)

# ---------------------------------------------------------------------------
# 1. Build a synthetic grid over a small real Mumbai zone (Andheri East)
# ---------------------------------------------------------------------------
LAT0, LON0 = 19.1136, 72.8697   # bottom-left corner of demo zone
GRID_N = 7                       # 7x7 node grid  (~1.1km x 1.1km)
STEP_DEG = 0.0018                # ~200m spacing

NODES = {}          # id -> {lat, lon, elev, name}
for r in range(GRID_N):
    for c in range(GRID_N):
        nid = f"N{r}_{c}"
        elev = 12 - 0.6 * r - 0.3 * c + random.uniform(-0.4, 0.4)  # gentle slope
        NODES[nid] = {
            "id": nid,
            "lat": round(LAT0 + r * STEP_DEG, 6),
            "lon": round(LON0 + c * STEP_DEG, 6),
            "elev": round(elev, 2),
        }

# Edges: each node connects to its right and lower neighbour (grid graph).
# Flow always goes from higher elevation -> lower elevation node.
EDGES = []
for r in range(GRID_N):
    for c in range(GRID_N):
        nid = f"N{r}_{c}"
        for nr, nc in [(r, c + 1), (r + 1, c)]:
            if nr < GRID_N and nc < GRID_N:
                other = f"N{nr}_{nc}"
                a, b = (nid, other) if NODES[nid]["elev"] >= NODES[other]["elev"] else (other, nid)
                capacity = round(random.uniform(0.8, 1.6), 2)  # m^3/s
                EDGES.append({
                    "id": f"E_{a}_{b}",
                    "from": a,
                    "to": b,
                    "capacity_m3s": capacity,
                })

# A couple of "critical" pipes we deliberately choke in the blockage scenario
BLOCKAGE_EDGE_IDS = [EDGES[i]["id"] for i in (12, 27)]

# ---------------------------------------------------------------------------
# 2. Rainfall profiles per scenario (mm/hr), sampled every 15 min for 3 hours
# ---------------------------------------------------------------------------
TIMESTEPS_MIN = list(range(0, 181, 15))  # 0..180

def rainfall_series(kind: str):
    series = []
    for t in TIMESTEPS_MIN:
        if kind == "normal":
            val = 4 + 2 * math.sin(t / 60)
        else:  # severe_storm / severe_blockage share the same storm
            # ramps up, peaks around t=60-90, tapers off
            val = 65 * math.exp(-((t - 75) ** 2) / (2 * 40 ** 2)) + 5
        series.append(max(0, round(val, 1)))
    return series

RAIN = {
    "normal": rainfall_series("normal"),
    "severe_storm": rainfall_series("severe_storm"),
    "severe_blockage": rainfall_series("severe_storm"),
}

CATCHMENT_AREA_M2 = STEP_DEG * 111_000 * STEP_DEG * 111_000  # per grid cell, approx
RUNOFF_COEFF = 0.75  # fraction of rain that becomes surface runoff (urban, paved)

# ---------------------------------------------------------------------------
# 3. Simplified routing: accumulate runoff downhill through the pipe graph
# ---------------------------------------------------------------------------
def topo_order():
    """Order nodes from highest to lowest elevation (flow travels downhill)."""
    return sorted(NODES.keys(), key=lambda n: -NODES[n]["elev"])

def route_flow(rain_mm_hr: float, blocked_edge_ids: set):
    """
    One-timestep hydrology pass:
      - every node gets direct rainfall runoff injected
      - flow accumulates downhill along edges
      - each edge's load vs capacity determines surcharge
      - a node floods if the edges leading INTO it can't carry away the inflow
    Returns (node_results, edge_results)
    """
    inflow = {n: 0.0 for n in NODES}
    runoff_m3s = (rain_mm_hr / 1000 / 3600) * CATCHMENT_AREA_M2 * RUNOFF_COEFF
    for n in NODES:
        inflow[n] += runoff_m3s

    edge_by_from = {}
    for e in EDGES:
        edge_by_from.setdefault(e["from"], []).append(e)

    edge_flow = {e["id"]: 0.0 for e in EDGES}
    node_overflow = {n: 0.0 for n in NODES}

    OUTFALL_CAPACITY_M3S = 6.0  # sink nodes drain to the sea/river up to this rate

    for n in topo_order():
        available = inflow[n]
        outs = edge_by_from.get(n, [])
        if not outs:
            # This is an outfall node (edge of the demo zone) - it drains freely
            # up to OUTFALL_CAPACITY_M3S; only extreme inflow backs up here.
            node_overflow[n] += max(0.0, available - OUTFALL_CAPACITY_M3S)
            continue
        share = available / len(outs)
        for e in outs:
            cap = e["capacity_m3s"] * (0.1 if e["id"] in blocked_edge_ids else 1.0)
            carried = min(share, cap)
            spilled = share - carried
            edge_flow[e["id"]] = carried
            node_overflow[n] += spilled           # water that can't leave this node
            inflow[e["to"]] += carried

    return inflow, edge_flow, node_overflow

def build_timestep(scenario: str, t_idx: int):
    rain = RAIN[scenario][t_idx]
    blocked = set(BLOCKAGE_EDGE_IDS) if scenario == "severe_blockage" else set()
    inflow, edge_flow, overflow = route_flow(rain, blocked)

    node_features = []
    alerts = []
    risk_counts = {"low": 0, "medium": 0, "high": 0}
    for nid, n in NODES.items():
        depth_m = round(min(overflow[nid] * 0.35, 1.2), 3)  # crude overflow -> depth proxy
        if depth_m > 0.5:
            risk = "high"
        elif depth_m > 0.15:
            risk = "medium"
        else:
            risk = "low"
        risk_counts[risk] += 1
        node_features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [n["lon"], n["lat"]]},
            "properties": {
                "id": nid, "flood_depth_m": depth_m, "risk": risk,
                "elev": n["elev"],
            },
        })
        if risk == "high":
            eta = max(5, 45 - t_idx * 3)
            alerts.append({
                "severity": "critical",
                "message": f"Surcharge detected at {nid}. Flood ETA: {eta} min.",
                "node_id": nid, "eta_min": eta,
            })

    edge_features = []
    for e in EDGES:
        cap = e["capacity_m3s"] * (0.1 if e["id"] in blocked else 1.0)
        load_ratio = round(edge_flow[e["id"]] / cap, 2) if cap > 0 else 0
        status = "red" if load_ratio > 1 else ("yellow" if load_ratio > 0.7 else "green")
        a, b = NODES[e["from"]], NODES[e["to"]]
        edge_features.append({
            "type": "Feature",
            "geometry": {"type": "LineString", "coordinates": [[a["lon"], a["lat"]], [b["lon"], b["lat"]]]},
            "properties": {
                "id": e["id"], "load_ratio": load_ratio, "status": status,
                "blocked": e["id"] in blocked,
            },
        })

    # Reuse the same edges as a routable "street" graph, flagging flooded segments
    street_features = []
    for e in EDGES:
        a, b = NODES[e["from"]], NODES[e["to"]]
        flooded = max(
            next(f["properties"]["flood_depth_m"] for f in node_features if f["properties"]["id"] == e["from"]),
            next(f["properties"]["flood_depth_m"] for f in node_features if f["properties"]["id"] == e["to"]),
        ) > 0.15
        street_features.append({
            "type": "Feature",
            "geometry": {"type": "LineString", "coordinates": [[a["lon"], a["lat"]], [b["lon"], b["lat"]]]},
            "properties": {"id": e["id"], "from": e["from"], "to": e["to"], "flooded": flooded},
        })

    # City risk score: base level from the worst single node, plus a bump for
    # how many nodes are stressed, so a scenario toggle (e.g. blockage) that
    # widens the affected area is visible even if it doesn't add a new "worst"
    # node.
    base = {"low": 10, "medium": 45, "high": 85}
    worst = "high" if risk_counts["high"] else ("medium" if risk_counts["medium"] else "low")
    spread_bonus = min(10, risk_counts["medium"] * 1 + risk_counts["high"] * 2)
    city_risk_score = min(100, base[worst] + spread_bonus)

    return {
        "t_min": TIMESTEPS_MIN[t_idx],
        "rain_mm_hr": rain,
        "nodes": {"type": "FeatureCollection", "features": node_features},
        "edges": {"type": "FeatureCollection", "features": edge_features},
        "streets": {"type": "FeatureCollection", "features": street_features},
        "city_risk_score": city_risk_score,
        "risk_counts": risk_counts,
        "alerts": alerts,
    }

def main():
    out_dir = Path(__file__).parent / "data"
    out_dir.mkdir(exist_ok=True)

    graph_meta = {"nodes": NODES, "edges": EDGES}
    (out_dir / "graph.json").write_text(json.dumps(graph_meta, indent=2))

    for scenario in ("normal", "severe_storm", "severe_blockage"):
        payload = {f"t{TIMESTEPS_MIN[i]}": build_timestep(scenario, i) for i in range(len(TIMESTEPS_MIN))}
        (out_dir / f"{scenario}.json").write_text(json.dumps(payload))
        print(f"wrote {scenario}.json ({len(TIMESTEPS_MIN)} timesteps)")

if __name__ == "__main__":
    main()
