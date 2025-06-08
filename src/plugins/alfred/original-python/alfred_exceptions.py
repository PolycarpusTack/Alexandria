#!/usr/bin/env python3
"""
Custom exceptions for ALFRED application
Provides specific exception types for better error handling
"""


class AlfredError(Exception):
    """Base exception for all ALFRED-related errors"""
    pass


class ProjectError(AlfredError):
    """Project-related errors"""
    pass


class ProjectNotFoundError(ProjectError):
    """Raised when a project cannot be found"""
    pass


class ProjectCreateError(ProjectError):
    """Raised when project creation fails"""
    pass


class ProjectLoadError(ProjectError):
    """Raised when project loading fails"""
    pass


class OllamaError(AlfredError):
    """Ollama-related errors"""
    pass


class OllamaConnectionError(OllamaError):
    """Raised when connection to Ollama fails"""
    pass


class OllamaTimeoutError(OllamaError):
    """Raised when Ollama request times out"""
    pass


class OllamaModelError(OllamaError):
    """Raised when there's an issue with the model"""
    pass


class FileOperationError(AlfredError):
    """File operation related errors"""
    pass


class FileReadError(FileOperationError):
    """Raised when file reading fails"""
    pass


class FileWriteError(FileOperationError):
    """Raised when file writing fails"""
    pass


class FileSizeError(FileOperationError):
    """Raised when file size exceeds limits"""
    pass


class ChatError(AlfredError):
    """Chat-related errors"""
    pass


class ChatSessionError(ChatError):
    """Raised when there's an issue with chat sessions"""
    pass


class ContextFileError(ChatError):
    """Raised when there's an issue with context files"""
    pass


class UIError(AlfredError):
    """UI-related errors"""
    pass


class CommandPaletteError(UIError):
    """Raised when command palette encounters an error"""
    pass


class ValidationError(AlfredError):
    """Input validation errors"""
    pass


class SecurityError(AlfredError):
    """Security-related errors"""
    pass


class ConfigurationError(AlfredError):
    """Configuration-related errors"""
    pass


class TemplateError(AlfredError):
    """Template-related errors"""
    pass


class TemplateNotFoundError(TemplateError):
    """Raised when a template cannot be found"""
    pass


class TemplateLoadError(TemplateError):
    """Raised when template loading fails"""
    pass


class TemplateExecutionError(TemplateError):
    """Raised when template execution fails"""
    pass


# Error message formatting helper
def format_error_message(error: Exception, context: str = None) -> str:
    """
    Format an error message for display to the user
    
    Args:
        error: The exception
        context: Optional context about what was happening
        
    Returns:
        Formatted error message
    """
    if isinstance(error, AlfredError):
        message = str(error)
    else:
        # For non-ALFRED errors, include the type
        message = f"{type(error).__name__}: {error}"
    
    if context:
        message = f"{context}: {message}"
    
    return message


# Retry decorator for operations that might fail
def retry_on_error(max_attempts: int = 3, delay: float = 1.0, 
                  exceptions: tuple = (OllamaConnectionError, FileOperationError)):
    """
    Decorator to retry operations on specific errors
    
    Args:
        max_attempts: Maximum number of retry attempts
        delay: Delay between attempts in seconds
        exceptions: Tuple of exceptions to retry on
    """
    import time
    from functools import wraps
    
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            last_exception = None
            
            for attempt in range(max_attempts):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e
                    if attempt < max_attempts - 1:
                        time.sleep(delay)
                    continue
                except Exception:
                    # Don't retry on other exceptions
                    raise
            
            # If we got here, all attempts failed
            if last_exception:
                raise last_exception
            
        return wrapper
    return decorator