document.addEventListener("DOMContentLoaded", () => {
  // Initialize Map (Zoom controls disabled for a cleaner Apple-style canvas)
  const map = L.map('map', {
    zoomControl: false 
  }).setView([19.1126, 72.8710], 16);

  // Use CartoDB Positron for a light, minimalist, iOS-like basemap
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 20
  }).addTo(map);

  // Mocking the Graph / Pipe Grid from your original screenshot
  const baseLat = 19.111;
  const baseLng = 72.868;
  const step = 0.0015;
  
  // Generating a 6x6 grid loop for immediate visual testing
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 6; j++) {
      let lat = baseLat + (i * step);
      let lng = baseLng + (j * step);
      
      // Node (Manhole)
      let nodeColor = (i === 5 && j === 3) ? '#ff3b30' : '#34c759'; // Mock one high-risk red node
      L.circleMarker([lat, lng], {
        radius: 4, fillColor: nodeColor, color: '#ffffff', weight: 1, fillOpacity: 1
      }).addTo(map);

      // Horizontal lines (Pipes)
      if (j < 5) {
        let nextLng = baseLng + ((j + 1) * step);
        let lineColor = (i === 5 && j === 2) ? '#ff9500' : '#34c759'; // Mock an orange surcharge pipe
        L.polyline([[lat, lng], [lat, nextLng]], { color: lineColor, weight: 3, opacity: 0.9 }).addTo(map);
      }
      
      // Vertical lines (Pipes)
      if (i < 5) {
        let nextLat = baseLat + ((i + 1) * step);
        L.polyline([[lat, lng], [nextLat, lng]], { color: '#34c759', weight: 3, opacity: 0.9 }).addTo(map);
      }
    }
  }

  // Handle timeline scrubber interaction
  const slider = document.getElementById('timeSlider');
  const timeLabels = document.querySelectorAll('.time-label');
  
  slider.addEventListener('input', (e) => {
    let minutes = e.target.value;
    let hours = Math.floor(minutes / 60);
    let mins = minutes % 60;
    let timeString = `T+${hours}:${mins.toString().padStart(2, '0')}`;
    timeLabels[0].innerText = timeString; 
  });
});
