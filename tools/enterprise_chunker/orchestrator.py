"""
Orchestration layer for intelligent parallel chunking strategies.

This module provides an intelligent orchestration layer that automatically selects
between different chunking implementations based on content characteristics,
system resources, and performance metrics.
"""

import os
import time
import logging
import platform
import threading
import gc
import traceback
import math  # Added import for math module used in _estimate_complexity
from typing import (
    List, Dict, Any, Optional, Generator, Callable, Union, TypeVar,
    Tuple, Deque, NamedTuple
)
from threading import RLock, Event, Condition
from dataclasses import dataclass, field
from contextlib import contextmanager
from concurrent.futures import TimeoutError, CancelledError
from collections import deque
import statistics

# Import core chunking implementations
from enterprise_chunker.utils.parallel_processing import ParallelChunker as SimpleParallelChunker
from enterprise_chunker.models.enums import ChunkingStrategy
from enterprise_chunker.config import ChunkingOptions

# Import utilities from the existing modules
from enterprise_chunker.utils.memory_optimization import MemoryManager, MemoryMonitor
from enterprise_chunker.utils.optimized_streaming import StreamingBuffer
from enterprise_chunker.utils.token_estimation import estimate_tokens, TokenEstimationStrategy
from enterprise_chunker.utils.format_detection import detect_content_format, ContentFormat

# Optional imports
try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    psutil = None
    HAS_PSUTIL = False
    logging.warning("psutil not installed; resource monitoring will be limited")

try:
    import numpy as np
    HAS_NUMPY = True
except ImportError:
    HAS_NUMPY = False
    logging.warning("numpy not installed; advanced analytics will be limited")

try:
    from prometheus_client import start_http_server, Gauge, Counter, Summary
    HAS_PROMETHEUS = True
except ImportError:
    HAS_PROMETHEUS = False

# Configure logging
logger = logging.getLogger(__name__)

# Type variables and protocols
T = TypeVar('T')
ChunkerFunc = Callable[[str], List[str]]

# Constants
DEFAULT_TIMEOUT = 300.0  # 5 minutes
MAX_RETRIES = 3
MEMORY_SAFETY_MARGIN = 0.15  # 15% safety margin for memory usage
BACKPRESSURE_THRESHOLD = 1000
HEALTH_CHECK_INTERVAL = 10.0  # seconds
DEFAULT_BATCH_SIZE = 5
MAX_BATCH_SIZE = 20
DYNAMIC_SCALING_THRESHOLD = 0.75
PROCESS_MEMORY_LIMIT = 2 * (1024 ** 3)  # 2GB per process
THREAD_STACK_SIZE = 4 * (1024 ** 2)  # 4MB

# Priority levels for QoS
PRIORITY_LEVELS = {
    'high': {'timeout': 60, 'retries': 5, 'batch_size_multiplier': 0.5},
    'normal': {'timeout': DEFAULT_TIMEOUT, 'retries': MAX_RETRIES, 'batch_size_multiplier': 1.0},
    'background': {'timeout': DEFAULT_TIMEOUT * 2, 'retries': 1, 'batch_size_multiplier': 1.5}
}

# Initialize Prometheus metrics if available
if HAS_PROMETHEUS:
    CHUNKER_METRICS = {
        'throughput': Gauge('chunker_throughput', 'Chunks processed per second'),
        'memory_usage': Gauge('chunker_memory', 'Memory usage percentage'),
        'worker_util': Gauge('chunker_workers', 'Worker utilization percentage'),
        'processing_time': Summary('chunker_processing_time', 'Time to process text'),
        'error_count': Counter('chunker_errors', 'Number of processing errors'),
        'retry_count': Counter('chunker_retries', 'Number of retry attempts'),
        'batch_size': Gauge('chunker_batch_size', 'Current batch size')
    }


# Custom exceptions
class ChunkerError(Exception):
    """Base exception for chunker errors"""
    pass

class MemorySafetyError(ChunkerError):
    """Exception raised when memory safety limits would be exceeded"""
    pass

class CircuitBreakerError(ChunkerError):
    """Exception raised when circuit breaker is open"""
    pass

class TimeoutExceededError(ChunkerError):
    """Exception raised when timeout is exceeded"""
    pass


@dataclass
class HealthCheckResult:
    """Result of a system health check"""
    success: bool
    duration: float = 0.0
    error: Optional[str] = None
    memory_usage: float = 0.0
    cpu_usage: float = 0.0


@dataclass
class ResourceInfo:
    """System resource information with container awareness"""
    cpu_count: int 
    logical_cores: int
    system_load: float = 0.0
    memory_total: int = 0
    memory_available: int = 0
    memory_percent: float = 0.0
    swap_percent: float = 0.0
    io_wait: float = 0.0
    disk_usage: float = 0.0
    
    @staticmethod
    def safe_cpu_count() -> int:
        """Robust CPU count with container awareness"""
        try:
            # Check cgroup constraints for containerized environments (Linux)
            if platform.system() == "Linux":
                # Check for cgroups v2
                if os.path.exists("/sys/fs/cgroup/cpu.max"):
                    try:
                        with open("/sys/fs/cgroup/cpu.max") as f:
                            content = f.read().strip()
                            if content != "max":
                                quota, period = map(int, content.split())
                                if quota > 0 and period > 0:
                                    return max(1, quota // period)
                    except (IOError, ValueError):
                        pass
                
                # Check for cgroups v1
                if os.path.exists("/sys/fs/cgroup/cpu/cpu.cfs_quota_us"):
                    try:
                        with open("/sys/fs/cgroup/cpu/cpu.cfs_quota_us") as f:
                            quota = int(f.read())
                        if quota != -1:
                            with open("/sys/fs/cgroup/cpu/cpu.cfs_period_us") as f:
                                period = int(f.read())
                            return max(1, quota // period)
                    except (IOError, ValueError):
                        pass
            
            # Fallback to standard detection
            return os.cpu_count() or 4
        except Exception as e:
            logger.warning(f"Error detecting CPU count: {e}")
            return 4
    
    @classmethod
    def detect(cls) -> 'ResourceInfo':
        """Detect system resources with container awareness"""
        # Enhanced CPU detection
        cpu_count = cls.safe_cpu_count()
        logical_cores = cpu_count  # Default if psutil not available
        
        memory_total = 0
        memory_available = 0
        memory_percent = 0.0
        swap_percent = 0.0
        io_wait = 0.0
        system_load = 0.0
        disk_usage = 0.0
        
        # Enhanced detection with psutil if available
        if HAS_PSUTIL:
            try:
                logical_cores = psutil.cpu_count(logical=True) or logical_cores
                
                # Get memory info
                vm = psutil.virtual_memory()
                memory_total = vm.total
                memory_available = vm.available
                memory_percent = vm.percent
                
                # Check for swap
                try:
                    swap = psutil.swap_memory()
                    swap_percent = swap.percent
                except Exception:
                    pass
                
                # Get system load
                try:
                    if hasattr(psutil, 'getloadavg'):
                        load = psutil.getloadavg()
                        system_load = load[0] / logical_cores
                    elif platform.system() != 'Windows':
                        # Fallback for Unix-like systems
                        try:
                            with open('/proc/loadavg', 'r') as f:
                                system_load = float(f.read().split()[0]) / logical_cores
                        except (IOError, ValueError):
                            pass
                except Exception:
                    pass
                
                # Get IO wait time from CPU stats if available
                try:
                    cpu_times = psutil.cpu_times_percent()
                    if hasattr(cpu_times, 'iowait'):
                        io_wait = cpu_times.iowait
                except Exception:
                    pass
                
                # Get disk usage for the current disk
                try:
                    disk = psutil.disk_usage('/')
                    disk_usage = disk.percent
                except Exception:
                    pass
                
            except Exception as e:
                logger.warning(f"Error detecting system resources: {e}")
        
        # Container memory limits (Linux)
        if memory_total == 0 and platform.system() == "Linux":
            try:
                # Check cgroups v2
                if os.path.exists("/sys/fs/cgroup/memory.max"):
                    with open("/sys/fs/cgroup/memory.max") as f:
                        content = f.read().strip()
                        if content != "max":
                            memory_total = int(content)
                
                # Check cgroups v1
                elif os.path.exists("/sys/fs/cgroup/memory/memory.limit_in_bytes"):
                    with open("/sys/fs/cgroup/memory/memory.limit_in_bytes") as f:
                        memory_total = int(f.read())
            except Exception:
                pass
            
        return cls(
            cpu_count=cpu_count,
            logical_cores=logical_cores,
            system_load=system_load,
            memory_total=memory_total,
            memory_available=memory_available,
            memory_percent=memory_percent,
            swap_percent=swap_percent,
            io_wait=io_wait,
            disk_usage=disk_usage
        )


@dataclass
class PerformanceMetrics:
    """Performance tracking metrics with prediction capabilities"""
    decisions: Dict[str, int] = field(default_factory=lambda: {'simple': 0, 'advanced': 0})
    avg_processing_time: float = 0.0
    last_strategy: Optional[str] = None
    strategy_switches: int = 0
    total_chunks_processed: int = 0
    total_bytes_processed: int = 0
    start_time: float = field(default_factory=time.monotonic)
    last_error_time: Optional[float] = None
    error_count: int = 0
    retry_count: int = 0
    
    # Timing statistics
    processing_times: Deque[float] = field(default_factory=lambda: deque(maxlen=100))
    throughput_history: Deque[float] = field(default_factory=lambda: deque(maxlen=20))
    
    # Batch statistics 
    batch_sizes: Deque[int] = field(default_factory=lambda: deque(maxlen=50))
    worker_utilization: Deque[float] = field(default_factory=lambda: deque(maxlen=20))
    
    # Memory usage tracking
    memory_usage_samples: Deque[float] = field(default_factory=lambda: deque(maxlen=20))
    
    # Processing rate by workload size for predictive scaling
    workload_history: Deque[Tuple[int, float, float]] = field(
        default_factory=lambda: deque(maxlen=50)) # (size, time, throughput)
    
    def add_processing_time(self, elapsed_time: float, bytes_processed: int, chunks_produced: int) -> None:
        """Add processing time statistics"""
        self.processing_times.append(elapsed_time)
        self.total_chunks_processed += chunks_produced
        self.total_bytes_processed += bytes_processed
        
        # Calculate throughput (chunks/second)
        if elapsed_time > 0:
            throughput = chunks_produced / elapsed_time
            self.throughput_history.append(throughput)
            
            # Update workload history for predictive scaling
            self.workload_history.append((bytes_processed, elapsed_time, throughput))
            
        # Update average processing time with exponential smoothing
        self.avg_processing_time = (
            0.9 * self.avg_processing_time + 0.1 * elapsed_time
            if self.avg_processing_time > 0 else elapsed_time
        )
        
        # Update Prometheus metrics if available
        if HAS_PROMETHEUS:
            CHUNKER_METRICS['throughput'].set(throughput if elapsed_time > 0 else 0)
            CHUNKER_METRICS['processing_time'].observe(elapsed_time)
    
    def record_decision(self, strategy: str, previous_strategy: Optional[str]) -> None:
        """Record a strategy decision"""
        self.decisions[strategy] += 1
        self.last_strategy = strategy
        
        if previous_strategy and previous_strategy != strategy:
            self.strategy_switches += 1
    
    def record_error(self) -> None:
        """Record an error occurrence"""
        self.error_count += 1
        self.last_error_time = time.monotonic()
        
        # Update Prometheus metrics if available
        if HAS_PROMETHEUS:
            CHUNKER_METRICS['error_count'].inc()
    
    def record_retry(self) -> None:
        """Record a retry attempt"""
        self.retry_count += 1
        
        # Update Prometheus metrics if available
        if HAS_PROMETHEUS:
            CHUNKER_METRICS['retry_count'].inc()
    
    def record_batch_size(self, size: int) -> None:
        """Record a batch size used"""
        self.batch_sizes.append(size)
        
        # Update Prometheus metrics if available
        if HAS_PROMETHEUS:
            CHUNKER_METRICS['batch_size'].set(size)
    
    def record_worker_utilization(self, utilization: float) -> None:
        """Record worker utilization"""
        self.worker_utilization.append(utilization)
        
        # Update Prometheus metrics if available
        if HAS_PROMETHEUS:
            CHUNKER_METRICS['worker_util'].set(utilization * 100)  # Convert to percentage
    
    def record_memory_usage(self, usage: float) -> None:
        """Record memory usage percentage"""
        self.memory_usage_samples.append(usage)
        
        # Update Prometheus metrics if available
        if HAS_PROMETHEUS:
            CHUNKER_METRICS['memory_usage'].set(usage)
    
    def predict_throughput(self, planned_workload: int) -> float:
        """
        Predict processing throughput for a given workload size
        using historical data and regression analysis.
        
        Args:
            planned_workload: Size of planned workload in bytes
            
        Returns:
            Predicted throughput (chunks/second)
        """
        if not self.workload_history:
            return 0.0
            
        # Use linear regression with NumPy if available
        if HAS_NUMPY and len(self.workload_history) >= 3:
            try:
                # Extract features and target values
                sizes = np.array([entry[0] for entry in self.workload_history])
                throughputs = np.array([entry[2] for entry in self.workload_history])
                
                # Simple linear regression
                slope, intercept = np.polyfit(sizes, throughputs, 1)
                
                # Predict throughput for planned workload
                predicted = slope * planned_workload + intercept
                
                # Ensure prediction is reasonable
                min_throughput = min(throughputs)
                max_throughput = max(throughputs)
                
                return max(min_throughput * 0.8, min(max_throughput * 1.2, predicted))
            except Exception as e:
                logger.debug(f"Error in throughput prediction: {e}")
                # Fall back to simple average
                pass
        
        # Simple average if prediction fails or NumPy not available
        return statistics.mean([entry[2] for entry in self.workload_history])
    
    def get_avg_throughput(self) -> float:
        """Get average throughput (chunks/second)"""
        if not self.throughput_history:
            return 0.0
        return sum(self.throughput_history) / len(self.throughput_history)
    
    def get_avg_batch_size(self) -> float:
        """Get average batch size"""
        if not self.batch_sizes:
            return 0.0
        return sum(self.batch_sizes) / len(self.batch_sizes)
    
    def get_uptime(self) -> float:
        """Get uptime in seconds"""
        return time.monotonic() - self.start_time
    
    def get_error_rate(self) -> float:
        """Get error rate (errors per minute)"""
        uptime_minutes = self.get_uptime() / 60
        if uptime_minutes > 0:
            return self.error_count / uptime_minutes
        return 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert metrics to dictionary"""
        result = {
            'decisions': self.decisions.copy(),
            'avg_processing_time': self.avg_processing_time,
            'last_strategy': self.last_strategy,
            'strategy_switches': self.strategy_switches,
            'total_chunks_processed': self.total_chunks_processed,
            'total_bytes_processed': self.total_bytes_processed,
            'uptime_seconds': self.get_uptime(),
            'error_count': self.error_count,
            'retry_count': self.retry_count,
            'avg_throughput': self.get_avg_throughput(),
            'avg_batch_size': self.get_avg_batch_size(),
        }
        
        # Add statistics if we have enough data
        if len(self.processing_times) >= 5:
            result.update({
                'min_processing_time': min(self.processing_times),
                'max_processing_time': max(self.processing_times),
                'p90_processing_time': np.percentile(list(self.processing_times), 90) if HAS_NUMPY else sorted(self.processing_times)[int(len(self.processing_times) * 0.9)],
            })
            
        if self.throughput_history:
            result['throughput_trend'] = list(self.throughput_history)
            
        # Add memory metrics if available
        if self.memory_usage_samples:
            result['avg_memory_usage'] = statistics.mean(self.memory_usage_samples)
            result['max_memory_usage'] = max(self.memory_usage_samples)
            
        return result


class DynamicConfig:
    """Dynamic configuration with remote update capabilities"""
    
    def __init__(self, initial_config: Optional[Dict[str, Any]] = None):
        """Initialize with optional initial configuration"""
        self._config = initial_config or {}
        self._lock = threading.RLock()
        self._updated_at = time.monotonic()
        self._update_interval = 300.0  # Default 5 minutes
        self._auto_update = False
        self._update_url = None
        self._update_thread = None
        
    def get(self, key: str, default: Any = None) -> Any:
        """Get a configuration value with default fallback"""
        with self._lock:
            return self._config.get(key, default)
    
    def set(self, key: str, value: Any) -> None:
        """Set a configuration value"""
        with self._lock:
            self._config[key] = value
            self._updated_at = time.monotonic()
    
    def update(self, config: Dict[str, Any]) -> None:
        """Update multiple configuration values"""
        with self._lock:
            self._config.update(config)
            self._updated_at = time.monotonic()
    
    def update_from_url(self, url: str) -> bool:
        """
        Update configuration from a remote URL.
        
        Args:
            url: URL to fetch configuration from
            
        Returns:
            Success status
        """
        try:
            import requests
            response = requests.get(url, timeout=10.0)
            response.raise_for_status()
            config = response.json()
            
            with self._lock:
                self._config.update(config)
                self._updated_at = time.monotonic()
                
            logger.info(f"Updated configuration from {url}")
            return True
        except ImportError:
            logger.error("Requests library not installed - cannot update from URL")
            return False
        except Exception as e:
            logger.error(f"Failed to update configuration from {url}: {e}")
            return False
    
    def start_auto_update(self, url: str, interval: float = 300.0) -> bool:
        """
        Start auto-updating configuration from a URL.
        
        Args:
            url: URL to fetch configuration from
            interval: Update interval in seconds
            
        Returns:
            Success status
        """
        try:
            import requests
        except ImportError:
            logger.error("Requests library not installed - cannot auto-update from URL")
            return False
            
        if self._auto_update and self._update_thread and self._update_thread.is_alive():
            logger.warning("Auto-update already running")
            return False
            
        self._update_url = url
        self._update_interval = interval
        self._auto_update = True
        
        def update_loop():
            while self._auto_update:
                try:
                    self.update_from_url(self._update_url)
                except Exception as e:
                    logger.error(f"Error in config update loop: {e}")
                
                # Sleep for interval or until auto_update is disabled
                for _ in range(int(self._update_interval / 0.1)):
                    if not self._auto_update:
                        break
                    time.sleep(0.1)
        
        self._update_thread = threading.Thread(
            target=update_loop,
            daemon=True,
            name="config-updater"
        )
        self._update_thread.start()
        
        logger.info(f"Started auto-update from {url} every {interval}s")
        return True
    
    def stop_auto_update(self) -> None:
        """Stop auto-updating configuration"""
        self._auto_update = False
        if self._update_thread and self._update_thread.is_alive():
            self._update_thread.join(timeout=1.0)
            logger.info("Stopped configuration auto-update")
    
    def to_dict(self) -> Dict[str, Any]:
        """Get a copy of the entire configuration"""
        with self._lock:
            return self._config.copy()
    
    def __str__(self) -> str:
        """String representation with update timestamp"""
        from datetime import datetime
        update_time = datetime.fromtimestamp(self._updated_at).strftime('%Y-%m-%d %H:%M:%S')
        return f"DynamicConfig(entries={len(self._config)}, updated={update_time})"


# Global configuration instance
CONFIG = DynamicConfig({
    'processing_timeout': DEFAULT_TIMEOUT,
    'max_retries': MAX_RETRIES,
    'memory_safety': True,
    'dynamic_batch_sizing': True,
    'health_check_interval': HEALTH_CHECK_INTERVAL,
})


class SmartParallelChunker:
    """
    Enterprise-grade adaptive parallel chunking system that automatically selects 
    between simple and advanced chunking strategies based on workload characteristics,
    system resources, and real-time performance monitoring.
    
    Features:
    - Self-tuning workload complexity estimation
    - Dynamic batch sizing and worker scaling
    - System resource monitoring and adaptation
    - Comprehensive error handling and recovery
    - Circuit breaker pattern for fault tolerance
    - Performance metrics and health monitoring
    - Graceful degradation under pressure
    - Memory safety management
    - Dynamic configuration updates
    - Quality of Service (QoS) prioritization
    - Prometheus metrics integration
    - Predictive resource scaling
    - Container awareness
    """
    
    def __init__(
        self,
        options: ChunkingOptions,
        size_threshold: int = 100_000,  # 100KB
        complexity_threshold: float = 0.5,
        sample_size: int = 1000,  # 1KB sample for complexity estimation
        force_strategy: Optional[str] = None,  # 'simple', 'advanced', or None for auto
        timeout: float = DEFAULT_TIMEOUT,
        max_retries: int = MAX_RETRIES,
        memory_safety: bool = True,
        adaptive_batch_sizing: bool = True,
        health_check_enabled: bool = True,
        worker_count_override: Optional[int] = None,
        resource_monitor_interval: float = 5.0,
        config: Optional[DynamicConfig] = None,
    ):
        """
        Initialize the enterprise-grade smart chunker system.
        
        Args:
            options: Chunking configuration options
            size_threshold: Text size threshold for automatic selection (bytes)
            complexity_threshold: Processing complexity threshold for selection
            sample_size: Size of sample text for complexity estimation
            force_strategy: Force a specific strategy ('simple', 'advanced', or None for auto)
            timeout: Operation timeout in seconds
            max_retries: Maximum number of retry attempts for failures
            memory_safety: Enable memory safety monitoring and protection
            adaptive_batch_sizing: Enable dynamic batch size adjustments
            health_check_enabled: Enable background health monitoring
            worker_count_override: Override auto-detected worker counts
            resource_monitor_interval: Resource monitoring interval in seconds
            config: Optional dynamic configuration instance
        """
        self.options = options
        self.size_threshold = size_threshold
        self.complexity_threshold = complexity_threshold
        self.sample_size = sample_size
        self.force_strategy = force_strategy
        self.timeout = timeout
        self.max_retries = max_retries
        self.memory_safety = memory_safety
        self.adaptive_batch_sizing = adaptive_batch_sizing
        self.health_check_enabled = health_check_enabled
        self.worker_count_override = worker_count_override
        self.resource_monitor_interval = resource_monitor_interval
        self.config = config or CONFIG
        
        # Initialize system resource information
        self.resources = ResourceInfo.detect()
        
        # Performance metrics and state
        self.metrics = PerformanceMetrics()
        self.health_status = "INITIALIZING"
        self.circuit_breaker_status = "CLOSED"  # CLOSED, HALF_OPEN, OPEN
        self.circuit_breaker_reset_time = None
        self.last_health_check = time.monotonic()
        
        # Thread safety
        self._lock = RLock()
        self._shutdown_event = Event()
        # Replace Event with Condition for resource updates to avoid missed signals
        self._resource_update_condition = Condition()
        
        # QoS settings
        self._current_priority = 'normal'
        self._priority_context_stack = []
        
        # Initialize memory management
        self._memory_manager = MemoryManager(low_memory_mode=memory_safety)
        self._memory_monitor = MemoryMonitor()
        
        # Initialize streaming buffer
        self._streaming_buffer = StreamingBuffer(
            buffer_size=options.stream_buffer_size if hasattr(options, 'stream_buffer_size') else 100000,
            overlap_size=options.overlap_tokens * 4 if hasattr(options, 'overlap_tokens') else 5000
        )
        
        # Initialize chunkers with optimized settings
        self.simple_chunker = self._create_simple_chunker()
        self.advanced_chunker = self._create_advanced_chunker()
        
        # Start background tasks if enabled
        if self.health_check_enabled:
            self._start_background_monitoring()
        
        # Auto-tune based on initial system state
        self._auto_tune_thresholds()
        
        # Initialize memory safety tracking
        self._last_memory_check = time.monotonic()
        self._memory_estimate_cache = {}
        
        # Start metrics server if Prometheus is available
        if HAS_PROMETHEUS and CONFIG.get('start_metrics_server', False):
            self._start_metrics_server()
        
        logger.info(
            f"SmartParallelChunker initialized on {platform.system()} with "
            f"{self.resources.logical_cores} logical cores, "
            f"size_threshold={size_threshold}, "
            f"complexity_threshold={complexity_threshold}, "
            f"memory_safety={memory_safety}"
        )
    
    def _create_simple_chunker(self) -> SimpleParallelChunker:
        """Create an optimized simple chunker instance"""
        # Determine optimal worker count for simple case
        if self.worker_count_override is not None:
            workers = self.worker_count_override
        else:
            # For simple chunker, thread count can be higher (I/O bound work)
            workers = min(
                self.resources.logical_cores * 4,  # 4x logical cores
                32,  # Cap at reasonable maximum
                int((self.resources.memory_available or 8*1024*1024*1024) // THREAD_STACK_SIZE)  # Memory-aware scaling
            )
        
        logger.debug(f"Creating simple chunker with {workers} workers")
        
        # Create optimized simple chunker
        return SimpleParallelChunker(
            options=self.options,
            max_workers=workers,
            use_processes=False  # Always use threads for simple case
        )
    
    def _create_advanced_chunker(self):
        """
        Create an optimized advanced chunker instance
        
        Dynamically imports the advanced chunker to avoid circular imports
        """
        # We'll pass our detected resources to advanced chunker
        # Advanced implementation will use its own logic for optimal workers
        logger.debug("Creating advanced chunker with auto-configuration")
        
        # Check if the advanced chunker is available
        try:
            # Try to import the advanced chunker
            from enterprise_chunker.utils.advanced_parallel import ParallelChunker as AdvancedParallelChunker
            
            # Create optimized advanced chunker with our custom settings
            return AdvancedParallelChunker(options=self.options)
        except ImportError:
            # Use debug level instead of warning for this common case
            logger.debug("Advanced chunker not available, falling back to simple chunker")
            
            # Return a simple chunker with different settings for "advanced" mode
            return SimpleParallelChunker(
                options=self.options,
                max_workers=self.worker_count_override or max(1, (self.resources.logical_cores or 4) * 2),
                use_processes=True  # Use processes for "advanced" mode
            )
    
    def _start_background_monitoring(self) -> None:
        """Start background health and resource monitoring"""
        # Resource monitoring thread
        self._resource_monitor = threading.Thread(
            target=self._resource_monitoring_loop,
            daemon=True,
            name="resource-monitor"
        )
        self._resource_monitor.start()
        
        logger.debug("Background monitoring started")
    
    def _start_metrics_server(self, port: int = 8000) -> None:
        """Start Prometheus metrics server if available"""
        if not HAS_PROMETHEUS:
            logger.warning("Prometheus client not available - metrics server not started")
            return
            
        try:
            metrics_port = CONFIG.get('metrics_port', port)
            start_http_server(metrics_port)
            logger.info(f"Metrics server started on port {metrics_port}")
        except Exception as e:
            logger.error(f"Failed to start metrics server: {e}")
    
    def _resource_monitoring_loop(self) -> None:
        """Background resource monitoring loop"""
        while not self._shutdown_event.is_set():
            try:
                # Update resource information
                self.resources = ResourceInfo.detect()
                
                # Check system health
                self._check_system_health()
                
                # Update memory usage metric
                if HAS_PSUTIL:
                    try:
                        memory_usage = self._monitor_memory_usage()
                        self.metrics.record_memory_usage(memory_usage)
                    except Exception as e:
                        logger.debug(f"Error monitoring memory: {e}")
                
                # Check circuit breaker if in HALF_OPEN state
                if self.circuit_breaker_status == "HALF_OPEN":
                    self._circuit_breaker_check()
                
                # Signal resource update to any waiting threads using Condition
                with self._resource_update_condition:
                    self._resource_update_condition.notify_all()
                
                # Wait for next check interval
                self._shutdown_event.wait(self.resource_monitor_interval)
            except Exception as e:
                logger.error(f"Error in resource monitoring: {e}")
                # Don't crash the monitor thread, just wait and retry
                time.sleep(max(1.0, self.resource_monitor_interval / 2))
    
    def _circuit_breaker_check(self) -> None:
        """
        Advanced circuit breaker state management with health check.
        Tests system recovery with a synthetic workload before fully closing
        the circuit breaker.
        """
        # Don't run health check too frequently
        now = time.monotonic()
        if self.last_health_check and now - self.last_health_check < 5.0:
            return
            
        self.last_health_check = now
        
        # Execute a controlled health check task
        test_result = self._run_health_check_task()
        
        if test_result.success:
            # System seems healthy, close the circuit
            logger.info(f"Circuit breaker health check passed in {test_result.duration:.2f}s - resetting to CLOSED")
            self.circuit_breaker_status = "CLOSED"
        else:
            # System still has issues, extend outage
            logger.warning(f"Circuit breaker health check failed: {test_result.error} - keeping HALF_OPEN")
            self._trip_circuit_breaker()
    
    def _run_health_check_task(self) -> HealthCheckResult:
        """
        Execute a controlled health check with a synthetic workload.
        
        Returns:
            HealthCheckResult: Results of the health check
        """
        # Create a simple synthetic workload
        test_text = "x " * 1000  # 2KB synthetic text
        
        start_time = time.monotonic()
        memory_usage = self._monitor_memory_usage()
        cpu_usage = 0.0
        
        if HAS_PSUTIL:
            try:
                # Get CPU usage for this process
                process = psutil.Process(os.getpid())
                cpu_usage = process.cpu_percent(interval=0.1)
            except Exception:
                pass
        
        try:
            # Use a short timeout for the test
            with self._timeout_context(5.0):
                # Try to process with simple chunker
                result = self.simple_chunker.chunk_segments([test_text], lambda x: [x])
                duration = time.monotonic() - start_time
                
                # Check if result is valid
                if result and len(result) > 0:
                    return HealthCheckResult(
                        success=True,
                        duration=duration,
                        memory_usage=memory_usage,
                        cpu_usage=cpu_usage
                    )
                else:
                    return HealthCheckResult(
                        success=False,
                        duration=duration,
                        error="Empty result from test chunking",
                        memory_usage=memory_usage,
                        cpu_usage=cpu_usage
                    )
        except Exception as e:
            duration = time.monotonic() - start_time
            return HealthCheckResult(
                success=False,
                duration=duration,
                error=str(e),
                memory_usage=memory_usage,
                cpu_usage=cpu_usage
            )
    
    def _check_system_health(self) -> None:
        """Enhanced system health check with multiple indicators"""
        # Skip if psutil not available
        if not HAS_PSUTIL:
            self.health_status = "UNKNOWN"
            return
        
        try:
            # Check CPU load
            high_load = self.resources.system_load > 0.9
            
            # Check memory pressure
            high_memory = self.resources.memory_percent > 90
            high_swap = self.resources.swap_percent > 80
            
            # Check disk pressure
            high_disk = self.resources.disk_usage > 95
            high_io = self.resources.io_wait > 30
            
            # Determine overall health
            if high_memory and high_load and (high_swap or high_io):
                self.health_status = "CRITICAL"
            elif high_memory or (high_load and high_swap):
                self.health_status = "WARNING"
            elif high_disk or high_io:
                self.health_status = "DEGRADED"
            else:
                self.health_status = "HEALTHY"
                
            # Reset circuit breaker if in HALF_OPEN and health is good
            if (self.circuit_breaker_status == "HALF_OPEN" and 
                self.health_status in ("HEALTHY", "DEGRADED")):
                self.circuit_breaker_status = "CLOSED"
                logger.info("Circuit breaker reset to CLOSED state")
                
            # Log health state changes
            if hasattr(self, '_last_health_status') and self._last_health_status != self.health_status:
                logger.info(f"System health changed: {self._last_health_status} -> {self.health_status}")
                
            self._last_health_status = self.health_status
            
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            self.health_status = "UNKNOWN"
    
    def _auto_tune_thresholds(self) -> None:
        """Auto-tune thresholds based on system capabilities"""
        # Adjust size threshold based on available memory
        if self.resources.memory_total and self.memory_safety:
            # Higher memory = higher threshold (process more in simple chunker)
            mem_gb = self.resources.memory_total / (1024**3)
            if mem_gb > 32:  # High memory system
                self.size_threshold = max(self.size_threshold, 250_000)
            elif mem_gb < 4:  # Low memory system
                self.size_threshold = min(self.size_threshold, 50_000)
        
        # Adjust complexity threshold based on CPU power
        if self.resources.cpu_count > 8:  # High core count
            # Be more aggressive with advanced chunker on powerful systems
            self.complexity_threshold = max(0.3, self.complexity_threshold - 0.1)
        elif self.resources.cpu_count <= 2:  # Low core count
            # Be more conservative with advanced chunker on weak systems
            self.complexity_threshold = min(0.8, self.complexity_threshold + 0.2)
            
        logger.debug(
            f"Auto-tuned thresholds: size_threshold={self.size_threshold}, "
            f"complexity_threshold={self.complexity_threshold}"
        )
    
    def _monitor_memory_usage(self) -> float:
        """
        Enhanced memory usage monitoring.
        
        Returns:
            Memory usage percentage (0-100)
        """
        if not HAS_PSUTIL:
            return 0.0
            
        try:
            # Get current process memory usage
            process = psutil.Process(os.getpid())
            memory_info = process.memory_info()
            
            # Get system memory information
            system_memory = psutil.virtual_memory()
            
            # Calculate percentage of total system memory used by this process
            process_percent = (memory_info.rss / system_memory.total) * 100
            
            return process_percent
        except Exception as e:
            logger.warning(f"Error monitoring memory: {e}")
            return 0.0
    
    @contextmanager
    def _timeout_context(self, seconds: float):
        """
        Context manager that raises TimeoutError if execution takes longer than specified time.
        Works on all platforms, including Windows.
        
        Args:
            seconds: Timeout in seconds
        """
        # For zero or negative timeout, don't apply timeout
        if seconds <= 0:
            yield
            return
            
        # Use signal-based implementation on Unix systems
        if platform.system() != 'Windows':
            def _timeout_handler(signum, frame):
                raise TimeoutError(f"Operation timed out after {seconds} seconds")
                
            import signal
            original_handler = signal.getsignal(signal.SIGALRM)
            try:
                signal.signal(signal.SIGALRM, _timeout_handler)
                signal.setitimer(signal.ITIMER_REAL, seconds)
                yield
            finally:
                signal.setitimer(signal.ITIMER_REAL, 0)
                signal.signal(signal.SIGALRM, original_handler)
        else:
            # Thread-based timeout for Windows
            timeout_event = threading.Event()
            result = {"timeout": False}
            
            def _timeout_thread():
                time.sleep(seconds)
                if not timeout_event.is_set():
                    result["timeout"] = True
                    
            timer = threading.Thread(target=_timeout_thread, daemon=True)
            timer.start()
            
            try:
                yield
            finally:
                timeout_event.set()
                # Always join the timer thread to avoid orphan threads
                timer.join(timeout=0.1)
                if result["timeout"]:
                    raise TimeoutError(f"Operation timed out after {seconds} seconds")
    
    def _is_circuit_breaker_open(self) -> bool:
        """Check if circuit breaker is open"""
        if self.circuit_breaker_status == "OPEN":
            # Check if it's time to try again
            if self.circuit_breaker_reset_time and time.monotonic() >= self.circuit_breaker_reset_time:
                self.circuit_breaker_status = "HALF_OPEN"
                logger.info("Circuit breaker changed to HALF_OPEN state")
                return False
            return True
            
        return False
    
    def _trip_circuit_breaker(self) -> None:
        """Trip the circuit breaker due to system issues"""
        self.circuit_breaker_status = "OPEN"
        # Set reset time - exponential backoff based on error count
        backoff = min(60, 2 ** min(self.metrics.error_count, 6))  # Cap at 60 seconds
        self.circuit_breaker_reset_time = time.monotonic() + backoff
        logger.warning(f"Circuit breaker OPEN, will retry in {backoff}s")
    
    def _calculate_optimal_batch_size(self) -> int:
        """
        Calculate optimal batch size based on performance history and system state.
        
        Returns:
            Optimal batch size
        """
        if not self.adaptive_batch_sizing or not self.metrics.batch_sizes:
            # Apply QoS priority multiplier to default batch size
            return self._apply_priority_multiplier(DEFAULT_BATCH_SIZE)
            
        # Get recent batch sizes and their performance
        recent_sizes = list(self.metrics.batch_sizes)
        recent_throughput = list(self.metrics.throughput_history)
        
        # If we don't have enough history, use default
        if len(recent_throughput) < 2:
            return self._apply_priority_multiplier(DEFAULT_BATCH_SIZE)
            
        # Start with current average
        current_avg = self.metrics.get_avg_batch_size()
        
        # Check if throughput is improving or declining
        if len(recent_throughput) >= 3:
            # Calculate trend
            trend = recent_throughput[-1] - statistics.mean(recent_throughput[:-1])
            
            # If improving, try larger batch
            if trend > 0:
                new_size = min(int(current_avg * 1.2) + 1, MAX_BATCH_SIZE)
            # If declining, try smaller batch
            elif trend < -DYNAMIC_SCALING_THRESHOLD:
                new_size = max(int(current_avg * 0.8), 1)
            else:
                new_size = max(1, min(MAX_BATCH_SIZE, int(current_avg)))
        else:
            # Default case - stick with current size with small adjustments
            new_size = max(1, min(MAX_BATCH_SIZE, int(current_avg)))
            
        # Apply QoS priority multiplier
        return self._apply_priority_multiplier(new_size)
    
    def _apply_priority_multiplier(self, size: int) -> int:
        """Apply priority multiplier to batch size based on current QoS priority"""
        priority_info = PRIORITY_LEVELS.get(self._current_priority, PRIORITY_LEVELS['normal'])
        multiplier = priority_info.get('batch_size_multiplier', 1.0)
        
        return max(1, int(size * multiplier))
    
    @contextmanager
    def _priority_context(self, priority: str):
        """
        Context manager for temporary priority change.
        
        Args:
            priority: Priority level ('high', 'normal', 'background')
        """
        if priority not in PRIORITY_LEVELS:
            raise ValueError(f"Invalid priority: {priority}")
            
        previous_priority = self._current_priority
        self._priority_context_stack.append(previous_priority)
        self._current_priority = priority
        
        try:
            yield
        finally:
            # Restore previous priority
            if self._priority_context_stack:
                self._current_priority = self._priority_context_stack.pop()
            else:
                self._current_priority = 'normal'
                
    def _select_strategy(self, text: str, chunker_func: ChunkerFunc) -> str:
        """
        Advanced strategy selection based on multiple factors including:
        - Workload characteristics
        - System resources
        - Performance history
        - Circuit breaker status
        - Memory safety predictions
        
        Args:
            text: Text to chunk
            chunker_func: Function that chunks text
            
        Returns:
            Strategy name ('simple' or 'advanced')
        """
        # Check circuit breaker first
        if self._is_circuit_breaker_open():
            # When circuit breaker is open, use simple strategy
            logger.warning("Circuit breaker OPEN - forcing simple strategy")
            return 'simple'
        
        # Check if strategy is forced
        if self.force_strategy:
            return self.force_strategy
        
        # Check system health
        if self.health_status in ("CRITICAL", "WARNING") and self.memory_safety:
            # Use simple strategy under system pressure
            logger.warning(f"System health {self.health_status} - using simple strategy")
            return 'simple'
            
        # 1. Size-based selection (small texts use simple strategy)
        if len(text) < self.size_threshold:
            return 'simple'
            
        # 2. For larger texts, estimate complexity
        complexity = self._estimate_complexity(text, chunker_func)
        logger.debug(f"Estimated complexity: {complexity:.4f}")
        
        # 3. Check memory safety (for very large texts)
        if self.memory_safety and len(text) > 10 * self.size_threshold:
            memory_usage = self._monitor_memory_usage()
            # If memory usage is high, use simple strategy to be safe
            if memory_usage > 80:
                logger.warning(f"High memory usage ({memory_usage:.1f}%) - using simple strategy")
                return 'simple'
                
        # 4. Check historical performance
        if (self.metrics.last_strategy == 'advanced' and 
            self.metrics.error_count > 3 and 
            self.metrics.get_error_rate() > 0.5):
            # If advanced strategy has been failing, switch to simple
            logger.warning("High error rate with advanced strategy - switching to simple")
            return 'simple'
            
        # 5. Standard complexity-based selection
        if complexity < self.complexity_threshold:
            return 'simple'
        else:
            return 'advanced'
    
    def _estimate_complexity(self, text: str, chunker_func: ChunkerFunc) -> float:
        """
        Estimate processing complexity of text using a combination of
        token count, structure analysis, and sample processing.
        
        Args:
            text: Text to chunk
            chunker_func: Function that chunks text
            
        Returns:
            Complexity score (higher = more complex)
        """
        if not text:
            return 0.0
            
        # Use the token estimator for a quick assessment of content density
        tokens = estimate_tokens(text[:min(len(text), 5000)], TokenEstimationStrategy.BALANCED)
        tokens_per_char = tokens / min(len(text), 5000)
        
        # Detect content format for more intelligent complexity estimation
        content_format = detect_content_format(text[:min(len(text), 2500)])
        
        # Take a sample of text for performance estimation
        sample_size = min(self.sample_size, len(text))
        sample = text[:sample_size]
        
        # Time the chunking operation on the sample
        try:
            start_time = time.monotonic()
            
            # Guard against empty sample - Fix: Ensure sample is not empty before calling chunker_func
            if sample:
                chunks = chunker_func(sample)
            else:
                chunks = []
                
            processing_time = time.monotonic() - start_time
            
            # Normalize by sample size and estimate for full text
            normalized_time = processing_time / max(1, len(sample))  # Avoid division by zero
            estimated_full_time = normalized_time * len(text)
            
            # Apply scaling factor based on content format and size
            scaling_factor = 1.0
            
            # Adjust for different content types using enum values instead of string literals
            if content_format == ContentFormat.CODE:
                scaling_factor = 1.3  # Code tends to be more complex
            elif content_format == ContentFormat.JSON:
                scaling_factor = 1.2  # JSON has nested structure
            elif content_format == ContentFormat.MARKDOWN:
                scaling_factor = 1.1  # Markdown has formatting
                
            # Adjust for document size (larger texts often have non-linear complexity)
            size_factor = min(2.0, 1.0 + 0.2 * (math.log2(max(1, len(text) / max(1, sample_size)))))
            
            return estimated_full_time * scaling_factor * size_factor
        except Exception as e:
            logger.warning(f"Error during complexity estimation: {e}")
            # Default to threshold if estimation fails
            return self.complexity_threshold
    
    def chunk(self, text: str, chunker_func: ChunkerFunc) -> List[str]:
        """
        Enterprise-grade parallel chunking with automatic strategy selection,
        error recovery, and performance optimization.
        
        Features:
        - Self-selecting strategy based on workload and system state
        - Automatic retry with fallback on errors
        - Circuit breaker pattern for system protection
        - Comprehensive performance metrics
        - Memory safety enforcement
        - Predictive resource usage
        
        Args:
            text: Text to chunk
            chunker_func: Function that chunks text
            
        Returns:
            List of processed chunks
        """
        # Empty input check
        if not text:
            return []
        
        # Detect dynamic config updates
        timeout = self.config.get('processing_timeout', self.timeout)
        max_retries = self.config.get('max_retries', self.max_retries)
        
        # Predict resource usage
        text_size = len(text)
        if text_size > self.size_threshold * 5:
            # For large texts, predict throughput
            predicted_throughput = self.metrics.predict_throughput(text_size)
            if predicted_throughput > 0:
                estimated_time = text_size / (predicted_throughput * 1000)  # Rough estimate
                logger.info(f"Predicted processing time: {estimated_time:.1f}s for {text_size:,} chars")
            
            # Use memory manager for large texts
            with self._memory_manager.memory_efficient_context():
                return self._chunk_with_memory_safety(text, chunker_func, timeout, max_retries)
        else:
            # Process normally for smaller texts
            return self._chunk_with_memory_safety(text, chunker_func, timeout, max_retries)
    
    def _chunk_with_memory_safety(
        self, 
        text: str, 
        chunker_func: ChunkerFunc, 
        timeout: float, 
        max_retries: int
    ) -> List[str]:
        """Inner implementation of chunk with memory safety controls"""
        # Track full processing time
        start_time = time.monotonic()
        previous_strategy = self.metrics.last_strategy
        retry_count = 0
        chunks = []
        
        # Keep overall processing under timeout
        try:
            with self._timeout_context(timeout):
                try:
                    # Select strategy
                    strategy = self._select_strategy(text, chunker_func)
                    logger.info(f"Selected '{strategy}' strategy for text of length {len(text):,}")
                    
                    # Record decision
                    self.metrics.record_decision(strategy, previous_strategy)
                    
                    # Process with selected strategy
                    if strategy == 'simple':
                        chunks = self._process_with_simple(text, chunker_func)
                    else:
                        chunks = self._process_with_advanced(text, chunker_func)
                    
                except Exception as e:
                    # First error - record and retry
                    self.metrics.record_error()
                    err_name = type(e).__name__
                    logger.warning(f"Error ({err_name}) processing with {strategy} strategy: {e}")
                    
                    # Circuit breaker check
                    if self.health_status in ("CRITICAL", "WARNING"):
                        self._trip_circuit_breaker()
                
                    # Retry with simple strategy if we were using advanced
                    if strategy == 'advanced' and retry_count < max_retries:
                        retry_count += 1
                        self.metrics.record_retry()
                        logger.info(f"Retrying with simple strategy (attempt {retry_count})")
                        
                        try:
                            # Fallback to simple strategy
                            chunks = self._process_with_simple(text, chunker_func)
                        except Exception as retry_e:
                            # Record retry failure
                            logger.error(f"Retry failed: {type(retry_e).__name__}: {retry_e}")
                            # Re-raise original error
                            raise e
                    else:
                        # No more retries or already using simple - re-raise
                        raise
        except TimeoutError:
            # Global timeout - this is serious
            logger.error(f"Global timeout ({timeout}s) exceeded while processing text of length {len(text):,}")
            self.metrics.record_error()
            self._trip_circuit_breaker()
            
            # Try one last desperate attempt with simple strategy on a portion of the text
            if len(text) > self.size_threshold:
                logger.warning("Attempting emergency processing of first section only")
                try:
                    # Process just the first section as a fallback
                    first_section = text[:min(len(text), self.size_threshold)]
                    chunks = self._process_with_simple(first_section, chunker_func)
                    logger.warning(f"Emergency processing returned {len(chunks)} chunks from first {len(first_section):,} chars")
                except Exception as e:
                    logger.error(f"Emergency processing failed: {e}")
                    chunks = []
            else:
                chunks = []
        except Exception as e:
            # Unhandled exception
            logger.error(f"Unhandled exception: {type(e).__name__}: {e}")
            self.metrics.record_error()
            self._trip_circuit_breaker()
            
            # Try to get a stack trace
            logger.error(f"Stack trace: {traceback.format_exc()}")
            chunks = []
        finally:
            # Calculate processing time and update metrics
            processing_time = time.monotonic() - start_time
            self.metrics.add_processing_time(
                elapsed_time=processing_time,
                bytes_processed=len(text),
                chunks_produced=len(chunks)
            )
            
            # Log results
            logger.info(
                f"Processed {len(text):,} chars in {processing_time:.2f}s "
                f"producing {len(chunks)} chunks (strategy: {self.metrics.last_strategy})"
            )
            
            # Memory safety cleanup for large texts
            if len(text) > self.size_threshold * 5 and self.memory_safety:
                self._memory_manager.reduce_memory_usage(force=True)
                
        return chunks
    
    def _process_with_simple(self, text: str, chunker_func: ChunkerFunc) -> List[str]:
        """
        Process text with the simple chunker - enhanced with dynamic batch sizing
        and optimized segmentation.
        
        Args:
            text: Text to chunk
            chunker_func: Function that chunks text
            
        Returns:
            List of processed chunks
        """
        # Calculate batch size
        batch_size = self._calculate_optimal_batch_size()
        self.metrics.record_batch_size(batch_size)
        
        # For simple chunker, break into optimally sized segments
        segments = self._split_into_segments(text)
        
        # Monitor resource utilization during processing
        start_mem = self._monitor_memory_usage() if self.memory_safety else 0
        
        # Process segments in batches
        results = []
        for i in range(0, len(segments), batch_size):
            batch = segments[i:i+batch_size]
            
            # Check for shutdown signal
            if self._shutdown_event.is_set():
                logger.warning("Shutdown signaled - interrupting processing")
                break
                
            # Process batch
            batch_results = self.simple_chunker.chunk_segments(batch, chunker_func)
            results.extend(batch_results)
            
            # Check memory pressure and adjust batch size if needed
            if self.memory_safety and i < len(segments) - batch_size:
                current_mem = self._monitor_memory_usage()
                
                # If memory usage grew significantly, reduce batch size
                if current_mem > start_mem + 10 and batch_size > 1:  # 10% increase
                    new_batch_size = max(1, batch_size // 2)
                    logger.warning(
                        f"Memory pressure detected ({current_mem:.1f}%) - "
                        f"reducing batch size from {batch_size} to {new_batch_size}"
                    )
                    batch_size = new_batch_size
                    self.metrics.record_batch_size(batch_size)
        
        return results
    
    def _process_with_advanced(self, text: str, chunker_func: ChunkerFunc) -> List[str]:
        """
        Process text with the advanced chunker - enhanced with fallback mechanisms,
        health monitoring, and circuit breaker protection.
        
        Args:
            text: Text to chunk
            chunker_func: Function that chunks text
            
        Returns:
            List of processed chunks
        """
        try:
            # Set a reasonable timeout for the advanced processing
            with self._timeout_context(self.timeout * 0.8):
                # Check system health before proceeding
                if self.health_status == "CRITICAL" and self.memory_safety:
                    logger.warning("System health CRITICAL - falling back to simple chunker with emergency settings")
                    # Emergency simple processing with conservative settings
                    segments = self._split_conservatively(text)
                    results = []
                    for segment in segments:
                        # Process one segment at a time
                        segment_result = self.simple_chunker.chunk_segments([segment], chunker_func)
                        results.extend(segment_result)
                        
                        # Aggressive GC after each segment in critical state
                        gc.collect()
                    
                    return results
                
                # Normal advanced processing
                try:
                    # Check if advanced chunker has chunk_in_parallel method
                    if hasattr(self.advanced_chunker, 'chunk_in_parallel'):
                        results = self.advanced_chunker.chunk_in_parallel(text, chunker_func)
                    else:
                        # Fallback to standard interface
                        segments = self._split_into_segments(text)
                        results = self.advanced_chunker.chunk_segments(segments, chunker_func)
                    
                    # Validate results as a sanity check
                    if not results and len(text) > 1000:
                        logger.warning("Advanced chunker returned empty results for non-empty text")
                        raise RuntimeError("Advanced chunker returned empty results")
                        
                    return results
                except AttributeError as e:
                    logger.error(f"Advanced chunker interface error: {e}, falling back to simple")
                    segments = self._split_into_segments(text)
                    return self.simple_chunker.chunk_segments(segments, chunker_func)
                
        except (TimeoutError, Exception) as e:
            logger.error(f"Advanced chunker failed: {type(e).__name__}: {e}")
            # Do not trip circuit breaker here - the main chunk method will handle errors
            raise
    
    def _split_into_segments(self, text: str) -> List[str]:
        """
        Split text into segments for parallel processing.
        
        Args:
            text: Text to split
            
        Returns:
            List of text segments
        """
        # Empty or very small text
        if len(text) < 1000:
            return [text]
        
        # Use the existing text splitting from StreamingBuffer
        segments = []
        for segment in self._streaming_buffer.stream_string(text):
            segments.append(segment)
            
        return segments
    
    def _split_conservatively(self, text: str) -> List[str]:
        """
        Split text very conservatively for emergency processing.
        
        Args:
            text: Text to split
            
        Returns:
            List of small text segments
        """
        # Use much smaller segments for conservative processing
        max_segment_size = min(self.size_threshold // 4, 25000)  # 25KB or less
        
        segments = []
        current_pos = 0
        text_len = len(text)
        
        while current_pos < text_len:
            # Small segment size for safety
            end_pos = min(current_pos + max_segment_size, text_len)
            
            # Look for natural boundaries
            if end_pos < text_len:
                # Check for paragraph break nearby
                para_pos = text.find('\n\n', end_pos - 100, end_pos + 100)
                if para_pos != -1:
                    end_pos = para_pos + 2
                else:
                    # Line break
                    line_pos = text.find('\n', end_pos - 50, end_pos + 50)
                    if line_pos != -1:
                        end_pos = line_pos + 1
                    else:
                        # Sentence or word boundary
                        sent_pos = max(
                            text.rfind('. ', end_pos - 100, end_pos),
                            text.rfind('! ', end_pos - 100, end_pos),
                            text.rfind('? ', end_pos - 100, end_pos)
                        )
                        if sent_pos != -1:
                            end_pos = sent_pos + 2
                        else:
                            # Word boundary
                            space_pos = text.rfind(' ', end_pos - 50, end_pos)
                            if space_pos != -1:
                                end_pos = space_pos + 1
            
            # Add segment
            segments.append(text[current_pos:end_pos])
            current_pos = end_pos
            
        return segments
    
    def stream_chunks(
        self,
        segment_gen: Generator[str, None, None],
        chunker_func: ChunkerFunc
    ) -> Generator[str, None, None]:
        """
        Stream chunks with efficient memory usage and automatic strategy selection.
        
        This method uses the StreamingBuffer for memory-efficient processing of
        streamed content, with automatic adaptation based on workload characteristics.
        
        Args:
            segment_gen: Generator yielding text segments
            chunker_func: Function that chunks text
            
        Yields:
            Processed chunks
        """
        # Initialize tracking
        start_time = time.monotonic()
        processed_segments = 0
        processed_bytes = 0
        produced_chunks = 0
        strategy = None
        buffer = []
        buffer_size = 0
        max_buffer_size = 500_000  # 500KB max buffer
        
        # First, buffer a small amount to estimate complexity
        try:
            # Fill buffer for initial complexity estimation
            for segment in segment_gen:
                buffer.append(segment)
                buffer_size += len(segment)
                
                if buffer_size >= max_buffer_size:
                    break
        except Exception as e:
            logger.error(f"Error during initial buffering: {e}")
        
        try:
            # Determine initial strategy if we have buffered data
            if buffer:
                # Combine samples for better estimation
                sample_text = "".join(buffer[:min(5, len(buffer))])
                
                # Estimate complexity and select strategy
                complexity = self._estimate_complexity(sample_text, chunker_func)
                strategy = 'advanced' if complexity >= self.complexity_threshold else 'simple'
                
                logger.info(f"Selected '{strategy}' strategy for streaming (complexity: {complexity:.4f})")
                self.metrics.record_decision(strategy, None)
            else:
                # Default to simple for empty generator
                strategy = 'simple'
            
            # Process buffered segments
            if buffer:
                for segment in buffer:
                    # Update counters
                    processed_segments += 1
                    processed_bytes += len(segment)
                    
                    # Process with selected strategy
                    if strategy == 'simple':
                        # Simple direct processing
                        for chunk in chunker_func(segment):
                            produced_chunks += 1
                            yield chunk
                    else:
                        # Advanced processing via chunker
                        try:
                            for chunk in self.advanced_chunker.chunk_segments([segment], chunker_func):
                                produced_chunks += 1
                                yield chunk
                        except Exception as e:
                            logger.error(f"Error in advanced streaming: {e}, falling back to simple")
                            # Fallback to simple
                            for chunk in chunker_func(segment):
                                produced_chunks += 1
                                yield chunk
            
            # Process remaining stream
            for segment in segment_gen:
                # Update counters
                processed_segments += 1
                processed_bytes += len(segment)
                
                # Process with selected strategy
                if strategy == 'simple':
                    # Simple direct processing
                    for chunk in chunker_func(segment):
                        produced_chunks += 1
                        yield chunk
                else:
                    # Advanced processing via chunker
                    try:
                        for chunk in self.advanced_chunker.chunk_segments([segment], chunker_func):
                            produced_chunks += 1
                            yield chunk
                    except Exception as e:
                        logger.error(f"Error in advanced streaming: {e}, falling back to simple")
                        # Fallback to simple
                        for chunk in chunker_func(segment):
                            produced_chunks += 1
                            yield chunk
                
        except Exception as e:
            logger.error(f"Error during streaming: {e}")
            # We're already yielding, so we can't do much more than log the error
        finally:
            # Calculate processing time and update metrics
            processing_time = time.monotonic() - start_time
            self.metrics.add_processing_time(
                elapsed_time=processing_time,
                bytes_processed=processed_bytes,
                chunks_produced=produced_chunks
            )
            
            # Log results
            logger.info(
                f"Streamed {processed_segments} segments ({processed_bytes:,} bytes) in {processing_time:.2f}s "
                f"producing {produced_chunks} chunks (strategy: {strategy})"
            )
    
    def chunk_with_priority(self, text: str, chunker_func: ChunkerFunc, priority: str = 'normal') -> List[str]:
        """
        Priority-aware processing with QoS controls.
        
        Args:
            text: Text to chunk
            chunker_func: Function that chunks text
            priority: Priority level ('high', 'normal', 'background')
            
        Returns:
            List of processed chunks
        """
        # Validate priority
        if priority not in PRIORITY_LEVELS:
            logger.warning(f"Invalid priority '{priority}' - using 'normal'")
            priority = 'normal'
            
        # Get priority settings
        priority_settings = PRIORITY_LEVELS[priority]
        
        # Set up context with priority settings
        with self._priority_context(priority):
            # Use priority-specific timeout
            custom_timeout = priority_settings.get('timeout', DEFAULT_TIMEOUT)
            original_timeout = self.timeout
            self.timeout = custom_timeout
            
            # Use priority-specific retries
            custom_retries = priority_settings.get('retries', MAX_RETRIES)
            original_retries = self.max_retries
            self.max_retries = custom_retries
            
            try:
                # Process with priority settings
                logger.info(f"Processing with {priority} priority (timeout={custom_timeout}s, retries={custom_retries})")
                return self.chunk(text, chunker_func)
            finally:
                # Restore original settings
                self.timeout = original_timeout
                self.max_retries = original_retries
    
    def get_metrics(self) -> Dict[str, Any]:
        """
        Get comprehensive chunker performance metrics and system state.
        
        Returns:
            Dictionary of metrics and diagnostics
        """
        # Get base metrics
        metrics = self.metrics.to_dict()
        
        # Add system resource info
        metrics['system'] = {
            'health_status': self.health_status,
            'circuit_breaker': self.circuit_breaker_status,
            'cpu_count': self.resources.cpu_count,
            'logical_cores': self.resources.logical_cores,
            'memory_percent': self.resources.memory_percent,
            'system_load': self.resources.system_load,
        }
        
        # Add configuration
        metrics['config'] = {
            'size_threshold': self.size_threshold,
            'complexity_threshold': self.complexity_threshold,
            'memory_safety': self.memory_safety,
            'adaptive_batch_sizing': self.adaptive_batch_sizing,
            'timeout': self.timeout,
            'current_priority': self._current_priority,
        }
        
        return metrics
    
    def reset_metrics(self) -> None:
        """Reset performance metrics."""
        self.metrics = PerformanceMetrics()
        logger.info("Performance metrics reset")
    
    def shutdown(self) -> None:
        """
        Gracefully shut down the chunker and release resources.
        """
        logger.info("Shutting down SmartParallelChunker...")
        self._shutdown_event.set()
        
        # Wait for background threads to stop
        if hasattr(self, '_resource_monitor') and self._resource_monitor.is_alive():
            self._resource_monitor.join(timeout=2.0)
            
        # Stop config auto-update if running
        if hasattr(self.config, 'stop_auto_update'):
            self.config.stop_auto_update()
            
        # Release resources
        gc.collect()
        logger.info("Shutdown complete")

    def __enter__(self):
        """Context manager entry"""
        return self
        
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit with graceful shutdown"""
        self.shutdown()
        return False  # Don't suppress exceptions


def create_auto_chunker(
    options: ChunkingOptions,
    mode: str = "auto",
    memory_safety: bool = True,
    timeout: float = DEFAULT_TIMEOUT,
    config: Optional[DynamicConfig] = None,
    enable_metrics_server: bool = False,
    metrics_port: int = 8000,
) -> SmartParallelChunker:
    """
    Factory function to create a pre-configured chunker instance
    with optimized settings for different workloads.
    
    Args:
        options: Chunking configuration options
        mode: Operational mode ('auto', 'performance', 'balanced', 'memory-safe')
        memory_safety: Enable memory safety features
        timeout: Operation timeout in seconds
        config: Optional dynamic configuration instance
        enable_metrics_server: Enable Prometheus metrics server
        metrics_port: Port for metrics server
        
    Returns:
        Configured SmartParallelChunker instance
    """
    # Create config instance if not provided
    if config is None:
        config = DynamicConfig({
            'processing_timeout': timeout,
            'max_retries': MAX_RETRIES,
            'memory_safety': memory_safety,
            'dynamic_batch_sizing': True,
            'enable_ml_segmentation': False,  # Disabled by default
            'start_metrics_server': enable_metrics_server,
            'metrics_port': metrics_port,
        })
    elif enable_metrics_server and HAS_PROMETHEUS:
        # Update existing config
        config.set('start_metrics_server', True)
        config.set('metrics_port', metrics_port)
        
    # Detect system resources
    resources = ResourceInfo.detect()
    
    # Configure based on mode
    if mode == "performance":
        # Performance-optimized settings
        chunker = SmartParallelChunker(
            options=options,
            size_threshold=200_000,  # Higher threshold for simple chunker (200KB)
            complexity_threshold=0.3,  # More aggressive use of advanced chunker
            memory_safety=False,  # Disable memory safety checks for performance
            adaptive_batch_sizing=True,
            health_check_enabled=True,
            timeout=timeout,
            resource_monitor_interval=10.0,  # Less frequent monitoring
            config=config,
        )
    elif mode == "memory-safe":
        # Memory-conservative settings
        chunker = SmartParallelChunker(
            options=options,
            size_threshold=50_000,  # Lower threshold for simple chunker (50KB)
            complexity_threshold=0.7,  # Less aggressive use of advanced chunker
            memory_safety=True,
            adaptive_batch_sizing=True,
            health_check_enabled=True,
            timeout=timeout,
            resource_monitor_interval=2.0,  # More frequent monitoring
            config=config,
        )
    elif mode == "balanced":
        # Balanced settings
        chunker = SmartParallelChunker(
            options=options,
            size_threshold=100_000,  # Medium threshold (100KB)
            complexity_threshold=0.5,  # Balanced use of advanced chunker
            memory_safety=memory_safety,
            adaptive_batch_sizing=True,
            health_check_enabled=True,
            timeout=timeout,
            resource_monitor_interval=5.0,
            config=config,
        )
    else:  # "auto" or any other value
        # Auto-configured based on system resources
        cpu_count = resources.cpu_count or os.cpu_count() or 4
        memory_gb = (resources.memory_total or 8 * 1024**3) / 1024**3
        
        # Determine settings based on system capabilities
        if cpu_count >= 8 and memory_gb >= 16:
            # High-end system - favor performance
            chunker = SmartParallelChunker(
                options=options,
                size_threshold=150_000,  # 150KB
                complexity_threshold=0.4,
                memory_safety=memory_safety,
                adaptive_batch_sizing=True,
                health_check_enabled=True,
                timeout=timeout,
                config=config,
            )
        elif cpu_count <= 2 or memory_gb <= 4:
            # Low-end system - conservative settings
            chunker = SmartParallelChunker(
                options=options,
                size_threshold=30_000,  # 30KB
                complexity_threshold=0.7,
                memory_safety=True,
                adaptive_batch_sizing=True,
                health_check_enabled=True,
                timeout=timeout,
                config=config,
            )
        else:
            # Medium system - balanced settings
            chunker = SmartParallelChunker(
                options=options,
                size_threshold=100_000,  # 100KB
                complexity_threshold=0.5,
                memory_safety=memory_safety,
                adaptive_batch_sizing=True,
                health_check_enabled=True,
                timeout=timeout,
                config=config,
            )
            
    return chunker


def start_monitoring_server(port: int = 8000) -> bool:
    """
    Start Prometheus metrics server for external monitoring.
    
    Args:
        port: HTTP port for metrics server
        
    Returns:
        Success status
    """
    if not HAS_PROMETHEUS:
        logger.warning("Prometheus client not available - cannot start metrics server")
        return False
        
    try:
        start_http_server(port)
        logger.info(f"Metrics server started on port {port}")
        return True
    except Exception as e:
        logger.error(f"Failed to start metrics server: {e}")
        return False
