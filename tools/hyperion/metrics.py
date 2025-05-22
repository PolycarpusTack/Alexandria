"""
Hyperion Resource Monitor - Metrics and Reporting Module

Provides metrics collection, trend analysis, and reporting capabilities.
"""

import json
import logging
import time
from typing import Any, Callable, Dict, List, Optional, Union

try:
    import numpy as np
    HAS_NUMPY = True
except ImportError:
    HAS_NUMPY = False

logger = logging.getLogger(__name__)


class MetricsCollector:
    """
    Advanced metrics collection and analysis
    
    Provides functionality including:
    - Detailed resource metrics collection
    - Custom metric plugin support
    - Historical trend analysis
    - Export in multiple formats
    """
    
    def __init__(self, max_history: int = 1000):
        self.max_history = max_history
        self.start_time = time.time()
        
        # Metric collections
        self.metrics = {}
        self.historical_data = []
        self.custom_collectors = {}
        
        # Reset metrics to initialize structure
        self.reset_metrics()
        
        logger.info(f"Metrics collector initialized with {max_history} history limit")
    
    def reset_metrics(self):
        """Initialize or reset metrics structure"""
        self.metrics = {
            'cpu': {'current': 0.0, 'peak': 0.0, 'history': []},
            'memory': {'current': 0.0, 'peak': 0.0, 'history': []},
            'network': {'sent': 0, 'recv': 0, 'peak_sent': 0, 'peak_recv': 0, 'history': []},
            'disk': {'read': 0, 'write': 0, 'peak_read': 0, 'peak_write': 0, 'history': []},
            'workers': {'current': 0, 'peak': 0, 'history': []},
            'gpu': {},  # Placeholder for GPU metrics
            'custom': {}  # Placeholder for custom metrics
        }
    
    def register_custom_metric(self, name: str, collector: Callable, description: Optional[str] = None):
        """
        Register a custom metric collector function
        
        Args:
            name: Name of the custom metric
            collector: Function that returns the metric value
            description: Optional description of the metric
        """
        self.custom_collectors[name] = {
            'collector': collector, 
            'description': description or f"Custom metric: {name}"
        }
        
        # Initialize metric structure
        if name not in self.metrics['custom']:
            self.metrics['custom'][name] = {
                'current': 0.0,
                'peak': 0.0,
                'history': [],
                'description': description
            }
            
        logger.info(f"Custom metric registered: {name}")
    
    def update_metric(self, category: str, name: str, value: Union[float, int, Dict]):
        """
        Update a specific metric
        
        Args:
            category: Metric category (cpu, memory, etc.)
            name: Name of the specific metric
            value: New value to set
        """
        # Handle special case for custom metrics
        if category == 'custom':
            if name not in self.metrics['custom']:
                self.metrics['custom'][name] = {
                    'current': 0.0,
                    'peak': 0.0,
                    'history': []
                }
            target = self.metrics['custom'][name]
        else:
            # Standard metrics
            if category not in self.metrics:
                self.metrics[category] = {}
            if name not in self.metrics[category]:
                self.metrics[category][name] = 0.0
            target = self.metrics[category]
        
        # Handle different update types
        if isinstance(value, (int, float)):
            target['current'] = value
            # Update peak if needed
            if 'peak' in target and value > target['peak']:
                target['peak'] = value
        elif isinstance(value, dict):
            # For complex metrics, update the whole dict
            for k, v in value.items():
                target[k] = v
    
    def collect_all_metrics(self, monitor):
        """
        Collect all metrics from various sources
        
        Args:
            monitor: Hyperion monitor instance
        """
        timestamp = time.time()
        
        # Core system metrics
        self.update_metric('cpu', 'current', monitor._current_cpu)
        self.update_metric('memory', 'current', monitor._current_mem)
        self.update_metric('workers', 'current', monitor.current_workers)
        
        # Collect custom metrics
        for name, config in self.custom_collectors.items():
            try:
                value = config['collector']()
                self.update_metric('custom', name, value)
            except Exception as e:
                logger.warning(f"Failed to collect custom metric '{name}': {str(e)}")
        
        # Record historical snapshot
        self._store_historical(timestamp, monitor)
    
    def _store_historical(self, timestamp: float, monitor):
        """Store current metrics in historical data"""
        # Build historical entry with core metrics
        historical_entry = {
            'timestamp': timestamp,
            'cpu': monitor._current_cpu,
            'memory': monitor._current_mem,
            'workers': monitor.current_workers,
            'state': monitor._current_state,
            'environment': monitor.environment
        }
        
        # Add all custom metrics
        for name, metric in self.metrics['custom'].items():
            historical_entry[f"custom_{name}"] = metric['current']
        
        # Store the entry
        self.historical_data.append(historical_entry)
        
        # Also update the individual metric histories
        self.metrics['cpu']['history'].append((timestamp, monitor._current_cpu))
        self.metrics['memory']['history'].append((timestamp, monitor._current_mem))
        self.metrics['workers']['history'].append((timestamp, monitor.current_workers))
        
        # Update custom metric histories
        for name, metric in self.metrics['custom'].items():
            metric['history'].append((timestamp, metric['current']))
        
        # Trim histories if needed
        if len(self.historical_data) > self.max_history:
            self.historical_data = self.historical_data[-self.max_history:]
            
        # Trim individual metric histories
        for category in ['cpu', 'memory', 'workers']:
            if len(self.metrics[category]['history']) > self.max_history:
                self.metrics[category]['history'] = self.metrics[category]['history'][-self.max_history:]
                
        # Trim custom metric histories
        for name, metric in self.metrics['custom'].items():
            if len(metric['history']) > self.max_history:
                metric['history'] = metric['history