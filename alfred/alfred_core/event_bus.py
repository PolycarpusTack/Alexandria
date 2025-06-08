"""
Event Bus - Decoupled communication system for ALFRED
"""

import asyncio
import logging
from typing import Dict, List, Callable, Any, Optional
from dataclasses import dataclass
from datetime import datetime
import weakref
from functools import wraps

logger = logging.getLogger(__name__)


@dataclass
class Event:
    """Event data container"""
    name: str
    data: Any
    timestamp: datetime
    source: Optional[str] = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now()


class EventBus:
    """Central event bus for plugin communication"""
    
    def __init__(self):
        self._handlers: Dict[str, List[Callable]] = {}
        self._async_handlers: Dict[str, List[Callable]] = {}
        self._event_history: List[Event] = []
        self._history_limit = 1000
        self._middleware: List[Callable] = []
        
    def subscribe(self, event_name: str, handler: Callable, weak: bool = True) -> None:
        """Subscribe to an event"""
        if asyncio.iscoroutinefunction(handler):
            handler_list = self._async_handlers
        else:
            handler_list = self._handlers
            
        if event_name not in handler_list:
            handler_list[event_name] = []
            
        # Use weak references by default to prevent memory leaks
        if weak and hasattr(handler, '__self__'):
            handler = weakref.WeakMethod(handler)
        elif weak:
            handler = weakref.ref(handler)
            
        handler_list[event_name].append(handler)
        logger.debug(f"Handler subscribed to event: {event_name}")
    
    def unsubscribe(self, event_name: str, handler: Callable) -> None:
        """Unsubscribe from an event"""
        for handler_list in [self._handlers, self._async_handlers]:
            if event_name in handler_list:
                # Handle weak references
                handler_list[event_name] = [
                    h for h in handler_list[event_name]
                    if not (isinstance(h, weakref.ref) and h() == handler) and h != handler
                ]
                
    def emit(self, event_name: str, data: Any = None, source: str = None) -> None:
        """Emit an event synchronously"""
        event = Event(event_name, data, datetime.now(), source)
        
        # Apply middleware
        for middleware in self._middleware:
            event = middleware(event)
            if event is None:
                return  # Middleware cancelled the event
        
        # Store in history
        self._add_to_history(event)
        
        # Call synchronous handlers
        if event_name in self._handlers:
            for handler in self._handlers[event_name][:]:  # Copy list to handle modifications
                try:
                    # Handle weak references
                    if isinstance(handler, weakref.ref):
                        actual_handler = handler()
                        if actual_handler is None:
                            self._handlers[event_name].remove(handler)
                            continue
                        handler = actual_handler
                    
                    handler(event)
                except Exception as e:
                    logger.error(f"Error in event handler for {event_name}: {e}")
                    
        # Schedule async handlers
        if event_name in self._async_handlers:
            asyncio.create_task(self._emit_async(event))
    
    async def emit_async(self, event_name: str, data: Any = None, source: str = None) -> None:
        """Emit an event asynchronously"""
        event = Event(event_name, data, datetime.now(), source)
        
        # Apply middleware
        for middleware in self._middleware:
            if asyncio.iscoroutinefunction(middleware):
                event = await middleware(event)
            else:
                event = middleware(event)
            if event is None:
                return
        
        # Store in history
        self._add_to_history(event)
        
        # Call all handlers concurrently
        tasks = []
        
        # Sync handlers
        if event_name in self._handlers:
            for handler in self._handlers[event_name][:]:
                if isinstance(handler, weakref.ref):
                    actual_handler = handler()
                    if actual_handler is None:
                        self._handlers[event_name].remove(handler)
                        continue
                    handler = actual_handler
                
                tasks.append(asyncio.create_task(
                    asyncio.to_thread(handler, event)
                ))
        
        # Async handlers
        if event_name in self._async_handlers:
            for handler in self._async_handlers[event_name][:]:
                if isinstance(handler, weakref.ref):
                    actual_handler = handler()
                    if actual_handler is None:
                        self._async_handlers[event_name].remove(handler)
                        continue
                    handler = actual_handler
                
                tasks.append(asyncio.create_task(handler(event)))
        
        # Wait for all handlers
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
    
    async def _emit_async(self, event: Event) -> None:
        """Internal async emit helper"""
        for handler in self._async_handlers[event.name][:]:
            try:
                if isinstance(handler, weakref.ref):
                    actual_handler = handler()
                    if actual_handler is None:
                        self._async_handlers[event.name].remove(handler)
                        continue
                    handler = actual_handler
                
                await handler(event)
            except Exception as e:
                logger.error(f"Error in async event handler for {event.name}: {e}")
    
    def add_middleware(self, middleware: Callable[[Event], Optional[Event]]) -> None:
        """Add event middleware for filtering/modifying events"""
        self._middleware.append(middleware)
    
    def remove_middleware(self, middleware: Callable) -> None:
        """Remove event middleware"""
        if middleware in self._middleware:
            self._middleware.remove(middleware)
    
    def _add_to_history(self, event: Event) -> None:
        """Add event to history with size limit"""
        self._event_history.append(event)
        if len(self._event_history) > self._history_limit:
            self._event_history.pop(0)
    
    def get_history(self, event_name: Optional[str] = None, limit: int = 100) -> List[Event]:
        """Get event history, optionally filtered by event name"""
        history = self._event_history
        if event_name:
            history = [e for e in history if e.name == event_name]
        return history[-limit:]
    
    def clear_history(self) -> None:
        """Clear event history"""
        self._event_history.clear()
    
    def list_events(self) -> List[str]:
        """List all events with active handlers"""
        events = set()
        events.update(self._handlers.keys())
        events.update(self._async_handlers.keys())
        return sorted(list(events))
    
    def get_handler_count(self, event_name: str) -> int:
        """Get number of handlers for an event"""
        count = 0
        if event_name in self._handlers:
            count += len(self._handlers[event_name])
        if event_name in self._async_handlers:
            count += len(self._async_handlers[event_name])
        return count


# Decorator for easy event handler registration
def event_handler(event_name: str):
    """Decorator for marking methods as event handlers"""
    def decorator(func):
        func._event_handler = event_name
        return func
    return decorator


# Global event bus instance
_global_event_bus = None

def get_event_bus() -> EventBus:
    """Get the global event bus instance"""
    global _global_event_bus
    if _global_event_bus is None:
        _global_event_bus = EventBus()
    return _global_event_bus