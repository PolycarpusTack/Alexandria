"""
Hyperion Resource Monitor - Observability Module

Provides enhanced observability features including distributed tracing,
structured logging, and error context tracking.
"""

import asyncio
import contextvars
import inspect
import json
import logging
import os
import time
import traceback
import uuid
from functools import wraps
from typing import Any, Callable, Dict, List, Optional, Set, Tuple, Union

logger = logging.getLogger(__name__)

# Context variables for distributed tracing
current_trace = contextvars.ContextVar("hyperion_current_trace", default=None)
current_span = contextvars.ContextVar("hyperion_current_span", default=None)


class Trace:
    """
    Distributed trace for request tracking
    
    Provides trace context for correlating logs, metrics, and errors across
    multiple components and services.
    """
    
    def __init__(
        self,
        trace_id: Optional[str] = None,
        parent_span_id: Optional[str] = None,
        name: Optional[str] = None
    ):
        """
        Initialize a new trace
        
        Args:
            trace_id: Optional trace ID (generated if not provided)
            parent_span_id: Optional parent span ID for nested traces
            name: Optional name for the trace
        """
        self.trace_id = trace_id or str(uuid.uuid4())
        self.root_span_id = str(uuid.uuid4())
        self.parent_span_id = parent_span_id
        self.name = name or "unnamed_trace"
        self.start_time = time.time()
        self.end_time = None
        self.metadata = {}
        self.spans = {}  # span_id -> Span
        self.active_spans = set()
        self.error = None
        
    def add_metadata(self, key: str, value: Any) -> None:
        """
        Add metadata to the trace
        
        Args:
            key: Metadata key
            value: Metadata value
        """
        self.metadata[key] = value
        
    def create_span(
        self,
        name: str,
        parent_span_id: Optional[str] = None
    ) -> "Span":
        """
        Create a new span within this trace
        
        Args:
            name: Span name
            parent_span_id: Parent span ID (defaults to root span)
            
        Returns:
            New span object
        """
        span = Span(
            trace_id=self.trace_id,
            span_id=str(uuid.uuid4()),
            parent_span_id=parent_span_id or self.root_span_id,
            name=name
        )
        
        self.spans[span.span_id] = span
        self.active_spans.add(span.span_id)
        
        return span
        
    def end(self, error: Optional[Exception] = None) -> None:
        """
        End the trace
        
        Args:
            error: Optional error that occurred
        """
        self.end_time = time.time()
        self.error = error
        
        # End any active spans
        for span_id in list(self.active_spans):
            self.spans[span_id].end()
            self.active_spans.remove(span_id)
    
    def to_dict(self) -> Dict[str, Any]:
        """
        Convert trace to dictionary for serialization
        
        Returns:
            Dictionary representation of trace
        """
        return {
            "trace_id": self.trace_id,
            "name": self.name,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "duration": (self.end_time - self.start_time) if self.end_time else None,
            "metadata": self.metadata,
            "spans": [span.to_dict() for span in self.spans.values()],
            "error": str(self.error) if self.error else None
        }


class Span:
    """
    Span within a distributed trace
    
    Represents a single operation within a trace, with timing and metadata.
    """
    
    def __init__(
        self,
        trace_id: str,
        span_id: str,
        parent_span_id: Optional[str],
        name: str
    ):
        """
        Initialize a new span
        
        Args:
            trace_id: Trace ID this span belongs to
            span_id: Unique span ID
            parent_span_id: Parent span ID
            name: Span name
        """
        self.trace_id = trace_id
        self.span_id = span_id
        self.parent_span_id = parent_span_id
        self.name = name
        self.start_time = time.time()
        self.end_time = None
        self.metadata = {}
        self.events = []
        self.error = None
        
    def add_metadata(self, key: str, value: Any) -> None:
        """
        Add metadata to the span
        
        Args:
            key: Metadata key
            value: Metadata value
        """
        self.metadata[key] = value
        
    def add_event(self, name: str, metadata: Optional[Dict[str, Any]] = None) -> None:
        """
        Add a time-stamped event to the span
        
        Args:
            name: Event name
            metadata: Optional event metadata
        """
        self.events.append({
            "name": name,
            "time": time.time(),
            "metadata": metadata or {}
        })
        
    def end(self, error: Optional[Exception] = None) -> None:
        """
        End the span
        
        Args:
            error: Optional error that occurred
        """
        self.end_time = time.time()
        self.error = error
        
    def to_dict(self) -> Dict[str, Any]:
        """
        Convert span to dictionary for serialization
        
        Returns:
            Dictionary representation of span
        """
        return {
            "trace_id": self.trace_id,
            "span_id": self.span_id,
            "parent_span_id": self.parent_span_id,
            "name": self.name,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "duration": (self.end_time - self.start_time) if self.end_time else None,
            "metadata": self.metadata,
            "events": self.events,
            "error": str(self.error) if self.error else None
        }


class TraceContext:
    """
    Context manager for distributed tracing
    
    Manages trace and span lifecycle with context manager support.
    """
    
    def __init__(
        self,
        name: str,
        trace_id: Optional[str] = None,
        parent_span_id: Optional[str] = None
    ):
        """
        Initialize a new trace context
        
        Args:
            name: Name for the trace/span
            trace_id: Optional trace ID
            parent_span_id: Optional parent span ID
        """
        self.name = name
        self.trace_id = trace_id
        self.parent_span_id = parent_span_id
        self.trace = None
        self.span = None
        self.trace_token = None
        self.span_token = None
        
    async def __aenter__(self) -> Tuple[Trace, Span]:
        """
        Enter async context manager
        
        Returns:
            Tuple of (trace, span)
        """
        # Check if we're continuing an existing trace
        existing_trace = current_trace.get()
        
        if existing_trace and not self.trace_id:
            # Create a new span in the existing trace
            self.trace = existing_trace
            parent_id = self.parent_span_id or current_span.get().span_id if current_span.get() else None
            self.span = self.trace.create_span(self.name, parent_id)
            
            # Update context vars
            self.span_token = current_span.set(self.span)
        else:
            # Create a new trace
            self.trace = Trace(
                trace_id=self.trace_id,
                parent_span_id=self.parent_span_id,
                name=self.name
            )
            
            # Create the root span
            self.span = Span(
                trace_id=self.trace.trace_id,
                span_id=self.trace.root_span_id,
                parent_span_id=None,
                name=self.name
            )
            
            # Add the root span to the trace
            self.trace.spans[self.span.span_id] = self.span
            self.trace.active_spans.add(self.span.span_id)
            
            # Update context vars
            self.trace_token = current_trace.set(self.trace)
            self.span_token = current_span.set(self.span)
        
        return self.trace, self.span
    
    async def __aexit__(
        self,
        exc_type: Optional[Type[BaseException]],
        exc_val: Optional[BaseException],
        exc_tb: Optional[TracebackType]
    ) -> None:
        """
        Exit async context manager
        
        Args:
            exc_type: Exception type if an exception was raised
            exc_val: Exception value if an exception was raised
            exc_tb: Exception traceback if an exception was raised
        """
        # End the span
        if self.span:
            self.span.end(error=exc_val)
            
        # If this is the root trace, end it too
        if self.trace_token and self.trace:
            self.trace.end(error=exc_val)
            
        # Reset context vars
        if self.span_token:
            current_span.reset(self.span_token)
        
        if self.trace_token:
            current_trace.reset(self.trace_token)
    
    def __enter__(self) -> Tuple[Trace, Span]:
        """
        Enter synchronous context manager
        
        Returns:
            Tuple of (trace, span)
        """
        # Check if we're continuing an existing trace
        existing_trace = current_trace.get()
        
        if existing_trace and not self.trace_id:
            # Create a new span in the existing trace
            self.trace = existing_trace
            parent_id = self.parent_span_id or current_span.get().span_id if current_span.get() else None
            self.span = self.trace.create_span(self.name, parent_id)
            
            # Update context vars
            self.span_token = current_span.set(self.span)
        else:
            # Create a new trace
            self.trace = Trace(
                trace_id=self.trace_id,
                parent_span_id=self.parent_span_id,
                name=self.name
            )
            
            # Create the root span
            self.span = Span(
                trace_id=self.trace.trace_id,
                span_id=self.trace.root_span_id,
                parent_span_id=None,
                name=self.name
            )
            
            # Add the root span to the trace
            self.trace.spans[self.span.span_id] = self.span
            self.trace.active_spans.add(self.span.span_id)
            
            # Update context vars
            self.trace_token = current_trace.set(self.trace)
            self.span_token = current_span.set(self.span)
        
        return self.trace, self.span
    
    def __exit__(
        self,
        exc_type: Optional[Type[BaseException]],
        exc_val: Optional[BaseException],
        exc_tb: Optional[TracebackType]
    ) -> None:
        """
        Exit synchronous context manager
        
        Args:
            exc_type: Exception type if an exception was raised
            exc_val: Exception value if an exception was raised
            exc_tb: Exception traceback if an exception was raised
        """
        # End the span
        if self.span:
            self.span.end(error=exc_val)
            
        # If this is the root trace, end it too
        if self.trace_token and self.trace:
            self.trace.end(error=exc_val)
            
        # Reset context vars
        if self.span_token:
            current_span.reset(self.span_token)
        
        if self.trace_token:
            current_trace.reset(self.trace_token)


def trace(name: Optional[str] = None):
    """
    Decorator for adding distributed tracing to functions
    
    Args:
        name: Optional name for the trace/span (defaults to function name)
        
    Returns:
        Decorated function
    """
    def decorator(func):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            # Use function name if trace name not provided
            trace_name = name or func.__name__
            
            async with TraceContext(trace_name) as (trace, span):
                # Add function arguments as metadata
                try:
                    # Get function signature
                    sig = inspect.signature(func)
                    bound_args = sig.bind(*args, **kwargs)
                    
                    # Filter out self/cls for methods
                    if 'self' in bound_args.arguments:
                        del bound_args.arguments['self']
                    if 'cls' in bound_args.arguments:
                        del bound_args.arguments['cls']
                    
                    # Add arguments as metadata
                    for name, value in bound_args.arguments.items():
                        # Skip large or sensitive arguments
                        if name.lower() in ('password', 'token', 'secret'):
                            span.add_metadata(name, '***')
                        else:
                            try:
                                # Try to convert to JSON to ensure it's serializable
                                json.dumps(value)
                                span.add_metadata(name, value)
                            except (TypeError, OverflowError):
                                # If not serializable, just add the type
                                span.add_metadata(name, f"<{type(value).__name__}>")
                except Exception:
                    # Don't fail if we can't extract arguments
                    pass
                
                # Call the function
                return await func(*args, **kwargs)
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            # Use function name if trace name not provided
            trace_name = name or func.__name__
            
            with TraceContext(trace_name) as (trace, span):
                # Add function arguments as metadata (same as above)
                try:
                    sig = inspect.signature(func)
                    bound_args = sig.bind(*args, **kwargs)
                    
                    if 'self' in bound_args.arguments:
                        del bound_args.arguments['self']
                    if 'cls' in bound_args.arguments:
                        del bound_args.arguments['cls']
                    
                    for name, value in bound_args.arguments.items():
                        if name.lower() in ('password', 'token', 'secret'):
                            span.add_metadata(name, '***')
                        else:
                            try:
                                json.dumps(value)
                                span.add_metadata(name, value)
                            except (TypeError, OverflowError):
                                span.add_metadata(name, f"<{type(value).__name__}>")
                except Exception:
                    pass
                
                # Call the function
                return func(*args, **kwargs)
        
        # Use the appropriate wrapper based on the function type
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper
    
    return decorator


class ErrorContext:
    """
    Error context tracking for enhanced error reporting
    
    Captures errors with context information for better debugging and
    correlation with traces and metrics.
    """
    
    def __init__(self):
        """Initialize error context tracker"""
        self.errors = []  # List of captured errors
        self.max_errors = 1000  # Maximum number of errors to keep
    
    def capture_exception(
        self, 
        exception: Exception,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Capture an exception with context information
        
        Args:
            exception: The exception to capture
            metadata: Optional metadata about the context
            
        Returns:
            Error ID for reference
        """
        error_id = str(uuid.uuid4())
        
        # Get trace information if available
        trace_data = {}
        trace = current_trace.get()
        span = current_span.get()
        
        if trace:
            trace_data['trace_id'] = trace.trace_id
            trace_data['trace_name'] = trace.name
            
        if span:
            trace_data['span_id'] = span.span_id
            trace_data['span_name'] = span.name
        
        # Create error record
        error_record = {
            'error_id': error_id,
            'timestamp': time.time(),
            'exception_type': type(exception).__name__,
            'exception_message': str(exception),
            'traceback': traceback.format_exc(),
            'trace': trace_data,
            'metadata': metadata or {}
        }
        
        # Add to errors list, truncating if needed
        self.errors.append(error_record)
        if len(self.errors) > self.max_errors:
            self.errors = self.errors[-self.max_errors:]
        
        # Log the error
        logger.error(
            f"Error captured [id={error_id}]: {type(exception).__name__}: {str(exception)}",
            extra={
                'error_id': error_id,
                'trace_id': trace_data.get('trace_id'),
                'span_id': trace_data.get('span_id')
            }
        )
        
        return error_id
    
    def get_error(self, error_id: str) -> Optional[Dict[str, Any]]:
        """
        Get details for a specific error
        
        Args:
            error_id: Error ID to retrieve
            
        Returns:
            Error details or None if not found
        """
        for error in self.errors:
            if error['error_id'] == error_id:
                return error
        return None
    
    def get_recent_errors(self, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Get recent errors
        
        Args:
            limit: Maximum number of errors to return
            
        Returns:
            List of recent errors
        """
        return self.errors[-limit:]
    
    def clear_errors(self) -> None:
        """Clear all captured errors"""
        self.errors = []


class StructuredLogger:
    """
    Enhanced structured logging with trace correlation
    
    Provides JSON logging with automatic trace correlation and
    additional context information.
    """
    
    def __init__(self, name: str = 'hyperion'):
        """
        Initialize structured logger
        
        Args:
            name: Logger name
        """
        self.logger = logging.getLogger(name)
        self.default_fields = {}
    
    def add_default_field(self, key: str, value: Any) -> None:
        """
        Add a default field to include in all log entries
        
        Args:
            key: Field name
            value: Field value
        """
        self.default_fields[key] = value
    
    def _format_message(
        self,
        level: str,
        message: str,
        fields: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Format a structured log message
        
        Args:
            level: Log level
            message: Log message
            fields: Additional fields
            
        Returns:
            Structured log entry
        """
        # Start with timestamp and message
        log_entry = {
            'timestamp': time.time(),
            'level': level,
            'message': message
        }
        
        # Add default fields
        log_entry.update(self.default_fields)
        
        # Add trace context if available
        trace = current_trace.get()
        span = current_span.get()
        
        if trace:
            log_entry['trace_id'] = trace.trace_id
            
        if span:
            log_entry['span_id'] = span.span_id
        
        # Add additional fields
        if fields:
            for key, value in fields.items():
                log_entry[key] = value
        
        return log_entry
    
    def debug(
        self,
        message: str,
        **fields
    ) -> None:
        """
        Log a debug message
        
        Args:
            message: Log message
            **fields: Additional fields
        """
        if self.logger.isEnabledFor(logging.DEBUG):
            log_entry = self._format_message('DEBUG', message, fields)
            self.logger.debug(json.dumps(log_entry))
    
    def info(
        self,
        message: str,
        **fields
    ) -> None:
        """
        Log an info message
        
        Args:
            message: Log message
            **fields: Additional fields
        """
        if self.logger.isEnabledFor(logging.INFO):
            log_entry = self._format_message('INFO', message, fields)
            self.logger.info(json.dumps(log_entry))
    
    def warning(
        self,
        message: str,
        **fields
    ) -> None:
        """
        Log a warning message
        
        Args:
            message: Log message
            **fields: Additional fields
        """
        if self.logger.isEnabledFor(logging.WARNING):
            log_entry = self._format_message('WARNING', message, fields)
            self.logger.warning(json.dumps(log_entry))
    
    def error(
        self,
        message: str,
        exception: Optional[Exception] = None,
        **fields
    ) -> Optional[str]:
        """
        Log an error message
        
        Args:
            message: Log message
            exception: Optional exception to capture
            **fields: Additional fields
            
        Returns:
            Error ID if exception was captured, None otherwise
        """
        if self.logger.isEnabledFor(logging.ERROR):
            log_entry = self._format_message('ERROR', message, fields)
            
            # Capture exception if provided
            if exception:
                error_context = ErrorContext()
                error_id = error_context.capture_exception(exception, fields)
                log_entry['error_id'] = error_id
                self.logger.error(json.dumps(log_entry), exc_info=exception)
                return error_id
            else:
                self.logger.error(json.dumps(log_entry))
                
        return None
    
    def critical(
        self,
        message: str,
        exception: Optional[Exception] = None,
        **fields
    ) -> Optional[str]:
        """
        Log a critical message
        
        Args:
            message: Log message
            exception: Optional exception to capture
            **fields: Additional fields
            
        Returns:
            Error ID if exception was captured, None otherwise
        """
        if self.logger.isEnabledFor(logging.CRITICAL):
            log_entry = self._format_message('CRITICAL', message, fields)
            
            # Capture exception if provided
            if exception:
                error_context = ErrorContext()
                error_id = error_context.capture_exception(exception, fields)
                log_entry['error_id'] = error_id
                self.logger.critical(json.dumps(log_entry), exc_info=exception)
                return error_id
            else:
                self.logger.critical(json.dumps(log_entry))
                
        return None


class ObservabilityManager:
    """
    Centralized observability management
    
    Provides unified access to tracing, logging, and error tracking.
    """
    
    def __init__(self, app_name: str = 'hyperion'):
        """
        Initialize observability manager
        
        Args:
            app_name: Application name
        """
        self.app_name = app_name
        self.error_context = ErrorContext()
        self.logger = StructuredLogger(app_name)
        
        # Add default fields to logger
        self.logger.add_default_field('app', app_name)
        self.logger.add_default_field('hostname', os.environ.get('HOSTNAME', 'unknown'))
    
    def trace_context(
        self,
        name: str,
        trace_id: Optional[str] = None,
        parent_span_id: Optional[str] = None
    ) -> TraceContext:
        """
        Create a new trace context
        
        Args:
            name: Context name
            trace_id: Optional trace ID
            parent_span_id: Optional parent span ID
            
        Returns:
            Trace context object
        """
        return TraceContext(name, trace_id, parent_span_id)
    
    def capture_exception(
        self,
        exception: Exception,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Capture an exception with context
        
        Args:
            exception: Exception to capture
            metadata: Optional metadata
            
        Returns:
            Error ID
        """
        return self.error_context.capture_exception(exception, metadata)
    
    def get_current_trace_id(self) -> Optional[str]:
        """
        Get the current trace ID
        
        Returns:
            Current trace ID or None
        """
        trace = current_trace.get()
        return trace.trace_id if trace else None
    
    def get_current_span_id(self) -> Optional[str]:
        """
        Get the current span ID
        
        Returns:
            Current span ID or None
        """
        span = current_span.get()
        return span.span_id if span else None
    
    @trace("init_opentelemetry_export")
    async def init_opentelemetry_export(self) -> bool:
        """
        Initialize OpenTelemetry export
        
        Returns:
            True if successful, False otherwise
        """
        try:
            # This is a placeholder - would integrate with actual OpenTelemetry SDK
            logger.info("OpenTelemetry export initialized")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize OpenTelemetry: {str(e)}", exc_info=True)
            return False
