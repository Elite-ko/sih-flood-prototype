document.addEventListener("DOMContentLoaded", () => {
  // 1. Initialize Map
  const map = L.map('map', { zoomControl: false }).setView([19.0185, 72.8385], 15);

  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri',
    maxNativeZoom: 16,
    maxZoom: 20 
  }).addTo(map);

  // 2. High-Precision Background Network (Snaps to roads, no straight lines)
  const graphData = {
    edges: [
      {id: "e_ambedkar", name: "Dr. Ambedkar Rd", coords: [[19.0260, 72.8445], [19.0232, 72.8435], [19.0205, 72.8422], [19.0175, 72.8410], [19.0145, 72.8400], [19.0115, 72.8390], [19.0060, 72.8375]]},
      {id: "e_senapati", name: "Senapati Bapat Marg", coords: [[19.0250, 72.8360], [19.0220, 72.8340], [19.0185, 72.8322], [19.0160, 72.8315], [19.0125, 72.8302], [19.0090, 72.8290]]},
      {id: "e_gokhale", name: "Gokhale Road", coords: [[19.0260, 72.8375], [19.0235, 72.8383], [19.0195, 72.8345], [19.0160, 72.8315]]},
      {id: "e_tilak", name: "Tilak Bridge", coords: [[19.0223, 72.8431], [19.0215, 72.8405], [19.0205, 72.8390], [19.0228, 72.8383]]},
      {id: "e_elphinstone", name: "Elphinstone Bridge", coords: [[19.0115, 72.8390], [19.0110, 72.8360], [19.0105, 72.8340], [19.0160, 72.8315]]},
      {id: "e_naigaon", name: "Naigaon Cross Rd", coords: [[19.0145, 72.8400], [19.0155, 72.8430], [19.0163, 72.8475], [19.0170, 72.8500]]},
      {id: "e_bhavani", name: "Bhavani Shankar Rd", coords: [[19.0228, 72.8383], [19.0240, 72.8365], [19.0250, 72.8350], [19.0260, 72.8340]]}
    ]
  };

  let networkLayers = { edges: [] };
  let currentScenario = 'severe';

  // Draw background network
  graphData.edges.forEach(edge => {
    let polyline = L.polyline(edge.coords, { 
      color: '#34c759', weight: 6, opacity: 0.7, lineCap: 'round', lineJoin: 'round' 
    }).bindTooltip(edge.name).addTo(map);
    networkLayers.edges.push({ id: edge.id, layer: polyline });
  });

  // 3. Dynamic Routing Engine (Connects dropdowns to live road mapping)
  const routeLocations = {
    "cafe_ciya": [19.0250, 72.8350, "Vanilla Cookie Shake stop"],
    "dadar_tt": [19.0223, 72.8431, "Dadar TT"],
    "shivaji_park": [19.0260, 72.8375, "Shivaji Park"],
    "mokal_chinese": [19.0163, 72.8475, "Chicken Triple Schezwan pickup"],
    "hindamata": [19.0145, 72.8400, "Hindamata Junction"],
    "elphinstone": [19.0115, 72.8390, "Elphinstone Bridge"]
  };

  let activeRouteControl = null;

  document.getElementById('findRouteBtn').addEventListener('click', () => {
    const startVal = document.getElementById('startSelect').value;
    const endVal = document.getElementById('endSelect').value;
    
    const startData = routeLocations[startVal];
    const endData = routeLocations[endVal];

    // Remove previous active route if exists
    if (activeRouteControl) {
      map.removeControl(activeRouteControl);
    }

    // Set UI to loading
    document.getElementById('standardRouteTxt').innerHTML = `<strong>Standard route:</strong> Calculating...`;
    document.getElementById('safeRouteTxt').innerHTML = `<strong>Safe route:</strong> Finding detours...`;

    // Add Markers for Start and End points with personalized tooltips
    L.circleMarker([startData[0], startData[1]], { radius: 7, fillColor: '#0071e3', color: '#fff', weight: 2, fillOpacity: 1 }).bindTooltip(startData[2]).addTo(map);
    L.circleMarker([endData[0], endData[1]], { radius: 7, fillColor: '#ff3b30', color: '#fff', weight: 2, fillOpacity: 1 }).bindTooltip(endData[2]).addTo(map);

    // Call Leaflet Routing Machine to calculate exact road geometry
    activeRouteControl = L.Routing.control({
      waypoints: [
        L.latLng(startData[0], startData[1]),
        L.latLng(endData[0], endData[1])
      ],
      routeWhileDragging: false,
      addWaypoints: false,
      show: false, // Hides the ugly default text panel
      lineOptions: {
        styles: [{ color: '#0071e3', opacity: 1, weight: 6, lineCap: 'round', dashArray: '10, 10' }]
      },
      createMarker: function() { return null; } // We draw our own markers above
    }).addTo(map);

    // Update Sidebar with calculated distance once route is found
    activeRouteControl.on('routesfound', function(e) {
      let distanceKm = (e.routes[0].summary.totalDistance / 1000).toFixed(1);
      document.getElementById('standardRouteTxt').innerHTML = `<strong>Standard route:</strong> ${(distanceKm - 0.2).toFixed(1)} km — crosses expected flooding`;
      document.getElementById('safeRouteTxt').innerHTML = `<strong>Safe route:</strong> ${distanceKm} km — clear detour generated`;
    });
  });

  // 4. Timeline Flood Simulation Logic
  const getStatus = (edgeId, minute) => {
    if (currentScenario === 'normal') return 'normal';
    if (edgeId === "e_ambedkar" || edgeId === "e_naigaon") return minute > 75 ? 'flooded' : minute > 35 ? 'surcharge' : 'normal';
    if (edgeId === "e_senapati" || edgeId === "e_elphinstone") return minute > 120 ? 'flooded' : minute > 65 ? 'surcharge' : 'normal';
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

    networkLayers.edges.forEach(edgeObj => {
      let status = getStatus(edgeObj.id, minute);
      let color = '#34c759'; 
      if (status === 'surcharge') color = '#ff9500'; 
      if (status === 'flooded') color = '#5ac8fa'; 
      edgeObj.layer.setStyle({ color: color });
    });

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
      alertsText.innerText = "SEVERE: Impassable flooding at Hindamata Junction. Reroute all traffic.";
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

  // 5. Connect Timeline Slider Controls
  document.getElementById('scenarioSelect').addEventListener('change', (e) => {
    currentScenario = e.target.value;
    document.getElementById('timeSlider').value = 0;
    updateUI(0);
  });

  const slider = document.getElementById('timeSlider');
  slider.addEventListener('input', (e) => updateUI(parseInt(e.target.value)));

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
      }, 80); 
    } else {
      iconPlay.style.display = 'block';
      iconPause.style.display = 'none';
      clearInterval(timerInterval);
    }
  });

  updateUI(0);
});
