"""
Fixed-size chunking strategy implementation.

This module provides an optimized chunking strategy that splits text into chunks
of approximately equal size while respecting natural text boundaries when possible.
The strategy aims to balance chunk size consistency with semantic coherence.

Usage:
    from enterprise_chunker.strategies.fixed_size import FixedSizeChunkingStrategy
    
    strategy = FixedSizeChunkingStrategy()
    result = strategy.chunk(text, options)
"""

import re
import math
import time
import logging
from functools import lru_cache
from typing import List, Dict, Any, Optional, Tuple, Set, ClassVar, cast

from enterprise_chunker.strategies.base import BaseChunkingStrategy
from enterprise_chunker.models.enums import ContentFormat, ChunkingStrategy
from enterprise_chunker.config import ChunkingOptions
from enterprise_chunker.exceptions import BoundaryDetectionError
from enterprise_chunker.utils.performance import timing_decorator

# Configure logging
logger = logging.getLogger(__name__)


class FixedSizeChunkingStrategy(BaseChunkingStrategy):
    """
    Fixed-size chunking strategy that splits text into chunks of approximately equal size.
    
    This strategy divides text into chunks with consistent token counts while attempting
    to preserve natural language boundaries (paragraphs, sentences, etc.) to maintain
    readability and coherence of content.
    
    Features:
        - Adaptive boundary detection based on text structure
        - Preservation of key context between chunks
        - Optimized search algorithms for natural boundaries
        - Configurable overlap between chunks
    """
    
    # Class constants for boundary priorities
    BOUNDARY_PRIORITY: ClassVar[Dict[str, int]] = {
        "paragraph": 10,
        "linebreak": 8,
        "sentence": 6,
        "clause": 4,
        "word": 2,
        "character": 0
    }
    
    # Patterns for boundary detection
    BOUNDARY_PATTERNS: ClassVar[Dict[str, re.Pattern]] = {
        "paragraph": re.compile(r'\n\s*\n'),
        "sentence": re.compile(r'[.!?][\s"\')\]]'),
        "clause": re.compile(r'[,;:][\s]'),
    }
    
    def __init__(self, format_type: ContentFormat = ContentFormat.TEXT):
        """
        Initialize the fixed-size chunking strategy.
        
        Args:
            format_type: Content format this strategy handles (defaults to TEXT)
        """
        super().__init__(format_type)
        self.boundary_stats: Dict[str, int] = {
            "paragraph": 0,
            "linebreak": 0,
            "sentence": 0,
            "clause": 0,
            "word": 0,
            "character": 0
        }
    
    @timing_decorator
    def detect_boundaries(self, text: str, options: ChunkingOptions) -> List[Dict[str, Any]]:
        """
        Create boundaries at regular intervals with adjustments for natural breaks.
        
        This method divides the text into chunks by:
        1. Calculating target position based on token estimate
        2. Finding natural boundaries near each target position
        3. Creating boundary markers with context information
        
        Args:
            text: Text to analyze and chunk
            options: Chunking configuration options
            
        Returns:
            List of boundary dictionaries with position and metadata
            
        Raises:
            BoundaryDetectionError: If boundary detection fails
        """
        try:
            # Reset boundary statistics
            self.boundary_stats = {key: 0 for key in self.boundary_stats}
            
            # Calculate approximate character length for the target token count
            chars_per_token = 4.0  # Conservative estimate
            target_chars = int(options.max_tokens_per_chunk * options.safety_margin * chars_per_token)
            
            boundaries = []
            
            # Always add a boundary at the start
            boundaries.append({
                'index': 0,
                'end': 0,
                'text': '',
                'type': 'start',
                'is_fixed_boundary': True
            })
            
            # If text is small enough, don't add more boundaries
            if len(text) <= target_chars:
                logger.debug(f"[{self.operation_id}] Text length ({len(text)}) <= target chunk size ({target_chars}), using single chunk")
                return boundaries
            
            # Calculate optimal chunk count based on text length
            optimal_chunks = max(2, math.ceil(len(text) / target_chars))
            logger.debug(f"[{self.operation_id}] Planning approximately {optimal_chunks} chunks of ~{target_chars} chars each")
            
            current_pos = 0
            chunk_number = 1
            
            while current_pos < len(text):
                # Calculate next target position
                next_pos = min(current_pos + target_chars, len(text))
                
                # If we're near the end, just use the end
                if next_pos >= len(text) - target_chars / 4:
                    break
                    
                # Find natural boundary near the target position
                boundary_pos, boundary_type = self._find_natural_boundary(text, next_pos, target_chars // 4)
                
                # Record the boundary type used for analytics
                self.boundary_stats[boundary_type] += 1
                
                # Add boundary with metadata
                boundaries.append({
                    'index': boundary_pos,
                    'end': boundary_pos,
                    'text': text[boundary_pos:min(boundary_pos + 20, len(text))].replace('\n', '\\n'),
                    'type': boundary_type,
                    'chunk_number': chunk_number,
                    'is_fixed_boundary': True
                })
                
                # Move to the next position
                current_pos = boundary_pos
                chunk_number += 1
            
            # Log boundary selection statistics
            self._log_boundary_stats(len(boundaries) - 1)  # Subtract 1 for start boundary
            
            return boundaries
            
        except Exception as e:
            logger.error(f"[{self.operation_id}] Boundary detection failed: {str(e)}", exc_info=True)
            raise BoundaryDetectionError(f"Failed to detect fixed-size boundaries: {str(e)}") from e
    
    def _find_natural_boundary(self, text: str, target_pos: int, search_range: int) -> Tuple[int, str]:
        """
        Find a natural boundary near the target position using efficient string operations.
        
        This method searches for the most natural text boundary (paragraph, sentence, etc.)
        within the specified range of the target position, prioritizing boundaries that
        would create more coherent chunks.
        
        Args:
            text: Text to analyze
            target_pos: Target position for the boundary
            search_range: Range to search around the target position
            
        Returns:
            Tuple of (position of the natural boundary, boundary type)
        """
        # Define the search range
        start = max(0, target_pos - search_range)
        end = min(len(text), target_pos + search_range)
        search_text = text[start:end]
        
        # Look for paragraph breaks (highest priority)
        para_pos = search_text.rfind('\n\n', 0, target_pos - start)
        if para_pos != -1:
            return start + para_pos + 2, "paragraph"  # Include both newlines
            
        para_pos = search_text.find('\n\n', target_pos - start)
        if para_pos != -1:
            return start + para_pos + 2, "paragraph"
            
        # Look for single line breaks
        nl_pos = search_text.rfind('\n', 0, target_pos - start)
        if nl_pos != -1:
            return start + nl_pos + 1, "linebreak"
            
        nl_pos = search_text.find('\n', target_pos - start)
        if nl_pos != -1:
            return start + nl_pos + 1, "linebreak"
            
        # Look for sentence endings
        sentence_matches = list(re.finditer(r'[.!?][\s"\')\]]', search_text))
        if sentence_matches:
            # Find closest sentence boundary to target position
            closest_match = min(sentence_matches, 
                               key=lambda m: abs((start + m.start()) - target_pos))
            return start + closest_match.start() + 1, "sentence"
            
        # Look for clause boundaries (commas, etc.)
        clause_matches = list(re.finditer(r'[,;:][\s]', search_text))
        if clause_matches:
            closest_match = min(clause_matches, 
                               key=lambda m: abs((start + m.start()) - target_pos))
            return start + closest_match.start() + 1, "clause"
            
        # Look for word boundaries (spaces) - use rfind/find for efficiency
        space_pos = search_text.rfind(' ', 0, target_pos - start)
        if space_pos != -1:
            return start + space_pos + 1, "word"
            
        space_pos = search_text.find(' ', target_pos - start)
        if space_pos != -1:
            return start + space_pos + 1, "word"
            
        # If no natural boundary found, use the target position
        return target_pos, "character"
    
    def _log_boundary_stats(self, total_boundaries: int) -> None:
        """
        Log statistics about boundary types selected during chunking.
        
        Args:
            total_boundaries: Total number of boundaries created
        """
        if total_boundaries == 0:
            return
            
        stats_message = f"[{self.operation_id}] Boundary selection stats: "
        parts = []
        
        for boundary_type, count in sorted(
            self.boundary_stats.items(), 
            key=lambda x: self.BOUNDARY_PRIORITY.get(x[0], 0), 
            reverse=True
        ):
            if count > 0:
                percentage = (count / total_boundaries) * 100
                parts.append(f"{boundary_type}={count} ({percentage:.1f}%)")
                
        stats_message += ", ".join(parts)
        logger.debug(stats_message)
    
    def _create_context_tracker(self) -> Optional[Dict[str, Any]]:
        """
        Create a context tracker for fixed-size chunking.
        
        Returns:
            Context tracker dictionary with initial values
        """
        return {
            'last_split_position': 0, 
            'chunk_number': 0,
            'boundary_types': [],
            'last_chunk_text': '',
            'chunk_sizes': []
        }
    
    def _update_context_tracker(self, context_tracker: Optional[Dict[str, Any]], boundary: Dict[str, Any]) -> None:
        """
        Update context tracker with information from current boundary.
        
        Args:
            context_tracker: Context tracker to update
            boundary: Current boundary information
        """
        if not context_tracker:
            return
            
        context_tracker['last_split_position'] = boundary['index']
        context_tracker['chunk_number'] += 1
        
        if 'type' in boundary:
            context_tracker['boundary_types'].append(boundary['type'])
    
    def _get_preserved_context(self, context_tracker: Dict[str, Any]) -> str:
        """
        Get preserved context from context tracker.
        
        Args:
            context_tracker: Context tracker
            
        Returns:
            Preserved context string with continuation information
        """
        if not context_tracker:
            return ""
            
        chunk_num = context_tracker.get('chunk_number', 0)
        if chunk_num <= 0:
            return ""
            
        # Create informative continuation message
        boundary_types = context_tracker.get('boundary_types', [])
        if boundary_types and len(boundary_types) >= chunk_num:
            boundary_type = boundary_types[-1]
            return f"[Continued from chunk {chunk_num} at {boundary_type} boundary]"
        else:
            return f"[Continued from chunk {chunk_num}]"
    
    def _create_new_chunk_with_context(
        self,
        previous_chunk: str,
        context_tracker: Optional[Dict[str, Any]],
        overlap_chars: int,
        boundary: Dict[str, Any],
        options: ChunkingOptions
    ) -> str:
        """
        Create a new chunk with context and optimized overlap.
        
        This method intelligently selects overlap content based on natural
        language boundaries to maintain coherence between chunks.
        
        Args:
            previous_chunk: Previous chunk content
            context_tracker: Context tracker
            overlap_chars: Number of chars to overlap
            boundary: Current boundary information
            options: Chunking options
            
        Returns:
            New chunk text with context
        """
        chunk = ""
        
        # Add context comment
        chunk_num = context_tracker.get('chunk_number', 0) if context_tracker else 0
        boundary_type = boundary.get('type', 'unknown')
        
        # Create more informative continuation header
        chunk += f"/* Continued from chunk {chunk_num}"
        if boundary_type != 'unknown':
            chunk += f" (split at {boundary_type})"
        chunk += " */\n"
        
        # Add overlap content if configured
        if overlap_chars > 0 and len(previous_chunk) > overlap_chars:
            # Look for a natural boundary within the overlap section
            overlap_text = previous_chunk[-overlap_chars:]
            
            # Try to find an optimal starting point in the overlap
            overlap_start = 0
            
            # Try to find a paragraph break
            para_match = self.BOUNDARY_PATTERNS["paragraph"].search(overlap_text)
            if para_match:
                # Found paragraph break, use text after it
                overlap_start = para_match.end()
                chunk += overlap_text[overlap_start:]
            else:
                # No paragraph break, try sentence boundary
                sentence_match = self.BOUNDARY_PATTERNS["sentence"].search(overlap_text)
                if sentence_match:
                    # Found sentence break, use text after it
                    overlap_start = sentence_match.end()
                    chunk += overlap_text[overlap_start:]
                else:
                    # Try clause boundary
                    clause_match = self.BOUNDARY_PATTERNS["clause"].search(overlap_text)
                    if clause_match:
                        overlap_start = clause_match.end()
                        chunk += overlap_text[overlap_start:]
                    else:
                        # No natural boundary, search for word boundary
                        space_pos = overlap_text.find(' ', len(overlap_text) // 2)
                        if space_pos != -1:
                            chunk += overlap_text[space_pos+1:]
                        else:
                            # No good boundaries found, use the whole overlap
                            chunk += overlap_text
        
        return chunk
    
    @lru_cache(maxsize=1)
    def _get_chunking_strategy(self) -> ChunkingStrategy:
        """
        Get the chunking strategy this implementation represents.
        
        Returns:
            ChunkingStrategy.FIXED_SIZE enum value
        """
        return ChunkingStrategy.FIXED_SIZE
    
    def get_strategy_statistics(self) -> Dict[str, Any]:
        """
        Get statistics about the chunking process.
        
        Returns:
            Dictionary with statistics about boundary selection and chunking
        """
        return {
            "boundary_stats": self.boundary_stats,
            "processing_times": self.stats,
            "operation_id": self.operation_id
        }