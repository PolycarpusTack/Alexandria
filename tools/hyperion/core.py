"""
Hyperion Resource Monitor - Core Module

Provides the base resource monitoring and adaptive control capabilities with
cross-environment optimization.
"""

import asyncio
import logging
import os
import platform
import time
from functools import wraps
from typing import Any, Callable, Dict, List, Optional, Tuple, Union

# Optional dependencies
try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False

try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False

logger = logging.getLogger(__name__)

# Constants
DEFAULT_CHECK_INTERVAL = 3.0
MEMORY_HIGH_THRESHOLD = 0.85  # 85%
MEMORY_CRITICAL_THRESHOLD = 0.95  # 95%
CPU_HIGH_THRESHOLD = 0.8  # 80%
BASE_TIMEOUT = 30.0  # seconds


class HyperionCore:
    """
    Core resource monitoring and management capabilities.
    
    This is the foundation of the Hyperion monitoring system, providing
    basic resource tracking and adaptive control across different environments.
    """
    
    def __init__(
        self,
        config: Optional[Dict[str, Any]] = None
    ):
        self.config = {
            'check_interval': DEFAULT_CHECK_INTERVAL,
            'max_workers': None,
            'environment': 'auto',
            'auto_recover': True,
            'adaptive_scaling': True,
            ** (config or {})
        }

        # Environment detection
        self.environment = self._detect_environment()
        self.is_laptop = self._detect_laptop()
        self.is_container = self._detect_container()
        self.cloud_provider = self._detect_cloud_provider()

        # Resource tracking
        self._metrics = self._init_metrics()
        self._historical_data = []
        self._current_cpu = 0.0
        self._current_mem = 0.0
        self._last_warning_time = 0.0
        self._last_params = {}

        # State management
        self._current_state = 'normal'
        self._previous_state = None
        self._state_transition_count = 0

        # Initialize platform-specific components
        self._init_platform()
        self._init_concurrency()
        self._log_system_info()

    def _init_platform(self):
        """Initialize platform-specific components"""
        self.process = psutil.Process(os.getpid()) if PSUTIL_AVAILABLE else None
        self._cpu_count = os.cpu_count() or 1

    def _init_concurrency(self):
        """Initialize concurrency control parameters"""
        # Calculate initial workers based on environment
        self.max_workers = self._calculate_initial_workers()
        self._previous_workers = self.max_workers
        
        # Initialize adaptive parameters based on device type
        if self.is_laptop:
            self.chunk_size = 512 * 1024  # 512KB for laptops
            self.batch_size = 4
            self.timeout_factor = 1.5
        else:
            self.chunk_size = 2 * 1024 * 1024  # 2MB for servers
            self.batch_size = 8
            self.timeout_factor = 1.0
            
        self._previous_chunk = self.chunk_size
        self._previous_batch = self.batch_size
        
        # Concurrency control
        self.semaphore = asyncio.Semaphore(self.max_workers)
        self.current_workers = 0
        self.peak_workers = 0

    def _log_system_info(self):
        """Log system and configuration information"""
        logger.info(
            f"Hyperion initialized: "
            f"environment={self.environment}, "
            f"cloud_provider={self.cloud_provider}, "
            f"container={self.is_container}, "
            f"laptop={self.is_laptop}, "
            f"max_workers={self.max_workers}"
        )

    def _detect_environment(self) -> str:
        """Identify execution environment"""
        # Use manual configuration if provided
        if self.config['environment'] != 'auto':
            return self.config['environment']
            
        env_order = ['container', 'cloud', 'server', 'laptop']
        
        # Container detection
        if os.path.exists('/.dockerenv'):
            return 'container'
            
        # Cloud detection
        if self._detect_cloud_provider():
            return 'cloud'
            
        # Server vs laptop
        if self._detect_laptop():
            return 'laptop'
            
        return 'server'

    def _detect_container(self) -> bool:
        """Detect if running in a container environment"""
        # Check for common container indicators
        return os.path.exists('/.dockerenv') or os.path.exists('/run/.containerenv')

    def _detect_laptop(self) -> bool:
        """Determine if running on a laptop"""
        if not PSUTIL_AVAILABLE:
            return False
            
        try:
            # Battery presence is a strong indicator of a laptop
            if psutil.sensors_battery() is not None:
                return True
                
            # Linux-specific detection via DMI chassis type
            if platform.system() == "Linux":
                chassis_path = "/sys/class/dmi/id/chassis_type"
                if os.path.exists(chassis_path):
                    with open(chassis_path) as f:
                        chassis_type = f.read().strip()
                        # Types 8, 9, 10, 14 are laptops/notebooks
                        if chassis_type in ('8', '9', '10', '14'):
                            return True
                    
            # MacOS detection - check for MacBook in model
            if platform.system() == "Darwin":
                import subprocess
                model = subprocess.check_output(["sysctl", "-n", "hw.model"]).decode().strip()
                if "MacBook" in model:
                    return True
                    
            return False
        except Exception:
            logger.debug("Laptop detection failed", exc_info=True)
            return False

    def _detect_cloud_provider(self) -> Optional[str]:
        """Identify cloud provider"""
        if not HAS_REQUESTS:
            return None
            
        providers = {
            'aws': {
                'url': 'http://169.254.169.254/latest/meta-data/',
                'headers': {}
            },
            'gcp': {
                'url': 'http://metadata.google.internal/computeMetadata/v1/',
                'headers': {'Metadata-Flavor': 'Google'}
            },
            'azure': {
                'url': 'http://169.254.169.254/metadata/instance',
                'headers': {'Metadata': 'true'}
            }
        }
        
        for provider, config in providers.items():
            try:
                response = requests.get(
                    config['url'], 
                    headers=config['headers'], 
                    timeout=0.5
                )
                if response.status_code < 400:
                    return provider
            except requests.exceptions.RequestException:
                continue
        return None

    def _calculate_initial_workers(self) -> int:
        """Smart worker initialization across environments"""
        if self.config.get('max_workers'):
            return self.config['max_workers']
            
        base = self._cpu_count
        modifiers = {
            'container': 0.5,  # Conservative in containers
            'cloud': 1.5,      # Aggressive in cloud
            'server': 1.2,     # Moderate on servers
            'laptop': 0.7      # Conservative on laptops
        }
        
        # Get the appropriate modifier with a default
        modifier = modifiers.get(self.environment, 1.0)
        
        # Calculate and bound the workers
        workers = max(1, int(base * modifier))
        
        # Further restrict on laptops
        if self.is_laptop:
            workers = min(workers, base - 1) or 1
            
        return workers

    def _init_metrics(self) -> Dict[str, Any]:
        """Initialize metrics collection structure"""
        return {
            'cpu': {'current': 0.0, 'history': []},
            'memory': {'current': 0.0, 'history': []},
            'network': {'sent': 0, 'recv': 0},
            'disk': {'read': 0, 'write': 0},
            'gpu': {}  # Placeholder for GPU monitoring
        }

    async def start(self):
        """Start background monitoring"""
        if not hasattr(self, '_monitor_task'):
            self._monitor_task = asyncio.create_task(self._monitor_loop())
            logger.info("Hyperion monitoring started")

    async def stop(self):
        """Stop background monitoring"""
        if hasattr(self, '_monitor_task'):
            self._monitor_task.cancel()
            try:
                await self._monitor_task
                logger.info("Hyperion monitoring stopped")
            except asyncio.CancelledError:
                pass

    async def _monitor_loop(self):
        """Main monitoring loop"""
        while True:
            try:
                await self._collect_metrics()
                await self._analyze_metrics()
                await self._adjust_parameters()
                await asyncio.sleep(self.config['check_interval'])
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Monitoring error: {str(e)}", exc_info=True)
                await asyncio.sleep(self.config['check_interval'] * 2)

    async def _collect_metrics(self):
        """Collect comprehensive system metrics"""
        if PSUTIL_AVAILABLE:
            try:
                # CPU and Memory
                self._current_cpu = psutil.cpu_percent(interval=0.1) / 100
                self._metrics['cpu']['current'] = self._current_cpu
                
                vm = psutil.virtual_memory()
                self._current_mem = vm.used / vm.total
                self._metrics['memory']['current'] = self._current_mem

                # Network and Disk
                net = psutil.net_io_counters()
                disk = psutil.disk_io_counters()
                self._metrics['network']['sent'] = net.bytes_sent
                self._metrics['network']['recv'] = net.bytes_recv
                self._metrics['disk']['read'] = disk.read_bytes
                self._metrics['disk']['write'] = disk.write_bytes

                # Store historical data for trend analysis
                self._store_historical()
            except Exception as e:
                logger.warning(f"Metrics collection failed: {str(e)}")

    def _store_historical(self):
        """Store current metrics in historical data"""
        timestamp = time.time()
        historical_entry = {
            'timestamp': timestamp,
            'cpu': self._current_cpu,
            'memory': self._current_mem,
            'workers': self.current_workers,
            'state': self._current_state
        }
        
        self._historical_data.append(historical_entry)
        
        # Keep a reasonable history (last hour at default interval)
        max_entries = int(3600 / self.config['check_interval'])
        if len(self._historical_data) > max_entries:
            self._historical_data.pop(0)
            
        # Also update the metrics history arrays
        self._metrics['cpu']['history'].append((timestamp, self._current_cpu))
        self._metrics['memory']['history'].append((timestamp, self._current_mem))
        
        # Trim metric histories
        max_history = 100  # Keep last 100 points
        if len(self._metrics['cpu']['history']) > max_history:
            self._metrics['cpu']['history'].pop(0)
            self._metrics['memory']['history'].pop(0)

    async def _analyze_metrics(self):
        """Analyze metrics for trends and patterns"""
        # Skip if not enough data
        if len(self._historical_data) < 5:
            return
            
        try:
            self._analyze_trends()
        except Exception as e:
            logger.warning(f"Trend analysis failed: {str(e)}")

    def _analyze_trends(self):
        """Analyze resource usage trends"""
        # Calculate simple moving average for CPU and memory
        recent = self._historical_data[-5:]
        cpu_avg = sum(entry['cpu'] for entry in recent) / len(recent)
        mem_avg = sum(entry['memory'] for entry in recent) / len(recent)
        
        # Compare with previous average (if we have enough history)
        if len(self._historical_data) >= 10:
            previous = self._historical_data[-10:-5]
            prev_cpu_avg = sum(entry['cpu'] for entry in previous) / len(previous)
            prev_mem_avg = sum(entry['memory'] for entry in previous) / len(previous)
            
            # Calculate trends (positive means increasing usage)
            cpu_trend = cpu_avg - prev_cpu_avg
            mem_trend = mem_avg - prev_mem_avg
            
            # Predictive scaling based on trends
            if self.config['adaptive_scaling']:
                if cpu_trend > 0.1 or mem_trend > 0.1:
                    self._predictive_scaling('up')
                elif cpu_trend < -0.1 and mem_trend < -0.05:
                    self._predictive_scaling('down')

    def _predictive_scaling(self, direction: str):
        """Adjust resources based on predicted needs"""
        current = self.max_workers
        
        if direction == 'up' and current < self._cpu_count * 2:
            # Increase by 25% but ensure at least 1 worker increase
            adjustment = max(current + 1, int(current * 1.25))
            adjustment = min(adjustment, self._cpu_count * 2)  # Upper bound
            self._update_workers(adjustment)
            
        elif direction == 'down' and current > 1:
            # Decrease by 20% but ensure at least 1 worker remains
            adjustment = max(1, int(current * 0.8))
            self._update_workers(adjustment)
            
        if current != self.max_workers:
            logger.info(f"Predictive scaling: {direction} to {self.max_workers} workers")

    async def _adjust_parameters(self):
        """Adjust processing parameters based on system state"""
        new_state = self._determine_system_state()
        
        # Only log state transitions
        if new_state != self._current_state:
            logger.warning(
                f"System state changed: {self._current_state} → {new_state} "
                f"(CPU: {self._current_cpu:.1%}, Mem: {self._current_mem:.1%})"
            )
            self._previous_state = self._current_state
            self._current_state = new_state
            self._state_transition_count += 1
        
        # Apply state-specific adjustments
        if new_state == "critical":
            self._apply_critical_settings()
        elif new_state == "high":
            self._apply_high_load_settings()
        elif new_state == "normal" and self.config['auto_recover']:
            self._recover_normal_settings()

        # Log parameter changes only when they occur
        self._log_parameter_changes()

    def _determine_system_state(self) -> str:
        """Classify current system state"""
        if self._current_mem >= MEMORY_CRITICAL_THRESHOLD:
            return "critical"
        if (self._current_cpu >= CPU_HIGH_THRESHOLD or 
            self._current_mem >= MEMORY_HIGH_THRESHOLD):
            return "high"
        return "normal"

    def _apply_critical_settings(self):
        """Apply settings for critical memory conditions"""
        new_workers = max(1, self.max_workers // 4)
        self._update_workers(new_workers)
        self.chunk_size = 128 * 1024
        self.batch_size = 1
        self.timeout_factor = 2.0

    def _apply_high_load_settings(self):
        """Apply settings for high load conditions"""
        new_workers = max(1, self.max_workers // 2)
        self._update_workers(new_workers)
        self.chunk_size = 256 * 1024
        self.batch_size = 2
        self.timeout_factor = 1.5

    def _recover_normal_settings(self):
        """Gradually recover normal settings"""
        if self.max_workers < self._previous_workers:
            new_workers = min(self._previous_workers, self.max_workers + 1)
            self._update_workers(new_workers)
            
        if self.chunk_size < self._previous_chunk:
            self.chunk_size = min(self._previous_chunk, self.chunk_size * 2)
            
        if self.batch_size < self._previous_batch:
            self.batch_size = min(self._previous_batch, self.batch_size + 1)

    def _update_workers(self, new_workers: int):
        """Update worker count with change detection"""
        if new_workers != self.max_workers:
            self.max_workers = new_workers
            self.semaphore = asyncio.Semaphore(new_workers)

    def _log_parameter_changes(self):
        """Log parameter changes only when they occur"""
        current_params = {
            'workers': self.max_workers,
            'chunk': self.chunk_size,
            'batch': self.batch_size,
            'timeout_factor': self.timeout_factor
        }
        
        if current_params != self._last_params:
            logger.info(
                "Current parameters: workers=%d, chunk=%d, batch=%d, timeout_factor=%.1f",
                self.max_workers, self.chunk_size, 
                self.batch_size, self.timeout_factor
            )
            self._last_params = current_params

    def calculate_timeout(self, content_length: int) -> float:
        """
        Calculate adaptive timeout based on content and system load
        
        Args:
            content_length: Length of content to process in characters
            
        Returns:
            Adjusted timeout in seconds
        """
        if content_length <= 0:
            return BASE_TIMEOUT
            
        # Content-based scaling
        content_factor = min(3.0, max(1.0, content_length / 1e4))
        
        # System load adjustment
        load_factor = 1.0 + (self._current_cpu * 0.5) + (self._current_mem * 0.5)
        
        # Environment-specific adjustments
        env_factors = {
            'container': 1.2,
            'cloud': 1.0,
            'server': 0.8,
            'laptop': 1.5
        }
        
        # Get the appropriate env factor with a default
        env_factor = env_factors.get(self.environment, 1.0)
        
        # Combine factors with base timeout
        timeout = BASE_TIMEOUT * content_factor * load_factor * env_factor * self.timeout_factor
        
        # Apply safety bounds
        return max(5.0, min(timeout, 300.0))  # Between 5-300 seconds

    async def acquire(self):
        """Acquire resource slot"""
        await self.semaphore.acquire()
        self.current_workers += 1
        self.peak_workers = max(self.peak_workers, self.current_workers)

    def release(self):
        """Release resource slot"""
        self.semaphore.release()
        self.current_workers = max(0, self.current_workers - 1)

    @property
    def status(self) -> Dict[str, Any]:
        """Current system status snapshot"""
        return {
            'environment': self.environment,
            'cloud_provider': self.cloud_provider,
            'container': self.is_container,
            'laptop': self.is_laptop,
            'cpu_load': self._current_cpu,
            'memory_usage': self._current_mem,
            'workers': {
                'current': self.current_workers,
                'max': self.max_workers,
                'peak': self.peak_workers,
            },
            'system_state': self._current_state,
            'parameters': {
                'chunk_size': self.chunk_size,
                'batch_size': self.batch_size,
                'timeout_factor': self.timeout_factor
            }
        }
