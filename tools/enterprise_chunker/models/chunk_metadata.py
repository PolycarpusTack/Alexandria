"""
Metadata models for chunks and chunking results
"""

import copy
from dataclasses import dataclass, field
from typing import List, Tuple, Optional
from enterprise_chunker.models.enums import ContentFormat, TokenEstimationStrategy, ChunkingStrategy


@dataclass(frozen=True)
class ChunkMetadata:
    """Metadata about a single chunk"""
    index: int
    total_chunks: int
    format: ContentFormat
    token_count: int
    char_count: int
    has_overlap: bool = False
    overlap_from: int = -1
    content_slice: Tuple[int, int] = (-1, -1)  # Original content slice (start, end)
    preserved_context: str = ""


@dataclass
class ChunkingResult:
    """Result of a chunking operation with metrics and metadata"""
    chunks: List[str]
    chunk_metadata: List[ChunkMetadata]
    original_length: int
    detected_format: ContentFormat
    token_estimation_strategy: TokenEstimationStrategy
    chunking_strategy: ChunkingStrategy
    processing_time: float
    total_token_count: int
    operation_id: str


class MetadataBuilder:
    """Builder for chunk metadata"""
    
    def __init__(self):
        self._reset_state()
        
    def _reset_state(self):
        """Reset the internal state to default values"""
        self.metadata = ChunkMetadata(
            index=0,
            total_chunks=0,
            format=ContentFormat.TEXT,
            token_count=0,
            char_count=0
        )
        
    def with_index(self, index: int):
        """Set the chunk index"""
        # Since ChunkMetadata is frozen, we need to create a new instance with updated fields
        self.metadata = ChunkMetadata(
            index=index,
            total_chunks=self.metadata.total_chunks,
            format=self.metadata.format,
            token_count=self.metadata.token_count,
            char_count=self.metadata.char_count,
            has_overlap=self.metadata.has_overlap,
            overlap_from=self.metadata.overlap_from,
            content_slice=self.metadata.content_slice,
            preserved_context=self.metadata.preserved_context
        )
        return self
        
    def with_total_chunks(self, total: int):
        """Set the total number of chunks"""
        self.metadata = ChunkMetadata(
            index=self.metadata.index,
            total_chunks=total,
            format=self.metadata.format,
            token_count=self.metadata.token_count,
            char_count=self.metadata.char_count,
            has_overlap=self.metadata.has_overlap,
            overlap_from=self.metadata.overlap_from,
            content_slice=self.metadata.content_slice,
            preserved_context=self.metadata.preserved_context
        )
        return self
        
    def with_format(self, format_type: ContentFormat):
        """Set the content format"""
        self.metadata = ChunkMetadata(
            index=self.metadata.index,
            total_chunks=self.metadata.total_chunks,
            format=format_type,
            token_count=self.metadata.token_count,
            char_count=self.metadata.char_count,
            has_overlap=self.metadata.has_overlap,
            overlap_from=self.metadata.overlap_from,
            content_slice=self.metadata.content_slice,
            preserved_context=self.metadata.preserved_context
        )
        return self
        
    def with_token_count(self, token_count: int):
        """Set the token count"""
        self.metadata = ChunkMetadata(
            index=self.metadata.index,
            total_chunks=self.metadata.total_chunks,
            format=self.metadata.format,
            token_count=token_count,
            char_count=self.metadata.char_count,
            has_overlap=self.metadata.has_overlap,
            overlap_from=self.metadata.overlap_from,
            content_slice=self.metadata.content_slice,
            preserved_context=self.metadata.preserved_context
        )
        return self
        
    def with_char_count(self, char_count: int):
        """Set the character count"""
        self.metadata = ChunkMetadata(
            index=self.metadata.index,
            total_chunks=self.metadata.total_chunks,
            format=self.metadata.format,
            token_count=self.metadata.token_count,
            char_count=char_count,
            has_overlap=self.metadata.has_overlap,
            overlap_from=self.metadata.overlap_from,
            content_slice=self.metadata.content_slice,
            preserved_context=self.metadata.preserved_context
        )
        return self
        
    def with_overlap(self, has_overlap: bool, overlap_from: int = -1):
        """Set overlap information"""
        self.metadata = ChunkMetadata(
            index=self.metadata.index,
            total_chunks=self.metadata.total_chunks,
            format=self.metadata.format,
            token_count=self.metadata.token_count,
            char_count=self.metadata.char_count,
            has_overlap=has_overlap,
            overlap_from=overlap_from,
            content_slice=self.metadata.content_slice,
            preserved_context=self.metadata.preserved_context
        )
        return self
        
    def with_content_slice(self, start: int, end: int):
        """Set the content slice in the original text"""
        self.metadata = ChunkMetadata(
            index=self.metadata.index,
            total_chunks=self.metadata.total_chunks,
            format=self.metadata.format,
            token_count=self.metadata.token_count,
            char_count=self.metadata.char_count,
            has_overlap=self.metadata.has_overlap,
            overlap_from=self.metadata.overlap_from,
            content_slice=(start, end),
            preserved_context=self.metadata.preserved_context
        )
        return self
        
    def with_preserved_context(self, context: str):
        """Set preserved context information"""
        self.metadata = ChunkMetadata(
            index=self.metadata.index,
            total_chunks=self.metadata.total_chunks,
            format=self.metadata.format,
            token_count=self.metadata.token_count,
            char_count=self.metadata.char_count,
            has_overlap=self.metadata.has_overlap,
            overlap_from=self.metadata.overlap_from,
            content_slice=self.metadata.content_slice,
            preserved_context=context
        )
        return self
        
    def build(self) -> ChunkMetadata:
        """Build and return the metadata object, then reset internal state"""
        # Create a deep copy of the metadata
        result = copy.deepcopy(self.metadata)
        
        # Reset the internal state to prevent accidental reuse
        self._reset_state()
        
        return result