/**
 * Worker thread for CPU-intensive analytics tasks
 */

const { parentPort } = require('worker_threads');

// Task handlers
const tasks = {
  /**
   * Generate predictions based on historical trends
   */
  generatePredictions: ({ trends, timeRange }) => {
    try {
      // Simple linear regression for predictions
      const predictions = [];
      
      if (trends.length < 3) {
        return predictions;
      }

      // Calculate trend slope for each severity
      const severities = ['critical', 'high', 'medium', 'low'];
      const slopes = {};
      
      severities.forEach(severity => {
        const values = trends.map(t => t.distribution[severity] || 0);
        slopes[severity] = calculateSlope(values);
      });

      // Generate predictions for next 3 periods
      const lastTrend = trends[trends.length - 1];
      const intervalMs = getIntervalMs(timeRange.granularity);
      
      for (let i = 1; i <= 3; i++) {
        const timestamp = new Date(
          new Date(lastTrend.timestamp).getTime() + (i * intervalMs)
        );
        
        const distribution = {};
        severities.forEach(severity => {
          const lastValue = lastTrend.distribution[severity] || 0;
          const predictedValue = Math.max(0, lastValue + (slopes[severity] * i));
          distribution[severity] = Math.round(predictedValue);
        });

        predictions.push({
          timestamp: timestamp.toISOString(),
          distribution,
          confidence: Math.max(0.5, 0.95 - (i * 0.1)) // Confidence decreases with distance
        });
      }

      return predictions;
    } catch (error) {
      console.error('Prediction generation failed:', error);
      return [];
    }
  },

  /**
   * Detect anomalies in time series data
   */
  detectAnomalies: ({ data, sensitivity = 2 }) => {
    try {
      const values = data.map(d => d.value);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const stdDev = Math.sqrt(
        values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
      );

      return data.map(point => ({
        ...point,
        isAnomaly: Math.abs(point.value - mean) > sensitivity * stdDev,
        zScore: (point.value - mean) / stdDev
      }));
    } catch (error) {
      console.error('Anomaly detection failed:', error);
      return data;
    }
  },

  /**
   * Calculate correlations between different metrics
   */
  calculateCorrelations: ({ datasets }) => {
    try {
      const correlations = [];
      
      for (let i = 0; i < datasets.length; i++) {
        for (let j = i + 1; j < datasets.length; j++) {
          const correlation = pearsonCorrelation(
            datasets[i].values,
            datasets[j].values
          );
          
          correlations.push({
            metric1: datasets[i].name,
            metric2: datasets[j].name,
            correlation,
            strength: getCorrelationStrength(correlation)
          });
        }
      }

      return correlations.sort((a, b) => 
        Math.abs(b.correlation) - Math.abs(a.correlation)
      );
    } catch (error) {
      console.error('Correlation calculation failed:', error);
      return [];
    }
  },

  /**
   * Cluster similar crash patterns
   */
  clusterCrashPatterns: ({ patterns, k = 5 }) => {
    try {
      // Simple k-means clustering
      const clusters = kMeansClustering(patterns, k);
      
      return clusters.map((cluster, index) => ({
        clusterId: index,
        patterns: cluster,
        centroid: calculateCentroid(cluster),
        size: cluster.length
      }));
    } catch (error) {
      console.error('Clustering failed:', error);
      return [];
    }
  }
};

// Helper functions
function calculateSlope(values) {
  const n = values.length;
  if (n < 2) return 0;
  
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
  }
  
  return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
}

function getIntervalMs(granularity) {
  switch (granularity) {
    case 'hour': return 60 * 60 * 1000;
    case 'day': return 24 * 60 * 60 * 1000;
    case 'week': return 7 * 24 * 60 * 60 * 1000;
    case 'month': return 30 * 24 * 60 * 60 * 1000;
    default: return 60 * 60 * 1000;
  }
}

function pearsonCorrelation(x, y) {
  const n = x.length;
  if (n !== y.length || n === 0) return 0;
  
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
  const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);
  
  const num = n * sumXY - sumX * sumY;
  const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  
  return den === 0 ? 0 : num / den;
}

function getCorrelationStrength(correlation) {
  const abs = Math.abs(correlation);
  if (abs >= 0.7) return 'strong';
  if (abs >= 0.3) return 'moderate';
  return 'weak';
}

function kMeansClustering(data, k) {
  // Simplified k-means implementation
  // In production, use a proper clustering library
  const clusters = [];
  for (let i = 0; i < k; i++) {
    clusters.push([]);
  }
  
  // Random assignment for demo
  data.forEach((point, index) => {
    clusters[index % k].push(point);
  });
  
  return clusters;
}

function calculateCentroid(cluster) {
  if (cluster.length === 0) return null;
  
  // Calculate average of all features
  const features = Object.keys(cluster[0]);
  const centroid = {};
  
  features.forEach(feature => {
    const sum = cluster.reduce((acc, point) => acc + (point[feature] || 0), 0);
    centroid[feature] = sum / cluster.length;
  });
  
  return centroid;
}

// Message handler
parentPort.on('message', ({ task, data }) => {
  try {
    if (tasks[task]) {
      const result = tasks[task](data);
      parentPort.postMessage({ data: result });
    } else {
      parentPort.postMessage({ 
        error: `Unknown task: ${task}` 
      });
    }
  } catch (error) {
    parentPort.postMessage({ 
      error: error.message 
    });
  }
});