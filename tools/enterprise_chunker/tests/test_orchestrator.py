"""
Tests for the orchestrator module
"""

import unittest
import tempfile
import os
from unittest.mock import patch, MagicMock

from enterprise_chunker.config import ChunkingOptions
from enterprise_chunker.models.enums import ChunkingStrategy
from enterprise_chunker.orchestrator import (
    create_auto_chunker,
    SmartParallelChunker,
    DynamicConfig
)


class TestOrchestrator(unittest.TestCase):
    """Test cases for the orchestrator module"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.options = ChunkingOptions(
            strategy=ChunkingStrategy.SIMPLE,
            chunk_size=1000,
            chunk_overlap=200
        )
        
        # Test chunker function
        self.test_chunker = lambda text: [text[i:i+500] for i in range(0, len(text), 400)]
        
        # Sample text
        self.sample_text = "This is a sample text.\n" * 100
    
    def test_create_auto_chunker(self):
        """Test auto chunker creation with different modes"""
        # Test auto mode
        chunker_auto = create_auto_chunker(self.options, mode="auto")
        self.assertIsInstance(chunker_auto, SmartParallelChunker)
        
        # Test performance mode
        chunker_perf = create_auto_chunker(self.options, mode="performance")
        self.assertIsInstance(chunker_perf, SmartParallelChunker)
        self.assertFalse(chunker_perf.memory_safety)
        
        # Test memory-safe mode
        chunker_mem = create_auto_chunker(self.options, mode="memory-safe")
        self.assertIsInstance(chunker_mem, SmartParallelChunker)
        self.assertTrue(chunker_mem.memory_safety)
        
        # Test balanced mode
        chunker_bal = create_auto_chunker(self.options, mode="balanced")
        self.assertIsInstance(chunker_bal, SmartParallelChunker)
    
    def test_simple_strategy(self):
        """Test chunking with simple strategy"""
        chunker = create_auto_chunker(self.options)
        chunker.force_strategy = 'simple'
        
        # Process text
        chunks = chunker.chunk(self.sample_text, self.test_chunker)
        
        # Verify results
        self.assertIsInstance(chunks, list)
        self.assertTrue(len(chunks) > 0)
        self.assertEqual(chunker.metrics.last_strategy, 'simple')
    
    @patch('enterprise_chunker.orchestrator.SmartParallelChunker._create_advanced_chunker')
    def test_strategy_selection(self, mock_create_advanced):
        """Test strategy selection logic"""
        # Setup mock advanced chunker
        mock_advanced = MagicMock()
        mock_advanced.chunk_in_parallel.return_value = ["Chunk1", "Chunk2"]
        mock_create_advanced.return_value = mock_advanced
        
        # Create chunker
        chunker = create_auto_chunker(self.options)
        
        # Force complexity to be high
        with patch('enterprise_chunker.orchestrator.SmartParallelChunker._estimate_complexity', return_value=1.0):
            # Process text
            chunks = chunker.chunk(self.sample_text * 10, self.test_chunker)
            
            # Verify advanced strategy was selected
            self.assertEqual(chunker.metrics.last_strategy, 'advanced')
            mock_advanced.chunk_in_parallel.assert_called_once()
    
    def test_dynamic_config(self):
        """Test dynamic configuration"""
        # Create config
        config = DynamicConfig({
            'processing_timeout': 60.0,
            'max_retries': 2
        })
        
        # Create chunker with config
        chunker = create_auto_chunker(self.options, config=config)
        
        # Verify config values were used
        self.assertEqual(chunker.timeout, 60.0)
        self.assertEqual(chunker.max_retries, 2)
        
        # Update config
        config.set('processing_timeout', 120.0)
        
        # Value should be updated when used
        self.assertEqual(chunker.config.get('processing_timeout'), 120.0)
    
    def test_with_file(self):
        """Test chunking with a file"""
        # Create temporary file
        with tempfile.NamedTemporaryFile(mode='w', delete=False) as temp:
            temp.write(self.sample_text * 10)
            temp_path = temp.name
        
        try:
            # Create chunker
            chunker = create_auto_chunker(self.options, memory_safety=True)
            
            # Read file and process
            with open(temp_path, 'r') as f:
                text = f.read()
                chunks = chunker.chunk(text, self.test_chunker)
            
            # Verify results
            self.assertIsInstance(chunks, list)
            self.assertTrue(len(chunks) > 0)
            
            # Check metrics
            metrics = chunker.get_metrics()
            self.assertIn('total_chunks_processed', metrics)
            self.assertEqual(metrics['total_chunks_processed'], len(chunks))
            
        finally:
            # Clean up
            os.unlink(temp_path)
    
    def test_priority_chunking(self):
        """Test priority-based chunking"""
        chunker = create_auto_chunker(self.options)
        
        # Process with different priorities
        high_priority_chunks = chunker.chunk_with_priority(
            self.sample_text, self.test_chunker, priority="high"
        )
        
        normal_priority_chunks = chunker.chunk_with_priority(
            self.sample_text, self.test_chunker, priority="normal"
        )
        
        # Both should produce the same results
        self.assertEqual(len(high_priority_chunks), len(normal_priority_chunks))
    
    def test_context_manager(self):
        """Test using the chunker as a context manager"""
        with create_auto_chunker(self.options) as chunker:
            # Process text
            chunks = chunker.chunk(self.sample_text, self.test_chunker)
            self.assertTrue(len(chunks) > 0)
        
        # Chunker should be shut down
        self.assertTrue(chunker._shutdown_event.is_set())
    
    def tearDown(self):
        """Clean up after tests"""
        # Nothing to clean up currently
        pass


if __name__ == '__main__':
    unittest.main()
