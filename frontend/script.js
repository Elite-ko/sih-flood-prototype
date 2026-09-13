document.addEventListener("DOMContentLoaded", () => {
  // 1. Initialize Map on Andheri East
  const map = L.map('map', {
    zoomControl: false 
  }).setView([19.1155, 72.8710], 15);

  // Free Esri Canvas Basemap (No API Key Required)
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri',
    maxZoom: 18
  }).addTo(map);

  // 2. Define Realistic Street Paths (Proper Lanes, not a grid)
  const streetNetwork = {
    "Mathuradas Vasanji Rd": {
      coords: [[19.1130, 72.8610], [19.1120, 72.8680], [19.1105, 72.8760], [19.1085, 72.8830]],
      layer: null
    },
    "Mahakali Caves Rd": {
      coords: [[19.1120, 72.8680], [19.1160, 72.8690], [19.1200, 72.8700], [19.1250, 72.8710]],
      layer: null
    },
    "MIDC Central Rd": {
      coords: [[19.1105, 72.8760], [19.1150, 72.8775], [19.1190, 72.8785], [19.1230, 72.8790]],
      layer: null
    },
    "Cross Road A": {
      coords: [[19.1160, 72.8690], [19.1150, 72.8775]],
      layer: null // This road will "flood" during the simulation
    },
    "Kondivita Village Rd": {
      coords: [[19.1120, 72.8680], [19.1150, 72.8775]],
      layer: null
    }
  };

  // Draw initial paths (Green = Normal)
  for (let street in streetNetwork) {
    streetNetwork[street].layer = L.polyline(streetNetwork[street].coords, { 
      color: '#34c759', weight: 5, opacity: 0.9, lineCap: 'round'
    }).addTo(map);
  }

  // Draw Intersection Nodes (Manholes)
  const nodes = [
    [19.1120, 72.8680], [19.1105, 72.8760], [19.1160, 72.8690], [19.1150, 72.8775]
  ];
  let nodeLayers = [];
  nodes.forEach(coord => {
    let marker = L.circleMarker(coord, { 
      radius: 6, fillColor: '#34c759', color: '#ffffff', weight: 2, fillOpacity: 1 
    }).addTo(map);
    nodeLayers.push(marker);
  });

  // 3. Simulation & Timer Logic
  const slider = document.getElementById('timeSlider');
  const timeLabel = document.getElementById('timeCurrent');
  const playBtn = document.getElementById('playBtn');
  const iconPlay = document.querySelector('.icon-play');
  const iconPause = document.querySelector('.icon-pause');
  
  // UI Elements to update during simulation
  const scoreNumber = document.getElementById('riskScore');
  const scoreLabel = document.getElementById('riskLabel');
  const intensityText = document.getElementById('rainfallIntensity');
  const alertsText = document.getElementById('liveAlerts');

  let isPlaying = false;
  let timerInterval;

  // Format minutes into T+H:MM
  const formatTime = (minutes) => {
    let hours = Math.floor(minutes / 60);
    let mins = minutes % 60;
    return `T+${hours}:${mins.toString().padStart(2, '0')}`;
  };

  // Update map colors and UI based on timeline progress
  const updateConditions = (time) => {
    timeLabel.innerText = formatTime(time);

    if (time < 45) {
      // Normal state
      streetNetwork["Cross Road A"].layer.setStyle({ color: '#34c759' });
      streetNetwork["Mahakali Caves Rd"].layer.setStyle({ color: '#34c759' });
      nodeLayers[2].setStyle({ fillColor: '#34c759' });
      
      scoreNumber.innerText = "10";
      scoreNumber.className = "score-number green";
      scoreLabel.innerText = "NORMAL";
      scoreLabel.className = "score-label green";
      intensityText.innerText = "Rainfall intensity: 4 mm/hr";
      alertsText.innerText = "No active alerts.";
      alertsText.className = "subtitle";
      
    } else if (time >= 45 && time < 100) {
      // Surcharge state
      streetNetwork["Cross Road A"].layer.setStyle({ color: '#ff9500' });
      streetNetwork["Mahakali Caves Rd"].layer.setStyle({ color: '#ff9500' });
      nodeLayers[2].setStyle({ fillColor: '#ff9500' });

      scoreNumber.innerText = "45";
      scoreNumber.className = "score-number orange";
      scoreLabel.innerText = "SURCHARGE";
      scoreLabel.className = "score-label orange";
      intensityText.innerText = "Rainfall intensity: 32 mm/hr";
      alertsText.innerText = "Surcharge warning: Cross Road A & Mahakali Jct.";
      alertsText.className = "subtitle alert";

    } else if (time >= 100) {
      // Flooded / Overcapacity state
      streetNetwork["Cross Road A"].layer.setStyle({ color: '#5ac8fa' }); // Teal flooded street
      streetNetwork["Mahakali Caves Rd"].layer.setStyle({ color: '#ff3b30' }); // Red backflow
      nodeLayers[2].setStyle({ fillColor: '#ff3b30' }); // Red manhole hazard

      scoreNumber.innerText = "88";
      scoreNumber.className = "score-number red";
      scoreLabel.innerText = "CRITICAL";
      scoreLabel.className = "score-label red";
      intensityText.innerText = "Rainfall intensity: 58 mm/hr";
      alertsText.innerText = "SEVERE: Unavoidable flooding on Cross Road A. Reroute traffic.";
      alertsText.className = "subtitle alert";
    }
  };

  // Handle Play/Pause toggle
  const togglePlay = () => {
    isPlaying = !isPlaying;
    if (isPlaying) {
      iconPlay.style.display = 'none';
      iconPause.style.display = 'block';
      timerInterval = setInterval(() => {
        let currentVal = parseInt(slider.value);
        if (currentVal >= 180) {
          togglePlay(); // Stop at end
          return;
        }
        slider.value = currentVal + 1;
        updateConditions(currentVal + 1);
      }, 100); // Speed of simulation (100ms per simulated minute)
    } else {
      iconPlay.style.display = 'block';
      iconPause.style.display = 'none';
      clearInterval(timerInterval);
    }
  };

  playBtn.addEventListener('click', togglePlay);

  // Allow manual scrubbing
  slider.addEventListener('input', (e) => {
    updateConditions(parseInt(e.target.value));
  });
});
