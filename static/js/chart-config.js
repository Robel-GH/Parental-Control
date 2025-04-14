// Chart.js configurations for various charts used in the application

// Setup color schemes
const chartColors = {
  primary: '#4b6cb7',
  secondary: '#182848',
  success: '#28a745',
  danger: '#dc3545',
  warning: '#ffc107',
  info: '#17a2b8',
  light: '#f8f9fa',
  dark: '#343a40',
  primaryGradient: ['#4b6cb7', '#182848'],
  palette: [
    '#4b6cb7',
    '#182848',
    '#1e3c72',
    '#2a5298',
    '#2e58a6',
    '#3a6fbf',
    '#4682b4'
  ]
};

// Common chart options
const commonOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: {
    duration: 1000,
    easing: 'easeOutQuart'
  },
  plugins: {
    legend: {
      labels: {
        boxWidth: 12,
        padding: 15,
        font: {
          family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
          size: 12
        }
      }
    },
    tooltip: {
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      titleFont: {
        family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        size: 14,
        weight: 'bold'
      },
      bodyFont: {
        family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        size: 13
      },
      padding: 10,
      cornerRadius: 4,
      displayColors: true
    },
    title: {
      font: {
        family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        size: 16,
        weight: 'bold'
      },
      padding: {
        top: 10,
        bottom: 20
      }
    }
  }
};

// App usage doughnut chart configuration
function createAppUsageConfig(labels, data) {
  return {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: chartColors.palette,
        borderColor: '#ffffff',
        borderWidth: 2,
        hoverOffset: 10
      }]
    },
    options: {
      ...commonOptions,
      cutout: '65%',
      plugins: {
        ...commonOptions.plugins,
        title: {
          ...commonOptions.plugins.title,
          display: true,
          text: 'App Usage Distribution'
        },
        legend: {
          position: 'right',
          ...commonOptions.plugins.legend
        }
      }
    }
  };
}

// Weekly screen time bar chart configuration
function createWeeklyScreenTimeConfig(labels, data) {
  return {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Screen Time (hours)',
        data: data,
        backgroundColor: chartColors.primary,
        borderColor: chartColors.secondary,
        borderWidth: 1,
        borderRadius: 4,
        barThickness: 25,
        maxBarThickness: 35
      }]
    },
    options: {
      ...commonOptions,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            font: {
              family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
              size: 12
            },
            padding: 8,
            callback: function(value) {
              return value + 'h';
            }
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.05)',
            drawBorder: false
          },
          border: {
            display: false
          },
          title: {
            display: true,
            text: 'Hours',
            font: {
              family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
              size: 14
            },
            padding: {
              bottom: 10
            }
          }
        },
        x: {
          ticks: {
            font: {
              family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
              size: 12
            },
            padding: 8
          },
          grid: {
            display: false,
            drawBorder: false
          },
          title: {
            display: true,
            text: 'Day',
            font: {
              family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
              size: 14
            },
            padding: {
              top: 10
            }
          }
        }
      },
      plugins: {
        ...commonOptions.plugins,
        title: {
          ...commonOptions.plugins.title,
          display: true,
          text: 'Weekly Screen Time'
        }
      }
    }
  };
}

// Daily app usage line chart configuration
function createDailyUsageConfig(labels, datasets) {
  return {
    type: 'line',
    data: {
      labels: labels,
      datasets: datasets.map((dataset, index) => ({
        label: dataset.label,
        data: dataset.data,
        backgroundColor: chartColors.palette[index % chartColors.palette.length],
        borderColor: chartColors.palette[index % chartColors.palette.length],
        borderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.3,
        fill: false
      }))
    },
    options: {
      ...commonOptions,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            font: {
              family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
              size: 12
            },
            padding: 8,
            callback: function(value) {
              return value + 'm';
            }
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.05)',
            drawBorder: false
          },
          border: {
            display: false
          },
          title: {
            display: true,
            text: 'Minutes',
            font: {
              family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
              size: 14
            },
            padding: {
              bottom: 10
            }
          }
        },
        x: {
          ticks: {
            font: {
              family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
              size: 12
            },
            padding: 8
          },
          grid: {
            display: false,
            drawBorder: false
          },
          title: {
            display: true,
            text: 'Hour',
            font: {
              family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
              size: 14
            },
            padding: {
              top: 10
            }
          }
        }
      },
      plugins: {
        ...commonOptions.plugins,
        title: {
          ...commonOptions.plugins.title,
          display: true,
          text: 'Daily App Usage'
        }
      }
    }
  };
}

// Helper function to create gradient backgrounds
function createGradient(ctx, colorStart, colorEnd) {
  const gradient = ctx.createLinearGradient(0, 0, 0, 400);
  gradient.addColorStop(0, colorStart);
  gradient.addColorStop(1, colorEnd);
  return gradient;
}

// Export chart configuration creators
window.chartConfigs = {
  createAppUsageConfig,
  createWeeklyScreenTimeConfig,
  createDailyUsageConfig,
  chartColors,
  createGradient
};
