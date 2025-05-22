"""
Markdown-specific chunking strategy implementation
"""

import re
import logging
import time
from typing import List, Dict, Any, Optional, Tuple

from enterprise_chunker.strategies.base import BaseChunkingStrategy
from enterprise_chunker.models.enums import ContentFormat, ChunkingStrategy
from enterprise_chunker.config import ChunkingOptions
from enterprise_chunker.utils.token_estimation import estimate_tokens
from enterprise_chunker.patterns.regex_patterns import RegexPatterns

# Configure logging
logger = logging.getLogger(__name__)


class MarkdownChunkingStrategy(BaseChunkingStrategy):
    """
    Strategy for chunking Markdown content with header/section awareness
    """
    
    def __init__(self):
        """Initialize the Markdown chunking strategy"""
        super().__init__(ContentFormat.MARKDOWN)
    
    def detect_boundaries(self, text: str, options: ChunkingOptions) -> List[Dict[str, Any]]:
        """
        Detect Markdown boundaries like headers, lists, and code blocks
        
        Args:
            text: Markdown text to analyze
            options: Chunking options
            
        Returns:
            List of boundary dictionaries
        """
        boundaries = []
        
        # Get Markdown patterns
        md_patterns = RegexPatterns.get_format_patterns(ContentFormat.MARKDOWN)
        
        # Pattern for Markdown headers (# Header, ## Header, etc.)
        for match in md_patterns['headers'].finditer(text):
            level = len(match.group(1))  # Number of # characters
            header_text = match.group(2)  # The header text
            boundaries.append({
                'index': match.start(),
                'end': match.end(),
                'text': match.group(0),
                'is_header': True,
                'level': level,
                'header_text': header_text
            })
        
        # Pattern for alt-style headers (underlined with === or ---)
        for match in md_patterns['alt_headers'].finditer(text):
            # Determine level: = is level 1, - is level 2
            level = 1 if '=' in match.group(2) else 2
            header_text = match.group(1)
            boundaries.append({
                'index': match.start(),
                'end': match.end(),
                'text': match.group(0),
                'is_header': True,
                'level': level,
                'header_text': header_text
            })
        
        # Add list items as boundaries (lower priority)
        for match in md_patterns['list_items'].finditer(text):
            boundaries.append({
                'index': match.start(),
                'end': match.end(),
                'text': match.group(0),
                'is_header': False,
                'is_list_item': True
            })
        
        # Add numbered list items
        for match in md_patterns['numbered_list'].finditer(text):
            boundaries.append({
                'index': match.start(),
                'end': match.end(),
                'text': match.group(0),
                'is_header': False,
                'is_list_item': True
            })
        
        # Add code blocks (important to preserve)
        for match in md_patterns['code_blocks'].finditer(text):
            boundaries.append({
                'index': match.start(),
                'end': match.end(),
                'text': match.group(0),
                'is_header': False,
                'is_code_block': True
            })
        
        # Add blockquotes
        for match in md_patterns['blockquotes'].finditer(text):
            boundaries.append({
                'index': match.start(),
                'end': match.end(),
                'text': match.group(0),
                'is_header': False,
                'is_blockquote': True
            })
        
        # Add horizontal rules
        for match in md_patterns['horizontal_rule'].finditer(text):
            boundaries.append({
                'index': match.start(),
                'end': match.end(),
                'text': match.group(0),
                'is_header': False,
                'is_hr': True
            })
        
        # Sort boundaries by position
        boundaries.sort(key=lambda x: x['index'])
        
        # Add a boundary at the beginning if none exists
        if not boundaries or boundaries[0]['index'] > 0:
            boundaries.insert(0, {
                'index': 0,
                'end': 0,
                'text': '',
                'is_header': False
            })
        
        return boundaries
    
    def _create_context_tracker(self) -> Optional[Dict[str, Any]]:
        """
        Create a context tracker for Markdown
        
        Returns:
            Context tracker dictionary
        """
        return {
            'headers': [],  # Stack of headers for hierarchy tracking
            'current_level': 0  # Current header level
        }
    
    def _update_context_tracker(self, context_tracker: Optional[Dict[str, Any]], boundary: Dict[str, Any]):
        """
        Update context tracker with information from current boundary
        
        Args:
            context_tracker: Context tracker to update
            boundary: Current boundary information
        """
        if not context_tracker:
            return
            
        # Update headers stack
        if boundary.get('is_header', False) and 'level' in boundary and 'header_text' in boundary:
            level = boundary['level']
            header_text = boundary['header_text']
            
            # Remove headers at same or lower level
            while (context_tracker['headers'] and 
                   context_tracker['headers'][-1]['level'] >= level):
                context_tracker['headers'].pop()
            
            # Add the current header
            context_tracker['headers'].append({
                'level': level,
                'text': header_text
            })
            
            # Update current level
            context_tracker['current_level'] = level
    
    def _get_preserved_context(self, context_tracker: Dict[str, Any]) -> str:
        """
        Get preserved context from context tracker for Markdown
        
        Args:
            context_tracker: Context tracker
            
        Returns:
            Markdown context string showing hierarchy
        """
        if not context_tracker or not context_tracker.get('headers'):
            return ""
        
        # Build a tree of headers to show context
        context_lines = []
        for i, header in enumerate(context_tracker['headers']):
            # Format each header with proper indent based on its level
            # Use markdown format with proper heading level
            context_lines.append(f"{'#' * header['level']} {header['text']}")
            
            # Add a blank line after each header except the last one
            if i < len(context_tracker['headers']) - 1:
                context_lines.append("")
                
        return "\n".join(context_lines)
    
    def _create_new_chunk_with_context(
        self,
        previous_chunk: str,
        context_tracker: Optional[Dict[str, Any]],
        overlap_chars: int,
        boundary: Dict[str, Any],
        options: ChunkingOptions
    ) -> str:
        """
        Create a new chunk with Markdown-specific context and overlap
        
        Args:
            previous_chunk: Previous chunk content
            context_tracker: Context tracker
            overlap_chars: Number of chars to overlap
            boundary: Current boundary information
            options: Chunking options
            
        Returns:
            New chunk text with context
        """
        # Start with context headers
        if context_tracker and context_tracker.get('headers'):
            preserved_context = self._get_preserved_context(context_tracker)
            chunk = f"<!-- Context from previous chunk -->\n{preserved_context}\n\n<!-- Current content -->\n"
        else:
            chunk = "<!-- Continued from previous chunk -->\n"
        
        # Add overlap if configured - for Markdown we want to be careful 
        # about not splitting in the middle of a structure
        if overlap_chars > 0 and len(previous_chunk) > overlap_chars:
            # Don't add overlap for header boundaries to avoid duplication
            if not boundary.get('is_header', False):
                overlap_content = previous_chunk[-overlap_chars:]
                
                # Try to find a clean paragraph break
                para_match = re.search(r'\n\s*\n', overlap_content)
                if para_match:
                    # Start from the paragraph break for cleaner context
                    overlap_content = overlap_content[para_match.end():]
                
                chunk += overlap_content
        
        return chunk
    
    def _add_metadata_comments(self, chunks: List[str], options: ChunkingOptions) -> List[str]:
        """
        Add Markdown-specific metadata comments to chunks
        
        Args:
            chunks: List of chunks to add metadata to
            options: Chunking options
            
        Returns:
            Chunks with metadata comments
        """
        if not chunks:
            return chunks
        
        total_chunks = len(chunks)
        return [
            f"<!-- MARKDOWN CHUNK {i+1}/{total_chunks} -->\n{chunk}"
            for i, chunk in enumerate(chunks)
        ]
    
    def _get_chunking_strategy(self) -> ChunkingStrategy:
        """
        Get the chunking strategy this implementation represents
        
        Returns:
            ChunkingStrategy enum value
        """
        return ChunkingStrategy.STRUCTURAL
