"""
Performance monitoring and benchmarking utilities

This module provides comprehensive performance measurement, profiling, and optimization
tools for evaluating and improving chunking operations across various workloads.
"""

import time
import logging
import gc
import tracemalloc
import os
import sys
import json
import statistics
from typing import Dict, Any, List, Optional, Callable, Tuple, Union, Generator
from contextlib import contextmanager
from functools import wraps, lru_cache
import platform
import threading
import tempfile
from datetime import datetime

# Import optional dependencies with fallbacks
try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False

try:
    import matplotlib.pyplot as plt
    import numpy as np
    HAS_PLOTTING = True
except ImportError:
    HAS_PLOTTING = False

from enterprise_chunker.models.enums import ChunkingStrategy, ContentFormat
from enterprise_chunker.config import ChunkingOptions
from enterprise_chunker.utils.memory_optimization import MemoryManager

# Configure logging
logger = logging.getLogger(__name__)


class PerformanceMetrics:
    """Container for performance measurement data"""
    
    def __init__(self):
        """Initialize performance metrics"""
        self.execution_times = {}
        self.memory_usage = {}
        self.throughput = {}
        self.cpu_usage = {}
        self.chunk_statistics = {}
        self.start_time = time.time()
        self.end_time = None
        self.total_content_size = 0
        self.total_chunks = 0
        
    def record_execution_time(self, operation: str, duration: float):
        """
        Record execution time for an operation
        
        Args:
            operation: Name of the operation
            duration: Duration in seconds
        """
        if operation not in self.execution_times:
            self.execution_times[operation] = []
        self.execution_times[operation].append(duration)
    
    def record_memory_usage(self, operation: str, usage_mb: float):
        """
        Record memory usage for an operation
        
        Args:
            operation: Name of the operation
            usage_mb: Memory usage in megabytes
        """
        if operation not in self.memory_usage:
            self.memory_usage[operation] = []
        self.memory_usage[operation].append(usage_mb)
    
    def record_throughput(self, operation: str, bytes_per_second: float):
        """
        Record throughput for an operation
        
        Args:
            operation: Name of the operation
            bytes_per_second: Throughput in bytes per second
        """
        if operation not in self.throughput:
            self.throughput[operation] = []
        self.throughput[operation].append(bytes_per_second)
    
    def record_cpu_usage(self, operation: str, percent: float):
        """
        Record CPU usage for an operation
        
        Args:
            operation: Name of the operation
            percent: CPU usage percentage
        """
        if operation not in self.cpu_usage:
            self.cpu_usage[operation] = []
        self.cpu_usage[operation].append(percent)
    
    def record_chunk_statistics(self, chunk_sizes: List[int], chunk_count: int):
        """
        Record statistics about chunks
        
        Args:
            chunk_sizes: List of chunk sizes in tokens or characters
            chunk_count: Total number of chunks
        """
        if chunk_sizes:
            self.chunk_statistics = {
                'count': chunk_count,
                'min_size': min(chunk_sizes),
                'max_size': max(chunk_sizes),
                'avg_size': statistics.mean(chunk_sizes),
                'median_size': statistics.median(chunk_sizes),
                'stdev_size': statistics.stdev(chunk_sizes) if len(chunk_sizes) > 1 else 0,
                'total_tokens': sum(chunk_sizes)
            }
        else:
            self.chunk_statistics = {
                'count': 0,
                'min_size': 0,
                'max_size': 0,
                'avg_size': 0,
                'median_size': 0,
                'stdev_size': 0,
                'total_tokens': 0
            }
        
        self.total_chunks = chunk_count
    
    def finalize(self):
        """Finalize metrics collection"""
        self.end_time = time.time()
    
    def get_summary(self) -> Dict[str, Any]:
        """
        Get summary of performance metrics
        
        Returns:
            Dictionary with summarized metrics
        """
        if not self.end_time:
            self.finalize()
            
        result = {
            'total_time': self.end_time - self.start_time,
            'operations': {},
            'chunk_statistics': self.chunk_statistics
        }
        
        # Process operation-specific metrics
        for operation, times in self.execution_times.items():
            result['operations'][operation] = {
                'execution_time': {
                    'avg': statistics.mean(times),
                    'min': min(times),
                    'max': max(times),
                    'total': sum(times)
                }
            }
            
        # Add memory metrics
        for operation, usages in self.memory_usage.items():
            if operation not in result['operations']:
                result['operations'][operation] = {}
                
            result['operations'][operation]['memory_usage'] = {
                'avg': statistics.mean(usages),
                'min': min(usages),
                'max': max(usages),
                'peak': max(usages)
            }
            
        # Add throughput metrics
        for operation, throughputs in self.throughput.items():
            if operation not in result['operations']:
                result['operations'][operation] = {}
                
            result['operations'][operation]['throughput'] = {
                'avg_bytes_per_second': statistics.mean(throughputs),
                'peak_bytes_per_second': max(throughputs)
            }
            
        # Add CPU metrics
        for operation, cpu_usages in self.cpu_usage.items():
            if operation not in result['operations']:
                result['operations'][operation] = {}
                
            result['operations'][operation]['cpu_usage'] = {
                'avg_percent': statistics.mean(cpu_usages),
                'peak_percent': max(cpu_usages)
            }
            
        # Add overall processing rates
        if self.total_content_size > 0 and self.total_chunks > 0:
            overall_time = self.end_time - self.start_time
            result['overall'] = {
                'bytes_per_second': self.total_content_size / overall_time,
                'chunks_per_second': self.total_chunks / overall_time,
                'avg_bytes_per_chunk': self.total_content_size / self.total_chunks
            }
            
        return result
    
    def get_detailed_report(self) -> str:
        """
        Generate a detailed text report
        
        Returns:
            Formatted text report
        """
        summary = self.get_summary()
        
        report = []
        report.append("==== Performance Report ====")
        report.append(f"Total execution time: {summary['total_time']:.2f} seconds")
        
        if 'overall' in summary:
            report.append("\n== Overall Processing ==")
            report.append(f"Processing rate: {summary['overall']['bytes_per_second'] / 1024 / 1024:.2f} MB/sec")
            report.append(f"Chunk generation rate: {summary['overall']['chunks_per_second']:.2f} chunks/sec")
            report.append(f"Average chunk size: {summary['overall']['avg_bytes_per_chunk']:.2f} bytes")
        
        report.append("\n== Operation Details ==")
        for operation, metrics in summary['operations'].items():
            report.append(f"\nOperation: {operation}")
            
            if 'execution_time' in metrics:
                report.append("  Execution Time:")
                report.append(f"    Avg: {metrics['execution_time']['avg']:.4f} sec")
                report.append(f"    Min: {metrics['execution_time']['min']:.4f} sec")
                report.append(f"    Max: {metrics['execution_time']['max']:.4f} sec")
                report.append(f"    Total: {metrics['execution_time']['total']:.4f} sec")
                
            if 'memory_usage' in metrics:
                report.append("  Memory Usage:")
                report.append(f"    Avg: {metrics['memory_usage']['avg']:.2f} MB")
                report.append(f"    Peak: {metrics['memory_usage']['peak']:.2f} MB")
                
            if 'throughput' in metrics:
                report.append("  Throughput:")
                report.append(f"    Avg: {metrics['throughput']['avg_bytes_per_second'] / 1024 / 1024:.2f} MB/sec")
                report.append(f"    Peak: {metrics['throughput']['peak_bytes_per_second'] / 1024 / 1024:.2f} MB/sec")
                
            if 'cpu_usage' in metrics:
                report.append("  CPU Usage:")
                report.append(f"    Avg: {metrics['cpu_usage']['avg_percent']:.2f}%")
                report.append(f"    Peak: {metrics['cpu_usage']['peak_percent']:.2f}%")
        
        if 'chunk_statistics' in summary and summary['chunk_statistics']:
            report.append("\n== Chunk Statistics ==")
            chunk_stats = summary['chunk_statistics']
            report.append(f"Total chunks: {chunk_stats['count']}")
            report.append(f"Min chunk size: {chunk_stats['min_size']} tokens")
            report.append(f"Max chunk size: {chunk_stats['max_size']} tokens")
            report.append(f"Avg chunk size: {chunk_stats['avg_size']:.2f} tokens")
            report.append(f"Median chunk size: {chunk_stats['median_size']} tokens")
            report.append(f"Std dev of chunk sizes: {chunk_stats['stdev_size']:.2f} tokens")
            report.append(f"Total tokens: {chunk_stats['total_tokens']} tokens")
        
        return "\n".join(report)
    
    def export_to_json(self, file_path: str):
        """
        Export metrics to a JSON file
        
        Args:
            file_path: Path to save the JSON file
        """
        with open(file_path, 'w') as f:
            json.dump(self.get_summary(), f, indent=2)
    
    def generate_visualizations(self, output_dir: Optional[str] = None):
        """
        Generate performance visualization charts
        
        Args:
            output_dir: Directory to save visualization files
        """
        if not HAS_PLOTTING:
            logger.warning("Matplotlib and numpy are required for visualizations. Skipping.")
            return
            
        if not output_dir:
            output_dir = tempfile.mkdtemp(prefix="chunker_perf_")
        os.makedirs(output_dir, exist_ok=True)
        
        # Generate execution time chart
        if self.execution_times:
            plt.figure(figsize=(10, 6))
            operations = list(self.execution_times.keys())
            avg_times = [statistics.mean(self.execution_times[op]) for op in operations]
            
            plt.bar(operations, avg_times)
            plt.title('Average Execution Time by Operation')
            plt.xlabel('Operation')
            plt.ylabel('Time (seconds)')
            plt.xticks(rotation=45, ha='right')
            plt.tight_layout()
            plt.savefig(os.path.join(output_dir, 'execution_times.png'))
            plt.close()
        
        # Generate memory usage chart
        if self.memory_usage:
            plt.figure(figsize=(10, 6))
            operations = list(self.memory_usage.keys())
            peak_memory = [max(self.memory_usage[op]) for op in operations]
            
            plt.bar(operations, peak_memory)
            plt.title('Peak Memory Usage by Operation')
            plt.xlabel('Operation')
            plt.ylabel('Memory Usage (MB)')
            plt.xticks(rotation=45, ha='right')
            plt.tight_layout()
            plt.savefig(os.path.join(output_dir, 'memory_usage.png'))
            plt.close()
            
        # Generate chunk size distribution
        if self.chunk_statistics and self.chunk_statistics.get('count', 0) > 0:
            # We need actual chunk sizes for histogram, not just statistics
            # This is a placeholder - actual implementation would need to capture the raw sizes
            logger.info(f"Visualizations saved to {output_dir}")


class PerformanceMonitor:
    """Real-time performance monitoring for chunking operations"""
    
    def __init__(self, interval: float = 1.0):
        """
        Initialize performance monitor
        
        Args:
            interval: Monitoring interval in seconds
        """
        self.interval = interval
        self.metrics = PerformanceMetrics()
        self.memory_manager = MemoryManager()
        self._monitoring_thread = None
        self._stop_event = threading.Event()
        self._cpu_percent = 0
        self._memory_mb = 0
        
        # Initialize CPU and memory monitoring if psutil is available
        self.has_monitoring = HAS_PSUTIL
        if self.has_monitoring:
            self.process = psutil.Process(os.getpid())
    
    def start_monitoring(self):
        """Start background monitoring thread"""
        if not self.has_monitoring:
            logger.warning("psutil is required for real-time monitoring. Running with limited metrics.")
            return
            
        self._stop_event.clear()
        self._monitoring_thread = threading.Thread(target=self._monitor_resources)
        self._monitoring_thread.daemon = True
        self._monitoring_thread.start()
        logger.debug("Started performance monitoring thread")
    
    def stop_monitoring(self):
        """Stop background monitoring thread"""
        if self._monitoring_thread and self._monitoring_thread.is_alive():
            self._stop_event.set()
            self._monitoring_thread.join(timeout=self.interval * 2)
            logger.debug("Stopped performance monitoring thread")
    
    def _monitor_resources(self):
        """Background monitoring function"""
        while not self._stop_event.is_set():
            try:
                # Get current CPU and memory usage
                self._cpu_percent = self.process.cpu_percent(interval=None)
                memory_info = self.process.memory_info()
                self._memory_mb = memory_info.rss / 1024 / 1024
                
                # Record metrics
                self.metrics.record_cpu_usage("process", self._cpu_percent)
                self.metrics.record_memory_usage("process", self._memory_mb)
                
            except Exception as e:
                logger.error(f"Error in monitoring thread: {e}")
                
            # Sleep for interval duration
            time.sleep(self.interval)
    
    def get_current_usage(self) -> Dict[str, float]:
        """
        Get current resource usage
        
        Returns:
            Dictionary with current CPU and memory usage
        """
        if self.has_monitoring:
            # Return latest monitored values
            return {
                "cpu_percent": self._cpu_percent,
                "memory_mb": self._memory_mb
            }
        else:
            # Fallback for systems without psutil
            return {
                "cpu_percent": 0,
                "memory_mb": self.memory_manager.get_memory_usage()
            }
    
    @contextmanager
    def measure_operation(self, operation_name: str, content_size: Optional[int] = None):
        """
        Context manager for measuring performance of an operation
        
        Args:
            operation_name: Name of the operation
            content_size: Size of content being processed (for throughput calculation)
            
        Yields:
            Context for the operation
        """
        # Record starting metrics
        start_time = time.time()
        start_memory = self.memory_manager.get_memory_usage()
        
        try:
            # Yield control back to the caller
            yield
        finally:
            # Record ending metrics
            end_time = time.time()
            end_memory = self.memory_manager.get_memory_usage()
            duration = end_time - start_time
            
            # Record execution time
            self.metrics.record_execution_time(operation_name, duration)
            
            # Record memory usage
            memory_increase = max(0, end_memory - start_memory)
            self.metrics.record_memory_usage(operation_name, memory_increase)
            
            # Calculate and record throughput if content size is known
            if content_size:
                throughput = content_size / max(duration, 0.001)  # Avoid division by zero
                self.metrics.record_throughput(operation_name, throughput)
                
            # Get current CPU usage
            usage = self.get_current_usage()
            self.metrics.record_cpu_usage(operation_name, usage["cpu_percent"])
            
            logger.debug(
                f"Operation '{operation_name}' completed in {duration:.4f}s "
                f"(Memory: {memory_increase:.2f}MB, CPU: {usage['cpu_percent']:.1f}%)"
            )
    
    def record_chunk_metadata(self, chunks, content_size: int):
        """
        Record metadata about chunks for analysis
        
        Args:
            chunks: List of chunks or chunk metadata
            content_size: Size of original content
        """
        # Extract sizes if available or use length as fallback
        chunk_sizes = []
        for chunk in chunks:
            if isinstance(chunk, dict) and 'token_count' in chunk:
                chunk_sizes.append(chunk['token_count'])
            elif isinstance(chunk, dict) and 'size' in chunk:
                chunk_sizes.append(chunk['size'])
            elif hasattr(chunk, 'token_count'):
                chunk_sizes.append(chunk.token_count)
            elif hasattr(chunk, 'size'):
                chunk_sizes.append(chunk.size)
            elif isinstance(chunk, str):
                # Estimate token count as character count / 4 as a rough approximation
                chunk_sizes.append(len(chunk) // 4)
            else:
                # Fallback to estimating from string representation
                chunk_sizes.append(len(str(chunk)) // 4)
        
        # Record chunk statistics
        self.metrics.record_chunk_statistics(chunk_sizes, len(chunks))
        
        # Update total content size
        self.metrics.total_content_size += content_size


def timing_decorator(func=None, log_level='debug', logger_name=None):
    """
    Simple decorator for timing function execution
    
    Args:
        func: The function to decorate (used when decorator is called without arguments)
        log_level: Logging level to use ('debug', 'info', 'warning', 'error')
        logger_name: Name of logger to use (defaults to module logger)
    
    Returns:
        Decorated function
    """
    # Handle the case when decorator is called without arguments
    if func is not None:
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Set up logging
            log = logger
                
            # Get logging function based on level
            log_fn = getattr(log, log_level.lower())
            
            # Start timing
            start_time = time.time()
            
            # Execute function
            result = func(*args, **kwargs)
            
            # Calculate duration
            duration = time.time() - start_time
            
            # Log the timing
            log_fn(f"{func.__name__} executed in {duration:.4f} seconds")
            
            return result
        return wrapper
    
    # Regular case - decorator called with arguments
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Set up logging
            if logger_name:
                log = logging.getLogger(logger_name)
            else:
                log = logger
                
            # Get logging function based on level
            log_fn = getattr(log, log_level.lower())
            
            # Start timing
            start_time = time.time()
            
            # Execute function
            result = func(*args, **kwargs)
            
            # Calculate duration
            duration = time.time() - start_time
            
            # Log the timing
            log_fn(f"{func.__name__} executed in {duration:.4f} seconds")
            
            return result
        return wrapper
    return decorator


def profile_function(operation_name: Optional[str] = None):
    """
    Decorator for profiling function performance
    
    Args:
        operation_name: Name of the operation (defaults to function name)
    
    Returns:
        Decorated function
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Determine operation name
            nonlocal operation_name
            if operation_name is None:
                operation_name = func.__name__
                
            # Set up monitoring
            monitor = PerformanceMonitor()
            
            # Determine content size if possible from args/kwargs
            content_size = None
            for arg in args:
                if isinstance(arg, str):
                    content_size = len(arg.encode('utf-8'))
                    break
                elif isinstance(arg, bytes):
                    content_size = len(arg)
                    break
            
            # Measure the operation
            with monitor.measure_operation(operation_name, content_size):
                result = func(*args, **kwargs)
                
            return result
        return wrapper
    return decorator


class BenchmarkRunner:
    """Benchmarking utility for comparing different chunking strategies"""
    
    def __init__(self, output_dir: Optional[str] = None):
        """
        Initialize benchmark runner
        
        Args:
            output_dir: Directory to store benchmark results
        """
        self.output_dir = output_dir or tempfile.mkdtemp(prefix="chunker_benchmark_")
        os.makedirs(self.output_dir, exist_ok=True)
        self.results = {}
        self.monitors = {}
    
    def benchmark_strategy(
        self,
        strategy_name: str,
        chunker_func: Callable,
        test_data: Union[str, bytes, List[str]],
        content_format: Optional[ContentFormat] = None,
        iterations: int = 3,
        warmup_iterations: int = 1
    ):
        """
        Benchmark a specific chunking strategy
        
        Args:
            strategy_name: Name of the strategy being benchmarked
            chunker_func: Function that implements the chunking strategy
            test_data: Data to use for benchmarking
            content_format: Format of the content (for logging)
            iterations: Number of test iterations
            warmup_iterations: Number of warmup iterations
        """
        logger.info(f"Benchmarking strategy: {strategy_name}")
        
        # Prepare test data
        if isinstance(test_data, list):
            test_content = "".join(test_data)
            content_size = len(test_content.encode('utf-8'))
        elif isinstance(test_data, str):
            test_content = test_data
            content_size = len(test_content.encode('utf-8'))
        else:  # bytes
            test_content = test_data
            content_size = len(test_content)
            
        # Initial warmup runs
        logger.debug(f"Performing {warmup_iterations} warmup iterations")
        for i in range(warmup_iterations):
            chunker_func(test_content)
            # Clear memory after warmup
            gc.collect()
        
        # Create performance monitor
        monitor = PerformanceMonitor()
        monitor.start_monitoring()
        
        try:
            # Run benchmark iterations
            logger.info(f"Running {iterations} benchmark iterations")
            for i in range(iterations):
                logger.debug(f"Iteration {i+1}/{iterations}")
                
                # Measure chunking performance
                with monitor.measure_operation(f"{strategy_name}", content_size):
                    chunks = chunker_func(test_content)
                    
                # Record chunk metadata
                monitor.record_chunk_metadata(chunks, content_size)
                
                # Clear memory between iterations
                gc.collect()
        finally:
            # Stop monitoring
            monitor.stop_monitoring()
        
        # Store results
        self.monitors[strategy_name] = monitor
        self.results[strategy_name] = monitor.metrics.get_summary()
        
        # Log summary
        logger.info(f"Strategy '{strategy_name}' - "
                    f"Avg time: {self.results[strategy_name]['operations'][strategy_name]['execution_time']['avg']:.4f}s, "
                    f"Chunks: {monitor.metrics.chunk_statistics['count']}")
    
    def compare_results(self) -> Dict[str, Any]:
        """
        Compare benchmark results across strategies
        
        Returns:
            Dictionary with comparison metrics
        """
        if not self.results:
            logger.warning("No benchmark results to compare")
            return {}
            
        # Get baseline strategy (first one) for normalization
        baseline = next(iter(self.results.keys()))
        baseline_metrics = self.results[baseline]
        
        comparison = {
            'timestamp': datetime.now().isoformat(),
            'baseline': baseline,
            'strategies': {},
            'fastest': None,
            'lowest_memory': None,
            'highest_throughput': None
        }
        
        # Find fastest strategy
        fastest_time = float('inf')
        lowest_memory = float('inf')
        highest_throughput = 0
        
        for strategy, metrics in self.results.items():
            # Get operation metrics for the main strategy operation
            op_metrics = metrics['operations'][strategy]
            avg_time = op_metrics['execution_time']['avg']
            
            # Find fastest
            if avg_time < fastest_time:
                fastest_time = avg_time
                comparison['fastest'] = strategy
                
            # Find lowest memory if available
            if 'memory_usage' in op_metrics:
                memory_usage = op_metrics['memory_usage']['peak']
                if memory_usage < lowest_memory:
                    lowest_memory = memory_usage
                    comparison['lowest_memory'] = strategy
                    
            # Find highest throughput if available
            if 'throughput' in op_metrics:
                throughput = op_metrics['throughput']['avg_bytes_per_second']
                if throughput > highest_throughput:
                    highest_throughput = throughput
                    comparison['highest_throughput'] = strategy
            
            # Calculate comparison metrics
            comparison['strategies'][strategy] = {
                'execution_time': op_metrics['execution_time']['avg'],
                'chunks': self.monitors[strategy].metrics.chunk_statistics['count'],
                'relative_speed': baseline_metrics['operations'][baseline]['execution_time']['avg'] / avg_time
            }
            
            # Add memory usage if available
            if 'memory_usage' in op_metrics:
                comparison['strategies'][strategy]['peak_memory'] = op_metrics['memory_usage']['peak']
                
            # Add throughput if available
            if 'throughput' in op_metrics:
                comparison['strategies'][strategy]['throughput'] = op_metrics['throughput']['avg_bytes_per_second']
            
        return comparison
    
    def generate_report(self) -> str:
        """
        Generate a comprehensive benchmark report
        
        Returns:
            Benchmark report as formatted text
        """
        if not self.results:
            return "No benchmark results available"
            
        comparison = self.compare_results()
        
        report = []
        report.append("===== Chunking Strategy Benchmark Report =====")
        report.append(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append(f"System: {platform.system()} {platform.release()} {platform.machine()}")
        report.append(f"Python: {platform.python_version()}")
        report.append("\n=== Performance Comparison ===")
        
        # Create comparison table
        headers = ["Strategy", "Execution Time (s)", "Chunks", "Relative Speed", "Peak Memory (MB)", "Throughput (MB/s)"]
        report.append("  ".join(headers))
        report.append("-" * 80)
        
        for strategy, metrics in comparison['strategies'].items():
            row = [
                strategy,
                f"{metrics['execution_time']:.4f}",
                f"{metrics['chunks']}",
                f"{metrics['relative_speed']:.2f}x"
            ]
            
            # Add memory if available
            if 'peak_memory' in metrics:
                row.append(f"{metrics['peak_memory']:.2f}")
            else:
                row.append("N/A")
                
            # Add throughput if available
            if 'throughput' in metrics:
                row.append(f"{metrics['throughput'] / 1024 / 1024:.2f}")
            else:
                row.append("N/A")
                
            report.append("  ".join(row))
            
        # Add summary
        report.append("\n=== Summary ===")
        report.append(f"Fastest strategy: {comparison['fastest']}")
        
        if comparison['lowest_memory']:
            report.append(f"Lowest memory usage: {comparison['lowest_memory']}")
            
        if comparison['highest_throughput']:
            report.append(f"Highest throughput: {comparison['highest_throughput']}")
            
        # Add detailed reports for each strategy
        report.append("\n=== Detailed Strategy Reports ===")
        for strategy, monitor in self.monitors.items():
            report.append(f"\n--- {strategy} ---")
            report.append(monitor.metrics.get_detailed_report())
            
        return "\n".join(report)
    
    def save_results(self, filename_prefix: str = "benchmark"):
        """
        Save benchmark results to disk
        
        Args:
            filename_prefix: Prefix for output files
        """
        # Create timestamp string for filenames
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Save comparison report
        comparison = self.compare_results()
        comparison_path = os.path.join(self.output_dir, f"{filename_prefix}_comparison_{timestamp}.json")
        with open(comparison_path, "w") as f:
            json.dump(comparison, f, indent=2)
            
        # Save full report
        report = self.generate_report()
        report_path = os.path.join(self.output_dir, f"{filename_prefix}_report_{timestamp}.txt")
        with open(report_path, "w") as f:
            f.write(report)
            
        # Save individual strategy results
        for strategy, metrics in self.results.items():
            strategy_path = os.path.join(
                self.output_dir, f"{filename_prefix}_{strategy.lower()}_{timestamp}.json"
            )
            with open(strategy_path, "w") as f:
                json.dump(metrics, f, indent=2)
                
        # Generate visualizations if matplotlib is available
        if HAS_PLOTTING:
            viz_dir = os.path.join(self.output_dir, f"{filename_prefix}_visualizations_{timestamp}")
            os.makedirs(viz_dir, exist_ok=True)
            
            # Create strategy comparison charts
            self._generate_comparison_charts(comparison, viz_dir)
            
            # Create individual strategy visualizations
            for strategy, monitor in self.monitors.items():
                strategy_viz_dir = os.path.join(viz_dir, strategy.lower())
                os.makedirs(strategy_viz_dir, exist_ok=True)
                monitor.metrics.generate_visualizations(strategy_viz_dir)
                
        logger.info(f"Benchmark results saved to {self.output_dir}")
        return {
            'comparison_path': comparison_path,
            'report_path': report_path,
            'output_dir': self.output_dir
        }
    
    def _generate_comparison_charts(self, comparison: Dict[str, Any], output_dir: str):
        """
        Generate comparison charts between strategies
        
        Args:
            comparison: Comparison data dictionary
            output_dir: Directory to save charts
        """
        if not HAS_PLOTTING:
            return
            
        strategies = list(comparison['strategies'].keys())
        
        # Execution time comparison
        plt.figure(figsize=(10, 6))
        times = [comparison['strategies'][s]['execution_time'] for s in strategies]
        plt.bar(strategies, times)
        plt.title('Execution Time by Strategy')
        plt.xlabel('Strategy')
        plt.ylabel('Time (seconds)')
        plt.xticks(rotation=45, ha='right')
        plt.tight_layout()
        plt.savefig(os.path.join(output_dir, 'execution_time_comparison.png'))
        plt.close()
        
        # Relative speed comparison
        plt.figure(figsize=(10, 6))
        speeds = [comparison['strategies'][s]['relative_speed'] for s in strategies]
        plt.bar(strategies, speeds)
        plt.title('Relative Speed by Strategy')
        plt.xlabel('Strategy')
        plt.ylabel('Speed (relative to baseline)')
        plt.xticks(rotation=45, ha='right')
        plt.tight_layout()
        plt.savefig(os.path.join(output_dir, 'relative_speed_comparison.png'))
        plt.close()
        
        # Memory usage comparison if available
        if all('peak_memory' in comparison['strategies'][s] for s in strategies):
            plt.figure(figsize=(10, 6))
            memory = [comparison['strategies'][s]['peak_memory'] for s in strategies]
            plt.bar(strategies, memory)
            plt.title('Peak Memory Usage by Strategy')
            plt.xlabel('Strategy')
            plt.ylabel('Memory (MB)')
            plt.xticks(rotation=45, ha='right')
            plt.tight_layout()
            plt.savefig(os.path.join(output_dir, 'memory_usage_comparison.png'))
            plt.close()
            
        # Throughput comparison if available
        if all('throughput' in comparison['strategies'][s] for s in strategies):
            plt.figure(figsize=(10, 6))
            throughput = [comparison['strategies'][s]['throughput'] / 1024 / 1024 for s in strategies]
            plt.bar(strategies, throughput)
            plt.title('Throughput by Strategy')
            plt.xlabel('Strategy')
            plt.ylabel('Throughput (MB/s)')
            plt.xticks(rotation=45, ha='right')
            plt.tight_layout()
            plt.savefig(os.path.join(output_dir, 'throughput_comparison.png'))
            plt.close()


class PerformanceOptimizer:
    """
    Optimizer for finding ideal chunking parameters for performance
    """
    
    def __init__(self, base_options: ChunkingOptions):
        """
        Initialize performance optimizer
        
        Args:
            base_options: Base chunking options to optimize
        """
        self.base_options = base_options
        self.results = {}
        self.best_params = None
        self.best_score = None
    
    def optimize_chunk_size(
        self,
        chunker_factory: Callable[[ChunkingOptions], Callable],
        test_data: Union[str, bytes],
        size_range: Tuple[int, int, int] = (100, 1000, 100),
        iterations: int = 2
    ):
        """
        Find optimal chunk size for performance
        
        Args:
            chunker_factory: Function that creates a chunker from options
            test_data: Test data to use for optimization
            size_range: Tuple of (min_size, max_size, step) for chunk sizes
            iterations: Number of iterations per size
        """
        logger.info(f"Optimizing chunk size from {size_range[0]} to {size_range[1]} by {size_range[2]}")
        
        # Run benchmark for each chunk size
        sizes = range(size_range[0], size_range[1] + 1, size_range[2])
        benchmark = BenchmarkRunner()
        
        for chunk_size in sizes:
            # Create options with this chunk size
            options = self._create_options_with_size(chunk_size)
            
            # Create chunker function
            chunker = chunker_factory(options)
            
            # Benchmark this configuration
            strategy_name = f"chunk_size_{chunk_size}"
            benchmark.benchmark_strategy(
                strategy_name=strategy_name,
                chunker_func=chunker,
                test_data=test_data,
                iterations=iterations
            )
        
        # Compare results
        comparison = benchmark.compare_results()
        
        # Find best parameters
        self._find_best_params(comparison)
        
        # Save detailed results
        self.results = benchmark.results
        
        return {
            'best_size': self.best_params,
            'comparison': comparison,
            'detailed_report': benchmark.generate_report()
        }
    
    def optimize_overlap(
        self,
        chunker_factory: Callable[[ChunkingOptions], Callable],
        test_data: Union[str, bytes],
        overlap_range: Tuple[int, int, int] = (0, 200, 20),
        iterations: int = 2
    ):
        """
        Find optimal overlap size for performance
        
        Args:
            chunker_factory: Function that creates a chunker from options
            test_data: Test data to use for optimization
            overlap_range: Tuple of (min_overlap, max_overlap, step) for overlap
            iterations: Number of iterations per overlap value
        """
        logger.info(f"Optimizing overlap from {overlap_range[0]} to {overlap_range[1]} by {overlap_range[2]}")
        
        # Run benchmark for each overlap
        overlaps = range(overlap_range[0], overlap_range[1] + 1, overlap_range[2])
        benchmark = BenchmarkRunner()
        
        for overlap in overlaps:
            # Create options with this overlap
            options = self._create_options_with_overlap(overlap)
            
            # Create chunker function
            chunker = chunker_factory(options)
            
            # Benchmark this configuration
            strategy_name = f"overlap_{overlap}"
            benchmark.benchmark_strategy(
                strategy_name=strategy_name,
                chunker_func=chunker,
                test_data=test_data,
                iterations=iterations
            )
        
        # Compare results
        comparison = benchmark.compare_results()
        
        # Find best parameters
        self._find_best_params(comparison)
        
        # Save detailed results
        self.results = benchmark.results
        
        return {
            'best_overlap': self.best_params,
            'comparison': comparison,
            'detailed_report': benchmark.generate_report()
        }
    
    def optimize_strategy(
        self,
        chunker_factories: Dict[ChunkingStrategy, Callable[[ChunkingOptions], Callable]],
        test_data: Union[str, bytes],
        iterations: int = 3
    ):
        """
        Find optimal chunking strategy for performance
        
        Args:
            chunker_factories: Dictionary of strategy to chunker factory functions
            test_data: Test data to use for optimization
            iterations: Number of iterations per strategy
        """
        logger.info(f"Optimizing chunking strategy across {len(chunker_factories)} strategies")
        
        # Run benchmark for each strategy
        benchmark = BenchmarkRunner()
        
        for strategy, factory in chunker_factories.items():
            # Create options with this strategy
            options = self._create_options_with_strategy(strategy)
            
            # Create chunker function
            chunker = factory(options)
            
            # Benchmark this configuration
            strategy_name = strategy.value
            benchmark.benchmark_strategy(
                strategy_name=strategy_name,
                chunker_func=chunker,
                test_data=test_data,
                iterations=iterations
            )
        
        # Compare results
        comparison = benchmark.compare_results()
        
        # Find best parameters
        self._find_best_params(comparison)
        
        # Save detailed results
        self.results = benchmark.results
        
        return {
            'best_strategy': self.best_params,
            'comparison': comparison,
            'detailed_report': benchmark.generate_report()
        }
    
    def _create_options_with_size(self, chunk_size: int) -> ChunkingOptions:
        """
        Create chunking options with specified chunk size
        
        Args:
            chunk_size: Target chunk size in tokens
            
        Returns:
            Modified chunking options
        """
        # Create a copy of base options with new chunk size
        options = ChunkingOptions(
            chunk_size=chunk_size,
            overlap_tokens=self.base_options.overlap_tokens,
            chunking_strategy=self.base_options.chunking_strategy,
            overlap_enforcement=self.base_options.overlap_enforcement,
            stream_buffer_size=self.base_options.stream_buffer_size
        )
        return options
    
    def _create_options_with_overlap(self, overlap: int) -> ChunkingOptions:
        """
        Create chunking options with specified overlap
        
        Args:
            overlap: Target overlap in tokens
            
        Returns:
            Modified chunking options
        """
        # Create a copy of base options with new overlap
        options = ChunkingOptions(
            chunk_size=self.base_options.chunk_size,
            overlap_tokens=overlap,
            chunking_strategy=self.base_options.chunking_strategy,
            overlap_enforcement=self.base_options.overlap_enforcement,
            stream_buffer_size=self.base_options.stream_buffer_size
        )
        return options
    
    def _create_options_with_strategy(self, strategy: ChunkingStrategy) -> ChunkingOptions:
        """
        Create chunking options with specified strategy
        
        Args:
            strategy: Chunking strategy
            
        Returns:
            Modified chunking options
        """
        # Create a copy of base options with new strategy
        options = ChunkingOptions(
            chunk_size=self.base_options.chunk_size,
            overlap_tokens=self.base_options.overlap_tokens,
            chunking_strategy=strategy,
            overlap_enforcement=self.base_options.overlap_enforcement,
            stream_buffer_size=self.base_options.stream_buffer_size
        )
        return options
    
    def _find_best_params(self, comparison: Dict[str, Any]):
        """
        Find best parameters from comparison results
        
        Args:
            comparison: Comparison results dictionary
        """
        # Use fastest by default
        self.best_params = comparison['fastest']
        self.best_score = comparison['strategies'][self.best_params]['execution_time']
        
        logger.info(f"Best performance from: {self.best_params} "
                   f"(execution time: {self.best_score:.4f}s)")
        
    def get_optimized_options(self) -> ChunkingOptions:
        """
        Get chunking options optimized for performance
        
        Returns:
            Optimized chunking options
        """
        if not self.best_params:
            logger.warning("No optimization has been performed")
            return self.base_options
            
        # Parse the best parameter
        param_str = self.best_params.lower()
        
        if param_str.startswith("chunk_size_"):
            size = int(param_str.split("_")[-1])
            return self._create_options_with_size(size)
            
        elif param_str.startswith("overlap_"):
            overlap = int(param_str.split("_")[-1])
            return self._create_options_with_overlap(overlap)
            
        elif any(s.value.lower() == param_str for s in ChunkingStrategy):
            # Find matching strategy
            for strategy in ChunkingStrategy:
                if strategy.value.lower() == param_str:
                    return self._create_options_with_strategy(strategy)
                    
        # Fallback to base options
        logger.warning(f"Could not parse best parameter: {param_str}")
        return self.base_options