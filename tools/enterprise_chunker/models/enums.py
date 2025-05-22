"""
Enum definitions for the EnterpriseChunker
"""

from enum import Enum


class ChunkingStrategy(Enum):
    """Strategies for chunking text content"""
    SEMANTIC = "semantic"  # Preserve semantic boundaries (paragraphs, sections)
    STRUCTURAL = "structural"  # Preserve structural elements (XML/HTML tags, code blocks)
    FIXED_SIZE = "fixed_size"  # Simple fixed-size chunks with overlap
    SENTENCE = "sentence"  # Split by sentences
    ADAPTIVE = "adaptive"  # Dynamically choose best strategy based on content


class TokenEstimationStrategy(Enum):
    """Strategies for token estimation"""
    PRECISION = "precision"  # More accurate but slower
    PERFORMANCE = "performance"  # Faster but less accurate
    BALANCED = "balanced"  # Compromise between accuracy and speed


class ContentFormat(Enum):
    """Types of content formats recognized by the chunker"""
    JSON = "json"
    XML = "xml"
    MARKDOWN = "markdown"
    CODE = "code"
    LOGS = "logs"
    CSV = "csv"
    TEXT = "text"
    UNKNOWN = "unknown"
