"""
Hyperion Resource Monitor - Machine Learning Integration Module

Provides machine learning capabilities for predictive resource management.
"""

import logging
import time
from typing import Any, Dict, List, Optional, Tuple, Union

logger = logging.getLogger(__name__)

# Try to import optional ML dependencies
try:
    import numpy as np
    HAS_NUMPY = True
except ImportError:
    HAS_NUMPY = False

try:
    from sklearn.linear_model import LinearRegression
    from sklearn.ensemble import RandomForestRegressor
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False


class MLIntegration:
    """
    Machine learning integration for predictive resource management
    
    Provides functionality including:
    - Resource usage prediction
    - Anomaly detection
    - Optimal worker count prediction
    - Adaptive timeout calculation
    """
    
    def __init__(self, min_samples: int = 100):
        self.min_samples = min_samples
        self.models = {}
        self.anomaly_thresholds = {}
        self.is_initialized = False
        self.supported = HAS_NUMPY and HAS_SKLEARN
        
        logger.info(f"ML integration initialized: supported={self.supported}")
        
        if not self.supported:
            logger.warning(
                "ML capabilities disabled. Install numpy and scikit-learn: "
                "pip install numpy scikit-learn"
            )
    
    def initialize(self, historical_data: List[Dict[str, Any]]):
        """
        Initialize ML models with historical data
        
        Args:
            historical_data: List of historical metric points
        """
        if not self.supported or len(historical_data) < self.min_samples:
            logger.warning(
                f"Cannot initialize ML models: "
                f"supported={self.supported}, samples={len(historical_data)}, min_required={self.min_samples}"
            )
            return False
        
        try:
            self._train_worker_predictor(historical_data)
            self._train_resource_predictor(historical_data)
            self._calculate_anomaly_thresholds(historical_data)
            self.is_initialized = True
            logger.info("ML models initialized successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize ML models: {str(e)}", exc_info=True)
            return False
    
    def _train_worker_predictor(self, historical_data: List[Dict[str, Any]]):
        """
        Train model to predict optimal worker count
        
        Args:
            historical_data: List of historical metric points
        """
        if not HAS_SKLEARN:
            return
        
        # Extract features and target
        X = []  # Features: cpu, memory, maybe custom metrics
        y = []  # Target: worker count
        
        for entry in historical_data:
            # Skip entries with missing data
            if not all(k in entry for k in ['cpu', 'memory', 'workers']):
                continue
                
            # Build feature vector
            features = [entry['cpu'], entry['memory']]
            
            # Add some derived features
            features.append(entry['cpu'] * entry['memory'])  # Interaction
            features.append(entry['cpu'] ** 2)  # Squared term
            
            X.append(features)
            y.append(entry['workers'])
        
        if len(X) < self.min_samples / 2:
            logger.warning(f"Insufficient samples for worker predictor: {len(X)}")
            return
        
        # Train random forest for worker prediction
        model = RandomForestRegressor(n_estimators=50, random_state=42)
        model.fit(X, y)
        
        # Store model
        self.models['worker_predictor'] = {
            'model': model,
            'feature_names': ['cpu', 'memory', 'cpu_memory_product', 'cpu_squared']
        }
    
    def _train_resource_predictor(self, historical_data: List[Dict[str, Any]]):
        """
        Train model to predict future resource usage
        
        Args:
            historical_data: List of historical metric points
        """
        if not HAS_SKLEARN or len(historical_data) < 20:
            return
        
        # Prepare time series data for CPU and memory
        timestamps = []
        cpu_values = []
        memory_values = []
        
        for entry in historical_data:
            if 'timestamp' in entry and 'cpu' in entry and 'memory' in entry:
                timestamps.append(entry['timestamp'])
                cpu_values.append(entry['cpu'])
                memory_values.append(entry['memory'])
        
        if len(timestamps) < 20:
            logger.warning("Insufficient time series data for resource prediction")
            return
        
        # Convert to numpy arrays
        timestamps = np.array(timestamps).reshape(-1, 1)
        cpu_values = np.array(cpu_values)
        memory_values = np.array(memory_values)
        
        # Train linear regression models
        cpu_model = LinearRegression()
        cpu_model.fit(timestamps, cpu_values)
        
        memory_model = LinearRegression()
        memory_model.fit(timestamps, memory_values)
        
        # Store models
        self.models['cpu_predictor'] = {
            'model': cpu_model,
            'mean': np.mean(cpu_values),
            'std': np.std(cpu_values)
        }
        
        self.models['memory_predictor'] = {
            'model': memory_model,
            'mean': np.mean(memory_values),
            'std': np.std(memory_values)
        }
    
    def _calculate_anomaly_thresholds(self, historical_data: List[Dict[str, Any]]):
        """
        Calculate thresholds for anomaly detection
        
        Args:
            historical_data: List of historical metric points
        """
        if not HAS_NUMPY:
            return
        
        # Extract metrics
        cpu_values = [entry.get('cpu', 0) for entry in historical_data if 'cpu' in entry]
        memory_values = [entry.get('memory', 0) for entry in historical_data if 'memory' in entry]
        
        # Calculate statistics
        if cpu_values:
            cpu_mean = np.mean(cpu_values)
            cpu_std = np.std(cpu_values)
            self.anomaly_thresholds['cpu'] = {
                'mean': float(cpu_mean),
                'std': float(cpu_std),
                'upper': float(cpu_mean + 2.5 * cpu_std),  # 2.5 sigma
                'lower': float(max(0, cpu_mean - 2.5 * cpu_std))
            }
        
        if memory_values:
            memory_mean = np.mean(memory_values)
            memory_std = np.std(memory_values)
            self.anomaly_thresholds['memory'] = {
                'mean': float(memory_mean),
                'std': float(memory_std),
                'upper': float(memory_mean + 2.5 * memory_std),
                'lower': float(max(0, memory_mean - 2.5 * memory_std))
            }
    
    def predict_optimal_workers(self, cpu_usage: float, memory_usage: float) -> Optional[int]:
        """
        Predict optimal worker count based on current metrics
        
        Args:
            cpu_usage: Current CPU usage (0-1)
            memory_usage: Current memory usage (0-1)
            
        Returns:
            Predicted optimal worker count or None if prediction not available
        """
        if not self.supported or not self.is_initialized:
            return None
            
        if 'worker_predictor' not in self.models:
            return None
            
        try:
            # Prepare feature vector
            features = [
                cpu_usage, 
                memory_usage, 
                cpu_usage * memory_usage,  # Interaction
                cpu_usage ** 2  # Squared term
            ]
            
            # Make prediction
            model_info = self.models['worker_predictor']
            prediction = model_info['model'].predict([features])[0]
            
            # Round to nearest integer and ensure at least 1
            return max(1, int(round(prediction)))
        except Exception as e:
            logger.warning(f"Worker prediction failed: {str(e)}")
            return None
    
    def predict_future_usage(self, minutes_ahead: int = 5) -> Dict[str, float]:
        """
        Predict future resource usage
        
        Args:
            minutes_ahead: Minutes in the future to predict
            
        Returns:
            Dictionary with predicted values
        """
        if not self.supported or not self.is_initialized:
            return {}
            
        if 'cpu_predictor' not in self.models or 'memory_predictor' not in self.models:
            return {}
            
        future_time = time.time() + (minutes_ahead * 60)
        
        try:
            # Make predictions
            cpu_model = self.models['cpu_predictor']['model']
            memory_model = self.models['memory_predictor']['model']
            
            cpu_prediction = float(cpu_model.predict([[future_time]])[0])
            memory_prediction = float(memory_model.predict([[future_time]])[0])
            
            # Ensure predictions are in valid range
            cpu_prediction = max(0.0, min(1.0, cpu_prediction))
            memory_prediction = max(0.0, min(1.0, memory_prediction))
            
            return {
                'cpu': cpu_prediction,
                'memory': memory_prediction,
                'time': future_time
            }
        except Exception as e:
            logger.warning(f"Resource prediction failed: {str(e)}")
            return {}
    
    def detect_anomalies(self, metrics: Dict[str, float]) -> Dict[str, Any]:
        """
        Detect anomalies in current metrics
        
        Args:
            metrics: Dictionary of current metrics
            
        Returns:
            Dictionary with anomaly detection results
        """
        if not self.supported or not self.anomaly_thresholds:
            return {}
            
        results = {
            'anomalies': [],
            'details': {}
        }
        
        # Check CPU usage anomaly
        if 'cpu' in metrics and 'cpu' in self.anomaly_thresholds:
            cpu_value = metrics['cpu']
            thresholds = self.anomaly_thresholds['cpu']
            
            is_anomaly = cpu_value > thresholds['upper'] or cpu_value < thresholds['lower']
            severity = 0
            
            if is_anomaly:
                # Calculate severity (0-1 scale)
                if cpu_value > thresholds['upper']:
                    deviation = cpu_value - thresholds['mean']
                    severity = min(1.0, deviation / (3 * thresholds['std']))
                else:
                    deviation = thresholds['mean'] - cpu_value
                    severity = min(1.0, deviation / (3 * thresholds['std']))
                
                results['anomalies'].append('cpu')
                
            results['details']['cpu'] = {
                'is_anomaly': is_anomaly,
                'value': cpu_value,
                'severity': severity,
                'thresholds': thresholds
            }
        
        # Check memory usage anomaly
        if 'memory' in metrics and 'memory' in self.anomaly_thresholds:
            memory_value = metrics['memory']
            thresholds = self.anomaly_thresholds['memory']
            
            is_anomaly = memory_value > thresholds['upper'] or memory_value < thresholds['lower']
            severity = 0
            
            if is_anomaly:
                # Calculate severity (0-1 scale)
                if memory_value > thresholds['upper']:
                    deviation = memory_value - thresholds['mean']
                    severity = min(1.0, deviation / (3 * thresholds['std']))
                else:
                    deviation = thresholds['mean'] - memory_value
                    severity = min(1.0, deviation / (3 * thresholds['std']))
                
                results['anomalies'].append('memory')
                
            results['details']['memory'] = {
                'is_anomaly': is_anomaly,
                'value': memory_value,
                'severity': severity,
                'thresholds': thresholds
            }
        
        return results
    
    def get_ml_recommendations(self, current_metrics: Dict[str, float]) -> Dict[str, Any]:
        """
        Get ML-based recommendations for resource optimization
        
        Args:
            current_metrics: Dictionary of current metrics
            
        Returns:
            Dictionary with recommendations
        """
        if not self.supported or not self.is_initialized:
            return {}
            
        recommendations = {}
        
        # Optimal worker count
        if 'cpu' in current_metrics and 'memory' in current_metrics:
            worker_prediction = self.predict_optimal_workers(
                current_metrics['cpu'], 
                current_metrics['memory']
            )
            
            if worker_prediction is not None:
                recommendations['optimal_workers'] = worker_prediction
        
        # Future resource usage
        future_usage = self.predict_future_usage(minutes_ahead=5)
        if future_usage:
            recommendations['future_usage'] = future_usage
            
            # Make recommendations based on predicted usage
            if 'cpu' in future_usage and 'memory' in future_usage:
                if future_usage['cpu'] > 0.8:
                    recommendations['cpu_warning'] = "CPU usage predicted to exceed 80% in 5 minutes"
                if future_usage['memory'] > 0.8:
                    recommendations['memory_warning'] = "Memory usage predicted to exceed 80% in 5 minutes"
        
        # Anomaly detection
        anomalies = self.detect_anomalies(current_metrics)
        if anomalies and anomalies.get('anomalies'):
            recommendations['anomalies'] = anomalies['anomalies']
            
            # Add anomaly-specific recommendations
            if 'cpu' in anomalies['anomalies']:
                severity = anomalies['details']['cpu']['severity']
                if severity > 0.7:
                    recommendations['critical_cpu_anomaly'] = "Critical CPU usage anomaly detected"
                    recommendations['cpu_action'] = "Reduce worker count immediately"
                elif severity > 0.3:
                    recommendations['cpu_anomaly'] = "Moderate CPU usage anomaly detected"
            
            if 'memory' in anomalies['anomalies']:
                severity = anomalies['details']['memory']['severity']
                if severity > 0.7:
                    recommendations['critical_memory_anomaly'] = "Critical memory usage anomaly detected"
                    recommendations['memory_action'] = "Reduce memory consumption immediately"
                elif severity > 0.3:
                    recommendations['memory_anomaly'] = "Moderate memory usage anomaly detected"
        
        return recommendations
