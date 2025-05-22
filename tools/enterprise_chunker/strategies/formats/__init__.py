"""
Package initialization for format-specific chunking strategies.

This module provides centralized access to all format-specific chunking strategies
in the enterprise_chunker framework. Each strategy is optimized for a particular
file format to ensure semantically appropriate chunking.
"""

from __future__ import annotations

# Import format-specific strategies for easier access
from enterprise_chunker.strategies.formats.json_chunker import JsonChunkingStrategy
from enterprise_chunker.strategies.formats.markdown_chunker import MarkdownChunkingStrategy
from enterprise_chunker.strategies.formats.react_vue_chunker import ReactVueChunkingStrategy
from enterprise_chunker.strategies.formats.smalltalk_chunker import SmalltalkChunkingStrategy, SmalltalkDialect

# Additional format-specific strategies would be imported here
# from enterprise_chunker.strategies.formats.xml_chunker import XmlChunkingStrategy
# from enterprise_chunker.strategies.formats.code_chunker import CodeChunkingStrategy
# from enterprise_chunker.strategies.formats.logs_chunker import LogsChunkingStrategy
# from enterprise_chunker.strategies.formats.csv_chunker import CsvChunkingStrategy

# List available strategies for introspection
__all__ = [
    "JsonChunkingStrategy",
    "MarkdownChunkingStrategy",
    "ReactVueChunkingStrategy", 
    "SmalltalkChunkingStrategy",
    "SmalltalkDialect",  # Also export the dialect enum
    # Commented out until these are implemented
    # "XmlChunkingStrategy",
    # "CodeChunkingStrategy",
    # "LogsChunkingStrategy",
    # "CsvChunkingStrategy",
]

# Pre-compile heavy regex patterns at module load time for better performance
# This ensures patterns are compiled only once, not on each class instantiation
ReactVueChunkingStrategy._init_patterns() if hasattr(ReactVueChunkingStrategy, '_init_patterns') else None
SmalltalkChunkingStrategy._init_patterns() if hasattr(SmalltalkChunkingStrategy, '_init_patterns') else None