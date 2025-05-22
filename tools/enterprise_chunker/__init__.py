# enterprise_chunker/__init__.py

"""
EnterpriseChunker — Advanced text chunking utility for LLM workflows.
"""

from importlib.metadata import version, PackageNotFoundError

try:
    __version__ = version("enterprise_chunker")
except PackageNotFoundError:
    __version__ = "0.0.0"  # Default version if package is not installed

from .config import ChunkingOptions  # :contentReference[oaicite:0]{index=0}&#8203;:contentReference[oaicite:1]{index=1}
from .models.enums import (           # :contentReference[oaicite:2]{index=2}&#8203;:contentReference[oaicite:3]{index=3}
    ChunkingStrategy,
    TokenEstimationStrategy,
    ContentFormat,
)
from .chunker import (                 # :contentReference[oaicite:4]{index=4}&#8203;:contentReference[oaicite:5]{index=5}
    EnterpriseChunker,
    ChunkingContext,
)
from .models.chunk_metadata import (   # :contentReference[oaicite:6]{index=6}&#8203;:contentReference[oaicite:7]{index=7}
    ChunkMetadata,
    ChunkingResult,
)
from .models.content_features import (  # :contentReference[oaicite:8]{index=8}&#8203;:contentReference[oaicite:9]{index=9}
    ContentFeatures,
)

__all__ = [
    "ChunkingOptions",
    "ChunkingStrategy",
    "TokenEstimationStrategy",
    "ContentFormat",
    "EnterpriseChunker",
    "ChunkingContext",
    "ChunkMetadata",
    "ChunkingResult",
    "ContentFeatures",
    "__version__",
]