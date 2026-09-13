document.addEventListener("DOMContentLoaded", () => {
  // 1. Initialize Map
  const map = L.map('map', { zoomControl: false }).setView([19.0185, 72.8385], 15);

  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri',
    maxNativeZoom: 16,
    maxZoom: 20 
  }).addTo(map);

  // 2. Plot Key Locations (No lines drawn yet)
  const locations = {
    "cafe_ciya": { lat: 19.0250, lng: 72.8350, name: "Cafe Ciya" },
    "dadar_tt": { lat: 19.0223, lng: 72.8431, name: "Dadar TT" },
    "shivaji_park": { lat: 19.0260, lng: 72.8375, name: "Shivaji Park" },
    "mokal_chinese": { lat: 19.0163, lng: 72.8475, name: "Mokal Chinese" },
    "hindamata": { lat: 19.0145, lng: 72.8400, name: "Hindamata Junction" },
    "elphinstone": { lat: 19.0115, lng: 72.8390, name: "Elphinstone Bridge" }
  };

  for (const key in locations) {
    L.circleMarker([locations[key].lat, locations[key].lng], {
      radius: 5, fillColor: '#1d1d1f', color: '#ffffff', weight: 2, fillOpacity: 1
    }).bindTooltip(locations[key].name, { permanent: true, direction: 'top', className: 'map-labels', offset: [0, -5] }).addTo(map);
  }

  // 3. Dynamic Routing Engine (Only fires on button click)
  let activeRouteControl = null;

  document.getElementById('findRouteBtn').addEventListener('click', () => {
    const startVal = document.getElementById('startSelect').value;
    const endVal = document.getElementById('endSelect').value;
    const startLoc = locations[startVal];
    const endLoc = locations[endVal];

    // Wipe previous route if one exists
    if (activeRouteControl) {
      map.removeControl(activeRouteControl);
    }

    document.getElementById('standardRouteTxt').innerHTML = `<strong>Standard route:</strong> Calculating...`;
    document.getElementById('safeRouteTxt').innerHTML = `<strong>Safe route:</strong> Scanning detours...`;

    // Calculate new route hugging the actual roads
    activeRouteControl = L.Routing.control({
      waypoints: [
        L.latLng(startLoc.lat, startLoc.lng),
        L.latLng(endLoc.lat, endLoc.lng)
      ],
      routeWhileDragging: false,
      addWaypoints: false,
      show: false, // Hides text panel via our CSS rule
      lineOptions: {
        styles: [{ color: '#0071e3', opacity: 0.8, weight: 6, lineCap: 'round', dashArray: '10, 10' }]
      },
      createMarker: function() { return null; } // Keep map clean
    }).addTo(map);

    activeRouteControl.on('routesfound', function(e) {
      let distanceKm = (e.routes[0].summary.totalDistance / 1000).toFixed(1);
      document.getElementById('standardRouteTxt').innerHTML = `<strong>Standard route:</strong> ${distanceKm} km — active path`;
      document.getElementById('safeRouteTxt').innerHTML = `<strong>Safe route:</strong> Monitoring flood zones...`;
    });
  });

  // 4. Flood Hazard Zones (Visual overlays that grow with time)
  const floodZones = [
    { lat: 19.0145, lng: 72.8400, radius: 450, offset: 0 },   // Hindamata
    { lat: 19.0093, lng: 72.8385, radius: 350, offset: 15 },  // Parel TT
    { lat: 19.0223, lng: 72.8431, radius: 250, offset: 30 }   // Dadar TT
  ];

  let zoneLayers = [];
  floodZones.forEach(zone => {
    let circle = L.circle([zone.lat, zone.lng], {
      radius: zone.radius, color: 'transparent', fillColor: 'transparent'
    }).addTo(map);
    zoneLayers.push({ circle: circle, ...zone });
  });

  let currentScenario = 'severe';
  const timeLabel = document.getElementById('timeCurrent');
  const scoreNumber = document.getElementById('riskScore');
  const scoreLabel = document.getElementById('riskLabel');
  const alertsText = document.getElementById('liveAlerts');

  function updateUI(minute) {
    let hours = Math.floor(minute / 60);
    let mins = minute % 60;
    timeLabel.innerText = `T+${hours}:${mins.toString().padStart(2, '0')}`;

    let currentScore = 10;
    let floodedCount = 0;

    // Dynamically color the hazard zones based on time
    zoneLayers.forEach(z => {
      let adjustedMinute = minute - z.offset;
      if (currentScenario === 'normal') {
        z.circle.setStyle({ color: 'transparent', fillColor: 'transparent' });
      } else {
        if (adjustedMinute > 75) {
          z.circle.setStyle({ color: '#5ac8fa', fillColor: '#5ac8fa', fillOpacity: 0.3 }); // Teal/Flooded
          floodedCount++;
        } else if (adjustedMinute > 35) {
          z.circle.setStyle({ color: '#ff9500', fillColor: '#ff9500', fillOpacity: 0.2 }); // Orange/Surcharge
        } else {
          z.circle.setStyle({ color: 'transparent', fillColor: 'transparent' });
        }
      }
    });

    if (floodedCount > 0) currentScore = 92;
    else if (minute > 35 && currentScenario === 'severe') currentScore = 48;

    // Update Dashboard Risk Panel
    scoreNumber.innerText = currentScore;
    if (currentScore > 75) {
      scoreNumber.className = "score-number red";
      scoreLabel.className = "score-label red";
      scoreLabel.innerText = "CRITICAL";
      alertsText.innerText = "SEVERE: Impassable flooding detected in marked zones. Avoid Hindamata.";
      alertsText.className = "subtitle alert";
    } else if (currentScore > 40) {
      scoreNumber.className = "score-number orange";
      scoreLabel.className = "score-label orange";
      scoreLabel.innerText = "SURCHARGE";
      alertsText.innerText = "Warning: Storm drains exceeding capacity in marked zones.";
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
