// Dashboard functionality for parent view
document.addEventListener('DOMContentLoaded', function() {
  // First check if we're on the dashboard page
  const dashboardContainer = document.getElementById('dashboard-container');
  if (!dashboardContainer) return;
  
  // Load child selector
  loadChildSelector();
  
  // Setup charts
  setupUsageCharts();
  
  // Load browsing history
  loadBrowsingHistory();
  
  // Setup refresh buttons
  setupRefreshButtons();
  
  // Start simulating app usage (for prototype demonstration)
  if (currentUser && currentUser.role === 'child') {
    // Simulate app usage every 3 minutes
    simulateAppUsage();
    setInterval(simulateAppUsage, 180000);
    
    // Simulate browsing history every 5 minutes
    simulateBrowsingHistory();
    setInterval(simulateBrowsingHistory, 300000);
  }
});

// Load child selector dropdown
function loadChildSelector() {
  const childSelector = document.getElementById('child-selector');
  if (!childSelector) return;
  
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
        childSelector.dispatchEvent(new Event('change'));
      }
    })
    .catch(error => console.error('Error loading children:', error));
  
  // Add change event listener
  childSelector.addEventListener('change', function() {
    const childId = this.value;
    loadChildData(childId);
  });
}

// Load data for selected child
function loadChildData(childId) {
  // Load app usage data
  loadAppUsageData(childId);
  
  // Load browsing history
  loadBrowsingHistory(childId);
  
  // Load screen time analytics
  loadScreenTimeAnalytics(childId);
}

// Set up usage charts
function setupUsageCharts() {
  // Set up app usage chart
  const appUsageCtx = document.getElementById('app-usage-chart');
  if (appUsageCtx) {
    window.appUsageChart = new Chart(appUsageCtx, {
      type: 'doughnut',
      data: {
        labels: [],
        datasets: [{
          data: [],
          backgroundColor: [
            '#4b6cb7',
            '#182848',
            '#1e3c72',
            '#2a5298',
            '#2e58a6',
            '#3a6fbf',
            '#4682b4'
          ],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
          },
          title: {
            display: true,
            text: 'App Usage Distribution'
          }
        }
      }
    });
  }
  
  // Set up weekly screen time chart
  const weeklyScreenTimeCtx = document.getElementById('weekly-screen-time-chart');
  if (weeklyScreenTimeCtx) {
    window.weeklyScreenTimeChart = new Chart(weeklyScreenTimeCtx, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [{
          label: 'Screen Time (hours)',
          data: [],
          backgroundColor: '#4b6cb7',
          borderColor: '#182848',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Hours'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Date'
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: 'Weekly Screen Time'
          }
        }
      }
    });
  }
}

// Load app usage data for a child
function loadAppUsageData(childId) {
  const date = new Date().toISOString().split('T')[0]; // Today's date in YYYY-MM-DD format
  
  fetch(`/api/usage/daily/${childId}?date=${date}`)
    .then(response => response.json())
    .then(data => {
      // Update app usage chart
      if (window.appUsageChart) {
        window.appUsageChart.data.labels = data.map(item => item.app_name);
        window.appUsageChart.data.datasets[0].data = data.map(item => item.usage_time / 60); // Convert seconds to minutes
        window.appUsageChart.update();
      }
      
      // Update app usage stats
      updateAppUsageStats(data);
    })
    .catch(error => console.error('Error loading app usage data:', error));
}

// Update app usage statistics
function updateAppUsageStats(data) {
  const totalUsageElement = document.getElementById('total-usage-time');
  const mostUsedAppElement = document.getElementById('most-used-app');
  
  if (!totalUsageElement || !mostUsedAppElement) return;
  
  // Calculate total usage time in seconds
  const totalSeconds = data.reduce((total, app) => total + app.usage_time, 0);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  
  totalUsageElement.textContent = `${hours}h ${minutes}m`;
  
  // Find most used app
  if (data.length > 0) {
    const mostUsedApp = data.reduce((prev, current) => 
      (prev.usage_time > current.usage_time) ? prev : current
    );
    
    const appMinutes = Math.floor(mostUsedApp.usage_time / 60);
    mostUsedAppElement.textContent = `${mostUsedApp.app_name} (${appMinutes} min)`;
  } else {
    mostUsedAppElement.textContent = 'No data available';
  }
}

// Load weekly screen time data
function loadScreenTimeAnalytics(childId) {
  fetch(`/api/usage/weekly/${childId}`)
    .then(response => response.json())
    .then(data => {
      // Update weekly screen time chart
      if (window.weeklyScreenTimeChart) {
        window.weeklyScreenTimeChart.data.labels = data.map(item => {
          const date = new Date(item.date);
          return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        });
        
        window.weeklyScreenTimeChart.data.datasets[0].data = data.map(item => item.total_time / 3600); // Convert seconds to hours
        window.weeklyScreenTimeChart.update();
      }
    })
    .catch(error => console.error('Error loading weekly screen time data:', error));
}

// Load browsing history
function loadBrowsingHistory(childId) {
  const historyContainer = document.getElementById('browsing-history');
  if (!historyContainer) return;
  
  // If no child ID provided, use the selected one
  if (!childId) {
    const childSelector = document.getElementById('child-selector');
    if (childSelector) {
      childId = childSelector.value;
    } else {
      return;
    }
  }
  
  fetch(`/api/browsing/history/${childId}?limit=10`)
    .then(response => response.json())
    .then(data => {
      // Clear container
      historyContainer.innerHTML = '';
      
      if (data.length === 0) {
        historyContainer.innerHTML = '<p>No browsing history available.</p>';
        return;
      }
      
      // Create list
      const list = document.createElement('ul');
      list.className = 'browsing-history-list';
      
      data.forEach(item => {
        const listItem = document.createElement('li');
        
        const link = document.createElement('a');
        link.href = '#'; // Don't make it clickable
        link.textContent = item.title || item.url;
        
        const time = document.createElement('span');
        time.className = 'history-time';
        time.textContent = new Date(item.visit_time).toLocaleString();
        
        listItem.appendChild(link);
        listItem.appendChild(time);
        list.appendChild(listItem);
      });
      
      historyContainer.appendChild(list);
    })
    .catch(error => console.error('Error loading browsing history:', error));
}

// Setup refresh buttons
function setupRefreshButtons() {
  const refreshUsageBtn = document.getElementById('refresh-usage-btn');
  if (refreshUsageBtn) {
    refreshUsageBtn.addEventListener('click', function() {
      const childSelector = document.getElementById('child-selector');
      if (childSelector) {
        loadAppUsageData(childSelector.value);
      }
    });
  }
  
  const refreshHistoryBtn = document.getElementById('refresh-history-btn');
  if (refreshHistoryBtn) {
    refreshHistoryBtn.addEventListener('click', function() {
      const childSelector = document.getElementById('child-selector');
      if (childSelector) {
        loadBrowsingHistory(childSelector.value);
      }
    });
  }
  
  const refreshScreenTimeBtn = document.getElementById('refresh-screen-time-btn');
  if (refreshScreenTimeBtn) {
    refreshScreenTimeBtn.addEventListener('click', function() {
      const childSelector = document.getElementById('child-selector');
      if (childSelector) {
        loadScreenTimeAnalytics(childSelector.value);
      }
    });
  }
}
