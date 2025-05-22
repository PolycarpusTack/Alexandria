"""
Package initialization for chunking strategies
"""

# Import strategies for easier access
from enterprise_chunker.strategies.base import BaseChunkingStrategy
from enterprise_chunker.strategies.semantic import SemanticChunkingStrategy
from enterprise_chunker.strategies.fixed_size import FixedSizeChunkingStrategy

# List available strategies for introspection
__all__ = [
    "BaseChunkingStrategy",
    "SemanticChunkingStrategy",
    "FixedSizeChunkingStrategy",
]