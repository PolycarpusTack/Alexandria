# EnterpriseChunker

An advanced text chunking utility for LLM processing with intelligent content-aware strategies.

## Features

- **Multi-strategy token estimation** with adaptive contextual awareness
- **Format-specific intelligent chunking** for JSON, XML, code, logs, markdown and more
- **Structural boundary preservation** with nested context tracking
- **Semantic coherence maintenance** between chunks
- **Memory-efficient processing** for large files
- **Streaming support** with generator-based processing
- **Smart overlap** with context-aware boundaries
- **Performance optimization** with caching
- **Comprehensive error recovery** with fallback strategies

## Installation

```bash
# From PyPI
pip install enterprise-chunker

# From source
git clone https://github.com/your-org/enterprise-chunker.git
cd enterprise-chunker
pip install -e .
```

## Quick Start

```python
from enterprise_chunker import EnterpriseChunker, ChunkingStrategy

# Initialize chunker with default settings
chunker = EnterpriseChunker()

# Simple chunking with automatic format detection
chunks = chunker.chunk(text)

# Advanced configuration
chunks = chunker.adaptive_chunk_text(
    text,
    max_tokens_per_chunk=1000,
    overlap_tokens=50,
    strategy=ChunkingStrategy.SEMANTIC
)

# Using the fluent API
chunks = chunker.with_max_tokens(1000).with_overlap(50).chunk(text)

# Using a context manager
with chunker.semantic_context(max_tokens=1000, overlap=50):
    chunks = chunker.chunk(text)

# Processing a file stream
with open('large_file.txt', 'r') as f:
    for chunk in chunker.chunk_stream(f, max_tokens_per_chunk=1000):
        process_chunk(chunk)
```

## Configuration Options

EnterpriseChunker provides many configuration options:

| Option | Default | Description |
|--------|---------|-------------|
| `max_tokens_per_chunk` | 4000 | Maximum tokens per chunk |
| `overlap_tokens` | 200 | Number of tokens to overlap between chunks |
| `chunking_strategy` | ADAPTIVE | Strategy for chunking (ADAPTIVE, SEMANTIC, STRUCTURAL, FIXED_SIZE, SENTENCE) |
| `token_strategy` | BALANCED | Strategy for token estimation (BALANCED, PRECISION, PERFORMANCE) |
| `preserve_structure` | True | Preserve document structure when chunking |
| `add_metadata_comments` | True | Add metadata comments to chunks |
| `respect_sentences` | True | Try to respect sentence boundaries |

## Chunking Strategies

EnterpriseChunker supports multiple chunking strategies:

- **ADAPTIVE**: Dynamically choose best strategy based on content
- **SEMANTIC**: Preserve semantic boundaries (paragraphs, sections)
- **STRUCTURAL**: Preserve structural elements (JSON, XML, Markdown, etc.)
- **FIXED_SIZE**: Simple fixed-size chunks with overlap
- **SENTENCE**: Split by sentences

## Environment Variables

EnterpriseChunker can be configured with environment variables:

```bash
# Set maximum tokens per chunk
export CHUNKER_MAX_TOKENS_PER_CHUNK=2000

# Set chunking strategy
export CHUNKER_CHUNKING_STRATEGY=semantic

# Set token estimation strategy
export CHUNKER_TOKEN_STRATEGY=precision
```

## Format-Specific Chunking

EnterpriseChunker provides specialized chunking for different formats:

### JSON Chunking

Maintains valid JSON structure in each chunk with metadata:

```python
json_chunks = chunker.adaptive_chunk_text(json_text, strategy=ChunkingStrategy.STRUCTURAL)
```

Each chunk is a valid JSON object with metadata:

```json
{
  "_chunk_info": {
    "index": 0,
    "type": "json_array",
    "total": 3,
    "has_overlap": false
  },
  "data": [...]
}
```

### Markdown Chunking

Preserves headings and section structure:

```python
markdown_chunks = chunker.adaptive_chunk_text(markdown_text, strategy=ChunkingStrategy.STRUCTURAL)
```

Chunk boundaries are placed at headings, and context is preserved across chunks:

```markdown
<!-- Context from previous chunk -->
# Previous Section

<!-- Current content -->
## Current Subsection
Content text...
```

## Performance Considerations

- Use `TokenEstimationStrategy.PERFORMANCE` for very large files
- For streaming large files, adjust `stream_buffer_size` 
- Consider using `max_chunk_size_chars` for more consistent sizing

## Contributing

Contributions are welcome! Please check out our [contributing guidelines](CONTRIBUTING.md).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
