// Common functionality shared across the application

// Store user credentials for reuse across application
let currentUser = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
  // Check if user is logged in
  fetchUserData();
  
  // Setup logout functionality
  setupLogout();
  
  // Setup notification polling
  setupNotifications();
});

// Fetch current user data
function fetchUserData() {
  // Check if user ID is stored in session
  const userId = sessionStorage.getItem('userId');
  const userRole = sessionStorage.getItem('userRole');
  
  if (userId && userRole) {
    currentUser = {
      id: userId,
      role: userRole
    };
    
    // Update UI based on user role
    updateNavigation(userRole);
  }
}

// Setup logout functionality
function setupLogout() {
  const logoutLink = document.getElementById('logout-link');
  if (logoutLink) {
    logoutLink.addEventListener('click', function(e) {
      e.preventDefault();
      
      // Clear session storage
      sessionStorage.removeItem('userId');
      sessionStorage.removeItem('userRole');
      
      // Redirect to login page
      window.location.href = '/logout';
    });
  }
}

// Update navigation based on user role
function updateNavigation(role) {
  const navLinks = document.querySelectorAll('.navbar-link');
  
  navLinks.forEach(link => {
    // Check if link should be visible for current role
    const forRoles = link.getAttribute('data-roles');
    if (forRoles && !forRoles.includes(role)) {
      link.style.display = 'none';
    } else {
      link.style.display = 'block';
    }
    
    // Mark active link
    if (link.getAttribute('href') === window.location.pathname) {
      link.classList.add('active');
    }
  });
}

// Poll for notifications
function setupNotifications() {
  if (!currentUser) return;
  
  // Set up polling for notifications every 30 seconds
  fetchNotifications();
  setInterval(fetchNotifications, 30000);
}

// Fetch notifications from server
function fetchNotifications() {
  if (!currentUser) return;
  
  fetch('/api/notification/list')
    .then(response => response.json())
    .then(notifications => {
      updateNotificationBadge(notifications.filter(n => !n.is_read).length);
    })
    .catch(error => console.error('Error fetching notifications:', error));
}

// Update notification badge with unread count
function updateNotificationBadge(count) {
  const badge = document.getElementById('notification-badge');
  if (badge) {
    if (count > 0) {
      badge.textContent = count;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  }
}

// Utility function to format dates
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString();
}

// Utility function to format duration in seconds to readable format
function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

// Show notification/alert message
function showAlert(message, type = 'info') {
  const alertContainer = document.getElementById('alert-container');
  if (!alertContainer) return;
  
  const alert = document.createElement('div');
  alert.className = `alert alert-${type}`;
  alert.textContent = message;
  
  // Add close button
  const closeButton = document.createElement('button');
  closeButton.className = 'close-alert';
  closeButton.innerHTML = '&times;';
  closeButton.style.float = 'right';
  closeButton.style.cursor = 'pointer';
  closeButton.style.marginLeft = '10px';
  closeButton.onclick = function() {
    alertContainer.removeChild(alert);
  };
  
  alert.prepend(closeButton);
  alertContainer.appendChild(alert);
  
  // Auto remove after 5 seconds
  setTimeout(() => {
    if (alertContainer.contains(alert)) {
      alertContainer.removeChild(alert);
    }
  }, 5000);
}

// Setup WebSocket connection
let socket = null;

function connectWebSocket() {
  if (!currentUser) return;
  
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;
  
  socket = new WebSocket(wsUrl);
  
  socket.onopen = function() {
    console.log('WebSocket connection established');
    // Register user with the socket
    socket.send(JSON.stringify({
      type: 'register',
      data: {
        user_id: currentUser.id
      }
    }));
  };
  
  socket.onmessage = function(event) {
    const message = JSON.parse(event.data);
    handleSocketMessage(message);
  };
  
  socket.onclose = function() {
    console.log('WebSocket connection closed');
    // Try to reconnect after a delay
    setTimeout(connectWebSocket, 5000);
  };
  
  socket.onerror = function(error) {
    console.error('WebSocket error:', error);
  };
}

// Handle incoming WebSocket messages
function handleSocketMessage(message) {
  switch (message.type) {
    case 'new_message':
      handleNewMessage(message.data);
      break;
    case 'child_location_update':
      handleChildLocationUpdate(message.data);
      break;
    case 'geofence_violation':
      handleGeofenceViolation(message.data);
      break;
    case 'sos_emergency':
      handleSosEmergency(message.data);
      break;
    default:
      console.log('Unknown message type:', message.type);
  }
}

// Handle new chat message
function handleNewMessage(data) {
  // Increment notification badge
  const badge = document.getElementById('notification-badge');
  if (badge) {
    const count = parseInt(badge.textContent || '0') + 1;
    updateNotificationBadge(count);
  }
  
  // Play notification sound
  playNotificationSound();
  
  // Show notification
  showAlert(`New message from ${data.sender_name}`, 'info');
  
  // Update chat window if open
  updateChatWindow(data);
}

// Handle child location update
function handleChildLocationUpdate(data) {
  // Update map if on location page
  if (window.updateChildMarker) {
    window.updateChildMarker(data.child_id, data.latitude, data.longitude);
  }
}

// Handle geofence violation
function handleGeofenceViolation(data) {
  // Play alert sound
  playAlertSound();
  
  // Show notification
  showAlert(`ALERT: ${data.child_name} has left the ${data.geofence_name} area!`, 'warning');
  
  // Update map if on location page
  if (window.highlightGeofenceViolation) {
    window.highlightGeofenceViolation(data.geofence_id);
  }
}

// Handle SOS emergency
function handleSosEmergency(data) {
  // Play emergency sound
  playEmergencySound();
  
  // Show notification
  showAlert(`EMERGENCY: ${data.child_name} has triggered an SOS alert!`, 'danger');
  
  // Update map if on location page and coordinates are available
  if (window.showSosAlert && data.latitude && data.longitude) {
    window.showSosAlert(data.child_id, data.latitude, data.longitude);
  }
}

// Play notification sound
function playNotificationSound() {
  const audio = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-software-interface-alert-notification-256.mp3');
  audio.play();
}

// Play alert sound
function playAlertSound() {
  const audio = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-alarm-digital-clock-beep-989.mp3');
  audio.play();
}

// Play emergency sound
function playEmergencySound() {
  const audio = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-classic-alarm-995.mp3');
  audio.volume = 0.8;
  audio.play();
}

// Update chat window with new message if currently open
function updateChatWindow(messageData) {
  const chatMessages = document.getElementById('chat-messages');
  if (!chatMessages) return;
  
  // Check if this chat is currently open
  const activeChatId = chatMessages.getAttribute('data-user-id');
  if (activeChatId && activeChatId == messageData.sender_id) {
    addMessageToChat(messageData, false);
    
    // Mark as read
    fetch(`/api/message/mark_read/${messageData.message_id}`, {
      method: 'POST'
    });
  }
}

// Helper function for simulating app usage in prototype
function simulateAppUsage() {
  const apps = ['Facebook', 'Instagram', 'TikTok', 'YouTube', 'WhatsApp', 'Games', 'Chrome'];
  const randomApp = apps[Math.floor(Math.random() * apps.length)];
  const usageTime = Math.floor(Math.random() * 600) + 60; // 1-10 minutes in seconds
  
  fetch('/api/usage/log', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      app_name: randomApp,
      usage_time: usageTime
    }),
  })
  .then(response => response.json())
  .then(data => console.log('Simulated app usage logged'))
  .catch(error => console.error('Error logging app usage:', error));
}

// Helper function for simulating browsing history in prototype
function simulateBrowsingHistory() {
  const websites = [
    { url: 'https://www.google.com', title: 'Google' },
    { url: 'https://www.youtube.com', title: 'YouTube' },
    { url: 'https://www.wikipedia.org', title: 'Wikipedia' },
    { url: 'https://www.reddit.com', title: 'Reddit' },
    { url: 'https://www.twitter.com', title: 'Twitter' },
    { url: 'https://www.instagram.com', title: 'Instagram' },
    { url: 'https://www.amazon.com', title: 'Amazon' }
  ];
  
  const randomSite = websites[Math.floor(Math.random() * websites.length)];
  
  fetch('/api/browsing/log', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(randomSite),
  })
  .then(response => response.json())
  .then(data => console.log('Simulated browsing history logged'))
  .catch(error => console.error('Error logging browsing history:', error));
}

// Helper function to get current location
function getCurrentLocation(callback) {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      position => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        callback(latitude, longitude);
      },
      error => {
        console.error('Error getting location:', error);
        // Use default location for testing
        callback(40.7128, -74.0060); // New York City
      }
    );
  } else {
    console.error('Geolocation is not supported by this browser');
    // Use default location for testing
    callback(40.7128, -74.0060); // New York City
  }
}

// Helper function to update location periodically
function startLocationTracking() {
  // Update location every minute
  function updateLocation() {
    getCurrentLocation((latitude, longitude) => {
      fetch('/api/location/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          latitude,
          longitude
        }),
      })
      .then(response => response.json())
      .then(data => console.log('Location updated'))
      .catch(error => console.error('Error updating location:', error));
      
      // Send to WebSocket if connected
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: 'location_update',
          data: {
            user_id: currentUser.id,
            latitude,
            longitude
          }
        }));
      }
    });
  }
  
  // Update immediately and then periodically
  updateLocation();
  setInterval(updateLocation, 60000); // Every minute
}
