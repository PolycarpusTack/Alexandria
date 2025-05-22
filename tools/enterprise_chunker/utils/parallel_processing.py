"""
Parallel processing utilities for multi-threaded chunking
"""

import os
import logging
import multiprocessing
from typing import List, Dict, Any, Optional, Generator, Callable, Tuple, Union
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor, as_completed
from queue import Queue, Empty
import threading
import time

from enterprise_chunker.config import ChunkingOptions
from enterprise_chunker.models.enums import ChunkingStrategy

# Configure logging
logger = logging.getLogger(__name__)


class ParallelChunker:
    """
    Parallel processing implementation for chunking large content across multiple threads/processes
    """
    
    def __init__(
        self, 
        options: ChunkingOptions,
        max_workers: Optional[int] = None,
        use_processes: bool = False
    ):
        """
        Initialize the parallel chunker
        
        Args:
            options: Chunking options
            max_workers: Maximum number of worker threads/processes (None = auto)
            use_processes: Whether to use processes instead of threads
        """
        self.options = options
        self.use_processes = use_processes
        
        # Determine optimal number of workers
        if max_workers is None:
            # Use CPU count for processes, more for threads
            if use_processes:
                self.max_workers = max(1, os.cpu_count() - 1)  # Leave one CPU free
            else:
                # For I/O bound operations, more threads can be beneficial
                self.max_workers = min(32, os.cpu_count() * 4)
        else:
            self.max_workers = max_workers
            
        # Create shared queue for results
        self.results_queue = Queue()
    
    def chunk_segments(
        self, 
        segments: List[str],
        chunker_func: Callable[[str], List[str]]
    ) -> List[str]:
        """
        Process multiple segments in parallel
        
        Args:
            segments: List of text segments to process
            chunker_func: Function that chunks a segment
            
        Returns:
            List of processed chunks in order
        """
        # Skip parallel processing for small inputs
        if len(segments) <= 1 or self.max_workers <= 1:
            results = []
            for segment in segments:
                results.extend(chunker_func(segment))
            return results
        
        # Choose executor type
        executor_class = ProcessPoolExecutor if self.use_processes else ThreadPoolExecutor
        
        # Use context manager to ensure cleanup
        with executor_class(max_workers=min(self.max_workers, len(segments))) as executor:
            # Submit all tasks
            future_to_index = {
                executor.submit(chunker_func, segment): i 
                for i, segment in enumerate(segments)
            }
            
            # Collect results in order
            ordered_results = [[] for _ in range(len(segments))]
            
            # Wait for tasks to complete
            for future in as_completed(future_to_index):
                index = future_to_index[future]
                try:
                    result = future.result()
                    ordered_results[index] = result
                except Exception as e:
                    logger.error(f"Error processing segment {index}: {e}")
                    # Add empty result for failed segment
                    ordered_results[index] = []
            
            # Flatten results in proper order
            all_results = []
            for segment_results in ordered_results:
                all_results.extend(segment_results)
                
            return all_results
    
    def stream_chunks(
        self, 
        segment_gen: Generator[str, None, None],
        chunker_func: Callable[[str], List[str]]
    ) -> Generator[str, None, None]:
        """
        Process a stream of segments with parallel workers
        
        Args:
            segment_gen: Generator that yields text segments
            chunker_func: Function that chunks a segment
            
        Yields:
            Processed chunks
        """
        # Start worker thread
        stop_event = threading.Event()
        worker_thread = threading.Thread(
            target=self._worker_thread,
            args=(segment_gen, chunker_func, stop_event)
        )
        worker_thread.daemon = True
        worker_thread.start()
        
        try:
            # Read results from queue
            done = False
            while not done:
                try:
                    item = self.results_queue.get(timeout=0.1)
                    
                    # Check for end marker
                    if item == "DONE":
                        done = True
                        # Mark sentinel as done so queue.join() won't hang
                        self.results_queue.task_done()
                    elif item == "ERROR":
                        # An error occurred
                        logger.error("Error in worker thread")
                        done = True
                        # Mark sentinel as done so queue.join() won't hang
                        self.results_queue.task_done()
                    else:
                        # Yield the result chunk
                        yield item
                        self.results_queue.task_done()
                except Empty:
                    # Queue is empty, check if worker is still alive
                    if not worker_thread.is_alive():
                        # Worker died, likely due to an exception
                        done = True
        finally:
            # Signal worker to stop
            stop_event.set()
            
            # Wait for worker to finish (with timeout)
            worker_thread.join(timeout=1.0)
    
    def _worker_thread(
        self, 
        segment_gen: Generator[str, None, None],
        chunker_func: Callable[[str], List[str]],
        stop_event: threading.Event
    ):
        """
        Worker thread that processes segments and puts results in queue
        
        Args:
            segment_gen: Generator that yields text segments
            chunker_func: Function that chunks a segment
            stop_event: Event to signal thread to stop
        """
        try:
            # Choose executor type
            executor_class = ProcessPoolExecutor if self.use_processes else ThreadPoolExecutor
            
            # Use context manager to ensure cleanup
            with executor_class(max_workers=self.max_workers) as executor:
                # Create a buffer for segments
                segments_buffer = []
                futures = []
                
                # Process segments in batches
                for segment in segment_gen:
                    # Check if we should stop
                    if stop_event.is_set():
                        break
                        
                    # Add segment to buffer
                    segments_buffer.append(segment)
                    
                    # Process buffer when it's large enough
                    if len(segments_buffer) >= self.max_workers:
                        # Submit tasks for all segments in buffer
                        for seg in segments_buffer:
                            futures.append(executor.submit(chunker_func, seg))
                            
                        # Reset buffer
                        segments_buffer = []
                        
                        # Process completed futures
                        self._process_futures(futures)
                        futures = []
                
                # Process any remaining segments in buffer
                if segments_buffer and not stop_event.is_set():
                    for seg in segments_buffer:
                        futures.append(executor.submit(chunker_func, seg))
                        
                # Wait for all remaining futures
                self._process_futures(futures)
                
            # Signal completion
            self.results_queue.put("DONE")
                
        except Exception as e:
            logger.error(f"Error in worker thread: {e}")
            # Signal error
            self.results_queue.put("ERROR")
    
    def _process_futures(self, futures: List):
        """
        Process a list of futures and put results in queue
        
        Args:
            futures: List of futures to process
        """
        # Process results as they complete
        for future in as_completed(futures):
            try:
                result = future.result()
                
                # Put each chunk in the results queue
                for chunk in result:
                    self.results_queue.put(chunk)
            except Exception as e:
                logger.error(f"Error processing future: {e}")


class AdaptiveParallelChunker:
    """
    Adaptive parallel chunking with runtime performance monitoring
    """
    
    def __init__(self, options: ChunkingOptions):
        """
        Initialize the adaptive parallel chunker
        
        Args:
            options: Chunking options
        """
        self.options = options
        self.max_workers = os.cpu_count() or 4
        
        # Performance metrics
        self.segment_processing_times = []
        self.worker_utilization = []
    
    def chunk_in_parallel(
        self, 
        text: str,
        chunker_func: Callable[[str], List[str]]
    ) -> List[str]:
        """
        Adaptively chunk text with parallel processing
        
        Args:
            text: Text to chunk
            chunker_func: Function that chunks text
            
        Returns:
            List of processed chunks
        """
        # Skip parallel processing for small inputs
        if len(text) < 50000:  # ~50KB threshold
            return chunker_func(text)
        
        # Split text into segments
        segments = self._split_into_segments(text)
        
        # Process segments with adaptive workers
        start_time = time.time()
        
        # Start with a conservative number of workers
        current_workers = max(2, self.max_workers // 2)
        
        # Create chunker with current workers
        parallel_chunker = ParallelChunker(
            self.options,
            max_workers=current_workers,
            use_processes=False  # Start with threads
        )
        
        # Process first batch to gather metrics
        first_batch = segments[:min(len(segments), current_workers)]
        batch_start = time.time()
        first_results = parallel_chunker.chunk_segments(first_batch, chunker_func)
        batch_time = time.time() - batch_start
        
        # Calculate metrics
        avg_segment_time = batch_time / len(first_batch)
        self.segment_processing_times.append(avg_segment_time)
        
        # Adjust workers based on first batch performance
        if avg_segment_time < 0.1:  # Very fast processing
            # CPU-bound, increase workers to max
            adjusted_workers = min(self.max_workers, len(segments))
        elif avg_segment_time > 1.0:  # Slow processing
            # I/O-bound or complex processing, use more workers
            adjusted_workers = min(self.max_workers * 2, len(segments))
        else:
            # Balanced, keep current workers
            adjusted_workers = current_workers
            
        logger.debug(f"Adjusted workers from {current_workers} to {adjusted_workers} based on performance")
        
        # Process remaining segments with adjusted workers
        remaining_segments = segments[len(first_batch):]
        
        if remaining_segments:
            # Create new chunker with adjusted workers
            parallel_chunker = ParallelChunker(
                self.options,
                max_workers=adjusted_workers,
                use_processes=avg_segment_time > 0.5  # Use processes for longer-running tasks
            )
            
            # Process remaining segments
            remaining_results = parallel_chunker.chunk_segments(remaining_segments, chunker_func)
            
            # Combine results
            all_results = first_results + remaining_results
        else:
            all_results = first_results
            
        # Record metrics
        total_time = time.time() - start_time
        logger.debug(f"Processed {len(segments)} segments in {total_time:.2f}s using adaptive parallel chunking")
        
        return all_results
    
    def _split_into_segments(self, text: str) -> List[str]:
        """
        Split text into segments for parallel processing
        
        Args:
            text: Text to split
            
        Returns:
            List of text segments
        """
        # Determine appropriate segment size
        text_length = len(text)
        target_segments = min(self.max_workers * 2, max(2, text_length // 50000))
        target_size = text_length // target_segments
        
        segments = []
        current_pos = 0
        
        while current_pos < text_length:
            # Calculate end position
            end_pos = min(current_pos + target_size, text_length)
            
            # Extend to find a natural boundary
            if end_pos < text_length:
                # Look for paragraph break
                para_pos = text.find('\n\n', end_pos - 100, end_pos + 100)
                if para_pos != -1:
                    end_pos = para_pos + 2
                else:
                    # Look for line break
                    line_pos = text.find('\n', end_pos - 50, end_pos + 50)
                    if line_pos != -1:
                        end_pos = line_pos + 1
                    else:
                        # Look for sentence boundary
                        sentence_end = max(
                            text.rfind('. ', end_pos - 100, end_pos),
                            text.rfind('! ', end_pos - 100, end_pos),
                            text.rfind('? ', end_pos - 100, end_pos)
                        )
                        if sentence_end != -1:
                            end_pos = sentence_end + 2
                        else:
                            # Fall back to word boundary
                            space_pos = text.find(' ', end_pos - 20, end_pos + 20)
                            if space_pos != -1:
                                end_pos = space_pos + 1
            
            # Add segment
            segments.append(text[current_pos:end_pos])
            current_pos = end_pos
            
        return segments