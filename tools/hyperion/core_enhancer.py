"""
Hyperion Resource Monitor - Enhancer Module

Provides extension points and enhanced capabilities for the core monitoring system,
including real-time configuration management and plugin support.
"""

import asyncio
import importlib
import inspect
import logging
import os
import sys
import time
from typing import Any, Callable, Dict, List, Optional, Set, Tuple, Union

logger = logging.getLogger(__name__)


class PluginManager:
    """
    Plugin system for extending Hyperion functionality
    
    Provides dynamic loading of plugins and extension points for various
    Hyperion components.
    """
    
    def __init__(self, plugin_dir: Optional[str] = None):
        """
        Initialize plugin manager
        
        Args:
            plugin_dir: Directory containing plugins (defaults to 'plugins' subdirectory)
        """
        self.plugin_dir = plugin_dir or os.path.join(os.path.dirname(__file__), 'plugins')
        self.plugins = {}
        self.extension_points = {}
        self.hooks = {}
    
    def register_extension_point(
        self,
        name: str,
        interface: Optional[type] = None,
        description: Optional[str] = None
    ) -> None:
        """
        Register an extension point
        
        Args:
            name: Extension point name
            interface: Optional interface class that plugins must implement
            description: Optional description
        """
        self.extension_points[name] = {
            'interface': interface,
            'description': description or f"Extension point: {name}",
            'plugins': []
        }
        
        logger.debug(f"Registered extension point: {name}")
    
    def register_hook(self, name: str, description: Optional[str] = None) -> None:
        """
        Register a hook that plugins can attach to
        
        Args:
            name: Hook name
            description: Optional description
        """
        self.hooks[name] = {
            'description': description or f"Hook: {name}",
            'callbacks': []
        }
        
        logger.debug(f"Registered hook: {name}")
    
    def discover_plugins(self) -> List[str]:
        """
        Discover available plugins in the plugin directory
        
        Returns:
            List of discovered plugin names
        """
        if not os.path.exists(self.plugin_dir):
            logger.warning(f"Plugin directory not found: {self.plugin_dir}")
            return []
            
        # Add plugin directory to path if not already there
        if self.plugin_dir not in sys.path:
            sys.path.append(self.plugin_dir)
            
        # Find all Python files in the plugin directory
        plugin_names = []
        
        for filename in os.listdir(self.plugin_dir):
            if filename.endswith('.py') and not filename.startswith('_'):
                plugin_name = filename[:-3]  # Remove .py extension
                plugin_names.append(plugin_name)
                
        return plugin_names
    
    def load_plugin(self, plugin_name: str) -> bool:
        """
        Load a plugin by name
        
        Args:
            plugin_name: Plugin name (module name)
            
        Returns:
            True if loaded successfully
        """
        if plugin_name in self.plugins:
            logger.warning(f"Plugin '{plugin_name}' already loaded")
            return True
            
        try:
            # Import plugin module
            module = importlib.import_module(plugin_name)
            
            # Check for plugin metadata
            if not hasattr(module, 'PLUGIN_INFO'):
                logger.warning(f"Plugin '{plugin_name}' missing PLUGIN_INFO")
                return False
                
            plugin_info = module.PLUGIN_INFO
            
            # Check required metadata
            if 'name' not in plugin_info or 'version' not in plugin_info:
                logger.warning(f"Plugin '{plugin_name}' has incomplete metadata")
                return False
                
            # Store plugin
            self.plugins[plugin_name] = {
                'module': module,
                'info': plugin_info,
                'extensions': {},
                'hooks': set()
            }
            
            # Initialize plugin if it has an init function
            if hasattr(module, 'initialize'):
                try:
                    module.initialize()
                except Exception as e:
                    logger.error(f"Error initializing plugin '{plugin_name}': {str(e)}", exc_info=True)
                    del self.plugins[plugin_name]
                    return False
            
            # Register extensions and hooks
            self._register_plugin_extensions(plugin_name)
            self._register_plugin_hooks(plugin_name)
            
            logger.info(
                f"Loaded plugin '{plugin_info['name']}' v{plugin_info['version']} "
                f"({plugin_name})"
            )
            
            return True
            
        except Exception as e:
            logger.error(f"Error loading plugin '{plugin_name}': {str(e)}", exc_info=True)
            return False
    
    def _register_plugin_extensions(self, plugin_name: str) -> None:
        """
        Register a plugin's extensions
        
        Args:
            plugin_name: Plugin name
        """
        plugin = self.plugins[plugin_name]
        module = plugin['module']
        
        # Find all extension classes
        for name, obj in inspect.getmembers(module):
            if inspect.isclass(obj) and hasattr(obj, 'EXTENSION_POINT'):
                extension_point = obj.EXTENSION_POINT
                
                if extension_point not in self.extension_points:
                    logger.warning(
                        f"Plugin '{plugin_name}' implements unknown extension point: {extension_point}"
                    )
                    continue
                    
                # Check if class implements required interface
                interface = self.extension_points[extension_point]['interface']
                if interface and not issubclass(obj, interface):
                    logger.warning(
                        f"Plugin '{plugin_name}' extension '{name}' does not implement "
                        f"required interface for extension point '{extension_point}'"
                    )
                    continue
                    
                # Register extension
                plugin['extensions'][extension_point] = obj
                self.extension_points[extension_point]['plugins'].append(plugin_name)
                
                logger.debug(
                    f"Registered extension '{name}' from plugin '{plugin_name}' "
                    f"for extension point '{extension_point}'"
                )
    
    def _register_plugin_hooks(self, plugin_name: str) -> None:
        """
        Register a plugin's hook callbacks
        
        Args:
            plugin_name: Plugin name
        """
        plugin = self.plugins[plugin_name]
        module = plugin['module']
        
        # Find all hook callbacks
        for name, obj in inspect.getmembers(module):
            if callable(obj) and hasattr(obj, 'HOOK'):
                hook_name = obj.HOOK
                
                if hook_name not in self.hooks:
                    logger.warning(
                        f"Plugin '{plugin_name}' implements unknown hook: {hook_name}"
                    )
                    continue
                    
                # Register hook callback
                self.hooks[hook_name]['callbacks'].append((plugin_name, obj))
                plugin['hooks'].add(hook_name)
                
                logger.debug(
                    f"Registered hook callback '{name}' from plugin '{plugin_name}' "
                    f"for hook '{hook_name}'"
                )
    
    def unload_plugin(self, plugin_name: str) -> bool:
        """
        Unload a plugin
        
        Args:
            plugin_name: Plugin name
            
        Returns:
            True if unloaded successfully
        """
        if plugin_name not in self.plugins:
            logger.warning(f"Plugin '{plugin_name}' not loaded")
            return False
            
        try:
            plugin = self.plugins[plugin_name]
            module = plugin['module']
            
            # Call shutdown function if it exists
            if hasattr(module, 'shutdown'):
                try:
                    module.shutdown()
                except Exception as e:
                    logger.error(f"Error shutting down plugin '{plugin_name}': {str(e)}", exc_info=True)
            
            # Remove plugin extensions
            for extension_point in plugin['extensions']:
                if plugin_name in self.extension_points[extension_point]['plugins']:
                    self.extension_points[extension_point]['plugins'].remove(plugin_name)
            
            # Remove plugin hook callbacks
            for hook_name in plugin['hooks']:
                self.hooks[hook_name]['callbacks'] = [
                    cb for cb in self.hooks[hook_name]['callbacks']
                    if cb[0] != plugin_name
                ]
            
            # Remove plugin
            del self.plugins[plugin_name]
            
            logger.info(f"Unloaded plugin '{plugin_name}'")
            
            return True
            
        except Exception as e:
            logger.error(f"Error unloading plugin '{plugin_name}': {str(e)}", exc_info=True)
            return False
    
    def get_extension(self, extension_point: str, plugin_name: Optional[str] = None) -> Any:
        """
        Get an extension implementation
        
        Args:
            extension_point: Extension point name
            plugin_name: Optional plugin name (first one found if None)
            
        Returns:
            Extension implementation or None if not found
        """
        if extension_point not in self.extension_points:
            logger.warning(f"Unknown extension point: {extension_point}")
            return None
            
        if plugin_name:
            # Get extension from specific plugin
            if plugin_name not in self.plugins:
                logger.warning(f"Plugin '{plugin_name}' not loaded")
                return None
                
            plugin = self.plugins[plugin_name]
            if extension_point not in plugin['extensions']:
                logger.warning(
                    f"Plugin '{plugin_name}' does not implement extension point '{extension_point}'"
                )
                return None
                
            return plugin['extensions'][extension_point]
        else:
            # Get first available extension
            plugin_names = self.extension_points[extension_point]['plugins']
            if not plugin_names:
                logger.warning(f"No plugins implement extension point '{extension_point}'")
                return None
                
            first_plugin = plugin_names[0]
            return self.plugins[first_plugin]['extensions'][extension_point]
    
    def get_all_extensions(self, extension_point: str) -> List[Tuple[str, Any]]:
        """
        Get all implementations of an extension point
        
        Args:
            extension_point: Extension point name
            
        Returns:
            List of (plugin_name, extension) tuples
        """
        if extension_point not in self.extension_points:
            logger.warning(f"Unknown extension point: {extension_point}")
            return []
            
        extensions = []
        for plugin_name in self.extension_points[extension_point]['plugins']:
            extension = self.plugins[plugin_name]['extensions'][extension_point]
            extensions.append((plugin_name, extension))
            
        return extensions
    
    async def call_hook(
        self,
        hook_name: str,
        *args,
        **kwargs
    ) -> List[Any]:
        """
        Call all callbacks for a hook
        
        Args:
            hook_name: Hook name
            *args: Positional arguments to pass to callbacks
            **kwargs: Keyword arguments to pass to callbacks
            
        Returns:
            List of callback results
        """
        if hook_name not in self.hooks:
            logger.warning(f"Unknown hook: {hook_name}")
            return []
            
        callbacks = self.hooks[hook_name]['callbacks']
        if not callbacks:
            logger.debug(f"No callbacks registered for hook '{hook_name}'")
            return []
            
        results = []
        for plugin_name, callback in callbacks:
            try:
                # Call the callback with the provided arguments
                if asyncio.iscoroutinefunction(callback):
                    result = await callback(*args, **kwargs)
                else:
                    result = callback(*args, **kwargs)
                    
                results.append(result)
                
            except Exception as e:
                logger.error(
                    f"Error calling hook '{hook_name}' callback from plugin '{plugin_name}': {str(e)}",
                    exc_info=True
                )
                
        return results
    
    def get_plugin_info(self, plugin_name: str) -> Optional[Dict[str, Any]]:
        """
        Get plugin information
        
        Args:
            plugin_name: Plugin name
            
        Returns:
            Plugin information or None if not found
        """
        if plugin_name not in self.plugins:
            return None
            
        return self.plugins[plugin_name]['info']
    
    def get_loaded_plugins(self) -> List[Dict[str, Any]]:
        """
        Get information about all loaded plugins
        
        Returns:
            List of plugin information dictionaries
        """
        return [
            {
                'name': plugin_name,
                'info': plugin['info'],
                'extensions': list(plugin['extensions'].keys()),
                'hooks': list(plugin['hooks'])
            }
            for plugin_name, plugin in self.plugins.items()
        ]


class EnhancedMetricCollector:
    """
    Enhanced metric collector with extended capabilities
    
    Provides advanced metric collection features, custom metric types,
    and integration with the plugin system.
    """
    
    def __init__(self, plugin_manager: Optional[PluginManager] = None):
        """
        Initialize enhanced metric collector
        
        Args:
            plugin_manager: Optional plugin manager instance
        """
        self.plugin_manager = plugin_manager
        self.custom_metrics = {}
        self.derived_metrics = {}
        self.metric_handlers = {}
        self.aggregations = {}
        
        # Register extension points if plugin manager provided
        if plugin_manager:
            plugin_manager.register_extension_point(
                'metric_handler',
                description="Custom metric collection and processing"
            )
            
            plugin_manager.register_extension_point(
                'metric_aggregator',
                description="Custom metric aggregation methods"
            )
            
            plugin_manager.register_hook(
                'pre_collect_metrics',
                description="Called before collecting metrics"
            )
            
            plugin_manager.register_hook(
                'post_collect_metrics',
                description="Called after collecting metrics"
            )
    
    def register_custom_metric(
        self,
        name: str,
        collector: Callable[[], Any],
        description: Optional[str] = None,
        metric_type: str = 'gauge',
        tags: Optional[Dict[str, str]] = None
    ) -> None:
        """
        Register a custom metric
        
        Args:
            name: Metric name
            collector: Function that returns the metric value
            description: Optional metric description
            metric_type: Metric type (gauge, counter, histogram)
            tags: Optional tags for the metric
        """
        self.custom_metrics[name] = {
            'collector': collector,
            'description': description or f"Custom metric: {name}",
            'type': metric_type,
            'tags': tags or {},
            'last_value': None,
            'last_collection': 0
        }
        
        logger.debug(f"Registered custom metric: {name} ({metric_type})")
    
    def register_derived_metric(
        self,
        name: str,
        formula: Callable[[Dict[str, Any]], Any],
        dependencies: List[str],
        description: Optional[str] = None,
        metric_type: str = 'gauge',
        tags: Optional[Dict[str, str]] = None
    ) -> None:
        """
        Register a derived metric calculated from other metrics
        
        Args:
            name: Metric name
            formula: Function that calculates the metric value from dependencies
            dependencies: List of metric names this depends on
            description: Optional metric description
            metric_type: Metric type (gauge, counter, histogram)
            tags: Optional tags for the metric
        """
        self.derived_metrics[name] = {
            'formula': formula,
            'dependencies': dependencies,
            'description': description or f"Derived metric: {name}",
            'type': metric_type,
            'tags': tags or {},
            'last_value': None,
            'last_calculation': 0
        }
        
        logger.debug(
            f"Registered derived metric: {name} ({metric_type}), "
            f"dependencies: {dependencies}"
        )
    
    def register_metric_handler(
        self,
        name: str,
        handler: Callable[[str, Any, Dict[str, Any]], Any],
        description: Optional[str] = None
    ) -> None:
        """
        Register a metric handler for processing metrics
        
        Args:
            name: Handler name
            handler: Function that processes a metric value
            description: Optional handler description
        """
        self.metric_handlers[name] = {
            'handler': handler,
            'description': description or f"Metric handler: {name}"
        }
        
        logger.debug(f"Registered metric handler: {name}")
    
    def register_aggregation(
        self,
        name: str,
        aggregator: Callable[[List[Any]], Any],
        description: Optional[str] = None
    ) -> None:
        """
        Register a metric aggregation method
        
        Args:
            name: Aggregation name
            aggregator: Function that aggregates a list of values
            description: Optional aggregation description
        """
        self.aggregations[name] = {
            'aggregator': aggregator,
            'description': description or f"Aggregation: {name}"
        }
        
        logger.debug(f"Registered aggregation: {name}")
    
    async def collect_custom_metrics(self) -> Dict[str, Any]:
        """
        Collect all custom metrics
        
        Returns:
            Dictionary of metric name -> value
        """
        # Call pre-collect hook
        if self.plugin_manager:
            await self.plugin_manager.call_hook('pre_collect_metrics')
            
        results = {}
        current_time = time.time()
        
        # Collect custom metrics
        for name, metric in self.custom_metrics.items():
            try:
                value = metric['collector']()
                metric['last_value'] = value
                metric['last_collection'] = current_time
                results[name] = value
            except Exception as e:
                logger.error(f"Error collecting custom metric '{name}': {str(e)}", exc_info=True)
                
        # Calculate derived metrics
        for name, metric in self.derived_metrics.items():
            try:
                # Check if all dependencies are available
                dependencies = {}
                missing_deps = False
                
                for dep_name in metric['dependencies']:
                    if dep_name in results:
                        dependencies[dep_name] = results[dep_name]
                    elif dep_name in self.custom_metrics and self.custom_metrics[dep_name]['last_value'] is not None:
                        dependencies[dep_name] = self.custom_metrics[dep_name]['last_value']
                    else:
                        logger.warning(f"Missing dependency '{dep_name}' for derived metric '{name}'")
                        missing_deps = True
                        break
                        
                if missing_deps:
                    continue
                    
                # Calculate derived metric
                value = metric['formula'](dependencies)
                metric['last_value'] = value
                metric['last_calculation'] = current_time
                results[name] = value
                
            except Exception as e:
                logger.error(f"Error calculating derived metric '{name}': {str(e)}", exc_info=True)
                
        # Apply metric handlers
        for metric_name, value in list(results.items()):
            for handler_name, handler in self.metric_handlers.items():
                try:
                    # Get metric metadata
                    if metric_name in self.custom_metrics:
                        metadata = self.custom_metrics[metric_name]
                    elif metric_name in self.derived_metrics:
                        metadata = self.derived_metrics[metric_name]
                    else:
                        metadata = {'type': 'unknown', 'tags': {}}
                        
                    # Apply handler
                    results[metric_name] = handler['handler'](metric_name, value, metadata)
                    
                except Exception as e:
                    logger.error(
                        f"Error applying metric handler '{handler_name}' to '{metric_name}': {str(e)}",
                        exc_info=True
                    )
                    
        # Call post-collect hook
        if self.plugin_manager:
            await self.plugin_manager.call_hook('post_collect_metrics', results)
            
        return results
    
    def aggregate_metrics(
        self,
        metrics: List[Dict[str, Any]],
        method: str = 'avg'
    ) -> Dict[str, Any]:
        """
        Aggregate multiple metric collections
        
        Args:
            metrics: List of metric dictionaries
            method: Aggregation method (avg, sum, min, max)
            
        Returns:
            Aggregated metrics
        """
        if not metrics:
            return {}
            
        # Use registered aggregation method if available
        if method in self.aggregations:
            try:
                return self.aggregations[method]['aggregator'](metrics)
            except Exception as e:
                logger.error(f"Error using custom aggregation '{method}': {str(e)}", exc_info=True)
                # Fall back to built-in methods
                
        # Built-in aggregation methods
        result = {}
        
        # Get all metric names
        all_keys = set()
        for metric_dict in metrics:
            all_keys.update(metric_dict.keys())
            
        # Aggregate each metric
        for key in all_keys:
            values = [m[key] for m in metrics if key in m and m[key] is not None]
            if not values:
                continue
                
            # Skip non-numeric values
            if not all(isinstance(v, (int, float)) for v in values):
                continue
                
            if method == 'avg':
                result[key] = sum(values) / len(values)
            elif method == 'sum':
                result[key] = sum(values)
            elif method == 'min':
                result[key] = min(values)
            elif method == 'max':
                result[key] = max(values)
            else:
                logger.warning(f"Unknown aggregation method: {method}")
                result[key] = values[0]  # Default to first value
                
        return result


class RealTimeConfigManager:
    """
    Real-time configuration management with validation and notification
    
    Provides dynamic configuration management with live updates and validation.
    """
    
    def __init__(self, config_validator: Optional[Any] = None):
        """
        Initialize real-time configuration manager
        
        Args:
            config_validator: Optional config validator instance
        """
        self.config = {}
        self.validators = {}
        self.subscribers = {}
        self.defaults = {}
        self.change_history = []
        self.max_history = 50
        
        # Store validator if provided
        self.validator = config_validator
    
    def set(self, key: str, value: Any) -> bool:
        """
        Set a configuration value
        
        Args:
            key: Configuration key
            value: Configuration value
            
        Returns:
            True if value was set
        """
        # Validate if validator exists for this key
        if key in self.validators:
            validator = self.validators[key]
            if not validator(value):
                logger.warning(f"Invalid value for configuration key '{key}': {value}")
                return False
                
        # Check if value changed
        old_value = self.config.get(key)
        if old_value == value:
            return True  # No change
            
        # Update value
        self.config[key] = value
        
        # Record change
        self.change_history.append({
            'key': key,
            'old_value': old_value,
            'new_value': value,
            'timestamp': time.time()
        })
        
        # Trim history if needed
        if len(self.change_history) > self.max_history:
            self.change_history = self.change_history[-self.max_history:]
            
        # Notify subscribers
        self._notify_subscribers(key, old_value, value)
        
        return True
    
    def get(self, key: str, default: Any = None) -> Any:
        """
        Get a configuration value
        
        Args:
            key: Configuration key
            default: Default value if key not found
            
        Returns:
            Configuration value or default
        """
        return self.config.get(key, self.defaults.get(key, default))
    
    def register_validator(
        self,
        key: str,
        validator: Callable[[Any], bool]
    ) -> None:
        """
        Register a validator for a configuration key
        
        Args:
            key: Configuration key
            validator: Function that validates the value
        """
        self.validators[key] = validator
        logger.debug(f"Registered validator for config key: {key}")
    
    def subscribe(
        self,
        key: str,
        callback: Callable[[str, Any, Any], None]
    ) -> None:
        """
        Subscribe to configuration changes
        
        Args:
            key: Configuration key
            callback: Function called when the value changes
        """
        if key not in self.subscribers:
            self.subscribers[key] = []
            
        if callback not in self.subscribers[key]:
            self.subscribers[key].append(callback)
            logger.debug(f"Added subscriber for config key: {key}")
    
    def unsubscribe(
        self,
        key: str,
        callback: Callable[[str, Any, Any], None]
    ) -> bool:
        """
        Unsubscribe from configuration changes
        
        Args:
            key: Configuration key
            callback: Function to remove
            
        Returns:
            True if callback was removed
        """
        if key in self.subscribers and callback in self.subscribers[key]:
            self.subscribers[key].remove(callback)
            logger.debug(f"Removed subscriber for config key: {key}")
            
            # Remove empty subscriber lists
            if not self.subscribers[key]:
                del self.subscribers[key]
                
            return True
            
        return False
    
    def _notify_subscribers(
        self,
        key: str,
        old_value: Any,
        new_value: Any
    ) -> None:
        """
        Notify subscribers of a configuration change
        
        Args:
            key: Configuration key
            old_value: Previous value
            new_value: New value
        """
        if key in self.subscribers:
            for callback in self.subscribers[key]:
                try:
                    callback(key, old_value, new_value)
                except Exception as e:
                    logger.error(
                        f"Error in configuration subscriber for '{key}': {str(e)}",
                        exc_info=True
                    )
    
    def set_default(self, key: str, value: Any) -> None:
        """
        Set a default value for a configuration key
        
        Args:
            key: Configuration key
            value: Default value
        """
        self.defaults[key] = value
    
    def set_defaults(self, defaults: Dict[str, Any]) -> None:
        """
        Set multiple default values
        
        Args:
            defaults: Dictionary of default values
        """
        self.defaults.update(defaults)
    
    def get_all(self) -> Dict[str, Any]:
        """
        Get all configuration values
        
        Returns:
            Dictionary of all configuration values
        """
        # Combine defaults and current values
        result = self.defaults.copy()
        result.update(self.config)
        return result
    
    def reset(self, key: str) -> bool:
        """
        Reset a configuration key to its default value
        
        Args:
            key: Configuration key
            
        Returns:
            True if key was reset
        """
        if key not in self.defaults:
            return False
            
        return self.set(key, self.defaults[key])
    
    def reset_all(self) -> None:
        """Reset all configuration keys to defaults"""
        self.config = {}
        
        # Record change
        self.change_history.append({
            'key': '*',
            'old_value': None,
            'new_value': None,
            'timestamp': time.time(),
            'action': 'reset_all'
        })
    
    def get_change_history(self) -> List[Dict[str, Any]]:
        """
        Get configuration change history
        
        Returns:
            List of change records
        """
        return self.change_history
