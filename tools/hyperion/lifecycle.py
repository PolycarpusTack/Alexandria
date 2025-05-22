"""
Hyperion Resource Monitor - Lifecycle Module

Provides lifecycle management features including startup, graceful shutdown,
and component initialization coordinating.
"""

import asyncio
import logging
import os
import signal
import sys
import time
import traceback
from typing import Any, Callable, Dict, List, Optional, Set, Tuple, Union

logger = logging.getLogger(__name__)


class ShutdownManager:
    """
    Manage graceful shutdown of application components
    
    Coordinates orderly shutdown of components with priority-based sequencing 
    and timeout handling.
    """
    
    def __init__(self, timeout: float = 30.0):
        """
        Initialize the shutdown manager
        
        Args:
            timeout: Default timeout for shutdown handlers in seconds
        """
        self.timeout = timeout
        self.registered_handlers = []  # List of (priority, handler, name) tuples
        self.shutdown_in_progress = False
        self.shutdown_started = 0.0
        self.shutdown_complete = False
        self.shutdown_results = []
        
        # Signal handling setup
        self._setup_signal_handlers()
        
        logger.info(f"Shutdown manager initialized with {timeout}s timeout")
    
    def _setup_signal_handlers(self) -> None:
        """
        Set up signal handlers for graceful shutdown
        """
        # Register signal handlers for common termination signals
        for sig in (signal.SIGINT, signal.SIGTERM):
            try:
                # Use add_signal_handler for asyncio compatibility
                loop = asyncio.get_running_loop()
                loop.add_signal_handler(
                    sig,
                    lambda s=sig: asyncio.create_task(
                        self.execute_shutdown(signal_name=signal.Signals(s).name)
                    )
                )
                logger.debug(f"Registered asyncio signal handler for {signal.Signals(sig).name}")
            except (RuntimeError, AttributeError):
                # Fallback for non-asyncio contexts
                original_handler = signal.getsignal(sig)
                def handler(signum, frame):
                    asyncio.run(self.execute_shutdown(signal_name=signal.Signals(signum).name))
                    if callable(original_handler):
                        original_handler(signum, frame)
                signal.signal(sig, handler)
                logger.debug(f"Registered signal handler for {signal.Signals(sig).name}")
    
    def register(
        self, 
        handler: Callable[[], Any], 
        priority: int = 0,
        name: Optional[str] = None,
        timeout: Optional[float] = None
    ) -> None:
        """
        Register a shutdown handler
        
        Args:
            handler: Async function to execute during shutdown
            priority: Priority (higher numbers run first)
            name: Optional name for the handler (defaults to function name)
            timeout: Optional timeout override for this handler
        """
        # Create handler entry
        handler_name = name or handler.__name__
        handler_entry = {
            'priority': priority,
            'handler': handler,
            'name': handler_name,
            'timeout': timeout or self.timeout
        }
        
        # Add to list
        self.registered_handlers.append(handler_entry)
        
        # Sort by priority (descending)
        self.registered_handlers.sort(key=lambda x: x['priority'], reverse=True)
        
        logger.debug(
            f"Registered shutdown handler '{handler_name}' with priority {priority}"
        )
    
    async def execute_shutdown(self, signal_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Execute graceful shutdown sequence
        
        Args:
            signal_name: Optional name of the signal that triggered shutdown
            
        Returns:
            Dictionary with shutdown results
        """
        # Prevent multiple shutdowns
        if self.shutdown_in_progress:
            logger.info("Shutdown already in progress")
            
            # Wait for shutdown to complete
            while not self.shutdown_complete:
                await asyncio.sleep(0.1)
                
            return {'results': self.shutdown_results}
            
        self.shutdown_in_progress = True
        self.shutdown_started = time.time()
        trigger = signal_name or "API call"
        
        logger.info(f"Initiating graceful shutdown due to {trigger}")
        
        # Track results for each handler
        self.shutdown_results = []
        
        # Execute handlers in priority order
        for handler_entry in self.registered_handlers:
            name = handler_entry['name']
            handler = handler_entry['handler']
            timeout = handler_entry['timeout']
            priority = handler_entry['priority']
            
            try:
                logger.info(
                    f"Running shutdown handler '{name}' (priority {priority})"
                )
                
                # Create task with timeout
                handler_task = asyncio.create_task(handler())
                
                try:
                    start_time = time.time()
                    await asyncio.wait_for(handler_task, timeout=timeout)
                    elapsed = time.time() - start_time
                    
                    # Record success
                    self.shutdown_results.append({
                        'name': name,
                        'status': 'success',
                        'elapsed': elapsed
                    })
                    
                    logger.info(
                        f"Shutdown handler '{name}' completed in {elapsed:.2f}s"
                    )
                    
                except asyncio.TimeoutError:
                    # Record timeout
                    self.shutdown_results.append({
                        'name': name,
                        'status': 'timeout',
                        'timeout': timeout
                    })
                    
                    logger.warning(
                        f"Shutdown handler '{name}' timed out after {timeout}s"
                    )
                    
            except Exception as e:
                # Record error
                self.shutdown_results.append({
                    'name': name,
                    'status': 'error',
                    'error': str(e),
                    'traceback': traceback.format_exc()
                })
                
                logger.error(
                    f"Error in shutdown handler '{name}': {str(e)}",
                    exc_info=True
                )
        
        # Mark shutdown as complete
        self.shutdown_complete = True
        total_time = time.time() - self.shutdown_started
        
        # Log shutdown completion
        logger.info(
            f"Shutdown sequence completed in {total_time:.2f}s: "
            f"{len([r for r in self.shutdown_results if r['status'] == 'success'])} successful, "
            f"{len([r for r in self.shutdown_results if r['status'] == 'timeout'])} timeouts, "
            f"{len([r for r in self.shutdown_results if r['status'] == 'error'])} errors"
        )
        
        # Return results
        return {
            'results': self.shutdown_results,
            'total_time': total_time
        }


class StartupManager:
    """
    Manage component initialization during startup
    
    Coordinates dependency-aware initialization of components with
    failure handling and dependency resolution.
    """
    
    def __init__(self, timeout: float = 60.0):
        """
        Initialize the startup manager
        
        Args:
            timeout: Default timeout for startup handlers in seconds
        """
        self.timeout = timeout
        self.components = {}  # name -> component config
        self.dependencies = {}  # name -> list of dependency names
        self.initialized = set()  # set of initialized component names
        self.startup_complete = False
        self.startup_results = {}
    
    def register_component(
        self,
        name: str,
        initializer: Callable[[], Any],
        dependencies: List[str] = None,
        required: bool = True,
        timeout: Optional[float] = None
    ) -> None:
        """
        Register a component for initialization
        
        Args:
            name: Component name
            initializer: Async function to initialize the component
            dependencies: List of component names that must be initialized first
            required: Whether this component is required for successful startup
            timeout: Optional timeout override for this component
        """
        self.components[name] = {
            'initializer': initializer,
            'dependencies': dependencies or [],
            'required': required,
            'timeout': timeout or self.timeout,
            'initialized': False,
            'result': None
        }
        
        # Update dependency map
        for dep in (dependencies or []):
            if dep not in self.dependencies:
                self.dependencies[dep] = []
            self.dependencies[dep].append(name)
            
        logger.debug(
            f"Registered component '{name}' with dependencies: {dependencies or []}"
        )
    
    async def initialize_all(self) -> Dict[str, Any]:
        """
        Initialize all registered components
        
        Returns:
            Dictionary with initialization results
        """
        # Find components with no dependencies
        start_components = [
            name for name, config in self.components.items()
            if not config['dependencies']
        ]
        
        if not start_components:
            logger.warning("No startup components without dependencies found")
            
        # Initialize components
        for name in start_components:
            await self._initialize_component(name)
            
        # Check if any components were not initialized
        remaining = [
            name for name, config in self.components.items()
            if not config['initialized']
        ]
        
        if remaining:
            logger.warning(
                f"Some components were not initialized: {remaining}"
            )
            
            # Check for circular dependencies
            for name in remaining:
                if self._has_circular_dependency(name):
                    logger.error(
                        f"Circular dependency detected for component '{name}'"
                    )
        
        self.startup_complete = True
        
        # Return results
        return {
            'success': all(
                self.components[name]['initialized'] 
                for name, config in self.components.items() 
                if config['required']
            ),
            'initialized': [
                name for name, config in self.components.items()
                if config['initialized']
            ],
            'failed': [
                name for name, config in self.components.items()
                if not config['initialized'] and config['required']
            ],
            'results': self.startup_results
        }
    
    async def _initialize_component(self, name: str) -> bool:
        """
        Initialize a single component and its dependencies
        
        Args:
            name: Component name
            
        Returns:
            True if initialization was successful, False otherwise
        """
        # Check if already initialized
        if self.components[name]['initialized']:
            return True
            
        # Initialize dependencies first
        for dep in self.components[name]['dependencies']:
            if dep not in self.components:
                logger.error(f"Missing dependency '{dep}' for component '{name}'")
                self.startup_results[name] = {
                    'status': 'error',
                    'error': f"Missing dependency '{dep}'"
                }
                return False
                
            # Initialize dependency
            dep_success = await self._initialize_component(dep)
            
            # If required dependency failed, we can't initialize this component
            if not dep_success and self.components[dep]['required']:
                logger.error(
                    f"Required dependency '{dep}' failed for component '{name}'"
                )
                self.startup_results[name] = {
                    'status': 'error',
                    'error': f"Required dependency '{dep}' failed"
                }
                return False
        
        # All dependencies are initialized, initialize this component
        config = self.components[name]
        initializer = config['initializer']
        timeout = config['timeout']
        
        try:
            logger.info(f"Initializing component '{name}'")
            
            # Create task with timeout
            start_time = time.time()
            init_task = asyncio.create_task(initializer())
            
            try:
                result = await asyncio.wait_for(init_task, timeout=timeout)
                elapsed = time.time() - start_time
                
                # Record success
                config['initialized'] = True
                config['result'] = result
                self.initialized.add(name)
                
                self.startup_results[name] = {
                    'status': 'success',
                    'elapsed': elapsed,
                    'result': result
                }
                
                logger.info(
                    f"Component '{name}' initialized in {elapsed:.2f}s"
                )
                
                # Initialize dependent components
                for dependent in self.dependencies.get(name, []):
                    # Check if all dependencies for the dependent are initialized
                    all_deps_init = all(
                        dep in self.initialized 
                        for dep in self.components[dependent]['dependencies']
                    )
                    
                    if all_deps_init:
                        await self._initialize_component(dependent)
                
                return True
                
            except asyncio.TimeoutError:
                # Record timeout
                self.startup_results[name] = {
                    'status': 'timeout',
                    'timeout': timeout
                }
                
                logger.error(
                    f"Component '{name}' initialization timed out after {timeout}s"
                )
                return False
                
        except Exception as e:
            # Record error
            self.startup_results[name] = {
                'status': 'error',
                'error': str(e),
                'traceback': traceback.format_exc()
            }
            
            logger.error(
                f"Error initializing component '{name}': {str(e)}",
                exc_info=True
            )
            return False
    
    def _has_circular_dependency(
        self, 
        name: str, 
        path: Set[str] = None
    ) -> bool:
        """
        Check if a component has circular dependencies
        
        Args:
            name: Component name to check
            path: Current dependency path (for recursion)
            
        Returns:
            True if circular dependency is detected, False otherwise
        """
        if path is None:
            path = set()
            
        # If we've seen this component before in the path, we have a cycle
        if name in path:
            return True
            
        # Add this component to the path
        path.add(name)
        
        # Check dependencies
        for dep in self.components[name]['dependencies']:
            if dep in self.components and self._has_circular_dependency(dep, path):
                return True
                
        # Remove from path when backtracking
        path.remove(name)
        return False
    
    def get_component_result(self, name: str) -> Any:
        """
        Get the initialization result for a component
        
        Args:
            name: Component name
            
        Returns:
            The initialization result or None if not initialized
        """
        if name in self.components and self.components[name]['initialized']:
            return self.components[name]['result']
        return None


class LifecycleManager:
    """
    Unified manager for application lifecycle
    
    Coordinates startup and shutdown processes, providing a single point of
    control for application lifecycle management.
    """
    
    def __init__(
        self,
        startup_timeout: float = 60.0,
        shutdown_timeout: float = 30.0
    ):
        """
        Initialize the lifecycle manager
        
        Args:
            startup_timeout: Default timeout for startup handlers
            shutdown_timeout: Default timeout for shutdown handlers
        """
        self.startup_manager = StartupManager(timeout=startup_timeout)
        self.shutdown_manager = ShutdownManager(timeout=shutdown_timeout)
        self.app_running = False
        self.component_instances = {}
    
    def register_startup_component(
        self,
        name: str,
        initializer: Callable[[], Any],
        dependencies: List[str] = None,
        required: bool = True,
        timeout: Optional[float] = None
    ) -> None:
        """
        Register a component for initialization during startup
        
        Args:
            name: Component name
            initializer: Async function to initialize the component
            dependencies: List of component names that must be initialized first
            required: Whether this component is required for successful startup
            timeout: Optional timeout override for this component
        """
        self.startup_manager.register_component(
            name=name,
            initializer=initializer,
            dependencies=dependencies,
            required=required,
            timeout=timeout
        )
    
    def register_shutdown_handler(
        self,
        handler: Callable[[], Any],
        priority: int = 0,
        name: Optional[str] = None,
        timeout: Optional[float] = None
    ) -> None:
        """
        Register a handler to be called during shutdown
        
        Args:
            handler: Async function to execute during shutdown
            priority: Priority (higher numbers run first)
            name: Optional name for the handler (defaults to function name)
            timeout: Optional timeout override for this handler
        """
        self.shutdown_manager.register(
            handler=handler,
            priority=priority,
            name=name,
            timeout=timeout
        )
    
    async def start_application(self) -> Dict[str, Any]:
        """
        Start the application and initialize all components
        
        Returns:
            Dictionary with initialization results
        """
        logger.info("Starting application")
        
        # Initialize all components
        start_result = await self.startup_manager.initialize_all()
        
        # Set running state based on required components
        self.app_running = start_result['success']
        
        # Store component instances for access
        for name in self.startup_manager.initialized:
            self.component_instances[name] = self.startup_manager.get_component_result(name)
        
        if self.app_running:
            logger.info("Application started successfully")
        else:
            logger.error(
                f"Application startup failed: {len(start_result['failed'])} required "
                f"components failed to initialize"
            )
        
        return start_result
    
    async def stop_application(self) -> Dict[str, Any]:
        """
        Stop the application and perform graceful shutdown
        
        Returns:
            Dictionary with shutdown results
        """
        logger.info("Stopping application")
        
        # Execute shutdown sequence
        shutdown_result = await self.shutdown_manager.execute_shutdown(
            signal_name="API call"
        )
        
        # Update running state
        self.app_running = False
        
        logger.info("Application stopped")
        
        return shutdown_result
    
    def get_component(self, name: str) -> Any:
        """
        Get an initialized component instance
        
        Args:
            name: Component name
            
        Returns:
            The component instance or None if not initialized
        """
        return self.component_instances.get(name)
    
    def is_running(self) -> bool:
        """
        Check if the application is running
        
        Returns:
            True if the application is running, False otherwise
        """
        return self.app_running
