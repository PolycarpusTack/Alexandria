#!/usr/bin/env python3
"""
Enhanced logging system for ALFRED
Provides structured logging with better formatting and features
"""

import logging
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional, List
import threading
from collections import deque
import traceback


class StructuredFormatter(logging.Formatter):
    """Custom formatter that outputs structured logs"""
    
    def __init__(self, include_traceback: bool = True):
        super().__init__()
        self.include_traceback = include_traceback
    
    def format(self, record: logging.LogRecord) -> str:
        # Base log data
        log_data = {
            'timestamp': datetime.fromtimestamp(record.created).isoformat(),
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
            'module': record.module,
            'function': record.funcName,
            'line': record.lineno,
        }
        
        # Add extra fields
        if hasattr(record, 'data'):
            log_data['data'] = record.data
        
        # Add exception info if present
        if record.exc_info and self.include_traceback:
            log_data['exception'] = {
                'type': record.exc_info[0].__name__,
                'message': str(record.exc_info[1]),
                'traceback': traceback.format_exception(*record.exc_info)
            }
        
        return json.dumps(log_data)


class HumanReadableFormatter(logging.Formatter):
    """Human-readable log formatter with colors"""
    
    COLORS = {
        'DEBUG': '\033[36m',    # Cyan
        'INFO': '\033[32m',     # Green
        'WARNING': '\033[33m',  # Yellow
        'ERROR': '\033[31m',    # Red
        'CRITICAL': '\033[35m', # Magenta
    }
    RESET = '\033[0m'
    
    def __init__(self, use_colors: bool = True):
        super().__init__()
        self.use_colors = use_colors
    
    def format(self, record: logging.LogRecord) -> str:
        # Time
        timestamp = datetime.fromtimestamp(record.created).strftime('%H:%M:%S')
        
        # Level with color
        if self.use_colors:
            level = f"{self.COLORS.get(record.levelname, '')}{record.levelname:8}{self.RESET}"
        else:
            level = f"{record.levelname:8}"
        
        # Location
        location = f"{record.module}.{record.funcName}:{record.lineno}"
        
        # Message
        message = record.getMessage()
        
        # Base format
        formatted = f"{timestamp} | {level} | {location:30} | {message}"
        
        # Add data if present
        if hasattr(record, 'data'):
            formatted += f"\n         | DATA: {json.dumps(record.data, indent=2)}"
        
        # Add exception if present
        if record.exc_info:
            formatted += f"\n         | EXCEPTION: {record.exc_info[0].__name__}: {record.exc_info[1]}"
            if self.use_colors:
                formatted += f"\n{self.COLORS['ERROR']}"
            formatted += "\n" + "".join(traceback.format_exception(*record.exc_info))
            if self.use_colors:
                formatted += self.RESET
        
        return formatted


class MemoryHandler(logging.Handler):
    """In-memory log handler with circular buffer"""
    
    def __init__(self, capacity: int = 1000):
        super().__init__()
        self.capacity = capacity
        self.buffer = deque(maxlen=capacity)
        self.lock = threading.Lock()
    
    def emit(self, record: logging.LogRecord):
        with self.lock:
            self.buffer.append({
                'timestamp': datetime.fromtimestamp(record.created),
                'level': record.levelname,
                'logger': record.name,
                'message': record.getMessage(),
                'module': record.module,
                'function': record.funcName,
                'line': record.lineno,
                'data': getattr(record, 'data', None),
                'exception': record.exc_info
            })
    
    def get_logs(self, level: Optional[str] = None, 
                 logger: Optional[str] = None,
                 since: Optional[datetime] = None) -> List[Dict[str, Any]]:
        """Get filtered logs from memory"""
        with self.lock:
            logs = list(self.buffer)
        
        # Filter by level
        if level:
            logs = [log for log in logs if log['level'] == level]
        
        # Filter by logger
        if logger:
            logs = [log for log in logs if log['logger'].startswith(logger)]
        
        # Filter by time
        if since:
            logs = [log for log in logs if log['timestamp'] > since]
        
        return logs
    
    def clear(self):
        """Clear the log buffer"""
        with self.lock:
            self.buffer.clear()


class LoggerEnhanced:
    """Enhanced logger with additional features"""
    
    def __init__(self, name: str, log_dir: Optional[Path] = None):
        self.logger = logging.getLogger(name)
        self.name = name
        self.log_dir = log_dir or Path.home() / ".alfred" / "logs"
        self.log_dir.mkdir(parents=True, exist_ok=True)
        
        # Set up handlers if not already configured
        if not self.logger.handlers:
            self._setup_handlers()
    
    def _setup_handlers(self):
        """Set up log handlers"""
        # File handler with JSON formatting
        log_file = self.log_dir / f"{self.name}_{datetime.now().strftime('%Y%m%d')}.json"
        file_handler = logging.FileHandler(log_file)
        file_handler.setFormatter(StructuredFormatter())
        file_handler.setLevel(logging.DEBUG)
        
        # Console handler with human-readable formatting
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(HumanReadableFormatter())
        console_handler.setLevel(logging.INFO)
        
        # Memory handler for UI display
        self.memory_handler = MemoryHandler()
        self.memory_handler.setLevel(logging.DEBUG)
        
        # Add handlers
        self.logger.addHandler(file_handler)
        self.logger.addHandler(console_handler)
        self.logger.addHandler(self.memory_handler)
        
        # Set overall level
        self.logger.setLevel(logging.DEBUG)
    
    def _log_with_data(self, level: int, message: str, data: Optional[Dict[str, Any]] = None, **kwargs):
        """Log with structured data"""
        extra = {}
        if data:
            extra['data'] = data
        self.logger.log(level, message, extra=extra, **kwargs)
    
    # Convenience methods
    def debug(self, message: str, data: Optional[Dict[str, Any]] = None):
        self._log_with_data(logging.DEBUG, message, data)
    
    def info(self, message: str, data: Optional[Dict[str, Any]] = None):
        self._log_with_data(logging.INFO, message, data)
    
    def warning(self, message: str, data: Optional[Dict[str, Any]] = None):
        self._log_with_data(logging.WARNING, message, data)
    
    def error(self, message: str, data: Optional[Dict[str, Any]] = None, exc_info=None):
        self._log_with_data(logging.ERROR, message, data, exc_info=exc_info)
    
    def critical(self, message: str, data: Optional[Dict[str, Any]] = None, exc_info=None):
        self._log_with_data(logging.CRITICAL, message, data, exc_info=exc_info)
    
    # Specialized logging methods
    def log_operation(self, operation: str, status: str, duration: float = None, **kwargs):
        """Log an operation with timing"""
        data = {
            'operation': operation,
            'status': status,
            **kwargs
        }
        if duration is not None:
            data['duration_seconds'] = duration
        
        level = logging.INFO if status == 'success' else logging.ERROR
        self._log_with_data(level, f"Operation {operation}: {status}", data)
    
    def log_api_call(self, method: str, endpoint: str, status_code: int = None, 
                     duration: float = None, **kwargs):
        """Log an API call"""
        data = {
            'method': method,
            'endpoint': endpoint,
            **kwargs
        }
        if status_code is not None:
            data['status_code'] = status_code
        if duration is not None:
            data['duration_seconds'] = duration
        
        message = f"API {method} {endpoint}"
        if status_code:
            message += f" -> {status_code}"
        
        level = logging.INFO if status_code and 200 <= status_code < 400 else logging.ERROR
        self._log_with_data(level, message, data)
    
    def log_user_action(self, action: str, details: Optional[Dict[str, Any]] = None):
        """Log a user action"""
        data = {
            'action': action,
            'timestamp': datetime.now().isoformat()
        }
        if details:
            data.update(details)
        
        self._log_with_data(logging.INFO, f"User action: {action}", data)
    
    def log_performance(self, metric: str, value: float, unit: str = "seconds", **kwargs):
        """Log a performance metric"""
        data = {
            'metric': metric,
            'value': value,
            'unit': unit,
            **kwargs
        }
        self._log_with_data(logging.INFO, f"Performance: {metric} = {value} {unit}", data)
    
    def get_recent_logs(self, count: int = 100, level: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get recent logs from memory"""
        if hasattr(self, 'memory_handler'):
            logs = self.memory_handler.get_logs(level=level)
            return logs[-count:]
        return []
    
    def get_log_stats(self) -> Dict[str, int]:
        """Get log statistics"""
        if hasattr(self, 'memory_handler'):
            logs = self.memory_handler.get_logs()
            stats = {
                'total': len(logs),
                'debug': sum(1 for log in logs if log['level'] == 'DEBUG'),
                'info': sum(1 for log in logs if log['level'] == 'INFO'),
                'warning': sum(1 for log in logs if log['level'] == 'WARNING'),
                'error': sum(1 for log in logs if log['level'] == 'ERROR'),
                'critical': sum(1 for log in logs if log['level'] == 'CRITICAL'),
            }
            return stats
        return {}


# Logger factory
class LoggerFactory:
    """Factory for creating loggers"""
    
    _loggers: Dict[str, LoggerEnhanced] = {}
    _lock = threading.Lock()
    
    @classmethod
    def get_logger(cls, name: str) -> LoggerEnhanced:
        """Get or create a logger"""
        with cls._lock:
            if name not in cls._loggers:
                cls._loggers[name] = LoggerEnhanced(name)
            return cls._loggers[name]
    
    @classmethod
    def configure_all(cls, level: str = "INFO", log_dir: Optional[Path] = None):
        """Configure all loggers"""
        numeric_level = getattr(logging, level.upper())
        for logger in cls._loggers.values():
            logger.logger.setLevel(numeric_level)
            if log_dir:
                logger.log_dir = log_dir


# Convenience function
def get_logger(name: str = "alfred") -> LoggerEnhanced:
    """Get a logger instance"""
    return LoggerFactory.get_logger(name)


# Context manager for timed operations
class TimedOperation:
    """Context manager for timing operations"""
    
    def __init__(self, logger: LoggerEnhanced, operation: str, **kwargs):
        self.logger = logger
        self.operation = operation
        self.kwargs = kwargs
        self.start_time = None
    
    def __enter__(self):
        self.start_time = datetime.now()
        self.logger.debug(f"Starting {self.operation}", self.kwargs)
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        duration = (datetime.now() - self.start_time).total_seconds()
        
        if exc_type:
            self.logger.log_operation(
                self.operation, 
                'failed',
                duration,
                error=str(exc_val),
                **self.kwargs
            )
        else:
            self.logger.log_operation(
                self.operation,
                'success',
                duration,
                **self.kwargs
            )
        
        return False  # Don't suppress exceptions