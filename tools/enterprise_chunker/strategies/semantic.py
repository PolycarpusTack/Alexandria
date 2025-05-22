"""
Semantic chunking strategy implementation.

This module provides an enterprise-grade implementation of the semantic chunking strategy,
which intelligently divides text based on natural language and structural boundaries
to preserve meaning and context across chunks.

Usage:
    from enterprise_chunker.strategies.semantic import SemanticChunkingStrategy
    
    strategy = SemanticChunkingStrategy()
    result = strategy.chunk(text, options)
"""

import re
import math
import time
import logging
import heapq
from functools import lru_cache
from typing import List, Dict, Any, Optional, Tuple, Iterator, Set, ClassVar, cast
from datetime import datetime

from enterprise_chunker.strategies.base import BaseChunkingStrategy
from enterprise_chunker.models.enums import ContentFormat, ChunkingStrategy
from enterprise_chunker.config import ChunkingOptions
from enterprise_chunker.patterns.regex_patterns import RegexPatterns
from enterprise_chunker.exceptions import BoundaryDetectionError
from enterprise_chunker.utils.performance import timing_decorator

# Configure logging
logger = logging.getLogger(__name__)

# Constants
MAX_BOUNDARIES = 20000  # Hard limit on number of boundaries to prevent quadratic processing
BOUNDARY_SAMPLE_THRESHOLD = 100000  # Text size threshold for boundary sampling
BOUNDARY_SAMPLING_RATE = 0.25  # Sampling rate for large texts


class SemanticChunkingStrategy(BaseChunkingStrategy):
    """
    Semantic chunking strategy that preserves natural language boundaries.
    
    This strategy identifies meaningful sections, paragraphs, and linguistic structures
    in text to create chunks that maintain semantic coherence and context. The algorithm
    prioritizes preserving natural boundaries like headings, paragraphs, and complete sentences.
    
    Features:
        - Intelligent section and subsection detection
        - Context preservation between chunks
        - Format-aware boundary detection
        - Performance optimizations for large documents
        - Configurable boundary prioritization
    """
    
    # Boundary priority tiers for ranking
    BOUNDARY_PRIORITY: ClassVar[Dict[str, int]] = {
        "heading1": 100,
        "heading2": 90,
        "heading3": 80,
        "section_marker": 70,
        "paragraph": 60,
        "list_item": 50,
        "code_block": 40,
        "sentence": 30,
        "log_entry": 20,
        "fallback": 10
    }
    
    def __init__(self, format_type: ContentFormat = ContentFormat.TEXT):
        """
        Initialize the semantic chunking strategy.
        
        Args:
            format_type: Content format this strategy handles (defaults to TEXT)
        """
        super().__init__(format_type)
        self.boundary_stats: Dict[str, int] = {}
        self.section_hierarchy: List[Dict[str, Any]] = []
    
    @timing_decorator
    def detect_boundaries(self, text: str, options: ChunkingOptions) -> List[Dict[str, Any]]:
        """
        Detect semantic boundaries in text based on content structure and natural language patterns.
        
        This method analyzes text to identify meaningful boundaries such as section headings,
        paragraphs, and sentence breaks, optimized to handle enterprise-scale content.
        
        Args:
            text: Text to analyze
            options: Chunking options
            
        Returns:
            List of boundary dictionaries with position and metadata
            
        Raises:
            BoundaryDetectionError: If boundary detection fails
        """
        logger.info(f"[{self.operation_id}] Starting semantic boundary detection for {len(text):,} chars")
        start_time = time.time()
        
        try:
            # Reset statistics
            self.boundary_stats = {}
            
            # Get appropriate pattern sets based on format
            section_patterns = self._get_section_patterns()
            
            # Initialize boundary collector
            all_boundaries = []
            
            # Determine if we need sampling for very large texts
            use_sampling = len(text) > BOUNDARY_SAMPLE_THRESHOLD
            if use_sampling:
                logger.info(
                    f"[{self.operation_id}] Large text detected ({len(text):,} chars), "
                    f"using boundary sampling at {BOUNDARY_SAMPLING_RATE:.2f} rate"
                )
            
            # Apply all boundary patterns to find potential split points
            for pattern_idx, pattern in enumerate(section_patterns):
                pattern_type = self._get_pattern_type(pattern_idx)
                priority = self._get_boundary_priority(pattern_type)
                
                try:
                    # Count matches for this pattern
                    matches_count = 0
                    
                    # Use iterator to avoid loading all matches at once
                    for match in pattern.finditer(text):
                        matches_count += 1
                        
                        # Apply sampling for very large texts if needed
                        if use_sampling and pattern_type not in ("heading1", "heading2", "heading3"):
                            if matches_count % int(1/BOUNDARY_SAMPLING_RATE) != 0:
                                continue
                        
                        # Extract boundary information
                        boundary = {
                            'index': match.start(),
                            'end': match.end(),
                            'text': match.group(0),
                            'is_section_break': priority >= self.BOUNDARY_PRIORITY["paragraph"],
                            'pattern_type': pattern_type,
                            'priority': priority
                        }
                        
                        all_boundaries.append(boundary)
                        
                        # Track boundary type statistics
                        self.boundary_stats[pattern_type] = self.boundary_stats.get(pattern_type, 0) + 1
                        
                        # Hard limit on number of boundaries to prevent quadratic processing
                        if len(all_boundaries) >= MAX_BOUNDARIES:
                            logger.warning(
                                f"[{self.operation_id}] Reached maximum boundary limit ({MAX_BOUNDARIES}), "
                                f"truncating additional boundaries"
                            )
                            break
                    
                except Exception as e:
                    logger.warning(
                        f"[{self.operation_id}] Error applying pattern {pattern_type}: {str(e)}", 
                        exc_info=True
                    )
                
                # If we've hit the boundary limit, stop processing patterns
                if len(all_boundaries) >= MAX_BOUNDARIES:
                    break
            
            # Check if we need fallback strategies
            self._apply_fallback_strategies(text, options, all_boundaries)
            
            # Ensure we haven't exceeded the maximum boundary count
            if len(all_boundaries) > MAX_BOUNDARIES:
                logger.warning(
                    f"[{self.operation_id}] Too many boundaries ({len(all_boundaries)}), "
                    f"selecting top {MAX_BOUNDARIES} by priority"
                )
                # Keep only the highest priority boundaries based on their priority score
                all_boundaries = self._select_best_boundaries(all_boundaries, MAX_BOUNDARIES)
            
            # Sort boundaries by position
            all_boundaries.sort(key=lambda x: x['index'])
            
            # Add a boundary at the beginning if none exists
            if not all_boundaries or all_boundaries[0]['index'] > 0:
                all_boundaries.insert(0, {
                    'index': 0,
                    'end': 0,
                    'text': '',
                    'is_section_break': False,
                    'pattern_type': 'document_start',
                    'priority': 0
                })
            
            # Log boundary statistics
            detection_time = time.time() - start_time
            logger.info(
                f"[{self.operation_id}] Detected {len(all_boundaries):,} boundaries "
                f"in {detection_time:.3f}s ({len(text) / detection_time:.1f} chars/s)"
            )
            self._log_boundary_stats()
            
            return all_boundaries
            
        except Exception as e:
            logger.error(f"[{self.operation_id}] Boundary detection failed: {str(e)}", exc_info=True)
            raise BoundaryDetectionError(f"Failed to detect semantic boundaries: {str(e)}") from e
    
    def _select_best_boundaries(self, boundaries: List[Dict[str, Any]], max_count: int) -> List[Dict[str, Any]]:
        """
        Select the best boundaries when there are too many.
        
        This method uses a combination of priority scoring and position distribution
        to select the most important boundaries while maintaining coverage.
        
        Args:
            boundaries: List of all detected boundaries
            max_count: Maximum number of boundaries to keep
            
        Returns:
            Filtered list of boundaries
        """
        if len(boundaries) <= max_count:
            return boundaries
            
        # First, always include section-level boundaries (headings, etc.)
        high_priority_boundaries = [
            b for b in boundaries 
            if b.get('priority', 0) >= self.BOUNDARY_PRIORITY["paragraph"]
        ]
        
        # If we still have space, select evenly distributed boundaries from the remainder
        if len(high_priority_boundaries) < max_count:
            remaining_boundaries = [
                b for b in boundaries 
                if b.get('priority', 0) < self.BOUNDARY_PRIORITY["paragraph"]
            ]
            
            # Sort remaining by priority
            remaining_boundaries.sort(key=lambda x: x.get('priority', 0), reverse=True)
            
            # Select top boundaries up to a percentage of remaining slots
            top_remaining_count = min(
                len(remaining_boundaries),
                int((max_count - len(high_priority_boundaries)) * 0.7)
            )
            selected_remaining = remaining_boundaries[:top_remaining_count]
            
            # For the rest, sample evenly across the document
            if top_remaining_count < len(remaining_boundaries):
                remaining_slots = max_count - len(high_priority_boundaries) - top_remaining_count
                if remaining_slots > 0 and len(remaining_boundaries) > top_remaining_count:
                    step = (len(remaining_boundaries) - top_remaining_count) // remaining_slots
                    if step > 0:
                        for i in range(top_remaining_count, len(remaining_boundaries), step):
                            if len(selected_remaining) < (max_count - len(high_priority_boundaries)):
                                selected_remaining.append(remaining_boundaries[i])
            
            # Combine high priority with selected remaining
            result = high_priority_boundaries + selected_remaining
            
            # Sort by position
            result.sort(key=lambda x: x['index'])
            return result
        else:
            # If we have too many high-priority boundaries, select based on priority and position
            high_priority_boundaries.sort(
                key=lambda x: (x.get('priority', 0), -x['index']), 
                reverse=True
            )
            return high_priority_boundaries[:max_count]
    
    def _apply_fallback_strategies(
        self, 
        text: str, 
        options: ChunkingOptions, 
        boundaries: List[Dict[str, Any]]
    ) -> None:
        """
        Apply fallback boundary detection strategies when primary strategies yield few results.
        
        Args:
            text: Source text
            options: Chunking options
            boundaries: List of boundaries to append to
        """
        # If few boundaries found, try paragraph detection
        if len(boundaries) < 3 and len(text) > 1000:
            logger.debug(f"[{self.operation_id}] Few boundaries detected, applying paragraph fallback")
            
            paragraph_pattern = re.compile(r'\n\s*\n')
            matches_count = 0
            
            for match in paragraph_pattern.finditer(text):
                matches_count += 1
                
                # Apply sampling for large texts
                if len(text) > BOUNDARY_SAMPLE_THRESHOLD and matches_count % 4 != 0:
                    continue
                    
                boundaries.append({
                    'index': match.end(),  # Use end so we start with the new paragraph
                    'end': match.end(),
                    'text': match.group(0),
                    'is_section_break': True,
                    'pattern_type': 'paragraph',
                    'priority': self.BOUNDARY_PRIORITY["paragraph"]
                })
                
                # Track statistics
                self.boundary_stats['paragraph'] = self.boundary_stats.get('paragraph', 0) + 1
                
                if len(boundaries) >= MAX_BOUNDARIES:
                    break
        
        # If still few boundaries, add sentence boundaries if configured
        if len(boundaries) < 5 and options.respect_sentences and len(text) > 500:
            logger.debug(f"[{self.operation_id}] Few boundaries detected, applying sentence fallback")
            
            sentence_pattern = RegexPatterns.get_sentence_boundaries()
            matches_count = 0
            
            for match in sentence_pattern.finditer(text):
                matches_count += 1
                
                # Apply higher sampling rate for sentences
                if len(text) > BOUNDARY_SAMPLE_THRESHOLD and matches_count % 10 != 0:
                    continue
                    
                boundaries.append({
                    'index': match.end(),
                    'end': match.end(),
                    'text': match.group(0),
                    'is_section_break': False,
                    'pattern_type': 'sentence',
                    'priority': self.BOUNDARY_PRIORITY["sentence"]
                })
                
                # Track statistics
                self.boundary_stats['sentence'] = self.boundary_stats.get('sentence', 0) + 1
                
                if len(boundaries) >= MAX_BOUNDARIES:
                    break
    
    def _log_boundary_stats(self) -> None:
        """
        Log statistics about boundary types detected during chunking.
        """
        if not self.boundary_stats:
            return
            
        # Sort by count
        sorted_stats = sorted(
            self.boundary_stats.items(), 
            key=lambda x: x[1], 
            reverse=True
        )
        
        stats_message = f"[{self.operation_id}] Boundary types: " + ", ".join(
            f"{btype}={count}" for btype, count in sorted_stats
        )
        
        logger.debug(stats_message)
    
    def _create_context_tracker(self) -> Optional[Dict[str, Any]]:
        """
        Create a context tracker for semantic chunking.
        
        The context tracker maintains hierarchical section information
        to preserve context between chunks.
        
        Returns:
            Context tracker dictionary
        """
        return {
            'sections': [],
            'section_levels': {},
            'last_boundary_type': None,
            'current_section': None,
            'section_counters': {}
        }
    
    def _update_context_tracker(self, context_tracker: Optional[Dict[str, Any]], boundary: Dict[str, Any]) -> None:
        """
        Update context tracker with information from current boundary.
        
        This method maintains a hierarchical record of document sections
        to provide accurate context in subsequent chunks.
        
        Args:
            context_tracker: Context tracker to update
            boundary: Current boundary information
        """
        if not context_tracker:
            return
            
        # Extract boundary type
        boundary_type = boundary.get('pattern_type', '')
        
        # Update last boundary type
        context_tracker['last_boundary_type'] = boundary_type
        
        # Check if this is a section break
        if boundary.get('is_section_break', False):
            # Extract any section title from the text
            section_title = self._extract_section_title(boundary.get('text', ''), boundary_type)
            if section_title:
                # Determine section level
                level = self._get_section_level(boundary_type)
                
                # Track in counters
                counter_key = f"level_{level}"
                context_tracker['section_counters'][counter_key] = context_tracker['section_counters'].get(counter_key, 0) + 1
                
                # Create section entry with level information
                section_entry = {
                    'title': section_title,
                    'level': level,
                    'type': boundary_type,
                    'number': context_tracker['section_counters'].get(counter_key, 1)
                }
                
                # Add to sections list
                context_tracker['sections'].append(section_entry)
                
                # Update current section
                context_tracker['current_section'] = section_entry
                
                # Update section levels mapping
                context_tracker['section_levels'][level] = section_title
                
                # Clear lower levels when a higher-level section is encountered
                if level < 3:  # if this is a high-level section
                    levels_to_clear = [l for l in context_tracker['section_levels'] if l > level]
                    for l in levels_to_clear:
                        context_tracker['section_levels'].pop(l, None)
    
    def _get_section_level(self, boundary_type: str) -> int:
        """
        Determine section level based on boundary type.
        
        Args:
            boundary_type: Type of boundary
            
        Returns:
            Numeric section level (1=highest)
        """
        level_map = {
            'heading1': 1,
            'heading2': 2,
            'heading3': 3,
            'section_marker': 2,
            'paragraph': 4,
            'list_item': 5,
            'code_block': 4,
            'sentence': 6
        }
        return level_map.get(boundary_type, 5)
    
    def _get_preserved_context(self, context_tracker: Dict[str, Any]) -> str:
        """
        Get preserved context from context tracker.
        
        This method generates a hierarchical context summary based on
        the document's section structure.
        
        Args:
            context_tracker: Context tracker
            
        Returns:
            Preserved context string
        """
        # Return the section hierarchy for context
        if not context_tracker or not context_tracker.get('sections'):
            return ""
            
        # Get section levels dictionary
        section_levels = context_tracker.get('section_levels', {})
        if not section_levels:
            return ""
            
        # Build hierarchical context
        context_lines = ["Document context:"]
        
        # Add major sections first
        for level in sorted(section_levels.keys()):
            title = section_levels[level]
            indentation = "  " * (level - 1)
            context_lines.append(f"{indentation}- {title}")
            
        # Limit context size
        if len(context_lines) > 7:
            context_lines = context_lines[:2] + ["  ..."] + context_lines[-4:]
            
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
        Create a new chunk with semantic context and intelligent overlap.
        
        This method generates contextual information about the document structure
        and ensures proper content continuity between chunks.
        
        Args:
            previous_chunk: Previous chunk content
            context_tracker: Context tracker
            overlap_chars: Number of chars to overlap
            boundary: Current boundary information
            options: Chunking options
            
        Returns:
            New chunk text with context
        """
        # Initialize chunk with continuation marker
        if context_tracker and 'current_section' in context_tracker and context_tracker['current_section']:
            current_section = context_tracker['current_section']
            chunk = f"/* Continued in section: {current_section['title']} */\n"
        else:
            chunk = "/* Continued from previous section */\n"
        
        # Add hierarchical context if available
        if context_tracker:
            preserved_context = self._get_preserved_context(context_tracker)
            if preserved_context:
                chunk += f"{preserved_context}\n\n"
        
        # Add overlap if configured, with intelligent boundary detection
        if overlap_chars > 0 and len(previous_chunk) > overlap_chars:
            overlap_text = previous_chunk[-overlap_chars:]
            
            # Look for natural boundary in the overlap text
            paragraph_break = overlap_text.rfind("\n\n")
            if paragraph_break != -1 and paragraph_break > overlap_chars * 0.2:
                # Found good paragraph break
                chunk += overlap_text[paragraph_break+2:]
            else:
                # Look for sentence boundary
                sentence_break = re.search(r'(?<=[.!?])\s+(?=[A-Z])', overlap_text)
                if sentence_break and sentence_break.start() > overlap_chars * 0.3:
                    chunk += overlap_text[sentence_break.end():]
                else:
                    # Fall back to using the entire overlap
                    chunk += overlap_text
                    
        # Add appropriate separator based on boundary type
        boundary_type = boundary.get('pattern_type', '')
        if boundary_type in ('heading1', 'heading2', 'heading3'):
            chunk += "\n"  # Add extra space before headings
            
        return chunk
    
    def _extract_section_title(self, text: str, boundary_type: str) -> str:
        """
        Extract a section title from boundary text with type-specific handling.
        
        Args:
            text: Boundary text
            boundary_type: Type of boundary
            
        Returns:
            Extracted section title or empty string
        """
        # Skip empty text
        if not text or not text.strip():
            return ""
            
        # Handle based on boundary type
        if boundary_type.startswith('heading'):
            # If it's a heading, extract the heading text
            heading_match = re.match(r'^#+\s+(.+)', text.strip())
            if heading_match:
                return heading_match.group(1)
            
            # If it's a line followed by === or ---, it's a setext heading
            setext_match = re.match(r'^([^\n]+)\n[=\-]+', text.strip())
            if setext_match:
                return setext_match.group(1)
            
            # If it's an HTML heading
            html_match = re.match(r'<h[1-6]>(.*?)<\/h[1-6]>', text.strip())
            if html_match:
                return html_match.group(1)
                
        elif boundary_type == 'section_marker':
            # For section markers like [Section] in INI files
            ini_match = re.match(r'\[([^\]]+)\]', text.strip())
            if ini_match:
                return ini_match.group(1)
                
        elif boundary_type in ('log_entry', 'exception'):
            # For log entries, use timestamp or log level if present
            log_match = re.match(r'^\[?(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2})', text.strip())
            if log_match:
                return f"Log entry {log_match.group(1)}"
                
            level_match = re.match(r'^(ERROR|WARN(?:ING)?|INFO|DEBUG|TRACE|FATAL|CRITICAL|NOTICE|SEVERE)', text.strip())
            if level_match:
                return f"{level_match.group(1)} message"
                
        # Default: extract first line with length limit
        lines = text.strip().split('\n')
        if lines and lines[0].strip():
            # Limit title length
            title = lines[0].strip()
            if len(title) > 60:
                title = title[:57] + "..."
            return title
        
        return ""
    
    def _get_pattern_type(self, pattern_index: int) -> str:
        """
        Map pattern index to semantic type name.
        
        Args:
            pattern_index: Index of the pattern in the pattern list
            
        Returns:
            String type name for the pattern
        """
        # Pattern index to type mapping for standard semantic patterns
        pattern_types = [
            # Headers (0-5)
            "heading1", "heading2", "heading3", "heading1", "heading2", "heading3", 
            # Log patterns (6-9)
            "log_entry", "log_entry", "log_entry", "log_entry",
            # Log levels (10-11)
            "log_entry", "log_entry",
            # Exceptions (12-14)
            "exception", "exception", "exception",
            # Process info (15-17)
            "log_entry", "log_entry", "log_entry",
            # Code structure (18-19)
            "code_block", "code_block",
            # Configuration (20-21)
            "section_marker", "section_marker",
            # Paragraphs (22)
            "paragraph",
            # Special content (23-24)
            "section_marker", "section_marker"
        ]
        
        if pattern_index < len(pattern_types):
            return pattern_types[pattern_index]
        else:
            return "fallback"
    
    def _get_boundary_priority(self, pattern_type: str) -> int:
        """
        Get priority score for a boundary type.
        
        Args:
            pattern_type: Type of pattern/boundary
            
        Returns:
            Numeric priority score (higher = more important)
        """
        return self.BOUNDARY_PRIORITY.get(pattern_type, self.BOUNDARY_PRIORITY["fallback"])
    
    @lru_cache(maxsize=1)
    def _get_section_patterns(self) -> List[re.Pattern]:
        """
        Get regex patterns for identifying section boundaries.
        
        Returns:
            List of compiled regex patterns
        """
        return [
            # Markdown/text headings (0-5)
            re.compile(r'^#\s+.+$', re.MULTILINE),  # h1
            re.compile(r'^##\s+.+$', re.MULTILINE),  # h2
            re.compile(r'^###\s+.+$', re.MULTILINE),  # h3
            re.compile(r'^#{4,6}\s+.+$', re.MULTILINE),  # h4-h6
            re.compile(r'^[^\n]+\n=+\s*$', re.MULTILINE),  # Setext h1
            re.compile(r'^[^\n]+\n-+\s*$', re.MULTILINE),  # Setext h2
            
            # Log patterns (6-9)
            re.compile(r'^\[\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?\]', re.MULTILINE),  # ISO timestamps with brackets
            re.compile(r'^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?', re.MULTILINE),  # ISO timestamps without brackets
            re.compile(r'^\d{1,2}\/\d{1,2}\/\d{2,4}\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s+[AP]M)?', re.MULTILINE),  # US date format
            re.compile(r'^[A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}', re.MULTILINE),  # Unix log format (Jan 15 14:23:01)
            
            # Log levels (10-11)
            re.compile(r'^(?:ERROR|WARN(?:ING)?|INFO|DEBUG|TRACE|FATAL|CRITICAL|NOTICE|SEVERE)\b', re.MULTILINE | re.IGNORECASE),
            re.compile(r'^(?:E|W|I|D|T|F|C|N|S)\/[\w.]+\(\s*\d+\):', re.MULTILINE),  # Android log format
            
            # Exception and stacktrace indicators (12-14)
            re.compile(r'^(?:Exception|Error|Traceback|Caused by|at)\s+[\w.$]+(?:[:]\s|[:]\s+\w+|\s+[\w.(]+\()', re.MULTILINE),
            re.compile(r'^\s+at\s+[\w.$]+(?:\.[\w.$]+)+\([^)]*\)$', re.MULTILINE),  # Java/JS stack trace
            re.compile(r'^\s+File ".*", line \d+', re.MULTILINE),  # Python stack trace
            
            # Process and thread indicators (15-17)
            re.compile(r'^Process ID:?\s+\d+', re.MULTILINE),
            re.compile(r'^Thread(?: ID)?:?\s+\d+', re.MULTILINE),
            re.compile(r'^pid=\d+\s+tid=\d+', re.MULTILINE),
            
            # Code structure (18-19)
            re.compile(r'^(?:function|class|def|public|private|protected|internal|static|async|export|import)\s+[\w<>]+', re.MULTILINE),
            re.compile(r'^(?:\s*if|\s*for|\s*while|\s*switch|\s*try|\s*catch|\s*finally)\s*\(', re.MULTILINE),
            
            # Configuration sections (20-21)
            re.compile(r'^\s*\[[^\]]+\]\s*$', re.MULTILINE),  # INI section header [section]
            re.compile(r'^---\s*$', re.MULTILINE),  # YAML document separator
            
            # Natural language paragraph boundaries (22)
            re.compile(r'\n\s*\n', re.MULTILINE),  # Empty line (paragraph break)
            
            # Special structured content (23-24)
            re.compile(r'^-{3,}BEGIN [A-Z]+-{3,}$', re.MULTILINE),  # BEGIN CERTIFICATE or similar
            re.compile(r'^-{3,}END [A-Z]+-{3,}$', re.MULTILINE)  # END CERTIFICATE or similar
        ]
    
    @lru_cache(maxsize=1)
    def _get_chunking_strategy(self) -> ChunkingStrategy:
        """
        Get the chunking strategy this implementation represents.
        
        Returns:
            ChunkingStrategy enum value
        """
        return ChunkingStrategy.SEMANTIC
    
    def get_strategy_statistics(self) -> Dict[str, Any]:
        """
        Get statistics about the semantic chunking process.
        
        Returns:
            Dictionary with statistics about boundary detection and sectioning
        """
        return {
            "boundary_stats": self.boundary_stats,
            "processing_times": self.stats,
            "operation_id": self.operation_id
        }