"""
JSON-specific chunking strategy implementation.

This module provides specialized chunking for JSON content with structure preservation
for optimal semantic processing of JSON arrays and objects.
"""

import re
import json
import logging
from typing import List, Dict, Any, Optional, Tuple, ClassVar
from functools import lru_cache

from enterprise_chunker.strategies.base import BaseChunkingStrategy
from enterprise_chunker.models.enums import ContentFormat, ChunkingStrategy, TokenEstimationStrategy
from enterprise_chunker.config import ChunkingOptions
from enterprise_chunker.utils.token_estimation import estimate_tokens
from enterprise_chunker.models.chunk_metadata import MetadataBuilder, ChunkingResult

# Configure logging
logger = logging.getLogger(__name__)


class JsonChunkingStrategy(BaseChunkingStrategy):
    """
    Strategy for chunking JSON content with structural preservation.
    
    This strategy intelligently handles different JSON structures (arrays and objects)
    by preserving their structure while splitting into appropriate chunks. It maintains
    metadata about the chunking process within the JSON itself for reconstruction.
    
    Features:
    - Array chunking with smart item grouping
    - Object chunking with property preservation
    - Structure-aware overlap between chunks
    - JSON metadata for reconstruction
    """
    
    def __init__(self):
        """Initialize the JSON chunking strategy."""
        super().__init__(ContentFormat.JSON)
    
    def detect_boundaries(self, text: str, options: ChunkingOptions) -> List[Dict[str, Any]]:
        """
        This method is overridden but not used for JSON chunking
        because we parse the JSON and handle it differently.
        
        Args:
            text: JSON text to analyze
            options: Chunking options
            
        Returns:
            List of boundary dictionaries (empty for JSON)
        """
        # JSON chunking doesn't use traditional boundaries,
        # so we return an empty list to trigger special handling
        return []
    
    def chunk(self, text: str, options: ChunkingOptions) -> ChunkingResult:
        """
        Override the chunking process for JSON with structure-aware processing.
        
        This method parses the JSON and routes to specialized handling based on
        whether the root is an array, object, or simple value.
        
        Args:
            text: JSON text to chunk
            options: Chunking options
            
        Returns:
            ChunkingResult with chunks and metadata
        """
        try:
            # Try to parse the JSON first
            parsed_json = json.loads(text)
            
            # Handle different JSON structures
            if isinstance(parsed_json, list):
                logger.debug(f"[{self.operation_id}] Processing JSON array with {len(parsed_json)} items")
                return self._chunk_json_array(text, parsed_json, options)
            elif isinstance(parsed_json, dict):
                logger.debug(f"[{self.operation_id}] Processing JSON object with {len(parsed_json)} properties")
                return self._chunk_json_object(text, parsed_json, options)
            else:
                # Simple value, return as single chunk
                logger.debug(f"[{self.operation_id}] Processing simple JSON value")
                return self._create_single_chunk_result(text, options)
        except json.JSONDecodeError as e:
            # Not valid JSON, fall back to parent implementation
            logger.warning(f"[{self.operation_id}] Invalid JSON ({str(e)}), falling back to semantic chunking")
            from enterprise_chunker.strategies.semantic import SemanticChunkingStrategy
            semantic_strategy = SemanticChunkingStrategy()
            semantic_strategy.set_operation_id(self.operation_id)
            return semantic_strategy.chunk(text, options)
    
    def _chunk_json_array(
        self, 
        text: str, 
        parsed_array: list, 
        options: ChunkingOptions
    ) -> ChunkingResult:
        """
        Chunk a JSON array with smart item grouping.
        
        Args:
            text: Original JSON text
            parsed_array: Parsed JSON array
            options: Chunking options
            
        Returns:
            ChunkingResult with chunks
        """
        if not parsed_array:
            # Empty array, return as is
            return self._create_single_chunk_result(text, options)
            
        # Calculate maximum size based on token limit
        max_tokens = options.max_tokens_per_chunk * options.safety_margin
        
        chunks = []
        metadata = []
        current_group = []
        current_tokens = 2  # Start with [] tokens
        
        for item in parsed_array:
            # Serialize this item
            item_json = json.dumps(item)
            item_tokens = estimate_tokens(item_json, options.token_strategy) + 1  # +1 for comma
            
            # Check if adding this item would exceed limits
            if current_group and (current_tokens + item_tokens > max_tokens):
                # Finalize current group
                group_json = json.dumps(current_group)
                chunk_json = self._create_json_chunk(
                    "json_array", 
                    group_json, 
                    len(chunks),
                    len(chunks) > 0  # has overlap
                )
                
                chunks.append(chunk_json)
                
                # Create metadata
                metadata_builder = self._create_metadata_builder(
                    index=len(chunks) - 1,
                    content=chunk_json,
                    token_strategy=options.token_strategy
                )
                metadata.append(metadata_builder.build())
                
                # Start new group with overlap if configured
                if options.overlap_tokens > 0:
                    overlap_items = []
                    overlap_tokens = 0
                    
                    # Add last items from previous group for context
                    for prev_item in reversed(current_group):
                        prev_json = json.dumps(prev_item)
                        prev_tokens = estimate_tokens(prev_json, options.token_strategy) + 1
                        
                        if overlap_tokens + prev_tokens <= options.overlap_tokens:
                            overlap_items.insert(0, prev_item)
                            overlap_tokens += prev_tokens
                        else:
                            break
                            
                    current_group = overlap_items
                    current_tokens = 2 + overlap_tokens  # [] + overlap
                else:
                    current_group = []
                    current_tokens = 2  # []
                    
            # Add item to current group
            current_group.append(item)
            current_tokens += item_tokens
            
        # Add final group if not empty
        if current_group:
            group_json = json.dumps(current_group)
            chunk_json = self._create_json_chunk(
                "json_array", 
                group_json, 
                len(chunks),
                len(chunks) > 0  # has overlap
            )
            
            chunks.append(chunk_json)
            
            metadata_builder = self._create_metadata_builder(
                index=len(chunks) - 1,
                content=chunk_json,
                token_strategy=options.token_strategy
            )
            metadata.append(metadata_builder.build())
            
        # Update total chunks in metadata
        for md in metadata:
            md.total_chunks = len(chunks)
            
        # Update chunk info in the JSON
        updated_chunks = []
        for i, chunk in enumerate(chunks):
            try:
                chunk_obj = json.loads(chunk)
                chunk_obj["_chunk_info"]["total"] = len(chunks)
                chunk_obj["_chunk_info"]["has_overlap"] = i > 0 and options.overlap_tokens > 0
                updated_chunks.append(json.dumps(chunk_obj))
            except json.JSONDecodeError:
                logger.warning(f"[{self.operation_id}] Failed to update chunk info for chunk {i}, using original")
                updated_chunks.append(chunk)
            
        return self._create_chunking_result(
            chunks=updated_chunks,
            metadata=metadata,
            original_text=text,
            options=options
        )
    
    def _chunk_json_object(
        self, 
        text: str, 
        parsed_obj: dict, 
        options: ChunkingOptions
    ) -> ChunkingResult:
        """
        Chunk a JSON object with smart property grouping.
        
        Args:
            text: Original JSON text
            parsed_obj: Parsed JSON object
            options: Chunking options
            
        Returns:
            ChunkingResult with chunks
        """
        # Skip chunking if the object is small enough
        total_tokens = estimate_tokens(text, options.token_strategy)
        if total_tokens <= options.max_tokens_per_chunk * options.safety_margin:
            return self._create_single_chunk_result(text, options)
        
        # Calculate max tokens to use
        max_tokens = options.max_tokens_per_chunk * options.safety_margin
        
        chunks = []
        metadata = []
        current_obj = {}
        current_tokens = 2  # Start with {} tokens
        
        # Sort properties by size to better distribute them
        properties = []
        for key, value in parsed_obj.items():
            prop_json = f'"{key}":{json.dumps(value)}'
            prop_tokens = estimate_tokens(prop_json, options.token_strategy) + 1  # +1 for comma
            properties.append((key, value, prop_tokens))
            
        # Sort properties: smaller ones first makes most efficient packing
        properties.sort(key=lambda x: x[2])
        
        for key, value, prop_tokens in properties:
            # Skip metadata if present
            if key == "_chunk_info":
                continue
                
            # Check if adding this property would exceed limits
            if current_obj and (current_tokens + prop_tokens > max_tokens):
                # Finalize current object
                chunk_info = {
                    "index": len(chunks),
                    "type": "json_object",
                    "properties": list(current_obj.keys())
                }
                
                if len(chunks) > 0:
                    chunk_info["continued"] = True
                    chunk_info["previous_chunk"] = len(chunks) - 1
                
                current_obj["_chunk_info"] = chunk_info
                
                chunk_json = json.dumps(current_obj)
                chunks.append(chunk_json)
                
                # Add metadata
                metadata_builder = self._create_metadata_builder(
                    index=len(chunks) - 1,
                    content=chunk_json,
                    token_strategy=options.token_strategy
                )
                metadata.append(metadata_builder.build())
                
                # Start new object
                current_obj = {
                    "_chunk_info": {
                        "continued": True,
                        "previous_chunk": len(chunks) - 1
                    }
                }
                current_tokens = estimate_tokens(json.dumps(current_obj), options.token_strategy)
                
            # Add property to current object
            current_obj[key] = value
            current_tokens += prop_tokens
            
        # Add final object if not empty
        if current_obj and any(key != "_chunk_info" for key in current_obj):
            if "_chunk_info" not in current_obj:
                current_obj["_chunk_info"] = {}
                
            current_obj["_chunk_info"].update({
                "index": len(chunks),
                "type": "json_object",
                "properties": [k for k in current_obj.keys() if k != "_chunk_info"],
                "final": True
            })
            
            chunk_json = json.dumps(current_obj)
            chunks.append(chunk_json)
            
            metadata_builder = self._create_metadata_builder(
                index=len(chunks) - 1,
                content=chunk_json,
                token_strategy=options.token_strategy
            )
            metadata.append(metadata_builder.build())
            
        # Update total chunks in metadata
        for md in metadata:
            md.total_chunks = len(chunks)
            
        # Update chunk info in the JSON
        updated_chunks = []
        for i, chunk in enumerate(chunks):
            try:
                chunk_obj = json.loads(chunk)
                chunk_obj["_chunk_info"]["total"] = len(chunks)
                updated_chunks.append(json.dumps(chunk_obj))
            except json.JSONDecodeError:
                # In case of an error, keep the chunk as is
                updated_chunks.append(chunk)
            
        return self._create_chunking_result(
            chunks=updated_chunks,
            metadata=metadata,
            original_text=text,
            options=options
        )
    
    def _create_json_chunk(
        self, 
        chunk_type: str, 
        data_json: str, 
        index: int,
        has_overlap: bool = False
    ) -> str:
        """
        Create a JSON chunk with metadata.
        
        Args:
            chunk_type: Type of JSON chunk (array or object)
            data_json: JSON data string
            index: Chunk index
            has_overlap: Whether this chunk has overlap with previous
            
        Returns:
            JSON string with chunk info
        """
        return f'{{"_chunk_info":{{"index":{index},"type":"{chunk_type}","has_overlap":{str(has_overlap).lower()}}},"data":{data_json}}}'
    
    def _create_metadata_builder(
        self,
        index: int,
        content: str,
        token_strategy: TokenEstimationStrategy
    ) -> MetadataBuilder:
        """
        Create a metadata builder for a JSON chunk.
        
        Args:
            index: Chunk index
            content: Chunk content
            token_strategy: Token estimation strategy
            
        Returns:
            Configured MetadataBuilder
        """
        return MetadataBuilder() \
            .with_index(index) \
            .with_format(ContentFormat.JSON) \
            .with_token_count(estimate_tokens(content, token_strategy)) \
            .with_char_count(len(content)) \
            .with_overlap(index > 0)
    
    def _create_single_chunk_result(self, text: str, options: ChunkingOptions) -> ChunkingResult:
        """
        Create a single-chunk result for small JSON.
        
        Args:
            text: JSON text
            options: Chunking options
            
        Returns:
            ChunkingResult with a single chunk
        """
        token_count = estimate_tokens(text, options.token_strategy)
        
        # FIX: Don't pass a tuple to with_content_slice, pass separate arguments
        metadata_builder = MetadataBuilder() \
            .with_index(0) \
            .with_total_chunks(1) \
            .with_format(ContentFormat.JSON) \
            .with_token_count(token_count) \
            .with_char_count(len(text)) \
            .with_content_slice(0, len(text))  # Passing separate arguments instead of a tuple
        
        return self._create_chunking_result(
            chunks=[text],
            metadata=[metadata_builder.build()],
            original_text=text,
            options=options
        )
    
    def _create_chunking_result(
        self,
        chunks: List[str],
        metadata: List,
        original_text: str,
        options: ChunkingOptions
    ) -> ChunkingResult:
        """
        Create a ChunkingResult.
        
        Args:
            chunks: List of chunks
            metadata: List of chunk metadata
            original_text: Original text
            options: Chunking options
            
        Returns:
            ChunkingResult
        """
        import time
        
        return ChunkingResult(
            chunks=chunks,
            chunk_metadata=metadata,
            original_length=len(original_text),
            detected_format=ContentFormat.JSON,
            token_estimation_strategy=options.token_strategy,
            chunking_strategy=self._get_chunking_strategy(),
            processing_time=time.time(),  # Will be adjusted by caller
            total_token_count=sum(md.token_count for md in metadata),
            operation_id=self.operation_id
        )
    
    @lru_cache(maxsize=1)
    def _get_chunking_strategy(self) -> ChunkingStrategy:
        """
        Get the chunking strategy this implementation represents.
        
        Returns:
            ChunkingStrategy enum value
        """
        return ChunkingStrategy.STRUCTURAL