"""
Enterprise Code Factory 9000 Pro - Performance Utilities
-------------------------------------------------------
Utilities for tracking and optimizing performance of the application.
Combines functionality from both performance tracking modules.

Author: Claude (Enhanced)
Date: April 10, 2025
"""

import time
import logging
import functools
import threading
import traceback
from typing import Dict, List, Callable, Any, Optional, Union, Tuple
import statistics
from datetime import datetime

# Set up module logger
logger = logging.getLogger(__name__)

# Global performance registry
_performance_registry = {}
_registry_lock = threading.RLock()

class PerformanceMetric:
    """Stores performance metrics for a function"""
    
    def __init__(self, function_name: str, max_history: int = 100):
        """
        Initialize performance metrics tracking
        
        Args:
            function_name: Name of the function
            max_history: Maximum number of data points to keep
        """
        self.function_name = function_name
        self.call_count = 0
        self.total_time = 0.0
        self.min_time = float('inf')
        self.max_time = 0.0
        self.last_called = None
        self.average_time = 0.0
        self.success_count = 0
        self.failure_count = 0
        self.history = []
        self.max_history = max_history
    
    def record_call(self, duration: float, success: bool = True, metadata: Optional[Dict[str, Any]] = None):
        """
        Record a function call with performance data
        
        Args:
            duration: Duration of call in seconds
            success: Whether the call was successful
            metadata: Additional call metadata
        """
        self.call_count += 1
        
        if success:
            self.success_count += 1
        else:
            self.failure_count += 1
            
        self.total_time += duration
        self.min_time = min(self.min_time, duration)
        self.max_time = max(self.max_time, duration)
        self.last_called = datetime.now()
        self.average_time = self.total_time / self.call_count
        
        # Record history
        history_entry = {
            "timestamp": datetime.now().isoformat(),
            "duration": duration,
            "success": success
        }
        
        if metadata:
            history_entry["metadata"] = metadata
            
        self.history.append(history_entry)
        
        # Trim history if needed
        if len(self.history) > self.max_history:
            self.history = self.history[-self.max_history:]
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert metrics to dictionary"""
        result = {
            "function_name": self.function_name,
            "call_count": self.call_count,
            "success_count": self.success_count,
            "failure_count": self.failure_count,
            "success_rate": (self.success_count / self.call_count * 100) if self.call_count > 0 else 0,
            "total_time": round(self.total_time, 4),
            "min_time": round(self.min_time, 4) if self.min_time != float('inf') else 0,
            "max_time": round(self.max_time, 4),
            "average_time": round(self.average_time, 4),
            "last_called": str(self.last_called) if self.last_called else None
        }
        
        # Calculate percentiles if enough data
        if len(self.history) >= 10:
            durations = [entry["duration"] for entry in self.history]
            sorted_durations = sorted(durations)
            result["median_time"] = round(statistics.median(durations), 4)
            result["p90_time"] = round(sorted_durations[int(len(sorted_durations) * 0.9)], 4)
            result["p95_time"] = round(sorted_durations[int(len(sorted_durations) * 0.95)], 4)
        
        return result
    
    def __str__(self) -> str:
        """String representation of metrics"""
        success_rate = (self.success_count / self.call_count * 100) if self.call_count > 0 else 0
        return (f"{self.function_name}: {self.call_count} calls, "
                f"avg: {self.average_time:.4f}s, min: {self.min_time:.4f}s, "
                f"max: {self.max_time:.4f}s, success rate: {success_rate:.1f}%")


def track_performance(threshold: Optional[float] = None, 
                     log_level: int = logging.DEBUG,
                     include_args: bool = False):
    """
    Decorator to track function performance
    
    Args:
        threshold: Optional time threshold in seconds to log warnings for slow calls
        log_level: Logging level for regular performance logs
        include_args: Whether to include function arguments in metrics
        
    Returns:
        Decorated function
    """
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            # Get function name
            func_name = f"{func.__module__}.{func.__qualname__}"
            
            # Start timer
            start_time = time.perf_counter()
            
            # Prepare metadata if needed
            metadata = None
            if include_args:
                # Limit argument recording for large inputs
                safe_args = [str(arg)[:100] + '...' if isinstance(arg, (str, bytes)) and len(str(arg)) > 100 
                            else arg for arg in args]
                safe_kwargs = {k: v[:100] + '...' if isinstance(v, (str, bytes)) and len(str(v)) > 100 
                              else v for k, v in kwargs.items()}
                
                metadata = {
                    "args": str(safe_args),
                    "kwargs": str(safe_kwargs)
                }
            
            success = True
            result = None
            
            try:
                # Call the function
                result = func(*args, **kwargs)
                
                # Add result type to metadata if available
                if metadata is not None and result is not None:
                    metadata["result_type"] = type(result).__name__
                    
                return result
            except Exception as e:
                success = False
                if metadata is not None:
                    metadata["error"] = str(e)
                    metadata["traceback"] = traceback.format_exc()
                raise
            finally:
                # Calculate duration
                duration = time.perf_counter() - start_time
                
                # Log performance
                if threshold and duration > threshold:
                    logger.warning(f"SLOW PERFORMANCE: {func_name} took {duration:.4f}s "
                                  f"(threshold: {threshold:.4f}s)")
                else:
                    logger.log(log_level, f"{func_name} took {duration:.4f}s")
                
                # Record metrics
                with _registry_lock:
                    if func_name not in _performance_registry:
                        _performance_registry[func_name] = PerformanceMetric(func_name)
                    
                    _performance_registry[func_name].record_call(duration, success, metadata)
        
        return wrapper
    
    return decorator


def track_method_performance(threshold: Optional[float] = None,
                          log_level: int = logging.DEBUG,
                          include_args: bool = False):
    """
    Decorator specifically for class methods that includes class instance info
    
    Args:
        threshold: Optional time threshold in seconds to log warnings for slow calls
        log_level: Logging level for regular performance logs
        include_args: Whether to include method arguments in metrics
        
    Returns:
        Decorated method
    """
    def decorator(method):
        @functools.wraps(method)
        def wrapper(self, *args, **kwargs):
            # Get class and method names
            class_name = self.__class__.__name__
            method_name = method.__name__
            full_name = f"{class_name}.{method_name}"
            
            # Start timer
            start_time = time.perf_counter()
            
            # Prepare metadata if needed
            metadata = None
            if include_args:
                # Limit argument recording for large inputs
                safe_args = [str(arg)[:100] + '...' if isinstance(arg, (str, bytes)) and len(str(arg)) > 100 
                            else arg for arg in args]
                safe_kwargs = {k: v[:100] + '...' if isinstance(v, (str, bytes)) and len(str(v)) > 100 
                              else v for k, v in kwargs.items()}
                
                metadata = {
                    "instance_id": id(self),
                    "instance_type": class_name,
                    "args": str(safe_args),
                    "kwargs": str(safe_kwargs)
                }
            
            success = True
            result = None
            
            try:
                # Call the method
                result = method(self, *args, **kwargs)
                
                # Add result type to metadata if available
                if metadata is not None and result is not None:
                    metadata["result_type"] = type(result).__name__
                    
                return result
            except Exception as e:
                success = False
                if metadata is not None:
                    metadata["error"] = str(e)
                    metadata["traceback"] = traceback.format_exc()
                raise
            finally:
                # Calculate duration
                duration = time.perf_counter() - start_time
                
                # Log performance
                if threshold and duration > threshold:
                    logger.warning(f"SLOW PERFORMANCE: {full_name} took {duration:.4f}s "
                                  f"(threshold: {threshold:.4f}s)")
                else:
                    logger.log(log_level, f"{full_name} took {duration:.4f}s")
                
                # Record metrics
                with _registry_lock:
                    if full_name not in _performance_registry:
                        _performance_registry[full_name] = PerformanceMetric(full_name)
                    
                    _performance_registry[full_name].record_call(duration, success, metadata)
        
        return wrapper
    
    return decorator


def get_performance_metrics() -> List[Dict[str, Any]]:
    """
    Get all recorded performance metrics
    
    Returns:
        List of performance metric dictionaries
    """
    with _registry_lock:
        return [metric.to_dict() for metric in _performance_registry.values()]


def get_slowest_functions(limit: int = 10) -> List[Dict[str, Any]]:
    """
    Get the slowest functions by average execution time
    
    Args:
        limit: Maximum number of functions to return
        
    Returns:
        List of slowest function metrics
    """
    with _registry_lock:
        metrics = list(_performance_registry.values())
        metrics.sort(key=lambda m: m.average_time, reverse=True)
        return [metric.to_dict() for metric in metrics[:limit]]


def reset_performance_metrics(function_name: Optional[str] = None):
    """
    Reset performance metrics
    
    Args:
        function_name: Optional name of function to reset metrics for, or all if None
    """
    with _registry_lock:
        if function_name:
            if function_name in _performance_registry:
                del _performance_registry[function_name]
        else:
            _performance_registry.clear()


def log_performance_summary(threshold_percent: float = 5.0):
    """
    Log a summary of performance metrics, highlighting functions that take
    more than threshold_percent of the total execution time
    
    Args:
        threshold_percent: Percentage threshold to highlight slow functions
    """
    with _registry_lock:
        if not _performance_registry:
            logger.info("No performance metrics recorded")
            return
        
        # Calculate total execution time
        total_time = sum(metric.total_time for metric in _performance_registry.values())
        
        # Sort metrics by total time
        metrics = list(_performance_registry.values())
        metrics.sort(key=lambda m: m.total_time, reverse=True)
        
        # Log summary
        logger.info(f"Performance Summary - Total execution time: {total_time:.4f}s")
        
        for metric in metrics:
            percent = (metric.total_time / total_time) * 100 if total_time > 0 else 0
            success_rate = (metric.success_count / metric.call_count * 100) if metric.call_count > 0 else 0
            
            if percent >= threshold_percent:
                logger.warning(f"HOTSPOT: {metric.function_name}: {percent:.1f}% "
                              f"of total time ({metric.total_time:.4f}s, {metric.call_count} calls, "
                              f"{success_rate:.1f}% success)")
            else:
                logger.info(f"{metric.function_name}: {percent:.1f}% "
                           f"({metric.total_time:.4f}s, {metric.call_count} calls, "
                           f"{success_rate:.1f}% success)")


class MemoryWatcher:
    """Monitors memory usage of the application"""
    
    def __init__(self, check_interval: float = 60.0, warning_threshold_mb: float = 500):
        """
        Initialize memory watcher
        
        Args:
            check_interval: Interval between checks in seconds
            warning_threshold_mb: Memory usage threshold for warnings in MB
        """
        self.check_interval = check_interval
        self.warning_threshold_mb = warning_threshold_mb
        self.running = False
        self.thread = None
        self.memory_history = []
        self.max_history = 100
    
    def start(self) -> None:
        """Start memory monitoring"""
        if self.running:
            return
            
        self.running = True
        self.thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self.thread.start()
        logger.info(f"Memory watcher started (interval: {self.check_interval}s, "
                   f"threshold: {self.warning_threshold_mb}MB)")
    
    def stop(self) -> None:
        """Stop memory monitoring"""
        self.running = False
        if self.thread:
            self.thread.join(timeout=1.0)
            self.thread = None
    
    def _monitor_loop(self) -> None:
        """Main monitoring loop"""
        while self.running:
            try:
                memory_usage = self._get_memory_usage()
                self._record_memory_usage(memory_usage)
                
                # Check threshold
                if memory_usage > self.warning_threshold_mb:
                    logger.warning(f"High memory usage: {memory_usage:.1f}MB "
                                 f"(threshold: {self.warning_threshold_mb}MB)")
            except Exception as e:
                logger.error(f"Error in memory monitoring: {str(e)}")
            
            # Wait for next check
            time.sleep(self.check_interval)
    
    def _get_memory_usage(self) -> float:
        """
        Get current memory usage in MB
        
        Returns:
            Memory usage in MB
        """
        try:
            import os
            import psutil
            
            # Get process
            process = psutil.Process(os.getpid())
            
            # Get memory info
            memory_info = process.memory_info()
            
            # Return memory usage in MB
            return memory_info.rss / (1024 * 1024)
        except ImportError:
            # Fallback if psutil not available
            logger.warning("psutil not available, using fallback memory tracking")
            import resource
            usage = resource.getrusage(resource.RUSAGE_SELF)
            return usage.ru_maxrss / 1024  # Convert KB to MB
    
    def _record_memory_usage(self, memory_mb: float) -> None:
        """
        Record memory usage data point
        
        Args:
            memory_mb: Memory usage in MB
        """
        timestamp = datetime.now().isoformat()
        self.memory_history.append({"timestamp": timestamp, "memory_mb": memory_mb})
        
        # Trim history if needed
        if len(self.memory_history) > self.max_history:
            self.memory_history = self.memory_history[-self.max_history:]
    
    def get_memory_usage(self) -> Dict[str, Any]:
        """
        Get current memory usage statistics
        
        Returns:
            Dictionary with memory usage statistics
        """
        try:
            current = self._get_memory_usage()
            
            result = {
                "current_mb": current,
                "timestamp": datetime.now().isoformat()
            }
            
            # Add statistics if we have history
            if self.memory_history:
                memory_values = [entry["memory_mb"] for entry in self.memory_history]
                result.update({
                    "average_mb": statistics.mean(memory_values),
                    "max_mb": max(memory_values),
                    "min_mb": min(memory_values)
                })
                
                # Add recent history
                result["history"] = self.memory_history[-10:]
            
            return result
        except Exception as e:
            logger.error(f"Error getting memory usage: {str(e)}")
            return {"error": str(e)}
            
    def cleanup_resources(self) -> None:
        """
        Force garbage collection and attempt to free memory
        """
        try:
            import gc
            # Run garbage collection
            gc.collect()
            logger.info("Garbage collection completed")
        except Exception as e:
            logger.error(f"Error during garbage collection: {str(e)}")


class ResourceManager:
    """Manages application resources and ensures proper cleanup"""
    
    def __init__(self):
        """Initialize the resource manager"""
        self._resources = {}
        self._lock = threading.RLock()
    
    def register(self, resource_id: str, cleanup_func: Callable) -> None:
        """
        Register a resource for cleanup
        
        Args:
            resource_id: Unique identifier for the resource
            cleanup_func: Function to call for cleanup
        """
        with self._lock:
            self._resources[resource_id] = cleanup_func
    
    def unregister(self, resource_id: str) -> None:
        """
        Unregister a resource
        
        Args:
            resource_id: Resource identifier
        """
        with self._lock:
            if resource_id in self._resources:
                del self._resources[resource_id]
    
    def cleanup_all(self) -> None:
        """Clean up all registered resources"""
        with self._lock:
            errors = []
            
            for resource_id, cleanup_func in self._resources.items():
                try:
                    cleanup_func()
                except Exception as e:
                    errors.append(f"Error cleaning up {resource_id}: {str(e)}")
            
            self._resources.clear()
            
            if errors:
                for error in errors:
                    logger.error(error)
                raise RuntimeError(f"Errors during resource cleanup: {len(errors)} errors")


# Create global instances
memory_watcher = MemoryWatcher()
resource_manager = ResourceManager()


def retry_on_failure(max_attempts: int = 3, delay: float = 1.0):
    """
    Decorator to retry a function on failure with exponential backoff
    
    Args:
        max_attempts: Maximum number of retry attempts
        delay: Initial delay between retries in seconds (will be doubled each retry)
        
    Returns:
        Decorated function
    """
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            attempts = 0
            while attempts < max_attempts:
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    attempts += 1
                    if attempts == max_attempts:
                        logger.error(f"Function {func.__name__} failed after {max_attempts} attempts: {str(e)}")
                        raise
                    logger.warning(f"Attempt {attempts} failed for {func.__name__}, retrying after {delay * (2 ** attempts)} seconds...")
                    time.sleep(delay * (2 ** attempts))
        return wrapper
    return decorator


def init_performance_monitoring():
    """Initialize performance monitoring"""
    # Start memory watcher
    memory_watcher.start()
    logger.info("Performance monitoring initialized")


def shutdown_performance_monitoring():
    """Shutdown performance monitoring and clean up resources"""
    # Stop memory watcher
    memory_watcher.stop()
    
    # Clean up resources
    resource_manager.cleanup_all()
    
    # Log performance summary
    log_performance_summary()
    
    logger.info("Performance monitoring shut down")
