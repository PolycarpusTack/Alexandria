"""
Memory optimization utilities for efficient processing of large files
"""

import os
import gc
import sys
import logging
import tempfile
import mmap
import io
import platform
import re

# Only import resource on Unix-like systems
if platform.system() != 'Windows':
    import resource

from typing import Generator, List, Dict, Any, Optional, BinaryIO, Union, Iterator, TextIO, Callable
from contextlib import contextmanager

# Configure logging
logger = logging.getLogger(__name__)


class MemoryManager:
    """
    Memory management utilities for efficient processing of large content
    """
    
    def __init__(self, low_memory_mode: bool = False):
        """
        Initialize the memory manager
        
        Args:
            low_memory_mode: Whether to use aggressive memory optimization
        """
        self.low_memory_mode = low_memory_mode
        self._temp_files = []
    
    def get_memory_usage(self) -> float:
        """
        Get current memory usage in MB
        
        Returns:
            Memory usage in megabytes
        """
        try:
            # Use resource module if available (Unix systems)
            if platform.system() != 'Windows' and 'resource' in sys.modules:
                return resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024.0
            else:
                # Fallback for Windows and other systems
                try:
                    import psutil
                    process = psutil.Process(os.getpid())
                    return process.memory_info().rss / 1024.0 / 1024.0
                except ImportError:
                    # If psutil isn't available, use a basic estimation
                    return 0.0  # Return 0 as we can't measure it
        except (AttributeError, ValueError):
            # Final fallback
            return 0.0
    
    def estimate_memory_impact(self, text: str) -> float:
        """
        Estimate memory impact of a string in MB
        
        Args:
            text: String to estimate
            
        Returns:
            Estimated memory usage in megabytes
        """
        # String size in Python is more than just character count due to Unicode
        # and Python's string implementation overhead
        
        # Get basic size
        basic_size = sys.getsizeof(text)
        
        # Add estimated overhead for Python strings
        overhead = 48  # Typical Python string overhead
        
        # Calculate total estimated size in MB
        return (basic_size + overhead) / 1024.0 / 1024.0
    
    def reduce_memory_usage(self, force: bool = False):
        """
        Attempt to reduce memory usage through garbage collection
        
        Args:
            force: Whether to force aggressive garbage collection
        """
        # Run garbage collection
        collected = gc.collect()
        logger.debug(f"Garbage collected {collected} objects")
        
        if force or self.low_memory_mode:
            # More aggressive memory cleanup
            # Force collection of all generations
            gc.collect(0)
            gc.collect(1)
            gc.collect(2)
            
            # On some systems, explicitly requesting memory release can help
            if hasattr(os, 'malloc_trim') and callable(os.malloc_trim):
                try:
                    os.malloc_trim(0)  # Only available on some Linux systems
                except Exception as e:
                    logger.debug(f"malloc_trim failed: {e}")
    
    @contextmanager
    def memory_efficient_context(self, memory_limit_mb: Optional[float] = None):
        """
        Context manager for memory-efficient processing
        
        Args:
            memory_limit_mb: Optional memory limit in MB to enforce
            
        Yields:
            Context for memory-efficient processing
        """
        # Get initial memory usage
        initial_memory = self.get_memory_usage()
        logger.debug(f"Initial memory usage: {initial_memory:.2f} MB")
        
        if memory_limit_mb:
            # Set soft resource limit if possible (Unix only)
            if platform.system() != 'Windows' and 'resource' in sys.modules:
                try:
                    resource.setrlimit(resource.RLIMIT_AS, (
                        memory_limit_mb * 1024 * 1024,  # Soft limit
                        resource.RLIM_INFINITY  # Hard limit (no hard limit)
                    ))
                    logger.debug(f"Set memory limit to {memory_limit_mb} MB")
                except (AttributeError, ValueError):
                    logger.warning("Could not set memory limit")
            else:
                logger.debug(f"Memory limit of {memory_limit_mb} MB requested but not enforced (not supported on this platform)")
        
        try:
            # Yield control back to the caller
            yield self
        finally:
            # Clean up resources
            self.reduce_memory_usage()
            
            # Clean up any temporary files
            for temp_file in self._temp_files:
                try:
                    if os.path.exists(temp_file):
                        os.unlink(temp_file)
                except Exception as e:
                    logger.warning(f"Failed to delete temporary file {temp_file}: {e}")
            
            # Log memory usage
            final_memory = self.get_memory_usage()
            logger.debug(f"Final memory usage: {final_memory:.2f} MB")
            logger.debug(f"Memory change: {final_memory - initial_memory:.2f} MB")
    
    def to_disk_if_large(self, content: str, threshold_mb: float = 10.0) -> str:
        """
        Move large content to disk if it exceeds threshold
        
        Args:
            content: String content to potentially move to disk
            threshold_mb: Size threshold in MB
            
        Returns:
            Either the original string or a path to a temporary file (prefixed with 'file:')
        """
        # Estimate size
        estimated_size = self.estimate_memory_impact(content)
        
        # If under threshold, just return the string
        if estimated_size < threshold_mb:
            return content
            
        # Otherwise, write to temporary file
        with tempfile.NamedTemporaryFile(delete=False, mode='w', encoding='utf-8') as temp:
            temp.write(content)
            temp_path = temp.name
            self._temp_files.append(temp_path)
            
        logger.debug(f"Moved {estimated_size:.2f} MB of content to disk at {temp_path}")
        
        # Return the path prefixed with 'file:' to indicate it's a file path
        return f"file:{temp_path}"
    
    def get_content(self, content_or_path: str) -> str:
        """
        Get content from either a string or a file path
        
        Args:
            content_or_path: Either content string or a file path (prefixed with 'file:')
            
        Returns:
            The content string
        """
        # Check if it's a file path
        if isinstance(content_or_path, str) and content_or_path.startswith("file:"):
            # Extract path
            path = content_or_path[5:]
            
            # Read from file
            with open(path, 'r', encoding='utf-8') as f:
                return f.read()
        
        # Otherwise, it's the content itself
        return content_or_path
    
    def cleanup(self):
        """Clean up any temporary files"""
        for temp_file in self._temp_files:
            try:
                if os.path.exists(temp_file):
                    os.unlink(temp_file)
            except Exception as e:
                logger.warning(f"Failed to delete temporary file {temp_file}: {e}")
        
        # Clear the list
        self._temp_files = []
    
    def __del__(self):
        """Ensure cleanup on deletion"""
        self.cleanup()


class MemoryEfficientIterator:
    """
    Memory-efficient iterator for large content processing
    """
    
    def __init__(self, processor_func: Callable, buffer_size: int = 100000):
        """
        Initialize the memory-efficient iterator
        
        Args:
            processor_func: Function to process each chunk
            buffer_size: Buffer size for processing
        """
        self.processor_func = processor_func
        self.buffer_size = buffer_size
        self.memory_manager = MemoryManager()
    
    def iter_file(self, file_path: str) -> Generator[Any, None, None]:
        """
        Process a file efficiently
        
        Args:
            file_path: Path to file
            
        Yields:
            Processed results
        """
        # Process file in chunks to minimize memory usage
        with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
            chunk_buffer = io.StringIO()
            overflow = ""
            
            while True:
                # Read a chunk
                chunk = f.read(self.buffer_size)
                if not chunk and not overflow and chunk_buffer.tell() == 0:
                    break
                
                # Reset buffer if needed
                if chunk_buffer.tell() > 0:
                    chunk_buffer.seek(0)
                    chunk_buffer.truncate(0)
                
                # Add overflow from previous iteration and new chunk to buffer
                if overflow:
                    chunk_buffer.write(overflow)
                    overflow = ""
                
                if chunk:
                    chunk_buffer.write(chunk)
                
                # If we have enough data or this is the last chunk
                buffer_size = chunk_buffer.tell()
                if buffer_size >= self.buffer_size or not chunk:
                    # Get the buffer content
                    chunk_buffer.seek(0)
                    current_buffer = chunk_buffer.read()
                    
                    # If we're not at the end, find a safe split point
                    if chunk:
                        split_index = self._find_safe_split_point(current_buffer)
                        process_text = current_buffer[:split_index]
                        overflow = current_buffer[split_index:]
                    else:
                        # Process all remaining content
                        process_text = current_buffer
                    
                    # Process the chunk
                    results = self.processor_func(process_text)
                    
                    # Yield results
                    if isinstance(results, list):
                        for result in results:
                            yield result
                    else:
                        yield results
                    
                    # Reduce memory usage
                    self.memory_manager.reduce_memory_usage()
                    
                    # Reset buffer for next iteration
                    chunk_buffer.seek(0)
                    chunk_buffer.truncate(0)
    
    def iter_text(self, text: str) -> Generator[Any, None, None]:
        """
        Process text efficiently
        
        Args:
            text: Text to process
            
        Yields:
            Processed results
        """
        # For very large strings, write to a temporary file first
        if len(text) > self.buffer_size * 10:
            with self.memory_manager.memory_efficient_context():
                # Write to temporary file
                content_or_path = self.memory_manager.to_disk_if_large(text)
                
                if content_or_path.startswith("file:"):
                    # Process from file
                    for result in self.iter_file(content_or_path[5:]):
                        yield result
                    return
        
        # Process directly for smaller strings
        # Split into manageable chunks
        start = 0
        text_len = len(text)
        
        while start < text_len:
            # Determine chunk size
            end = min(start + self.buffer_size, text_len)
            
            # Adjust to a safe boundary if not at the end
            if end < text_len:
                # Find safe split point
                segment = text[start:min(end + 1000, text_len)]  # Add some overlap for finding a good boundary
                relative_split = self._find_safe_split_point(segment)
                end = start + relative_split
            
            # Process the chunk
            chunk = text[start:end]
            results = self.processor_func(chunk)
            
            # Yield results
            if isinstance(results, list):
                for result in results:
                    yield result
            else:
                yield results
            
            # Move to next position
            start = end
            
            # Reduce memory usage
            self.memory_manager.reduce_memory_usage()
    
    def _find_safe_split_point(self, text: str) -> int:
        """
        Find a safe point to split text
        
        Args:
            text: Text to split
            
        Returns:
            Index for safe splitting
        """
        text_len = len(text)
        if text_len == 0:
            return 0
            
        # Target point (80% of the way through the buffer)
        target_point = min(int(text_len * 0.8), text_len - 1)
        
        # Try to find a good boundary
        # Check for paragraph breaks first
        for i in range(target_point, max(0, target_point - 1000), -1):
            if i < text_len - 1 and text[i] == '\n' and text[i+1] == '\n':
                return i + 2  # Include both newlines
        
        # Try to find newlines
        for i in range(target_point, max(0, target_point - 500), -1):
            if text[i] == '\n':
                return i + 1  # Include the newline
        
        # Try to find sentence ends
        for i in range(target_point, max(0, target_point - 200), -1):
            if i < text_len - 2 and text[i] in '.!?' and text[i+1] == ' ' and text[i+2].isupper():
                return i + 1  # After punctuation
        
        # Try to find spaces
        for i in range(target_point, max(0, target_point - 100), -1):
            if text[i] == ' ':
                return i + 1  # Include the space
        
        # Fallback to target point
        return target_point


class MemoryMonitor:
    """
    Memory usage monitoring for detecting and preventing memory issues
    """
    
    def __init__(self, warning_threshold_mb: float = 1000.0, critical_threshold_mb: float = 2000.0):
        """
        Initialize the memory monitor
        
        Args:
            warning_threshold_mb: Memory threshold for warnings in MB
            critical_threshold_mb: Memory threshold for critical actions in MB
        """
        self.warning_threshold = warning_threshold_mb
        self.critical_threshold = critical_threshold_mb
        self.memory_manager = MemoryManager()
        self.peak_memory = 0.0
    
    def check_memory(self) -> Dict[str, Any]:
        """
        Check current memory usage and return status
        
        Returns:
            Dictionary with memory status information
        """
        current_memory = self.memory_manager.get_memory_usage()
        
        # Update peak memory
        self.peak_memory = max(self.peak_memory, current_memory)
        
        # Determine status
        if current_memory >= self.critical_threshold:
            status = "critical"
            self.memory_manager.reduce_memory_usage(force=True)
        elif current_memory >= self.warning_threshold:
            status = "warning"
            self.memory_manager.reduce_memory_usage()
        else:
            status = "normal"
        
        return {
            "current_mb": current_memory,
            "peak_mb": self.peak_memory,
            "status": status,
            "warning_threshold_mb": self.warning_threshold,
            "critical_threshold_mb": self.critical_threshold
        }
    
    @contextmanager
    def monitor_operation(self, operation_name: str, check_interval: int = 10):
        """
        Context manager for monitoring memory during an operation
        
        Args:
            operation_name: Name of the operation for logging
            check_interval: How often to check memory (in operations)
            
        Yields:
            Memory check function to call periodically
        """
        logger.debug(f"Starting memory monitoring for operation: {operation_name}")
        operation_count = [0]  # Use list for mutable reference
        
        def check_if_needed():
            """Check memory if needed based on interval"""
            operation_count[0] += 1
            if operation_count[0] % check_interval == 0:
                status = self.check_memory()
                if status["status"] != "normal":
                    logger.warning(
                        f"Memory {status['status']} in {operation_name}: "
                        f"{status['current_mb']:.2f}MB used "
                        f"(peak: {status['peak_mb']:.2f}MB)"
                    )
                return status
            return None
        
        try:
            # Start with initial check
            initial_status = self.check_memory()
            logger.debug(
                f"Initial memory for {operation_name}: "
                f"{initial_status['current_mb']:.2f}MB"
            )
            
            # Yield the check function
            yield check_if_needed
            
        finally:
            # Final check
            final_status = self.check_memory()
            logger.debug(
                f"Final memory for {operation_name}: "
                f"{final_status['current_mb']:.2f}MB "
                f"(peak: {final_status['peak_mb']:.2f}MB)"
            )
            
            # Cleanup
            self.memory_manager.reduce_memory_usage()