document.addEventListener("DOMContentLoaded", () => {
  // 1. Initialize Map
  const map = L.map('map', { zoomControl: false }).setView([19.1155, 72.8710], 15);

  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri',
    maxZoom: 18
  }).addTo(map);

  // 2. Setup Routing Segments (This automatically snaps to real roads)
  // We store the instances so we can change their colors later
  let segments = {};

  const createSnappingRoute = (id, startLat, startLng, endLat, endLng) => {
    segments[id] = L.Routing.control({
      waypoints: [ L.latLng(startLat, startLng), L.latLng(endLat, endLng) ],
      show: false, // Hides text directions
      addWaypoints: false,
      draggableWaypoints: false,
      fitSelectedRoutes: false,
      lineOptions: {
        styles: [{ color: '#34c759', weight: 6, opacity: 0.9 }] // Default green
      },
      createMarker: () => null // Hide default map pins
    }).addTo(map);
  };

  // Define actual street segments in Andheri East
  createSnappingRoute('mathuradas', 19.1120, 72.8680, 19.1085, 72.8830); // Mathuradas Vasanji Rd
  createSnappingRoute('mahakali', 19.1120, 72.8680, 19.1200, 72.8700); // Mahakali Caves Rd
  createSnappingRoute('midc', 19.1150, 72.8775, 19.1230, 72.8790); // MIDC Central Rd
  createSnappingRoute('crossroad', 19.1160, 72.8690, 19.1150, 72.8775); // Cross Road A

  // Add Manhole Markers
  const nodes = [ [19.1120, 72.8680], [19.1150, 72.8775], [19.1160, 72.8690] ];
  let nodeLayers = [];
  nodes.forEach(coord => {
    let marker = L.circleMarker(coord, { 
      radius: 6, fillColor: '#34c759', color: '#ffffff', weight: 2, fillOpacity: 1 
    }).addTo(map);
    nodeLayers.push(marker);
  });

  // 3. Setup Simulation UI Logic
  const slider = document.getElementById('timeSlider');
  const timeLabel = document.getElementById('timeCurrent');
  const scoreNumber = document.getElementById('riskScore');
  const scoreLabel = document.getElementById('riskLabel');
  const intensityText = document.getElementById('rainfallIntensity');
  const alertsText = document.getElementById('liveAlerts');

  // Helper to change color of a snapped route
  const setRouteColor = (routeInstance, color) => {
    routeInstance.getPlan().setWaypoints(routeInstance.getWaypoints()); // Triggers redraw
    routeInstance.options.lineOptions.styles[0].color = color;
  };

  const updateConditions = (minute) => {
    let hours = Math.floor(minute / 60);
    let mins = minute % 60;
    timeLabel.innerText = `T+${hours}:${mins.toString().padStart(2, '0')}`;

    if (minute < 45) {
      setRouteColor(segments['crossroad'], '#34c759');
      setRouteColor(segments['mahakali'], '#34c759');
      nodeLayers[2].setStyle({ fillColor: '#34c759' });
      
      scoreNumber.innerText = "10";
      scoreNumber.className = "score-number green";
      scoreLabel.innerText = "NORMAL";
      scoreLabel.className = "score-label green";
      intensityText.innerText = "Rainfall intensity: 4 mm/hr";
      alertsText.innerText = "No active alerts.";
      alertsText.className = "subtitle";
      
    } else if (minute >= 45 && minute < 100) {
      setRouteColor(segments['crossroad'], '#ff9500'); // Orange
      setRouteColor(segments['mahakali'], '#ff9500'); // Orange
      nodeLayers[2].setStyle({ fillColor: '#ff9500' });

      scoreNumber.innerText = "45";
      scoreNumber.className = "score-number orange";
      scoreLabel.innerText = "SURCHARGE";
      scoreLabel.className = "score-label orange";
      intensityText.innerText = "Rainfall intensity: 32 mm/hr";
      alertsText.innerText = "Surcharge warning on Cross Road A.";
      alertsText.className = "subtitle alert";

    } else if (minute >= 100) {
      setRouteColor(segments['crossroad'], '#5ac8fa'); // Teal flooded
      setRouteColor(segments['mahakali'], '#ff3b30'); // Red backflow
      nodeLayers[2].setStyle({ fillColor: '#ff3b30' }); // Red manhole hazard

      scoreNumber.innerText = "88";
      scoreNumber.className = "score-number red";
      scoreLabel.innerText = "CRITICAL";
      scoreLabel.className = "score-label red";
      intensityText.innerText = "Rainfall intensity: 58 mm/hr";
      alertsText.innerText = "SEVERE: Flooding on Cross Road A.";
      alertsText.className = "subtitle alert";
    }
  };

  // 4. Play Button
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
          playBtn.click(); // Pause at end
          return;
        }
        slider.value = currentVal + 1;
        updateConditions(currentVal + 1);
      }, 200); 
    } else {
      iconPlay.style.display = 'block';
      iconPause.style.display = 'none';
      clearInterval(timerInterval);
    }
  });

  slider.addEventListener('input', (e) => {
    updateConditions(parseInt(e.target.value));
  });
});
