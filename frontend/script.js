document.addEventListener("DOMContentLoaded", () => {
  // 1. Initialize Map
  const map = L.map('map', { zoomControl: false }).setView([19.0185, 72.8385], 15);

  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri',
    maxNativeZoom: 16,
    maxZoom: 20 
  }).addTo(map);

  // 2. Define Key Locations
  const locations = {
    "cafe_ciya": { lat: 19.0250, lng: 72.8350, name: "Cafe Ciya" },
    "dadar_tt": { lat: 19.0223, lng: 72.8431, name: "Dadar TT" },
    "shivaji_park": { lat: 19.0260, lng: 72.8375, name: "Shivaji Park" },
    "mokal_chinese": { lat: 19.0163, lng: 72.8475, name: "Mokal Chinese" },
    "hindamata": { lat: 19.0145, lng: 72.8400, name: "Hindamata Junction" },
    "elphinstone": { lat: 19.0115, lng: 72.8390, name: "Elphinstone Bridge" }
  };

  // Draw location dots only
  for (const key in locations) {
    L.circleMarker([locations[key].lat, locations[key].lng], {
      radius: 5, fillColor: '#1d1d1f', color: '#ffffff', weight: 2, fillOpacity: 1
    }).bindTooltip(locations[key].name, { permanent: true, direction: 'top', className: 'map-labels', offset: [0, -5] }).addTo(map);
  }

  // 3. Routing Engine & Dynamic Coloring
  let activeRouteControl = null;
  let customRouteLayer = null; 
  let activeStart = null;
  let activeEnd = null;
  let currentScenario = 'severe';

  document.getElementById('findRouteBtn').addEventListener('click', () => {
    activeStart = document.getElementById('startSelect').value;
    activeEnd = document.getElementById('endSelect').value;
    const startLoc = locations[activeStart];
    const endLoc = locations[activeEnd];

    // Wipe previous routes
    if (activeRouteControl) map.removeControl(activeRouteControl);
    if (customRouteLayer) map.removeLayer(customRouteLayer);

    document.getElementById('routeText').innerHTML = `<strong>Calculating Route...</strong>`;
    document.getElementById('routeText').className = "route-safe";

    activeRouteControl = L.Routing.control({
      waypoints: [ L.latLng(startLoc.lat, startLoc.lng), L.latLng(endLoc.lat, endLoc.lng) ],
      show: false, 
      addWaypoints: false,
      routeWhileDragging: false,
      createMarker: function() { return null; },
      lineOptions: {
        styles: [{ color: 'transparent', opacity: 0, weight: 0 }] // Hide default solid line
      }
    }).addTo(map);

    // When OSRM finds the route, draw our own custom color-changing line
    activeRouteControl.on('routesfound', function(e) {
      let route = e.routes[0];
      
      if (customRouteLayer) map.removeLayer(customRouteLayer);
      
      customRouteLayer = L.polyline(route.coordinates, {
        color: '#34c759', // Starts green
        weight: 6, 
        opacity: 0.9, 
        lineCap: 'round',
        dashArray: '10, 12'
      }).addTo(map);

      // Trigger an immediate UI update based on the current timeline slider position
      updateUI(parseInt(document.getElementById('timeSlider').value));
    });
  });

  // 4. Determine Route Status Based on Timeline
  function getRouteRiskStatus(minute) {
    if (currentScenario === 'normal' || !activeStart || !activeEnd) return 'normal';
    
    // Core Flood Zone (Hindamata / Dadar)
    const floodZonePoints = ['hindamata', 'mokal_chinese', 'dadar_tt'];
    if (floodZonePoints.includes(activeStart) || floodZonePoints.includes(activeEnd)) {
      if (minute > 75) return 'flooded'; // Red
      if (minute > 35) return 'surcharge'; // Orange
    }

    // Secondary Zone (Elphinstone)
    if (activeStart === 'elphinstone' || activeEnd === 'elphinstone') {
      if (minute > 120) return 'flooded'; // Red
      if (minute > 65) return 'surcharge'; // Orange
    }

    return 'normal'; // Green
  }

  // 5. Update UI, Route Colors, and Score
  const timeLabel = document.getElementById('timeCurrent');
  const scoreNumber = document.getElementById('riskScore');
  const scoreLabel = document.getElementById('riskLabel');
  const alertsText = document.getElementById('liveAlerts');
  const routeText = document.getElementById('routeText');

  function updateUI(minute) {
    let hours = Math.floor(minute / 60);
    let mins = minute % 60;
    timeLabel.innerText = `T+${hours}:${mins.toString().padStart(2, '0')}`;

    let status = getRouteRiskStatus(minute);
    
    // Colorize the route directly
    if (customRouteLayer) {
      if (status === 'normal') customRouteLayer.setStyle({ color: '#34c759' });
      else if (status === 'surcharge') customRouteLayer.setStyle({ color: '#ff9500' });
      else if (status === 'flooded') customRouteLayer.setStyle({ color: '#ff3b30' });
    }

    // Update Route Text Panel
    if (activeRouteControl && customRouteLayer) {
      if (status === 'normal') {
        routeText.innerHTML = `<strong>Route Status:</strong> Clear & Safe`;
        routeText.className = "route-safe";
      } else if (status === 'surcharge') {
        routeText.innerHTML = `<strong>Route Status:</strong> Expect delays — drainage surcharging`;
        routeText.className = "route-warn";
      } else if (status === 'flooded') {
        routeText.innerHTML = `<strong>Route Status:</strong> Impassable — severe flooding on path`;
        routeText.className = "route-danger";
      }
    }

    // Update Dashboard Risk Score
    let currentScore = 10;
    if (status === 'flooded') currentScore = 92;
    else if (status === 'surcharge') currentScore = 48;

    scoreNumber.innerText = currentScore;
    if (currentScore > 75) {
      scoreNumber.className = "score-number red";
      scoreLabel.className = "score-label red";
      scoreLabel.innerText = "CRITICAL";
      alertsText.innerText = "SEVERE: Plotted route intersects impassable flood zones. Seek alternatives.";
      alertsText.className = "subtitle alert";
    } else if (currentScore > 40) {
      scoreNumber.className = "score-number orange";
      scoreLabel.className = "score-label orange";
      scoreLabel.innerText = "SURCHARGE";
      alertsText.innerText = "Warning: Plotted route passes through surcharging storm drains.";
      alertsText.className = "subtitle alert";
    } else {
      scoreNumber.className = "score-number green";
      scoreLabel.className = "score-label green";
      scoreLabel.innerText = "NORMAL";
      alertsText.innerText = "No active alerts for plotted route.";
      alertsText.className = "subtitle";
    }
  }

  // 6. Connect Controls
  document.getElementById('scenarioSelect').addEventListener('change', (e) => {
    currentScenario = e.target.value;
    updateUI(parseInt(document.getElementById('timeSlider').value));
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
