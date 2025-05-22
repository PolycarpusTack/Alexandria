# Enterprise Chunker: The Ultimate Guide

![Enterprise Chunker](https://via.placeholder.com/800x200?text=Enterprise+Chunker)

[![Launch Binder](https://mybinder.org/badge_logo.svg)](https://mybinder.org/v2/gh/enterprise-chunker/examples/main?filepath=tutorials/getting_started.ipynb) 
[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/enterprise-chunker/examples/blob/main/tutorials/getting_started.ipynb)
[![Documentation](https://img.shields.io/badge/api-reference-blue.svg)](https://enterprise-chunker.readthedocs.io/en/latest/api/)
[![PyPI version](https://badge.fury.io/py/enterprise-chunker.svg)](https://badge.fury.io/py/enterprise-chunker)

<div class="search-container">
    <input type="text" id="search-input" placeholder="Search documentation...">
    <div id="search-results"></div>
</div>

---

## 🟢 **1. Overview & Introduction**

### What is Enterprise Chunker?

Enterprise Chunker is a powerful and intelligent text [chunking](#chunking) library designed to break down large documents into smaller, meaningful pieces (or "chunks") that can be processed by [Large Language Models](#large-language-model-llm) (LLMs) like GPT-4 or Claude. 

### Why does it exist?

Most LLMs have a limited "[context window](#context-window)" - they can only process a certain amount of text at once (typically several thousand [tokens](#token)). When you need to work with larger documents like research papers, code files, or lengthy reports, you need to split them into smaller pieces that fit within these limits. But splitting text randomly can break the meaning and structure of the content.

Enterprise Chunker solves this problem by intelligently splitting content while preserving its meaning and structure.

### Who is it designed for?

- **Developers** building applications that use LLMs
- **Data scientists** working with large text datasets
- **AI engineers** creating [retrieval-augmented generation](#retrieval-augmented-generation-rag) (RAG) systems
- **Enterprise software teams** processing large volumes of documents

### How does it fit into the bigger picture?

In the AI/LLM ecosystem, Enterprise Chunker sits between your raw documents and the LLM processing pipeline:

```
Raw Documents → Enterprise Chunker → Optimized Chunks → LLM Processing → Insights/Responses
```

It's a critical component in any system that needs to feed large documents into LLMs efficiently.

### The Librarian Analogy

Think of Enterprise Chunker as an expert librarian. If you brought a massive 1,000-page book to a student who can only read 4 pages at a time, a good librarian wouldn't just tear the book into 250 random 4-page sections. Instead, they would carefully divide it by chapters, sections, and natural breaks in the content, ensuring each chunk makes sense on its own while preserving the overall structure.

Enterprise Chunker does exactly this for your text data - it finds the natural "chapters" and "sections" in your content to create meaningful chunks that LLMs can process effectively.

---

## 🚧 **2. Necessary Dependencies & Installation**

### Required Dependencies

Enterprise Chunker has been designed with minimal external dependencies to ensure easy integration into your projects:

**Core Dependencies:**
- Python 3.8 or higher
- `psutil` - For system resource monitoring
- `numpy` - For numerical operations (optional but recommended)
- `prometheus_client` - For metrics collection (optional)
- `requests` - For remote configuration updates (optional)

**Format-Specific Dependencies (Optional):**
- `regex` - Enhanced regular expression support for complex pattern matching

### Installation

You can install Enterprise Chunker using pip:

```bash
# Core installation
pip install enterprise-chunker

# With all optional dependencies
pip install enterprise-chunker[all]

# Development version (with testing utilities)
pip install enterprise-chunker[dev]
```

### Version Compatibility

Enterprise Chunker is designed to work with:
- Python 3.8+
- Most major LLM frameworks and APIs
- Common document processing pipelines

### Potential Installation Issues

**Problem:** Import errors related to missing optional dependencies

**Solution:** Install the specific optional dependency:
```bash
pip install regex  # For enhanced pattern matching
pip install numpy  # For advanced numerical operations
pip install prometheus_client  # For metrics
```

**Problem:** Version conflicts with existing packages

**Solution:** Consider using a virtual environment:
```bash
python -m venv chunker-env
source chunker-env/bin/activate  # On Windows: chunker-env\Scripts\activate
pip install enterprise-chunker
```

---

## 🎈 **3. For Beginners: Setting Up a Starter Project (Extra Detailed)**

Let's create a simple project from scratch that uses Enterprise Chunker to process a document.

### Step 1: Set up your environment

First, let's create a folder for our project and set up a virtual environment:

```bash
# Create a project folder
mkdir my-chunker-project
cd my-chunker-project

# Create a virtual environment
python -m venv venv

# Activate the virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate
```

### Step 2: Install Enterprise Chunker

With your virtual environment activated, install Enterprise Chunker:

```bash
pip install enterprise-chunker
```

### Step 3: Create a simple text file to process

Create a file named `sample.txt` in your project folder with some text to chunk. You can use any text editor (like Notepad, VS Code, etc.). Here's how to do it from the command line:

```bash
# On Windows:
echo "# Sample Document\n\nThis is a sample document with multiple paragraphs.\n\n## Section 1\n\nHere is some content for section 1.\n\n## Section 2\n\nHere is content for section 2." > sample.txt

# On macOS/Linux:
cat > sample.txt << EOF
# Sample Document

This is a sample document with multiple paragraphs.

## Section 1

Here is some content for section 1.

## Section 2

Here is content for section 2.
EOF
```

### Step 4: Create your first chunking script

Using any text editor, create a file named `simple_chunker.py` with the following code:

```python
from enterprise_chunker import EnterpriseChunker, ChunkingStrategy

# Initialize the chunker
chunker = EnterpriseChunker()

# Read the sample file
with open('sample.txt', 'r') as file:
    text = file.read()

# Break the text into chunks
chunks = chunker.adaptive_chunk_text(
    text=text,
    max_tokens_per_chunk=100,  # Max tokens per chunk
    overlap_tokens=20,         # Overlap between chunks
    strategy=ChunkingStrategy.SEMANTIC  # Use semantic chunking
)

# Print the chunks
print(f"Split into {len(chunks)} chunks:")
for i, chunk in enumerate(chunks):
    print(f"\n--- Chunk {i+1} ---")
    print(chunk[:100] + "..." if len(chunk) > 100 else chunk)
```

### Step 5: Run your script

Run the script from your command line:

```bash
python simple_chunker.py
```

You should see output showing how the document was split into chunks, with each chunk preserving the semantic structure of the text.

### Step 6: Explore different chunking strategies

Now, let's modify our script to try different chunking strategies. Update the `simple_chunker.py` file:

```python
from enterprise_chunker import EnterpriseChunker, ChunkingStrategy

# Initialize the chunker
chunker = EnterpriseChunker()

# Read the sample file
with open('sample.txt', 'r') as file:
    text = file.read()

# Try different strategies
strategies = [
    ChunkingStrategy.SEMANTIC,   # Semantic boundaries
    ChunkingStrategy.FIXED_SIZE, # Fixed size chunks
    ChunkingStrategy.SENTENCE,   # Split by sentences
    ChunkingStrategy.STRUCTURAL, # Format-aware splitting
    ChunkingStrategy.ADAPTIVE    # Automatically select best strategy
]

# Test each strategy
for strategy in strategies:
    print(f"\n\n=== Testing {strategy.value} strategy ===\n")
    
    chunks = chunker.adaptive_chunk_text(
        text=text,
        max_tokens_per_chunk=100,
        overlap_tokens=20,
        strategy=strategy
    )
    
    print(f"Split into {len(chunks)} chunks:")
    for i, chunk in enumerate(chunks):
        print(f"\n--- Chunk {i+1} ---")
        print(chunk[:100] + "..." if len(chunk) > 100 else chunk)
```

Run the updated script to see how different strategies handle the same text:

```bash
python simple_chunker.py
```

Congratulations! You've successfully set up and run your first Enterprise Chunker project. You've seen how it can split text using different strategies while preserving the meaning and structure of the content.

---

## 🧩 **4. Detailed Functional Breakdown**

Let's explore the main functions and features of Enterprise Chunker:

### 4.1. Adaptive Chunking

#### a. **ELI5 Explanation**
[Adaptive chunking](#adaptive-chunking) is like having a smart assistant who knows exactly how to divide up a book based on what kind of book it is. If it's a novel, it might split by chapters; if it's a technical manual, it might split by sections; if it's a cookbook, it might split by recipes.

#### b. **Real-World Example**
Imagine you're organizing a library. For fiction books, you organize by author and genre. For reference books, you organize by subject and subtopic. For magazines, you organize by date and issue. Enterprise Chunker does the same thing with text - it recognizes the type of content and applies the most appropriate splitting method.

#### c. **How to Use (Step-by-Step)**
```python
from enterprise_chunker import EnterpriseChunker

chunker = EnterpriseChunker()

# The chunker will automatically detect the format and apply the best strategy
chunks = chunker.adaptive_chunk_text(
    text=your_text,
    max_tokens_per_chunk=1000,  # Adjust based on your LLM's limits
    overlap_tokens=100          # Amount of overlap between chunks
)
```

#### d. **Impact & Importance**
Adaptive chunking dramatically improves how well LLMs understand your documents because they receive chunks that preserve natural boundaries in the text. This leads to better comprehension, more accurate responses, and fewer hallucinations or misunderstandings.

### 4.2. Format-Specific Chunking

#### a. **ELI5 Explanation**
Different types of files need different ways of splitting them. JSON files have special structures with curly braces and square brackets. Markdown files have headings and lists. Code files have functions and classes. Format-specific chunking understands these different structures and splits files in ways that respect their unique formats.

#### b. **Real-World Example**
Think about cutting different foods: you cut a pizza along the slices, a cake in wedges or squares, and a sandwich diagonally. Each food has a natural way to be divided. Similarly, Enterprise Chunker knows how to "cut" different file formats along their natural lines.

#### c. **How to Use (Step-by-Step)**
```python
from enterprise_chunker import EnterpriseChunker, ChunkingStrategy

chunker = EnterpriseChunker()

# For a JSON file:
json_chunks = chunker.adaptive_chunk_text(
    text=json_text,
    strategy=ChunkingStrategy.STRUCTURAL  # Use structural awareness
)

# For a Markdown file:
markdown_chunks = chunker.adaptive_chunk_text(
    text=markdown_text,
    strategy=ChunkingStrategy.STRUCTURAL  # Same strategy, different internal handling
)

# For React or Vue components:
react_chunks = chunker.adaptive_chunk_text(
    text=react_component_code,
    strategy=ChunkingStrategy.STRUCTURAL
)
```

#### d. **Impact & Importance**
Format-specific chunking ensures that specialized file formats maintain their structure and meaning after chunking. This is crucial for code files, structured data (JSON/XML), and formatted documents (Markdown), where breaking at arbitrary points could destroy the document's semantics.

### 4.3. Memory-Efficient Processing

#### a. **ELI5 Explanation**
When processing really big documents, a computer can run out of memory - just like you might run out of space on a desk when working with too many papers. Memory-efficient processing is like having a clever filing system that only keeps a small portion of the document on your desk at any time.

#### b. **Real-World Example**
Imagine you're digitizing a massive book library. Instead of scanning the entire library at once (which would require enormous storage), you scan one shelf at a time, process those books, and then move to the next shelf. Enterprise Chunker uses similar techniques to handle gigabytes of text without using gigabytes of memory.

#### c. **How to Use (Step-by-Step)**
```python
from enterprise_chunker import EnterpriseChunker
from enterprise_chunker.utils.memory_optimization import MemoryManager

# Create a memory manager with low memory mode enabled
memory_manager = MemoryManager(low_memory_mode=True)

# Use it with the chunking process
with memory_manager.memory_efficient_context():
    chunker = EnterpriseChunker()
    
    # Process a large file in streaming mode
    with open('very_large_file.txt', 'r') as file:
        # Process the file as a stream instead of loading it all at once
        chunks = list(chunker.chunk_stream(file))
```

#### d. **Impact & Importance**
Memory-efficient processing allows you to work with extremely large documents (gigabytes in size) even on machines with limited memory. Without these optimizations, your program might crash when trying to process large corporate documents, research papers, or code repositories.

### 4.4. Parallel Processing

#### a. **ELI5 Explanation**
[Parallel processing](#parallel-processing) is like having multiple helpers work on different parts of a task simultaneously. Instead of one person reading through a whole book, ten people each read a chapter at the same time, making the entire process much faster.

#### b. **Real-World Example**
Consider an assembly line in a factory where different workers perform different tasks simultaneously, rather than having one worker complete the entire product. This parallel approach significantly speeds up production. The same concept applies to chunking large documents.

#### c. **How to Use (Step-by-Step)**
```python
from enterprise_chunker.orchestrator import create_auto_chunker
from enterprise_chunker.config import ChunkingOptions

# Create chunking options
options = ChunkingOptions(
    max_tokens_per_chunk=1000,
    overlap_tokens=100
)

# Create a smart parallel chunker
parallel_chunker = create_auto_chunker(
    options=options,
    mode="performance"  # Optimize for speed
)

# Define a chunking function
def my_chunker_func(text):
    # Your chunking logic here
    return [text]  # Simple example

# Process text with parallel execution
chunks = parallel_chunker.chunk(large_text, my_chunker_func)
```

#### d. **Impact & Importance**
Parallel processing can dramatically reduce the time needed to chunk large documents. What might take minutes sequentially could be completed in seconds with parallel processing, making it essential for applications with real-time requirements or batch processing of large document collections.

### 4.5. Token Estimation

#### a. **ELI5 Explanation**
LLMs process text in units called "[tokens](#token)" (roughly equivalent to parts of words). Token estimation is like predicting how many bites it will take to eat a sandwich before you start eating. This helps you plan better and avoid trying to fit too much text into one chunk.

#### b. **Real-World Example**
When packing for a trip, you estimate how many clothes will fit in your suitcase before actually packing. Similarly, token estimation predicts how many tokens a piece of text will use, helping you make better chunking decisions without trial and error.

#### c. **How to Use (Step-by-Step)**
```python
from enterprise_chunker.utils.token_estimation import estimate_tokens
from enterprise_chunker.models.enums import TokenEstimationStrategy

# Estimate tokens with default balanced strategy
token_count = estimate_tokens("Your text goes here")

# Choose a specific estimation strategy
precise_count = estimate_tokens(
    "Your text goes here",
    strategy=TokenEstimationStrategy.PRECISION  # More accurate but slower
)

performance_count = estimate_tokens(
    "Your text goes here",
    strategy=TokenEstimationStrategy.PERFORMANCE  # Faster but less accurate
)
```

#### d. **Impact & Importance**
Accurate token estimation ensures you create chunks that fit within an LLM's [context window](#context-window) without wasting space. This optimizes both cost (as many LLM APIs charge per token) and performance (by maximizing the use of available context).

---

## 📈 **5. Gradual Complexity & Advanced Usage**

As you become more comfortable with the basics of Enterprise Chunker, you can explore more advanced features to handle complex scenarios and optimize performance.

### Beginner Level: Basic Configuration

At the most basic level, you can configure the chunker with simple settings:

```python
from enterprise_chunker import EnterpriseChunker

# Create a chunker with default settings
chunker = EnterpriseChunker()

# Simple chunking with basic parameters
chunks = chunker.adaptive_chunk_text(
    text=your_document,
    max_tokens_per_chunk=1000,
    overlap_tokens=100
)
```

This approach works well for most standard documents and provides a good balance of simplicity and effectiveness.

### Intermediate Level: Specialized Strategies and Fluent API

As you gain familiarity, you can leverage specialized chunking strategies and the fluent API for more control:

```python
from enterprise_chunker import EnterpriseChunker, ChunkingStrategy

# Create a base chunker
chunker = EnterpriseChunker()

# Use the fluent API for more readable configuration
result = chunker \
    .with_max_tokens(2000) \
    .with_overlap(150) \
    .with_strategy(ChunkingStrategy.SEMANTIC) \
    .chunk(your_document)

# Use context managers for temporary configuration changes
with chunker.semantic_context(max_tokens=1500, overlap=200):
    semantic_chunks = chunker.chunk(document1)

with chunker.structural_context(max_tokens=1000, overlap=100):
    structural_chunks = chunker.chunk(document2)
```

This level of control allows you to tailor the chunking process to specific document types or requirements.

### Expert Level: Advanced Orchestration and Optimization

For power users, Enterprise Chunker offers sophisticated orchestration capabilities with automatic resource management:

```python
from enterprise_chunker.orchestrator import create_auto_chunker, DynamicConfig
from enterprise_chunker.config import ChunkingOptions
from enterprise_chunker.models.enums import ChunkingStrategy

# Create a custom configuration
config = DynamicConfig({
    'processing_timeout': 120.0,
    'max_retries': 3,
    'memory_safety': True,
    'dynamic_batch_sizing': True,
    'enable_ml_segmentation': False,
})

# Create options with detailed parameters
options = ChunkingOptions(
    max_tokens_per_chunk=1500,
    overlap_tokens=200,
    chunking_strategy=ChunkingStrategy.ADAPTIVE,
    token_strategy=TokenEstimationStrategy.PRECISION,
    preserve_structure=True,
    safety_margin=0.95,
    stream_buffer_size=200000,
)

# Create an advanced auto-tuning chunker
smart_chunker = create_auto_chunker(
    options=options,
    mode="balanced",  # Other options: "performance", "memory-safe"
    memory_safety=True,
    timeout=300.0,
    config=config,
    enable_metrics_server=True,
    metrics_port=8000
)

# Define your chunking function
def advanced_chunking(text):
    # Custom logic here
    return [text]  # Simplified example

# Process with priority-based QoS
high_priority_chunks = smart_chunker.chunk_with_priority(
    critical_document, 
    advanced_chunking,
    priority="high"
)

# Get performance metrics
metrics = smart_chunker.get_metrics()
print(f"Processed {metrics['total_chunks_processed']} chunks")
print(f"Average throughput: {metrics['avg_throughput']:.2f} chunks/second")
```

At this level, you gain access to:
- Dynamic resource scaling
- Performance monitoring and metrics
- Quality of Service (QoS) prioritization
- Memory safety protections
- [Circuit breaker](#circuit-breaker) patterns for fault tolerance
- Parallel processing optimizations

### Expert Feature: Format-Specific Custom Options

For specialized document formats, you can leverage format-specific strategies with custom configurations:

```python
# For JSON documents with deep nesting
json_chunks = chunker.adaptive_chunk_text(
    text=complex_json,
    strategy=ChunkingStrategy.STRUCTURAL,
    max_tokens_per_chunk=2000,  # Larger chunks for preserving structure
    overlap_tokens=50  # Less overlap needed for structured data
)

# For Markdown documents with complex formatting
markdown_chunks = chunker.adaptive_chunk_text(
    text=markdown_doc,
    strategy=ChunkingStrategy.STRUCTURAL,
    max_tokens_per_chunk=1000,
    overlap_tokens=200  # More overlap to maintain context
)

# For code files (like React components)
code_chunks = chunker.adaptive_chunk_text(
    text=react_code,
    strategy=ChunkingStrategy.STRUCTURAL,
    max_tokens_per_chunk=1500
)
```

These specialized configurations ensure optimal handling of different document types while respecting their unique structures.

---

## 📘 **6. Step-by-Step Practical Examples & Tutorials**

### Example 1: Processing a Large Markdown Article (Beginner)

Let's walk through processing a large Markdown article, like a blog post or documentation.

```python
from enterprise_chunker import EnterpriseChunker, ChunkingStrategy

# Step 1: Initialize the chunker
chunker = EnterpriseChunker()

# Step 2: Load the Markdown file
with open('large_article.md', 'r', encoding='utf-8') as file:
    markdown_text = file.read()

# Step 3: Configure chunking settings
max_tokens = 1000  # Adjust based on your LLM's limits
overlap = 100      # Amount of overlap between chunks

# Step 4: Process the document
chunks = chunker.adaptive_chunk_text(
    text=markdown_text,
    max_tokens_per_chunk=max_tokens,
    overlap_tokens=overlap,
    strategy=ChunkingStrategy.STRUCTURAL  # Good for Markdown
)

# Step 5: Use the chunks (here we'll just print info about them)
print(f"Split document into {len(chunks)} chunks")
for i, chunk in enumerate(chunks):
    print(f"Chunk {i+1}: {len(chunk)} characters")
    # Here you would typically send the chunk to an LLM, store it, etc.
```

**Input:** A Markdown article with headings, lists, code blocks, etc.
**Output:** A series of chunks that respect the Markdown structure, with each chunk maintaining proper context.

### Example 2: Creating a Document Q&A System (Intermediate)

This example shows how to build a simple question-answering system using Enterprise Chunker and an LLM API.

```python
from enterprise_chunker import EnterpriseChunker
import requests  # For API calls to your LLM provider
import json

# Step 1: Initialize the chunker
chunker = EnterpriseChunker()

# Step 2: Load and chunk a document
with open('technical_manual.txt', 'r', encoding='utf-8') as file:
    document = file.read()

chunks = chunker.adaptive_chunk_text(
    text=document,
    max_tokens_per_chunk=1500,
    overlap_tokens=150
)

# Step 3: Define a function to query the LLM with a chunk
def query_llm(chunk, question):
    # This is a placeholder - replace with your actual LLM API call
    api_url = "https://your-llm-api-endpoint.com/generate"
    
    payload = {
        "model": "your-model-name",
        "prompt": f"Based on the following text, answer the question.\n\nText: {chunk}\n\nQuestion: {question}\n\nAnswer:",
        "max_tokens": 200
    }
    
    response = requests.post(api_url, json=payload)
    return response.json()["text"]

# Step 4: Create a function to answer questions about the document
def answer_question(document_chunks, question):
    all_answers = []
    
    # Query each chunk and collect answers
    for i, chunk in enumerate(document_chunks):
        print(f"Querying chunk {i+1}/{len(document_chunks)}...")
        answer = query_llm(chunk, question)
        all_answers.append({"chunk": i+1, "answer": answer})
    
    # Find the best answer (or combine them - this is simplified)
    # In a real system, you might use embeddings to find relevant chunks first
    best_answer = max(all_answers, key=lambda x: len(x["answer"]))
    
    return best_answer["answer"]

# Step 5: Answer questions
question = "How do I troubleshoot network connectivity issues?"
answer = answer_question(chunks, question)
print(f"Question: {question}")
print(f"Answer: {answer}")
```

**Input:** A technical manual or documentation file and a user question
**Output:** An answer to the question based on the content of the document

### Example 3: Advanced Streaming Processing of Gigabyte-Scale Logs (Expert)

This example demonstrates how to process extremely large log files in a memory-efficient way while extracting structured information.

```python
from enterprise_chunker.orchestrator import create_auto_chunker
from enterprise_chunker.config import ChunkingOptions
from enterprise_chunker.models.enums import ChunkingStrategy
import json
import re
from datetime import datetime
import concurrent.futures

# Step 1: Define a pattern for log entry extraction
log_pattern = re.compile(r'(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})\s+(\w+)\s+\[([^\]]+)\]\s+(.*)')

# Step 2: Configure chunking options for log processing
options = ChunkingOptions(
    max_tokens_per_chunk=2000,
    overlap_tokens=100,
    chunking_strategy=ChunkingStrategy.STRUCTURAL
)

# Step 3: Create an optimized chunker for large files
chunker = create_auto_chunker(
    options=options,
    mode="memory-safe",  # Optimize for memory efficiency
    memory_safety=True
)

# Step 4: Define processing function for log chunks
def process_log_chunk(chunk):
    extracted_logs = []
    for line in chunk.splitlines():
        match = log_pattern.match(line)
        if match:
            timestamp, level, component, message = match.groups()
            extracted_logs.append({
                "timestamp": timestamp,
                "level": level,
                "component": component,
                "message": message
            })
    return extracted_logs

# Step 5: Process large log file with streaming and parallel execution
def analyze_logs(log_filepath, output_filepath):
    start_time = datetime.now()
    print(f"Starting log analysis at {start_time}")
    
    all_logs = []
    error_count = 0
    warning_count = 0
    
    # Process the file in streaming mode
    with open(log_filepath, 'r') as log_file:
        # Use the chunker's streaming interface
        chunk_stream = chunker.stream_chunks(log_file, process_log_chunk)
        
        # Process each batch of extracted logs
        for log_batch in chunk_stream:
            all_logs.extend(log_batch)
            
            # Count errors and warnings
            for log in log_batch:
                if log["level"] == "ERROR":
                    error_count += 1
                elif log["level"] == "WARNING":
                    warning_count += 1
    
    # Generate report
    report = {
        "total_logs": len(all_logs),
        "error_count": error_count,
        "warning_count": warning_count,
        "processing_time": str(datetime.now() - start_time),
        "sample_errors": [log for log in all_logs if log["level"] == "ERROR"][:10]
    }
    
    # Save to output file
    with open(output_filepath, 'w') as output_file:
        json.dump(report, output_file, indent=2)
    
    print(f"Analysis complete. Processed {len(all_logs)} log entries.")
    print(f"Found {error_count} errors and {warning_count} warnings.")
    print(f"Total processing time: {datetime.now() - start_time}")

# Step 6: Execute the analysis
analyze_logs("massive_server_logs.txt", "log_analysis_report.json")
```

**Input:** A gigabyte-scale log file with millions of entries
**Output:** A structured JSON report summarizing the log data without exhausting system memory

---

## 🚩 **7. Red Flags, Common Issues & Troubleshooting**

### Out of Memory Errors

**Symptoms:**
- Program crashes with `MemoryError`
- System becomes unresponsive when processing large files

**Causes:**
- Loading entire large documents into memory
- Not using streaming interfaces for large files
- Insufficient memory safety settings

**Solutions:**
1. Enable memory safety mode:
   ```python
   from enterprise_chunker.utils.memory_optimization import MemoryManager
   
   memory_manager = MemoryManager(low_memory_mode=True)
   with memory_manager.memory_efficient_context():
       # Your chunking code here
   ```

2. Use streaming interfaces for large files:
   ```python
   with open('large_file.txt', 'r') as file:
       for chunk in chunker.chunk_stream(file):
           # Process chunk
   ```

3. Create memory-safe chunker configuration:
   ```python
   from enterprise_chunker.orchestrator import create_auto_chunker
   
   chunker = create_auto_chunker(
       options=options,
       mode="memory-safe",
       memory_safety=True
   )
   ```

### Chunking Produces Inappropriate Boundaries

**Symptoms:**
- Code fragments are broken mid-function
- JSON data is split in the middle of objects or arrays
- Markdown headings are separated from their content

**Causes:**
- Using the wrong chunking strategy for the content type
- Not enabling format detection
- Insufficient overlap between chunks

**Solutions:**
1. Use the appropriate strategy for your content type:
   ```python
   # For code files:
   code_chunks = chunker.adaptive_chunk_text(
       text=code,
       strategy=ChunkingStrategy.STRUCTURAL
   )
   
   # For markdown:
   markdown_chunks = chunker.adaptive_chunk_text(
       text=markdown,
       strategy=ChunkingStrategy.STRUCTURAL
   )
   
   # For general text:
   text_chunks = chunker.adaptive_chunk_text(
       text=text,
       strategy=ChunkingStrategy.SEMANTIC
   )
   ```

2. Ensure format detection is enabled:
   ```python
   from enterprise_chunker.config import ChunkingOptions
   
   options = ChunkingOptions(
       enable_format_detection=True,
       # Other options...
   )
   ```

3. Increase overlap for better context preservation:
   ```python
   chunks = chunker.adaptive_chunk_text(
       text=text,
       overlap_tokens=300  # Increase from default
   )
   ```

### Performance Issues

**Symptoms:**
- Chunking takes too long to complete
- System CPU usage spikes during chunking
- Batch processing is slow

**Causes:**
- Not utilizing parallel processing
- Using high-precision settings for large files
- Inefficient batch sizing

**Solutions:**
1. Use parallel processing for better performance:
   ```python
   from enterprise_chunker.orchestrator import create_auto_chunker
   
   chunker = create_auto_chunker(
       options=options,
       mode="performance"  # Optimize for speed
   )
   ```

2. Adjust token estimation strategy for large files:
   ```python
   from enterprise_chunker.models.enums import TokenEstimationStrategy
   
   options = ChunkingOptions(
       token_strategy=TokenEstimationStrategy.PERFORMANCE
   )
   ```

3. Enable adaptive batch sizing:
   ```python
   chunker = create_auto_chunker(
       options=options,
       adaptive_batch_sizing=True
   )
   ```

### Import Errors

**Symptoms:**
- `ImportError` or `ModuleNotFoundError` when importing
- Missing functionality despite installing the package

**Causes:**
- Incomplete installation
- Missing optional dependencies
- Python environment issues

**Solutions:**
1. Install with all dependencies:
   ```bash
   pip install enterprise-chunker[all]
   ```

2. Check Python environment:
   ```bash
   # Verify which Python is being used
   python --version
   which python  # on Unix/Mac
   where python  # on Windows
   
   # Verify package installation
   pip list | grep enterprise-chunker
   ```

3. Install specific missing dependencies:
   ```bash
   pip install psutil numpy prometheus_client regex
   ```

### Chunking Result Differences Across Runs

**Symptoms:**
- Different chunk boundaries between runs on the same document
- Inconsistent chunk counts

**Causes:**
- Using adaptive strategies with dynamic behavior
- System resource fluctuations affecting decisions
- Random sampling in some algorithms

**Solutions:**
1. Use a deterministic strategy for consistent results:
   ```python
   # Fixed-size strategy is more deterministic
   chunks = chunker.adaptive_chunk_text(
       text=text,
       strategy=ChunkingStrategy.FIXED_SIZE
   )
   ```

2. Set a fixed operation ID for reproducibility:
   ```python
   from enterprise_chunker.strategies.base import BaseChunkingStrategy
   
   strategy = BaseChunkingStrategy(ContentFormat.TEXT)
   strategy.set_operation_id("fixed-id-for-reproducibility")
   ```

3. Control system resource variables:
   ```python
   chunker = create_auto_chunker(
       options=options,
       worker_count_override=4  # Fix worker count
   )
   ```

---

## ✅ **8. Best Practices & Additional Tips**

### Optimizing Chunking Settings

1. **Match Token Limits to Your LLM:**
   ```python
   # For OpenAI GPT-4 (~8K tokens)
   chunks = chunker.adaptive_chunk_text(
       text=text,
       max_tokens_per_chunk=7500,  # Leave room for response
       overlap_tokens=200
   )
   
   # For Claude (~100K tokens)
   chunks = chunker.adaptive_chunk_text(
       text=text,
       max_tokens_per_chunk=90000,  # Leave room for response
       overlap_tokens=1000
   )
   ```

2. **Adjust Overlap Based on Document Type:**
   - Technical/reference content: 10-15% overlap
   - Narrative/prose: 15-20% overlap
   - Code/structured data: 5-10% overlap

3. **Set Appropriate Safety Margins:**
   ```python
   options = ChunkingOptions(
       safety_margin=0.9,  # 90% of max token limit
       reserved_tokens=1000  # Keep 1000 tokens for responses
   )
   ```

### Memory and Performance Optimizations

1. **Stream Large Files:**
   Always use streaming for files over 10MB:
   ```python
   with open('large_file.txt', 'r') as file:
       for chunk in chunker.chunk_stream(file):
           process_chunk(chunk)
   ```

2. **Monitor Resource Usage:**
   ```python
   from enterprise_chunker.utils.memory_optimization import MemoryMonitor
   
   monitor = MemoryMonitor()
   with monitor.monitor_operation("process_document"):
       # Your chunking code
       pass
   ```

3. **Use Process-Based Parallelism for CPU-Bound Tasks:**
   ```python
   from enterprise_chunker.utils.parallel_processing import ParallelChunker
   
   parallel_chunker = ParallelChunker(
       options=options,
       max_workers=os.cpu_count(),
       use_processes=True  # Use processes instead of threads
   )
   ```

### Integration Patterns

1. **Pre-chunk Documents for Retrieval Systems:**
   Pre-process and store chunks rather than chunking on-the-fly for better performance in retrieval systems.

2. **Maintain Chunk Metadata:**
   ```python
   from enterprise_chunker.models.chunk_metadata import ChunkMetadata
   
   # Store metadata with chunks for better context
   result = chunker.chunk(text)
   for i, chunk in enumerate(result.chunks):
       metadata = result.chunk_metadata[i]
       store_in_database(chunk, metadata)
   ```

3. **Use Format Detection for Mixed Document Collections:**
   ```python
   from enterprise_chunker.utils.format_detection import detect_content_format
   
   # Detect format before processing
   format_type = detect_content_format(document)
   print(f"Detected format: {format_type}")
   ```

### Tools That Work Well with Enterprise Chunker

1. **Vector Databases** (Pinecone, Weaviate, Milvus, etc.) for storing and retrieving chunks based on semantic similarity

2. **Document Processing Pipelines** like Unstructured.io or Apache Tika for extracting text from various formats before chunking

3. **LLM Frameworks** like LangChain or LlamaIndex that can use the chunks for retrieval-augmented generation

4. **Monitoring Tools** like Prometheus + Grafana for tracking chunking performance metrics

---

## 📌 **9. Glossary & Definitions (Jargon-Buster)**

| Term | Definition |
|------|------------|
| <a id="adaptive-chunking"></a>**Adaptive Chunking** | A chunking strategy that automatically selects the best method based on content characteristics. |
| <a id="boundary-detection"></a>**Boundary Detection** | Finding natural points in text where it can be divided with minimal loss of meaning. |
| <a id="chunk"></a>**Chunk** | A segment of text created by dividing a larger document, optimized for processing by an LLM. |
| <a id="chunking"></a>**Chunking** | The process of dividing large text or documents into smaller, manageable pieces that can be processed by LLMs or other systems. |
| <a id="circuit-breaker"></a>**Circuit Breaker** | A pattern that prevents cascading failures by stopping operations when errors exceed a threshold. |
| <a id="context-window"></a>**Context Window** | The maximum amount of text (measured in tokens) that an LLM can process at once. |
| <a id="fixed-size-chunking"></a>**Fixed-Size Chunking** | A strategy that creates chunks of approximately equal size. |
| <a id="format-detection"></a>**Format Detection** | Automatically identifying the format of a document (JSON, Markdown, code, etc.). |
| <a id="large-language-model-llm"></a>**Large Language Model (LLM)** | Advanced AI models like GPT-4 or Claude that process and generate human-like text. |
| <a id="memory-safety"></a>**Memory Safety** | Features that prevent out-of-memory errors when processing large documents. |
| <a id="overlap"></a>**Overlap** | Text that is repeated between adjacent chunks to maintain context. |
| <a id="parallel-processing"></a>**Parallel Processing** | Utilizing multiple CPU cores or threads to process different segments of text simultaneously for faster chunking. |
| <a id="qos"></a>**QoS** | Quality of Service - controlling how resources are allocated based on request priority. |
| <a id="retrieval-augmented-generation-rag"></a>**Retrieval-Augmented Generation (RAG)** | An approach where chunks of text are retrieved from a knowledge base and fed to an LLM. |
| <a id="semantic-chunking"></a>**Semantic Chunking** | A chunking strategy that preserves the meaning and natural boundaries in text. |
| <a id="streaming"></a>**Streaming** | Processing data continuously in small pieces rather than all at once. |
| <a id="structural-chunking"></a>**Structural Chunking** | A chunking strategy that respects the structure of formatted content like JSON, Markdown, or code. |
| <a id="token"></a>**Token** | The basic unit of text that LLMs process. In English, a token is typically 4-5 characters or about 3/4 of a word. |
| <a id="token-estimation"></a>**Token Estimation** | Predicting how many tokens a text will use in an LLM without actually sending it to the LLM. |

---

## 🚨 **10. Limitations & Known Issues**

### Current Limitations

1. **Non-Text Format Support**
   - Enterprise Chunker focuses on text-based formats and does not directly support binary formats (images, audio, video)
   - **Workaround:** Convert binary formats to text (e.g., transcribe audio, use OCR for images) before chunking

2. **Language Limitations**
   - Token estimation is optimized for English and may be less accurate for other languages, particularly non-Latin scripts
   - **Workaround:** Use a higher safety margin for non-English content (0.8 instead of 0.9)

3. **Very Specialized Format Support**
   - While the library handles common formats (JSON, Markdown, code), some niche formats may not have specialized handlers
   - **Workaround:** Use the semantic or fixed-size strategy for unsupported formats

4. **Performance on Very Low Memory Systems**
   - Even with memory optimizations, processing gigabyte-scale documents requires at least 1GB of RAM
   - **Workaround:** Split extremely large files before processing or use external preprocessing tools

### Known Issues

1. **Inconsistent Boundaries in Mixed Content**
   - When documents contain mixed formats (e.g., Markdown with embedded JSON), boundary detection may be suboptimal
   - **Workaround:** Pre-process mixed documents to separate different format sections

2. **Token Estimation Discrepancies**
   - Token estimates may differ from actual LLM tokenization by 5-10%, especially for specialized tokens
   - **Workaround:** Use appropriate safety margins in your configuration

3. **Thread Safety in Some Utility Classes**
   - Some utility classes may not be fully thread-safe in all scenarios
   - **Workaround:** Use separate instances for concurrent operations

4. **Memory Leaks in Long-Running Processes**
   - Some rare memory leaks can occur in very long-running processes (days or weeks)
   - **Workaround:** Restart services periodically or implement watchdog monitoring

### Planned Improvements

1. **Enhanced Language Support**
   - Improved token estimation for non-Latin scripts and specialized languages

2. **Additional Format Handlers**
   - Support for more specialized formats like CSV, LaTeX, and programming languages

3. **GPU Acceleration**
   - Optional GPU acceleration for computationally intensive operations

4. **LLM-Guided Chunking**
   - Using LLMs themselves to determine optimal chunk boundaries for complex documents

---

## 🌐 **11. Integration & Ecosystem Context**

Enterprise Chunker is designed to work seamlessly with other components in the AI/LLM ecosystem. Here are some common integration patterns:

### Integration with LLM Frameworks

#### LangChain Integration

```python
from langchain.text_splitter import EnterpriseChunkerSplitter
from langchain.document_loaders import TextLoader
from langchain.embeddings import OpenAIEmbeddings
from langchain.vectorstores import Chroma

# Load document
loader = TextLoader("my-document.txt")
documents = loader.load()

# Use Enterprise Chunker as a text splitter
text_splitter = EnterpriseChunkerSplitter(
    chunk_size=1000,
    chunk_overlap=100,
    strategy="semantic"
)

# Split documents
chunks = text_splitter.split_documents(documents)

# Create vector store
embeddings = OpenAIEmbeddings()
vectorstore = Chroma.from_documents(chunks, embeddings)

# Query the vector store
query = "What is the main topic of the document?"
docs = vectorstore.similarity_search(query)
```

#### LlamaIndex Integration

```python
from llama_index.node_parser import EnterpriseChunkerNodeParser
from llama_index import VectorStoreIndex, SimpleDirectoryReader

# Load documents
documents = SimpleDirectoryReader("data").load_data()

# Use Enterprise Chunker as a node parser
node_parser = EnterpriseChunkerNodeParser(
    chunk_size=1024,
    chunk_overlap=100,
    strategy="adaptive"
)

# Create index
index = VectorStoreIndex.from_documents(
    documents, node_parser=node_parser
)

# Query the index
query_engine = index.as_query_engine()
response = query_engine.query("What does the document say about climate change?")
```

### Integration with Vector Databases

#### Pinecone Example

```python
import pinecone
from enterprise_chunker import EnterpriseChunker

# Initialize services
pinecone.init(api_key="your-api-key", environment="your-environment")
index = pinecone.Index("your-index-name")
chunker = EnterpriseChunker()

# Process document
with open("document.txt", "r") as file:
    text = file.read()

chunks = chunker.adaptive_chunk_text(text)

# Create embeddings (example using OpenAI, but you can use any embedding provider)
import openai
openai.api_key = "your-openai-key"

def get_embedding(text):
    response = openai.Embedding.create(
        input=text,
        model="text-embedding-ada-002"
    )
    return response["data"][0]["embedding"]

# Store chunks in Pinecone
for i, chunk in enumerate(chunks):
    embedding = get_embedding(chunk)
    
    # Store in Pinecone
    index.upsert(
        vectors=[(f"doc1-chunk-{i}", embedding, {"text": chunk})]
    )
```

### Integration with Document Processing Pipelines

#### Unstructured.io Example

```python
from unstructured.partition.pdf import partition_pdf
from enterprise_chunker import EnterpriseChunker

# Extract text from PDF using Unstructured
elements = partition_pdf("document.pdf")
text = "\n\n".join([el.text for el in elements])

# Process with Enterprise Chunker
chunker = EnterpriseChunker()
chunks = chunker.adaptive_chunk_text(text)

# Further processing with chunks...
```

### Integration with Custom AI Applications

```python
from enterprise_chunker import EnterpriseChunker
from enterprise_chunker.models.enums import ChunkingStrategy
import asyncio
import aiohttp

# Initialize chunker
chunker = EnterpriseChunker()

# Process document
with open("large_document.txt", "r") as file:
    document = file.read()

chunks = chunker.adaptive_chunk_text(
    document,
    strategy=ChunkingStrategy.SEMANTIC
)

# Async processing with LLM API
async def process_chunk(chunk, session):
    async with session.post(
        "https://api.openai.com/v1/chat/completions",
        headers={"Authorization": f"Bearer {openai_api_key}"},
        json={
            "model": "gpt-4",
            "messages": [
                {"role": "system", "content": "Summarize the following text."},
                {"role": "user", "content": chunk}
            ]
        }
    ) as response:
        result = await response.json()
        return result["choices"][0]["message"]["content"]

async def process_all_chunks(chunks):
    async with aiohttp.ClientSession() as session:
        tasks = [process_chunk(chunk, session) for chunk in chunks]
        return await asyncio.gather(*tasks)

# Run async processing
summaries = asyncio.run(process_all_chunks(chunks))

# Combine summaries or further process them
final_summary = "\n\n".join(summaries)
```

This demonstrates how Enterprise Chunker can fit into various parts of an AI application stack, from document preprocessing to integration with LLMs and vector databases.

---

## 🔐 **12. Security, Privacy & Data Handling Guidelines**

When working with Enterprise Chunker and processing documents, especially in enterprise environments, follow these security and privacy best practices:

### Data Handling Best Practices

1. **Sensitive Data Identification**
   - Before chunking, scan documents for sensitive information (PII, credentials, etc.)
   - Consider using a data loss prevention (DLP) tool in your pipeline

2. **Data Minimization**
   - Only process the portions of documents needed for your specific use case
   - Remove or redact sensitive sections before chunking

3. **Secure Storage of Chunks**
   - Encrypt chunks at rest when storing them in databases or file systems
   - Implement appropriate access controls for your chunk storage

4. **Transmission Security**
   - Use secure channels (HTTPS/TLS) when transmitting chunks to LLM APIs
   - Consider VPNs or private endpoints for enterprise deployments

### Enterprise Chunker Security Considerations

1. **Memory Management**
   - Use the memory safety features to prevent DoS-like issues with very large files
   ```python
   from enterprise_chunker.orchestrator import create_auto_chunker
   
   chunker = create_auto_chunker(
       options=options,
       memory_safety=True
   )
   ```

2. **Input Validation**
   - Validate and sanitize input documents before processing
   - Implement size limits for inputs based on your system capabilities

3. **Resource Limitations**
   - Set appropriate timeouts to prevent processing hangs
   ```python
   chunker = create_auto_chunker(
       options=options,
       timeout=60.0  # 60-second timeout
   )
   ```

4. **Monitoring & Logging**
   - Enable metrics collection to detect unusual patterns
   - Implement logging but be careful not to log sensitive document content
   ```python
   # Enable metrics server
   chunker = create_auto_chunker(
       options=options,
       enable_metrics_server=True,
       metrics_port=8000
   )
   ```

### Compliance Considerations

1. **GDPR Compliance**
   - Ensure you have proper legal basis for processing personal data
   - Implement data retention policies for stored chunks
   - Be prepared to fulfill data subject access and deletion requests

2. **HIPAA Compliance (for healthcare data)**
   - Ensure any health information is appropriately de-identified before processing
   - Implement additional encryption for health-related chunks
   - Maintain comprehensive audit logs for all processing

3. **Financial Regulations (for financial documents)**
   - Implement stricter access controls for financial data chunks
   - Consider additional validation steps for financial content

4. **Data Residency**
   - Process documents in the appropriate geographic region based on regulatory requirements
   - Consider using region-specific LLM APIs for processing chunks

### Example: Secure Document Processing Pipeline

```python
from enterprise_chunker import EnterpriseChunker
import logging
import hashlib

# Configure secure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("processing.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("secure-processor")

# Initialize chunker
chunker = EnterpriseChunker()

# Load document securely
def secure_load_document(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            content = file.read()
            
        # Log document hash for audit purposes (not the content itself)
        doc_hash = hashlib.sha256(content.encode()).hexdigest()
        logger.info(f"Processing document: {file_path} (SHA256: {doc_hash})")
        
        return content
    except Exception as e:
        logger.error(f"Error loading document {file_path}: {str(e)}")
        raise

# Process document with privacy considerations
def process_with_privacy(content, max_tokens=1000):
    # Validate input size
    if len(content) > 10 * 1024 * 1024:  # 10MB limit
        logger.warning("Document exceeds size limit, truncating")
        content = content[:10 * 1024 * 1024]
    
    # Process the document
    try:
        chunks = chunker.adaptive_chunk_text(
            text=content,
            max_tokens_per_chunk=max_tokens
        )
        
        logger.info(f"Document successfully chunked into {len(chunks)} parts")
        return chunks
    except Exception as e:
        logger.error(f"Error during chunking: {str(e)}")
        raise

# Example usage
try:
    document = secure_load_document("confidential_report.txt")
    chunks = process_with_privacy(document)
    
    # Further secure processing...
    
except Exception as e:
    logger.critical(f"Processing failed: {str(e)}")
```

By following these security and privacy guidelines, you can ensure that your document processing pipeline using Enterprise Chunker meets enterprise security requirements and compliance standards.

---

## 🖼️ **13. Visual Aids & Supporting Diagrams**

### Enterprise Chunker System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Enterprise Chunker System                    │
└─────────────────────────────────────────────────────────────────┘
                               │
                 ┌─────────────┴─────────────┐
                 │                           │
┌────────────────▼─────────────┐ ┌───────────▼────────────┐
│      Document Processing      │ │   Chunking Strategies  │
│                              │ │                        │
│ ┌──────────┐   ┌───────────┐ │ │ ┌────────┐ ┌─────────┐ │
│ │ Document │──▶│  Format   │ │ │ │Semantic│ │Structural│ │
│ │  Input   │   │ Detection │─┼─┼─▶        │ │         │ │
│ └──────────┘   └───────────┘ │ │ └────────┘ └─────────┘ │
│                              │ │ ┌────────┐ ┌─────────┐ │
│ ┌──────────┐   ┌───────────┐ │ │ │Fixed-  │ │Sentence │ │
│ │ Streaming│◀──│  Memory   │ │ │ │Size    │ │         │ │
│ │ Buffer   │   │ Management│ │ │ └────────┘ └─────────┘ │
│ └──────────┘   └───────────┘ │ │      ┌─────────┐      │
└──────────────────────────────┘ │      │Adaptive │      │
                                 │      │         │      │
┌──────────────────────────────┐ │      └─────────┘      │
│    Format-Specific Chunkers   │ └────────────────────────┘
│                              │
│ ┌─────────┐  ┌─────────────┐ │ ┌────────────────────────┐
│ │  JSON   │  │  Markdown   │ │ │   Performance Layer     │
│ └─────────┘  └─────────────┘ │ │                        │
│ ┌─────────┐  ┌─────────────┐ │ │ ┌────────┐ ┌─────────┐ │
│ │React/Vue│  │  Smalltalk  │ │ │ │Parallel│ │Token    │ │
│ └─────────┘  └─────────────┘ │ │ │Process │ │Estimator│ │
└──────────────────────────────┘ │ └────────┘ └─────────┘ │
                                 │ ┌────────┐ ┌─────────┐ │
┌──────────────────────────────┐ │ │Circuit │ │ Memory  │ │
│     Resource Management      │ │ │Breaker │ │ Monitor │ │
│                              │ │ └────────┘ └─────────┘ │
│ ┌──────────┐  ┌────────────┐ │ └────────────────────────┘
│ │ Dynamic  │  │ Auto-tuning│ │
│ │ Config   │  │            │ │ ┌────────────────────────┐
│ └──────────┘  └────────────┘ │ │      Output Layer      │
│ ┌──────────┐  ┌────────────┐ │ │                        │
│ │ Metrics  │  │ Health     │ │ │ ┌────────┐ ┌─────────┐ │
│ │ Server   │  │ Monitoring │ │ │ │Chunks  │ │Metadata │ │
│ └──────────┘  └────────────┘ │ │ │        │ │         │ │
└──────────────────────────────┘ │ └────────┘ └─────────┘ │
                                 └────────────────────────┘
```

### Chunking Process Workflow

```
┌─────────────┐     ┌─────────────┐     ┌──────────────────┐
│             │     │             │     │                  │
│  Document   │────▶│  Format     │────▶│ Select Chunking  │
│  Input      │     │  Detection  │     │ Strategy         │
│             │     │             │     │                  │
└─────────────┘     └─────────────┘     └──────────────────┘
                                                 │
                                                 ▼
┌─────────────┐     ┌─────────────┐     ┌──────────────────┐
│             │     │             │     │                  │
│  Finalize   │◀────│  Process    │◀────│ Detect           │
│  Chunks     │     │  Chunks     │     │ Boundaries       │
│             │     │             │     │                  │
└─────────────┘     └─────────────┘     └──────────────────┘
       │
       ▼
┌─────────────┐     ┌─────────────┐
│             │     │             │
│  Add        │────▶│  Return     │
│  Metadata   │     │  Results    │
│             │     │             │
└─────────────┘     └─────────────┘
```

### Chunking Strategy Selection Logic

```
┌───────────────────────┐
│                       │
│   Document Content    │
│                       │
└───────────────────────┘
           │
           ▼
┌───────────────────────┐     No     ┌───────────────────┐
│                       │────────────▶                   │
│  Format Detection     │            │ Default to        │
│  Successful?          │            │ Semantic Chunking │
│                       │            │                   │
└───────────────────────┘            └───────────────────┘
           │ Yes
           ▼
┌───────────────────────┐
│                       │
│  Identify Content     │
│  Format               │
│                       │
└───────────────────────┘
           │
           ▼
┌───────────────────────┐     Yes    ┌───────────────────┐
│                       │────────────▶                   │
│  Is it JSON?          │            │ Use JSON Chunking │
│                       │            │                   │
└───────────────────────┘            └───────────────────┘
           │ No
           ▼
┌───────────────────────┐     Yes    ┌───────────────────┐
│                       │────────────▶                   │
│  Is it Markdown?      │            │ Use Markdown      │
│                       │            │ Chunking          │
└───────────────────────┘            └───────────────────┘
           │ No
           ▼
┌───────────────────────┐     Yes    ┌───────────────────┐
│                       │────────────▶                   │
│  Is it Code?          │            │ Use Code-specific │
│  (React/Vue/Smalltalk)│            │ Chunking          │
└───────────────────────┘            └───────────────────┘
           │ No
           ▼
┌───────────────────────┐     Yes    ┌───────────────────┐
│                       │────────────▶                   │
│  Is document size     │            │ Use Fixed-Size    │
│  very large?          │            │ Chunking          │
└───────────────────────┘            └───────────────────┘
           │ No
           ▼
┌───────────────────────┐
│                       │
│  Use Semantic         │
│  Chunking             │
│                       │
└───────────────────────┘
```

### System Resource Management

```
┌─────────────────────────────────────────────────┐
│                                                 │
│               Resource Monitoring               │
│                                                 │
└─────────────────────────────────────────────────┘
                       │
           ┌───────────┼───────────┐
           │           │           │
           ▼           ▼           ▼
┌───────────────┐ ┌─────────┐ ┌───────────┐
│               │ │         │ │           │
│ CPU Usage     │ │ Memory  │ │ System    │
│ Monitoring    │ │ Monitor │ │ Load      │
│               │ │         │ │           │
└───────────────┘ └─────────┘ └───────────┘
           │           │           │
           └───────────┼───────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│                                                 │
│               Resource Adaptation               │
│                                                 │
└─────────────────────────────────────────────────┘
                       │
           ┌───────────┼───────────┐
           │           │           │
           ▼           ▼           ▼
┌───────────────┐ ┌─────────┐ ┌───────────┐
│               │ │         │ │           │
│ Dynamic       │ │ Memory  │ │ Circuit   │
│ Worker Scaling│ │ Safety  │ │ Breaker   │
│               │ │         │ │           │
└───────────────┘ └─────────┘ └───────────┘
           │           │           │
           └───────────┼───────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│                                                 │
│               Performance Metrics               │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 📑 **14. Summaries & Quick Reference Cheatsheet**

### Key Concepts Summary

- **Enterprise Chunker**: A library for intelligently dividing large text documents into smaller pieces for LLM processing
- **Chunking Strategies**: Different methods for splitting text based on content type and structure
- **Format Detection**: Automatic identification of document format for optimal chunking
- **Token Estimation**: Predicts token counts to ensure chunks fit within LLM context windows
- **Memory Management**: Techniques to process large documents efficiently without memory issues
- **Parallel Processing**: Utilizing multiple cores/threads to accelerate chunking operations

### Quick Reference Cheatsheet

#### Basic Usage

```python
# Import
from enterprise_chunker import EnterpriseChunker, ChunkingStrategy

# Initialize
chunker = EnterpriseChunker()

# Process a document
chunks = chunker.adaptive_chunk_text(
    text=document,
    max_tokens_per_chunk=1000,  # Adjust based on your LLM
    overlap_tokens=100,
    strategy=ChunkingStrategy.ADAPTIVE  # Auto-select best strategy
)
```

#### Chunking Strategies

```python
from enterprise_chunker.models.enums import ChunkingStrategy

# Available strategies
ChunkingStrategy.ADAPTIVE     # Auto-select best strategy
ChunkingStrategy.SEMANTIC     # Preserve meaning and natural boundaries
ChunkingStrategy.STRUCTURAL   # Format-aware (JSON, Markdown, code)
ChunkingStrategy.FIXED_SIZE   # Equal-sized chunks with minimal boundary detection
ChunkingStrategy.SENTENCE     # Split at sentence boundaries
```

#### Streaming Interface

```python
# Streaming from file
with open('large_file.txt', 'r') as file:
    for chunk in chunker.chunk_stream(file):
        # Process chunk
        pass

# Streaming from string
for chunk in chunker.chunk_stream(large_text):
    # Process chunk
    pass
```

#### Format Detection

```python
from enterprise_chunker.utils.format_detection import detect_content_format
from enterprise_chunker.models.enums import ContentFormat

# Detect format
format_type = detect_content_format(text)

# Check format type
if format_type == ContentFormat.JSON:
    print("Processing JSON document")
elif format_type == ContentFormat.MARKDOWN:
    print("Processing Markdown document")
elif format_type == ContentFormat.CODE:
    print("Processing code file")
```

#### Token Estimation

```python
from enterprise_chunker.utils.token_estimation import estimate_tokens
from enterprise_chunker.models.enums import TokenEstimationStrategy

# Estimate tokens with default balanced strategy
token_count = estimate_tokens("Your text goes here")

# Use precision strategy (more accurate but slower)
precise_count = estimate_tokens(
    "Your text goes here",
    strategy=TokenEstimationStrategy.PRECISION
)

# Use performance strategy (faster but less accurate)
fast_count = estimate_tokens(
    "Your text goes here",
    strategy=TokenEstimationStrategy.PERFORMANCE
)
```

#### Memory Optimization

```python
from enterprise_chunker.utils.memory_optimization import MemoryManager, MemoryMonitor

# Use memory-efficient context
memory_manager = MemoryManager(low_memory_mode=True)
with memory_manager.memory_efficient_context():
    # Your memory-intensive code here
    pass

# Monitor memory usage
memory_monitor = MemoryMonitor()
status = memory_monitor.check_memory()
print(f"Memory usage: {status['current_mb']:.2f} MB")
```

#### Format-Specific Chunking

```python
# JSON chunking
json_chunks = chunker.adaptive_chunk_text(
    text=json_text,
    strategy=ChunkingStrategy.STRUCTURAL
)

# Markdown chunking
md_chunks = chunker.adaptive_chunk_text(
    text=markdown_text,
    strategy=ChunkingStrategy.STRUCTURAL
)

# React/Vue component chunking
component_chunks = chunker.adaptive_chunk_text(
    text=component_code,
    strategy=ChunkingStrategy.STRUCTURAL
)
```

#### Parallel Processing

```python
from enterprise_chunker.orchestrator import create_auto_chunker

# Create auto-tuning chunker
chunker = create_auto_chunker(
    options=options,
    mode="performance"  # Other options: "balanced", "memory-safe"
)

# Process with parallelism
chunks = chunker.chunk(text, chunker_func)
```

#### Error Handling

```python
try:
    chunks = chunker.adaptive_chunk_text(text)
except Exception as e:
    print(f"Error during chunking: {type(e).__name__}: {str(e)}")
    # Fall back to simpler strategy
    chunks = chunker.adaptive_chunk_text(
        text=text,
        strategy=ChunkingStrategy.FIXED_SIZE
    )
```

---

## 📦 **15. Deployment & Distribution Guidelines**

### Packaging Enterprise Chunker in Your Projects

#### Python Package Dependencies

When including Enterprise Chunker in your own Python packages, ensure proper dependency specification:

```python
# setup.py
setup(
    name="your-package",
    # ... other setup parameters
    install_requires=[
        "enterprise-chunker>=1.0.0",
        # Your other dependencies
    ],
    extras_require={
        "performance": ["enterprise-chunker[all]"],
    }
)
```

#### Version Pinning

For production applications, pin the specific version to ensure stability:

```python
# requirements.txt
enterprise-chunker==1.0.0
```

Or with a range for minor updates:

```python
# requirements.txt
enterprise-chunker>=1.0.0,<1.1.0
```

### Deployment Environments

#### Local Development

For local development, a simple installation is sufficient:

```bash
pip install enterprise-chunker[dev]
```

#### Cloud Deployment

When deploying to cloud environments, consider the following:

**AWS Lambda:**
- Include Enterprise Chunker in your Lambda layer
- Set appropriate memory allocation (at least 256MB, 1GB+ recommended)
- Configure timeout settings based on your document sizes

**Docker Containers:**
- Include Enterprise Chunker in your Dockerfile:
  ```dockerfile
  FROM python:3.9-slim
  
  WORKDIR /app
  
  COPY requirements.txt .
  RUN pip install --no-cache-dir -r requirements.txt
  
  COPY . .
  
  CMD ["python", "your_application.py"]
  ```

- Set appropriate container resource limits:
  ```yaml
  # docker-compose.yml
  services:
    document-processor:
      build: .
      mem_limit: 2g
      cpus: 2.0
      environment:
        - CHUNKER_MAX_TOKENS_PER_CHUNK=1000
        - CHUNKER_OVERLAP_TOKENS=100
  ```

**Kubernetes:**
- Set resource requests and limits in your pod spec:
  ```yaml
  resources:
    requests:
      memory: "1Gi"
      cpu: "500m"
    limits:
      memory: "4Gi"
      cpu: "2"
  ```

- Configure horizontal pod autoscaling for document processing services:
  ```yaml
  apiVersion: autoscaling/v2
  kind: HorizontalPodAutoscaler
  metadata:
    name: document-processor
  spec:
    scaleTargetRef:
      apiVersion: apps/v1
      kind: Deployment
      name: document-processor
    minReplicas: 2
    maxReplicas: 10
    metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
  ```

### Common Deployment Problems & Solutions

#### Memory Issues

**Problem:** Out of memory errors when processing large documents

**Solution:**
1. Enable memory safety mode
2. Use streaming interfaces for large files
3. Increase container/instance memory allocation
4. Add swap space for burst processing

#### Slow Performance

**Problem:** Chunking is taking too long on large documents

**Solution:**
1. Enable parallel processing with appropriate worker count
2. Use performance mode in auto chunker
3. Adjust token estimation strategy to PERFORMANCE
4. Pre-process and cache results for frequently accessed documents

#### Container Crashes

**Problem:** Docker containers crash when processing large files

**Solution:**
1. Increase container memory limits
2. Enable memory safety mode
3. Add container health checks:
   ```yaml
   healthcheck:
     test: ["CMD", "python", "-c", "import requests; requests.get('http://localhost:8000/health')"]
     interval: 30s
     timeout: 10s
     retries: 3
   ```

#### Distributed Processing

**Problem:** Need to process large volumes of documents across multiple nodes

**Solution:**
1. Implement a queue-based architecture (RabbitMQ, Kafka, SQS)
2. Use chunker in worker nodes that pull jobs from the queue
3. Implement result aggregation service
4. Example worker code:
   ```python
   import pika
   from enterprise_chunker import EnterpriseChunker
   
   chunker = EnterpriseChunker()
   
   def process_document(document_data):
       chunks = chunker.adaptive_chunk_text(document_data["content"])
       # Store results...
   
   # Connect to RabbitMQ
   connection = pika.BlockingConnection(pika.ConnectionParameters('localhost'))
   channel = connection.channel()
   channel.queue_declare(queue='document_queue')
   
   def callback(ch, method, properties, body):
       document_data = json.loads(body)
       process_document(document_data)
       ch.basic_ack(delivery_tag=method.delivery_tag)
   
   channel.basic_consume(queue='document_queue', on_message_callback=callback)
   channel.start_consuming()
   ```

---

## 🚧 **16. Maintenance, Updates & Long-term Considerations**

### Keeping Enterprise Chunker Updated

#### Version Management

Enterprise Chunker follows Semantic Versioning (SemVer), making it easier to understand update impacts:

- **Major version changes (1.0.0 → 2.0.0)**: May include breaking API changes
- **Minor version changes (1.0.0 → 1.1.0)**: New features without breaking changes
- **Patch version changes (1.0.0 → 1.0.1)**: Bug fixes and minor improvements

To check your current version:

```python
from enterprise_chunker import __version__
print(f"Enterprise Chunker version: {__version__}")
```

#### Update Process

To update to the latest version:

```bash
pip install --upgrade enterprise-chunker
```

To update to a specific version:

```bash
pip install --upgrade enterprise-chunker==1.1.0
```

For applications in production, create automated tests that verify your integration works with new versions before deploying updates.

### Dependency Management

Enterprise Chunker has both required and optional dependencies. To ensure all dependencies are properly maintained:

1. **Regular Dependency Audits**:
   ```bash
   pip install safety
   safety check -r requirements.txt
   ```

2. **Dependency Updates**:
   ```bash
   pip install pip-upgrader
   pip-upgrade requirements.txt
   ```

3. **Conflict Resolution**:
   If you encounter dependency conflicts, consider using a dependency resolver:
   ```bash
   pip install pip-tools
   pip-compile requirements.in
   pip-sync requirements.txt
   ```

### Long-term Maintenance Strategies

#### Monitoring & Logging

Implement comprehensive monitoring for long-running applications:

```python
import logging
from enterprise_chunker.orchestrator import create_auto_chunker

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("chunker.log"),
        logging.StreamHandler()
    ]
)

# Enable metrics server for monitoring
chunker = create_auto_chunker(
    options=options,
    enable_metrics_server=True,
    metrics_port=8000
)

# Connect to monitoring systems like Prometheus/Grafana
# http://localhost:8000/metrics
```

#### Performance Tuning Over Time

As you collect performance data, tune settings for optimal performance:

```python
# Load configuration from database or config service
from database import get_chunker_config

config = get_chunker_config()

# Apply dynamic configuration
chunker = create_auto_chunker(
    options=options,
    size_threshold=config['size_threshold'],
    complexity_threshold=config['complexity_threshold'],
    memory_safety=config['memory_safety']
)
```

#### Handling Deprecated Features

When features are deprecated, update your code following migration guides:

```python
# Old approach (deprecated)
# chunks = chunker.chunk_text(text)

# New approach
chunks = chunker.adaptive_chunk_text(text)
```

#### Maintenance Checklist

For long-term system health, perform regular maintenance:

1. **Weekly**:
   - Review error logs
   - Check memory usage patterns
   - Verify processing times remain consistent

2. **Monthly**:
   - Check for Enterprise Chunker updates
   - Run dependency security scans
   - Review and tune performance settings

3. **Quarterly**:
   - Benchmark chunking performance
   - Test with new document types/formats
   - Review resource allocation

### Scaling Strategies

As your document processing needs grow:

1. **Vertical Scaling**:
   - Increase memory and CPU resources
   - Adjust worker counts based on available resources
   ```python
   chunker = create_auto_chunker(
       options=options,
       worker_count_override=os.cpu_count() * 2
   )
   ```

2. **Horizontal Scaling**:
   - Implement document sharding across multiple instances
   - Use message queues to distribute processing
   - Implement stateless processing nodes

3. **Specialized Processing**:
   - Create dedicated instances for specific document formats
   - Route documents to specialized processors based on format
   ```python
   if format_type == ContentFormat.JSON:
       # Route to JSON-optimized processor
       json_processor.process(document)
   elif format_type == ContentFormat.MARKDOWN:
       # Route to Markdown-optimized processor
       markdown_processor.process(document)
   ```

---

## 🔮 **17. Further Resources & Next Steps**

### Official Documentation & Resources

- **Enterprise Chunker GitHub Repository**: For code examples, issues, and contributions
- **API Reference Documentation**: Comprehensive documentation of all classes and methods
- **User Forums**: Community discussion and support

### Learning Resources

#### Tutorials & Guides

- **[Beginner Guide](https://colab.research.google.com/github/enterprise-chunker/examples/blob/main/tutorials/beginner_guide.ipynb)**: "Getting Started with Enterprise Chunker"
- **[Intermediate Tutorial](https://colab.research.google.com/github/enterprise-chunker/examples/blob/main/tutorials/intermediate_guide.ipynb)**: "Optimizing Chunking Strategies for Different Document Types"
- **[Advanced Guide](https://colab.research.google.com/github/enterprise-chunker/examples/blob/main/tutorials/advanced_guide.ipynb)**: "Building High-Performance Document Processing Pipelines"

#### Video Courses

- **[Document Processing for LLM Applications](https://www.youtube.com/playlist?list=PLExample123)**: A video course covering Enterprise Chunker fundamentals
- **[Advanced RAG Systems with Enterprise Chunker](https://www.youtube.com/playlist?list=PLExample456)**: Comprehensive video tutorials on building RAG systems

### Community & Support

#### Community Channels

- **[GitHub Discussions](https://github.com/enterprise-chunker/discussions)**: Technical discussions and feature requests
- **[Discord Community](https://discord.gg/enterprise-chunker)**: Real-time chat and support
- **[Stack Overflow](https://stackoverflow.com/questions/tagged/enterprise-chunker)**: Questions tagged with `enterprise-chunker`

#### Commercial Support Options

- **[Enterprise Support Plans](https://www.enterprise-chunker.com/support)**: For organizations requiring SLAs and priority support
- **[Consulting Services](https://www.enterprise-chunker.com/consulting)**: Expert implementation and optimization

### Integration Ecosystem

#### LLM Frameworks

- **[LangChain Integration](https://python.langchain.com/docs/integrations/text_splitters/enterprise_chunker)**: Documentation on integrating with LangChain's text splitters
- **[LlamaIndex Integration](https://docs.llamaindex.ai/en/stable/examples/node_parsers/enterprise_chunker_node_parser)**: Guides for using Enterprise Chunker with LlamaIndex

#### Vector Databases

- **[Pinecone Example](https://docs.pinecone.io/docs/examples/enterprise-chunker)**: Example projects for document chunking and retrieval
- **[Weaviate Guide](https://weaviate.io/developers/weaviate/tutorials/enterprise-chunker)**: Integration tutorials for semantic search
- **[Milvus Documentation](https://milvus.io/docs/enterprise-chunker-integration.md)**: Guide to optimal chunking for Milvus indexing

### Next Steps in Your Learning Journey

#### Beginner Next Steps

1. Try different chunking strategies on your documents
2. Experiment with different overlap settings
3. Integrate with a simple LLM API

#### Intermediate Next Steps

1. Implement memory-efficient processing for large documents
2. Create format-specific processing pipelines
3. Add monitoring and performance metrics

#### Advanced Next Steps

1. Build a distributed document processing architecture
2. Implement custom chunking strategies for specialized formats
3. Contribute to the Enterprise Chunker project

### Contributing to Enterprise Chunker

The project welcomes contributions:

1. **Bug Reports**: Help improve stability by reporting issues
2. **Feature Requests**: Suggest new features and improvements
3. **Documentation**: Improve guides and examples
4. **Code Contributions**: Submit pull requests for new features or bug fixes

To contribute:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

### Expanding Your Knowledge

To deepen your understanding of the concepts behind Enterprise Chunker:

1. **Research Papers**:
   - "Efficient Document Segmentation for Large Language Models"
   - "Semantic Preservation in Text Chunking"

2. **Related Technologies**:
   - Explore text embedding techniques for retrieval systems
   - Learn about document processing pipelines and extraction systems
   - Study vector search algorithms and similarity metrics

3. **Advanced Use Cases**:
   - Building multi-modal chunking systems (text + images)
   - Creating hierarchical document representations
   - Implementing cross-document reference tracking

---

## API Reference Documentation

<!-- Auto-generated API documentation using pdoc3 -->

### EnterpriseChunker

```python
class EnterpriseChunker:
    """Enterprise-grade text chunking utility for LLM processing"""
    
    def __init__(self, options: Optional[Dict[str, Any]] = None):
        """
        Initialize the chunker with configuration options
        
        Args:
            options: Optional configuration dictionary
        """
    
    def adaptive_chunk_text(
        self, 
        text: str, 
        max_tokens_per_chunk: Optional[int] = None,
        overlap_tokens: Optional[int] = None,
        strategy: Optional[Union[str, ChunkingStrategy]] = None
    ) -> List[str]:
        """
        Main entry point: Adaptively chunk text based on content format
        
        Args:
            text: Text content to chunk
            max_tokens_per_chunk: Maximum tokens per chunk (overrides class settings)
            overlap_tokens: Number of tokens to overlap between chunks
            strategy: Chunking strategy to use
            
        Returns:
            List of text chunks optimized for processing
        """
    
    def chunk_stream(
        self, 
        stream: Union[str, io.TextIOBase], 
        **kwargs
    ) -> Generator[str, None, None]:
        """
        Process a text stream by dynamically chunking it as it's read
        
        Args:
            stream: Text stream to process
            **kwargs: Additional options for chunking
            
        Yields:
            Text chunks sequentially
        """
    
    def with_max_tokens(self, max_tokens: int) -> 'EnterpriseChunker':
        """
        Fluent API for setting max tokens per chunk
        
        Args:
            max_tokens: Maximum tokens per chunk
            
        Returns:
            Self for chaining
        """
    
    def with_overlap(self, overlap_tokens: int) -> 'EnterpriseChunker':
        """
        Fluent API for setting overlap tokens
        
        Args:
            overlap_tokens: Number of tokens to overlap
            
        Returns:
            Self for chaining
        """
    
    def with_strategy(self, strategy: Union[str, ChunkingStrategy]) -> 'EnterpriseChunker':
        """
        Fluent API for setting chunking strategy
        
        Args:
            strategy: Chunking strategy to use
            
        Returns:
            Self for chaining
        """
    
    def chunk(self, text: str) -> List[str]:
        """
        Chunk text with current configuration
        
        Args:
            text: Text to chunk
            
        Returns:
            List of text chunks
        """
```

### ChunkingOptions

```python
class ChunkingOptions:
    """Configuration options for chunking"""
    
    def __init__(self, **kwargs):
        """
        Initialize chunking options from provided kwargs
        
        Args:
            **kwargs: Configuration parameters
        """
    
    def get_effective_max_tokens(self) -> int:
        """
        Calculate effective maximum tokens, accounting for reserved tokens and safety margin
        
        Returns:
            Effective maximum tokens that should be used for chunking
        """
    
    def to_dict(self) -> Dict[str, Any]:
        """
        Convert options to dictionary
        
        Returns:
            Dictionary representation of options
        """
```

### Format-Specific Chunking Strategies

```python
class JsonChunkingStrategy(BaseChunkingStrategy):
    """
    Strategy for chunking JSON content with structural preservation.
    """
    
    def detect_boundaries(self, text: str, options: ChunkingOptions) -> List[Dict[str, Any]]:
        """
        This method is overridden but not used for JSON chunking
        because we parse the JSON and handle it differently.
        """
    
    def chunk(self, text: str, options: ChunkingOptions) -> ChunkingResult:
        """
        Override the chunking process for JSON with structure-aware processing.
        """

class MarkdownChunkingStrategy(BaseChunkingStrategy):
    """
    Strategy for chunking Markdown content with header/section awareness
    """
    
    def detect_boundaries(self, text: str, options: ChunkingOptions) -> List[Dict[str, Any]]:
        """
        Detect Markdown boundaries like headers, lists, and code blocks
        """

class ReactVueChunkingStrategy(BaseChunkingStrategy):
    """
    Strategy for chunking React and Vue component files with structure awareness.
    """
    
    def chunk(self, text: str, options: ChunkingOptions) -> ChunkingResult:
        """
        Override to detect Vue or React before chunking.
        """
    
    def detect_boundaries(self, text: str, options: ChunkingOptions) -> List[Dict[str, Any]]:
        """
        Detect boundaries in React or Vue components based on component type.
        """

class SmalltalkChunkingStrategy(BaseChunkingStrategy):
    """
    Strategy for chunking Smalltalk code with method and class awareness.
    """
    
    def chunk(self, text: str, options: ChunkingOptions) -> ChunkingResult:
        """
        Override to detect Smalltalk dialect before chunking.
        """
    
    def detect_boundaries(self, text: str, options: ChunkingOptions) -> List[Dict[str, Any]]:
        """
        Detect method and class boundaries in Smalltalk code.
        """
```

---

## Conclusion

Enterprise Chunker is a powerful tool that solves the critical challenge of breaking down large documents for LLM processing. By intelligently preserving document structure and meaning, it enables LLMs to work with documents of any size while maintaining context and coherence.

Whether you're building a simple Q&A system or a complex enterprise document processing pipeline, the techniques and best practices covered in this guide will help you get the most out of Enterprise Chunker and create more effective, efficient, and reliable LLM applications.

Happy chunking!

<script>
// Simple search functionality
document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    
    searchInput.addEventListener('input', function() {
        const query = this.value.toLowerCase();
        
        if (query.length < 2) {
            searchResults.innerHTML = '';
            return;
        }
        
        const results = [];
        headings.forEach(heading => {
            const text = heading.textContent.toLowerCase();
            if (text.includes(query)) {
                results.push({
                    text: heading.textContent,
                    id: heading.id || heading.textContent.toLowerCase().replace(/[^\w]+/g, '-'),
                    level: parseInt(heading.tagName.substring(1))
                });
            }
        });
        
        const content = document.querySelector('body');
        const contentText = content.textContent.toLowerCase();
        let match;
        const regex = new RegExp(`[^.!?]*${query}[^.!?]*[.!?]`, 'gi');
        
        while ((match = regex.exec(contentText)) !== null && results.length < 10) {
            const context = match[0].trim();
            if (context.length > 20) {
                results.push({
                    text: '...' + context + '...',
                    context: true
                });
            }
        }
        
        if (results.length > 0) {
            searchResults.innerHTML = results.map(result => {
                if (result.context) {
                    return `<div class="search-result-context">${result.text}</div>`;
                } else {
                    const indent = '&nbsp;'.repeat((result.level - 1) * 2);
                    return `<div class="search-result"><a href="#${result.id}">${indent}${result.text}</a></div>`;
                }
            }).join('');
        } else {
            searchResults.innerHTML = '<div class="no-results">No results found</div>';
        }
    });
});
</script>

<style>
.search-container {
    position: sticky;
    top: 0;
    background: white;
    padding: 10px;
    border-bottom: 1px solid #ddd;
    z-index: 1000;
}

#search-input {
    width: 100%;
    padding: 8px;
    font-size: 16px;
    border: 1px solid #ddd;
    border-radius: 4px;
}

#search-results {
    position: absolute;
    width: 100%;
    max-height: 400px;
    overflow-y: auto;
    background: white;
    border: 1px solid #ddd;
    border-top: none;
    border-radius: 0 0 4px 4px;
    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    display: none;
}

#search-input:focus + #search-results, #search-results:hover {
    display: block;
}

.search-result, .search-result-context, .no-results {
    padding: 8px 12px;
    border-bottom: 1px solid #eee;
}

.search-result:hover {
    background-color: #f5f5f5;
}

.search-result a {
    color: #333;
    text-decoration: none;
    display: block;
}

.search-result-context {
    font-size: 14px;
    color: #666;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
</style>