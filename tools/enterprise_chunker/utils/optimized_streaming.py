"""
Optimized streaming utilities for processing large files
"""

import io
import os
import mmap
import logging
import tempfile
from typing import Generator, List, Dict, Any, Optional, BinaryIO, Union, Iterator, TextIO, TypeVar, Generic, overload
from contextlib import contextmanager

from enterprise_chunker.models.enums import ChunkingStrategy
from enterprise_chunker.config import ChunkingOptions

# Configure logging
logger = logging.getLogger(__name__)

# Type variable for generic typing
T = TypeVar('T', str, bytes)


class StreamingBuffer(Generic[T]):
    """
    Memory-efficient buffer for large text processing
    
    Optimized for handling very large files with minimal memory impact.
    Uses memory mapping and chunked processing to avoid loading entire
    files into memory.
    """
    
    def __init__(self, buffer_size: int = 100000, overlap_size: int = 5000):
        """
        Initialize the streaming buffer
        
        Args:
            buffer_size: Size of each processing buffer
            overlap_size: Size of overlap between buffers
        """
        self.buffer_size = buffer_size
        self.overlap_size = overlap_size
        self._temp_files = []
        # Maximum characters to search back when finding split points
        self._max_backscan = 2000
    
    @overload
    def stream_file(self, file_path: str, raw_bytes: bool = False) -> Generator[str, None, None]: ...
    
    @overload
    def stream_file(self, file_path: str, raw_bytes: bool = True) -> Generator[bytes, None, None]: ...
    
    def stream_file(self, file_path: str, raw_bytes: bool = False) -> Generator[Union[str, bytes], None, None]:
        """
        Stream a file in chunks with efficient memory usage
        
        Args:
            file_path: Path to file to stream
            raw_bytes: If True, yield raw bytes instead of decoding to UTF-8
            
        Yields:
            Text chunks from the file (str or bytes depending on raw_bytes)
        """
        # Check if file exists
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
            
        # Get file size
        file_size = os.path.getsize(file_path)
        
        # For small files, read directly
        if file_size < self.buffer_size * 2:
            if raw_bytes:
                with open(file_path, 'rb') as f:
                    yield f.read()
            else:
                with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                    yield f.read()
            return
        
        # For large files, use memory mapping
        with open(file_path, 'rb') as f:
            try:
                # Try memory mapping for efficient random access
                with mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ) as mm:
                    position = 0
                    while position < mm.size():
                        # Determine chunk size
                        chunk_size = min(self.buffer_size, mm.size() - position)
                        
                        # Read chunk
                        mm.seek(position)
                        chunk = mm.read(chunk_size)
                        
                        if raw_bytes:
                            # Find a safe boundary in bytes (e.g., newlines)
                            safe_pos = self._find_safe_split_point_bytes(chunk)
                            # Yield the raw bytes chunk
                            yield chunk[:safe_pos]
                        else:
                            # Convert to string, handling encoding errors
                            text_chunk = chunk.decode('utf-8', errors='replace')
                            
                            # Find a safe boundary to split on
                            safe_pos = self._find_safe_split_point(text_chunk)
                            
                            # Yield the chunk up to the safe point
                            yield text_chunk[:safe_pos]
                            
                            # Convert safe_pos back to bytes for position tracking
                            safe_pos_bytes = len(text_chunk[:safe_pos].encode('utf-8'))
                            position = position + safe_pos_bytes
                            
                            # Handle overlap - backtrack if needed
                            if position < mm.size() and safe_pos_bytes > self.overlap_size:
                                position -= self.overlap_size
                            
                            continue
                        
                        # Only reached for raw_bytes mode
                        # Move to next position, with overlap
                        position = position + safe_pos
                        
                        # Handle overlap - backtrack if needed
                        if position < mm.size() and safe_pos > self.overlap_size:
                            position -= self.overlap_size
            except (ValueError, OSError):
                # Fallback if memory mapping fails
                logger.warning("Memory mapping failed, falling back to chunked reading")
                # Reset file pointer
                f.seek(0)
                
                # Process in chunks
                if raw_bytes:
                    buffer = bytearray()
                    while True:
                        chunk = f.read(self.buffer_size)
                        if not chunk:
                            break
                            
                        # Add to buffer
                        buffer.extend(chunk)
                        
                        # Find a safe place to split
                        if len(buffer) > self.buffer_size:
                            safe_pos = self._find_safe_split_point_bytes(buffer)
                            
                            # Yield the chunk
                            yield bytes(buffer[:safe_pos])
                            
                            # Keep the remainder with overlap
                            if safe_pos > self.overlap_size:
                                buffer = buffer[safe_pos - self.overlap_size:]
                            else:
                                buffer = buffer[safe_pos:]
                    
                    # Yield remaining buffer
                    if buffer:
                        yield bytes(buffer)
                else:
                    # Text mode processing
                    buffer = ""
                    while True:
                        chunk = f.read(self.buffer_size)
                        if not chunk:
                            break
                            
                        # Convert to string
                        text_chunk = chunk.decode('utf-8', errors='replace')
                        
                        # Add to buffer
                        buffer += text_chunk
                        
                        # Find a safe place to split
                        if len(buffer) > self.buffer_size:
                            safe_pos = self._find_safe_split_point(buffer)
                            
                            # Yield the chunk
                            yield buffer[:safe_pos]
                            
                            # Keep the remainder with overlap
                            if safe_pos > self.overlap_size:
                                buffer = buffer[safe_pos - self.overlap_size:]
                            else:
                                buffer = buffer[safe_pos:]
                    
                    # Yield remaining buffer
                    if buffer:
                        yield buffer
    
    @overload
    def stream_string(self, text: str) -> Generator[str, None, None]: ...
    
    @overload
    def stream_string(self, text: bytes, raw_bytes: bool = True) -> Generator[bytes, None, None]: ...
    
    def stream_string(self, text: Union[str, bytes], raw_bytes: bool = False) -> Generator[Union[str, bytes], None, None]:
        """
        Stream a large string in chunks with efficient memory usage
        
        For very large strings, this writes to a temporary file first
        to avoid memory issues.
        
        Args:
            text: Large string or bytes to process
            raw_bytes: If True, treat input as bytes and yield bytes
            
        Yields:
            Text or bytes chunks
        """
        # Handle type checking for input
        if raw_bytes and isinstance(text, str):
            text = text.encode('utf-8')
        elif not raw_bytes and isinstance(text, bytes):
            text = text.decode('utf-8', errors='replace')
        
        # For small strings, just yield directly
        if len(text) < self.buffer_size * 2:
            yield text
            return
            
        # For large strings, use a temporary file
        with self._create_temp_file() as temp_file:
            # Write data to file
            if isinstance(text, str):
                temp_file.write(text.encode('utf-8'))
            else:
                temp_file.write(text)
            temp_file.flush()
            
            # Stream from the file
            for chunk in self.stream_file(temp_file.name, raw_bytes=raw_bytes):
                yield chunk
    
    @overload
    def stream_handle(self, file_handle: TextIO) -> Generator[str, None, None]: ...
    
    @overload
    def stream_handle(self, file_handle: BinaryIO, raw_bytes: bool = True) -> Generator[bytes, None, None]: ...
    
    def stream_handle(self, file_handle: Union[TextIO, BinaryIO], raw_bytes: bool = False) -> Generator[Union[str, bytes], None, None]:
        """
        Stream content from an open file handle
        
        Args:
            file_handle: Open file handle to read from
            raw_bytes: If True, handle is treated as binary and yields bytes
            
        Yields:
            Text or bytes chunks
        """
        # Check if we're dealing with a binary file in raw_bytes mode
        is_binary_handle = hasattr(file_handle, 'mode') and 'b' in file_handle.mode
        
        if raw_bytes and not is_binary_handle:
            logger.warning("Using raw_bytes=True with a text file handle may lead to unexpected results")
        elif not raw_bytes and is_binary_handle:
            logger.warning("Using raw_bytes=False with a binary file handle may lead to unexpected results")
            
        if raw_bytes:
            # Binary processing
            buffer = bytearray()
            
            while True:
                chunk = file_handle.read(self.buffer_size)
                if not chunk:
                    break
                    
                # Add to buffer
                if isinstance(chunk, str):
                    buffer.extend(chunk.encode('utf-8'))
                else:
                    buffer.extend(chunk)
                
                # Process when buffer is large enough
                if len(buffer) > self.buffer_size:
                    safe_pos = self._find_safe_split_point_bytes(buffer)
                    
                    # Yield the chunk
                    yield bytes(buffer[:safe_pos])
                    
                    # Keep the remainder with overlap
                    if safe_pos > self.overlap_size:
                        buffer = buffer[safe_pos - self.overlap_size:]
                    else:
                        buffer = buffer[safe_pos:]
            
            # Yield remaining buffer
            if buffer:
                yield bytes(buffer)
        else:
            # Text processing
            buffer = ""
            
            while True:
                chunk = file_handle.read(self.buffer_size)
                if not chunk:
                    break
                    
                # Convert to string if needed
                if isinstance(chunk, bytes):
                    chunk = chunk.decode('utf-8', errors='replace')
                    
                # Add to buffer
                buffer += chunk
                
                # Process when buffer is large enough
                if len(buffer) > self.buffer_size:
                    safe_pos = self._find_safe_split_point(buffer)
                    
                    # Yield the chunk
                    yield buffer[:safe_pos]
                    
                    # Keep the remainder with overlap
                    if safe_pos > self.overlap_size:
                        buffer = buffer[safe_pos - self.overlap_size:]
                    else:
                        buffer = buffer[safe_pos:]
            
            # Yield remaining buffer
            if buffer:
                yield buffer
    
    def _find_safe_split_point(self, text: str) -> int:
        """
        Find a safe point to split text that preserves semantic boundaries
        
        Args:
            text: Text to analyze
            
        Returns:
            Position where it's safe to split
        """
        # Ensure we have text to process
        if not text:
            return 0
            
        # Target point for splitting (80% of buffer)
        text_len = len(text)
        target_point = min(int(text_len * 0.8), text_len - 1)
        
        # Calculate maximum backscan distances with caps
        para_scan = min(int(target_point * 0.2), self._max_backscan)
        line_scan = min(int(target_point * 0.1), self._max_backscan // 2)
        sent_scan = min(int(target_point * 0.05), self._max_backscan // 4)
        word_scan = min(100, self._max_backscan // 20)
        
        # Try to find paragraph breaks first (highest priority)
        for i in range(target_point, max(0, target_point - para_scan), -1):
            if i < text_len - 1 and text[i] == '\n' and text[i+1] == '\n':
                return i + 2  # Include both newlines
                
        # Try to find single line breaks
        for i in range(target_point, max(0, target_point - line_scan), -1):
            if text[i] == '\n':
                return i + 1  # Include the newline
                
        # Try to find sentence boundaries
        for i in range(target_point, max(0, target_point - sent_scan), -1):
            if i < text_len - 2 and text[i] in '.!?' and text[i+1] == ' ' and text[i+2].isupper():
                return i + 1  # Split after the punctuation
                
        # Last resort: split at a word boundary
        for i in range(target_point, max(0, target_point - word_scan), -1):
            if text[i] == ' ':
                return i + 1  # Include the space
                
        # Absolute fallback: just use the target point
        return target_point
    
    def _find_safe_split_point_bytes(self, data: Union[bytes, bytearray]) -> int:
        """
        Find a safe point to split binary data
        
        Args:
            data: Binary data to analyze
            
        Returns:
            Position where it's safe to split
        """
        # Ensure we have data to process
        if not data:
            return 0
            
        # Target point for splitting (80% of buffer)
        data_len = len(data)
        target_point = min(int(data_len * 0.8), data_len - 1)
        
        # Calculate maximum backscan distances with caps
        para_scan = min(int(target_point * 0.2), self._max_backscan)
        line_scan = min(int(target_point * 0.1), self._max_backscan // 2)
        word_scan = min(100, self._max_backscan // 20)
        
        # Common delimiters in bytes
        NEWLINE = 10  # \n in ASCII/UTF-8
        CARRIAGE_RETURN = 13  # \r in ASCII/UTF-8
        SPACE = 32  # space in ASCII/UTF-8
        
        # Look for double newlines (paragraph breaks)
        for i in range(target_point, max(0, target_point - para_scan), -1):
            if i < data_len - 1 and data[i] == NEWLINE and data[i+1] == NEWLINE:
                return i + 2
        
        # Look for single newlines
        for i in range(target_point, max(0, target_point - line_scan), -1):
            if data[i] == NEWLINE:
                return i + 1
            
            # Also check for Windows-style line endings (\r\n)
            if i < data_len - 1 and data[i] == CARRIAGE_RETURN and data[i+1] == NEWLINE:
                return i + 2
        
        # Last resort: look for spaces
        for i in range(target_point, max(0, target_point - word_scan), -1):
            if data[i] == SPACE:
                return i + 1
        
        # Fallback to target point
        return target_point
    
    @contextmanager
    def _create_temp_file(self) -> Generator[BinaryIO, None, None]:
        """
        Create a temporary file and ensure it's cleaned up
        
        Yields:
            Binary file handle
        """
        temp_file = tempfile.NamedTemporaryFile(delete=False)
        self._temp_files.append(temp_file.name)
        
        try:
            yield temp_file
        finally:
            temp_file.close()
    
    def __del__(self):
        """Clean up any temporary files on deletion"""
        for temp_file in self._temp_files:
            try:
                if os.path.exists(temp_file):
                    os.unlink(temp_file)
            except Exception as e:
                logger.warning(f"Failed to delete temporary file {temp_file}: {e}")


class ChunkProcessor:
    """
    Optimized processor for chunking large content
    """
    
    def __init__(self, options: ChunkingOptions):
        """
        Initialize the chunk processor
        
        Args:
            options: Chunking options
        """
        self.options = options
        self.buffer = StreamingBuffer(
            buffer_size=options.stream_buffer_size,
            overlap_size=self._get_overlap_size(options)
        )
    
    def process_large_file(
        self, 
        file_path: str, 
        chunker_func: callable,
        raw_bytes: bool = False
    ) -> Generator[Union[str, bytes], None, None]:
        """
        Process a large file with optimized memory usage
        
        Args:
            file_path: Path to file
            chunker_func: Function that chunks text or bytes
            raw_bytes: If True, process and yield raw bytes
            
        Yields:
            Processed text or bytes chunks
        """
        for buffer_chunk in self.buffer.stream_file(file_path, raw_bytes=raw_bytes):
            # Process this buffer chunk
            for result_chunk in chunker_func(buffer_chunk):
                yield result_chunk
    
    def process_large_text(
        self, 
        text: Union[str, bytes], 
        chunker_func: callable,
        raw_bytes: bool = False
    ) -> Generator[Union[str, bytes], None, None]:
        """
        Process large text with optimized memory usage
        
        Args:
            text: Large text or bytes to process
            chunker_func: Function that chunks text or bytes
            raw_bytes: If True, process and yield raw bytes
            
        Yields:
            Processed text or bytes chunks
        """
        for buffer_chunk in self.buffer.stream_string(text, raw_bytes=raw_bytes):
            # Process this buffer chunk
            for result_chunk in chunker_func(buffer_chunk):
                yield result_chunk
    
    def process_stream(
        self, 
        stream: Union[TextIO, BinaryIO], 
        chunker_func: callable,
        raw_bytes: bool = False
    ) -> Generator[Union[str, bytes], None, None]:
        """
        Process a text or binary stream
        
        Args:
            stream: Text or binary stream to process
            chunker_func: Function that chunks text or bytes
            raw_bytes: If True, process and yield raw bytes
            
        Yields:
            Processed text or bytes chunks
        """
        for buffer_chunk in self.buffer.stream_handle(stream, raw_bytes=raw_bytes):
            # Process this buffer chunk
            for result_chunk in chunker_func(buffer_chunk):
                yield result_chunk
    
    def _get_overlap_size(self, options: ChunkingOptions) -> int:
        """
        Calculate appropriate overlap size in characters
        
        Args:
            options: Chunking options
            
        Returns:
            Overlap size in characters
        """
        # Conservative character-to-token ratio (varies by language and content)
        chars_per_token = 4.0
        return int(options.overlap_tokens * chars_per_token * 1.2)  # Add 20% margin