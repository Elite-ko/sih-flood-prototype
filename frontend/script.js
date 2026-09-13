document.addEventListener("DOMContentLoaded", () => {
  // 1. Initialize Map
  const map = L.map('map', { zoomControl: false }).setView([19.1155, 72.8730], 15);

  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri',
    maxZoom: 18
  }).addTo(map);

  // 2. Pre-calculated Curved Street Geometry
  // These arrays contain multiple coordinates to physically bend around the map blocks
  const segments = {
    'mathuradas': L.polyline([
      [19.1120, 72.8680], [19.1118, 72.8700], [19.1110, 72.8740], [19.1085, 72.8830]
    ], { color: '#34c759', weight: 6, opacity: 0.9, lineCap: 'round' }).addTo(map),
    
    'mahakali': L.polyline([
      [19.1120, 72.8680], [19.1140, 72.8685], [19.1170, 72.8690], [19.1200, 72.8700]
    ], { color: '#34c759', weight: 6, opacity: 0.9, lineCap: 'round' }).addTo(map),
    
    'midc': L.polyline([
      [19.1150, 72.8775], [19.1175, 72.8780], [19.1200, 72.8785], [19.1230, 72.8790]
    ], { color: '#34c759', weight: 6, opacity: 0.9, lineCap: 'round' }).addTo(map),
    
    'crossroad': L.polyline([
      [19.1170, 72.8690], [19.1165, 72.8730], [19.1160, 72.8750], [19.1150, 72.8775]
    ], { color: '#34c759', weight: 6, opacity: 0.9, lineCap: 'round' }).addTo(map)
  };

  // Add Manhole Markers at Intersections
  const nodes = [ [19.1120, 72.8680], [19.1150, 72.8775], [19.1170, 72.8690] ];
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

  const updateConditions = (minute) => {
    let hours = Math.floor(minute / 60);
    let mins = minute % 60;
    timeLabel.innerText = `T+${hours}:${mins.toString().padStart(2, '0')}`;

    if (minute < 45) {
      segments['crossroad'].setStyle({ color: '#34c759' });
      segments['mahakali'].setStyle({ color: '#34c759' });
      nodeLayers[2].setStyle({ fillColor: '#34c759' });
      
      scoreNumber.innerText = "10";
      scoreNumber.className = "score-number green";
      scoreLabel.innerText = "NORMAL";
      scoreLabel.className = "score-label green";
      intensityText.innerText = "Rainfall intensity: 4 mm/hr";
      alertsText.innerText = "No active alerts.";
      alertsText.className = "subtitle";
      
    } else if (minute >= 45 && minute < 100) {
      segments['crossroad'].setStyle({ color: '#ff9500' });
      segments['mahakali'].setStyle({ color: '#ff9500' });
      nodeLayers[2].setStyle({ fillColor: '#ff9500' });

      scoreNumber.innerText = "45";
      scoreNumber.className = "score-number orange";
      scoreLabel.innerText = "SURCHARGE";
      scoreLabel.className = "score-label orange";
      intensityText.innerText = "Rainfall intensity: 32 mm/hr";
      alertsText.innerText = "Surcharge warning on Cross Road A.";
      alertsText.className = "subtitle alert";

    } else if (minute >= 100) {
      segments['crossroad'].setStyle({ color: '#5ac8fa' }); 
      segments['mahakali'].setStyle({ color: '#ff3b30' }); 
      nodeLayers[2].setStyle({ fillColor: '#ff3b30' }); 

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
          playBtn.click();
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
