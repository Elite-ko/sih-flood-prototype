document.addEventListener("DOMContentLoaded", () => {
  // 1. Initialize Map centered on Dadar/Hindamata
  const map = L.map('map', { zoomControl: false }).setView([19.0175, 72.8400], 15);

  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri',
    maxZoom: 18
  }).addTo(map);

  let currentScenario = 'severe';
  let networkLayers = { nodes: [], edges: [] };

  // 2. Hardcoded Network Data (Bypasses the need for fetch/JSON)
  const graphData = {
    nodes: [
      { id: "n_dadar_tt", name: "Dadar TT Circle", lat: 19.0215, lng: 72.8430 },
      { id: "n_hindamata", name: "Hindamata Junction", lat: 19.0145, lng: 72.8410 },
      { id: "n_parel", name: "Parel TT", lat: 19.0090, lng: 72.8395 },
      { id: "n_prabhadevi", name: "Prabhadevi Station", lat: 19.0160, lng: 72.8300 },
      { id: "n_shivaji", name: "Shivaji Park", lat: 19.0260, lng: 72.8380 },
      { id: "n_wadala", name: "Wadala Bridge", lat: 19.0215, lng: 72.8520 },
      { id: "n_elphinstone", name: "Elphinstone Road", lat: 19.0080, lng: 72.8330 }
    ],
    edges: [
      { id: "e_ambedkar_north", name: "Dr. Ambedkar Rd (North)", coordinates: [[19.0215, 72.8430], [19.0190, 72.8422], [19.0170, 72.8416], [19.0145, 72.8410]] },
      { id: "e_ambedkar_south", name: "Dr. Ambedkar Rd (South)", coordinates: [[19.0145, 72.8410], [19.0120, 72.8402], [19.0090, 72.8395]] },
      { id: "e_tilak_bridge", name: "Tilak Bridge", coordinates: [[19.0215, 72.8430], [19.0210, 72.8400], [19.0195, 72.8370], [19.0160, 72.8300]] },
      { id: "e_senapati_bapat", name: "Senapati Bapat Marg", coordinates: [[19.0160, 72.8300], [19.0120, 72.8315], [19.0080, 72.8330]] },
      { id: "e_gokhale_rd", name: "Gokhale Road", coordinates: [[19.0260, 72.8380], [19.0230, 72.8350], [19.0190, 72.8320], [19.0160, 72.8300]] },
      { id: "e_bhavani_shankar", name: "Bhavani Shankar Rd", coordinates: [[19.0215, 72.8430], [19.0220, 72.8400], [19.0240, 72.8385], [19.0260, 72.8380]] },
      { id: "e_naigaon_cross", name: "Naigaon Cross Rd", coordinates: [[19.0145, 72.8410], [19.0155, 72.8450], [19.0180, 72.8480], [19.0215, 72.8520]] },
      { id: "e_elphinstone_bridge", name: "Elphinstone Bridge", coordinates: [[19.0090, 72.8395], [19.0085, 72.8360], [19.0080, 72.8330]] }
    ]
  };

  // 3. Draw the network
  graphData.edges.forEach(edge => {
    let polyline = L.polyline(edge.coordinates, {
      color: '#34c759', weight: 6, opacity: 0.9, lineCap: 'round'
    }).bindTooltip(edge.name).addTo(map);
    networkLayers.edges.push({ id: edge.id, layer: polyline });
  });

  graphData.nodes.forEach(node => {
    let marker = L.circleMarker([node.lat, node.lng], {
      radius: 5, fillColor: '#34c759', color: '#ffffff', weight: 1.5, fillOpacity: 1
    }).bindTooltip(node.name).addTo(map);
    networkLayers.nodes.push({ id: node.id, layer: marker });
  });

  // 4. Dynamic Simulation Logic
  const getEdgeStatus = (edgeId, minute) => {
    if (currentScenario === 'normal') return 'normal';
    
    if (edgeId === "e_ambedkar_north" || edgeId === "e_ambedkar_south") {
      if (minute > 85) return 'flooded';
      if (minute > 40) return 'surcharge';
    } else if (edgeId === "e_naigaon_cross" || edgeId === "e_elphinstone_bridge") {
      if (minute > 110) return 'flooded';
      if (minute > 60) return 'surcharge';
    } else if (edgeId === "e_senapati_bapat") {
      if (minute > 90) return 'surcharge';
    }
    return 'normal';
  };

  const getCityScore = (minute) => {
    if (currentScenario === 'normal') return 10;
    if (minute > 85) return 88;
    if (minute > 40) return 45;
    return 10;
  };

  // 5. Update UI dynamically based on the current minute
  const timeLabel = document.getElementById('timeCurrent');
  const scoreNumber = document.getElementById('riskScore');
  const scoreLabel = document.getElementById('riskLabel');
  const alertsText = document.getElementById('liveAlerts');
  
  function updateUI(minute) {
    let hours = Math.floor(minute / 60);
    let mins = minute % 60;
    timeLabel.innerText = `T+${hours}:${mins.toString().padStart(2, '0')}`;

    // Apply colors to edges based on logic
    networkLayers.edges.forEach(edgeObj => {
      let status = getEdgeStatus(edgeObj.id, minute);
      let color = '#34c759'; // green
      if (status === 'surcharge') color = '#ff9500'; // orange
      if (status === 'flooded') color = '#5ac8fa'; // teal
      edgeObj.layer.setStyle({ color: color });
    });

    // Update risk UI
    let currentScore = getCityScore(minute);
    scoreNumber.innerText = currentScore;
    
    if (currentScore > 75) {
      scoreNumber.className = "score-number red";
      scoreLabel.className = "score-label red";
      scoreLabel.innerText = "CRITICAL";
      alertsText.innerText = "SEVERE: Widespread flooding at Hindamata Junction.";
      alertsText.className = "subtitle alert";
    } else if (currentScore > 40) {
      scoreNumber.className = "score-number orange";
      scoreLabel.className = "score-label orange";
      scoreLabel.innerText = "SURCHARGE";
      alertsText.innerText = "Warning: Dr. Ambedkar Rd surcharging.";
      alertsText.className = "subtitle alert";
    } else {
      scoreNumber.className = "score-number green";
      scoreLabel.className = "score-label green";
      scoreLabel.innerText = "NORMAL";
      alertsText.innerText = "No active alerts.";
      alertsText.className = "subtitle";
    }
  }

  // 6. Hook up controls
  document.getElementById('scenarioSelect').addEventListener('change', (e) => {
    currentScenario = e.target.value;
    document.getElementById('timeSlider').value = 0;
    updateUI(0);
  });

  const slider = document.getElementById('timeSlider');
  slider.addEventListener('input', (e) => updateUI(parseInt(e.target.value)));

  // Play Button
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
      }, 100); 
    } else {
      iconPlay.style.display = 'block';
      iconPause.style.display = 'none';
      clearInterval(timerInterval);
    }
  });

  // Initialize
  updateUI(0);
});
