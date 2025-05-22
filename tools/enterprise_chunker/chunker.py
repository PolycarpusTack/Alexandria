"""
EnterpriseChunker - Main chunker class implementation
"""

import io
import re
import time
import logging
import hashlib
import math
from typing import List, Dict, Any, Optional, Union, Generator, Tuple, cast

from enterprise_chunker.models.enums import ChunkingStrategy, TokenEstimationStrategy, ContentFormat
from enterprise_chunker.models.chunk_metadata import ChunkingResult
from enterprise_chunker.config import ChunkingOptions, ConfigManager
from enterprise_chunker.utils.token_estimation import estimate_tokens
from enterprise_chunker.utils.format_detection import detect_content_format
from enterprise_chunker.strategies.base import BaseChunkingStrategy

# Configure logging
logger = logging.getLogger(__name__)

# Maximum back-scan window size (in bytes) for finding safe split points
MAX_BACKSCAN_WINDOW = 8 * 1024  # 8 KB


class ChunkingStrategyFactory:
    """Factory for creating chunking strategy instances"""
    
    @staticmethod
    def create_strategy(
        strategy_type: ChunkingStrategy, 
        format_type: ContentFormat,
        operation_id: Optional[str] = None
    ) -> BaseChunkingStrategy:
        """
        Create a chunking strategy based on strategy type and content format
        
        Args:
            strategy_type: Type of chunking strategy
            format_type: Type of content format
            operation_id: Optional operation ID to set on the strategy
            
        Returns:
            Appropriate chunking strategy instance
        """
        strategy: BaseChunkingStrategy
        
        # Format-specific strategies take precedence in STRUCTURAL mode
        if strategy_type == ChunkingStrategy.STRUCTURAL:
            if format_type == ContentFormat.JSON:
                from enterprise_chunker.strategies.formats.json_chunker import JsonChunkingStrategy
                strategy = JsonChunkingStrategy()
            elif format_type == ContentFormat.XML:
                from enterprise_chunker.strategies.formats.xml_chunker import XmlChunkingStrategy
                strategy = XmlChunkingStrategy()
            elif format_type == ContentFormat.MARKDOWN:
                from enterprise_chunker.strategies.formats.markdown_chunker import MarkdownChunkingStrategy
                strategy = MarkdownChunkingStrategy()
            elif format_type == ContentFormat.CODE:
                from enterprise_chunker.strategies.formats.code_chunker import CodeChunkingStrategy
                strategy = CodeChunkingStrategy()
            elif format_type == ContentFormat.LOGS:
                from enterprise_chunker.strategies.formats.logs_chunker import LogsChunkingStrategy
                strategy = LogsChunkingStrategy()
            elif format_type == ContentFormat.CSV:
                from enterprise_chunker.strategies.formats.csv_chunker import CsvChunkingStrategy
                strategy = CsvChunkingStrategy()
            else:
                # Default to semantic if no format-specific strategy exists
                from enterprise_chunker.strategies.semantic import SemanticChunkingStrategy
                strategy = SemanticChunkingStrategy()
        
        # Generic strategies based on strategy_type
        elif strategy_type == ChunkingStrategy.SEMANTIC:
            from enterprise_chunker.strategies.semantic import SemanticChunkingStrategy
            strategy = SemanticChunkingStrategy()
        elif strategy_type == ChunkingStrategy.SENTENCE:
            from enterprise_chunker.strategies.sentence import SentenceChunkingStrategy
            strategy = SentenceChunkingStrategy()
        elif strategy_type == ChunkingStrategy.FIXED_SIZE:
            from enterprise_chunker.strategies.fixed_size import FixedSizeChunkingStrategy
            strategy = FixedSizeChunkingStrategy()
        else:
            # Default to semantic chunking
            from enterprise_chunker.strategies.semantic import SemanticChunkingStrategy
            strategy = SemanticChunkingStrategy()
        
        # Set operation ID if provided
        if operation_id:
            strategy.set_operation_id(operation_id)
            
        return strategy


class EnterpriseChunker:
    """Enterprise-grade text chunking utility for LLM processing"""
    
    def __init__(self, options: Optional[Dict[str, Any]] = None):
        """
        Initialize the chunker with configuration options
        
        Args:
            options: Optional configuration dictionary
        """
        self.options = ConfigManager.create_options(options)
    
    def adaptive_chunk_text(
        self, 
        text: str, 
        max_tokens_per_chunk: Optional[int] = None,
        overlap_tokens: Optional[int] = None,
        strategy: Optional[Union[str, ChunkingStrategy]] = None
    ) -> List[str]:
        """
        Main entry point: Adaptively chunk text based on content format
        
        Args:
            text: Text content to chunk
            max_tokens_per_chunk: Maximum tokens per chunk (overrides class settings)
            overlap_tokens: Number of tokens to overlap between chunks
            strategy: Chunking strategy to use
            
        Returns:
            List of text chunks optimized for processing
        """
        if not text:
            return []
            
        # Create operation-specific options
        op_options = ChunkingOptions(**vars(self.options))
        if max_tokens_per_chunk:
            op_options.max_tokens_per_chunk = max_tokens_per_chunk
        if overlap_tokens:
            op_options.overlap_tokens = overlap_tokens
        
        # Force-coerce string strategy to ChunkingStrategy enum after options merging
        if strategy:
            if isinstance(strategy, str):
                try:
                    op_options.chunking_strategy = ChunkingStrategy(strategy)
                except ValueError:
                    logger.warning(f"Invalid chunking strategy: {strategy}. Using default.")
            else:
                op_options.chunking_strategy = strategy
                
        # Generate a unique operation ID
        operation_id = self._generate_operation_id(text, op_options)
        
        try:
            # Detect content format if enabled
            detected_format = detect_content_format(text) if op_options.enable_format_detection else ContentFormat.TEXT
            
            # Choose chunking method based on format and strategy
            if op_options.chunking_strategy == ChunkingStrategy.ADAPTIVE:
                # In adaptive mode, select best strategy based on content format
                if detected_format in (
                    ContentFormat.JSON, 
                    ContentFormat.XML, 
                    ContentFormat.MARKDOWN, 
                    ContentFormat.CODE, 
                    ContentFormat.LOGS, 
                    ContentFormat.CSV
                ):
                    strategy_type = ChunkingStrategy.STRUCTURAL
                else:
                    strategy_type = ChunkingStrategy.SEMANTIC
            else:
                # Use the explicitly specified strategy
                strategy_type = op_options.chunking_strategy
            
            # Create the appropriate strategy with operation_id
            chunking_strategy = ChunkingStrategyFactory.create_strategy(
                strategy_type, 
                detected_format,
                operation_id
            )
            
            # Execute the chunking
            chunk_result = chunking_strategy.chunk(text, op_options)
            
            return chunk_result.chunks
            
        except Exception as e:
            logger.error(f"Error in adaptive_chunk_text: {str(e)}", exc_info=True)
            # Fall back to simple chunking - create strategy with operation_id in constructor
            from enterprise_chunker.strategies.fixed_size import FixedSizeChunkingStrategy
            fallback_strategy = FixedSizeChunkingStrategy()
            fallback_strategy.set_operation_id(operation_id)
            result = fallback_strategy.chunk(text, op_options)
            return result.chunks
    
    def chunk_stream(
        self, 
        stream: Union[str, io.TextIOBase], 
        **kwargs
    ) -> Generator[str, None, None]:
        """
        Process a text stream by dynamically chunking it as it's read
        
        Args:
            stream: Text stream to process
            **kwargs: Additional options for chunking
            
        Yields:
            Text chunks sequentially
        """
        op_options = ChunkingOptions(**{**vars(self.options), **kwargs})
        
        # Force-coerce string strategy to ChunkingStrategy enum after options merging
        strategy = kwargs.get('strategy')
        if strategy and isinstance(strategy, str):
            try:
                op_options.chunking_strategy = ChunkingStrategy(strategy)
            except ValueError:
                logger.warning(f"Invalid chunking strategy in stream: {strategy}. Using default.")
        
        # For string input, delegate to normal chunking
        if isinstance(stream, str):
            for chunk in self.adaptive_chunk_text(stream, **kwargs):
                yield chunk
            return
        
        buffer = ""
        previous_chunk = ""
        
        try:
            for line in stream:
                buffer += line
                
                # Process buffer when it gets large enough
                if len(buffer) >= op_options.stream_buffer_size:
                    # Find a safe place to split
                    split_index = self._find_safe_split_point(buffer, op_options)
                    chunk_text = buffer[:split_index]
                    
                    # Process with overlap from previous chunk
                    if previous_chunk:
                        chunk_text = self._add_overlap(previous_chunk, chunk_text, op_options.overlap_tokens)
                    
                    # Chunk the current buffer segment
                    chunks = self.adaptive_chunk_text(chunk_text, **kwargs)
                    
                    # Yield all but the last chunk (keep last for overlap context)
                    for i in range(len(chunks) - 1):
                        yield chunks[i]
                    
                    if chunks:
                        previous_chunk = chunks[-1]
                    
                    # Update buffer
                    buffer = buffer[split_index:]
            
            # Process any remaining content
            if buffer:
                if previous_chunk:
                    buffer = self._add_overlap(previous_chunk, buffer, op_options.overlap_tokens)
                
                chunks = self.adaptive_chunk_text(buffer, **kwargs)
                for chunk in chunks:
                    yield chunk
                    
        except Exception as e:
            logger.error(f"Error in chunk_stream: {str(e)}", exc_info=True)
            # Yield any remaining buffer if possible
            if buffer:
                yield buffer
    
    def with_max_tokens(self, max_tokens: int) -> 'EnterpriseChunker':
        """
        Fluent API for setting max tokens per chunk
        
        Args:
            max_tokens: Maximum tokens per chunk
            
        Returns:
            Self for chaining
        """
        self.options.max_tokens_per_chunk = max_tokens
        return self
    
    def with_overlap(self, overlap_tokens: int) -> 'EnterpriseChunker':
        """
        Fluent API for setting overlap tokens
        
        Args:
            overlap_tokens: Number of tokens to overlap
            
        Returns:
            Self for chaining
        """
        self.options.overlap_tokens = overlap_tokens
        return self
    
    def with_strategy(self, strategy: Union[str, ChunkingStrategy]) -> 'EnterpriseChunker':
        """
        Fluent API for setting chunking strategy
        
        Args:
            strategy: Chunking strategy to use
            
        Returns:
            Self for chaining
        """
        # Force-coerce string strategy to ChunkingStrategy enum
        if isinstance(strategy, str):
            try:
                self.options.chunking_strategy = ChunkingStrategy(strategy)
            except ValueError:
                logger.warning(f"Invalid chunking strategy: {strategy}. Ignoring.")
        else:
            self.options.chunking_strategy = strategy
        return self
    
    def chunk(self, text: str) -> List[str]:
        """
        Chunk text with current configuration
        
        Args:
            text: Text to chunk
            
        Returns:
            List of text chunks
        """
        return self.adaptive_chunk_text(text)
    
    def _generate_operation_id(self, text: str, options: ChunkingOptions) -> str:
        """
        Generate a unique ID for the chunking operation
        
        Args:
            text: Input text
            options: Chunking options
            
        Returns:
            Unique operation ID
        """
        # Create a digest from content sample and options
        content_sample = text[:100] + text[-100:] if len(text) > 200 else text
        options_str = f"{options.max_tokens_per_chunk}:{options.overlap_tokens}:{options.chunking_strategy.value}"
        
        hash_input = f"{content_sample}:{options_str}:{time.time()}"
        return hashlib.md5(hash_input.encode()).hexdigest()
    
    def _find_safe_split_point(self, buffer: str, options: ChunkingOptions) -> int:
        """
        Find a safe point to split a buffer for streaming
        
        Args:
            buffer: Text buffer
            options: Chunking options
            
        Returns:
            Index where it's safe to split
        """
        # Target 80% of buffer
        target_point = math.floor(len(buffer) * 0.8)
        
        # Limit back-scan window to 8 KB to avoid O(n²) regex on large buffers
        backscan_start = max(0, target_point - MAX_BACKSCAN_WINDOW)
        scan_window = buffer[backscan_start:target_point + MAX_BACKSCAN_WINDOW]
        
        # Compute offset for positions found in the scan window
        offset = backscan_start
        
        # Try to find a natural boundary near the target point
        # Look for paragraph breaks first
        paragraph_breaks = [offset + m.start() for m in re.finditer(r'\n\s*\n', scan_window)]
        for pos in paragraph_breaks:
            if pos >= target_point:
                return pos + 2  # Include the line break
        
        # Then look for line breaks
        line_breaks = [offset + m.start() for m in re.finditer(r'\n', scan_window)]
        for pos in line_breaks:
            if pos >= target_point:
                return pos + 1  # Include the line break
        
        # Last resort: split at target point
        return target_point
    
    def _add_overlap(self, previous_chunk: str, current_text: str, overlap_tokens: int) -> str:
        """
        Create overlap between chunks
        
        Args:
            previous_chunk: Previous chunk content
            current_text: Current text
            overlap_tokens: Number of tokens to overlap
            
        Returns:
            Text with overlap added
        """
        # Calculate approximate overlap in characters
        chars_per_token = 4.0
        overlap_chars = math.ceil(overlap_tokens * chars_per_token)
        
        if len(previous_chunk) <= overlap_chars:
            return previous_chunk + current_text
            
        # Try to find a natural boundary for the overlap
        overlap_text = previous_chunk[-overlap_chars:]
        
        # Look for paragraph or sentence boundaries in the overlap
        para_match = re.search(r'\n\s*\n', overlap_text)
        if para_match:
            # Found paragraph break, use text after it
            return previous_chunk[-(overlap_chars - para_match.end()):] + current_text
        
        sentence_match = re.search(r'(?<=[.!?])\s+(?=[A-Z])', overlap_text)
        if sentence_match:
            # Found sentence break, use text after it
            return previous_chunk[-(overlap_chars - sentence_match.end()):] + current_text
        
        # No natural boundary found, use raw overlap
        return overlap_text + current_text
    
    # Context manager methods for strategy-specific chunking
    
    def semantic_context(
        self, 
        max_tokens: Optional[int] = None,
        overlap: Optional[int] = None
    ) -> 'ChunkingContext':
        """
        Context manager for semantic chunking
        
        Args:
            max_tokens: Optional max tokens override
            overlap: Optional overlap tokens override
            
        Returns:
            Context manager
        """
        return ChunkingContext(self, ChunkingStrategy.SEMANTIC, max_tokens, overlap)
    
    def structural_context(
        self, 
        max_tokens: Optional[int] = None,
        overlap: Optional[int] = None
    ) -> 'ChunkingContext':
        """
        Context manager for structural chunking
        
        Args:
            max_tokens: Optional max tokens override
            overlap: Optional overlap tokens override
            
        Returns:
            Context manager
        """
        return ChunkingContext(self, ChunkingStrategy.STRUCTURAL, max_tokens, overlap)
    
    def fixed_size_context(
        self, 
        max_tokens: Optional[int] = None,
        overlap: Optional[int] = None
    ) -> 'ChunkingContext':
        """
        Context manager for fixed-size chunking
        
        Args:
            max_tokens: Optional max tokens override
            overlap: Optional overlap tokens override
            
        Returns:
            Context manager
        """
        return ChunkingContext(self, ChunkingStrategy.FIXED_SIZE, max_tokens, overlap)
    
    def sentence_context(
        self, 
        max_tokens: Optional[int] = None,
        overlap: Optional[int] = None
    ) -> 'ChunkingContext':
        """
        Context manager for sentence-based chunking
        
        Args:
            max_tokens: Optional max tokens override
            overlap: Optional overlap tokens override
            
        Returns:
            Context manager
        """
        return ChunkingContext(self, ChunkingStrategy.SENTENCE, max_tokens, overlap)


class ChunkingContext:
    """Context manager for temporary chunking configuration"""
    
    def __init__(
        self, 
        chunker: EnterpriseChunker,
        strategy: ChunkingStrategy,
        max_tokens: Optional[int] = None,
        overlap: Optional[int] = None
    ):
        """
        Initialize the context manager
        
        Args:
            chunker: EnterpriseChunker instance
            strategy: Chunking strategy to use
            max_tokens: Optional max tokens override
            overlap: Optional overlap tokens override
        """
        self.chunker = chunker
        self.strategy = strategy
        self.max_tokens = max_tokens
        self.overlap = overlap
        self.previous_strategy = None
        self.previous_max_tokens = None
        self.previous_overlap = None
    
    def __enter__(self) -> EnterpriseChunker:
        """Set temporary chunking configuration"""
        self.previous_strategy = self.chunker.options.chunking_strategy
        self.previous_max_tokens = self.chunker.options.max_tokens_per_chunk
        self.previous_overlap = self.chunker.options.overlap_tokens
        
        self.chunker.options.chunking_strategy = self.strategy
        if self.max_tokens is not None:
            self.chunker.options.max_tokens_per_chunk = self.max_tokens
        if self.overlap is not None:
            self.chunker.options.overlap_tokens = self.overlap
        
        return self.chunker
    
    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        """Restore previous chunking configuration"""
        self.chunker.options.chunking_strategy = self.previous_strategy
        self.chunker.options.max_tokens_per_chunk = self.previous_max_tokens
        self.chunker.options.overlap_tokens = self.previous_overlap