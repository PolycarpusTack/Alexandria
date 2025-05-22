"""
Hyperion Resource Monitor - Decorator Module

Provides decorators for resource-controlled execution of functions.
"""

import asyncio
import functools
import logging
from typing import Any, Callable, Dict, Optional, Union

from .core import HyperionCore

logger = logging.getLogger(__name__)


def with_resource_control(monitor: HyperionCore):
    """
    Decorator for resource-controlled execution of async functions
    
    Args:
        monitor: HyperionCore instance to manage resources
        
    Returns:
        Decorator function
        
    Example:
        @with_resource_control(monitor)
        async def process_content(content: str, **kwargs):
            # Process with controlled resources
            pass
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            await monitor.acquire()
            try:
                # Inject current parameters
                kwargs.update({
                    'chunk_size': monitor.chunk_size,
                    'batch_size': monitor.batch_size,
                    'timeout': monitor.calculate_timeout(kwargs.get('content_length', 0))
                })
                return await func(*args, **kwargs)
            finally:
                monitor.release()
        return wrapper
    return decorator


def with_adaptive_timeout(monitor: HyperionCore):
    """
    Decorator that adds adaptive timeout calculation to function calls
    
    Args:
        monitor: HyperionCore instance to calculate timeout
        
    Returns:
        Decorator function
        
    Example:
        @with_adaptive_timeout(monitor)
        async def fetch_data(url: str, **kwargs):
            timeout = kwargs.get('timeout', 30)
            # Use timeout for operation
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract content_length from the first arg if it's a string,
            # or from content_length kwarg, or default to 0
            content_length = 0
            if args and isinstance(args[0], str):
                content_length = len(args[0])
            else:
                content_length = kwargs.get('content_length', 0)
                
            # Calculate and inject the timeout
            kwargs['timeout'] = monitor.calculate_timeout(content_length)
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator


def with_batch_processing(monitor: HyperionCore):
    """
    Decorator for processing items in batches with resource control
    
    Args:
        monitor: HyperionCore instance to manage resources
        
    Returns:
        Decorator function
        
    Example:
        @with_batch_processing(monitor)
        async def process_items(items: list, **kwargs):
            batch_size = kwargs.get('batch_size', 10)
            # Process with controlled batches
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(items, *args, **kwargs):
            if not items:
                return []
                
            results = []
            batch_size = kwargs.get('batch_size', monitor.batch_size)
            
            # Process in batches
            for i in range(0, len(items), batch_size):
                batch = items[i:i + batch_size]
                
                # Acquire a resource slot
                await monitor.acquire()
                try:
                    # Process this batch
                    batch_result = await func(batch, *args, **kwargs)
                    results.extend(batch_result if isinstance(batch_result, list) else [batch_result])
                finally:
                    monitor.release()
                    
                # Insert a small delay between batches if system is under load
                if monitor._current_state != 'normal':
                    await asyncio.sleep(0.1)
                    
            return results
        return wrapper
    return decorator
