# Urban Flood Nowcasting — Working Prototype
SIH 2026 · PS 26085 · Team NeuralNexus_45

A runnable demo of the drainage-and-rainfall-coupling pipeline described in the
idea submission, scoped to a real ~1km × 1km zone in Andheri East, Mumbai.

## What's real vs. simulated (be upfront about this to judges)

| Piece | Status |
|---|---|
| Drainage graph (nodes = manholes, edges = pipes) | **Synthetic** grid over real coordinates — BMC does not publish real network data |
| Rainfall → runoff → routing model | **Simplified physics** (topological downhill routing + capacity checks), not a full EPA-SWMM run |
| Flood-safe routing (Dijkstra, live re-weighting by flood depth) | **Real, working** — this is the actual algorithm, not mocked |
| Time-slider, risk score, alerts, dashboard | **Real, working** end-to-end against the API |
| Map / basemap | **Real** — MapLibre GL + CARTO dark basemap, no API key needed |

This framing matters for judging: don't claim SWMM accuracy you don't have.
Pitch it as "the pipeline and UX are real and working; swap in a calibrated
SWMM model and real BMC drainage data and the same architecture scales to a
full ward" — that's a credible, fundable story for a 36-hour build.

## Run it

```bash
cd backend
pip install -r requirements.txt --break-system-packages
python generate_mock_data.py      # writes backend/data/*.json
uvicorn main:app --reload --port 8000
```

Then open `frontend/index.html` directly in a browser (double-click it, or
`python3 -m http.server` from the `frontend/` folder and visit
`http://localhost:8000`... use a different port than the API, e.g. 5500).

The frontend expects the API at `http://127.0.0.1:8000` — change `API_BASE`
at the top of `frontend/index.html`'s `<script>` if you run it elsewhere.

## What to click during the demo

1. Start on **Severe storm + blockage on**, press ▶ on the time slider.
   Watch pipes turn yellow → red and the risk score climb as rainfall peaks
   around T+1:15.
2. Toggle **blockage off** mid-storm — point out the nodes right next to the
   two choked pipes (`N0_6`, `N2_0` area) drop back to lower risk instantly.
3. Open **Flood-safe routing**, pick two distant nodes, hit "Find route" at
   T+0:00 (safe route avoids flooding entirely) and again at T+1:00 (both
   routes may have to cross some flooding — say out loud that this is
   realistic: at the worst of a severe storm, avoidance isn't always
   possible, only minimization is).

## Why these architecture choices (vs. the original plan)

- **MapLibre GL, not Mapbox GL** — identical API, no token/billing risk during
  judging, free CARTO dark basemap instead of a paid style.
- **No EPA SWMM at judging time** — a real calibrated model needs weeks and
  real drainage shapefiles neither of which exist for this timeline; the
  synthetic hydrology model in `generate_mock_data.py` is swap-compatible
  with a real `pyswmm`-driven pipeline later (same JSON output shape).
- **No OSRM server** — OSRM's routing graph is baked at build time and isn't
  meant to be re-weighted per-request live; Dijkstra directly on the same
  street graph used for the flood layer gives instant, genuinely dynamic
  re-routing with ~40 lines of code and no extra infrastructure to deploy or
  demo over conference wifi.

## Team execution plan (if you want to parallelize before the demo)

- **Data/modeling**: tune `generate_mock_data.py` — swap in a real small
  `.inp` file via `pyswmm` if time allows, or just tune rainfall curves /
  grid size for a better story.
- **Backend**: extend `main.py` — e.g. a `/api/what-if` endpoint that lets
  the frontend toggle an arbitrary edge's capacity live, generalizing the
  blockage toggle beyond the two hardcoded pipes.
- **Frontend**: polish `frontend/index.html` — add a legend for the
  dashed/solid route lines directly on the map, or wire the play button to
  auto-stop at the storm peak for a cleaner demo beat.
- **Demo owner**: rehearse the exact click sequence above so judges see a
  story, not you clicking around live.
