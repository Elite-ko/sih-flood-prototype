document.addEventListener("DOMContentLoaded", () => {
  // 1. Initialize Map centered on Dadar/Hindamata
  const map = L.map('map', { zoomControl: false }).setView([19.0175, 72.8400], 15);

  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri',
    maxZoom: 18
  }).addTo(map);

  let networkLayers = { nodes: [], edges: [] };
  let simulationData = {};

  // 2. Fetch the base graph from the Python Backend
fetch('./data/graph.json')
    .then(response => response.json())
    .then(graphData => {
      drawNetwork(graphData);
    })
    .catch(err => console.error("Error loading graph:", err));

  // 3. Draw the network using your Python LineStrings
  function drawNetwork(graph) {
    graph.edges.forEach(edge => {
      // Because Python now generates multiple coordinates, this line will curve beautifully
      let polyline = L.polyline(edge.coordinates, {
        color: '#34c759', 
        weight: 6,
        opacity: 0.9,
        lineCap: 'round'
      }).bindTooltip(edge.name).addTo(map);
      
      networkLayers.edges.push({ id: edge.id, layer: polyline });
    });

    graph.nodes.forEach(node => {
      let marker = L.circleMarker([node.lat, node.lng], {
        radius: 5, fillColor: '#34c759', color: '#ffffff', weight: 1.5, fillOpacity: 1
      }).bindTooltip(node.name).addTo(map);
      
      networkLayers.nodes.push({ id: node.id, layer: marker });
    });
  }

  // 4. Fetch Timeline Data
  function loadScenario(scenarioName) {
    const fileName = scenarioName === 'severe' ? '/data/severe_storm.json' : '/data/normal.json';
    
    fetch(fileName)
      .then(response => response.json())
      .then(data => {
        simulationData = data;
        document.getElementById('timeSlider').value = 0;
        updateUI(0);
      });
  }

  // 5. Update UI & Line Colors dynamically
  const timeLabel = document.getElementById('timeCurrent');
  const scoreNumber = document.getElementById('riskScore');
  const scoreLabel = document.getElementById('riskLabel');
  const alertsText = document.getElementById('liveAlerts');
  
  function updateUI(minute) {
    let hours = Math.floor(minute / 60);
    let mins = minute % 60;
    timeLabel.innerText = `T+${hours}:${mins.toString().padStart(2, '0')}`;

    if (!simulationData || !simulationData.timeline) return;
    const currentState = simulationData.timeline.find(t => t.minute >= minute) || simulationData.timeline[0];

    // Apply colors based on Python backend status
    currentState.edges.forEach(edgeState => {
      let edgeObj = networkLayers.edges.find(e => e.id === edgeState.id);
      if (edgeObj) {
        let color = '#34c759'; // normal
        if (edgeState.status === 'surcharge') color = '#ff9500'; // orange
        if (edgeState.status === 'flooded') color = '#5ac8fa'; // teal
        edgeObj.layer.setStyle({ color: color });
      }
    });

    // Update risk UI elements
    scoreNumber.innerText = currentState.cityScore || "10";
    if (currentState.cityScore > 75) {
      scoreNumber.className = "score-number red";
      scoreLabel.className = "score-label red";
      scoreLabel.innerText = "CRITICAL";
      alertsText.innerText = "SEVERE: Widespread flooding at Hindamata Junction.";
      alertsText.className = "subtitle alert";
    } else if (currentState.cityScore > 40) {
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

  document.getElementById('scenarioSelect').addEventListener('change', (e) => loadScenario(e.target.value));

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
      }, 100); // Speed of playback
    } else {
      iconPlay.style.display = 'block';
      iconPause.style.display = 'none';
      clearInterval(timerInterval);
    }
  });

  loadScenario('severe');
});
