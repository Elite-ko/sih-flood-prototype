document.addEventListener("DOMContentLoaded", () => {
  const map = L.map('map', { zoomControl: false }).setView([19.0185, 72.8385], 15);

  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri',
    maxNativeZoom: 16,
    maxZoom: 20 
  }).addTo(map);

  const locations = {
    "cafe_ciya": { lat: 19.0250, lng: 72.8350, name: "Cafe Ciya" },
    "dadar_tt": { lat: 19.0223, lng: 72.8431, name: "Dadar TT" },
    "shivaji_park": { lat: 19.0260, lng: 72.8375, name: "Shivaji Park" },
    "mokal_chinese": { lat: 19.0163, lng: 72.8475, name: "Mokal Chinese" },
    "hindamata": { lat: 19.0145, lng: 72.8400, name: "Hindamata Junction" },
    "elphinstone": { lat: 19.0115, lng: 72.8390, name: "Elphinstone Bridge" }
  };

  // Fixed Tooltip Collision: Direction 'auto' intelligently shifts labels away from lines
  for (const key in locations) {
    L.circleMarker([locations[key].lat, locations[key].lng], {
      radius: 5, fillColor: '#1d1d1f', color: '#ffffff', weight: 2, fillOpacity: 1
    }).bindTooltip(locations[key].name, { permanent: true, direction: 'auto', className: 'map-labels', offset: [10, 0] }).addTo(map);
  }

  const floodZones = [
    { lat: 19.0145, lng: 72.8400, radius: 450, offset: 0 },   
    { lat: 19.0093, lng: 72.8385, radius: 350, offset: 15 },  
    { lat: 19.0223, lng: 72.8431, radius: 250, offset: 30 }   
  ];

  let zoneLayers = [];
  floodZones.forEach(zone => {
    let circle = L.circle([zone.lat, zone.lng], { radius: zone.radius, color: 'transparent', fillColor: 'transparent' }).addTo(map);
    zoneLayers.push({ circle: circle, ...zone });
  });

  let activeRouteControl = null;
  let standardRouteSegments = []; // Array of polylines for granular coloring
  let detourRouteLayer = null;
  let currentRawRoute = null;
  let currentDetourRoute = null;

  // Format ETA from seconds
  const formatETA = (seconds) => {
    const mins = Math.ceil(seconds / 60);
    return mins > 60 ? `${Math.floor(mins/60)} hr ${mins%60} min` : `${mins} mins`;
  };

  // Check status of a specific coordinate based on Vehicle Type
  function getPointStatus(lat, lng, minute) {
    if (document.getElementById('scenarioSelect').value === 'normal') return 'normal';
    
    let vehicle = document.getElementById('vehicleSelect').value;
    let vehiclePenalty = (vehicle === 'bike') ? 25 : 0; // Bikes are affected 25 mins earlier by rising water
    let status = 'normal';

    floodZones.forEach(z => {
      let dist = map.distance([lat, lng], [z.lat, z.lng]);
      if (dist < z.radius) {
        let adjustedMinute = minute - z.offset + vehiclePenalty;
        if (adjustedMinute > 75) status = 'flooded';
        else if (adjustedMinute > 35 && status !== 'flooded') status = 'surcharge';
      }
    });
    return status;
  }

  // Draw Granular Route
  function renderGranularRoute(minute) {
    // Clear old segments
    standardRouteSegments.forEach(layer => map.removeLayer(layer));
    standardRouteSegments = [];
    if (detourRouteLayer) map.removeLayer(detourRouteLayer);

    if (!currentRawRoute) return;

    let coords = currentRawRoute.coordinates;
    let currentSegmentCoords = [coords[0]];
    let currentStatus = getPointStatus(coords[0].lat, coords[0].lng, minute);
    let routeIsCompromised = false;
    let maxSeverity = 'normal';

    for (let i = 1; i < coords.length; i++) {
      let pt = coords[i];
      let ptStatus = getPointStatus(pt.lat, pt.lng, minute);
      currentSegmentCoords.push(pt);

      if (ptStatus !== currentStatus || i === coords.length - 1) {
        let color = '#34c759'; // Green
        if (currentStatus === 'surcharge') { color = '#ff9500'; maxSeverity = (maxSeverity !== 'flooded') ? 'surcharge' : 'flooded'; }
        if (currentStatus === 'flooded') { color = '#ff3b30'; maxSeverity = 'flooded'; routeIsCompromised = true; }
        
        let segmentPoly = L.polyline(currentSegmentCoords, {
          color: color, weight: 7, opacity: 1, lineCap: 'round', dashArray: '10, 10'
        }).addTo(map);
        
        standardRouteSegments.push(segmentPoly);
        currentSegmentCoords = [pt];
        currentStatus = ptStatus;
      }
    }

    // Handle UI Text
    const statusTxt = document.getElementById('standardStatus');
    if (maxSeverity === 'flooded') {
      statusTxt.innerHTML = `Impassable — Flooding on route`;
      statusTxt.className = "route-status route-danger";
    } else if (maxSeverity === 'surcharge') {
      statusTxt.innerHTML = `Expect delays — Surcharging drains`;
      statusTxt.className = "route-status route-warn";
    } else {
      statusTxt.innerHTML = `Clear & Safe`;
      statusTxt.className = "route-status route-safe";
    }

    // Draw Detour if Standard is compromised and an alternative exists
    const safeCard = document.getElementById('safeRouteCard');
    if (routeIsCompromised && currentDetourRoute) {
      detourRouteLayer = L.polyline(currentDetourRoute.coordinates, {
        color: '#34c759', weight: 6, opacity: 0.9, lineCap: 'round', dashArray: '10, 15'
      }).addTo(map);
      safeCard.style.display = 'block';
    } else {
      safeCard.style.display = 'none';
    }

    updateDashboard(maxSeverity, minute);
  }

  // Dashboard & Hazard Zones Overlay
  function updateDashboard(maxSeverity, minute) {
    const timeLabel = document.getElementById('timeCurrent');
    timeLabel.innerText = `T+${Math.floor(minute / 60)}:${(minute % 60).toString().padStart(2, '0')}`;

    let scenario = document.getElementById('scenarioSelect').value;
    
    zoneLayers.forEach(z => {
      let adjustedMinute = minute - z.offset;
      if (scenario === 'normal') {
        z.circle.setStyle({ color: 'transparent', fillColor: 'transparent' });
      } else {
        if (adjustedMinute > 75) z.circle.setStyle({ color: '#5ac8fa', fillColor: '#5ac8fa', fillOpacity: 0.2 });
        else if (adjustedMinute > 35) z.circle.setStyle({ color: '#ff9500', fillColor: '#ff9500', fillOpacity: 0.15 });
        else z.circle.setStyle({ color: 'transparent', fillColor: 'transparent' });
      }
    });

    const scoreNumber = document.getElementById('riskScore');
    const scoreLabel = document.getElementById('riskLabel');
    const alertsText = document.getElementById('liveAlerts');

    if (maxSeverity === 'flooded') {
      scoreNumber.innerText = "92"; scoreNumber.className = "score-number red";
      scoreLabel.innerText = "CRITICAL"; scoreLabel.className = "score-label red";
      alertsText.innerText = "SEVERE: Plotted route intersects impassable flood zones. Use safe detour.";
      alertsText.className = "subtitle alert";
    } else if (maxSeverity === 'surcharge') {
      scoreNumber.innerText = "48"; scoreNumber.className = "score-number orange";
      scoreLabel.innerText = "SURCHARGE"; scoreLabel.className = "score-label orange";
      alertsText.innerText = "Warning: Plotted route passes through surcharging storm drains.";
      alertsText.className = "subtitle alert";
    } else {
      scoreNumber.innerText = "10"; scoreNumber.className = "score-number green";
      scoreLabel.innerText = "NORMAL"; scoreLabel.className = "score-label green";
      alertsText.innerText = (currentRawRoute) ? "No active alerts for plotted route." : "No active alerts.";
      alertsText.className = "subtitle";
    }
  }

  // Find Route Action
  document.getElementById('findRouteBtn').addEventListener('click', () => {
    const startLoc = locations[document.getElementById('startSelect').value];
    const endLoc = locations[document.getElementById('endSelect').value];

    document.getElementById('clearRouteBtn').click(); // Wipe previous completely
    document.getElementById('routingResults').style.display = 'block';
    document.getElementById('standardMetrics').innerText = "Calculating...";
    document.getElementById('standardStatus').innerHTML = `Fetching telemetry...`;

    activeRouteControl = L.Routing.control({
      waypoints: [ L.latLng(startLoc.lat, startLoc.lng), L.latLng(endLoc.lat, endLoc.lng) ],
      alternatives: true, // Fetch detours for comparison
      show: false, addWaypoints: false, routeWhileDragging: false,
      createMarker: function() { return null; },
      lineOptions: { styles: [{ color: 'transparent', opacity: 0 }] } // Hide default solid line
    }).addTo(map);

    activeRouteControl.on('routesfound', function(e) {
      currentRawRoute = e.routes[0];
      // Save secondary route as detour if available
      currentDetourRoute = (e.routes.length > 1) ? e.routes[1] : null; 

      // Inject OSRM Quantitative Data
      let distKm = (currentRawRoute.summary.totalDistance / 1000).toFixed(1);
      document.getElementById('standardMetrics').innerText = `${distKm} km • ${formatETA(currentRawRoute.summary.totalTime)}`;
      
      if (currentDetourRoute) {
        let detourKm = (currentDetourRoute.summary.totalDistance / 1000).toFixed(1);
        document.getElementById('safeMetrics').innerText = `${detourKm} km • ${formatETA(currentDetourRoute.summary.totalTime)}`;
      }

      renderGranularRoute(parseInt(document.getElementById('timeSlider').value));
    });
  });

  // Clear Route Action
  document.getElementById('clearRouteBtn').addEventListener('click', () => {
    if (activeRouteControl) { map.removeControl(activeRouteControl); activeRouteControl = null; }
    standardRouteSegments.forEach(layer => map.removeLayer(layer)); standardRouteSegments = [];
    if (detourRouteLayer) { map.removeLayer(detourRouteLayer); detourRouteLayer = null; }
    
    currentRawRoute = null;
    currentDetourRoute = null;
    document.getElementById('routingResults').style.display = 'none';
    updateDashboard('normal', parseInt(document.getElementById('timeSlider').value));
  });

  // Re-calculate visual state on slider move or vehicle change
  const reRender = () => {
    let minute = parseInt(document.getElementById('timeSlider').value);
    if (currentRawRoute) renderGranularRoute(minute);
    else updateDashboard('normal', minute);
  };

  document.getElementById('scenarioSelect').addEventListener('change', () => { document.getElementById('timeSlider').value = 0; reRender(); });
  document.getElementById('vehicleSelect').addEventListener('change', reRender);
  document.getElementById('timeSlider').addEventListener('input', reRender);

  // Playback Control
  let isPlaying = false, timerInterval;
  const playBtn = document.getElementById('playBtn');
  
  playBtn.addEventListener('click', () => {
    isPlaying = !isPlaying;
    if (isPlaying) {
      document.querySelector('.icon-play').style.display = 'none';
      document.querySelector('.icon-pause').style.display = 'block';
      timerInterval = setInterval(() => {
        let slider = document.getElementById('timeSlider');
        let currentVal = parseInt(slider.value);
        if (currentVal >= 180) { playBtn.click(); return; }
        slider.value = currentVal + 1;
        reRender();
      }, 80); 
    } else {
      document.querySelector('.icon-play').style.display = 'block';
      document.querySelector('.icon-pause').style.display = 'none';
      clearInterval(timerInterval);
    }
  });

  reRender();
});
