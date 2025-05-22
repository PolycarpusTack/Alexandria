"""
Exception classes for Enterprise Chunker.

This module defines the comprehensive exception hierarchy used throughout the Enterprise Chunker library,
providing consistent error handling and informative error messages for all possible failure modes.

Exceptions are organized in a logical hierarchy that allows catching specific error types
while also enabling broad exception handling when needed. Each exception class captures
contextual information relevant to diagnosing and resolving the specific error condition.

The exception hierarchy follows this structure:
- EnterpriseChunkerError (Base class)
  ├── ChunkingError (Core chunking failures)
  │   ├── BoundaryDetectionError
  │   ├── FormatParsingError
  │   │   ├── JsonParsingError
  │   │   ├── MarkdownParsingError
  │   │   ├── XmlParsingError
  │   │   └── ... (Other formats)
  │   └── RecoveryFailureError
  ├── FormatDetectionError
  ├── StreamProcessingError
  ├── ParallelProcessingError
  ├── MemorySafetyError
  ├── ResourceExhaustionError
  ├── CircuitBreakerError
  ├── TimeoutExceededError
  ├── TokenEstimationError
  ├── ValidationError
  ├── ConfigurationError
  ├── PatternLoadError
  ├── PluginError
  ├── ExternalLibraryError
  ├── FileAccessError
  └── UnsupportedOperationError
  ├── SecurityViolationError

Typical usage:
    try:
        result = chunker.chunk(text)
    except BoundaryDetectionError as e:
        # Handle boundary-specific errors
        logger.warning(f"Boundary detection failed: {e}")
    except ChunkingError as e:
        # Handle any chunking error
        logger.error(f"Chunking failed: {e}")
    except FormatDetectionError as e:
        # Handle format detection errors
        logger.error(f"Format detection failed: {e}")
    except EnterpriseChunkerError as e:
        # Handle any library error
        logger.error(f"Enterprise Chunker error: {e}")
"""

import logging
from typing import Optional, Dict, Any, List, Union, Tuple

# Configure module logger
logger = logging.getLogger(__name__)


class EnterpriseChunkerError(Exception):
    """
    Base exception class for all Enterprise Chunker errors.
    
    This serves as the root of the exception hierarchy, allowing users to catch
    all library-specific exceptions with a single except clause.
    
    Attributes:
        message: Human-readable error description
        operation_id: Optional identifier for the operation that failed
        details: Optional dictionary with additional error context
    """
    
    def __init__(
        self, 
        message: str,
        operation_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        """
        Initialize the exception with error information.
        
        Args:
            message: Human-readable error description
            operation_id: Optional identifier for the operation that failed
            details: Optional dictionary with additional error context
        """
        self.message = message
        self.operation_id = operation_id
        self.details = details or {}
        
        # Format the message with operation_id if available
        formatted_message = message
        if operation_id:
            formatted_message = f"[{operation_id}] {message}"
            
        super().__init__(formatted_message)


class ChunkingError(EnterpriseChunkerError):
    """
    Exception raised when the chunking process fails.
    
    This is a general exception for errors that occur during the core chunking process,
    serving as a parent class for more specific chunking-related exceptions.
    
    Attributes:
        strategy: Optional name of the chunking strategy that was used
        text_length: Optional length of the text being processed
    """
    
    def __init__(
        self, 
        message: str,
        operation_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        strategy: Optional[str] = None,
        text_length: Optional[int] = None,
        fallback_attempted: bool = False
    ):
        """
        Initialize chunking error with context information.
        
        Args:
            message: Human-readable error description
            operation_id: Optional identifier for the operation that failed
            details: Optional dictionary with additional error context
            strategy: Optional name of the chunking strategy used
            text_length: Optional length of the text being processed
            fallback_attempted: Whether a fallback strategy was attempted
        """
        self.strategy = strategy
        self.text_length = text_length
        self.fallback_attempted = fallback_attempted
        
        # Add strategy and text_length to details if provided
        error_details = details or {}
        if strategy:
            error_details["strategy"] = strategy
        if text_length is not None:
            error_details["text_length"] = text_length
        error_details["fallback_attempted"] = fallback_attempted
        
        super().__init__(message, operation_id, error_details)


class BoundaryDetectionError(ChunkingError):
    """
    Exception raised when boundary detection fails.
    
    This exception is used specifically for errors during the boundary detection phase
    of the chunking process, which identifies where to split the text.
    
    Attributes:
        boundary_type: Optional type of boundary being detected
        detected_boundaries: Optional count of boundaries successfully detected before failure
        format_type: Optional content format being processed
    """
    
    def __init__(
        self,
        message: str,
        operation_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        strategy: Optional[str] = None,
        text_length: Optional[int] = None,
        boundary_type: Optional[str] = None,
        detected_boundaries: Optional[int] = None,
        format_type: Optional[str] = None
    ):
        """
        Initialize boundary detection error with context information.
        
        Args:
            message: Human-readable error description
            operation_id: Optional identifier for the operation that failed
            details: Optional dictionary with additional error context
            strategy: Optional name of the chunking strategy used
            text_length: Optional length of the text being processed
            boundary_type: Optional type of boundary being detected
            detected_boundaries: Optional count of boundaries detected before failure
            format_type: Optional content format being processed
        """
        self.boundary_type = boundary_type
        self.detected_boundaries = detected_boundaries
        self.format_type = format_type
        
        # Add boundary information to details
        error_details = details or {}
        if boundary_type:
            error_details["boundary_type"] = boundary_type
        if detected_boundaries is not None:
            error_details["detected_boundaries"] = detected_boundaries
        if format_type:
            error_details["format_type"] = format_type
            
        super().__init__(
            message, 
            operation_id, 
            error_details, 
            strategy, 
            text_length
        )


class FormatDetectionError(EnterpriseChunkerError):
    """
    Exception raised when content format detection fails.
    
    This exception occurs when the library cannot determine the format
    of the content being processed, which affects strategy selection.
    
    Attributes:
        sample_size: Size of the sample used for format detection
        detected_formats: Dictionary of format candidates with confidence scores
    """
    
    def __init__(
        self,
        message: str,
        operation_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        sample_size: Optional[int] = None,
        detected_formats: Optional[Dict[str, float]] = None
    ):
        """
        Initialize format detection error with context information.
        
        Args:
            message: Human-readable error description
            operation_id: Optional identifier for the operation that failed
            details: Optional dictionary with additional error context
            sample_size: Size of the sample used for format detection
            detected_formats: Dictionary of format candidates with confidence scores
        """
        self.sample_size = sample_size
        self.detected_formats = detected_formats
        
        # Add format detection info to details
        error_details = details or {}
        if sample_size is not None:
            error_details["sample_size"] = sample_size
        if detected_formats:
            error_details["detected_formats"] = detected_formats
            
        super().__init__(message, operation_id, error_details)


class ParallelProcessingError(ChunkingError):
    """
    Exception raised when parallel processing fails.
    
    This exception occurs during multi-threaded or multi-process chunking
    operations, typically in the orchestrator layer.
    
    Attributes:
        worker_count: Number of workers that were being used
        completed_tasks: Number of tasks that were completed before the error
        worker_errors: List of worker-specific error messages
    """
    
    def __init__(
        self,
        message: str,
        operation_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        worker_count: Optional[int] = None,
        completed_tasks: Optional[int] = None,
        worker_errors: Optional[List[str]] = None,
        use_processes: bool = False
    ):
        """
        Initialize parallel processing error with context information.
        
        Args:
            message: Human-readable error description
            operation_id: Optional identifier for the operation that failed
            details: Optional dictionary with additional error context
            worker_count: Number of workers being used
            completed_tasks: Number of tasks completed before error
            worker_errors: List of worker-specific error messages
            use_processes: Whether using processes (True) or threads (False)
        """
        self.worker_count = worker_count
        self.completed_tasks = completed_tasks
        self.worker_errors = worker_errors
        self.use_processes = use_processes
        
        # Add parallel processing info to details
        error_details = details or {}
        if worker_count is not None:
            error_details["worker_count"] = worker_count
        if completed_tasks is not None:
            error_details["completed_tasks"] = completed_tasks
        if worker_errors:
            error_details["worker_errors"] = worker_errors
        error_details["parallel_mode"] = "processes" if use_processes else "threads"
            
        super().__init__(message, operation_id, error_details)


class MemorySafetyError(EnterpriseChunkerError):
    """
    Exception raised when memory safety limits would be exceeded.
    
    This exception occurs when processing would require more memory
    than is safely available, preventing out-of-memory conditions.
    
    Attributes:
        required_memory: Estimated memory required for the operation (MB)
        available_memory: Estimated memory available (MB)
        operation_type: Type of operation that would exceed memory limits
    """
    
    def __init__(
        self,
        message: str,
        operation_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        required_memory: Optional[float] = None,
        available_memory: Optional[float] = None,
        operation_type: Optional[str] = None
    ):
        """
        Initialize memory safety error with context information.
        
        Args:
            message: Human-readable error description
            operation_id: Optional identifier for the operation that failed
            details: Optional dictionary with additional error context
            required_memory: Estimated memory required for operation (MB)
            available_memory: Estimated memory available (MB)
            operation_type: Type of operation that would exceed memory limits
        """
        self.required_memory = required_memory
        self.available_memory = available_memory
        self.operation_type = operation_type
        
        # Add memory information to details
        error_details = details or {}
        if required_memory is not None:
            error_details["required_memory_mb"] = required_memory
        if available_memory is not None:
            error_details["available_memory_mb"] = available_memory
        if operation_type:
            error_details["operation_type"] = operation_type
            
        super().__init__(message, operation_id, error_details)


class CircuitBreakerError(EnterpriseChunkerError):
    """
    Exception raised when the circuit breaker is open.
    
    This exception prevents cascading failures by stopping operations
    when the system is in a degraded state.
    
    Attributes:
        health_status: Current health status of the system
        reset_time: When the circuit breaker will reset (seconds since epoch)
        error_rate: Recent error rate that triggered the circuit breaker
    """
    
    def __init__(
        self,
        message: str,
        operation_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        health_status: Optional[str] = None,
        reset_time: Optional[float] = None,
        error_rate: Optional[float] = None
    ):
        """
        Initialize circuit breaker error with context information.
        
        Args:
            message: Human-readable error description
            operation_id: Optional identifier for the operation that failed
            details: Optional dictionary with additional error context
            health_status: Current health status of the system
            reset_time: When the circuit breaker will reset (seconds since epoch)
            error_rate: Recent error rate that triggered the circuit breaker
        """
        self.health_status = health_status
        self.reset_time = reset_time
        self.error_rate = error_rate
        
        # Add circuit breaker info to details
        error_details = details or {}
        if health_status:
            error_details["health_status"] = health_status
        if reset_time is not None:
            error_details["reset_time"] = reset_time
        if error_rate is not None:
            error_details["error_rate"] = error_rate
            
        super().__init__(message, operation_id, error_details)


class TimeoutExceededError(EnterpriseChunkerError):
    """
    Exception raised when an operation times out.
    
    This exception occurs when processing takes longer than the
    configured timeout, preventing indefinite blocking.
    
    Attributes:
        timeout: Timeout duration that was exceeded (seconds)
        elapsed: Actual time elapsed before timeout (seconds)
        operation_type: Type of operation that timed out
    """
    
    def __init__(
        self,
        message: str,
        operation_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        timeout: Optional[float] = None,
        elapsed: Optional[float] = None,
        operation_type: Optional[str] = None
    ):
        """
        Initialize timeout error with context information.
        
        Args:
            message: Human-readable error description
            operation_id: Optional identifier for the operation that failed
            details: Optional dictionary with additional error context
            timeout: Timeout duration that was exceeded (seconds)
            elapsed: Actual time elapsed before timeout (seconds)
            operation_type: Type of operation that timed out
        """
        self.timeout = timeout
        self.elapsed = elapsed
        self.operation_type = operation_type
        
        # Add timeout info to details
        error_details = details or {}
        if timeout is not None:
            error_details["timeout_seconds"] = timeout
        if elapsed is not None:
            error_details["elapsed_seconds"] = elapsed
        if operation_type:
            error_details["operation_type"] = operation_type
            
        super().__init__(message, operation_id, error_details)


class TokenEstimationError(EnterpriseChunkerError):
    """
    Exception raised when token estimation fails.
    
    This exception occurs during the token counting/estimation process,
    which is critical for determining chunk sizes.
    
    Attributes:
        estimation_strategy: Token estimation strategy being used
        sample_length: Length of the text sample being estimated
    """
    
    def __init__(
        self,
        message: str,
        operation_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        estimation_strategy: Optional[str] = None,
        sample_length: Optional[int] = None
    ):
        """
        Initialize token estimation error with context information.
        
        Args:
            message: Human-readable error description
            operation_id: Optional identifier for the operation that failed
            details: Optional dictionary with additional error context
            estimation_strategy: Token estimation strategy being used
            sample_length: Length of the text sample being estimated
        """
        self.estimation_strategy = estimation_strategy
        self.sample_length = sample_length
        
        # Add estimation info to details
        error_details = details or {}
        if estimation_strategy:
            error_details["estimation_strategy"] = estimation_strategy
        if sample_length is not None:
            error_details["sample_length"] = sample_length
            
        super().__init__(message, operation_id, error_details)


class ValidationError(EnterpriseChunkerError):
    """
    Exception raised when input validation fails.
    
    This exception occurs when input parameters do not meet required
    constraints, such as type, range, or format.
    
    Attributes:
        parameter: Name of the parameter that failed validation
        expected: Description of the expected value or constraint
        received: The actual value received
    """
    
    def __init__(
        self,
        message: str,
        operation_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        parameter: Optional[str] = None,
        expected: Optional[str] = None,
        received: Optional[Any] = None
    ):
        """
        Initialize validation error with context information.
        
        Args:
            message: Human-readable error description
            operation_id: Optional identifier for the operation that failed
            details: Optional dictionary with additional error context
            parameter: Name of the parameter that failed validation
            expected: Description of the expected value or constraint
            received: The actual value received
        """
        self.parameter = parameter
        self.expected = expected
        self.received = received
        
        # Add validation info to details
        error_details = details or {}
        if parameter:
            error_details["parameter"] = parameter
        if expected:
            error_details["expected"] = expected
        if received is not None:
            # Convert received value to string for better error messages
            error_details["received"] = str(received)
            
        super().__init__(message, operation_id, error_details)


class ConfigurationError(EnterpriseChunkerError):
    """
    Exception raised when there is an issue with configuration.
    
    This exception occurs when configuration parameters are invalid,
    missing, or conflicting, preventing proper operation.
    
    Attributes:
        config_source: Source of the configuration (e.g., file, env vars)
        config_keys: List of configuration keys involved in the error
    """
    
    def __init__(
        self,
        message: str,
        operation_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        config_source: Optional[str] = None,
        config_keys: Optional[List[str]] = None
    ):
        """
        Initialize configuration error with context information.
        
        Args:
            message: Human-readable error description
            operation_id: Optional identifier for the operation that failed
            details: Optional dictionary with additional error context
            config_source: Source of the configuration
            config_keys: List of configuration keys involved in the error
        """
        self.config_source = config_source
        self.config_keys = config_keys
        
        # Add configuration info to details
        error_details = details or {}
        if config_source:
            error_details["config_source"] = config_source
        if config_keys:
            error_details["config_keys"] = config_keys
            
        super().__init__(message, operation_id, error_details)


class PatternLoadError(EnterpriseChunkerError):
    """
    Exception raised when regex pattern compilation fails.
    
    This exception occurs when a regular expression pattern cannot be
    compiled, typically due to syntax errors.
    
    Attributes:
        pattern_name: Name or identifier of the pattern
        pattern_source: The regular expression pattern that failed to compile
    """
    
    def __init__(
        self,
        message: str,
        operation_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        pattern_name: Optional[str] = None,
        pattern_source: Optional[str] = None
    ):
        """
        Initialize pattern load error with context information.
        
        Args:
            message: Human-readable error description
            operation_id: Optional identifier for the operation that failed
            details: Optional dictionary with additional error context
            pattern_name: Name or identifier of the pattern
            pattern_source: The regex pattern that failed to compile
        """
        self.pattern_name = pattern_name
        self.pattern_source = pattern_source
        
        # Add pattern info to details
        error_details = details or {}
        if pattern_name:
            error_details["pattern_name"] = pattern_name
        if pattern_source:
            error_details["pattern_source"] = pattern_source
            
        super().__init__(message, operation_id, error_details)


class PluginError(EnterpriseChunkerError):
    """
    Exception raised when there is an issue with a plugin.
    
    This exception occurs when loading, initializing, or using a plugin
    fails, allowing graceful fallback to built-in functionality.
    
    Attributes:
        plugin_name: Name of the plugin
        plugin_version: Version of the plugin
        entry_point: Entry point for the plugin
    """
    
    def __init__(
        self,
        message: str,
        operation_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        plugin_name: Optional[str] = None,
        plugin_version: Optional[str] = None,
        entry_point: Optional[str] = None
    ):
        """
        Initialize plugin error with context information.
        
        Args:
            message: Human-readable error description
            operation_id: Optional identifier for the operation that failed
            details: Optional dictionary with additional error context
            plugin_name: Name of the plugin
            plugin_version: Version of the plugin
            entry_point: Entry point for the plugin
        """
        self.plugin_name = plugin_name
        self.plugin_version = plugin_version
        self.entry_point = entry_point
        
        # Add plugin info to details
        error_details = details or {}
        if plugin_name:
            error_details["plugin_name"] = plugin_name
        if plugin_version:
            error_details["plugin_version"] = plugin_version
        if entry_point:
            error_details["entry_point"] = entry_point
            
        super().__init__(message, operation_id, error_details)


class StreamProcessingError(EnterpriseChunkerError):
    """
    Exception raised when streaming operations fail.
    
    This exception occurs during stream-based processing of large files
    or content, which is used to optimize memory usage.
    
    Attributes:
        stream_type: Type of stream being processed (file, string, etc.)
        bytes_processed: Number of bytes processed before the error
        buffer_size: Size of the stream buffer being used
        stream_position: Position in the stream when the error occurred
    """
    
    def __init__(
        self,
        message: str,
        operation_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        stream_type: Optional[str] = None,
        bytes_processed: Optional[int] = None,
        buffer_size: Optional[int] = None,
        stream_position: Optional[int] = None
    ):
        """
        Initialize stream processing error with context information.
        
        Args:
            message: Human-readable error description
            operation_id: Optional identifier for the operation that failed
            details: Optional dictionary with additional error context
            stream_type: Type of stream being processed
            bytes_processed: Number of bytes processed before the error
            buffer_size: Size of the stream buffer being used
            stream_position: Position in the stream when the error occurred
        """
        self.stream_type = stream_type
        self.bytes_processed = bytes_processed
        self.buffer_size = buffer_size
        self.stream_position = stream_position
        
        # Add stream info to details
        error_details = details or {}
        if stream_type:
            error_details["stream_type"] = stream_type
        if bytes_processed is not None:
            error_details["bytes_processed"] = bytes_processed
        if buffer_size is not None:
            error_details["buffer_size"] = buffer_size
        if stream_position is not None:
            error_details["stream_position"] = stream_position
            
        super().__init__(message, operation_id, error_details)


class FormatParsingError(ChunkingError):
    """
    Base exception for format-specific parsing errors.
    
    This exception occurs when parsing fails for a specific content format,
    serving as a parent class for more specific format parsing exceptions.
    
    Attributes:
        format_type: The content format being parsed
        parser_name: Name of the parser being used
        content_sample: Sample of the content that failed to parse
    """
    
    def __init__(
        self,
        message: str,
        operation_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        strategy: Optional[str] = None,
        text_length: Optional[int] = None,
        format_type: Optional[str] = None,
        parser_name: Optional[str] = None,
        content_sample: Optional[str] = None,
        sample_position: Optional[int] = None
    ):
        """
        Initialize format parsing error with context information.
        
        Args:
            message: Human-readable error description
            operation_id: Optional identifier for the operation that failed
            details: Optional dictionary with additional error context
            strategy: Optional name of the chunking strategy used
            text_length: Optional length of the text being processed
            format_type: The content format being parsed
            parser_name: Name of the parser being used
            content_sample: Sample of the content that failed to parse
            sample_position: Position of the sample in the original content
        """
        self.format_type = format_type
        self.parser_name = parser_name
        self.content_sample = content_sample
        self.sample_position = sample_position
        
        # Add parsing info to details
        error_details = details or {}
        if format_type:
            error_details["format_type"] = format_type
        if parser_name:
            error_details["parser_name"] = parser_name
        if content_sample:
            # Include only a reasonable sample size to avoid huge error messages
            max_sample_size = 100
            if len(content_sample) > max_sample_size:
                error_details["content_sample"] = f"{content_sample[:max_sample_size]}..."
            else:
                error_details["content_sample"] = content_sample
        if sample_position is not None:
            error_details["sample_position"] = sample_position
            
        super().__init__(message, operation_id, error_details, strategy, text_length)


class JsonParsingError(FormatParsingError):
    """
    Exception raised when JSON parsing fails.
    
    This exception occurs during parsing of JSON content in the
    JsonChunkingStrategy or other JSON-handling code.
    
    Attributes:
        json_path: JSON path to the element where parsing failed
        is_array: Whether the JSON content is an array
        is_object: Whether the JSON content is an object
    """
    
    def __init__(
        self,
        message: str,
        operation_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        strategy: Optional[str] = None,
        text_length: Optional[int] = None,
        content_sample: Optional[str] = None,
        json_path: Optional[str] = None,
        is_array: bool = False,
        is_object: bool = False,
        error_position: Optional[int] = None
    ):
        """
        Initialize JSON parsing error with context information.
        
        Args:
            message: Human-readable error description
            operation_id: Optional identifier for the operation that failed
            details: Optional dictionary with additional error context
            strategy: Optional name of the chunking strategy used
            text_length: Optional length of the text being processed
            content_sample: Sample of the content that failed to parse
            json_path: JSON path to the element where parsing failed
            is_array: Whether the JSON content is an array
            is_object: Whether the JSON content is an object
            error_position: Character position where the error occurred
        """
        self.json_path = json_path
        self.is_array = is_array
        self.is_object = is_object
        self.error_position = error_position
        
        # Add JSON-specific info to details
        error_details = details or {}
        if json_path:
            error_details["json_path"] = json_path
        error_details["is_array"] = is_array
        error_details["is_object"] = is_object
        if error_position is not None:
            error_details["error_position"] = error_position
            
        super().__init__(
            message, 
            operation_id, 
            error_details, 
            strategy, 
            text_length, 
            "JSON", 
            "json_parser", 
            content_sample
        )


class MarkdownParsingError(FormatParsingError):
    """
    Exception raised when Markdown parsing fails.
    
    This exception occurs during parsing of Markdown content in
    the MarkdownChunkingStrategy.
    
    Attributes:
        element_type: Type of Markdown element where parsing failed
        line_number: Line number where the error occurred
    """
    
    def __init__(
        self,
        message: str,
        operation_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        strategy: Optional[str] = None,
        text_length: Optional[int] = None,
        content_sample: Optional[str] = None,
        element_type: Optional[str] = None,
        line_number: Optional[int] = None
    ):
        """
        Initialize Markdown parsing error with context information.
        
        Args:
            message: Human-readable error description
            operation_id: Optional identifier for the operation that failed
            details: Optional dictionary with additional error context
            strategy: Optional name of the chunking strategy used
            text_length: Optional length of the text being processed
            content_sample: Sample of the content that failed to parse
            element_type: Type of Markdown element where parsing failed
            line_number: Line number where the error occurred
        """
        self.element_type = element_type
        self.line_number = line_number
        
        # Add Markdown-specific info to details
        error_details = details or {}
        if element_type:
            error_details["element_type"] = element_type
        if line_number is not None:
            error_details["line_number"] = line_number
            
        super().__init__(
            message, 
            operation_id, 
            error_details, 
            strategy, 
            text_length, 
            "Markdown", 
            "markdown_parser", 
            content_sample
        )


class XmlParsingError(FormatParsingError):
    """
    Exception raised when XML parsing fails.
    
    This exception occurs during parsing of XML content in
    the XmlChunkingStrategy.
    
    Attributes:
        element_path: XPath to the element where parsing failed
        line_number: Line number where the error occurred
        column_number: Column number where the error occurred
    """
    
    def __init__(
        self,
        message: str,
        operation_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        strategy: Optional[str] = None,
        text_length: Optional[int] = None,
        content_sample: Optional[str] = None,
        element_path: Optional[str] = None,
        line_number: Optional[int] = None,
        column_number: Optional[int] = None,
        is_malformed: bool = False
    ):
        """
        Initialize XML parsing error with context information.
        
        Args:
            message: Human-readable error description
            operation_id: Optional identifier for the operation that failed
            details: Optional dictionary with additional error context
            strategy: Optional name of the chunking strategy used
            text_length: Optional length of the text being processed
            content_sample: Sample of the content that failed to parse
            element_path: XPath to the element where parsing failed
            line_number: Line number where the error occurred
            column_number: Column number where the error occurred
            is_malformed: Whether the XML is structurally invalid
        """
        self.element_path = element_path
        self.line_number = line_number
        self.column_number = column_number
        self.is_malformed = is_malformed
        
        # Add XML-specific info to details
        error_details = details or {}
        if element_path:
            error_details["element_path"] = element_path
        if line_number is not None:
            error_details["line_number"] = line_number
        if column_number is not None:
            error_details["column_number"] = column_number
        error_details["is_malformed"] = is_malformed
            
        super().__init__(
            message, 
            operation_id, 
            error_details, 
            strategy, 
            text_length, 
            "XML", 
            "xml_parser", 
            content_sample
        )


class CodeParsingError(FormatParsingError):
    """
    Exception raised when code parsing fails.
    
    This exception occurs during parsing of code in code-specific
    chunking strategies like ReactVueChunkingStrategy.
    
    Attributes:
        language: Programming language of the code
        line_number: Line number where the error occurred
        feature_type: Type of code feature where parsing failed
    """
    
    def __init__(
        self,
        message: str,
        operation_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        strategy: Optional[str] = None,
        text_length: Optional[int] = None,
        content_sample: Optional[str] = None,
        language: Optional[str] = None,
        line_number: Optional[int] = None,
        feature_type: Optional[str] = None
    ):
        """
        Initialize code parsing error with context information.
        
        Args:
            message: Human-readable error description
            operation_id: Optional identifier for the operation that failed
            details: Optional dictionary with additional error context
            strategy: Optional name of the chunking strategy used
            text_length: Optional length of the text being processed
            content_sample: Sample of the content that failed to parse
            language: Programming language of the code
            line_number: Line number where the error occurred
            feature_type: Type of code feature where parsing failed
        """
        self.language = language
        self.line_number = line_number
        self.feature_type = feature_type
        
        # Add code-specific info to details
        error_details = details or {}
        if language:
            error_details["language"] = language
        if line_number is not None:
            error_details["line_number"] = line_number
        if feature_type:
            error_details["feature_type"] = feature_type
            
        super().__init__(
            message, 
            operation_id, 
            error_details, 
            strategy, 
            text_length, 
            "CODE", 
            "code_parser", 
            content_sample
        )


class RecoveryFailureError(ChunkingError):
    """
    Exception raised when recovery from a previous error fails.
    
    This exception occurs when a fallback strategy also fails after
    a primary chunking method encounters an error.
    
    Attributes:
        original_error: The original error that triggered recovery
        recovery_strategy: The strategy used for recovery
        recovery_attempts: Number of recovery attempts made
    """
    
    def __init__(
        self,
        message: str,
        operation_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        strategy: Optional[str] = None,
        text_length: Optional[int] = None,
        original_error: Optional[Exception] = None,
        recovery_strategy: Optional[str] = None,
        recovery_attempts: int = 0
    ):
        """
        Initialize recovery failure error with context information.
        
        Args:
            message: Human-readable error description
            operation_id: Optional identifier for the operation that failed
            details: Optional dictionary with additional error context
            strategy: Optional name of the chunking strategy used
            text_length: Optional length of the text being processed
            original_error: The original error that triggered recovery
            recovery_strategy: The strategy used for recovery
            recovery_attempts: Number of recovery attempts made
        """
        self.original_error = original_error
        self.recovery_strategy = recovery_strategy
        self.recovery_attempts = recovery_attempts
        
        # Add recovery info to details
        error_details = details or {}
        if original_error:
            error_details["original_error_type"] = type(original_error).__name__
            error_details["original_error_message"] = str(original_error)
        if recovery_strategy:
            error_details["recovery_strategy"] = recovery_strategy
        error_details["recovery_attempts"] = recovery_attempts
            
        super().__init__(message, operation_id, error_details, strategy, text_length)


class FileAccessError(EnterpriseChunkerError):
    """
    Exception raised when file access operations fail.
    
    This exception occurs when reading from or writing to files,
    which is commonly used for processing large documents.
    
    Attributes:
        file_path: Path to the file that couldn't be accessed
        operation: Type of file operation that failed
        is_temporary: Whether the file is a temporary file
    """
    
    def __init__(
        self,
        message: str,
        operation_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        file_path: Optional[str] = None,
        operation: Optional[str] = None,
        is_temporary: bool = False,
        os_error_code: Optional[int] = None
    ):
        """
        Initialize file access error with context information.
        
        Args:
            message: Human-readable error description
            operation_id: Optional identifier for the operation that failed
            details: Optional dictionary with additional error context
            file_path: Path to the file that couldn't be accessed
            operation: Type of file operation that failed (read, write, etc.)
            is_temporary: Whether the file is a temporary file
            os_error_code: Operating system error code, if available
        """
        self.file_path = file_path
        self.operation = operation
        self.is_temporary = is_temporary
        self.os_error_code = os_error_code
        
        # Add file info to details
        error_details = details or {}
        if file_path:
            error_details["file_path"] = file_path
        if operation:
            error_details["operation"] = operation
        error_details["is_temporary"] = is_temporary
        if os_error_code is not None:
            error_details["os_error_code"] = os_error_code
            
        super().__init__(message, operation_id, error_details)


class ResourceExhaustionError(EnterpriseChunkerError):
    """
    Exception raised when system resources are exhausted.
    
    This exception is a broader version of MemorySafetyError that covers
    other resource types like file handles, network connections, etc.
    
    Attributes:
        resource_type: Type of resource that was exhausted
        current_usage: Current usage of the resource
        maximum_allowed: Maximum allowed usage of the resource
    """
    
    def __init__(
        self,
        message: str,
        operation_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        resource_type: Optional[str] = None,
        current_usage: Optional[Union[int, float]] = None,
        maximum_allowed: Optional[Union[int, float]] = None,
        unit: Optional[str] = None
    ):
        """
        Initialize resource exhaustion error with context information.
        
        Args:
            message: Human-readable error description
            operation_id: Optional identifier for the operation that failed
            details: Optional dictionary with additional error context
            resource_type: Type of resource that was exhausted
            current_usage: Current usage of the resource
            maximum_allowed: Maximum allowed usage of the resource
            unit: Unit of measurement for the resource
        """
        self.resource_type = resource_type
        self.current_usage = current_usage
        self.maximum_allowed = maximum_allowed
        self.unit = unit
        
        # Add resource info to details
        error_details = details or {}
        if resource_type:
            error_details["resource_type"] = resource_type
        if current_usage is not None:
            error_details["current_usage"] = current_usage
        if maximum_allowed is not None:
            error_details["maximum_allowed"] = maximum_allowed
        if unit:
            error_details["unit"] = unit
            
        super().__init__(message, operation_id, error_details)


class ExternalLibraryError(EnterpriseChunkerError):
    """
    Exception raised when integration with an external library fails.
    
    This exception occurs when using optional dependencies like tiktoken,
    defusedxml, or other external libraries that might not be available.
    
    Attributes:
        library_name: Name of the external library
        library_version: Version of the external library if available
        feature: Feature that was using the external library
    """
    
    def __init__(
        self,
        message: str,
        operation_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        library_name: Optional[str] = None,
        library_version: Optional[str] = None,
        feature: Optional[str] = None,
        is_missing: bool = False
    ):
        """
        Initialize external library error with context information.
        
        Args:
            message: Human-readable error description
            operation_id: Optional identifier for the operation that failed
            details: Optional dictionary with additional error context
            library_name: Name of the external library
            library_version: Version of the external library if available
            feature: Feature that was using the external library
            is_missing: Whether the library is missing (not installed)
        """
        self.library_name = library_name
        self.library_version = library_version
        self.feature = feature
        self.is_missing = is_missing
        
        # Add library info to details
        error_details = details or {}
        if library_name:
            error_details["library_name"] = library_name
        if library_version:
            error_details["library_version"] = library_version
        if feature:
            error_details["feature"] = feature
        error_details["is_missing"] = is_missing
            
        super().__init__(message, operation_id, error_details)


class SecurityViolationError(EnterpriseChunkerError):
    """
    Exception raised when a security violation is detected.
    
    This exception occurs when processing potentially malicious content,
    such as XML external entity attacks or decompression bombs.
    
    Attributes:
        violation_type: Type of security violation detected
        content_format: Format of the content with the violation
        mitigation: Action taken to mitigate the security risk
    """
    
    def __init__(
        self,
        message: str,
        operation_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        violation_type: Optional[str] = None,
        content_format: Optional[str] = None,
        mitigation: Optional[str] = None,
        severity: Optional[str] = None
    ):
        """
        Initialize security violation error with context information.
        
        Args:
            message: Human-readable error description
            operation_id: Optional identifier for the operation that failed
            details: Optional dictionary with additional error context
            violation_type: Type of security violation detected
            content_format: Format of the content with the violation
            mitigation: Action taken to mitigate the security risk
            severity: Severity level of the security violation
        """
        self.violation_type = violation_type
        self.content_format = content_format
        self.mitigation = mitigation
        self.severity = severity
        
        # Add security info to details
        error_details = details or {}
        if violation_type:
            error_details["violation_type"] = violation_type
        if content_format:
            error_details["content_format"] = content_format
        if mitigation:
            error_details["mitigation"] = mitigation
        if severity:
            error_details["severity"] = severity
            
        super().__init__(message, operation_id, error_details)


class UnsupportedOperationError(EnterpriseChunkerError):
    """
    Exception raised when an unsupported operation is attempted.
    
    This exception occurs when a feature is used that is not supported
    in the current configuration or environment.
    
    Attributes:
        operation: Name of the operation that is not supported
        reason: Reason why the operation is not supported
        alternatives: List of alternative operations that are supported
    """
    
    def __init__(
        self,
        message: str,
        operation_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        operation: Optional[str] = None,
        reason: Optional[str] = None,
        alternatives: Optional[List[str]] = None
    ):
        """
        Initialize unsupported operation error with context information.
        
        Args:
            message: Human-readable error description
            operation_id: Optional identifier for the operation that failed
            details: Optional dictionary with additional error context
            operation: Name of the operation that is not supported
            reason: Reason why the operation is not supported
            alternatives: List of alternative operations that are supported
        """
        self.operation = operation
        self.reason = reason
        self.alternatives = alternatives
        
        # Add operation info to details
        error_details = details or {}
        if operation:
            error_details["operation"] = operation
        if reason:
            error_details["reason"] = reason
        if alternatives:
            error_details["alternatives"] = alternatives
            
        super().__init__(message, operation_id, error_details)


# Helper functions for consistent error creation and logging

def raise_chunking_error(
    message: str,
    operation_id: Optional[str] = None,
    strategy: Optional[str] = None,
    text_length: Optional[int] = None,
    details: Optional[Dict[str, Any]] = None,
    log_level: int = logging.ERROR,
    log_stacktrace: bool = True
) -> None:
    """
    Helper function to create, log, and raise a ChunkingError.
    
    Args:
        message: Human-readable error description
        operation_id: Optional identifier for the operation that failed
        strategy: Optional name of the chunking strategy used
        text_length: Optional length of the text being processed
        details: Optional dictionary with additional error context
        log_level: Logging level to use (default: ERROR)
        log_stacktrace: Whether to include stack trace in log (default: True)
        
    Raises:
        ChunkingError: Always raised with the provided information
    """
    # Create the error
    error = ChunkingError(
        message=message,
        operation_id=operation_id,
        strategy=strategy,
        text_length=text_length,
        details=details
    )
    
    # Log the error
    if operation_id:
        log_message = f"[{operation_id}] {message}"
    else:
        log_message = message
        
    if log_stacktrace:
        logger.log(log_level, log_message, exc_info=True)
    else:
        logger.log(log_level, log_message)
    
    # Raise the error
    raise error


def raise_boundary_detection_error(
    message: str,
    operation_id: Optional[str] = None,
    strategy: Optional[str] = None,
    text_length: Optional[int] = None,
    boundary_type: Optional[str] = None,
    detected_boundaries: Optional[int] = None,
    format_type: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    log_level: int = logging.ERROR,
    log_stacktrace: bool = True
) -> None:
    """
    Helper function to create, log, and raise a BoundaryDetectionError.
    
    Args:
        message: Human-readable error description
        operation_id: Optional identifier for the operation that failed
        strategy: Optional name of the chunking strategy used
        text_length: Optional length of the text being processed
        boundary_type: Optional type of boundary being detected
        detected_boundaries: Optional count of boundaries detected before failure
        format_type: Optional content format being processed
        details: Optional dictionary with additional error context
        log_level: Logging level to use (default: ERROR)
        log_stacktrace: Whether to include stack trace in log (default: True)
        
    Raises:
        BoundaryDetectionError: Always raised with the provided information
    """
    # Create the error
    error = BoundaryDetectionError(
        message=message,
        operation_id=operation_id,
        strategy=strategy,
        text_length=text_length,
        boundary_type=boundary_type,
        detected_boundaries=detected_boundaries,
        format_type=format_type,
        details=details
    )
    
    # Log the error
    if operation_id:
        log_message = f"[{operation_id}] {message}"
    else:
        log_message = message
        
    if log_stacktrace:
        logger.log(log_level, log_message, exc_info=True)
    else:
        logger.log(log_level, log_message)
    
    # Raise the error
    raise error


def raise_format_parsing_error(
    message: str,
    format_type: str,
    operation_id: Optional[str] = None,
    strategy: Optional[str] = None,
    text_length: Optional[int] = None,
    content_sample: Optional[str] = None,
    parser_name: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    log_level: int = logging.ERROR,
    log_stacktrace: bool = True
) -> None:
    """
    Helper function to create, log, and raise a FormatParsingError.
    
    Args:
        message: Human-readable error description
        format_type: Content format being parsed
        operation_id: Optional identifier for the operation that failed
        strategy: Optional name of the chunking strategy used
        text_length: Optional length of the text being processed
        content_sample: Sample of the content that failed to parse
        parser_name: Name of the parser being used
        details: Optional dictionary with additional error context
        log_level: Logging level to use (default: ERROR)
        log_stacktrace: Whether to include stack trace in log (default: True)
        
    Raises:
        FormatParsingError: Always raised with the provided information
    """
    # Create the error
    error = FormatParsingError(
        message=message,
        operation_id=operation_id,
        strategy=strategy,
        text_length=text_length,
        format_type=format_type,
        parser_name=parser_name,
        content_sample=content_sample,
        details=details
    )
    
    # Log the error
    if operation_id:
        log_message = f"[{operation_id}] {message}"
    else:
        log_message = message
        
    if log_stacktrace:
        logger.log(log_level, log_message, exc_info=True)
    else:
        logger.log(log_level, log_message)
    
    # Raise the error
    raise error


def raise_stream_processing_error(
    message: str,
    operation_id: Optional[str] = None,
    stream_type: Optional[str] = None,
    bytes_processed: Optional[int] = None,
    buffer_size: Optional[int] = None,
    stream_position: Optional[int] = None,
    details: Optional[Dict[str, Any]] = None,
    log_level: int = logging.ERROR,
    log_stacktrace: bool = True
) -> None:
    """
    Helper function to create, log, and raise a StreamProcessingError.
    
    Args:
        message: Human-readable error description
        operation_id: Optional identifier for the operation that failed
        stream_type: Type of stream being processed
        bytes_processed: Number of bytes processed before the error
        buffer_size: Size of the stream buffer being used
        stream_position: Position in the stream when the error occurred
        details: Optional dictionary with additional error context
        log_level: Logging level to use (default: ERROR)
        log_stacktrace: Whether to include stack trace in log (default: True)
        
    Raises:
        StreamProcessingError: Always raised with the provided information
    """
    # Create the error
    error = StreamProcessingError(
        message=message,
        operation_id=operation_id,
        stream_type=stream_type,
        bytes_processed=bytes_processed,
        buffer_size=buffer_size,
        stream_position=stream_position,
        details=details
    )
    
    # Log the error
    if operation_id:
        log_message = f"[{operation_id}] {message}"
    else:
        log_message = message
        
    if log_stacktrace:
        logger.log(log_level, log_message, exc_info=True)
    else:
        logger.log(log_level, log_message)
    
    # Raise the error
    raise error


def raise_file_access_error(
    message: str,
    operation_id: Optional[str] = None,
    file_path: Optional[str] = None,
    operation: Optional[str] = None,
    is_temporary: bool = False,
    os_error_code: Optional[int] = None,
    details: Optional[Dict[str, Any]] = None,
    log_level: int = logging.ERROR,
    log_stacktrace: bool = True
) -> None:
    """
    Helper function to create, log, and raise a FileAccessError.
    
    Args:
        message: Human-readable error description
        operation_id: Optional identifier for the operation that failed
        file_path: Path to the file that couldn't be accessed
        operation: Type of file operation that failed
        is_temporary: Whether the file is a temporary file
        os_error_code: Operating system error code
        details: Optional dictionary with additional error context
        log_level: Logging level to use (default: ERROR)
        log_stacktrace: Whether to include stack trace in log (default: True)
        
    Raises:
        FileAccessError: Always raised with the provided information
    """
    # Create the error
    error = FileAccessError(
        message=message,
        operation_id=operation_id,
        file_path=file_path,
        operation=operation,
        is_temporary=is_temporary,
        os_error_code=os_error_code,
        details=details
    )
    
    # Log the error
    if operation_id:
        log_message = f"[{operation_id}] {message}"
    else:
        log_message = message
        
    if log_stacktrace:
        logger.log(log_level, log_message, exc_info=True)
    else:
        logger.log(log_level, log_message)
    
    # Raise the error
    raise error


def raise_resource_exhaustion_error(
    message: str,
    operation_id: Optional[str] = None,
    resource_type: Optional[str] = None,
    current_usage: Optional[Union[int, float]] = None,
    maximum_allowed: Optional[Union[int, float]] = None,
    unit: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    log_level: int = logging.ERROR,
    log_stacktrace: bool = True
) -> None:
    """
    Helper function to create, log, and raise a ResourceExhaustionError.
    
    Args:
        message: Human-readable error description
        operation_id: Optional identifier for the operation that failed
        resource_type: Type of resource that was exhausted
        current_usage: Current usage of the resource
        maximum_allowed: Maximum allowed usage of the resource
        unit: Unit of measurement for the resource
        details: Optional dictionary with additional error context
        log_level: Logging level to use (default: ERROR)
        log_stacktrace: Whether to include stack trace in log (default: True)
        
    Raises:
        ResourceExhaustionError: Always raised with the provided information
    """
    # Create the error
    error = ResourceExhaustionError(
        message=message,
        operation_id=operation_id,
        resource_type=resource_type,
        current_usage=current_usage,
        maximum_allowed=maximum_allowed,
        unit=unit,
        details=details
    )
    
    # Log the error
    if operation_id:
        log_message = f"[{operation_id}] {message}"
    else:
        log_message = message
        
    if log_stacktrace:
        logger.log(log_level, log_message, exc_info=True)
    else:
        logger.log(log_level, log_message)
    
    # Raise the error
    raise error


def raise_security_violation_error(
    message: str,
    operation_id: Optional[str] = None,
    violation_type: Optional[str] = None,
    content_format: Optional[str] = None,
    mitigation: Optional[str] = None,
    severity: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    log_level: int = logging.ERROR,
    log_stacktrace: bool = True
) -> None:
    """
    Helper function to create, log, and raise a SecurityViolationError.
    
    Args:
        message: Human-readable error description
        operation_id: Optional identifier for the operation that failed
        violation_type: Type of security violation detected
        content_format: Format of the content with the violation
        mitigation: Action taken to mitigate the security risk
        severity: Severity level of the security violation
        details: Optional dictionary with additional error context
        log_level: Logging level to use (default: ERROR)
        log_stacktrace: Whether to include stack trace in log (default: True)
        
    Raises:
        SecurityViolationError: Always raised with the provided information
    """
    # Create the error
    error = SecurityViolationError(
        message=message,
        operation_id=operation_id,
        violation_type=violation_type,
        content_format=content_format,
        mitigation=mitigation,
        severity=severity,
        details=details
    )
    
    # Log the error
    if operation_id:
        log_message = f"[{operation_id}] {message}"
    else:
        log_message = message
        
    if log_stacktrace:
        logger.log(log_level, log_message, exc_info=True)
    else:
        logger.log(log_level, log_message)
    
    # Raise the error
    raise error