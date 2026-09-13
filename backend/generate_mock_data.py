import json
import os

# Ensure the data directory exists inside the FRONTEND folder
current_dir = os.path.dirname(os.path.abspath(__file__))
frontend_data_dir = os.path.join(current_dir, "..", "frontend", "data")
os.makedirs(frontend_data_dir, exist_ok=True)

# 1. DEFINE THE NODES
nodes = [
    {"id": "n_dadar_tt", "name": "Dadar TT Circle", "lat": 19.0215, "lng": 72.8430},
    {"id": "n_hindamata", "name": "Hindamata Junction", "lat": 19.0145, "lng": 72.8410},
    {"id": "n_parel", "name": "Parel TT", "lat": 19.0090, "lng": 72.8395},
    {"id": "n_prabhadevi", "name": "Prabhadevi Station", "lat": 19.0160, "lng": 72.8300},
    {"id": "n_shivaji", "name": "Shivaji Park", "lat": 19.0260, "lng": 72.8380},
    {"id": "n_wadala", "name": "Wadala Bridge", "lat": 19.0215, "lng": 72.8520},
    {"id": "n_elphinstone", "name": "Elphinstone Road", "lat": 19.0080, "lng": 72.8330},
]

# 2. DEFINE THE EDGES
edges = [
    {"id": "e_ambedkar_north", "name": "Dr. Ambedkar Rd (North)", "coordinates": [[19.0215, 72.8430], [19.0190, 72.8422], [19.0170, 72.8416], [19.0145, 72.8410]]},
    {"id": "e_ambedkar_south", "name": "Dr. Ambedkar Rd (South)", "coordinates": [[19.0145, 72.8410], [19.0120, 72.8402], [19.0090, 72.8395]]},
    {"id": "e_tilak_bridge", "name": "Tilak Bridge", "coordinates": [[19.0215, 72.8430], [19.0210, 72.8400], [19.0195, 72.8370], [19.0160, 72.8300]]},
    {"id": "e_senapati_bapat", "name": "Senapati Bapat Marg", "coordinates": [[19.0160, 72.8300], [19.0120, 72.8315], [19.0080, 72.8330]]},
    {"id": "e_gokhale_rd", "name": "Gokhale Road", "coordinates": [[19.0260, 72.8380], [19.0230, 72.8350], [19.0190, 72.8320], [19.0160, 72.8300]]},
    {"id": "e_bhavani_shankar", "name": "Bhavani Shankar Rd", "coordinates": [[19.0215, 72.8430], [19.0220, 72.8400], [19.0240, 72.8385], [19.0260, 72.8380]]},
    {"id": "e_naigaon_cross", "name": "Naigaon Cross Rd", "coordinates": [[19.0145, 72.8410], [19.0155, 72.8450], [19.0180, 72.8480], [19.0215, 72.8520]]},
    {"id": "e_elphinstone_bridge", "name": "Elphinstone Bridge", "coordinates": [[19.0090, 72.8395], [19.0085, 72.8360], [19.0080, 72.8330]]}
]

# Write the static layout graph
with open(os.path.join(frontend_data_dir, 'graph.json'), 'w') as f:
    json.dump({"nodes": nodes, "edges": edges}, f, indent=2)

# 3. GENERATE SEVERE STORM TIMELINE
severe_timeline = []
for minute in range(181):
    state = {"minute": minute, "cityScore": 10, "edges": []}
    for edge in edges:
        status = "normal"
        if edge["id"] in ["e_ambedkar_north", "e_ambedkar_south"]:
            if minute > 40: status = "surcharge"
            if minute > 85: status = "flooded"
        elif edge["id"] in ["e_naigaon_cross", "e_elphinstone_bridge"]:
            if minute > 60: status = "surcharge"
            if minute > 110: status = "flooded"
        elif edge["id"] == "e_senapati_bapat":
            if minute > 90: status = "surcharge"
        
        state["edges"].append({"id": edge["id"], "status": status})
        
    if minute > 85: state["cityScore"] = 88
    elif minute > 40: state["cityScore"] = 45
        
    severe_timeline.append(state)

with open(os.path.join(frontend_data_dir, 'severe_storm.json'), 'w') as f:
    json.dump({"timeline": severe_timeline}, f, indent=2)

# 4. GENERATE NORMAL TIMELINE
normal_timeline = [{"minute": m, "cityScore": 10, "edges": [{"id": e["id"], "status": "normal"} for e in edges]} for m in range(181)]
with open(os.path.join(frontend_data_dir, 'normal.json'), 'w') as f:
    json.dump({"timeline": normal_timeline}, f, indent=2)

print(f"Data generated successfully in: {frontend_data_dir}")
