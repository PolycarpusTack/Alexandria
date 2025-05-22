"""
Hyperion Resource Monitor

An advanced enterprise-grade resource monitoring and management system with
cross-environment optimization, resilience patterns, and extensive integrations.
"""

__version__ = "2.0.0"

import logging
import os
import sys

# Configure default logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s [Hyperion] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

# Import core components for easy access
from .core import HyperionCore
from .decorators import with_resource_control, with_adaptive_timeout, with_batch_processing
from .metrics import MetricsCollector
from .adaptation import AdaptationManager, ConservativeStrategy, AggressiveStrategy, BalancedStrategy
from .resilience import ResilienceManager, CircuitBreaker, AdaptiveBackoff, RateLimiter
from .lifecycle import LifecycleManager, ShutdownManager, StartupManager
from .config import DynamicConfig, ConfigValidator
from .observability import ObservabilityManager, TraceContext, trace
from .security import SecurityManager, Permission
from .integration import IntegrationManager, IntegrationType
from .visualization import VisualizationManager

# Optional module imports - these might not be available
try:
    from .cloud import CloudIntegration
    HAS_CLOUD = True
except ImportError:
    HAS_CLOUD = False

try:
    from .container import ContainerMonitor
    HAS_CONTAINER = True
except ImportError:
    HAS_CONTAINER = False

try:
    from .energy import EnergyMonitor
    HAS_ENERGY = True
except ImportError:
    HAS_ENERGY = False

try:
    from .ml import MLIntegration
    HAS_ML = True
except ImportError:
    HAS_ML = False

# Global instances for convenience
core = None
config = None
lifecycle = None
resilience = None
observability = None
security = None
integration = None
visualization = None

# Initialize logger
logger = logging.getLogger(__name__)


async def initialize(config_path: str = None, **kwargs):
    """
    Initialize Hyperion with the specified configuration
    
    Args:
        config_path: Path to configuration file
        **kwargs: Additional configuration options
        
    Returns:
        Initialized HyperionCore instance
    """
    global core, config, lifecycle, resilience, observability, security, integration, visualization
    
    # Initialize configuration
    config = DynamicConfig(
        config_source='file' if config_path else 'env',
        config_path=config_path
    )
    
    # Create lifecycle manager
    lifecycle = LifecycleManager()
    
    # Create HyperionCore with combined configuration
    combined_config = {**config.get_all(), **kwargs}
    core = HyperionCore(combined_config)
    
    # Initialize resilience manager
    resilience = ResilienceManager()
    
    # Initialize observability manager
    observability = ObservabilityManager()
    
    # Initialize security manager
    security = SecurityManager()
    
    # Initialize integration manager
    integration = IntegrationManager()
    
    # Initialize visualization manager
    visualization = VisualizationManager()
    
    # Start watching for configuration changes
    await config.start_config_watcher()
    
    # Start the core monitor
    await core.start()
    
    # Register shutdown handler
    lifecycle.register_shutdown_handler(
        shutdown,
        priority=100,
        name="hyperion_shutdown"
    )
    
    logger.info(f"Hyperion v{__version__} initialized")
    
    return core


async def shutdown():
    """
    Shutdown all Hyperion components
    """
    global core, config, lifecycle, integration
    
    logger.info("Shutting down Hyperion")
    
    # Stop configuration watcher
    if config:
        await config.stop_config_watcher()
    
    # Shutdown integrations
    if integration:
        await integration.shutdown_all()
    
    # Stop the core monitor
    if core:
        await core.stop()
    
    logger.info("Hyperion shutdown complete")


class Hyperion:
    """
    Unified Hyperion API
    
    Provides a unified interface to all Hyperion components.
    """
    
    @staticmethod
    async def initialize(config_path: str = None, **kwargs):
        """
        Initialize Hyperion
        
        Args:
            config_path: Path to configuration file
            **kwargs: Additional configuration options
            
        Returns:
            Hyperion instance
        """
        await initialize(config_path, **kwargs)
        return Hyperion()
    
    @property
    def core(self):
        """Get HyperionCore instance"""
        return core
    
    @property
    def status(self):
        """Get current system status"""
        if core:
            return core.status
        return None
    
    @property
    def config(self):
        """Get configuration manager"""
        return config
    
    @property
    def resilience(self):
        """Get resilience manager"""
        return resilience
    
    @property
    def lifecycle(self):
        """Get lifecycle manager"""
        return lifecycle
    
    @property
    def observability(self):
        """Get observability manager"""
        return observability
    
    @property
    def security(self):
        """Get security manager"""
        return security
    
    @property
    def integration(self):
        """Get integration manager"""
        return integration
    
    @property
    def visualization(self):
        """Get visualization manager"""
        return visualization
    
    async def shutdown(self):
        """Shutdown Hyperion"""
        await shutdown()
    
    def create_circuit_breaker(self, name: str, **kwargs):
        """
        Create a circuit breaker
        
        Args:
            name: Circuit breaker name
            **kwargs: Circuit breaker parameters
            
        Returns:
            CircuitBreaker instance
        """
        return resilience.create_circuit_breaker(name, **kwargs)
    
    def create_rate_limiter(self, name: str, rate: float, **kwargs):
        """
        Create a rate limiter
        
        Args:
            name: Rate limiter name
            rate: Operations per second
            **kwargs: Rate limiter parameters
            
        Returns:
            RateLimiter instance
        """
        return resilience.create_rate_limiter(name, rate, **kwargs)
    
    def create_backoff_strategy(self, name: str, **kwargs):
        """
        Create an adaptive backoff strategy
        
        Args:
            name: Backoff strategy name
            **kwargs: Backoff strategy parameters
            
        Returns:
            AdaptiveBackoff instance
        """
        return resilience.create_backoff_strategy(name, **kwargs)
    
    async def register_integration(self, name: str, integration_type: IntegrationType, config: dict):
        """
        Register an external integration
        
        Args:
            name: Integration name
            integration_type: Type of integration
            config: Integration configuration
            
        Returns:
            True if successful
        """
        return integration.register_integration(name, integration_type, config)
    
    async def create_visualization(self, data: dict, visualization_type: str, **kwargs):
        """
        Create a visualization
        
        Args:
            data: Data to visualize
            visualization_type: Type of visualization
            **kwargs: Visualization options
            
        Returns:
            Visualization result
        """
        return await visualization.create_visualization(data, visualization_type, **kwargs)
    
    @trace("hyperion.send_alert")
    async def send_alert(self, title: str, message: str, severity: str = "warning", **kwargs):
        """
        Send an alert through configured integrations
        
        Args:
            title: Alert title
            message: Alert message
            severity: Alert severity (critical, error, warning, info)
            **kwargs: Additional alert parameters
            
        Returns:
            Dictionary of integration name -> success status
        """
        alert = {
            'title': title,
            'message': message,
            'severity': severity,
            **kwargs
        }
        
        return await integration.send_alert(alert)
    
    @trace("hyperion.trace_context")
    def trace_context(self, name: str):
        """
        Create a trace context for distributed tracing
        
        Args:
            name: Context name
            
        Returns:
            TraceContext instance
        """
        return observability.trace_context(name)
