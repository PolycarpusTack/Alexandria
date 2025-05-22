"""
Unit tests for the EnterpriseChunker
"""

import unittest
import json
from enterprise_chunker import (
    EnterpriseChunker,
    ChunkingStrategy,
    TokenEstimationStrategy,
    ContentFormat
)


class TestEnterpriseChunker(unittest.TestCase):
    """Test cases for the EnterpriseChunker"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.chunker = EnterpriseChunker()
    
    def test_empty_input(self):
        """Test chunking with empty input"""
        result = self.chunker.adaptive_chunk_text("")
        self.assertEqual(result, [])
    
    def test_small_input(self):
        """Test chunking with small input (no chunking needed)"""
        text = "This is a small text that doesn't need chunking."
        result = self.chunker.adaptive_chunk_text(text)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0], text)
    
    def test_context_manager(self):
        """Test context manager for temporary configuration"""
        text = "This is a test of the context manager API. " * 20  # Make it long enough
        
        # Default configuration
        default_result = self.chunker.chunk(text)
        
        # Using context manager to override config temporarily
        with self.chunker.semantic_context(max_tokens=50, overlap=5):
            modified_result = self.chunker.chunk(text)
            
            # Should produce more chunks due to smaller max_tokens
            self.assertGreater(len(modified_result), len(default_result))
        
        # Configuration should be restored after context
        restored_result = self.chunker.chunk(text)
        self.assertEqual(len(restored_result), len(default_result))
    
    def test_stream_chunking(self):
        """Test streaming chunking"""
        from io import StringIO
        
        # Create a string stream
        text = "Line 1\nLine 2\nLine 3\n" * 50
        stream = StringIO(text)
        
        # Process stream
        chunks = list(self.chunker.chunk_stream(stream, max_tokens_per_chunk=100))
        
        # Should produce multiple chunks
        self.assertGreater(len(chunks), 1)
        
        # Check content is preserved
        combined = "".join(chunks)
        # The combined content might include overlaps, 
        # so we check that all original lines are present
        for line in ["Line 1", "Line 2", "Line 3"]:
            self.assertIn(line, combined)
    
    def test_markdown_chunking(self):
        """Test markdown-specific chunking"""
        markdown_text = """
        # Heading 1
        
        This is some content under heading 1.
        
        ## Subheading 1.1
        
        More content here.
        
        # Heading 2
        
        Content under heading 2.
        
        - List item 1
        - List item 2
        
        ## Subheading 2.1
        
        Final content section.
        """
        
        result = self.chunker.adaptive_chunk_text(
            markdown_text,
            max_tokens_per_chunk=70,  # Small to force chunking
            strategy=ChunkingStrategy.STRUCTURAL
        )
        
        # Should split at heading boundaries
        self.assertGreater(len(result), 1)
        
        # Headers should be preserved
        heading1_found = False
        heading2_found = False
        
        for chunk in result:
            if "# Heading 1" in chunk:
                heading1_found = True
            if "# Heading 2" in chunk:
                heading2_found = True
        
        self.assertTrue(heading1_found)
        self.assertTrue(heading2_found)
        
        # Context should be preserved across chunks
        context_found = False
        for chunk in result:
            if "Context from previous chunk" in chunk:
                context_found = True
                break
        
        self.assertTrue(context_found)
    
    def test_error_recovery(self):
        """Test error recovery with malformed content"""
        # Create malformed JSON that would cause parsing errors
        malformed_json = '{"key": "value", "broken": }'
        
        # Should not raise an exception
        try:
            result = self.chunker.adaptive_chunk_text(
                malformed_json,
                strategy=ChunkingStrategy.STRUCTURAL
            )
            # Should fall back to a working strategy
            self.assertGreater(len(result), 0)
        except Exception as e:
            self.fail(f"Error recovery failed, raised: {str(e)}")
    
    def test_token_estimation(self):
        """Test token estimation"""
        from enterprise_chunker.utils.token_estimation import estimate_tokens
        
        # Basic English text
        english_text = "This is a simple English text for testing token estimation."
        english_tokens = estimate_tokens(english_text)
        self.assertGreater(english_tokens, 0)
        
        # Text with emoji (should count higher per character)
        emoji_text = "Hello! 😊 How are you today? 🌟"
        emoji_tokens = estimate_tokens(emoji_text)
        self.assertGreater(emoji_tokens, 0)
        
        # Character-per-token ratio should be lower for emoji text
        english_ratio = len(english_text) / english_tokens
        emoji_ratio = len(emoji_text) / emoji_tokens
        self.assertLess(emoji_ratio, english_ratio)
        
        # Very small inputs
        self.assertEqual(estimate_tokens(""), 0)
        self.assertEqual(estimate_tokens("a"), 1)
    
    def test_format_detection(self):
        """Test format detection"""
        from enterprise_chunker.utils.format_detection import detect_content_format
        
        # JSON detection
        json_text = '{"key1": "value1", "key2": 42, "nested": {"inner": "value"}}'
        self.assertEqual(detect_content_format(json_text), ContentFormat.JSON)
        
        # XML detection
        xml_text = '<?xml version="1.0"?><root><item id="1">Value</item></root>'
        self.assertEqual(detect_content_format(xml_text), ContentFormat.XML)
        
        # Markdown detection
        markdown_text = "# Heading\n\nParagraph text\n\n- List item 1\n- List item 2"
        self.assertEqual(detect_content_format(markdown_text), ContentFormat.MARKDOWN)
        
        # Code detection
        code_text = "function test() {\n  const x = 10;\n  return x * 2;\n}"
        self.assertEqual(detect_content_format(code_text), ContentFormat.CODE)
        
        # Plain text 
        plain_text = "This is just regular text without any special format."
        self.assertEqual(detect_content_format(plain_text), ContentFormat.TEXT)
    
    def test_semantic_chunking(self):
        """Test semantic chunking with explicit sections"""
        text = """
        # Section 1
        
        This is the first section with some content.
        It has multiple lines of text.
        
        # Section 2
        
        This is the second section with more content.
        It also has multiple lines.
        
        # Section 3
        
        This is the third section.
        """
        
        result = self.chunker.adaptive_chunk_text(
            text, 
            max_tokens_per_chunk=50,  # Small to force chunking
            strategy=ChunkingStrategy.SEMANTIC
        )
        
        # Should split into at least 2 chunks
        self.assertGreater(len(result), 1)
        
        # Check that sections are preserved
        section1_found = any("Section 1" in chunk for chunk in result)
        section2_found = any("Section 2" in chunk for chunk in result)
        
        self.assertTrue(section1_found)
        self.assertTrue(section2_found)
    
    def test_fixed_size_chunking(self):
        """Test fixed size chunking"""
        # Create a string that repeats to a known size
        text = "0123456789" * 100  # 1000 characters
        
        result = self.chunker.adaptive_chunk_text(
            text,
            max_tokens_per_chunk=50,  # Small to force chunking
            strategy=ChunkingStrategy.FIXED_SIZE
        )
        
        # Should split into multiple chunks
        self.assertGreater(len(result), 1)
        
        # Each chunk (except maybe the last) should be roughly the same size
        chunk_sizes = [len(chunk) for chunk in result]
        for i in range(len(chunk_sizes) - 1):  # Skip the last chunk
            # Allow for some variation due to overlap and boundaries
            self.assertLess(abs(chunk_sizes[i] - chunk_sizes[0]), 100)
    
    def test_json_chunking(self):
        """Test JSON chunking"""
        # Create a JSON array with many items
        json_array = [{"id": i, "value": f"Item {i}"} for i in range(100)]
        text = json.dumps(json_array)
        
        result = self.chunker.adaptive_chunk_text(
            text,
            max_tokens_per_chunk=100,  # Small to force chunking
            strategy=ChunkingStrategy.STRUCTURAL
        )
        
        # Should split into multiple chunks
        self.assertGreater(len(result), 1)
        
        # Each chunk should be valid JSON
        for chunk in result:
            try:
                parsed = json.loads(chunk)
                # Each chunk should have metadata
                self.assertIn("_chunk_info", parsed)
            except json.JSONDecodeError:
                self.fail(f"Chunk is not valid JSON: {chunk[:50]}...")
    
    def test_fluent_api(self):
        """Test fluent API for configuration"""
        text = "This is a test for the fluent API."
        
        # Configure with fluent API
        result = self.chunker \
            .with_max_tokens(100) \
            .with_overlap(10) \
            .with_strategy(ChunkingStrategy.SEMANTIC) \
            .chunk(text)
        
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0], text)