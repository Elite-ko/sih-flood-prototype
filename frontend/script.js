document.addEventListener("DOMContentLoaded", () => {
  const map = L.map('map', { zoomControl: false }).setView([19.0175, 72.8400], 15);
  
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri',
    maxZoom: 18
  }).addTo(map);

  let networkLayers = { nodes: [], edges: [] };
  let simulationData = {};
  let currentScenario = 'severe';

  // Fallback Data: Guarantees rendering even if GitHub is missing the JSON files
  const fallbackGraph = {
    nodes: [
      {id: "n_dadar_tt", name: "Dadar TT Circle", lat: 19.0215, lng: 72.8430},
      {id: "n_hindamata", name: "Hindamata Junction", lat: 19.0145, lng: 72.8410},
      {id: "n_parel", name: "Parel TT", lat: 19.0090, lng: 72.8395},
      {id: "n_prabhadevi", name: "Prabhadevi Station", lat: 19.0160, lng: 72.8300},
      {id: "n_shivaji", name: "Shivaji Park", lat: 19.0260, lng: 72.8380},
      {id: "n_wadala", name: "Wadala Bridge", lat: 19.0215, lng: 72.8520},
      {id: "n_elphinstone", name: "Elphinstone Road", lat: 19.0080, lng: 72.8330}
    ],
    edges: [
      {id: "e_ambedkar_north", name: "Dr. Ambedkar Rd (North)", coordinates: [[19.0215, 72.8430], [19.0190, 72.8422], [19.0170, 72.8416], [19.0145, 72.8410]]},
      {id: "e_ambedkar_south", name: "Dr. Ambedkar Rd (South)", coordinates: [[19.0145, 72.8410], [19.0120, 72.8402], [19.0090, 72.8395]]},
      {id: "e_tilak_bridge", name: "Tilak Bridge", coordinates: [[19.0215, 72.8430], [19.0210, 72.8400], [19.0195, 72.8370], [19.0160, 72.8300]]},
      {id: "e_senapati_bapat", name: "Senapati Bapat Marg", coordinates: [[19.0160, 72.8300], [19.0120, 72.8315], [19.0080, 72.8330]]},
      {id: "e_gokhale_rd", name: "Gokhale Road", coordinates: [[19.0260, 72.8380], [19.0230, 72.8350], [19.0190, 72.8320], [19.0160, 72.8300]]},
      {id: "e_bhavani_shankar", name: "Bhavani Shankar Rd", coordinates: [[19.0215, 72.8430], [19.0220, 72.8400], [19.0240, 72.8385], [19.0260, 72.8380]]},
      {id: "e_naigaon_cross", name: "Naigaon Cross Rd", coordinates: [[19.0145, 72.8410], [19.0155, 72.8450], [19.0180, 72.8480], [19.0215, 72.8520]]},
      {id: "e_elphinstone_bridge", name: "Elphinstone Bridge", coordinates: [[19.0090, 72.8395], [19.0085, 72.8360], [19.0080, 72.8330]]}
    ]
  };

  function drawNetwork(graph) {
    graph.edges.forEach(edge => {
      let polyline = L.polyline(edge.coordinates, { color: '#34c759', weight: 6, opacity: 0.9, lineCap: 'round' }).bindTooltip(edge.name).addTo(map);
      networkLayers.edges.push({ id: edge.id, layer: polyline });
    });
    graph.nodes.forEach(node => {
      let marker = L.circleMarker([node.lat, node.lng], { radius: 5, fillColor: '#34c759', color: '#ffffff', weight: 1.5, fillOpacity: 1 }).bindTooltip(node.name).addTo(map);
      networkLayers.nodes.push({ id: node.id, layer: marker });
    });
  }

  // 1. Fetch Backend Data (With Fallback)
  fetch('./data/graph.json')
    .then(res => {
      if (!res.ok) throw new Error("File not found");
      return res.json();
    })
    .then(data => drawNetwork(data))
    .catch(err => {
      console.warn("Backend JSON not found. Rendering fallback graph.");
      drawNetwork(fallbackGraph);
    });

  // Fallback Simulation Engine
  const getFallbackStatus = (edgeId, minute) => {
    if (currentScenario === 'normal') return 'normal';
    if (["e_ambedkar_north", "e_ambedkar_south"].includes(edgeId)) return minute > 85 ? 'flooded' : minute > 40 ? 'surcharge' : 'normal';
    if (["e_naigaon_cross", "e_elphinstone_bridge"].includes(edgeId)) return minute > 110 ? 'flooded' : minute > 60 ? 'surcharge' : 'normal';
    if (edgeId === "e_senapati_bapat") return minute > 90 ? 'surcharge' : 'normal';
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

    let currentScore = 10;
    if (currentScenario === 'severe') {
      if (minute > 85) currentScore = 88;
      else if (minute > 40) currentScore = 45;
    }

    networkLayers.edges.forEach(edgeObj => {
      let status = 'normal';
      
      // Use fetched simulation data if available, otherwise calculate locally
      if (simulationData && simulationData.timeline) {
         const state = simulationData.timeline.find(t => t.minute >= minute) || simulationData.timeline[0];
         const edgeState = state.edges.find(e => e.id === edgeObj.id);
         if (edgeState) status = edgeState.status;
      } else {
         status = getFallbackStatus(edgeObj.id, minute);
      }

      let color = '#34c759'; 
      if (status === 'surcharge') color = '#ff9500'; 
      if (status === 'flooded') color = '#5ac8fa'; 
      edgeObj.layer.setStyle({ color: color });
    });

    // Update Sidebar
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

  // 2. Fetch Timeline Data (With Fallback)
  function loadScenario(scenarioName) {
    currentScenario = scenarioName;
    const fileName = scenarioName === 'severe' ? './data/severe_storm.json' : './data/normal.json';
    
    fetch(fileName)
      .then(res => {
        if (!res.ok) throw new Error("File not found");
        return res.json();
      })
      .then(data => {
        simulationData = data;
        document.getElementById('timeSlider').value = 0;
        updateUI(0);
      })
      .catch(err => {
        console.warn("Backend timeline JSON not found. Running local simulation engine.");
        simulationData = null; // Forces the fallback engine to run
        document.getElementById('timeSlider').value = 0;
        updateUI(0);
      });
  }

  // 3. UI Controls
  document.getElementById('scenarioSelect').addEventListener('change', (e) => loadScenario(e.target.value));
  document.getElementById('timeSlider').addEventListener('input', (e) => updateUI(parseInt(e.target.value)));

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
        let slider = document.getElementById('timeSlider');
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

  loadScenario('severe');
});
