"""Event bus system for decoupling components."""

from typing import Dict, List, Callable, Any
from dataclasses import dataclass
from datetime import datetime
import threading
import logging

logger = logging.getLogger(__name__)


@dataclass
class Event:
    """Base event class."""
    name: str
    data: Any = None
    timestamp: datetime = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now()


class EventBus:
    """Thread-safe event bus for component communication."""
    
    def __init__(self):
        self._subscribers: Dict[str, List[Callable]] = {}
        self._lock = threading.RLock()
        
    def subscribe(self, event_name: str, handler: Callable) -> None:
        """Subscribe to an event."""
        with self._lock:
            if event_name not in self._subscribers:
                self._subscribers[event_name] = []
            self._subscribers[event_name].append(handler)
            logger.debug(f"Handler {handler.__name__} subscribed to {event_name}")
            
    def unsubscribe(self, event_name: str, handler: Callable) -> None:
        """Unsubscribe from an event."""
        with self._lock:
            if event_name in self._subscribers:
                try:
                    self._subscribers[event_name].remove(handler)
                    logger.debug(f"Handler {handler.__name__} unsubscribed from {event_name}")
                except ValueError:
                    pass
                    
    def emit(self, event: Event) -> None:
        """Emit an event to all subscribers."""
        with self._lock:
            handlers = self._subscribers.get(event.name, []).copy()
            
        for handler in handlers:
            try:
                handler(event)
            except Exception as e:
                logger.error(f"Error in event handler {handler.__name__}: {e}")
                
    def emit_async(self, event: Event) -> None:
        """Emit an event asynchronously."""
        thread = threading.Thread(target=self.emit, args=(event,))
        thread.daemon = True
        thread.start()


# Global event bus instance
event_bus = EventBus()


# Common event names
class Events:
    """Common event names used throughout the application."""
    # Project events
    PROJECT_CREATED = "project.created"
    PROJECT_OPENED = "project.opened"
    PROJECT_CLOSED = "project.closed"
    PROJECT_SAVED = "project.saved"
    
    # Chat events
    CHAT_CREATED = "chat.created"
    CHAT_MESSAGE_SENT = "chat.message.sent"
    CHAT_MESSAGE_RECEIVED = "chat.message.received"
    CHAT_CONTEXT_ADDED = "chat.context.added"
    
    # AI events
    AI_MODEL_CHANGED = "ai.model.changed"
    AI_REQUEST_STARTED = "ai.request.started"
    AI_REQUEST_COMPLETED = "ai.request.completed"
    AI_REQUEST_FAILED = "ai.request.failed"
    
    # UI events
    UI_THEME_CHANGED = "ui.theme.changed"
    UI_WINDOW_CLOSED = "ui.window.closed"
    
    # Plugin events
    PLUGIN_LOADED = "plugin.loaded"
    PLUGIN_UNLOADED = "plugin.unloaded"
    PLUGIN_ERROR = "plugin.error"