"""
Hyperion Resource Monitor - Adaptation Module

Provides enhanced adaptation mechanisms for intelligent resource management
under varying conditions and constraints.
"""

import asyncio
import gc
import logging
import time
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


class AdaptationStrategy:
    """
    Base class for resource adaptation strategies
    
    Adaptation strategies provide customized resource allocation behaviors
    for different environments and conditions.
    """
    
    def __init__(self, name: str):
        """
        Initialize adaptation strategy
        
        Args:
            name: Strategy name
        """
        self.name = name
        
    async def adapt(
        self,
        metrics: Dict[str, float],
        current_resources: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Apply adaptation strategy
        
        Args:
            metrics: Current system metrics
            current_resources: Current resource allocation
            
        Returns:
            Updated resource allocation
        """
        # Base implementation - no changes
        return current_resources


class ConservativeStrategy(AdaptationStrategy):
    """
    Conservative adaptation strategy
    
    Prioritizes stability over resource utilization, using gradual
    adjustments and maintaining resource headroom.
    """
    
    def __init__(self):
        """Initialize conservative strategy"""
        super().__init__("conservative")
        
    async def adapt(
        self,
        metrics: Dict[str, float],
        current_resources: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Apply conservative adaptation strategy
        
        Args:
            metrics: Current system metrics
            current_resources: Current resource allocation
            
        Returns:
            Updated resource allocation
        """
        cpu_usage = metrics.get('cpu', 0.0)
        memory_usage = metrics.get('memory', 0.0)
        
        # Get current values with defaults
        max_workers = current_resources.get('max_workers', 1)
        chunk_size = current_resources.get('chunk_size', 1024 * 1024)
        batch_size = current_resources.get('batch_size', 4)
        
        # Create new resources dictionary
        resources = current_resources.copy()
        
        # Apply conservative adjustments
        
        # Very high resource usage - reduce allocation
        if memory_usage > 0.85 or cpu_usage > 0.9:
            resources['max_workers'] = max(1, int(max_workers * 0.8))
            resources['chunk_size'] = max(1024, int(chunk_size * 0.7))
            resources['batch_size'] = max(1, int(batch_size * 0.7))
            logger.info(
                f"Conservative strategy: reducing resources due to high usage "
                f"(CPU: {cpu_usage:.1%}, Memory: {memory_usage:.1%})"
            )
            
        # High resource usage - slight reduction
        elif memory_usage > 0.75 or cpu_usage > 0.8:
            resources['max_workers'] = max(1, int(max_workers * 0.9))
            resources['chunk_size'] = max(2048, int(chunk_size * 0.8))
            resources['batch_size'] = max(1, int(batch_size * 0.8))
            logger.info(
                f"Conservative strategy: slightly reducing resources "
                f"(CPU: {cpu_usage:.1%}, Memory: {memory_usage:.1%})"
            )
            
        # Very low resource usage - small increase
        elif memory_usage < 0.3 and cpu_usage < 0.3:
            # Only increase if stable for a while
            # In a real implementation, would track stability over time
            resources['max_workers'] = max_workers + 1
            resources['chunk_size'] = min(8 * 1024 * 1024, int(chunk_size * 1.1))
            resources['batch_size'] = min(16, batch_size + 1)
            logger.info(
                f"Conservative strategy: slightly increasing resources "
                f"(CPU: {cpu_usage:.1%}, Memory: {memory_usage:.1%})"
            )
        
        return resources


class AggressiveStrategy(AdaptationStrategy):
    """
    Aggressive adaptation strategy
    
    Prioritizes resource utilization over stability, with rapid
    adjustments to maximize throughput.
    """
    
    def __init__(self):
        """Initialize aggressive strategy"""
        super().__init__("aggressive")
        
    async def adapt(
        self,
        metrics: Dict[str, float],
        current_resources: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Apply aggressive adaptation strategy
        
        Args:
            metrics: Current system metrics
            current_resources: Current resource allocation
            
        Returns:
            Updated resource allocation
        """
        cpu_usage = metrics.get('cpu', 0.0)
        memory_usage = metrics.get('memory', 0.0)
        cpu_count = metrics.get('cpu_count', 4)
        
        # Get current values with defaults
        max_workers = current_resources.get('max_workers', 1)
        chunk_size = current_resources.get('chunk_size', 1024 * 1024)
        batch_size = current_resources.get('batch_size', 4)
        
        # Create new resources dictionary
        resources = current_resources.copy()
        
        # Apply aggressive adjustments
        
        # Critical resource usage - significant reduction
        if memory_usage > 0.9 or cpu_usage > 0.95:
            resources['max_workers'] = max(1, int(max_workers * 0.6))
            resources['chunk_size'] = max(1024, int(chunk_size * 0.5))
            resources['batch_size'] = max(1, int(batch_size * 0.5))
            logger.info(
                f"Aggressive strategy: significantly reducing resources due to critical usage "
                f"(CPU: {cpu_usage:.1%}, Memory: {memory_usage:.1%})"
            )
            
        # High resource usage - moderate reduction
        elif memory_usage > 0.8 or cpu_usage > 0.85:
            resources['max_workers'] = max(1, int(max_workers * 0.7))
            resources['chunk_size'] = max(2048, int(chunk_size * 0.7))
            resources['batch_size'] = max(1, int(batch_size * 0.7))
            logger.info(
                f"Aggressive strategy: reducing resources "
                f"(CPU: {cpu_usage:.1%}, Memory: {memory_usage:.1%})"
            )
            
        # Moderate resource usage - small reduction
        elif memory_usage > 0.7 or cpu_usage > 0.75:
            resources['max_workers'] = max(1, int(max_workers * 0.9))
            resources['chunk_size'] = max(4096, int(chunk_size * 0.9))
            resources['batch_size'] = max(1, int(batch_size * 0.9))
            logger.info(
                f"Aggressive strategy: slightly reducing resources "
                f"(CPU: {cpu_usage:.1%}, Memory: {memory_usage:.1%})"
            )
            
        # Low resource usage - significant increase
        elif memory_usage < 0.4 and cpu_usage < 0.4:
            # Aggressive scaling, but still limit by CPU count
            resources['max_workers'] = min(cpu_count * 2, max_workers + 2)
            resources['chunk_size'] = min(16 * 1024 * 1024, int(chunk_size * 1.3))
            resources['batch_size'] = min(32, batch_size + 2)
            logger.info(
                f"Aggressive strategy: significantly increasing resources "
                f"(CPU: {cpu_usage:.1%}, Memory: {memory_usage:.1%})"
            )
            
        # Very low resource usage - moderate increase
        elif memory_usage < 0.6 and cpu_usage < 0.6:
            resources['max_workers'] = min(cpu_count * 2, max_workers + 1)
            resources['chunk_size'] = min(12 * 1024 * 1024, int(chunk_size * 1.15))
            resources['batch_size'] = min(24, batch_size + 1)
            logger.info(
                f"Aggressive strategy: increasing resources "
                f"(CPU: {cpu_usage:.1%}, Memory: {memory_usage:.1%})"
            )
        
        return resources


class BalancedStrategy(AdaptationStrategy):
    """
    Balanced adaptation strategy
    
    Provides a middle ground between conservative and aggressive,
    with moderate adjustments based on resource utilization.
    """
    
    def __init__(self):
        """Initialize balanced strategy"""
        super().__init__("balanced")
        
    async def adapt(
        self,
        metrics: Dict[str, float],
        current_resources: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Apply balanced adaptation strategy
        
        Args:
            metrics: Current system metrics
            current_resources: Current resource allocation
            
        Returns:
            Updated resource allocation
        """
        cpu_usage = metrics.get('cpu', 0.0)
        memory_usage = metrics.get('memory', 0.0)
        cpu_count = metrics.get('cpu_count', 4)
        
        # Get current values with defaults
        max_workers = current_resources.get('max_workers', 1)
        chunk_size = current_resources.get('chunk_size', 1024 * 1024)
        batch_size = current_resources.get('batch_size', 4)
        
        # Create new resources dictionary
        resources = current_resources.copy()
        
        # Apply balanced adjustments
        
        # Critical resource usage - significant reduction
        if memory_usage > 0.9 or cpu_usage > 0.95:
            resources['max_workers'] = max(1, int(max_workers * 0.7))
            resources['chunk_size'] = max(1024, int(chunk_size * 0.6))
            resources['batch_size'] = max(1, int(batch_size * 0.6))
            logger.info(
                f"Balanced strategy: significantly reducing resources due to critical usage "
                f"(CPU: {cpu_usage:.1%}, Memory: {memory_usage:.1%})"
            )
            
        # High resource usage - moderate reduction
        elif memory_usage > 0.8 or cpu_usage > 0.85:
            resources['max_workers'] = max(1, int(max_workers * 0.8))
            resources['chunk_size'] = max(2048, int(chunk_size * 0.8))
            resources['batch_size'] = max(1, int(batch_size * 0.8))
            logger.info(
                f"Balanced strategy: reducing resources "
                f"(CPU: {cpu_usage:.1%}, Memory: {memory_usage:.1%})"
            )
            
        # Low resource usage - moderate increase
        elif memory_usage < 0.4 and cpu_usage < 0.4:
            resources['max_workers'] = min(cpu_count + 2, max_workers + 1)
            resources['chunk_size'] = min(8 * 1024 * 1024, int(chunk_size * 1.2))
            resources['batch_size'] = min(16, batch_size + 1)
            logger.info(
                f"Balanced strategy: increasing resources "
                f"(CPU: {cpu_usage:.1%}, Memory: {memory_usage:.1%})"
            )
            
        # Very low resource usage - small increase
        elif memory_usage < 0.6 and cpu_usage < 0.6:
            resources['max_workers'] = min(cpu_count + 1, max_workers + 1)
            resources['chunk_size'] = min(4 * 1024 * 1024, int(chunk_size * 1.1))
            resources['batch_size'] = min(12, batch_size + 1)
            logger.info(
                f"Balanced strategy: slightly increasing resources "
                f"(CPU: {cpu_usage:.1%}, Memory: {memory_usage:.1%})"
            )
        
        return resources


class EnergyEfficientStrategy(AdaptationStrategy):
    """
    Energy-efficient adaptation strategy
    
    Prioritizes energy efficiency over raw performance, intended for
    battery-powered or power-constrained environments.
    """
    
    def __init__(self):
        """Initialize energy-efficient strategy"""
        super().__init__("energy_efficient")
        
    async def adapt(
        self,
        metrics: Dict[str, float],
        current_resources: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Apply energy-efficient adaptation strategy
        
        Args:
            metrics: Current system metrics
            current_resources: Current resource allocation
            
        Returns:
            Updated resource allocation
        """
        cpu_usage = metrics.get('cpu', 0.0)
        memory_usage = metrics.get('memory', 0.0)
        battery_level = metrics.get('battery_level', 1.0)  # 0.0-1.0
        on_battery = metrics.get('on_battery', False)
        
        # Get current values with defaults
        max_workers = current_resources.get('max_workers', 1)
        chunk_size = current_resources.get('chunk_size', 1024 * 1024)
        batch_size = current_resources.get('batch_size', 4)
        
        # Create new resources dictionary
        resources = current_resources.copy()
        
        # If not on battery, use balanced strategy
        if not on_battery:
            # Only slightly conservative when plugged in
            if memory_usage > 0.8 or cpu_usage > 0.85:
                resources['max_workers'] = max(1, int(max_workers * 0.8))
                resources['chunk_size'] = max(2048, int(chunk_size * 0.8))
                resources['batch_size'] = max(1, int(batch_size * 0.8))
            elif memory_usage < 0.4 and cpu_usage < 0.4:
                resources['max_workers'] = max_workers + 1
                resources['chunk_size'] = min(8 * 1024 * 1024, int(chunk_size * 1.1))
                resources['batch_size'] = min(16, batch_size + 1)
            return resources
        
        # Apply energy-efficient adjustments when on battery
        
        # Critical battery - maximum power saving
        if battery_level < 0.1:
            resources['max_workers'] = 1
            resources['chunk_size'] = max(512, int(chunk_size * 0.3))
            resources['batch_size'] = 1
            logger.info(
                f"Energy-efficient strategy: critical battery level ({battery_level:.0%}), "
                f"maximizing power saving"
            )
            
        # Low battery - aggressive power saving
        elif battery_level < 0.3:
            resources['max_workers'] = max(1, int(max_workers * 0.5))
            resources['chunk_size'] = max(1024, int(chunk_size * 0.5))
            resources['batch_size'] = max(1, int(batch_size * 0.5))
            logger.info(
                f"Energy-efficient strategy: low battery level ({battery_level:.0%}), "
                f"aggressive power saving"
            )
            
        # Medium battery - moderate power saving
        elif battery_level < 0.6:
            resources['max_workers'] = max(1, int(max_workers * 0.7))
            resources['chunk_size'] = max(2048, int(chunk_size * 0.7))
            resources['batch_size'] = max(1, int(batch_size * 0.7))
            logger.info(
                f"Energy-efficient strategy: medium battery level ({battery_level:.0%}), "
                f"moderate power saving"
            )
            
        # Good battery level - light power saving
        else:
            resources['max_workers'] = max(1, int(max_workers * 0.9))
            resources['chunk_size'] = max(4096, int(chunk_size * 0.9))
            resources['batch_size'] = max(2, int(batch_size * 0.9))
            logger.info(
                f"Energy-efficient strategy: good battery level ({battery_level:.0%}), "
                f"light power saving"
            )
        
        return resources


class ContainerAwareStrategy(AdaptationStrategy):
    """
    Container-aware adaptation strategy
    
    Respects container resource limits and adapts to container-specific
    constraints like cgroup limits and container orchestration.
    """
    
    def __init__(self):
        """Initialize container-aware strategy"""
        super().__init__("container_aware")
        
    async def adapt(
        self,
        metrics: Dict[str, float],
        current_resources: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Apply container-aware adaptation strategy
        
        Args:
            metrics: Current system metrics
            current_resources: Current resource allocation
            
        Returns:
            Updated resource allocation
        """
        cpu_usage = metrics.get('cpu', 0.0)
        memory_usage = metrics.get('memory', 0.0)
        
        # Container-specific metrics
        memory_limit = metrics.get('container_memory_limit', 0)
        cpu_limit = metrics.get('container_cpu_limit', 0)
        container_memory_usage = metrics.get('container_memory_usage', 0.0)
        
        # Get current values with defaults
        max_workers = current_resources.get('max_workers', 1)
        chunk_size = current_resources.get('chunk_size', 1024 * 1024)
        batch_size = current_resources.get('batch_size', 4)
        
        # Create new resources dictionary
        resources = current_resources.copy()
        
        # Apply container-aware adjustments
        
        # Near container memory limit - drastic reduction
        if memory_limit > 0 and container_memory_usage > 0.9:
            resources['max_workers'] = max(1, int(max_workers * 0.5))
            resources['chunk_size'] = max(512, int(chunk_size * 0.3))
            resources['batch_size'] = max(1, int(batch_size * 0.3))
            logger.info(
                f"Container-aware strategy: nearing memory limit "
                f"({container_memory_usage:.1%} of limit), drastically reducing resources"
            )
            
        # High container memory usage - significant reduction
        elif memory_limit > 0 and container_memory_usage > 0.8:
            resources['max_workers'] = max(1, int(max_workers * 0.7))
            resources['chunk_size'] = max(1024, int(chunk_size * 0.5))
            resources['batch_size'] = max(1, int(batch_size * 0.5))
            logger.info(
                f"Container-aware strategy: high memory usage "
                f"({container_memory_usage:.1%} of limit), reducing resources"
            )
            
        # Moderate container memory usage - slight reduction
        elif memory_limit > 0 and container_memory_usage > 0.7:
            resources['max_workers'] = max(1, int(max_workers * 0.9))
            resources['chunk_size'] = max(2048, int(chunk_size * 0.7))
            resources['batch_size'] = max(1, int(batch_size * 0.7))
            logger.info(
                f"Container-aware strategy: moderate memory usage "
                f"({container_memory_usage:.1%} of limit), slightly reducing resources"
            )
            
        # Based on CPU limit if specified
        elif cpu_limit > 0:
            # Adjust workers based on CPU limit
            target_workers = max(1, int(cpu_limit * 0.8))  # Use 80% of CPU limit
            
            if max_workers > target_workers:
                resources['max_workers'] = target_workers
                logger.info(
                    f"Container-aware strategy: adjusting worker count to respect CPU limit "
                    f"({target_workers} workers for {cpu_limit} CPUs)"
                )
            elif max_workers < target_workers and cpu_usage < 0.6:
                # Only increase if CPU usage is moderate
                resources['max_workers'] = min(target_workers, max_workers + 1)
                logger.info(
                    f"Container-aware strategy: slightly increasing worker count "
                    f"({resources['max_workers']} workers for {cpu_limit} CPUs)"
                )
        
        return resources


class ConstraintAdaptation:
    """
    Advanced adaptation under tight resource constraints
    
    Provides progressive resource reduction techniques for critical
    situations where resources are severely constrained.
    """
    
    def __init__(self, core_ref):
        """
        Initialize constraint adaptation
        
        Args:
            core_ref: Reference to the core Hyperion instance
        """
        self.core = core_ref
        self.memory_watermarks = {
            "critical": 0.95,  # 95% memory usage
            "high": 0.85,      # 85% memory usage
            "medium": 0.70,    # 70% memory usage
            "normal": 0.50     # 50% memory usage
        }
        self.gc_runs = 0
        self.last_gc_time = 0
        self.last_forced_gc = 0
        
    async def adapt_to_constraints(self) -> str:
        """
        Apply adaptive resource management based on constraints
        
        Returns:
            Current watermark level
        """
        mem_usage = self.core._current_mem
        watermark = "normal"
        
        # Determine current memory watermark
        for level, threshold in sorted(self.memory_watermarks.items(), key=lambda x: x[1], reverse=True):
            if mem_usage >= threshold:
                watermark = level
                break
                
        # Apply progressive optimizations based on pressure level
        if watermark == "critical":
            await self._apply_critical_optimizations()
        elif watermark == "high":
            await self._apply_high_optimizations()
        elif watermark == "medium":
            await self._apply_medium_optimizations()
            
        return watermark
    
    async def _apply_critical_optimizations(self) -> None:
        """
        Apply emergency optimizations for critical memory pressure
        """
        # Check if we can run forced GC (limit frequency to avoid thrashing)
        current_time = time.time()
        if current_time - self.last_forced_gc > 30:  # At most every 30 seconds
            # Force immediate garbage collection
            logger.warning("Critical memory pressure: forcing garbage collection")
            collected = gc.collect(generation=2)  # Full collection
            self.last_forced_gc = current_time
            self.gc_runs += 1
            logger.info(f"Forced GC collected {collected} objects")
        
        # Drastically reduce worker count
        current_workers = self.core.max_workers
        new_workers = max(1, int(current_workers * 0.4))  # 60% reduction
        
        if new_workers < current_workers:
            self.core._update_workers(new_workers)
            logger.warning(
                f"Critical memory pressure: reduced workers from {current_workers} to {new_workers}"
            )
        
        # Drastically reduce chunk size
        current_chunk = self.core.chunk_size
        new_chunk = max(1024, int(current_chunk * 0.3))  # 70% reduction
        
        if new_chunk < current_chunk:
            self.core.chunk_size = new_chunk
            logger.warning(
                f"Critical memory pressure: reduced chunk size from {current_chunk} to {new_chunk}"
            )
        
        # Set batch size to minimum
        self.core.batch_size = 1
        
        # Cancel non-essential tasks
        # In a real implementation, would have a registry of tasks to cancel
        logger.warning("Critical memory pressure: cancelling non-essential tasks")
        
        # Disable features to save memory
        self._disable_memory_intensive_features()
        
        # Offload historical data
        await self._offload_historical_data()
    
    async def _apply_high_optimizations(self) -> None:
        """
        Apply significant optimizations for high memory pressure
        """
        # Run garbage collection if enough time has passed
        current_time = time.time()
        if current_time - self.last_gc_time > 60:  # At most every minute
            logger.info("High memory pressure: running garbage collection")
            gc.collect(generation=1)  # Collect younger generations
            self.last_gc_time = current_time
        
        # Significantly reduce worker count
        current_workers = self.core.max_workers
        new_workers = max(1, int(current_workers * 0.6))  # 40% reduction
        
        if new_workers < current_workers:
            self.core._update_workers(new_workers)
            logger.info(
                f"High memory pressure: reduced workers from {current_workers} to {new_workers}"
            )
        
        # Significantly reduce chunk size
        current_chunk = self.core.chunk_size
        new_chunk = max(2048, int(current_chunk * 0.5))  # 50% reduction
        
        if new_chunk < current_chunk:
            self.core.chunk_size = new_chunk
            logger.info(
                f"High memory pressure: reduced chunk size from {current_chunk} to {new_chunk}"
            )
        
        # Reduce batch size
        current_batch = self.core.batch_size
        new_batch = max(1, int(current_batch * 0.5))  # 50% reduction
        
        if new_batch < current_batch:
            self.core.batch_size = new_batch
            logger.info(
                f"High memory pressure: reduced batch size from {current_batch} to {new_batch}"
            )
        
        # Trim history
        self._trim_metrics_history()
    
    async def _apply_medium_optimizations(self) -> None:
        """
        Apply moderate optimizations for medium memory pressure
        """
        # Moderately reduce worker count
        current_workers = self.core.max_workers
        new_workers = max(1, int(current_workers * 0.8))  # 20% reduction
        
        if new_workers < current_workers:
            self.core._update_workers(new_workers)
            logger.info(
                f"Medium memory pressure: reduced workers from {current_workers} to {new_workers}"
            )
        
        # Moderately reduce chunk size
        current_chunk = self.core.chunk_size
        new_chunk = max(4096, int(current_chunk * 0.7))  # 30% reduction
        
        if new_chunk < current_chunk:
            self.core.chunk_size = new_chunk
            logger.info(
                f"Medium memory pressure: reduced chunk size from {current_chunk} to {new_chunk}"
            )
        
        # Slightly reduce batch size
        current_batch = self.core.batch_size
        new_batch = max(2, int(current_batch * 0.7))  # 30% reduction
        
        if new_batch < current_batch:
            self.core.batch_size = new_batch
            logger.info(
                f"Medium memory pressure: reduced batch size from {current_batch} to {new_batch}"
            )
    
    def _disable_memory_intensive_features(self) -> None:
        """
        Disable memory-intensive features temporarily
        """
        # This would disable features based on a registry of features
        # For example: detailed logging, ML predictions, etc.
        logger.warning("Disabling memory-intensive features due to pressure")
        
        # Example implementation
        if hasattr(self.core, '_feature_flags'):
            for feature in ['detailed_metrics', 'ml_predictions', 'historical_analysis']:
                if feature in self.core._feature_flags:
                    self.core._feature_flags[feature] = False
                    logger.info(f"Disabled feature: {feature}")
    
    def _trim_metrics_history(self) -> None:
        """
        Trim metrics history to reduce memory usage
        """
        if hasattr(self.core, '_metrics') and hasattr(self.core._metrics, 'historical_data'):
            before_size = len(self.core._metrics.historical_data)
            # Reduce to 20% of original size
            target_size = max(10, int(before_size * 0.2))
            
            if target_size < before_size:
                self.core._metrics.historical_data = self.core._metrics.historical_data[-target_size:]
                logger.info(
                    f"Trimmed metrics history from {before_size} to {target_size} entries"
                )
    
    async def _offload_historical_data(self) -> None:
        """
        Offload historical data to disk to free memory
        """
        # This would serialize and save historical data to disk
        # Implementation depends on available storage backend
        logger.info("Offloading historical data to disk")
        
        # Example implementation
        if hasattr(self.core, '_metrics') and hasattr(self.core._metrics, 'historical_data'):
            # In a real implementation, would use a proper storage backend
            # For this example, we'll just clear the data
            self.core._metrics.historical_data = self.core._metrics.historical_data[-10:]
            logger.info("Historical data offloaded (reduced to last 10 entries)")


class AdaptationManager:
    """
    Central manager for adaptation strategies
    
    Coordinates different adaptation strategies and policy selection
    based on environment and conditions.
    """
    
    def __init__(self, core_ref):
        """
        Initialize adaptation manager
        
        Args:
            core_ref: Reference to the core Hyperion instance
        """
        self.core = core_ref
        self.strategies = {
            "conservative": ConservativeStrategy(),
            "balanced": BalancedStrategy(),
            "aggressive": AggressiveStrategy(),
            "energy_efficient": EnergyEfficientStrategy(),
            "container_aware": ContainerAwareStrategy()
        }
        self.active_strategy = "balanced"
        self.constraint_adapter = ConstraintAdaptation(core_ref)
        self.last_adaptation = 0
        self.adaptation_interval = 5.0  # seconds
    
    def set_strategy(self, strategy_name: str) -> bool:
        """
        Set the active adaptation strategy
        
        Args:
            strategy_name: Name of the strategy to activate
            
        Returns:
            True if strategy was set, False if not found
        """
        if strategy_name in self.strategies:
            self.active_strategy = strategy_name
            logger.info(f"Set active adaptation strategy to '{strategy_name}'")
            return True
        return False
    
    def get_strategy_names(self) -> List[str]:
        """
        Get list of available strategy names
        
        Returns:
            List of strategy names
        """
        return list(self.strategies.keys())
    
    def get_active_strategy(self) -> str:
        """
        Get the name of the active strategy
        
        Returns:
            Active strategy name
        """
        return self.active_strategy
    
    async def auto_select_strategy(self) -> str:
        """
        Automatically select the best strategy based on environment
        
        Returns:
            Selected strategy name
        """
        # Detect environment characteristics
        metrics = {
            'cpu': self.core._current_cpu,
            'memory': self.core._current_mem
        }
        
        # Container detection
        if self.core.is_container:
            self.active_strategy = "container_aware"
            logger.info("Auto-selected container-aware strategy for container environment")
            return self.active_strategy
        
        # Energy efficiency for laptops
        if self.core.is_laptop:
            # Check if on battery
            if hasattr(self.core, 'energy') and hasattr(self.core.energy, 'on_battery'):
                if self.core.energy.on_battery:
                    self.active_strategy = "energy_efficient"
                    logger.info("Auto-selected energy-efficient strategy for laptop on battery")
                    return self.active_strategy
        
        # Cloud environments
        if self.core.cloud_provider:
            # Check for spot/preemptible instances
            is_spot = False
            if hasattr(self.core, 'cloud') and hasattr(self.core.cloud, 'is_spot'):
                is_spot = self.core.cloud.is_spot
                
            if is_spot:
                # More conservative for spot instances
                self.active_strategy = "conservative"
                logger.info("Auto-selected conservative strategy for spot instance")
            else:
                # More aggressive for regular cloud instances
                self.active_strategy = "aggressive"
                logger.info("Auto-selected aggressive strategy for cloud instance")
            return self.active_strategy
        
        # Default to balanced
        self.active_strategy = "balanced"
        logger.info("Auto-selected balanced strategy as default")
        return self.active_strategy
    
    async def adapt_resources(self) -> Dict[str, Any]:
        """
        Apply the active adaptation strategy
        
        Returns:
            Updated resource allocation
        """
        # Check if enough time has passed since last adaptation
        current_time = time.time()
        if current_time - self.last_adaptation < self.adaptation_interval:
            # Too soon, return current resources
            return self._get_current_resources()
        
        self.last_adaptation = current_time
        
        # Get current metrics
        metrics = self._get_current_metrics()
        current_resources = self._get_current_resources()
        
        # First check for constraint adaptation (critical situations)
        watermark = await self.constraint_adapter.adapt_to_constraints()
        
        # If not in critical state, apply regular strategy
        if watermark not in ["critical", "high"]:
            # Get the active strategy
            strategy = self.strategies[self.active_strategy]
            
            # Apply the strategy
            updated_resources = await strategy.adapt(metrics, current_resources)
            
            # Update core with new resources
            self._apply_resources(updated_resources)
            
        return self._get_current_resources()
    
    def _get_current_metrics(self) -> Dict[str, float]:
        """
        Get current system metrics
        
        Returns:
            Dictionary of current metrics
        """
        metrics = {
            'cpu': self.core._current_cpu,
            'memory': self.core._current_mem,
            'cpu_count': self.core._cpu_count
        }
        
        # Add energy metrics if available
        if hasattr(self.core, 'energy'):
            energy = self.core.energy
            if hasattr(energy, 'get_power_state'):
                power_state = energy.get_power_state()
                metrics['on_battery'] = power_state.get('on_battery', False)
                metrics['battery_level'] = power_state.get('battery_percent', 100.0) / 100.0
        
        # Add container metrics if available
        if hasattr(self.core, 'container'):
            container = self.core.container
            if hasattr(container, 'check_resource_constraints'):
                constraints = container.check_resource_constraints()
                metrics['container_memory_usage'] = constraints.get('memory_percent', 0.0)
                
            metrics['container_memory_limit'] = getattr(container, 'memory_limit', 0)
            metrics['container_cpu_limit'] = getattr(container, 'cpu_limit', 0)
        
        return metrics
    
    def _get_current_resources(self) -> Dict[str, Any]:
        """
        Get current resource allocation
        
        Returns:
            Dictionary of current resources
        """
        return {
            'max_workers': self.core.max_workers,
            'chunk_size': self.core.chunk_size,
            'batch_size': self.core.batch_size,
            'timeout_factor': self.core.timeout_factor
        }
    
    def _apply_resources(self, resources: Dict[str, Any]) -> None:
        """
        Apply resource allocations to core
        
        Args:
            resources: Resource allocation to apply
        """
        # Update worker count if changed
        if 'max_workers' in resources and resources['max_workers'] != self.core.max_workers:
            self.core._update_workers(resources['max_workers'])
            
        # Update other parameters
        if 'chunk_size' in resources:
            self.core.chunk_size = resources['chunk_size']
            
        if 'batch_size' in resources:
            self.core.batch_size = resources['batch_size']
            
        if 'timeout_factor' in resources:
            self.core.timeout_factor = resources['timeout_factor']
