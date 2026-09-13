document.addEventListener("DOMContentLoaded", () => {
  // 1. Initialize Map
  const map = L.map('map', { zoomControl: false }).setView([19.1155, 72.8710], 15);

  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri',
    maxZoom: 18
  }).addTo(map);

  let networkLayers = { nodes: [], edges: [] };
  let simulationData = {};

  // 2. Fetch the base graph (Network Layout)
  // Ensure this URL matches how your backend/main.py serves the graph
  fetch('/data/graph.json')
    .then(response => response.json())
    .then(graphData => {
      drawNetwork(graphData);
    })
    .catch(err => console.error("Error loading real graph data:", err));

  // 3. Draw the actual network from your JSON
  function drawNetwork(graph) {
    // Clear old layers if reloading
    networkLayers.nodes.forEach(n => map.removeLayer(n));
    networkLayers.edges.forEach(e => map.removeLayer(e));
    networkLayers = { nodes: [], edges: [] };

    // Draw Edges (Pipes/Streets)
    // NOTE: If your edges only have [startLat, startLng] and [endLat, endLng], they will draw straight.
    // To curve with roads, your backend graph.json needs full GeoJSON LineString coordinates.
    graph.edges.forEach(edge => {
      let polyline = L.polyline(edge.coordinates, {
        color: '#34c759', // Default normal green
        weight: 5,
        opacity: 0.9,
        lineCap: 'round'
      }).addTo(map);
      
      networkLayers.edges.push({ id: edge.id, layer: polyline });
    });

    // Draw Nodes (Manholes)
    graph.nodes.forEach(node => {
      let marker = L.circleMarker([node.lat, node.lng], {
        radius: 5, fillColor: '#34c759', color: '#ffffff', weight: 1.5, fillOpacity: 1
      }).bindTooltip(node.name || node.id).addTo(map);
      
      networkLayers.nodes.push({ id: node.id, layer: marker });
    });
  }

  // 4. Fetch Timeline Simulation Data based on user selection
  function loadScenario(scenarioName) {
    const fileName = scenarioName === 'severe' ? '/data/severe_storm.json' : '/data/normal.json';
    
    fetch(fileName)
      .then(response => response.json())
      .then(data => {
        simulationData = data;
        // Reset timeline slider to 0
        document.getElementById('timeSlider').value = 0;
        updateUI(0);
      })
      .catch(err => console.error("Error loading scenario:", err));
  }

  // 5. Update Map Colors & UI based on specific minute in simulation
  const timeLabel = document.getElementById('timeCurrent');
  const scoreNumber = document.getElementById('riskScore');
  const scoreLabel = document.getElementById('riskLabel');
  
  function updateUI(minute) {
    let hours = Math.floor(minute / 60);
    let mins = minute % 60;
    timeLabel.innerText = `T+${hours}:${mins.toString().padStart(2, '0')}`;

    // Protect against empty data while fetching
    if (!simulationData || !simulationData.timeline) return;

    // Find the closest state in your JSON for this minute
    // Assumes your backend data has an array like: timeline: [{ minute: 0, states: [...] }, ...]
    const currentState = simulationData.timeline.find(t => t.minute >= minute) || simulationData.timeline[0];

    // Apply colors to edges from your backend real data
    currentState.edges.forEach(edgeState => {
      let edgeObj = networkLayers.edges.find(e => e.id === edgeState.id);
      if (edgeObj) {
        let color = '#34c759'; // normal
        if (edgeState.status === 'surcharge') color = '#ff9500'; // orange
        if (edgeState.status === 'flooded') color = '#5ac8fa'; // teal
        
        edgeObj.layer.setStyle({ color: color });
      }
    });

    // Update Sidebar Stats from your JSON
    scoreNumber.innerText = currentState.cityScore || "10";
    if (currentState.cityScore > 75) {
      scoreNumber.className = "score-number red";
      scoreLabel.className = "score-label red";
      scoreLabel.innerText = "CRITICAL";
    } else if (currentState.cityScore > 40) {
      scoreNumber.className = "score-number orange";
      scoreLabel.className = "score-label orange";
      scoreLabel.innerText = "SURCHARGE";
    } else {
      scoreNumber.className = "score-number green";
      scoreLabel.className = "score-label green";
      scoreLabel.innerText = "NORMAL";
    }
  }

  // 6. Hook up the UI Elements
  document.getElementById('scenarioSelect').addEventListener('change', (e) => {
    loadScenario(e.target.value);
  });

  const slider = document.getElementById('timeSlider');
  slider.addEventListener('input', (e) => {
    updateUI(parseInt(e.target.value));
  });

  // Play Button Logic
  let isPlaying = false;
  let timerInterval;
  const playBtn = document.getElementById('playBtn');
  
  playBtn.addEventListener('click', () => {
    isPlaying = !isPlaying;
    const playIcon = document.querySelector('.icon-play');
    const pauseIcon = document.querySelector('.icon-pause');

    if (isPlaying) {
      playIcon.style.display = 'none';
      pauseIcon.style.display = 'block';
      timerInterval = setInterval(() => {
        let currentVal = parseInt(slider.value);
        if (currentVal >= 180) {
          playBtn.click(); // Pause at end
          return;
        }
        slider.value = currentVal + 1;
        updateUI(currentVal + 1);
      }, 200); // Speed of playback
    } else {
      playIcon.style.display = 'block';
      pauseIcon.style.display = 'none';
      clearInterval(timerInterval);
    }
  });

  // Load initial standard scenario on boot
  loadScenario('normal');
});
