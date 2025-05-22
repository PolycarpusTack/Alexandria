"""
Hyperion Resource Monitor - Configuration Module

Provides dynamic configuration management with validation, feature flags,
and support for multiple configuration sources.
"""

import asyncio
import copy
import json
import logging
import os
import time
from typing import Any, Dict, List, Optional, Set, Tuple, Union

logger = logging.getLogger(__name__)


class ConfigValidationError(Exception):
    """Exception raised for configuration validation errors"""
    pass


class ConfigValidator:
    """
    Validates configuration against constraints
    
    Provides type checking, range validation, and default value handling for
    configuration parameters.
    """
    
    def __init__(self):
        """Initialize the config validator with default constraints"""
        self.constraints = {
            # Core configuration
            "check_interval": {
                "type": float,
                "min": 0.1,
                "max": 3600,
                "default": 3.0,
                "description": "Monitoring interval in seconds"
            },
            "max_workers": {
                "type": int,
                "min": 1,
                "max": 1000,
                "default": None,
                "description": "Maximum number of concurrent workers"
            },
            "environment": {
                "type": str,
                "allowed": ["auto", "cloud", "server", "laptop", "container"],
                "default": "auto",
                "description": "Force specific environment"
            },
            "auto_recover": {
                "type": bool,
                "default": True,
                "description": "Enable automatic resource recovery"
            },
            "adaptive_scaling": {
                "type": bool,
                "default": True,
                "description": "Enable predictive scaling"
            },
            
            # Metrics configuration
            "metrics_history_size": {
                "type": int,
                "min": 10,
                "max": 10000,
                "default": 1000,
                "description": "Maximum number of historical metrics to retain"
            },
            "metrics_export_interval": {
                "type": float,
                "min": 1.0,
                "max": 3600,
                "default": 60.0,
                "description": "Interval for metrics export in seconds"
            },
            
            # Resilience configuration
            "circuit_breaker_threshold": {
                "type": int,
                "min": 1,
                "max": 100,
                "default": 5,
                "description": "Number of failures before opening circuit"
            },
            "circuit_breaker_timeout": {
                "type": float,
                "min": 1.0,
                "max": 3600,
                "default": 60.0,
                "description": "Seconds before attempting circuit recovery"
            },
            
            # Energy configuration
            "energy_saver_threshold": {
                "type": float,
                "min": 0.0,
                "max": 1.0,
                "default": 0.2,
                "description": "Battery level threshold for energy saver mode"
            },
            
            # Cloud configuration
            "cloud_metadata_refresh": {
                "type": float,
                "min": 10.0,
                "max": 3600,
                "default": 300.0,
                "description": "Cloud metadata refresh interval in seconds"
            },
            
            # Container configuration
            "container_limit_headroom": {
                "type": float,
                "min": 0.01,
                "max": 0.5,
                "default": 0.1,
                "description": "Fraction of container limits to keep as headroom"
            },
            
            # ML configuration
            "ml_training_interval": {
                "type": float,
                "min": 60.0,
                "max": 86400,
                "default": 3600.0,
                "description": "ML model retraining interval in seconds"
            },
            "ml_min_samples": {
                "type": int,
                "min": 10,
                "max": 10000,
                "default": 100,
                "description": "Minimum samples required for ML training"
            },
            
            # Logging configuration
            "log_level": {
                "type": str,
                "allowed": ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
                "default": "INFO",
                "description": "Logging level"
            }
        }
    
    def add_constraint(self, key: str, constraint: Dict[str, Any]) -> None:
        """
        Add a custom constraint
        
        Args:
            key: Configuration key
            constraint: Constraint definition
        """
        self.constraints[key] = constraint
        logger.debug(f"Added constraint for '{key}'")
    
    def validate(self, config: Dict[str, Any]) -> Tuple[Dict[str, Any], List[str]]:
        """
        Validate configuration against constraints
        
        Args:
            config: Configuration to validate
            
        Returns:
            Tuple of (validated_config, error_messages)
        """
        validated = {}
        errors = []
        
        # Validate provided configuration keys
        for key, value in config.items():
            if key not in self.constraints:
                errors.append(f"Unknown configuration key: '{key}'")
                continue
                
            constraint = self.constraints[key]
            
            # Type validation
            expected_type = constraint["type"]
            if not isinstance(value, expected_type):
                errors.append(
                    f"Invalid type for '{key}': expected {expected_type.__name__}, "
                    f"got {type(value).__name__}"
                )
                continue
                
            # Allowed values validation
            if "allowed" in constraint and value not in constraint["allowed"]:
                errors.append(
                    f"Invalid value for '{key}': '{value}' not in allowed values: "
                    f"{constraint['allowed']}"
                )
                continue
                
            # Range validation for numeric types
            if isinstance(value, (int, float)):
                if "min" in constraint and value < constraint["min"]:
                    errors.append(
                        f"Value for '{key}' below minimum: {value} < {constraint['min']}"
                    )
                    continue
                    
                if "max" in constraint and value > constraint["max"]:
                    errors.append(
                        f"Value for '{key}' above maximum: {value} > {constraint['max']}"
                    )
                    continue
                    
            # Add to validated config
            validated[key] = value
        
        return validated, errors
    
    def apply_defaults(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Apply default values for missing configuration
        
        Args:
            config: Partial configuration
            
        Returns:
            Complete configuration with defaults applied
        """
        result = copy.deepcopy(config)
        
        # Add defaults for missing keys
        for key, constraint in self.constraints.items():
            if key not in result and "default" in constraint:
                result[key] = constraint["default"]
                
        return result
    
    def get_configuration_schema(self) -> Dict[str, Any]:
        """
        Get a schema of all configuration options
        
        Returns:
            Dictionary with configuration schema
        """
        schema = {}
        
        for key, constraint in self.constraints.items():
            schema[key] = {
                "type": constraint["type"].__name__,
                "description": constraint.get("description", ""),
                "default": constraint.get("default", None)
            }
            
            if "allowed" in constraint:
                schema[key]["allowed"] = constraint["allowed"]
                
            if "min" in constraint:
                schema[key]["min"] = constraint["min"]
                
            if "max" in constraint:
                schema[key]["max"] = constraint["max"]
                
        return schema


class DynamicConfig:
    """
    Dynamic configuration management with hot reloading
    
    Supports multiple configuration sources including files, environment variables,
    and remote sources with dynamic updates.
    """
    
    def __init__(
        self,
        config_source: str = "file",
        config_path: Optional[str] = None,
        validator: Optional[ConfigValidator] = None
    ):
        """
        Initialize the dynamic configuration
        
        Args:
            config_source: Configuration source type ('file', 'env', 'etcd', 'consul')
            config_path: Path to configuration file or endpoint
            validator: Optional config validator
        """
        self.config_source = config_source
        self.config_path = config_path
        self.validator = validator or ConfigValidator()
        
        # State
        self.current_config = {}
        self.feature_flags = {}
        self.config_watchers = []
        self.last_updated = 0
        self.update_lock = asyncio.Lock()
        self.running = False
        self.watcher_task = None
        
        # Load initial configuration
        self._load_initial_config()
        
        logger.info(
            f"Dynamic configuration initialized: source={config_source}, "
            f"path={config_path}"
        )
    
    def _load_initial_config(self) -> None:
        """
        Load initial configuration from source
        """
        config = {}
        
        try:
            if self.config_source == "file" and self.config_path:
                if os.path.exists(self.config_path):
                    with open(self.config_path, 'r') as f:
                        config = json.load(f)
                else:
                    logger.warning(
                        f"Configuration file not found: {self.config_path}, "
                        f"using defaults"
                    )
            elif self.config_source == "env":
                # Load configuration from environment variables
                prefix = "HYPERION_"
                for key, value in os.environ.items():
                    if key.startswith(prefix):
                        # Convert env var name to config key
                        config_key = key[len(prefix):].lower()
                        
                        # Try to parse as JSON for complex types
                        try:
                            config[config_key] = json.loads(value)
                        except json.JSONDecodeError:
                            # Use the string value
                            config[config_key] = value
            
            # Validate and apply defaults
            validated, errors = self.validator.validate(config)
            
            if errors:
                logger.warning(f"Configuration validation errors: {errors}")
                
            self.current_config = self.validator.apply_defaults(validated)
            
            # Extract feature flags
            if "feature_flags" in self.current_config:
                self.feature_flags = self.current_config["feature_flags"]
                del self.current_config["feature_flags"]
                
            self.last_updated = time.time()
            
        except Exception as e:
            logger.error(f"Error loading initial configuration: {str(e)}", exc_info=True)
            # Use defaults
            self.current_config = self.validator.apply_defaults({})
    
    async def start_config_watcher(self) -> None:
        """
        Start watching for configuration changes
        """
        if self.running:
            logger.warning("Configuration watcher already running")
            return
            
        self.running = True
        if self.config_source in ["file", "env", "etcd", "consul"]:
            self.watcher_task = asyncio.create_task(self._watch_for_changes())
            logger.info("Configuration watcher started")
    
    async def stop_config_watcher(self) -> None:
        """
        Stop watching for configuration changes
        """
        if not self.running:
            return
            
        self.running = False
        
        if self.watcher_task:
            self.watcher_task.cancel()
            try:
                await self.watcher_task
            except asyncio.CancelledError:
                pass
            
        logger.info("Configuration watcher stopped")
    
    async def _watch_for_changes(self) -> None:
        """
        Watch for configuration changes
        """
        while self.running:
            try:
                if self.config_source == "file":
                    await self._check_file_changes()
                elif self.config_source == "env":
                    # Environment variables don't need active watching
                    pass
                elif self.config_source == "etcd":
                    await self._watch_etcd_changes()
                elif self.config_source == "consul":
                    await self._watch_consul_changes()
                    
                await asyncio.sleep(60)  # Check every minute
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error watching configuration: {str(e)}", exc_info=True)
                await asyncio.sleep(300)  # Back off on error
    
    async def _check_file_changes(self) -> None:
        """
        Check for changes in configuration file
        """
        if not self.config_path or not os.path.exists(self.config_path):
            return
            
        try:
            # Check file modification time
            mtime = os.path.getmtime(self.config_path)
            
            if mtime > self.last_updated:
                # File has changed, reload
                with open(self.config_path, 'r') as f:
                    new_config = json.load(f)
                    
                # Update configuration
                await self._update_config(new_config)
                
        except Exception as e:
            logger.error(f"Error checking file changes: {str(e)}", exc_info=True)
    
    async def _watch_etcd_changes(self) -> None:
        """
        Watch for changes in etcd
        """
        # This would use etcd client to watch for changes
        # For now, just log that it's not implemented
        logger.warning("etcd configuration source not implemented")
    
    async def _watch_consul_changes(self) -> None:
        """
        Watch for changes in Consul
        """
        # This would use Consul client to watch for changes
        # For now, just log that it's not implemented
        logger.warning("Consul configuration source not implemented")
    
    async def _update_config(self, new_config: Dict[str, Any]) -> None:
        """
        Update configuration with new values
        
        Args:
            new_config: New configuration values
        """
        async with self.update_lock:
            # Track changes for notifications
            changes = {}
            
            # Validate new configuration
            validated, errors = self.validator.validate(new_config)
            
            if errors:
                logger.warning(f"Configuration validation errors: {errors}")
            
            # Update current configuration with validated values
            for key, value in validated.items():
                if key not in self.current_config or self.current_config[key] != value:
                    changes[key] = {
                        'old': self.current_config.get(key),
                        'new': value
                    }
                    self.current_config[key] = value
            
            # Extract feature flags
            if "feature_flags" in validated:
                new_flags = validated["feature_flags"]
                
                # Track flag changes
                for flag, enabled in new_flags.items():
                    if flag not in self.feature_flags or self.feature_flags[flag] != enabled:
                        changes[f"feature_flags.{flag}"] = {
                            'old': self.feature_flags.get(flag),
                            'new': enabled
                        }
                
                self.feature_flags = new_flags
                
            # Update timestamp
            self.last_updated = time.time()
            
            # Notify watchers
            if changes:
                logger.info(f"Configuration updated: {len(changes)} changes")
                await self._notify_watchers(changes)
    
    def register_watcher(self, callback: Callable[[Dict[str, Any]], None]) -> None:
        """
        Register a callback to be notified of configuration changes
        
        Args:
            callback: Async function to call with changes
        """
        if callback not in self.config_watchers:
            self.config_watchers.append(callback)
            logger.debug(f"Registered configuration watcher: {callback.__name__}")
    
    def unregister_watcher(self, callback: Callable[[Dict[str, Any]], None]) -> None:
        """
        Unregister a configuration watcher
        
        Args:
            callback: Previously registered callback
        """
        if callback in self.config_watchers:
            self.config_watchers.remove(callback)
            logger.debug(f"Unregistered configuration watcher: {callback.__name__}")
    
    async def _notify_watchers(self, changes: Dict[str, Any]) -> None:
        """
        Notify watchers of configuration changes
        
        Args:
            changes: Dictionary of changes
        """
        for watcher in self.config_watchers:
            try:
                if asyncio.iscoroutinefunction(watcher):
                    await watcher(changes)
                else:
                    watcher(changes)
            except Exception as e:
                logger.error(
                    f"Error in configuration watcher {watcher.__name__}: {str(e)}",
                    exc_info=True
                )
    
    def get(self, key: str, default: Any = None) -> Any:
        """
        Get a configuration value
        
        Args:
            key: Configuration key
            default: Default value if key not found
            
        Returns:
            Configuration value or default
        """
        return self.current_config.get(key, default)
    
    def is_feature_enabled(self, feature_name: str, default: bool = False) -> bool:
        """
        Check if a feature flag is enabled
        
        Args:
            feature_name: Feature flag name
            default: Default value if flag not found
            
        Returns:
            True if feature is enabled, False otherwise
        """
        return self.feature_flags.get(feature_name, default)
    
    def get_all(self) -> Dict[str, Any]:
        """
        Get all configuration values
        
        Returns:
            Dictionary with all configuration values
        """
        return copy.deepcopy(self.current_config)
    
    def get_feature_flags(self) -> Dict[str, bool]:
        """
        Get all feature flags
        
        Returns:
            Dictionary with all feature flags
        """
        return copy.deepcopy(self.feature_flags)
    
    async def set(self, key: str, value: Any) -> bool:
        """
        Set a configuration value
        
        Args:
            key: Configuration key
            value: New value
            
        Returns:
            True if value was set, False if validation failed
        """
        # Create new config with updated value
        new_config = copy.deepcopy(self.current_config)
        new_config[key] = value
        
        # Validate just this key
        validated, errors = self.validator.validate({key: value})
        
        if errors:
            logger.warning(f"Configuration validation errors: {errors}")
            return False
            
        # Update the configuration
        await self._update_config({key: value})
        return True
    
    async def set_feature_flag(self, feature_name: str, enabled: bool) -> None:
        """
        Set a feature flag
        
        Args:
            feature_name: Feature flag name
            enabled: Whether the feature is enabled
        """
        # Create copy of feature flags
        new_flags = copy.deepcopy(self.feature_flags)
        new_flags[feature_name] = enabled
        
        # Update configuration with new flags
        await self._update_config({"feature_flags": new_flags})
    
    async def reload(self) -> None:
        """
        Force reload of configuration from source
        """
        try:
            if self.config_source == "file" and self.config_path:
                if os.path.exists(self.config_path):
                    with open(self.config_path, 'r') as f:
                        new_config = json.load(f)
                        await self._update_config(new_config)
                else:
                    logger.warning(f"Configuration file not found: {self.config_path}")
            elif self.config_source == "env":
                # Reload from environment variables
                new_config = {}
                prefix = "HYPERION_"
                for key, value in os.environ.items():
                    if key.startswith(prefix):
                        config_key = key[len(prefix):].lower()
                        
                        try:
                            new_config[config_key] = json.loads(value)
                        except json.JSONDecodeError:
                            new_config[config_key] = value
                
                await self._update_config(new_config)
        except Exception as e:
            logger.error(f"Error reloading configuration: {str(e)}", exc_info=True)