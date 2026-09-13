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

  let standardRouteSegments = [];
  let detourRouteLayer = null;
  let currentRouteCoords = null;
  let currentDetourCoords = null;
  let activeStart = null;
  let activeEnd = null;

  // Pre-mapped robust paths to guarantee rendering without API blocks
  const routeDatabase = {
    "cafe_ciya_mokal_chinese": {
      primary: [
        {lat: 19.0250, lng: 72.8350}, {lat: 19.0240, lng: 72.8365}, {lat: 19.0228, lng: 72.8383},
        {lat: 19.0205, lng: 72.8390}, {lat: 19.0175, lng: 72.8410}, {lat: 19.0163, lng: 72.8475}
      ],
      detour: [
        {lat: 19.0250, lng: 72.8350}, {lat: 19.0260, lng: 72.8375}, {lat: 19.0235, lng: 72.8383},
        {lat: 19.0195, lng: 72.8345}, {lat: 19.0160, lng: 72.8315}, {lat: 19.0163, lng: 72.8475}
      ],
      dist: 2.4, time: 480
    },
    "shivaji_park_hindamata": {
      primary: [
        {lat: 19.0260, lng: 72.8375}, {lat: 19.0235, lng: 72.8383}, {lat: 19.0205, lng: 72.8390},
        {lat: 19.0175, lng: 72.8410}, {lat: 19.0145, lng: 72.8400}
      ],
      detour: [
        {lat: 19.0260, lng: 72.8375}, {lat: 19.0220, lng: 72.8340}, {lat: 19.0160, lng: 72.8315},
        {lat: 19.0115, lng: 72.8390}, {lat: 19.0145, lng: 72.8400}
      ],
      dist: 1.6, time: 320
    },
    "dadar_tt_hindamata": {
      primary: [
        {lat: 19.0223, lng: 72.8431}, {lat: 19.0205, lng: 72.8422}, {lat: 19.0175, lng: 72.8410}, {lat: 19.0145, lng: 72.8400}
      ],
      detour: [
        {lat: 19.0223, lng: 72.8431}, {lat: 19.0240, lng: 72.8450}, {lat: 19.0180, lng: 72.8480}, {lat: 19.0145, lng: 72.8400}
      ],
      dist: 1.1, time: 220
    }
  };

  const formatETA = (seconds) => {
    const mins = Math.ceil(seconds / 60);
    return `${mins} mins`;
  };

  function getPointStatus(lat, lng, minute) {
    if (document.getElementById('scenarioSelect').value === 'normal') return 'normal';
    let vehicle = document.getElementById('vehicleSelect').value;
    let vehiclePenalty = (vehicle === 'bike') ? 20 : 0;
    let status = 'normal';

    floodZones.forEach(z => {
      let mapInst = map;
      let dist = mapInst.distance([lat, lng], [z.lat, z.lng]);
      if (dist < z.radius) {
        let adjustedMinute = minute - z.offset + vehiclePenalty;
        if (adjustedMinute > 75) status = 'flooded';
        else if (adjustedMinute > 35 && status !== 'flooded') status = 'surcharge';
      }
    });
    return status;
  }

  function renderGranularRoute(minute) {
    standardRouteSegments.forEach(layer => map.removeLayer(layer));
    standardRouteSegments = [];
    if (detourRouteLayer) map.removeLayer(detourRouteLayer);

    if (!currentRouteCoords) return;

    let coords = currentRouteCoords;
    let currentSegmentCoords = [coords[0]];
    let currentStatus = getPointStatus(coords[0].lat, coords[0].lng, minute);
    let routeIsCompromised = false;
    let maxSeverity = 'normal';

    for (let i = 1; i < coords.length; i++) {
      let pt = coords[i];
      let ptStatus = getPointStatus(pt.lat, pt.lng, minute);
      currentSegmentCoords.push(pt);

      if (ptStatus !== currentStatus || i === coords.length - 1) {
        let color = '#34c759'; 
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

    const safeCard = document.getElementById('safeRouteCard');
    if (routeIsCompromised && currentDetourCoords) {
      detourRouteLayer = L.polyline(currentDetourCoords, {
        color: '#34c759', weight: 6, opacity: 0.9, lineCap: 'round', dashArray: '10, 15'
      }).addTo(map);
      safeCard.style.display = 'block';
    } else {
      safeCard.style.display = 'none';
    }

    updateDashboard(maxSeverity, minute);
  }

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
      alertsText.innerText = (currentRouteCoords) ? "No active alerts for plotted route." : "No active alerts.";
      alertsText.className = "subtitle";
    }
  }

  document.getElementById('findRouteBtn').addEventListener('click', () => {
    activeStart = document.getElementById('startSelect').value;
    activeEnd = document.getElementById('endSelect').value;
    
    let dbKey = `${activeStart}_${activeEnd}`;
    let routeInfo = routeDatabase[dbKey] || routeDatabase["shivaji_park_hindamata"]; // Default fallback

    currentRouteCoords = routeInfo.primary;
    currentDetourCoords = routeInfo.detour;

    document.getElementById('routingResults').style.display = 'block';
    document.getElementById('standardMetrics').innerText = `${routeInfo.dist} km • ${formatETA(routeInfo.time)}`;
    document.getElementById('safeMetrics').innerText = `${(routeInfo.dist + 0.5).toFixed(1)} km • ${formatETA(routeInfo.time + 120)}`;

    renderGranularRoute(parseInt(document.getElementById('timeSlider').value));
  });

  document.getElementById('clearRouteBtn').addEventListener('click', () => {
    standardRouteSegments.forEach(layer => map.removeLayer(layer)); standardRouteSegments = [];
    if (detourRouteLayer) { map.removeLayer(detourRouteLayer); detourRouteLayer = null; }
    
    currentRouteCoords = null;
    currentDetourCoords = null;
    document.getElementById('routingResults').style.display = 'none';
    updateDashboard('normal', parseInt(document.getElementById('timeSlider').value));
  });

  const reRender = () => {
    let minute = parseInt(document.getElementById('timeSlider').value);
    if (currentRouteCoords) renderGranularRoute(minute);
    else updateDashboard('normal', minute);
  };

  document.getElementById('scenarioSelect').addEventListener('change', () => { document.getElementById('timeSlider').value = 0; reRender(); });
  document.getElementById('vehicleSelect').addEventListener('change', reRender);
  document.getElementById('timeSlider').addEventListener('input', reRender);

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
