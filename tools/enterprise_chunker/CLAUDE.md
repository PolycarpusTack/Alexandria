# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Enterprise Chunker is an advanced text chunking utility for LLM processing with intelligent content-aware strategies. It's part of a larger omt-insights project that includes both Python backend and React frontend components.

The project is located in the `/backend/enterprise_chunker/` directory within the omt-insights repository.

## Key Commands

### Testing
```bash
# Run tests
python -m pytest tests/

# Run tests with coverage
python -m pytest tests/ --cov=enterprise_chunker --cov-report=html

# Test a specific module
python -m pytest tests/test_chunker.py
python -m pytest tests/test_orchestrator.py
python -m pytest tests/test_strategies/test_formats/test_smalltalk.py
```

### Linting and Formatting
```bash
# Format code with black
black enterprise_chunker/
black tests/

# Sort imports
isort enterprise_chunker/
isort tests/

# Type checking
mypy enterprise_chunker/

# Linting
pylint enterprise_chunker/
```

### Development Setup
```bash
# Install package in development mode
pip install -e .

# Install with development dependencies
pip install -e .[dev]

# Install with all optional dependencies
pip install -e .[all]
```

### Building and Distribution
```bash
# Build distribution packages
python setup.py sdist bdist_wheel

# Upload to PyPI (requires credentials)
python -m twine upload dist/*
```

## Project Architecture

### Module Structure
```
enterprise_chunker/
├── __init__.py                    # Package initialization
├── chunker.py                     # Main EnterpriseChunker class
├── config.py                      # Configuration and options
├── exceptions.py                  # Custom exceptions
├── orchestrator.py                # Parallel processing and orchestration
├── models/                        # Data models and enums
│   ├── __init__.py
│   ├── chunk_metadata.py          # Metadata for chunks
│   ├── content_features.py        # Content analysis features
│   ├── enums.py                   # Enumeration types
│   └── user.py                    # User-related models
├── patterns/                      # Regex and pattern definitions  
│   ├── __init__.py
│   └── regex_patterns.py          # Regular expression patterns
├── strategies/                    # Chunking strategies
│   ├── __init__.py
│   ├── base.py                    # Base strategy class
│   ├── fixed_size.py              # Fixed-size chunking
│   ├── semantic.py                # Semantic chunking
│   └── formats/                   # Format-specific strategies
│       ├── __init__.py
│       ├── json_chunker.py        # JSON handling
│       ├── markdown_chunker.py    # Markdown handling
│       ├── react_vue_chunker.py   # React/Vue components
│       └── smalltalk_chunker.py   # Smalltalk code
├── utils/                         # Utility modules
│   ├── __init__.py
│   ├── format_detection.py        # Content format detection
│   ├── memory_optimization.py     # Memory management
│   ├── optimized_streaming.py     # Streaming utilities
│   ├── parallel_processing.py     # Parallel execution
│   ├── performance.py             # Performance monitoring
│   └── token_estimation.py        # Token counting
└── tests/                         # Test suite
    ├── test_chunker.py
    ├── test_orchestrator.py
    └── test_strategies/
        └── test_formats/
            └── test_smalltalk.py
```

### Key Classes and Their Responsibilities

1. **EnterpriseChunker** (`chunker.py`): Main entry point for chunking operations
   - Adaptive text chunking based on content format
   - Fluent API for configuration
   - Context managers for temporary settings

2. **ChunkingOptions** (`config.py`): Configuration management
   - Token limits and overlap settings
   - Strategy selection
   - Performance parameters

3. **SmartParallelChunker** (`orchestrator.py`): Advanced parallel processing
   - Dynamic resource management
   - Circuit breaker pattern
   - Performance monitoring

4. **Format-specific strategies** (`strategies/formats/`):
   - JsonChunkingStrategy: Preserves JSON structure
   - MarkdownChunkingStrategy: Respects markdown hierarchy
   - ReactVueChunkingStrategy: Handles React/Vue components
   - SmalltalkChunkingStrategy: Processes Smalltalk code

5. **Utilities** (`utils/`):
   - TokenEstimator: Estimates token count for text
   - MemoryManager: Handles memory-efficient processing
   - FormatDetector: Automatically detects content format

## Development Workflow

### Adding New Features

1. Create feature branch from main
2. Add tests for new functionality
3. Implement the feature
4. Run tests and linting
5. Update documentation if needed
6. Create pull request

### Testing Guidelines

1. Each new strategy should have comprehensive tests
2. Test edge cases and error conditions
3. Include performance tests for utility functions
4. Mock external dependencies appropriately

### Code Style

- Follow PEP 8 conventions
- Use type annotations throughout
- Document all public APIs
- Keep functions focused and modular
- Prefer composition over inheritance

### Performance Considerations

1. Use generators for large datasets
2. Implement proper memory management
3. Cache expensive computations
4. Profile performance-critical code
5. Add metrics for monitoring

## Environment Variables

The chunker can be configured via environment variables:

```bash
export CHUNKER_MAX_TOKENS_PER_CHUNK=4000
export CHUNKER_OVERLAP_TOKENS=200
export CHUNKER_CHUNKING_STRATEGY=semantic
export CHUNKER_TOKEN_STRATEGY=precision
```

## Integration Points

### Backend Integration
- Part of the omt-insights backend services
- Used by the main FastAPI application
- Integrated with other processing services

### Monitoring Integration
- Prometheus metrics endpoint
- Health check endpoints
- Performance dashboards

## Common Development Tasks

### Running the Development Server
For the main FastAPI application that uses Enterprise Chunker:
```bash
cd backend
python main.py
```

### Testing in Isolation
To test Enterprise Chunker separately:
```python
from enterprise_chunker import EnterpriseChunker

chunker = EnterpriseChunker()
chunks = chunker.chunk("Your test text here")
```

### Debugging Performance
```python
from enterprise_chunker.orchestrator import create_auto_chunker

chunker = create_auto_chunker(
    options=options,
    enable_metrics_server=True,
    metrics_port=8000
)
# Access metrics at http://localhost:8000/metrics
```

## Important Notes

1. The project uses a mixed Python/Node.js stack
2. Enterprise Chunker is a self-contained Python module
3. No custom configuration files for linting tools - uses defaults
4. Part of a larger project with frontend and other backend services
5. Uses semantic versioning for releases

## Dependencies

Core dependencies:
- Python 3.8+
- psutil>=5.9.0
- numpy>=1.22.0  
- prometheus_client>=0.14.0
- requests>=2.27.0

Development dependencies:
- pytest>=7.0.0
- pytest-cov>=4.0.0
- black>=23.0.0
- isort>=5.0.0
- mypy>=1.0.0
- pylint>=2.17.0