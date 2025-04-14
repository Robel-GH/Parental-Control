// Location tracking and geofencing functionality
let map = null;
let childMarkers = {};
let geofenceCircles = {};
let selectedChild = null;

document.addEventListener('DOMContentLoaded', function() {
  // Check if we're on the location page
  const mapContainer = document.getElementById('map-container');
  if (!mapContainer) return;
  
  // Initialize the map
  initMap();
  
  // Load child selector
  loadChildSelector();
  
  // Setup geofence controls
  setupGeofenceControls();
  
  // Start location tracking if user is a child
  if (currentUser && currentUser.role === 'child') {
    startLocationTracking();
  }
});

// Initialize map
function initMap() {
  // Create map centered on a default location (adjust as needed)
  map = L.map('map-container').setView([40.7128, -74.0060], 13);
  
  // Add tile layer (using OpenStreetMap)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
}

// Load child selector
function loadChildSelector() {
  const childSelector = document.getElementById('child-selector');
  if (!childSelector) return;
  
  // Fetch children data
  fetch('/api/children')
    .then(response => response.json())
    .then(children => {
      // Clear existing options
      childSelector.innerHTML = '';
      
      // Add options for each child
      children.forEach(child => {
        const option = document.createElement('option');
        option.value = child.id;
        option.textContent = child.username;
        childSelector.appendChild(option);
      });
      
      // Trigger change event to load first child's data
      if (children.length > 0) {
        childSelector.value = children[0].id;
        selectedChild = children[0].id;
        childSelector.dispatchEvent(new Event('change'));
      }
    })
    .catch(error => console.error('Error loading children:', error));
  
  // Add change event listener
  childSelector.addEventListener('change', function() {
    selectedChild = this.value;
    loadChildLocation(selectedChild);
    loadGeofences(selectedChild);
  });
}

// Load child's current location
function loadChildLocation(childId) {
  fetch(`/api/location/current/${childId}`)
    .then(response => {
      if (!response.ok) {
        throw new Error('No location data available');
      }
      return response.json();
    })
    .then(location => {
      updateChildMarker(childId, location.latitude, location.longitude);
      
      // Center map on child's location
      map.setView([location.latitude, location.longitude], 13);
      
      // Load location history
      loadLocationHistory(childId);
    })
    .catch(error => {
      console.error('Error loading child location:', error);
      showAlert('No location data available for this child', 'warning');
    });
}

// Update child marker on map
function updateChildMarker(childId, latitude, longitude) {
  // If marker already exists, update its position
  if (childMarkers[childId]) {
    childMarkers[childId].setLatLng([latitude, longitude]);
  } else {
    // Create a new marker
    const childIcon = L.divIcon({
      html: `<div class="child-marker" style="background-color: #4b6cb7; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>`,
      className: 'child-marker-container',
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });
    
    childMarkers[childId] = L.marker([latitude, longitude], { icon: childIcon }).addTo(map);
    
    // Get child name for popup
    fetch(`/api/child/${childId}`)
      .then(response => response.json())
      .then(child => {
        childMarkers[childId].bindPopup(`<b>${child.username}</b><br>Last updated: ${new Date().toLocaleString()}`);
      })
      .catch(error => console.error('Error fetching child data:', error));
  }
  
  // Update popup content with latest timestamp
  if (childMarkers[childId].getPopup()) {
    const popup = childMarkers[childId].getPopup();
    const content = popup.getContent().split('<br>')[0]; // Get the name part
    popup.setContent(`${content}<br>Last updated: ${new Date().toLocaleString()}`);
  }
}

// Load location history for child
function loadLocationHistory(childId) {
  fetch(`/api/location/history/${childId}?limit=50`)
    .then(response => response.json())
    .then(history => {
      // Create a polyline from the location history
      const points = history.map(point => [point.latitude, point.longitude]);
      
      // Remove existing polyline if any
      if (window.historyPolyline) {
        map.removeLayer(window.historyPolyline);
      }
      
      if (points.length > 1) {
        window.historyPolyline = L.polyline(points, {
          color: '#4b6cb7',
          weight: 3,
          opacity: 0.7,
          dashArray: '5, 10'
        }).addTo(map);
      }
    })
    .catch(error => console.error('Error loading location history:', error));
}

// Load geofences for child
function loadGeofences(childId) {
  // Clear existing geofences
  Object.values(geofenceCircles).forEach(circle => {
    map.removeLayer(circle);
  });
  geofenceCircles = {};
  
  fetch(`/api/geofence/list/${childId}`)
    .then(response => response.json())
    .then(geofences => {
      // Add geofences to map
      geofences.forEach(geofence => {
        addGeofenceToMap(geofence);
      });
      
      // Update geofence list in UI
      updateGeofenceList(geofences);
    })
    .catch(error => console.error('Error loading geofences:', error));
}

// Add geofence to map
function addGeofenceToMap(geofence) {
  const circle = L.circle([geofence.latitude, geofence.longitude], {
    radius: geofence.radius,
    color: '#182848',
    fillColor: '#4b6cb7',
    fillOpacity: 0.2,
    weight: 2
  }).addTo(map);
  
  circle.bindPopup(`<b>${geofence.name}</b><br>Radius: ${geofence.radius}m`);
  geofenceCircles[geofence.id] = circle;
}

// Update geofence list in UI
function updateGeofenceList(geofences) {
  const geofenceList = document.getElementById('geofence-list');
  if (!geofenceList) return;
  
  // Clear existing list
  geofenceList.innerHTML = '';
  
  if (geofences.length === 0) {
    geofenceList.innerHTML = '<p>No geofences set for this child.</p>';
    return;
  }
  
  // Create list
  const list = document.createElement('ul');
  list.className = 'geofence-list';
  
  geofences.forEach(geofence => {
    const listItem = document.createElement('li');
    listItem.className = 'geofence-item';
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'geofence-name';
    nameSpan.textContent = geofence.name;
    
    const radiusSpan = document.createElement('span');
    radiusSpan.className = 'geofence-radius';
    radiusSpan.textContent = `${geofence.radius}m`;
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-danger btn-sm';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', function() {
      deleteGeofence(geofence.id);
    });
    
    listItem.appendChild(nameSpan);
    listItem.appendChild(radiusSpan);
    listItem.appendChild(deleteBtn);
    list.appendChild(listItem);
    
    // Add click event to center map on this geofence
    listItem.addEventListener('click', function(e) {
      if (e.target !== deleteBtn) {
        map.setView([geofence.latitude, geofence.longitude], 15);
        if (geofenceCircles[geofence.id]) {
          geofenceCircles[geofence.id].openPopup();
        }
      }
    });
  });
  
  geofenceList.appendChild(list);
}

// Setup geofence controls
function setupGeofenceControls() {
  const addGeofenceBtn = document.getElementById('add-geofence-btn');
  if (!addGeofenceBtn) return;
  
  addGeofenceBtn.addEventListener('click', function() {
    // Toggle add geofence mode
    if (map.geofenceMode) {
      // Exit geofence mode
      map.geofenceMode = false;
      map.off('click', onMapClick);
      addGeofenceBtn.textContent = 'Add Geofence';
      addGeofenceBtn.classList.remove('active');
      
      // Hide the geofence form
      const geofenceForm = document.getElementById('geofence-form');
      if (geofenceForm) {
        geofenceForm.style.display = 'none';
      }
    } else {
      // Enter geofence mode
      map.geofenceMode = true;
      map.on('click', onMapClick);
      addGeofenceBtn.textContent = 'Cancel';
      addGeofenceBtn.classList.add('active');
      
      showAlert('Click on the map to place a geofence', 'info');
    }
  });
  
  // Setup geofence form submission
  const geofenceForm = document.getElementById('geofence-form');
  if (geofenceForm) {
    geofenceForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const name = document.getElementById('geofence-name').value;
      const radius = document.getElementById('geofence-radius').value;
      
      if (!name || !radius) {
        showAlert('Please enter a name and radius for the geofence', 'warning');
        return;
      }
      
      if (!map.geofenceLatLng) {
        showAlert('Please select a location on the map', 'warning');
        return;
      }
      
      // Create geofence
      createGeofence(name, map.geofenceLatLng.lat, map.geofenceLatLng.lng, radius);
      
      // Reset form and exit geofence mode
      geofenceForm.reset();
      geofenceForm.style.display = 'none';
      map.geofenceMode = false;
      map.off('click', onMapClick);
      addGeofenceBtn.textContent = 'Add Geofence';
      addGeofenceBtn.classList.remove('active');
      
      // Remove temporary marker
      if (map.tempMarker) {
        map.removeLayer(map.tempMarker);
        map.tempMarker = null;
      }
    });
  }
}

// Handle map click for adding geofence
function onMapClick(e) {
  // Store clicked location
  map.geofenceLatLng = e.latlng;
  
  // Add temporary marker
  if (map.tempMarker) {
    map.removeLayer(map.tempMarker);
  }
  
  map.tempMarker = L.marker(e.latlng).addTo(map);
  
  // Show geofence form
  const geofenceForm = document.getElementById('geofence-form');
  if (geofenceForm) {
    geofenceForm.style.display = 'block';
    document.getElementById('geofence-name').focus();
  }
}

// Create a new geofence
function createGeofence(name, latitude, longitude, radius) {
  fetch('/api/geofence/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      child_id: selectedChild,
      name: name,
      latitude: latitude,
      longitude: longitude,
      radius: radius
    }),
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      showAlert('Geofence created successfully', 'success');
      
      // Reload geofences
      loadGeofences(selectedChild);
    } else {
      showAlert('Error creating geofence', 'danger');
    }
  })
  .catch(error => {
    console.error('Error creating geofence:', error);
    showAlert('Error creating geofence', 'danger');
  });
}

// Delete a geofence
function deleteGeofence(geofenceId) {
  if (confirm('Are you sure you want to delete this geofence?')) {
    fetch(`/api/geofence/delete/${geofenceId}`, {
      method: 'POST'
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        showAlert('Geofence deleted successfully', 'success');
        
        // Remove from map
        if (geofenceCircles[geofenceId]) {
          map.removeLayer(geofenceCircles[geofenceId]);
          delete geofenceCircles[geofenceId];
        }
        
        // Reload geofences
        loadGeofences(selectedChild);
      } else {
        showAlert('Error deleting geofence', 'danger');
      }
    })
    .catch(error => {
      console.error('Error deleting geofence:', error);
      showAlert('Error deleting geofence', 'danger');
    });
  }
}

// Handle geofence violations (highlighted on map)
function highlightGeofenceViolation(geofenceId) {
  if (geofenceCircles[geofenceId]) {
    const circle = geofenceCircles[geofenceId];
    
    // Save original style
    if (!circle.originalStyle) {
      circle.originalStyle = {
        color: circle.options.color,
        fillColor: circle.options.fillColor,
        fillOpacity: circle.options.fillOpacity,
        weight: circle.options.weight
      };
    }
    
    // Change style to highlight
    circle.setStyle({
      color: '#dc3545',
      fillColor: '#dc3545',
      fillOpacity: 0.3,
      weight: 3
    });
    
    // Animate
    animateGeofence(circle);
    
    // Open popup
    circle.openPopup();
    
    // Reset style after 5 seconds
    setTimeout(() => {
      circle.setStyle(circle.originalStyle);
    }, 5000);
  }
}

// Animate geofence violation
function animateGeofence(circle) {
  let count = 0;
  const maxCount = 5;
  const interval = setInterval(() => {
    if (count >= maxCount) {
      clearInterval(interval);
      return;
    }
    
    circle.setStyle({
      fillOpacity: count % 2 === 0 ? 0.5 : 0.2
    });
    
    count++;
  }, 500);
}

// Show SOS alert on map
function showSosAlert(childId, latitude, longitude) {
  // Update child marker position if it exists
  if (childMarkers[childId]) {
    childMarkers[childId].setLatLng([latitude, longitude]);
    
    // Change marker style to indicate emergency
    const icon = childMarkers[childId].getIcon();
    icon.options.html = `<div class="child-marker sos" style="background-color: #dc3545; width: 16px; height: 16px; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 0 0 rgba(220, 53, 69, 0.4); animation: pulse 1.5s infinite;"></div>`;
    childMarkers[childId].setIcon(icon);
    
    // Pan to location
    map.setView([latitude, longitude], 15);
    
    // Open popup with SOS message
    childMarkers[childId].bindPopup(`<b>SOS EMERGENCY!</b><br>Location: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}<br>Time: ${new Date().toLocaleString()}`, { className: 'sos-popup' }).openPopup();
    
    // Add visual pulse effect on map
    const pulseCircle = L.circle([latitude, longitude], {
      radius: 100,
      color: '#dc3545',
      fillColor: '#dc3545',
      fillOpacity: 0.2,
      weight: 2
    }).addTo(map);
    
    // Animate the pulse
    animateSosPulse(pulseCircle);
  } else {
    // Create new marker if it doesn't exist
    const sosIcon = L.divIcon({
      html: `<div class="child-marker sos" style="background-color: #dc3545; width: 16px; height: 16px; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 0 0 rgba(220, 53, 69, 0.4); animation: pulse 1.5s infinite;"></div>`,
      className: 'child-marker-container',
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });
    
    childMarkers[childId] = L.marker([latitude, longitude], { icon: sosIcon }).addTo(map);
    childMarkers[childId].bindPopup(`<b>SOS EMERGENCY!</b><br>Location: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}<br>Time: ${new Date().toLocaleString()}`, { className: 'sos-popup' }).openPopup();
    
    // Pan to location
    map.setView([latitude, longitude], 15);
    
    // Add visual pulse effect on map
    const pulseCircle = L.circle([latitude, longitude], {
      radius: 100,
      color: '#dc3545',
      fillColor: '#dc3545',
      fillOpacity: 0.2,
      weight: 2
    }).addTo(map);
    
    // Animate the pulse
    animateSosPulse(pulseCircle);
  }
}

// Animate SOS pulse effect
function animateSosPulse(circle) {
  let radius = 100;
  let opacity = 0.5;
  const maxRadius = 1000;
  const interval = setInterval(() => {
    radius += 50;
    opacity -= 0.025;
    
    if (radius >= maxRadius || opacity <= 0) {
      map.removeLayer(circle);
      clearInterval(interval);
      return;
    }
    
    circle.setRadius(radius);
    circle.setStyle({
      fillOpacity: opacity,
      opacity: opacity * 2
    });
  }, 100);
}
