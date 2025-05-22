"""
Base chunking strategy implementation with common functionality.

This module provides the foundation for all text chunking strategies in the
Enterprise Chunker system. It implements the Template Method pattern to define
the common chunking workflow while allowing specialized implementations to
customize critical steps of the chunking process.

Typical usage:
    strategy = ChunkingStrategyFactory.create_strategy(
        strategy=ChunkingStrategy.SEMANTIC,
        format_type=ContentFormat.TEXT
    )
    result = strategy.chunk(text, options)
"""

import time
import math
import logging
import uuid
from abc import ABC, abstractmethod
from typing import (
    List,
    Dict, 
    Any, 
    Optional, 
    Tuple, 
    Generator,
    TypeVar,
    cast,
    Union
)

from enterprise_chunker.models.enums import ContentFormat, ChunkingStrategy, TokenEstimationStrategy
from enterprise_chunker.models.chunk_metadata import ChunkMetadata, ChunkingResult, MetadataBuilder
from enterprise_chunker.config import ChunkingOptions
from enterprise_chunker.utils.token_estimation import estimate_tokens
from enterprise_chunker.utils.performance import timing_decorator
from enterprise_chunker.exceptions import ChunkingError, BoundaryDetectionError

# Configure logging
logger = logging.getLogger(__name__)

# Type variable for return type annotation
T = TypeVar('T', bound='BaseChunkingStrategy')


class BaseChunkingStrategy(ABC):
    """
    Base class for all chunking strategies with common functionality.
    
    This abstract class implements the Template Method pattern to establish
    a standardized chunking workflow while allowing subclasses to customize
    specific aspects of the chunking process through abstract methods.
    
    Attributes:
        format_type: The content format this strategy handles
        operation_id: Unique identifier for tracking the chunking operation
        stats: Dictionary containing performance statistics
    """
    
    def __init__(self, format_type: ContentFormat):
        """
        Initialize the chunking strategy.
        
        Args:
            format_type: Content format this strategy handles (JSON, XML, etc.)
        """
        if not isinstance(format_type, ContentFormat):
            raise ValueError(f"Invalid format type: {format_type}")
            
        self.format_type: ContentFormat = format_type
        self.operation_id: str = ""
        self.stats: Dict[str, Any] = {
            "boundary_detection_time": 0.0,
            "chunk_processing_time": 0.0,
            "validation_time": 0.0
        }
    
    def set_operation_id(self, operation_id: str) -> T:
        """
        Set the operation ID for tracking and logging.
        
        Args:
            operation_id: Unique operation identifier
            
        Returns:
            Self reference for method chaining
        """
        if not operation_id:
            self.operation_id = str(uuid.uuid4())
            logger.debug(f"Generated new operation ID: {self.operation_id}")
        else:
            self.operation_id = operation_id
            
        return cast(T, self)
    
    @timing_decorator
    def chunk(self, text: str, options: ChunkingOptions) -> ChunkingResult:
        """
        Template method defining the chunking process workflow.
        
        This method implements the high-level chunking algorithm while delegating
        format-specific operations to subclasses.
        
        Args:
            text: Text content to chunk
            options: Chunking configuration options
            
        Returns:
            ChunkingResult containing chunks and associated metadata
            
        Raises:
            ChunkingError: If chunking process fails and fallback is unsuccessful
        """
        if not text:
            logger.warning("Received empty text for chunking")
            return self._create_empty_result(options)
            
        start_time = time.time()
        
        # Generate operation ID if not set
        if not self.operation_id:
            self.set_operation_id(str(uuid.uuid4()))
        
        try:
            # Check if chunking is needed at all
            token_count = estimate_tokens(text, options.token_strategy)
            if token_count <= options.max_tokens_per_chunk * options.safety_margin:
                logger.debug(
                    f"Content size ({token_count} tokens) below threshold "
                    f"of {options.max_tokens_per_chunk * options.safety_margin}, "
                    f"returning single chunk"
                )
                
                metadata = self._create_single_chunk_metadata(text, token_count, options)
                
                result = ChunkingResult(
                    chunks=[text], 
                    chunk_metadata=[metadata],
                    original_length=len(text),
                    detected_format=self.format_type,
                    token_estimation_strategy=options.token_strategy,
                    chunking_strategy=self._get_chunking_strategy(),
                    processing_time=time.time() - start_time,
                    total_token_count=token_count,
                    operation_id=self.operation_id
                )
                
                return result
            
            # Execute the main chunking logic
            result = self._execute_chunking_workflow(text, options, start_time)
            
            # Log chunking results
            logger.info(
                f"[{self.operation_id}] Chunked content ({len(text):,} chars) into "
                f"{len(result.chunks)} chunks using {self._get_chunking_strategy().value} "
                f"strategy in {result.processing_time:.3f}s"
            )
            
            self._log_chunking_stats(result)
            
            return result
            
        except Exception as e:
            logger.error(
                f"[{self.operation_id}] Error in chunking: {str(e)}", 
                exc_info=True
            )
            # Fall back to simple chunking
            try:
                logger.warning(f"[{self.operation_id}] Using fallback chunking method")
                return self._simple_chunk_text(text, options, start_time)
            except Exception as fallback_error:
                logger.critical(
                    f"[{self.operation_id}] Fallback chunking also failed: {str(fallback_error)}",
                    exc_info=True
                )
                raise ChunkingError(
                    f"Chunking failed with both primary and fallback methods: {str(e)}"
                ) from e
    
    def _create_empty_result(self, options: ChunkingOptions) -> ChunkingResult:
        """
        Create a result for empty input text.
        
        Args:
            options: Chunking options
            
        Returns:
            Empty chunking result
        """
        metadata = MetadataBuilder() \
            .with_index(0) \
            .with_total_chunks(0) \
            .with_format(self.format_type) \
            .with_token_count(0) \
            .with_char_count(0) \
            .with_content_slice(0, 0) \
            .build()
            
        return ChunkingResult(
            chunks=[],
            chunk_metadata=[metadata],
            original_length=0,
            detected_format=self.format_type,
            token_estimation_strategy=options.token_strategy,
            chunking_strategy=self._get_chunking_strategy(),
            processing_time=0.0,
            total_token_count=0,
            operation_id=self.operation_id
        )
    
    def _create_single_chunk_metadata(
        self, 
        text: str, 
        token_count: int,
        options: ChunkingOptions
    ) -> ChunkMetadata:
        """
        Create metadata for a single chunk scenario.
        
        Args:
            text: Full text content
            token_count: Number of tokens in the text
            options: Chunking options
            
        Returns:
            ChunkMetadata for the single chunk
        """
        return MetadataBuilder() \
            .with_index(0) \
            .with_total_chunks(1) \
            .with_format(self.format_type) \
            .with_token_count(token_count) \
            .with_char_count(len(text)) \
            .with_content_slice(0, len(text)) \
            .build()
    
    def _execute_chunking_workflow(
        self, 
        text: str, 
        options: ChunkingOptions,
        start_time: float
    ) -> ChunkingResult:
        """
        Execute the main chunking workflow.
        
        Args:
            text: Text to chunk
            options: Chunking options
            start_time: Process start time
            
        Returns:
            Chunking result
            
        Raises:
            BoundaryDetectionError: If boundary detection fails
        """
        # Detect boundaries for chunking with timing
        boundary_start = time.time()
        try:
            boundaries = self.detect_boundaries(text, options)
            self.stats["boundary_detection_time"] = time.time() - boundary_start
        except Exception as e:
            logger.error(f"[{self.operation_id}] Boundary detection failed: {str(e)}")
            raise BoundaryDetectionError(f"Failed to detect boundaries: {str(e)}") from e
        
        # Process chunks based on boundaries with timing
        processing_start = time.time()
        result = self.process_chunks_with_boundaries(text, boundaries, options)
        self.stats["chunk_processing_time"] = time.time() - processing_start
        
        # Update processing time
        result.processing_time = time.time() - start_time
        
        return result
    
    def _log_chunking_stats(self, result: ChunkingResult) -> None:
        """
        Log detailed chunking statistics.
        
        Args:
            result: Chunking result to analyze
        """
        if not result.chunks:
            return
            
        avg_chunk_size = sum(len(chunk) for chunk in result.chunks) / len(result.chunks)
        avg_tokens = result.total_token_count / len(result.chunks)
        
        logger.debug(
            f"[{self.operation_id}] Chunking stats: "
            f"avg chunk size={avg_chunk_size:.1f} chars, "
            f"avg tokens={avg_tokens:.1f}, "
            f"boundary detection={self.stats['boundary_detection_time']:.3f}s, "
            f"chunk processing={self.stats['chunk_processing_time']:.3f}s"
        )
    
    @abstractmethod
    def detect_boundaries(self, text: str, options: ChunkingOptions) -> List[Dict[str, Any]]:
        """
        Detect boundary points in text (to be implemented by subclasses).
        
        Subclasses must implement this method to identify logical break points
        in the text based on its format and content structure.
        
        Args:
            text: Text to analyze
            options: Chunking options
            
        Returns:
            List of boundary dictionaries with at least 'index' key
            
        Raises:
            NotImplementedError: If not implemented by subclass
        """
        raise NotImplementedError("Subclasses must implement detect_boundaries")
    
    def process_chunks_with_boundaries(
        self, 
        text: str, 
        boundaries: List[Dict[str, Any]], 
        options: ChunkingOptions
    ) -> ChunkingResult:
        """
        Process chunks based on detected boundaries.
        
        This method implements the common logic for creating chunks based on
        the boundaries detected by the strategy-specific implementation.
        
        Args:
            text: Original text content
            boundaries: List of boundaries with positions
            options: Chunking options
            
        Returns:
            ChunkingResult with chunks and metadata
        """
        if not boundaries:
            # No boundaries found, fall back to simple chunking
            logger.debug(f"[{self.operation_id}] No boundaries detected, falling back to simple chunking")
            return self._simple_chunk_text(text, options, time.time())
        
        # Calculate max chars based on token limit
        max_chars = self._get_max_chars_from_tokens(options.max_tokens_per_chunk * options.safety_margin)
        overlap_chars = self._get_max_chars_from_tokens(options.overlap_tokens)
        
        chunks = []
        metadata = []
        current_chunk = ""
        current_pos = 0
        
        # Track context for preservation (used by subclasses)
        context_tracker = self._create_context_tracker()
        
        try:
            # Process text by boundaries
            for i, boundary in enumerate(boundaries):
                # Skip if we've already processed past this point
                if boundary['index'] < current_pos:
                    continue
                
                # Get content up to this boundary
                content_before = text[current_pos:boundary['index']]
                
                # Update context tracker with this boundary
                self._update_context_tracker(context_tracker, boundary)
                
                # Find the next boundary or end of text
                next_boundary_idx = next((j for j, b in enumerate(boundaries) 
                                       if j > i and b['index'] > boundary.get('end', boundary['index'])), 
                                      len(boundaries))
                
                if next_boundary_idx < len(boundaries):
                    section_end = boundaries[next_boundary_idx]['index']
                else:
                    section_end = len(text)
                
                # Get the section text
                section_text = text[boundary['index']:section_end]
                
                # Check if adding this section would exceed chunk size
                if current_chunk and len(current_chunk) + len(section_text) > max_chars:
                    # Finalize current chunk
                    chunks.append(current_chunk)
                    
                    metadata.append(
                        self._create_chunk_metadata(
                            current_chunk, 
                            options, 
                            len(chunks) - 1, 
                            current_pos, 
                            context_tracker,
                            False
                        )
                    )
                    
                    # Start new chunk with context and overlap
                    new_chunk = self._create_new_chunk_with_context(
                        current_chunk, 
                        context_tracker, 
                        overlap_chars, 
                        boundary, 
                        options
                    )
                    
                    current_chunk = new_chunk
                else:
                    # Add section to current chunk
                    if not current_chunk:
                        current_chunk = section_text
                    else:
                        current_chunk += section_text
                
                current_pos = section_end
            
            # Handle any remaining content
            self._process_remaining_content(
                text, current_pos, current_chunk, chunks, metadata, 
                context_tracker, max_chars, options
            )
            
            # Update total chunks in metadata
            metadata_builder = MetadataBuilder()
            updated_metadata = []
            for md in metadata:
                # Create a new metadata instance with updated total_chunks
                updated_md = metadata_builder \
                    .with_index(md.index) \
                    .with_total_chunks(len(chunks)) \
                    .with_format(md.format) \
                    .with_token_count(md.token_count) \
                    .with_char_count(md.char_count) \
                    .with_overlap(md.has_overlap, md.overlap_from) \
                    .with_content_slice(md.content_slice[0], md.content_slice[1]) \
                    .with_preserved_context(md.preserved_context) \
                    .build()
                updated_metadata.append(updated_md)
            metadata = updated_metadata
            
            # Add metadata comments if enabled
            if options.add_metadata_comments:
                chunks = self._add_metadata_comments(chunks, options)
            
            # Validate to ensure no chunk exceeds the token limit
            validation_start = time.time()
            safe_chunks = self._validate_chunks(chunks, options)
            self.stats["validation_time"] = time.time() - validation_start
            
            # Update metadata if chunks were modified
            if len(safe_chunks) != len(metadata):
                logger.info(
                    f"[{self.operation_id}] Chunks were further split during validation: "
                    f"{len(chunks)} -> {len(safe_chunks)}"
                )
                metadata = self._rebuild_metadata_for_chunks(safe_chunks, options)
            
            return ChunkingResult(
                chunks=safe_chunks,
                chunk_metadata=metadata,
                original_length=len(text),
                detected_format=self.format_type,
                token_estimation_strategy=options.token_strategy,
                chunking_strategy=self._get_chunking_strategy(),
                processing_time=0.0,  # Will be set by caller
                total_token_count=sum(md.token_count for md in metadata),
                operation_id=self.operation_id
            )
            
        except Exception as e:
            logger.error(
                f"[{self.operation_id}] Error in chunk processing: {str(e)}",
                exc_info=True
            )
            # In case of error, return what we've processed so far
            if chunks:
                logger.warning(
                    f"[{self.operation_id}] Returning {len(chunks)} chunks processed before error"
                )
                # Create new metadata instances with updated total_chunks
                metadata_builder = MetadataBuilder()
                updated_metadata = []
                for md in metadata:
                    updated_md = metadata_builder \
                        .with_index(md.index) \
                        .with_total_chunks(len(chunks)) \
                        .with_format(md.format) \
                        .with_token_count(md.token_count) \
                        .with_char_count(md.char_count) \
                        .with_overlap(md.has_overlap, md.overlap_from) \
                        .with_content_slice(md.content_slice[0], md.content_slice[1]) \
                        .with_preserved_context(md.preserved_context) \
                        .build()
                    updated_metadata.append(updated_md)
                
                return ChunkingResult(
                    chunks=chunks,
                    chunk_metadata=updated_metadata,
                    original_length=len(text),
                    detected_format=self.format_type,
                    token_estimation_strategy=options.token_strategy,
                    chunking_strategy=self._get_chunking_strategy(),
                    processing_time=time.time() - time.time(),
                    total_token_count=sum(md.token_count for md in metadata),
                    operation_id=self.operation_id
                )
            
            # No chunks processed, fall back to simple chunking
            logger.warning(f"[{self.operation_id}] No chunks processed, falling back to simple chunking")
            return self._simple_chunk_text(text, options, time.time())
    
    def _create_chunk_metadata(
        self,
        chunk: str,
        options: ChunkingOptions,
        index: int,
        current_pos: int,
        context_tracker: Optional[Dict[str, Any]],
        has_overlap: bool
    ) -> ChunkMetadata:
        """
        Create metadata for a chunk.
        
        Args:
            chunk: Chunk content
            options: Chunking options
            index: Chunk index
            current_pos: Current position in original text
            context_tracker: Context tracking information
            has_overlap: Whether this chunk has overlap with previous
            
        Returns:
            ChunkMetadata for the chunk
        """
        metadata_builder = MetadataBuilder() \
            .with_index(index) \
            .with_format(self.format_type) \
            .with_token_count(estimate_tokens(chunk, options.token_strategy)) \
            .with_char_count(len(chunk)) \
            .with_overlap(has_overlap)
        
        # Try to find the slice in original text
        # This might not be exact due to transformations
        try:
            if index == 0:
                slice_start = 0
            else:
                # Look for the chunk or a portion of it in the original text
                slice_start = self._find_chunk_position(chunk, current_pos)
            
            metadata_builder.with_content_slice(
                slice_start,
                slice_start + len(chunk)
            )
        except Exception as e:
            logger.warning(f"Could not determine precise content slice: {e}")
            metadata_builder.with_content_slice(0, len(chunk))
        
        # Add preserved context if available
        if context_tracker:
            preserved_context = self._get_preserved_context(context_tracker)
            if preserved_context:
                metadata_builder.with_preserved_context(preserved_context)
        
        return metadata_builder.build()
    
    def _find_chunk_position(self, chunk: str, current_pos: int) -> int:
        """
        Find the position of a chunk in the original text.
        
        Args:
            chunk: Chunk to locate
            current_pos: Current position in text processing
            
        Returns:
            Starting position of the chunk
        """
        # For larger chunks, use a sample portion for matching
        if len(chunk) > 1000:
            # Use the first 200 chars that aren't common metadata
            for start_idx in range(min(200, len(chunk))):
                sample = chunk[start_idx:start_idx+200]
                if not sample.startswith("/*") and not sample.startswith("//"):
                    return current_pos - len(chunk) + start_idx
        
        # Default fallback
        return current_pos - len(chunk)
    
    def _process_remaining_content(
        self,
        text: str,
        current_pos: int,
        current_chunk: str,
        chunks: List[str],
        metadata: List[ChunkMetadata],
        context_tracker: Optional[Dict[str, Any]],
        max_chars: int,
        options: ChunkingOptions
    ) -> None:
        """
        Process any remaining content after boundary processing.
        
        Args:
            text: Original text
            current_pos: Current position in text
            current_chunk: Current chunk being assembled
            chunks: List of chunks to append to
            metadata: List of metadata to append to
            context_tracker: Context tracking information
            max_chars: Maximum characters per chunk
            options: Chunking options
        """
        # Add any remaining content
        if current_pos < len(text):
            remaining = text[current_pos:]
            
            if current_chunk and len(current_chunk) + len(remaining) > max_chars:
                # Finalize current chunk
                chunks.append(current_chunk)
                
                metadata.append(
                    self._create_chunk_metadata(
                        current_chunk, 
                        options, 
                        len(chunks) - 1, 
                        current_pos - len(current_chunk), 
                        context_tracker,
                        len(chunks) > 1
                    )
                )
                
                # Add remaining as new chunk
                chunks.append(remaining)
                
                metadata.append(
                    self._create_chunk_metadata(
                        remaining, 
                        options, 
                        len(chunks) - 1, 
                        current_pos, 
                        context_tracker,
                        False
                    )
                )
            else:
                # Add to current chunk
                if not current_chunk:
                    current_chunk = remaining
                else:
                    current_chunk += remaining
                
                if current_chunk:
                    chunks.append(current_chunk)
                    
                    metadata.append(
                        self._create_chunk_metadata(
                            current_chunk, 
                            options, 
                            len(chunks) - 1, 
                            current_pos - len(current_chunk) + len(remaining), 
                            context_tracker,
                            len(chunks) > 1
                        )
                    )
        elif current_chunk:
            # Add final chunk
            chunks.append(current_chunk)
            
            metadata.append(
                self._create_chunk_metadata(
                    current_chunk, 
                    options, 
                    len(chunks) - 1, 
                    current_pos - len(current_chunk), 
                    context_tracker,
                    len(chunks) > 1
                )
            )
    
    def _rebuild_metadata_for_chunks(
        self, 
        chunks: List[str], 
        options: ChunkingOptions
    ) -> List[ChunkMetadata]:
        """
        Rebuild metadata when chunks have been modified.
        
        Args:
            chunks: List of final chunks
            options: Chunking options
            
        Returns:
            List of rebuilt metadata objects
        """
        metadata = []
        for i, chunk in enumerate(chunks):
            metadata_builder = MetadataBuilder() \
                .with_index(i) \
                .with_total_chunks(len(chunks)) \
                .with_format(self.format_type) \
                .with_token_count(estimate_tokens(chunk, options.token_strategy)) \
                .with_char_count(len(chunk)) \
                .with_overlap(i > 0)
            
            metadata.append(metadata_builder.build())
            
        return metadata
    
    def _create_context_tracker(self) -> Optional[Dict[str, Any]]:
        """
        Create a context tracker for preserving context between chunks.
        
        Returns:
            Context tracker dictionary or None
        """
        return None
    
    def _update_context_tracker(self, context_tracker: Optional[Dict[str, Any]], boundary: Dict[str, Any]) -> None:
        """
        Update context tracker with information from current boundary.
        
        Args:
            context_tracker: Context tracker to update
            boundary: Current boundary information
        """
        pass
    
    def _get_preserved_context(self, context_tracker: Dict[str, Any]) -> str:
        """
        Get preserved context from context tracker.
        
        Args:
            context_tracker: Context tracker
            
        Returns:
            Preserved context string
        """
        return ""
    
    def _create_new_chunk_with_context(
        self,
        previous_chunk: str,
        context_tracker: Optional[Dict[str, Any]],
        overlap_chars: int,
        boundary: Dict[str, Any],
        options: ChunkingOptions
    ) -> str:
        """
        Create a new chunk with context and overlap.
        
        Args:
            previous_chunk: Previous chunk content
            context_tracker: Context tracker
            overlap_chars: Number of chars to overlap
            boundary: Current boundary information
            options: Chunking options
            
        Returns:
            New chunk text with context
        """
        # Start with context information
        if context_tracker:
            preserved_context = self._get_preserved_context(context_tracker)
            if preserved_context:
                chunk = f"/* Context from previous chunk */\n{preserved_context}\n/* Current content */\n"
            else:
                chunk = "/* Continued from previous chunk */\n"
        else:
            chunk = "/* Continued from previous chunk */\n"
        
        # Add overlap if configured
        if overlap_chars > 0 and len(previous_chunk) > overlap_chars:
            overlap_content = previous_chunk[-overlap_chars:]
            chunk += overlap_content
        
        return chunk
    
    def _add_metadata_comments(self, chunks: List[str], options: ChunkingOptions) -> List[str]:
        """
        Add format-appropriate metadata comments to chunks.
        
        Args:
            chunks: List of chunks to add metadata to
            options: Chunking options
            
        Returns:
            Chunks with metadata comments
        """
        if not chunks:
            return chunks
        
        total_chunks = len(chunks)
        
        format_comments = {
            ContentFormat.JSON: lambda i, chunk: chunk,  # JSON already has metadata
            ContentFormat.MARKDOWN: lambda i, chunk: f"<!-- CHUNK {i+1}/{total_chunks} -->\n{chunk}",
            ContentFormat.XML: lambda i, chunk: f"<!-- XML CHUNK {i+1}/{total_chunks} -->\n{chunk}",
            ContentFormat.CODE: lambda i, chunk: f"// CODE CHUNK {i+1}/{total_chunks}\n{chunk}",
            ContentFormat.LOGS: lambda i, chunk: f"# LOG CHUNK {i+1}/{total_chunks}\n{chunk}",
            ContentFormat.CSV: lambda i, chunk: f"# CSV CHUNK {i+1}/{total_chunks}\n{chunk}",
            ContentFormat.TEXT: lambda i, chunk: f"/* CHUNK {i+1}/{total_chunks} */\n{chunk}",
        }
        
        comment_func = format_comments.get(self.format_type, format_comments[ContentFormat.TEXT])
        return [comment_func(i, chunk) for i, chunk in enumerate(chunks)]
    
    def _validate_chunks(self, chunks: List[str], options: ChunkingOptions) -> List[str]:
        """
        Ensure all chunks are within token limits.
        
        Args:
            chunks: List of chunks to validate
            options: Chunking options
            
        Returns:
            List of validated chunks
        """
        validated_chunks = []
        max_tokens = options.max_tokens_per_chunk
        
        for chunk in chunks:
            # Skip empty chunks
            if not chunk or not chunk.strip():
                continue
                
            token_count = estimate_tokens(chunk, options.token_strategy)
            
            if token_count <= max_tokens:
                # Chunk is within limits
                validated_chunks.append(chunk)
            else:
                # Chunk is too large, split it
                logger.warning(
                    f"[{self.operation_id}] Chunk exceeds token limit "
                    f"({token_count} > {max_tokens}), splitting..."
                )
                
                # Use emergency chunking
                sub_chunks = self._simple_chunk_text_list(chunk, options)
                validated_chunks.extend(sub_chunks)
        
        return validated_chunks
    
    def _get_max_chars_from_tokens(self, tokens: int) -> int:
        """
        Convert token count to approximate character count.
        
        Args:
            tokens: Number of tokens
            
        Returns:
            Approximate character count
        """
        # Conservative character-to-token ratio (varies by language and content)
        chars_per_token = 4.0
        return math.ceil(tokens * chars_per_token)
    
    def _simple_chunk_text(self, text: str, options: ChunkingOptions, start_time: float) -> ChunkingResult:
        """
        Simple fallback chunking when more sophisticated methods fail.
        
        Args:
            text: Text to chunk
            options: Chunking options
            start_time: Start time for processing
            
        Returns:
            ChunkingResult with chunks
        """
        chunks = self._simple_chunk_text_list(text, options)
        
        # Create metadata for chunks
        metadata = []
        for i, chunk in enumerate(chunks):
            metadata_builder = MetadataBuilder() \
                .with_index(i) \
                .with_total_chunks(len(chunks)) \
                .with_format(self.format_type) \
                .with_token_count(estimate_tokens(chunk, options.token_strategy)) \
                .with_char_count(len(chunk)) \
                .with_overlap(i > 0)
            
            metadata.append(metadata_builder.build())
        
        logger.info(
            f"[{self.operation_id}] Simple chunking completed with {len(chunks)} chunks "
            f"in {time.time() - start_time:.3f}s"
        )
        
        return ChunkingResult(
            chunks=chunks,
            chunk_metadata=metadata,
            original_length=len(text),
            detected_format=self.format_type,
            token_estimation_strategy=options.token_strategy,
            chunking_strategy=ChunkingStrategy.FIXED_SIZE,  # Always use fixed size for fallback
            processing_time=time.time() - start_time,
            total_token_count=sum(md.token_count for md in metadata),
            operation_id=self.operation_id
        )
    
    def _simple_chunk_text_list(self, text: str, options: ChunkingOptions) -> List[str]:
        """
        Simple fallback chunking when more sophisticated methods fail.
        
        Args:
            text: Text to chunk
            options: Chunking options
            
        Returns:
            List of text chunks
        """
        try:
            max_chars = self._get_max_chars_from_tokens(options.max_tokens_per_chunk * options.safety_margin)
            overlap_chars = self._get_max_chars_from_tokens(options.overlap_tokens)
            
            # Simple line-based chunking
            lines = text.split('\n')
            chunks = []
            current_chunk = ""
            
            for line in lines:
                # Check if adding this line would exceed chunk size
                if current_chunk and len(current_chunk) + len(line) + 1 > max_chars:
                    chunks.append(current_chunk)
                    
                    # Start new chunk with overlap
                    if overlap_chars > 0 and len(current_chunk) > overlap_chars:
                        current_chunk = f"// Continued...\n{current_chunk[-overlap_chars:]}\n{line}"
                    else:
                        current_chunk = f"// Continued...\n{line}"
                else:
                    # Add line to current chunk
                    if current_chunk:
                        current_chunk += f"\n{line}"
                    else:
                        current_chunk = line
                        
                # Handle very long lines by splitting them
                while len(current_chunk) > max_chars * 1.5:
                    split_point = max_chars - overlap_chars
                    chunks.append(current_chunk[:split_point])
                    current_chunk = f"// Continued...\n{current_chunk[split_point-overlap_chars:]}"
            
            # Add final chunk if not empty
            if current_chunk:
                chunks.append(current_chunk)
                
            # Add metadata comments for clarity
            chunks = [
                f"/* EMERGENCY CHUNK {i+1}/{len(chunks)} */\n{chunk}"
                for i, chunk in enumerate(chunks)
            ]
            
            logger.info(f"[{self.operation_id}] Simple chunking produced {len(chunks)} chunks")
            return chunks
            
        except Exception as e:
            logger.error(f"[{self.operation_id}] Error in simple chunking: {str(e)}", exc_info=True)
            # Last resort: return single chunk or chunks of fixed size
            if len(text) <= options.max_tokens_per_chunk * 4:
                return [text]
            else:
                # Split into equal-sized chunks
                chunk_size = max(100, options.max_tokens_per_chunk // 2)
                return [text[i:i + chunk_size] for i in range(0, len(text), chunk_size)]
    
    @abstractmethod
    def _get_chunking_strategy(self) -> ChunkingStrategy:
        """
        Get the chunking strategy this implementation represents.
        
        Returns:
            ChunkingStrategy enum value
        """
        raise NotImplementedError("Subclasses must implement _get_chunking_strategy")