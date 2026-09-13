document.addEventListener("DOMContentLoaded", () => {
  // 1. Initialize Map centered on Dadar
  const map = L.map('map', { zoomControl: false }).setView([19.0185, 72.8385], 15);

  // FIXED: maxNativeZoom prevents the "Map data not yet available" gray tiles when zooming deeply
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri',
    maxNativeZoom: 16,
    maxZoom: 20 
  }).addTo(map);

  // 2. LARGE-SCALE DADAR NETWORK (High-Fidelity Curved Coordinates)
  const graphData = {
    nodes: [
      {id: "n_dadar_tt", name: "Dadar TT Circle", lat: 19.0223, lng: 72.8431},
      {id: "n_hindamata", name: "Hindamata Junction", lat: 19.0145, lng: 72.8400},
      {id: "n_parel", name: "Parel TT", lat: 19.0093, lng: 72.8385},
      {id: "n_prabhadevi", name: "Prabhadevi Station", lat: 19.0160, lng: 72.8315},
      {id: "n_shivaji", name: "Shivaji Park", lat: 19.0260, lng: 72.8375},
      {id: "n_sena", name: "Sena Bhavan", lat: 19.0228, lng: 72.8383},
      {id: "n_cafe_ciya", name: "Cafe Ciya", lat: 19.0250, lng: 72.8350},
      {id: "n_mokal", name: "Mokal Chinese Corner", lat: 19.0163, lng: 72.8475},
      {id: "n_wadala", name: "Wadala Bridge", lat: 19.0215, lng: 72.8520},
      {id: "n_elphinstone", name: "Elphinstone Bridge", lat: 19.0115, lng: 72.8390}
    ],
    edges: [
      // Major Arteries (North-South)
      {id: "e_ambedkar_north", name: "Dr. Ambedkar Rd (North)", coordinates: [[19.0260, 72.8445], [19.0223, 72.8431], [19.0200, 72.8420], [19.0175, 72.8410], [19.0145, 72.8400]]},
      {id: "e_ambedkar_south", name: "Dr. Ambedkar Rd (South)", coordinates: [[19.0145, 72.8400], [19.0115, 72.8390], [19.0093, 72.8385], [19.0060, 72.8375]]},
      {id: "e_senapati", name: "Senapati Bapat Marg", coordinates: [[19.0250, 72.8360], [19.0220, 72.8340], [19.0190, 72.8320], [19.0160, 72.8315], [19.0130, 72.8305], [19.0090, 72.8290]]},
      {id: "e_gokhale", name: "Gokhale Road", coordinates: [[19.0260, 72.8375], [19.0228, 72.8383], [19.0195, 72.8345], [19.0160, 72.8315]]},
      
      // East-West Connectors & Cross Streets
      {id: "e_tilak", name: "Tilak Bridge", coordinates: [[19.0223, 72.8431], [19.0218, 72.8410], [19.0205, 72.8390], [19.0228, 72.8383]]},
      {id: "e_elphinstone", name: "Elphinstone Bridge", coordinates: [[19.0115, 72.8390], [19.0110, 72.8360], [19.0105, 72.8340], [19.0160, 72.8315]]},
      {id: "e_naigaon", name: "Naigaon Cross Rd", coordinates: [[19.0145, 72.8400], [19.0155, 72.8430], [19.0163, 72.8475], [19.0170, 72.8500]]},
      {id: "e_bhavani", name: "Bhavani Shankar Rd", coordinates: [[19.0228, 72.8383], [19.0240, 72.8365], [19.0250, 72.8350], [19.0260, 72.8340]]},
      {id: "e_kelkar", name: "NC Kelkar Rd", coordinates: [[19.0260, 72.8375], [19.0240, 72.8360], [19.0220, 72.8340]]},
      {id: "e_wadia", name: "Jerbai Wadia Rd", coordinates: [[19.0093, 72.8385], [19.0110, 72.8430], [19.0125, 72.8480]]},
      
      // Additional Capillaries for Network Density
      {id: "e_sayani", name: "Sayani Rd", coordinates: [[19.0160, 72.8315], [19.0175, 72.8280], [19.0190, 72.8260]]},
      {id: "e_nm_joshi", name: "NM Joshi Marg", coordinates: [[19.0090, 72.8290], [19.0110, 72.8310], [19.0140, 72.8330]]},
      {id: "e_appasaheb", name: "Appasaheb Marathe Marg", coordinates: [[19.0160, 72.8315], [19.0140, 72.8280], [19.0120, 72.8250]]},
      {id: "e_ranade", name: "Ranade Rd", coordinates: [[19.0220, 72.8340], [19.0210, 72.8310], [19.0200, 72.8280]]}
    ]
  };

  let networkLayers = { edges: [] };
  let currentScenario = 'severe';

  // 3. Draw the Map Instantly
  graphData.edges.forEach(edge => {
    let polyline = L.polyline(edge.coordinates, { 
      color: '#34c759', weight: 6, opacity: 0.85, lineCap: 'round', lineJoin: 'round' 
    }).bindTooltip(edge.name).addTo(map);
    networkLayers.edges.push({ id: edge.id, layer: polyline });
  });

  graphData.nodes.forEach(node => {
    L.circleMarker([node.lat, node.lng], { 
      radius: 5.5, fillColor: '#34c759', color: '#ffffff', weight: 2, fillOpacity: 1 
    }).bindTooltip(node.name).addTo(map);
  });

  // 4. Built-in Simulation Logic
  const getStatus = (edgeId, minute) => {
    if (currentScenario === 'normal') return 'normal';
    
    // Core water-logging zones (Hindamata & Parel)
    if (["e_ambedkar_north", "e_ambedkar_south", "e_naigaon"].includes(edgeId)) {
      return minute > 75 ? 'flooded' : minute > 35 ? 'surcharge' : 'normal';
    }
    // Secondary arterial strain (Senapati Bapat & Elphinstone)
    if (["e_senapati", "e_elphinstone", "e_wadia"].includes(edgeId)) {
      return minute > 120 ? 'flooded' : minute > 65 ? 'surcharge' : 'normal';
    }
    // High-ground/minor roads (Shivaji Park area)
    if (["e_gokhale", "e_bhavani", "e_tilak", "e_sayani"].includes(edgeId)) {
      return minute > 140 ? 'surcharge' : 'normal';
    }
    
    return 'normal';
  };

  const timeLabel = document.getElementById('timeCurrent');
  const scoreNumber = document.getElementById('riskScore');
  const scoreLabel = document.getElementById('riskLabel');
  const alertsText = document.getElementById('liveAlerts');

  function updateUI(minute) {
    let hours = Math.floor(minute / 60);
    let mins = minute % 60;
    timeLabel.innerText = `T+${hours}:${mins.toString().padStart(2, '0')}`;

    // Update line colors based on flood progression
    networkLayers.edges.forEach(edgeObj => {
      let status = getStatus(edgeObj.id, minute);
      let color = '#34c759'; 
      if (status === 'surcharge') color = '#ff9500'; 
      if (status === 'flooded') color = '#5ac8fa'; 
      edgeObj.layer.setStyle({ color: color });
    });

    // Dashboard Risk Panel Logic
    let currentScore = 10;
    if (currentScenario === 'severe') {
      if (minute > 75) currentScore = 92;
      else if (minute > 35) currentScore = 48;
    }

    scoreNumber.innerText = currentScore;
    if (currentScore > 75) {
      scoreNumber.className = "score-number red";
      scoreLabel.className = "score-label red";
      scoreLabel.innerText = "CRITICAL";
      alertsText.innerText = "SEVERE: Impassable flooding at Hindamata Junction and Parel TT. Reroute all traffic.";
      alertsText.className = "subtitle alert";
    } else if (currentScore > 40) {
      scoreNumber.className = "score-number orange";
      scoreLabel.className = "score-label orange";
      scoreLabel.innerText = "SURCHARGE";
      alertsText.innerText = "Warning: Dr. Ambedkar Rd storm drains exceeding capacity.";
      alertsText.className = "subtitle alert";
    } else {
      scoreNumber.className = "score-number green";
      scoreLabel.className = "score-label green";
      scoreLabel.innerText = "NORMAL";
      alertsText.innerText = "No active alerts. Network flowing optimally.";
      alertsText.className = "subtitle";
    }
  }

  // 5. Connect UI Listeners
  document.getElementById('scenarioSelect').addEventListener('change', (e) => {
    currentScenario = e.target.value;
    document.getElementById('timeSlider').value = 0;
    updateUI(0);
  });

  const slider = document.getElementById('timeSlider');
  slider.addEventListener('input', (e) => updateUI(parseInt(e.target.value)));

  // Playback Control Configuration
  let isPlaying = false;
  let timerInterval;
  const playBtn = document.getElementById('playBtn');
  const iconPlay = document.querySelector('.icon-play');
  const iconPause = document.querySelector('.icon-pause');
  
  playBtn.addEventListener('click', () => {
    isPlaying = !isPlaying;
    if (isPlaying) {
      iconPlay.style.display = 'none';
      iconPause.style.display = 'block';
      timerInterval = setInterval(() => {
        let currentVal = parseInt(slider.value);
        if (currentVal >= 180) {
          playBtn.click();
          return;
        }
        slider.value = currentVal + 1;
        updateUI(currentVal + 1);
      }, 80); // Adjusted playback speed
    } else {
      iconPlay.style.display = 'block';
      iconPause.style.display = 'none';
      clearInterval(timerInterval);
    }
  });

  // Start the UI at minute 0
  updateUI(0);
});
