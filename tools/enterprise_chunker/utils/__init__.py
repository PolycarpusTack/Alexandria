"""
Package initialization for utility modules
"""

# Import utility modules for easier access
from enterprise_chunker.utils.token_estimation import estimate_tokens
from enterprise_chunker.utils.format_detection import detect_content_format
from enterprise_chunker.utils.memory_optimization import MemoryManager, MemoryMonitor
from enterprise_chunker.utils.optimized_streaming import StreamingBuffer, ChunkProcessor

# List available utility functions for introspection
__all__ = [
    "estimate_tokens",
    "detect_content_format",
    "MemoryManager",
    "MemoryMonitor",
    "StreamingBuffer",
    "ChunkProcessor"
]