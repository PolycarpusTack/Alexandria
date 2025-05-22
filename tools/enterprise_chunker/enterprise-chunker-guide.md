## Performance Monitoring

Enterprise Chunker provides comprehensive monitoring capabilities to help you understand performance and optimize your processing.

### Basic Metrics Collection

Get a snapshot of current performance:

```python
# Get performance metrics
metrics = smart_chunker.get_metrics()
print(f"Processed {metrics['total_chunks_processed']} chunks")
print(f"Average throughput: {metrics['avg_throughput']:.2f} chunks/second")
```

**Key metrics explained:**

- **total_chunks_processed**: Total number of chunks generated
- **total_bytes_processed**: Total amount of text processed
- **avg_processing_time**: Average time to process text
- **avg_throughput**: Average chunks processed per second
- **error_count**: Number of errors encountered
- **retry_count**: Number of retry attempts
- **strategy_switches**: Number of times strategy changed
- **decisions**: Counts of strategy decisions

**Beyond the basics - detailed metrics:**

```python
# Get comprehensive metrics
detailed_metrics = chunker.get_metrics()

# System information
system_health = detailed_metrics['system']['health_status']
circuit_breaker = detailed_metrics['system']['circuit_breaker']
memory_percent = detailed_metrics['system']['memory_percent']
system_load = detailed_metrics['system']['system_load']

# Performance metrics
avg_batch_size = detailed_metrics['avg_batch_size']
p90_processing_time = detailed_metrics.get('p90_processing_time')
strategy_decisions = detailed_metrics['decisions']

print(f"System Health: {system_health}")
print(f"Memory Usage: {memory_percent:.1f}%")
print(f"System Load: {system_load:.2f}")
print(f"Circuit Breaker: {circuit_breaker}")
print(f"Strategy Usage: {strategy_decisions}")
```

**Real-world example - performance dashboard:**

```python
def print_performance_dashboard(chunker):
    """Print a comprehensive performance dashboard"""
    metrics = chunker.get_metrics()
    
    # Format as a dashboard
    print("\n" + "="*50)
    print(" ENTERPRISE CHUNKER PERFORMANCE DASHBOARD ")
    print("="*50)
    
    # Processing statistics
    print("\n📊 PROCESSING STATISTICS")
    print(f"Total chunks processed: {metrics['total_chunks_processed']:,}")
    print(f"Total bytes processed: {metrics['total_bytes_processed']:,} bytes")
    print(f"Uptime: {metrics['uptime_seconds']/60:.1f} minutes")
    
    # Performance metrics
    print("\n⚡ PERFORMANCE METRICS")
    print(f"Average throughput: {metrics['avg_throughput']:.2f} chunks/second")
    print(f"Average processing time: {metrics['avg_processing_time']:.3f} seconds")
    
    if 'min_processing_time' in metrics:
        print(f"Min processing time: {metrics['min_processing_time']:.3f} seconds")
        print(f"Max processing time: {metrics['max_processing_time']:.3f} seconds")
        print(f"90th percentile time: {metrics.get('p90_processing_time', 'N/A')}")
    
    # Memory metrics
    print("\n💾 MEMORY METRICS")
    if 'avg_memory_usage' in metrics:
        print(f"Average memory usage: {metrics['avg_memory_usage']:.1f}%")
        print(f"Maximum memory usage: {metrics['max_memory_usage']:.1f}%")
    
    # System status
    print("\n🖥️ SYSTEM STATUS")
    print(f"Health status: {metrics['system']['health_status']}")
    print(f"Circuit breaker: {metrics['system']['circuit_breaker']}")
    print(f"System load: {metrics['system']['system_load']:.2f}")
    print(f"Memory percent: {metrics['system']['memory_percent']:.1f}%")
    print(f"CPU cores: {metrics['system']['cpu_count']}")
    
    # Strategy decisions
    print("\n🧠 STRATEGY DECISIONS")
    for strategy, count in metrics['decisions'].items():
        print(f"  {strategy}: {count} times")
    print(f"Strategy switches: {metrics['strategy_switches']}")
    
    # Errors and retries
    print("\n⚠️ ERRORS AND RETRIES")
    print(f"Error count: {metrics['error_count']}")
    print(f"Retry count: {metrics['retry_count']}")
    
    # Batch sizing
    print("\n📦 BATCH SIZING")
    print(f"Average batch size: {metrics['avg_batch_size']:.1f}")
    
    # Throughput trend
    if 'throughput_trend' in metrics:
        trend = metrics['throughput_trend']
        if trend:
            print("\n📈 THROUGHPUT TREND")
            current = trend[-1]
            average = sum(trend) / len(trend)
            if len(trend) > 1:
                previous = trend[-2]
                change = ((current - previous) / previous) * 100 if previous > 0 else 0
                print(f"  Current: {current:.2f} chunks/s ({change:+.1f}% change)")
            else:
                print(f"  Current: {current:.2f} chunks/s")
            print(f"  Average: {average:.2f} chunks/s")
    
    print("="*50)
```

### Prometheus Metrics Integration

For production systems, you can expose metrics via Prometheus:

```python
from enterprise_chunker import start_monitoring_server

# Start metrics server on port 8000
start_monitoring_server(port=8000)

# Create chunker with metrics enabled
smart_chunker = create_auto_chunker(
    options,
    enable_metrics_server=True,
    metrics_port=8000
)
```

**How to access metrics:**
1. Configure Prometheus to scrape `http://your-server:8000/metrics`
2. Metrics are exposed in standard Prometheus format
3. Create Grafana dashboards for visualization

**Available Prometheus metrics:**
- `chunker_throughput`: Chunks processed per second
- `chunker_memory`: Memory usage percentage
- `chunker_workers`: Worker utilization percentage
- `chunker_processing_time`: Time to process text
- `chunker_errors`: Number of processing errors
- `chunker_retries`: Number of retry attempts
- `chunker_batch_size`: Current batch size

**Example Prometheus configuration:**

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'enterprise_chunker'
    scrape_interval: 15s
    static_configs:
      - targets: ['localhost:8000']
```

**Real-world example - health check endpoint:**

```python
# For a Flask application
from flask import Flask, jsonify
app = Flask(__name__)

# Global chunker instance
chunker = create_auto_chunker(options, enable_metrics_server=True)

@app.route('/health')
def health():
    """API health endpoint with chunker metrics"""
    metrics = chunker.get_metrics()
    
    # Simplify for API response
    health_data = {
        'status': 'healthy',
        'chunker': {
            'health': metrics['system']['health_status'],
            'circuit_breaker': metrics['system']['circuit_breaker'],
            'memory_percent': metrics['system']['memory_percent'],
            'processed_chunks': metrics['total_chunks_processed'],
            'throughput': metrics['avg_throughput'],
            'errors': metrics['error_count']
        }
    }
    
    # Determine overall status
    if metrics['system']['health_status'] == 'CRITICAL':
        health_data['status'] = 'critical'
    elif metrics['system']['health_status'] == 'WARNING':
        health_data['status'] = 'warning'
    elif metrics['error_count'] > 10:
        health_data['status'] = 'degraded'
        
    status_code = 200 if health_data['status'] == 'healthy' else 500
    return jsonify(health_data), status_code
```

### Custom Metrics Tracking

For specialized monitoring needs, you can build custom tracking:

```python
class ChunkerPerformanceTracker:
    """Custom performance tracker for Enterprise Chunker"""
    
    def __init__(self, chunker):
        self.chunker = chunker
        self.metrics_history = []
        self.start_time = time.time()
        
        # Start background collection
        self.running = True
        self.collection_thread = threading.Thread(target=self._collect_metrics)
        self.collection_thread.daemon = True
        self.collection_thread.start()
    
    def _collect_metrics(self):
        """Collect metrics at regular intervals"""
        while self.running:
            try:
                # Get current metrics
                current = self.chunker.get_metrics()
                
                # Add timestamp
                current['timestamp'] = time.time()
                
                # Store in history
                self.metrics_history.append(current)
                
                # Limit history size
                if len(self.metrics_history) > 1000:
                    self.metrics_history = self.metrics_history[-1000:]
                    
                # Sleep for interval
                time.sleep(5)
            except Exception as e:
                print(f"Error collecting metrics: {e}")
                time.sleep(10)
    
    def stop(self):
        """Stop metrics collection"""
        self.running = False
        if self.collection_thread.is_alive():
            self.collection_thread.join(timeout=1.0)
    
    def get_throughput_history(self):
        """Get throughput history over time"""
        return [
            (m['timestamp'] - self.start_time, m.get('avg_throughput', 0))
            for m in self.metrics_history if 'avg_throughput' in m
        ]
    
    def get_memory_history(self):
        """Get memory usage history over time"""
        return [
            (m['timestamp'] - self.start_time, 
             m['system']['memory_percent'] if 'system' in m else 0)
            for m in self.metrics_history
        ]
    
    def get_errors_over_time(self):
        """Get error count over time"""
        return [
            (m['timestamp'] - self.start_time, m.get('error_count', 0))
            for m in self.metrics_history if 'error_count' in m
        ]
    
    def get_strategy_distribution(self):
        """Get distribution of strategy decisions"""
        if not self.metrics_history:
            return {}
            
        latest = self.metrics_history[-1]
        if 'decisions' not in latest:
            return {}
            
        decisions = latest['decisions']
        total = sum(decisions.values())
        
        if total == 0:
            return {}
            
        return {k: v / total for k, v in decisions.items()}
    
    def plot_metrics(self):
        """Plot key metrics if matplotlib is available"""
        try:
            import matplotlib.pyplot as plt
            
            # Create figure with subplots
            fig, (ax1, ax2, ax3) = plt.subplots(3, 1, figsize=(12, 10))
            
            # Plot throughput
            throughput_data = self.get_throughput_history()
            if throughput_data:
                times, values = zip(*throughput_data)
                ax1.plot(times, values, 'b-')
                ax1.set_title('Throughput (chunks/second)')
                ax1.set_ylabel('Chunks/second')
                ax1.grid(True, alpha=0.3)
            
            # Plot memory usage
            memory_data = self.get_memory_history()
            if memory_data:
                times, values = zip(*memory_data)
                ax2.plot(times, values, 'r-')
                ax2.set_title('Memory Usage (%)')
                ax2.set_ylabel('Memory %')
                ax2.grid(True, alpha=0.3)
            
            # Plot errors
            error_data = self.get_errors_over_time()
            if error_data:
                times, values = zip(*error_data)
                ax3.plot(times, values, 'y-')
                ax3.set_title('Error Count')
                ax3.set_ylabel('Errors')
                ax3.set_xlabel('Time (seconds)')
                ax3.grid(True, alpha=0.3)
            
            plt.tight_layout()
            return plt
        except ImportError:
            print("Matplotlib not available for plotting")
            return None
```

**Using the custom tracker:**

```python
# Initialize tracker
tracker = ChunkerPerformanceTracker(chunker)

# Process documents
for doc in documents:
    chunks = chunker.chunk(doc, chunker_func)
    # ... process chunks ...

# Get performance insights
print("Strategy distribution:")
distribution = tracker.get_strategy_distribution()
for strategy, percentage in distribution.items():
    print(f"  {strategy}: {percentage:.1%}")

# Visualize (if matplotlib available)
plt = tracker.plot_metrics()
if plt:
    plt.savefig('chunker_performance.png')
    plt.show()

# Stop tracker when done
tracker.stop()
```

## Extending Enterprise Chunker

Enterprise Chunker is designed to be extensible. This section explains how to customize and extend its functionality for specific use cases.

### Custom Chunking Strategy

Create your own chunking strategy for specialized content types:

```python
from enterprise_chunker.strategies.base import BaseChunkingStrategy
from enterprise_chunker.models.enums import ContentFormat, ChunkingStrategy

class MyCustomStrategy(BaseChunkingStrategy):
    def __init__(self):
        super().__init__(ContentFormat.TEXT)
        
    def detect_boundaries(self, text, options):
        # Custom boundary detection
        boundaries = []
        
        # Example: chunk on specific pattern
        import re
        for match in re.finditer(r'SECTION \d+:', text):
            boundaries.append({
                'index': match.start(),
                'end': match.end(),
                'text': match.group(0),
                'is_section': True,
                'section_name': match.group(0)
            })
        
        # Always add a boundary at the beginning if none exists
        if not boundaries or boundaries[0]['index'] > 0:
            boundaries.insert(0, {
                'index': 0,
                'end': 0,
                'text': '',
                'is_section': False
            })
            
        return boundaries
        
    def _get_chunking_strategy(self):
        return ChunkingStrategy.SEMANTIC
```

**Using your custom strategy:**

```python
# Create chunker with factory
from enterprise_chunker.chunker import ChunkingStrategyFactory

# Register your strategy
ChunkingStrategyFactory.register_strategy('custom', MyCustomStrategy)

# Use your strategy
chunker = EnterpriseChunker()
chunks = chunker.adaptive_chunk_text(text, strategy='custom')
```

**Real-world example - medical document chunker:**

```python
class MedicalDocumentStrategy(BaseChunkingStrategy):
    """Strategy specialized for medical documents"""
    
    def __init__(self):
        super().__init__(ContentFormat.TEXT)
        
    def detect_boundaries(self, text, options):
        boundaries = []
        
        # Detect section headers common in medical documents
        section_patterns = [
            r'(?:^|\n)(?:HISTORY OF PRESENT ILLNESS|HPI):',
            r'(?:^|\n)(?:PAST MEDICAL HISTORY|PMH):',
            r'(?:^|\n)(?:MEDICATIONS|MEDS):',
            r'(?:^|\n)(?:PHYSICAL EXAMINATION|PE):',
            r'(?:^|\n)(?:LABORATORY DATA|LABS):',
            r'(?:^|\n)(?:ASSESSMENT(?:\s+AND\s+PLAN)?|A(?:/|&)P):',
            r'(?:^|\n)(?:IMPRESSION):',
            r'(?:^|\n)(?:PLAN):',
            r'(?:^|\n)(?:DIAGNOSIS|DX):',
        ]
        
        # Combine patterns
        combined_pattern = '|'.join(section_patterns)
        
        # Find all section headers
        import re
        for match in re.finditer(combined_pattern, text, re.IGNORECASE):
            section_name = match.group(0).strip()
            
            boundaries.append({
                'index': match.start(),
                'end': match.end(),
                'text': section_name,
                'is_section': True,
                'section_name': section_name
            })
        
        # Add a boundary at the beginning
        if not boundaries or boundaries[0]['index'] > 0:
            boundaries.insert(0, {
                'index': 0,
                'end': 0,
                'text': '',
                'is_section': False,
                'section_name': 'Document Start'
            })
            
        return boundaries
    
    def _create_context_tracker(self):
        """Create custom context tracker for medical documents"""
        return {
            'sections': [],
            'current_section': None,
            'patient_id': None,  # Will extract if found
            'doc_type': None     # Will detect document type
        }
    
    def _update_context_tracker(self, context_tracker, boundary):
        """Update context with medical document information"""
        if not context_tracker:
            return
            
        # Update section tracking
        if boundary.get('is_section', False):
            section_name = boundary.get('section_name', '')
            context_tracker['current_section'] = section_name
            
            if section_name not in context_tracker['sections']:
                context_tracker['sections'].append(section_name)
        
        # Try to extract patient ID if not found yet
        if context_tracker['patient_id'] is None:
            text = boundary.get('text', '')
            # Look for MRN or patient ID pattern
            import re
            id_match = re.search(r'(?:MRN|Patient ID):?\s*(\d+)', text)
            if id_match:
                context_tracker['patient_id'] = id_match.group(1)
    
    def _get_preserved_context(self, context_tracker):
        """Get medical document context"""
        if not context_tracker:
            return ""
            
        context_lines = []
        
        # Add document type if known
        if context_tracker['doc_type']:
            context_lines.append(f"Document Type: {context_tracker['doc_type']}")
        
        # Add patient ID if found (masked for privacy)
        if context_tracker['patient_id']:
            masked_id = 'XXX-XX-' + context_tracker['patient_id'][-4:]
            context_lines.append(f"Patient ID: {masked_id}")
        
        # Add sections seen so far
        if context_tracker['sections']:
            context_lines.append("Document Sections:")
            for section in context_tracker['sections']:
                context_lines.append(f"- {section}")
        
        return "\n".join(context_lines)
    
    def _get_chunking_strategy(self):
        return ChunkingStrategy.SEMANTIC
```

### Custom Token Estimator

For specialized token counting needs:

```python
from enterprise_chunker.utils.token_estimation import BaseTokenEstimator

class MyTokenEstimator(BaseTokenEstimator):
    def _calculate_estimate(self, features, text):
        # Custom token calculation
        
        # Simple example - count words and adjust for content type
        word_count = features.word_count
        
        # Apply custom adjustments
        if features.has_code_blocks:
            # Code typically has more tokens per word
            adjusted_count = word_count * 1.3
        elif features.has_cjk:
            # CJK characters often map 1:1 with tokens
            adjusted_count = word_count * 0.8 + len(re.findall(r'[\u4e00-\u9fff]', text))
        else:
            # Default adjustment
            adjusted_count = word_count * 1.2
            
        return math.ceil(adjusted_count)
```

**Registering your estimator:**

```python
from enterprise_chunker.utils.token_estimation import TokenEstimatorFactory

# Register your custom estimator
TokenEstimatorFactory.register_estimator('my_custom', MyTokenEstimator)

# Use in options
options = ChunkingOptions(token_strategy='my_custom')
chunker = EnterpriseChunker(options)
```

### Custom Format Detection

Extend format detection for specialized file formats:

```python
from enterprise_chunker.utils.format_detection import FormatDetector

class ExtendedFormatDetector(FormatDetector):
    def detect_format(self, text):
        # First try built-in detection
        format_type, confidence = super().detect_format(text)
        
        # If confidence is low, try our custom formats
        if confidence < 0.5:
            # Check for FHIR (healthcare standard)
            if '"resourceType": "Patient"' in text or '"resourceType": "Observation"' in text:
                return ContentFormat.JSON, 0.9
                
            # Check for HL7 format (healthcare)
            if text.startswith('MSH|^~\\&|'):
                return ContentFormat.TEXT, 0.9
                
            # Check for custom format
            if text.startswith('%%CUSTOM_FORMAT%%'):
                return ContentFormat.TEXT, 0.9
                
        return format_type, confidence
```

**Using custom format detector:**

```python
# Create custom chunker with extended format detection
from enterprise_chunker.chunker import EnterpriseChunker

class CustomChunker(EnterpriseChunker):
    def __init__(self, options=None):
        super().__init__(options)
        # Replace format detector with our extended version
        self._format_detector = ExtendedFormatDetector()
        
    def adaptive_chunk_text(self, text, **kwargs):
        # Use custom format detection
        if self.options.enable_format_detection:
            format_type, confidence = self._format_detector.detect_format(text)
            # Rest of the method remains the same...
```

## Environment Variables

Enterprise Chunker supports configuration via environment variables, which is particularly useful in containerized environments and cloud deployments.

```bash
# Set maximum tokens per chunk
export CHUNKER_MAX_TOKENS_PER_CHUNK=2000

# Set chunking strategy
export CHUNKER_CHUNKING_STRATEGY=semantic

# Set token estimation strategy
export CHUNKER_TOKEN_STRATEGY=precision

# Enable/disable format detection
export CHUNKER_ENABLE_FORMAT_DETECTION=true

# Set overlap tokens
export CHUNKER_OVERLAP_TOKENS=100
```

**Complete list of environment variables:**

| Environment Variable | Default | Description |
|----------------------|---------|-------------|
| `CHUNKER_MAX_TOKENS_PER_CHUNK` | 4000 | Maximum tokens per chunk |
| `CHUNKER_OVERLAP_TOKENS` | 200 | Number of tokens to overlap |
| `CHUNKER_RESERVED_TOKENS` | 1000 | Buffer tokens for safety |
| `CHUNKER_CHUNKING_STRATEGY` | adaptive | Strategy for chunking |
| `CHUNKER_TOKEN_STRATEGY` | balanced | Strategy for token estimation |
| `CHUNKER_PRESERVE_STRUCTURE` | true | Preserve document structure |
| `CHUNKER_ENABLE_FORMAT_DETECTION` | true | Auto-detect content format |
| `CHUNKER_FORMAT_DETECTION_SAMPLE_SIZE` | 2500 | Sample size for detection |
| `CHUNKER_ADD_METADATA_COMMENTS` | true | Add metadata comments |
| `CHUNKER_SAFETY_MARGIN` | 0.9 | Safety margin for token limits |
| `CHUNKER_MAX_CHUNK_SIZE_CHARS` | 0 | Max chunk size in chars |
| `CHUNKER_TARGET_CHUNK_RATIO` | 0.8 | Target ratio for chunk sizes |
| `CHUNKER_STREAM_BUFFER_SIZE` | 100000 | Buffer size for streaming |
| `CHUNKER_CACHE_SIZE` | 1000 | Cache size for token estimation |
| `CHUNKER_RESPECT_SENTENCES` | true | Break at sentence boundaries |

**Environment-aware configuration:**

```python
import os

def get_env_config():
    """Get configuration from environment variables"""
    config = {}
    
    # Check for environment variables
    if 'CHUNKER_MAX_TOKENS_PER_CHUNK' in os.environ:
        config['max_tokens_per_chunk'] = int(os.environ.get('CHUNKER_MAX_TOKENS_PER_CHUNK'))
        
    if 'CHUNKER_OVERLAP_TOKENS' in os.environ:
        config['overlap_tokens'] = int(os.environ.get('CHUNKER_OVERLAP_TOKENS'))
        
    if 'CHUNKER_CHUNKING_STRATEGY' in os.environ:
        config['chunking_strategy'] = os.environ.get('CHUNKER_CHUNKING_STRATEGY')
        
    # Additional env vars...
    
    return config

# Create chunker with environment configuration
chunker = EnterpriseChunker(get_env_config())
```

**Docker example:**

```Dockerfile
FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# Set chunker configuration
ENV CHUNKER_MAX_TOKENS_PER_CHUNK=3000
ENV CHUNKER_OVERLAP_TOKENS=150
ENV CHUNKER_CHUNKING_STRATEGY=semantic
ENV CHUNKER_TOKEN_STRATEGY=precision

CMD ["python", "process_documents.py"]
```

**Kubernetes ConfigMap example:**

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: chunker-config
data:
  CHUNKER_MAX_TOKENS_PER_CHUNK: "3000"
  CHUNKER_OVERLAP_TOKENS: "150"
  CHUNKER_CHUNKING_STRATEGY: "semantic"
  CHUNKER_TOKEN_STRATEGY: "precision"
  CHUNKER_MEMORY_SAFETY: "true"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: document-processor
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: processor# Enterprise Chunker

Enterprise Chunker is an advanced text chunking utility that intelligently breaks down large documents for processing by Large Language Models (LLMs). Unlike basic chunking methods, Enterprise Chunker preserves document structure, maintains semantic coherence between chunks, and automatically adapts to different content types.

- [Summary and Best Practices](#summary-and-best-practices)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
- [Basic Usage](#basic-usage)
- [Advanced Usage](#advanced-usage)
- [Configuration Options](#configuration-options)
- [Chunking Strategies](#chunking-strategies)
- [Format-Specific Chunking](#format-specific-chunking)
- [Memory Optimization](#memory-optimization)
- [Parallel Processing](#parallel-processing)
- [Performance Monitoring](#performance-monitoring)
- [Extending Enterprise Chunker](#extending-enterprise-chunker)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Troubleshooting](#troubleshooting)

## Summary and Best Practices

Enterprise Chunker is designed to solve one of the most critical problems in LLM processing: how to break down large documents intelligently so they can be processed effectively while preserving meaning and context.

### Key Dependencies

To get the most out of Enterprise Chunker, consider installing these dependencies:

| Dependency | Purpose | Installation |
|------------|---------|-------------|
| **prometheus_client** | Metrics and monitoring | `pip install prometheus_client>=0.14.0` |
| **psutil** | System resource monitoring | `pip install psutil>=5.9.0` |
| **numpy** | Enhanced analytics and calculations | `pip install numpy>=1.22.0` |
| **requests** | Remote configuration updates | `pip install requests>=2.27.0` |

### Best Practices

✅ **Do This** | ❌ **Avoid This**
-------------- | ---------------
Set reasonable token limits based on your LLM | Using the default 4000 tokens without checking your model's actual context window
Use `ADAPTIVE` strategy for most content | Setting a specific strategy when content is mixed
Enable memory optimization for files over 10MB | Loading large files entirely into memory
Use parallel processing for batch operations | Sequential processing for large document sets
Match chunking strategy to content type | Using the same approach for all content types
Test with samples of your actual data | Assuming default settings will work optimally
Configure overlap based on content coherence needs | Setting zero overlap or excessive overlap
Monitor performance metrics in production | Ignoring resource usage in high-volume scenarios
Use streaming for very large files | Loading entire documents when not necessary
Scale worker count based on available CPU cores | Oversubscribing CPU resources

### Red Flags When Deploying

🚩 **High memory usage spikes**: Adjust batch size, enable memory safety, or use streaming

🚩 **Slow processing of large files**: Switch to `PERFORMANCE` token strategy and consider parallel processing

🚩 **Uneven chunk sizes**: Review strategy selection, adjust safety margin, or use fixed-size chunking

🚩 **Missing content in processed output**: Ensure overlap settings are appropriate for your content

🚩 **System crashes during processing**: Implement circuit breaker pattern and memory monitoring

🚩 **Poor chunk boundaries in specialized content**: Use format-specific strategies instead of generic ones

### Key Metrics to Monitor

- Chunks processed per second
- Memory usage during processing
- Processing time per document
- Error and retry rates
- Token estimation accuracy

## Installation

```bash
# From PyPI
pip install enterprise-chunker

# From source
git clone https://github.com/your-org/enterprise-chunker.git
cd enterprise-chunker
pip install -e .

# With all optional dependencies
pip install "enterprise-chunker[all]"
```

Optional dependency groups:
- `monitoring`: Prometheus metrics (`pip install "enterprise-chunker[monitoring]"`)
- `advanced`: System monitoring and analytics (`pip install "enterprise-chunker[advanced]"`)
- `remote_config`: Remote configuration capabilities (`pip install "enterprise-chunker[remote_config]"`)
- `all`: All optional dependencies (`pip install "enterprise-chunker[all]"`)

**Which Dependencies Should You Choose?**

* **Small projects or testing**: No additional dependencies needed
* **Production systems**: At minimum, install `advanced` for resource monitoring
* **High-volume applications**: Install `all` dependencies for full capabilities
* **Microservices**: Consider `monitoring` for observability in distributed systems

**Tip**: If you're deploying in a resource-constrained environment like a serverless function, you might want to avoid the heavier dependencies like numpy to reduce cold start time.

## Quick Start

Let's get you up and running with Enterprise Chunker in just a few minutes:

```python
from enterprise_chunker import EnterpriseChunker

# Initialize chunker with default settings
chunker = EnterpriseChunker()

# Simple chunking with automatic format detection
with open('document.md', 'r') as f:
    text = f.read()
    
chunks = chunker.chunk(text)

# Process chunks with your LLM
for chunk in chunks:
    response = process_with_llm(chunk)
```

**What's happening here?**

1. We create an instance of the `EnterpriseChunker` with default settings
2. We read in a document (in this case a Markdown file)
3. The chunker automatically:
   - Detects that it's Markdown content
   - Chooses appropriate chunking boundaries (headings, paragraphs, etc.)
   - Splits the content into properly sized chunks
   - Adds context between chunks to maintain coherence
4. We process each chunk with our LLM

**Tips for getting started:**

- Start with default settings and adjust as needed
- For your first tests, try a medium-sized document (1-5 pages)
- Check your chunk sizes by printing `len(chunk)` or token count
- Examine chunk boundaries to see if they make semantic sense
- If chunks look odd, try a specific strategy (see Chunking Strategies section)

**Quick troubleshooting:**

- If chunks are too large, reduce `max_tokens_per_chunk`
- If context is lost between chunks, increase `overlap_tokens`
- If processing is slow, consider using parallel chunking
- If memory usage is high, use streaming with `chunk_stream()`

This basic approach works for most simple use cases. For more advanced scenarios, check out the following sections.


## Core Concepts

Let's break down the fundamental concepts behind Enterprise Chunker in plain language:

### Chunks and Chunking

Think of a large document like a book. When you want an AI to understand the whole book, you can't just feed it all at once - most LLMs have limits on how much they can "see" at one time (typically 4K-32K tokens). Chunking is like tearing the book into manageable chapters that the AI can digest one at a time.

**What makes Enterprise Chunker different from simple chunking?**

Regular chunking just counts characters or tokens and cuts the text every X tokens - like ripping pages out blindly. This can break paragraphs mid-sentence or split important concepts. Enterprise Chunker is more like a skilled editor who:

- Looks for natural breaks (headings, paragraphs, code blocks)
- Keeps related content together (like keeping JSON object properties together)
- Creates smooth transitions between chunks
- Adds "previously on..." context to remind the AI what it saw in earlier chunks

The chunks produced are:
- Within token limits for your LLM (configurable based on model)
- Structure-preserving (not cutting in the middle of a code block or table)
- Semantically coherent (keeping related concepts together)
- Contextually connected (with appropriate overlap between chunks)

**Tip**: Think about your content type when chunking. A legal document needs different chunking than source code or a CSV file.

### Token Estimation

LLMs don't process text character by character - they break it down into "tokens," which might be words, parts of words, or even single characters for some languages. Knowing how many tokens a chunk contains is crucial.

Enterprise Chunker provides three ways to count tokens, each with different trade-offs:

- **BALANCED** (default): Like a utility player in sports - does a good job at both speed and accuracy for most content types
   - *When to use*: For most general text processing where you need reasonable accuracy but also care about performance
   - *Tip*: This works well for mixed content

- **PRECISION**: Like counting with a microscope - very accurate but takes longer
   - *When to use*: When you're close to token limits and need to be absolutely sure
   - *Tip*: Great for billing scenarios where token counts affect costs

- **PERFORMANCE**: Like quick estimation - rough count but very fast
   - *When to use*: For processing huge volumes of text when approximate counts are acceptable
   - *Tip*: Can be 5-10x faster than PRECISION mode

**Real-world insight**: Token estimation is surprisingly complex - emoji, code, and non-English languages all tokenize differently. Unicode characters like emojis can take multiple tokens each!

### Content Formats

Different document types need different chunking approaches. Enterprise Chunker automatically detects these formats:

- **JSON**: Treats objects and arrays intelligently, keeps related properties together
  - *Example benefit*: A JSON configuration stays valid and usable in each chunk
  - *Tip*: Great for API responses or configuration files

- **Markdown**: Respects heading levels, lists, and code blocks
  - *Example benefit*: A level 2 heading stays with its content, making chunks more meaningful
  - *Tip*: Works wonderfully for documentation or articles

- **XML/HTML**: Understands tags, attributes, and nested structures
  - *Example benefit*: HTML tables aren't broken mid-row
  - *Tip*: Perfect for web content or SOAP/XML messages

- **Code**: Identifies methods, classes, and code blocks
  - *Example benefit*: Function definitions stay intact
  - *Tip*: Excellent for source code or script files

- **Plain text**: Finds natural paragraph and sentence boundaries
  - *Example benefit*: Paragraphs and sentences stay coherent
  - *Tip*: Works well for essays, books, or unstructured text

- **CSV**: Respects data rows and columns
  - *Example benefit*: Data rows aren't split mid-row
  - *Tip*: Ideal for tabular data

- **Logs**: Identifies log entries, timestamps, and severity levels
  - *Example benefit*: Related log entries stay together
  - *Tip*: Perfect for system logs or application logs

**Pro tip**: While automatic format detection works well, if you know your document type in advance, explicitly setting the strategy can improve results.

## Basic Usage

Let's explore the everyday usage patterns of Enterprise Chunker with practical examples and explanations:

### Simple Chunking

Here's the most basic way to use Enterprise Chunker:

```python
from enterprise_chunker import EnterpriseChunker

# Initialize with defaults
chunker = EnterpriseChunker()

# Chunk text
chunks = chunker.chunk(text)
```

**What's happening behind the scenes:**
1. The chunker analyzes your text to detect its format
2. It selects the appropriate chunking strategy automatically
3. It applies default settings (4000 max tokens, 200 overlap tokens)
4. It returns a list of text chunks ready for processing

**When to use this approach:**
- When you're just getting started with the library
- For quick experiments or prototyping
- When working with typical document sizes (under 50 pages)
- When default settings are appropriate for your model

**Tip**: Print the number of chunks with `len(chunks)` and examine a few chunks to verify they look reasonable before processing.

### Configuring Chunk Size

For more control over chunk size and overlap:

```python
# Specify maximum tokens per chunk and overlap
chunks = chunker.adaptive_chunk_text(
    text,
    max_tokens_per_chunk=1000,  # Smaller chunks
    overlap_tokens=50           # Less overlap
)

# Alternative: Using fluent API (chain-style)
chunks = chunker.with_max_tokens(1000).with_overlap(50).chunk(text)
```

**Why adjust these parameters?**

- **max_tokens_per_chunk**: Controls how much text is in each chunk
  - *Smaller values* (500-1000): Create more, smaller chunks
    - Better for: Shorter context window models, more precise answers
    - Trade-off: More API calls, higher processing cost
  - *Larger values* (4000+): Create fewer, larger chunks
    - Better for: Models with large context windows, maintaining context
    - Trade-off: May hit token limits, potentially wasteful

- **overlap_tokens**: Controls how much context is shared between chunks
  - *Smaller values* (20-50): Less repetition, more efficient
    - Better for: Well-structured content, lower cost
    - Trade-off: Might miss cross-chunk connections
  - *Larger values* (200-500): More context preservation
    - Better for: Complex documents, ensuring coherence
    - Trade-off: Duplicate information, higher token usage

**Real-world example**: For a technical manual, you might use larger chunks (3000 tokens) with modest overlap (100 tokens) to keep related sections together. For a legal contract, you might use smaller chunks (1000 tokens) with higher overlap (300 tokens) to ensure critical clauses aren't misunderstood due to missing context.

### Chunking Streams and Files

For larger files that might not fit in memory:

```python
# Process a file stream
with open('large_file.txt', 'r') as f:
    for chunk in chunker.chunk_stream(f):
        process_chunk(chunk)
```

**How streaming differs from regular chunking:**
1. Reads and processes the file incrementally instead of loading it all at once
2. Uses significantly less memory for large files
3. Begins generating chunks immediately, without waiting for full file read
4. Returns a generator instead of a list, so chunks are processed one at a time

**When to use streaming:**
- For files larger than 10MB
- In memory-constrained environments
- When processing time is a concern
- For real-time or interactive applications

**Pro tip**: Combine with a generator for your LLM processing to create a processing pipeline:

```python
def process_document(file_path):
    with open(file_path, 'r') as f:
        for chunk in chunker.chunk_stream(f):
            yield process_with_llm(chunk)
            
# Then use in an async web application:
for result in process_document('huge_file.txt'):
    await send_to_client(result)
```

### Context Managers for Strategy Selection

When you need different chunking strategies for different content:

```python
# Use semantic chunking for a specific operation
with chunker.semantic_context(max_tokens=2000, overlap=100):
    narrative_chunks = chunker.chunk(story_text)
    
# Use structural chunking for code files
with chunker.structural_context():
    code_chunks = chunker.chunk(code_text)
```

**What context managers do:**
- Temporarily change the chunking behavior without creating a new chunker
- Automatically restore previous settings after the context block
- Allow you to use different strategies for different content types

**When to use different contexts:**
- **semantic_context**: For narrative text, articles, books
  - *Tip*: Great for preserving paragraph and section meaning
- **structural_context**: For code, JSON, XML, HTML
  - *Tip*: Keeps structural elements intact (brackets, tags, etc.)
- **fixed_size_context**: For content where structure is less important
  - *Tip*: Most efficient when raw speed matters more than boundaries
- **sentence_context**: For legal or very precise text
  - *Tip*: Ensures no sentence is ever broken mid-way

**Practical example**: Processing a Jupyter notebook with both code and markdown:

```python
# Process notebook cells with appropriate strategy
for cell in notebook['cells']:
    if cell['cell_type'] == 'markdown':
        with chunker.semantic_context():
            markdown_chunks = chunker.chunk(cell['source'])
            process_markdown(markdown_chunks)
    elif cell['cell_type'] == 'code':
        with chunker.structural_context():
            code_chunks = chunker.chunk(cell['source'])
            analyze_code(code_chunks)
```

## Advanced Usage

Ready to take your chunking to the next level? These advanced features help you handle large-scale processing, optimize performance, and monitor your system.

### Smart Parallel Chunking

When you need to process large volumes of text efficiently:

```python
from enterprise_chunker import create_auto_chunker, ChunkingOptions

# Create options
options = ChunkingOptions(
    max_tokens_per_chunk=4000,
    overlap_tokens=200,
    preserve_structure=True
)

# Create auto-tuned chunker
smart_chunker = create_auto_chunker(
    options=options,
    mode="balanced",  # Options: "performance", "balanced", "memory-safe", "auto"
    memory_safety=True
)

# Process text
chunks = smart_chunker.chunk(text, lambda x: x.split('\n'))
```

**What makes this "smart" parallel chunking?**

1. **Automatic resource detection**: Identifies available CPU cores and memory
2. **Dynamic strategy selection**: Switches between simple and advanced chunking based on content complexity
3. **Batch processing**: Groups content into optimal batches for parallel processing
4. **Fault tolerance**: Includes circuit breaker pattern to prevent system overload
5. **Self-tuning**: Adjusts batch size and worker count based on performance metrics

**Mode selection explained:**
- **"performance"**: Maximizes speed at the cost of higher memory usage
  - *When to use*: Batch processing when resources are plentiful
  - *Tip*: Great for overnight jobs or dedicated processing servers
- **"balanced"**: Good trade-off between speed and resource usage (recommended)
  - *When to use*: Most production scenarios
  - *Tip*: The best default for most use cases
- **"memory-safe"**: Prioritizes memory efficiency over speed
  - *When to use*: Memory-constrained environments or extremely large documents
  - *Tip*: Use for cloud functions or containers with memory limits
- **"auto"**: Detects system capabilities and chooses optimal settings
  - *When to use*: When you're unsure of the runtime environment
  - *Tip*: Good for applications deployed in various environments

**Real-world insight**: On an 8-core system, parallel chunking can be 4-6x faster than sequential processing for large documents.

**Warning sign**: If you see memory usage spiking, switch to "memory-safe" mode or enable streaming.

### Streaming with Parallel Processing

For extremely large files that need efficient processing:

```python
# Create streaming processor
from enterprise_chunker.utils.optimized_streaming import ChunkProcessor

processor = ChunkProcessor(options)

# Process large file with parallel optimization
for chunk in processor.process_large_file('huge_document.txt', chunker_func):
    process_with_llm(chunk)
```

**How this works under the hood:**
1. The file is read in optimized buffers instead of all at once
2. Each buffer is processed in parallel as it's read
3. Memory mapping is used when available for more efficient file access
4. Natural boundaries (paragraphs, code blocks) are detected for clean splits
5. Results are yielded in sequence even though processing happens in parallel

**When to use this approach:**
- For files larger than 100MB
- When processing needs to start before the entire file is read
- In production systems processing many documents
- When memory constraints are a concern

**Practical example**: Processing a 500MB log file:
```python
# Define your chunking function
def my_chunker_func(text):
    # Split on timestamp patterns
    return re.split(r'\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\]', text)

# Process with streaming optimization
results = []
for chunk in processor.process_large_file('system.log', my_chunker_func):
    # Process immediately rather than collecting all chunks
    analysis = analyze_log_chunk(chunk)
    results.append(analysis)
    
    # You could also send to a queue for distributed processing
    # queue.send(chunk)
```

**Pro tip**: For web applications, combine this with async processing to handle file uploads without blocking:

```python
async def process_uploaded_file(file_path):
    processor = ChunkProcessor(options)
    
    # Start processing in an executor to avoid blocking
    loop = asyncio.get_event_loop()
    for chunk in await loop.run_in_executor(
        None, 
        lambda: list(processor.process_large_file(file_path, chunker_func))
    ):
        yield chunk
```

### Dynamic Configuration

For systems that need runtime configuration changes:

```python
from enterprise_chunker import DynamicConfig

# Create dynamic config
config = DynamicConfig({
    'processing_timeout': 300,  # 5 minutes
    'max_retries': 3,
    'memory_safety': True
})

# Update configuration at runtime
config.set('processing_timeout', 600)  # Increase to 10 minutes

# Use in smart chunker
smart_chunker = create_auto_chunker(options, config=config)
```

**What dynamic configuration enables:**
1. Changing behavior without restarting your application
2. A/B testing different chunking settings
3. Adapting to varying workloads automatically
4. Centralized configuration for distributed systems

**Beyond the basics - remote configuration:**
```python
# Enable remote configuration updates
config.start_auto_update(
    url="https://your-config-server.com/chunker-config.json",
    interval=300.0  # Check every 5 minutes
)

# Later, stop auto-updates
config.stop_auto_update()
```

**Real-world application**: Automatically adjust processing parameters based on server load:

```python
def update_config_based_on_load():
    # Check system load
    load = os.getloadavg()[0] / os.cpu_count()
    
    if load > 0.8:  # High load
        config.update({
            'max_workers': 2,
            'memory_safety': True,
            'processing_timeout': 600  # Longer timeout
        })
    else:  # Normal load
        config.update({
            'max_workers': os.cpu_count(),
            'memory_safety': False,
            'processing_timeout': 300
        })
    
# Run this check periodically
import threading
threading.Timer(60.0, update_config_based_on_load).start()
```

**Warning**: When using remote configuration, ensure your config source is secure and validated to prevent security issues.

### Metrics and Monitoring

For production systems, monitoring is crucial:

```python
from enterprise_chunker import start_monitoring_server

# Start Prometheus metrics server
start_monitoring_server(port=8000)

# Get performance metrics
metrics = smart_chunker.get_metrics()
print(f"Processed {metrics['total_chunks_processed']} chunks")
print(f"Average throughput: {metrics['avg_throughput']:.2f} chunks/second")
```

**Key metrics to watch:**
- **Processing throughput**: Chunks processed per second
- **Memory usage**: Peak and average memory consumption
- **Error rates**: Frequency of processing failures
- **Worker utilization**: How effectively parallel workers are being used
- **Batch sizing**: Average batch size for parallel processing
- **Strategy distribution**: Which strategies are being selected

**Visualizing with Grafana:**
1. Configure Prometheus to scrape the metrics endpoint
2. Set up a Grafana dashboard with key metrics
3. Create alerts for anomalies (high error rates, memory spikes)

**Metrics in practice - detecting and resolving issues:**

```python
# Periodic health check
def health_check():
    metrics = smart_chunker.get_metrics()
    
    # Check for warning signs
    if metrics['error_count'] > 10:
        logging.warning("High error count detected, investigating...")
        
    if metrics['system']['memory_percent'] > 85:
        logging.warning("Memory pressure detected")
        # Force garbage collection
        smart_chunker._memory_manager.reduce_memory_usage(force=True)
        
    if metrics['avg_throughput'] < 1.0:  # Less than 1 chunk/second
        logging.warning("Performance degradation detected")
        # Reset circuit breaker if open
        if metrics['system']['circuit_breaker'] == "OPEN":
            smart_chunker.circuit_breaker_status = "CLOSED"
            
    # Log health status
    logging.info(f"System health: {metrics['system']['health_status']}")
```

**Production tip**: Create a dedicated health endpoint in your application that returns chunker metrics along with other system health information.

## Configuration Options

Enterprise Chunker is highly configurable to match your specific needs. The `ChunkingOptions` class is the control center for fine-tuning the chunking behavior. Let's look at each option in depth:

| Option | Default | Description | When to Adjust |
|--------|---------|-------------|----------------|
| `max_tokens_per_chunk` | 4000 | Maximum tokens per chunk | Adjust based on your LLM's context window |
| `overlap_tokens` | 200 | Number of tokens to overlap between chunks | Increase for complex documents needing more context |
| `reserved_tokens` | 1000 | Buffer tokens kept in reserve | Reduce for more efficient token usage, increase for safety |
| `chunking_strategy` | ADAPTIVE | Strategy for chunking | Change when you know your content type exactly |
| `token_strategy` | BALANCED | Strategy for token estimation | Switch to PERFORMANCE for speed, PRECISION for accuracy |
| `preserve_structure` | True | Preserve document structure | Disable only for simple text when structure doesn't matter |
| `enable_format_detection` | True | Auto-detect content format | Disable if you know format and want to skip detection |
| `format_detection_sample_size` | 2500 | Sample size for format detection | Increase for more accurate but slower detection |
| `add_metadata_comments` | True | Add metadata comments to chunks | Disable if you need clean chunks without metadata |
| `safety_margin` | 0.9 | Safety margin for token limits (90%) | Lower for more aggressive chunking, raise for more safety |
| `max_chunk_size_chars` | 0 | Max chunk size in chars (0 = use tokens) | Set when character count matters more than tokens |
| `target_chunk_ratio` | 0.8 | Target ratio for chunk sizes | Adjust for more consistent chunk sizes |
| `stream_buffer_size` | 100000 | Buffer size for streaming (100KB) | Increase for faster streaming of large files |
| `cache_size` | 1000 | Cache size for token estimation | Increase if processing repetitive content |
| `respect_sentences` | True | Try to break at sentence boundaries | Disable only for non-narrative content |

### Detailed Explanation and Examples

**max_tokens_per_chunk**  
This is the maximum size of each chunk in tokens.

```python
# For GPT-3.5-Turbo (4K context)
options = ChunkingOptions(max_tokens_per_chunk=3500)  # Leave room for response

# For Claude 3 Opus (200K context)
options = ChunkingOptions(max_tokens_per_chunk=180000)  # Much larger chunks
```

**overlap_tokens**  
How many tokens should be repeated between chunks to maintain context.

```python
# For factual content (minimal overlap needed)
options = ChunkingOptions(overlap_tokens=50)

# For narrative content (more context preservation)
options = ChunkingOptions(overlap_tokens=400)

# For complex technical documentation
options = ChunkingOptions(overlap_tokens=300)
```

**Tip**: The right overlap depends on your content. Too little and you lose context between chunks; too much wastes tokens. Start with 5-10% of your max_tokens_per_chunk.

**chunking_strategy**  
Determines how text is analyzed for chunking boundaries.

```python
from enterprise_chunker.models.enums import ChunkingStrategy

# For source code
options = ChunkingOptions(chunking_strategy=ChunkingStrategy.STRUCTURAL)

# For narrative text
options = ChunkingOptions(chunking_strategy=ChunkingStrategy.SEMANTIC)

# For mixed content (default)
options = ChunkingOptions(chunking_strategy=ChunkingStrategy.ADAPTIVE)
```

**token_strategy**  
Controls the approach to estimating token counts.

```python
from enterprise_chunker.models.enums import TokenEstimationStrategy

# For high-volume processing when exact counts aren't critical
options = ChunkingOptions(token_strategy=TokenEstimationStrategy.PERFORMANCE)

# For billing-critical applications
options = ChunkingOptions(token_strategy=TokenEstimationStrategy.PRECISION)
```

**preserve_structure and respect_sentences**  
These options control how strictly the chunker tries to maintain document structure.

```python
# For code or structured data
options = ChunkingOptions(
    preserve_structure=True,
    respect_sentences=False  # Code doesn't have traditional sentences
)

# For legal documents where sentence integrity is critical
options = ChunkingOptions(
    preserve_structure=True,
    respect_sentences=True
)
```

**safety_margin**  
A multiplier applied to max_tokens_per_chunk to prevent going over limits.

```python
# More aggressive chunking (95% of max)
options = ChunkingOptions(safety_margin=0.95)

# Very conservative (80% of max)
options = ChunkingOptions(safety_margin=0.8)
```

**Real-world example: Configuring for different document types**

```python
# Configuration for code repositories
code_options = ChunkingOptions(
    max_tokens_per_chunk=3000,
    overlap_tokens=150,
    chunking_strategy=ChunkingStrategy.STRUCTURAL,
    preserve_structure=True,
    respect_sentences=False,
    safety_margin=0.9
)

# Configuration for legal documents
legal_options = ChunkingOptions(
    max_tokens_per_chunk=2000,  # Smaller chunks for precise processing
    overlap_tokens=300,         # More overlap to maintain context
    chunking_strategy=ChunkingStrategy.SENTENCE,
    preserve_structure=True,
    respect_sentences=True,
    safety_margin=0.85
)

# Configuration for high-performance log processing
logs_options = ChunkingOptions(
    max_tokens_per_chunk=5000,
    overlap_tokens=100,
    chunking_strategy=ChunkingStrategy.STRUCTURAL,
    token_strategy=TokenEstimationStrategy.PERFORMANCE,
    stream_buffer_size=200000,  # Larger buffer for faster processing
    cache_size=2000
)
```

**Pro tip**: Creating preset configurations for different document types in your application can simplify usage and ensure consistent processing.

**Fine-tuning for token efficiency**

If you need to maximize token efficiency (e.g., to minimize API costs):

```python
efficient_options = ChunkingOptions(
    max_tokens_per_chunk=4000,
    overlap_tokens=100,           # Minimal overlap
    reserved_tokens=500,          # Smaller reserve
    safety_margin=0.95,           # Use more of the available tokens
    add_metadata_comments=False,  # Skip metadata comments
)
```

**Warning signs to adjust configuration:**
- Chunks consistently much smaller than your max_tokens_per_chunk → Increase target_chunk_ratio
- Content appearing truncated or missing → Check overlap_tokens and safety_margin
- Processing very slow → Consider adjusting token_strategy or streaming parameters
- Memory issues → Reduce stream_buffer_size or enable memory_safety

## Chunking Strategies

Think of chunking strategies as different methods an editor might use to divide a book into chapters. Each has its own strengths and is suited for different types of content. Enterprise Chunker supports multiple approaches through the `ChunkingStrategy` enum:

### ADAPTIVE (Default)
The smart, all-purpose strategy that automatically selects the best approach based on content type.

```python
from enterprise_chunker.models.enums import ChunkingStrategy

chunker.adaptive_chunk_text(text, strategy=ChunkingStrategy.ADAPTIVE)
```

**How it works:** 
1. Analyzes a sample of your content
2. Determines the most likely format (JSON, Markdown, code, etc.)
3. Selects the optimal strategy for that format
4. Applies format-specific optimizations

**When to use ADAPTIVE:**
- When processing mixed or unknown content types
- In general-purpose applications
- When you want the system to "just work" without manual tuning
- For batch processing diverse document collections

**Under the hood:** If it detects JSON, it will use structural chunking; for narrative text, it will use semantic chunking; for code, it will apply code-aware chunking, and so on.

**Pro tip:** Even with automatic detection, providing hints about your content type can improve results:

```python
# Help the chunker with a hint about content
if filename.endswith('.json'):
    chunker.with_strategy(ChunkingStrategy.STRUCTURAL).chunk(text)
else:
    chunker.with_strategy(ChunkingStrategy.ADAPTIVE).chunk(text)
```

### SEMANTIC
The "meaning-preserving" strategy that focuses on natural language boundaries.

```python
chunks = chunker.adaptive_chunk_text(text, strategy=ChunkingStrategy.SEMANTIC)
```

**How it works:**
1. Identifies semantic boundaries like paragraphs, sections, and topic changes
2. Preserves these boundaries during chunking
3. Adds semantic context between related chunks
4. Avoids breaking mid-paragraph or mid-idea when possible

**When to use SEMANTIC:**
- For narrative text, articles, books, and essays
- When content coherence is critical
- For content where understanding "flows" of ideas matters
- When processing natural language documents

**Real-world example:** A customer service chatbot processing product manuals would benefit from semantic chunking to keep related instructions together.

**What it preserves:**
- Paragraph integrity
- Section coherence
- List completeness
- Quote boundaries

**Practical results:**
```python
# Semantic chunking on a textbook
with chunker.semantic_context():
    chapter_chunks = chunker.chunk(chapter_text)
    
    # First chunk might include the introduction and first section
    # Second chunk might start at a natural section break
    # Context is preserved between sections
```

### STRUCTURAL
The "structure-respecting" strategy that preserves formatting and organizational elements.

```python
chunks = chunker.adaptive_chunk_text(text, strategy=ChunkingStrategy.STRUCTURAL)
```

**How it works:**
1. Identifies structural elements (tags, brackets, blocks, etc.)
2. Maintains the structural integrity of these elements
3. Ensures chunks contain valid and usable structures
4. Preserves hierarchical relationships when possible

**When to use STRUCTURAL:**
- For JSON, XML, HTML, or other structured formats
- For source code in any language
- When processing configuration files
- For any content where syntax matters

**Real-world example:** Processing API responses, where each JSON object needs to remain valid:

```python
# Process a large API response
api_json = requests.get("https://api.example.com/large-dataset").json()
json_text = json.dumps(api_json)

with chunker.structural_context():
    json_chunks = chunker.chunk(json_text)
    
    # Each chunk will contain valid JSON
    for chunk in json_chunks:
        chunk_data = json.loads(chunk)  # Won't raise exceptions
        process_json_chunk(chunk_data)
```

**What it preserves:**
- JSON/XML validity
- Tag matching and nesting
- Code block integrity
- Function and class boundaries
- Table structures

**Tip:** For highly structured content like programming languages, structural chunking often performs better than semantic chunking.

### FIXED_SIZE
The "simple and predictable" strategy that focuses on consistent chunk sizes.

```python
chunks = chunker.adaptive_chunk_text(text, strategy=ChunkingStrategy.FIXED_SIZE)
```

**How it works:**
1. Divides text into chunks of approximately equal token counts
2. Applies overlap between chunks
3. Attempts to break at reasonable boundaries when possible
4. Prioritizes consistent sizing over structural preservation

**When to use FIXED_SIZE:**
- When predictable chunk sizes are more important than boundaries
- For performance benchmarking or testing
- When processing homogenous content
- When token usage predictability matters
- In memory-constrained environments

**Real-world example:** Creating training data for fine-tuning a model where consistent chunk sizes are desired:

```python
# Create fixed-size chunks for training data
training_chunks = []
for document in training_documents:
    with chunker.fixed_size_context(max_tokens=1024, overlap=0):
        document_chunks = chunker.chunk(document)
        training_chunks.extend(document_chunks)

# All chunks will be close to 1024 tokens
```

**Pro tip:** Even with fixed-size chunking, the system still tries to break at reasonable points like paragraph boundaries when possible, making it superior to naive character-based chunking.

### SENTENCE
The "precision-focused" strategy that strictly preserves sentence integrity.

```python
chunks = chunker.adaptive_chunk_text(text, strategy=ChunkingStrategy.SENTENCE)
```

**How it works:**
1. Identifies sentence boundaries using punctuation and capitalization
2. Never breaks mid-sentence under any circumstance
3. Keeps related sentences together when possible
4. Groups sentences to fit within token limits

**When to use SENTENCE:**
- For legal documents where sentence integrity is crucial
- When extracting facts or statements that shouldn't be fragmented
- For content where each sentence carries complete meaning
- When processing formal or technical writing

**Real-world example:** Processing legal contracts where partial sentences could change meaning:

```python
# Process a legal contract with sentence preservation
with chunker.sentence_context():
    contract_chunks = chunker.chunk(contract_text)
    
    # Each chunk will only contain complete sentences
    # No sentence will ever be split between chunks
```

**Special capability:** The SENTENCE strategy includes enhanced detection for various sentence styles, including:
- Standard periods (e.g., "This is a sentence.")
- Question marks and exclamation points
- Semicolon-separated independent clauses
- Quoted speech with proper punctuation
- Bulleted or numbered lists

**Comparative Example:**

Given this text:
```
The agreement shall terminate on December 31, 2023. In the event of early termination, 
the following conditions apply: (1) All outstanding invoices must be paid. 
(2) Confidential materials must be returned. No partial refunds will be issued.
```

**FIXED_SIZE might chunk as:**
```
Chunk 1: "The agreement shall terminate on December 31, 2023. In the event of early termination, the following conditions apply: (1) All outstanding invoices must be paid."

Chunk 2: "(2) Confidential materials must be returned. No partial refunds will be issued."
```

**SENTENCE will ensure:**
```
Chunk 1: "The agreement shall terminate on December 31, 2023."

Chunk 2: "In the event of early termination, the following conditions apply: (1) All outstanding invoices must be paid. (2) Confidential materials must be returned."

Chunk 3: "No partial refunds will be issued."
```

**Choosing the Right Strategy - Decision Guide:**

1. **Default approach**: Start with ADAPTIVE
2. **If processing narrative text**: Use SEMANTIC
3. **If processing structured data or code**: Use STRUCTURAL
4. **If consistent sizing matters most**: Use FIXED_SIZE
5. **If sentence integrity is critical**: Use SENTENCE

**Expert tip:** For the absolute best results, use a hybrid approach based on content type detection in your application:

```python
def choose_strategy(content_type, filename):
    if content_type.startswith('application/json'):
        return ChunkingStrategy.STRUCTURAL
    elif content_type.startswith('text/html'):
        return ChunkingStrategy.STRUCTURAL
    elif filename.endswith(('.py', '.js', '.java', '.cpp')):
        return ChunkingStrategy.STRUCTURAL
    elif filename.endswith(('.md', '.txt')):
        return ChunkingStrategy.SEMANTIC
    elif filename.endswith(('.doc', '.pdf')):
        return ChunkingStrategy.SENTENCE
    else:
        return ChunkingStrategy.ADAPTIVE
```

## Format-Specific Chunking

Enterprise Chunker shines in its ability to handle different content formats intelligently. Let's explore how it handles specific formats with special understanding of their structure and requirements.

### JSON Chunking

JSON is a structured data format where preserving valid structure is critical - a half-broken JSON object is useless. Enterprise Chunker's JSON handling maintains valid JSON structure in each chunk.

```python
json_chunks = chunker.adaptive_chunk_text(json_text, strategy=ChunkingStrategy.STRUCTURAL)
```

**How JSON chunking works:**
1. Parses the entire JSON structure first
2. Identifies logical boundaries (objects, arrays, properties)
3. Creates chunks along these boundaries
4. Adds metadata to maintain context between chunks
5. Ensures each chunk is valid, parseable JSON

Each chunk is a valid JSON object with metadata that looks like this:

```json
{
  "_chunk_info": {
    "index": 0,          // The chunk's position in sequence
    "type": "json_array", // Type of JSON structure
    "total": 3,          // Total number of chunks
    "has_overlap": false // Whether this chunk has overlap with previous
  },
  "data": [...]          // The actual JSON content
}
```

**When chunking JSON arrays:**
- Array items are grouped to fit within token limits
- Related items are kept together when possible
- The `data` field contains a valid array that can be parsed directly

**When chunking JSON objects:**
- Related properties are kept together
- Property names are tracked between chunks
- Nested objects are handled intelligently

**Example: Processing a large JSON API response**

```python
# Fetch a large JSON dataset
response = requests.get("https://api.example.com/large-dataset")
json_text = response.text

# Chunk with structural awareness
json_chunks = chunker.adaptive_chunk_text(json_text, strategy=ChunkingStrategy.STRUCTURAL)

# Each chunk can be parsed as valid JSON
for chunk in json_chunks:
    chunk_data = json.loads(chunk)  # Always valid JSON
    
    # Access chunk info
    chunk_index = chunk_data["_chunk_info"]["index"]
    total_chunks = chunk_data["_chunk_info"]["total"]
    
    # Access actual data - note that we can use normal JSON parsing!
    items = chunk_data["data"] 
    
    print(f"Processing chunk {chunk_index+1}/{total_chunks} with {len(items)} items")
```

**Pro tip:** You can reconstruct the original JSON by tracking the chunk info and merging appropriately:

```python
def reconstruct_json_array(chunks):
    # Parse all chunks
    parsed_chunks = [json.loads(chunk) for chunk in chunks]
    
    # Sort by index if needed
    parsed_chunks.sort(key=lambda x: x["_chunk_info"]["index"])
    
    # Combine all data
    all_items = []
    for chunk in parsed_chunks:
        all_items.extend(chunk["data"])
        
    return all_items
```

**Advanced usage - JSON path targeting:**
When dealing with deeply nested JSON, you can target specific paths for chunking:

```python
# Focus chunking on a specific path
from enterprise_chunker.strategies.formats.json_chunker import JsonChunkingStrategy

strategy = JsonChunkingStrategy()
strategy.target_path = "$.results.items"  # JSONPath expression

# Now chunking will focus on that path
chunks = strategy.chunk(json_text, options)
```

### Markdown Chunking

Markdown is a format where heading structure creates a natural hierarchy of content. Enterprise Chunker preserves this structure when chunking markdown documents.

```python
markdown_chunks = chunker.adaptive_chunk_text(markdown_text, strategy=ChunkingStrategy.STRUCTURAL)
```

**How Markdown chunking works:**
1. Identifies heading levels (# Header, ## Subheader, etc.)
2. Creates a hierarchical outline of the document
3. Chunks at appropriate heading boundaries
4. Preserves heading context across chunks
5. Maintains list structure, code blocks, and other markdown elements

A typical markdown chunk includes context from previous chunks:

```markdown
<!-- Context from previous chunk -->
# Previous Section

<!-- Current content -->
## Current Subsection
Content text...
```

**Special handling for markdown elements:**
- **Headers**: Used as primary chunk boundaries
- **Lists**: Kept intact, never split mid-list
- **Code blocks**: Preserved completely in one chunk when possible
- **Tables**: Kept intact without splitting rows
- **Block quotes**: Maintained as complete units
- **Images and links**: Preserved with proper syntax

**Real-world example: Processing documentation**

```python
# Load a markdown document
with open("documentation.md", "r") as f:
    markdown_text = f.read()

# Process with markdown awareness
chunks = chunker.adaptive_chunk_text(markdown_text, strategy=ChunkingStrategy.STRUCTURAL)

# Extract headings hierarchy from each chunk
for i, chunk in enumerate(chunks):
    headings = re.findall(r'^(#+)\s+(.*)', chunk, re.MULTILINE)
    print(f"Chunk {i+1} main heading: {headings[0][1] if headings else 'No heading'}")
```

**Practical application: Building a document outline**

```python
def extract_document_structure(markdown_text):
    chunker = EnterpriseChunker()
    chunks = chunker.adaptive_chunk_text(markdown_text, strategy=ChunkingStrategy.STRUCTURAL)
    
    document_outline = []
    for chunk in chunks:
        # Extract all headings with their levels
        headings = re.findall(r'^(#+)\s+(.*)', chunk, re.MULTILINE)
        for h_marks, h_text in headings:
            level = len(h_marks)  # Number of # symbols
            document_outline.append((level, h_text))
    
    return document_outline
```

**Pro tip:** When processing documentation, combine with semantic understanding:

```python
# Process technical docs intelligently
def process_technical_docs(markdown_text):
    # First split by structural boundaries
    chunker = EnterpriseChunker()
    structural_chunks = chunker.adaptive_chunk_text(
        markdown_text, 
        strategy=ChunkingStrategy.STRUCTURAL
    )
    
    results = []
    for chunk in structural_chunks:
        # Analyze heading level to determine importance
        headings = re.findall(r'^(#+)\s+(.*)', chunk, re.MULTILINE)
        if not headings:
            continue
            
        main_heading = headings[0]
        heading_level = len(main_heading[0])  # Number of # symbols
        heading_text = main_heading[1]
        
        # Apply different processing based on section type
        if "Installation" in heading_text:
            # Extract installation requirements
            requirements = extract_requirements(chunk)
            results.append({"type": "installation", "data": requirements})
            
        elif "API Reference" in heading_text or heading_level <= 2:
            # Important reference section
            api_details = extract_api_details(chunk)
            results.append({"type": "api_reference", "data": api_details})
            
        else:
            # Regular content
            summary = summarize_section(chunk)
            results.append({"type": "content", "data": summary})
    
    return results
```

### Code Chunking

Enterprise Chunker has specialized handling for various programming languages that respects the structure of code.

```python
code_chunks = chunker.adaptive_chunk_text(code_text, strategy=ChunkingStrategy.STRUCTURAL)
```

**How code chunking works:**
1. Detects the programming language (Python, JavaScript, Java, etc.)
2. Identifies structural elements (functions, classes, methods)
3. Respects scope and nesting (brackets, indentation)
4. Preserves import statements and context between chunks
5. Adds necessary context comments between chunks

**Languages with special handling:**
- **Python**: Respects indentation-based scope, detects classes and functions
- **JavaScript/TypeScript**: Understands function declarations, classes, and modules
- **Java/C#**: Recognizes class structure, methods, and package/namespace
- **React/Vue**: Special handling for component structure
- **Smalltalk**: Specialized for Smalltalk method and class handling

**Example: Processing a Python codebase**

```python
# Process a Python file
with open("source_code.py", "r") as f:
    python_code = f.read()

# Chunk with code awareness
code_chunks = chunker.adaptive_chunk_text(
    python_code, 
    strategy=ChunkingStrategy.STRUCTURAL,
    max_tokens_per_chunk=1500
)

# Analyze chunks
for i, chunk in enumerate(code_chunks):
    # Check for function definitions
    functions = re.findall(r'def\s+(\w+)\s*\(', chunk)
    classes = re.findall(r'class\s+(\w+)', chunk)
    
    print(f"Chunk {i+1}:")
    print(f"  Classes: {', '.join(classes) or 'None'}")
    print(f"  Functions: {', '.join(functions) or 'None'}")
```

**Special feature: React/Vue component chunking**

The chunker has specialized handling for React and Vue components:

```python
# Detect if a file is a React component
from enterprise_chunker.strategies.formats.react_vue_chunker import ReactVueChunkingStrategy

strategy = ReactVueChunkingStrategy()
is_component = strategy._detect_react_component(code)  # Or _detect_vue_component

if is_component:
    # Use special component chunking
    chunks = chunker.adaptive_chunk_text(code, strategy=ChunkingStrategy.STRUCTURAL)
```

**Pro tip for code analysis:** When analyzing code, combine with language-specific parsing:

```python
# For serious code analysis, combine with ast module
import ast

def analyze_python_code(code_text):
    # First chunk the code structurally
    chunker = EnterpriseChunker()
    chunks = chunker.adaptive_chunk_text(code_text, strategy=ChunkingStrategy.STRUCTURAL)
    
    # Analyze each chunk with AST
    for chunk in chunks:
        try:
            # Parse chunk into AST
            module = ast.parse(chunk)
            
            # Extract function and class definitions
            functions = [node.name for node in module.body if isinstance(node, ast.FunctionDef)]
            classes = [node.name for node in module.body if isinstance(node, ast.ClassDef)]
            
            # Deeper analysis...
            for node in ast.walk(module):
                if isinstance(node, ast.Call):
                    # Analyze function calls
                    pass
        except SyntaxError:
            # Some chunks might not be complete statements
            # This is expected when chunking code
            pass
```

### HTML/XML Chunking

HTML and XML are structured formats with nested tags. Enterprise Chunker preserves this structure:

```python
html_chunks = chunker.adaptive_chunk_text(html_text, strategy=ChunkingStrategy.STRUCTURAL)
```

**How HTML/XML chunking works:**
1. Parses the document structure to understand tag hierarchy
2. Identifies logical sections (divs, sections, articles)
3. Ensures tags are properly balanced in each chunk
4. Preserves parent context when splitting nested structures
5. Adds metadata comments to maintain context

**Special handling:**
- HTML semantics (headers, sections, articles) guide chunking
- Table structures are kept intact
- List elements are kept together
- Script and style blocks are not broken internally
- Tag attributes are preserved intact

**Example: Processing an HTML document**

```python
from bs4 import BeautifulSoup

# Process an HTML file
with open("webpage.html", "r") as f:
    html_content = f.read()

# Chunk with HTML awareness
html_chunks = chunker.adaptive_chunk_text(html_content, strategy=ChunkingStrategy.STRUCTURAL)

# Analyze chunks with Beautiful Soup
for i, chunk in enumerate(html_chunks):
    soup = BeautifulSoup(chunk, 'html.parser')
    
    # Extract key elements
    headings = soup.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
    paragraphs = soup.find_all('p')
    
    print(f"Chunk {i+1}:")
    print(f"  Headings: {len(headings)}")
    print(f"  Paragraphs: {len(paragraphs)}")
    
    if headings:
        print(f"  Main heading: {headings[0].text.strip()}")
```

### CSV and Tabular Data Chunking

Spreadsheet data requires special handling to maintain row integrity and header context:

```python
csv_chunks = chunker.adaptive_chunk_text(csv_text, strategy=ChunkingStrategy.STRUCTURAL)
```

**How CSV chunking works:**
1. Identifies the delimiter (comma, tab, semicolon)

### Code Chunking

Respects method and class boundaries:

```python
code_chunks = chunker.adaptive_chunk_text(code_text, strategy=ChunkingStrategy.STRUCTURAL)
```

Special support for:
- Python, JavaScript, Java, C#
- React and Vue components
- Smalltalk

### XML/HTML Chunking

Preserves tag structure and nesting:

```python
xml_chunks = chunker.adaptive_chunk_text(xml_text, strategy=ChunkingStrategy.STRUCTURAL)
```

## Memory Optimization

For processing large files with minimal memory impact:

```python
from enterprise_chunker.utils.memory_optimization import MemoryManager

# Create memory manager
memory_manager = MemoryManager(low_memory_mode=True)

# Process with memory optimization
with memory_manager.memory_efficient_context(memory_limit_mb=1000):
    # Process large document
    content = memory_manager.get_content(large_content_or_path)
    chunks = chunker.chunk(content)
```

Memory-efficient streaming:

```python
from enterprise_chunker.utils.memory_optimization import MemoryEfficientIterator

# Create iterator with processor function
iterator = MemoryEfficientIterator(processor_func)

# Process file with minimal memory usage
for result in iterator.iter_file('huge_file.txt'):
    process_result(result)
```

## Parallel Processing

The orchestration layer provides sophisticated parallel processing:

```python
from enterprise_chunker import SmartParallelChunker, ChunkingOptions

# Create options
options = ChunkingOptions(max_tokens_per_chunk=2000)

# Create parallel chunker
parallel_chunker = SmartParallelChunker(
    options=options,
    size_threshold=100_000,  # 100KB threshold for strategy selection
    complexity_threshold=0.5,
    memory_safety=True,
    adaptive_batch_sizing=True
)

# Process with automatic strategy selection
chunks = parallel_chunker.chunk(text, lambda x: x.split('\n'))
```

### Quality of Service (QoS) Prioritization

```python
# Process with high priority
high_priority_chunks = parallel_chunker.chunk_with_priority(
    text, 
    chunker_func,
    priority='high'  # 'high', 'normal', or 'background'
)
```

## Performance Monitoring

```python
# Get detailed metrics
metrics = parallel_chunker.get_metrics()

print(f"System health: {metrics['system']['health_status']}")
print(f"Circuit breaker: {metrics['system']['circuit_breaker']}")
print(f"Average throughput: {metrics['avg_throughput']:.2f} chunks/second")
print(f"Average processing time: {metrics['avg_processing_time']:.3f}s")
print(f"Memory usage: {metrics['system']['memory_percent']:.1f}%")

# Reset metrics
parallel_chunker.reset_metrics()
```

Enable Prometheus metrics:

```python
from enterprise_chunker import start_monitoring_server

# Start metrics server on port 8000
start_monitoring_server(port=8000)

# Create chunker with metrics enabled
smart_chunker = create_auto_chunker(
    options,
    enable_metrics_server=True,
    metrics_port=8000
)
```

## Extending Enterprise Chunker

### Custom Chunking Strategy

```python
from enterprise_chunker.strategies.base import BaseChunkingStrategy
from enterprise_chunker.models.enums import ContentFormat, ChunkingStrategy

class MyCustomStrategy(BaseChunkingStrategy):
    def __init__(self):
        super().__init__(ContentFormat.TEXT)
        
    def detect_boundaries(self, text, options):
        # Custom boundary detection
        boundaries = []
        # ...
        return boundaries
        
    def _get_chunking_strategy(self):
        return ChunkingStrategy.SEMANTIC
```

### Custom Token Estimator

```python
from enterprise_chunker.utils.token_estimation import BaseTokenEstimator

class MyTokenEstimator(BaseTokenEstimator):
    def _calculate_estimate(self, features, text):
        # Custom token calculation
        # ...
        return estimated_tokens
```

## Environment Variables

Enterprise Chunker can be configured with environment variables:

```bash
# Set maximum tokens per chunk
export CHUNKER_MAX_TOKENS_PER_CHUNK=2000

# Set chunking strategy
export CHUNKER_CHUNKING_STRATEGY=semantic

# Set token estimation strategy
export CHUNKER_TOKEN_STRATEGY=precision

# Enable/disable format detection
export CHUNKER_ENABLE_FORMAT_DETECTION=true

# Set overlap tokens
export CHUNKER_OVERLAP_TOKENS=100
```

## API Reference

### EnterpriseChunker

```python
class EnterpriseChunker:
    def __init__(self, options: Optional[Dict[str, Any]] = None):
        """Initialize with options dictionary"""
        
    def adaptive_chunk_text(
        self, 
        text: str, 
        max_tokens_per_chunk: Optional[int] = None,
        overlap_tokens: Optional[int] = None,
        strategy: Optional[Union[str, ChunkingStrategy]] = None
    ) -> List[str]:
        """Main chunking method with adaptable options"""
        
    def chunk_stream(
        self, 
        stream: Union[str, io.TextIOBase], 
        **kwargs
    ) -> Generator[str, None, None]:
        """Process text stream with chunking"""
        
    def with_max_tokens(self, max_tokens: int) -> 'EnterpriseChunker':
        """Fluent API for setting max tokens"""
        
    def with_overlap(self, overlap_tokens: int) -> 'EnterpriseChunker':
        """Fluent API for setting overlap tokens"""
        
    def with_strategy(self, strategy: ChunkingStrategy) -> 'EnterpriseChunker':
        """Fluent API for setting chunking strategy"""
        
    def chunk(self, text: str) -> List[str]:
        """Simple chunking with current configuration"""
        
    # Context managers for specific chunking strategies
    def semantic_context(self, max_tokens=None, overlap=None):
        """Context for semantic chunking"""
        
    def structural_context(self, max_tokens=None, overlap=None):
        """Context for structural chunking"""
        
    def fixed_size_context(self, max_tokens=None, overlap=None):
        """Context for fixed-size chunking"""
        
    def sentence_context(self, max_tokens=None, overlap=None):
        """Context for sentence-based chunking"""
```

### SmartParallelChunker

```python
class SmartParallelChunker:
    def __init__(
        self,
        options: ChunkingOptions,
        size_threshold: int = 100_000,
        complexity_threshold: float = 0.5,
        sample_size: int = 1000,
        force_strategy: Optional[str] = None,
        timeout: float = 300.0,
        max_retries: int = 3,
        memory_safety: bool = True,
        adaptive_batch_sizing: bool = True,
        health_check_enabled: bool = True,
        worker_count_override: Optional[int] = None,
        resource_monitor_interval: float = 5.0,
        config: Optional[DynamicConfig] = None,
    ):
        """Initialize smart parallel chunker"""
        
    def chunk(self, text: str, chunker_func: Callable[[str], List[str]]) -> List[str]:
        """Process text with automatic strategy selection"""
        
    def stream_chunks(
        self,
        segment_gen: Generator[str, None, None],
        chunker_func: Callable[[str], List[str]]
    ) -> Generator[str, None, None]:
        """Stream chunks with memory efficiency"""
        
    def chunk_with_priority(
        self, 
        text: str, 
        chunker_func: Callable[[str], List[str]], 
        priority: str = 'normal'
    ) -> List[str]:
        """Process with QoS priority"""
        
    def get_metrics(self) -> Dict[str, Any]:
        """Get detailed performance metrics"""
        
    def reset_metrics(self) -> None:
        """Reset performance metrics"""
        
    def shutdown(self) -> None:
        """Gracefully shut down and release resources"""
```

### Factory Functions

```python
def create_auto_chunker(
    options: ChunkingOptions,
    mode: str = "auto",
    memory_safety: bool = True,
    timeout: float = 300.0,
    config: Optional[DynamicConfig] = None,
    enable_metrics_server: bool = False,
    metrics_port: int = 8000,
) -> SmartParallelChunker:
    """Create pre-configured chunker instance"""
    
def start_monitoring_server(port: int = 8000) -> bool:
    """Start Prometheus metrics server"""
```

## Troubleshooting

### Performance Issues

If you're experiencing slow processing:

1. **Use the right token strategy**: For very large files, use `TokenEstimationStrategy.PERFORMANCE`
2. **Adjust batch size**: Set `adaptive_batch_sizing=True` in `SmartParallelChunker`
3. **Disable memory safety**: If memory isn't a concern, set `memory_safety=False`

### Memory Problems

If you're running into memory issues:

1. **Enable memory safety**: Set `memory_safety=True`
2. **Use streaming**: Process files with `chunk_stream()` instead of loading entirely
3. **Reduce overlap**: Lower `overlap_tokens` to reduce redundancy

### Inaccurate Chunking

If chunks aren't preserving structure correctly:

1. **Try structural strategy**: Use `ChunkingStrategy.STRUCTURAL` explicitly
2. **Format-specific chunking**: Use specialized chunkers for JSON, Markdown, etc.
3. **Check format detection**: Make sure format is being detected correctly

### Uneven Chunk Sizes

If chunks vary too much in size:

1. **Adjust safety margin**: Lower `safety_margin` (e.g., 0.8 instead of 0.9)
2. **Use fixed size chunking**: Try `ChunkingStrategy.FIXED_SIZE` 
3. **Set max_chunk_size_chars**: Add explicit character limit

### Error Recovery

The system includes automatic error recovery:

1. **Retry mechanism**: Failed operations retry automatically
2. **Circuit breaker**: Prevents cascading failures under system pressure
3. **Fallback strategies**: If advanced chunking fails, simpler methods are used

For persistent issues, check logs and consider enabling metrics for detailed performance data.

---

This guide covers the core functionality of Enterprise Chunker. For more specific use cases or custom integrations, refer to the codebase or contact the maintainers.
