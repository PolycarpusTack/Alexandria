"""
Hyperion Resource Monitor - Energy Efficiency Module

Provides energy-aware monitoring and adaptation for power-sensitive environments.
"""

import logging
import platform
import time
from typing import Dict, Optional, Tuple

try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False

logger = logging.getLogger(__name__)


class EnergyMonitor:
    """
    Energy-aware monitor for power-sensitive environments
    
    Provides functionality including:
    - Battery state detection
    - Power source monitoring
    - Energy-efficient resource management policies
    - Power mode switching recommendations
    """
    
    def __init__(self):
        self.on_battery = False
        self.battery_percent = 100.0
        self.battery_time_left = None  # Minutes remaining or None if unknown/charging
        self.power_saver_active = False
        
        # Platform-specific flags
        self.platform = platform.system()
        self.supported = PSUTIL_AVAILABLE
        
        if self.supported:
            self._update_power_state()
            logger.info(
                f"Energy monitor initialized: "
                f"on_battery={self.on_battery}, "
                f"battery_percent={self.battery_percent:.1f}%, "
                f"power_saver={self.power_saver_active}"
            )
    
    def _update_power_state(self) -> bool:
        """
        Update current power state information
        
        Returns:
            True if state was updated successfully, False otherwise
        """
        if not PSUTIL_AVAILABLE:
            return False
            
        try:
            battery = psutil.sensors_battery()
            if battery is None:
                # No battery - assume plugged in
                self.on_battery = False
                self.battery_percent = 100.0
                self.battery_time_left = None
                return True
                
            self.on_battery = not battery.power_plugged
            self.battery_percent = battery.percent
            
            # Convert seconds to minutes, or None if plugged in
            if battery.secsleft > 0 and self.on_battery:
                self.battery_time_left = battery.secsleft / 60
            else:
                self.battery_time_left = None
                
            # Automatically activate power saver on low battery
            if self.on_battery and self.battery_percent < 20:
                self.power_saver_active = True
                
            return True
        except Exception as e:
            logger.warning(f"Failed to update power state: {str(e)}")
            return False
    
    def get_power_state(self) -> Dict[str, any]:
        """
        Get current power state information
        
        Returns:
            Dictionary with power state details
        """
        # Update state before returning
        self._update_power_state()
        
        return {
            'supported': self.supported,
            'on_battery': self.on_battery,
            'battery_percent': self.battery_percent,
            'battery_time_left': self.battery_time_left,
            'power_saver_active': self.power_saver_active
        }
    
    def toggle_power_saver(self, enabled: Optional[bool] = None) -> bool:
        """
        Enable or disable power saver mode
        
        Args:
            enabled: True to enable, False to disable, None to toggle
            
        Returns:
            New power saver state
        """
        if enabled is None:
            # Toggle current state
            self.power_saver_active = not self.power_saver_active
        else:
            self.power_saver_active = enabled
            
        logger.info(f"Power saver mode {'enabled' if self.power_saver_active else 'disabled'}")
        return self.power_saver_active
    
    def get_energy_recommendations(self) -> Dict[str, str]:
        """
        Get energy efficiency recommendations
        
        Returns:
            Dictionary of recommendations
        """
        if not self.supported:
            return {}
            
        # Update state before generating recommendations
        self._update_power_state()
        
        recommendations = {}
        
        # Battery-specific recommendations
        if self.on_battery:
            if self.battery_percent < 10:
                recommendations['critical'] = "Battery critically low, connect to power source soon"
            elif self.battery_percent < 20:
                recommendations['warning'] = "Battery low, enable power saver mode"
                
            if self.battery_time_left is not None and self.battery_time_left < 30:
                recommendations['time'] = f"~{int(self.battery_time_left)} minutes of battery remaining"
                
            if not self.power_saver_active and self.battery_percent < 50:
                recommendations['efficiency'] = "Enable power saver mode to extend battery life"
        
        # Platform-specific recommendations
        if self.platform == 'Linux':
            recommendations['linux'] = "Consider using TLP or powertop for better power management"
        elif self.platform == 'Darwin':  # macOS
            recommendations['macos'] = "Use Energy Saver preferences for optimal settings"
        elif self.platform == 'Windows':
            recommendations['windows'] = "Use Power & Sleep settings for better battery life"
            
        return recommendations
    
    def get_power_efficient_parameters(self) -> Dict[str, float]:
        """
        Get power-efficient operation parameters
        
        Returns:
            Dictionary of power-optimized parameters
        """
        if not self.supported:
            return {}
            
        # Update state before calculating parameters
        self._update_power_state()
        
        # Base parameters (no adjustments)
        parameters = {
            'worker_factor': 1.0,
            'chunk_factor': 1.0,
            'batch_factor': 1.0,
            'timeout_factor': 1.0
        }
        
        # Apply power saver adjustments if active
        if self.power_saver_active:
            # Conservative resource usage in power saver mode
            parameters['worker_factor'] = 0.6  # Reduce worker count
            parameters['chunk_factor'] = 0.7  # Smaller chunks
            parameters['batch_factor'] = 0.7  # Smaller batches
            parameters['timeout_factor'] = 1.3  # Longer timeouts
            
        # Additional adjustments when on battery
        if self.on_battery:
            # Base adjustments just for being on battery
            parameters['worker_factor'] *= 0.9
            
            # Progressive reduction based on battery level
            if self.battery_percent < 50:
                # Further reduce resource usage on low battery
                factor = max(0.5, self.battery_percent / 100)  # Scale between 0.5-0.5+
                parameters['worker_factor'] *= factor + 0.5  # Range: 0.5-1.0
                parameters['chunk_factor'] *= factor + 0.5
                parameters['batch_factor'] *= factor + 0.5
                
            # Critical battery level - dramatic reduction
            if self.battery_percent < 15:
                parameters['worker_factor'] = 0.3
                parameters['chunk_factor'] = 0.5
                parameters['batch_factor'] = 0.5
                parameters['timeout_factor'] = 1.5
                
        return parameters
    
    def calculate_energy_efficient_workers(self, base_workers: int) -> int:
        """
        Calculate energy-efficient worker count
        
        Args:
            base_workers: Base number of workers
            
        Returns:
            Adjusted worker count
        """
        if not self.supported or (not self.on_battery and not self.power_saver_active):
            return base_workers
            
        # Get power-efficient parameters
        params = self.get_power_efficient_parameters()
        worker_factor = params.get('worker_factor', 1.0)
        
        # Calculate and ensure at least one worker
        return max(1, int(base_workers * worker_factor))
    
    def should_defer_work(self) -> Tuple[bool, Optional[str]]:
        """
        Determine if work should be deferred due to power constraints
        
        Returns:
            Tuple of (should_defer, reason)
        """
        if not self.supported:
            return False, None
            
        # Update state before making decision
        self._update_power_state()
        
        # Critical battery - almost dead
        if self.on_battery and self.battery_percent < 5:
            return True, "Critical battery level"
            
        # Battery saver mode in Windows often indicates user wants max battery life
        if self.power_saver_active and self.on_battery and self.battery_percent < 15:
            return True, "Power saver mode active with low battery"
            
        return False, None
