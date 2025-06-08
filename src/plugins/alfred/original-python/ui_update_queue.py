#!/usr/bin/env python3
"""
Thread-safe UI Update Queue for ALFRED
Provides safe, ordered UI updates from background threads
"""

import threading
import queue
from typing import Callable, Any, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime
import traceback
from alfred_logger import get_logger


@dataclass
class UIUpdate:
    """Represents a UI update operation"""
    callback: Callable
    args: Tuple = ()
    kwargs: dict = None
    priority: int = 0  # Higher priority = processed first
    timestamp: datetime = None
    retry_count: int = 0
    max_retries: int = 3
    
    def __post_init__(self):
        if self.kwargs is None:
            self.kwargs = {}
        if self.timestamp is None:
            self.timestamp = datetime.now()
    
    def execute(self):
        """Execute the UI update"""
        try:
            return self.callback(*self.args, **self.kwargs)
        except Exception as e:
            self.retry_count += 1
            if self.retry_count >= self.max_retries:
                raise
            else:
                # Log and potentially retry
                raise RetryableError(f"UI update failed (attempt {self.retry_count}): {e}")


class RetryableError(Exception):
    """Error that indicates the operation can be retried"""
    pass


class UIUpdateQueue:
    """Thread-safe queue for UI updates with priority and batching"""
    
    def __init__(self, root_widget, batch_size: int = 10, update_interval: int = 16):
        """
        Initialize UI update queue
        
        Args:
            root_widget: The root tkinter widget (usually Tk())
            batch_size: Maximum updates to process per interval
            update_interval: Milliseconds between update batches (16ms = ~60fps)
        """
        self.root = root_widget
        self.batch_size = batch_size
        self.update_interval = update_interval
        
        # Priority queue for updates
        self._queue = queue.PriorityQueue()
        self._lock = threading.Lock()
        self._running = True
        self._paused = False
        
        # Statistics
        self._processed_count = 0
        self._error_count = 0
        self._retry_count = 0
        self._last_update_time = datetime.now()
        
        # Logger
        self.logger = get_logger()
        
        # Start processing
        self._schedule_next_update()
    
    def add(self, callback: Callable, *args, priority: int = 0, **kwargs):
        """
        Add a UI update to the queue
        
        Args:
            callback: Function to call in UI thread
            *args: Positional arguments for callback
            priority: Update priority (higher = sooner)
            **kwargs: Keyword arguments for callback
        """
        if not self._running:
            return
        
        update = UIUpdate(
            callback=callback,
            args=args,
            kwargs=kwargs,
            priority=-priority  # Negative for proper priority queue ordering
        )
        
        self._queue.put((update.priority, update.timestamp, update))
    
    def add_high_priority(self, callback: Callable, *args, **kwargs):
        """Add a high-priority UI update"""
        self.add(callback, *args, priority=100, **kwargs)
    
    def add_low_priority(self, callback: Callable, *args, **kwargs):
        """Add a low-priority UI update"""
        self.add(callback, *args, priority=-10, **kwargs)
    
    def pause(self):
        """Pause processing updates"""
        self._paused = True
        self.logger.log_info("UI update queue paused")
    
    def resume(self):
        """Resume processing updates"""
        self._paused = False
        self.logger.log_info("UI update queue resumed")
    
    def clear(self):
        """Clear all pending updates"""
        with self._lock:
            # Empty the queue
            while not self._queue.empty():
                try:
                    self._queue.get_nowait()
                except queue.Empty:
                    break
            self.logger.log_info("UI update queue cleared")
    
    def stop(self):
        """Stop the update queue"""
        self._running = False
        self.clear()
        self.logger.log_info("UI update queue stopped", {
            "processed": self._processed_count,
            "errors": self._error_count,
            "retries": self._retry_count
        })
    
    def get_stats(self) -> dict:
        """Get queue statistics"""
        return {
            "pending": self._queue.qsize(),
            "processed": self._processed_count,
            "errors": self._error_count,
            "retries": self._retry_count,
            "paused": self._paused,
            "running": self._running
        }
    
    def _schedule_next_update(self):
        """Schedule the next update batch"""
        if self._running and hasattr(self.root, 'after'):
            self.root.after(self.update_interval, self._process_updates)
    
    def _process_updates(self):
        """Process a batch of updates"""
        if not self._running:
            return
        
        if self._paused:
            self._schedule_next_update()
            return
        
        processed = 0
        errors = []
        
        # Process up to batch_size updates
        while processed < self.batch_size and not self._queue.empty():
            try:
                _, _, update = self._queue.get_nowait()
                
                # Execute the update
                try:
                    update.execute()
                    self._processed_count += 1
                except RetryableError as e:
                    # Re-queue for retry
                    self._retry_count += 1
                    self._queue.put((update.priority, update.timestamp, update))
                    errors.append((update, e))
                except Exception as e:
                    # Non-retryable error
                    self._error_count += 1
                    errors.append((update, e))
                    self.logger.log_error("UI update failed", {
                        "callback": update.callback.__name__,
                        "error": str(e),
                        "traceback": traceback.format_exc()
                    })
                
                processed += 1
                
            except queue.Empty:
                break
            except Exception as e:
                # Unexpected error getting from queue
                self.logger.log_error("Queue processing error", error=e)
                break
        
        # Log batch completion if updates were processed
        if processed > 0:
            elapsed = (datetime.now() - self._last_update_time).total_seconds() * 1000
            self._last_update_time = datetime.now()
            
            if elapsed > self.update_interval * 2:
                # Log if updates are falling behind
                self.logger.log_warning("UI updates falling behind", {
                    "processed": processed,
                    "elapsed_ms": elapsed,
                    "target_ms": self.update_interval,
                    "pending": self._queue.qsize()
                })
        
        # Schedule next batch
        self._schedule_next_update()


class ThreadSafeUI:
    """Decorator and context manager for thread-safe UI operations"""
    
    def __init__(self, update_queue: UIUpdateQueue):
        self.update_queue = update_queue
    
    def __call__(self, func):
        """Decorator for making functions thread-safe for UI"""
        def wrapper(*args, **kwargs):
            # If we're already in the UI thread, execute directly
            if threading.current_thread() is threading.main_thread():
                return func(*args, **kwargs)
            else:
                # Queue for execution in UI thread
                self.update_queue.add(func, *args, **kwargs)
        return wrapper
    
    def update(self, callback: Callable, *args, **kwargs):
        """Queue a UI update"""
        self.update_queue.add(callback, *args, **kwargs)
    
    def update_now(self, callback: Callable, *args, **kwargs):
        """Queue a high-priority UI update"""
        self.update_queue.add_high_priority(callback, *args, **kwargs)


# Helper functions for common UI operations
def create_ui_updater(root_widget) -> Tuple[UIUpdateQueue, ThreadSafeUI]:
    """
    Create UI update queue and thread-safe wrapper
    
    Returns:
        Tuple of (UIUpdateQueue, ThreadSafeUI)
    """
    queue = UIUpdateQueue(root_widget)
    safe_ui = ThreadSafeUI(queue)
    return queue, safe_ui


# Example usage patterns
if __name__ == "__main__":
    import tkinter as tk
    from tkinter import ttk
    import time
    import random
    
    # Demo application
    root = tk.Tk()
    root.title("UI Update Queue Demo")
    root.geometry("600x400")
    
    # Create UI update queue
    ui_queue, safe_ui = create_ui_updater(root)
    
    # UI elements
    status_var = tk.StringVar(value="Ready")
    status_label = ttk.Label(root, textvariable=status_var)
    status_label.pack(pady=10)
    
    # Progress bar
    progress_var = tk.IntVar(value=0)
    progress_bar = ttk.Progressbar(root, variable=progress_var, maximum=100)
    progress_bar.pack(fill='x', padx=20, pady=10)
    
    # List box for messages
    listbox = tk.Listbox(root, height=10)
    listbox.pack(fill='both', expand=True, padx=20, pady=10)
    
    # Stats label
    stats_var = tk.StringVar(value="Stats: N/A")
    stats_label = ttk.Label(root, textvariable=stats_var)
    stats_label.pack(pady=5)
    
    # Worker thread function
    def worker_thread():
        """Simulated background worker"""
        for i in range(100):
            # Update progress
            safe_ui.update(progress_var.set, i + 1)
            
            # Update status
            safe_ui.update(status_var.set, f"Processing... {i+1}%")
            
            # Add message with varying priority
            priority = random.choice([0, 0, 0, 10, -5])  # Mostly normal, some high/low
            safe_ui.update(
                lambda msg=f"Item {i+1} processed": listbox.insert('end', msg),
                priority=priority
            )
            
            # Simulate work
            time.sleep(0.05)
        
        # Final updates
        safe_ui.update_now(status_var.set, "Complete!")
        safe_ui.update_now(lambda: messagebox.showinfo("Done", "Processing complete!"))
    
    # Update stats periodically
    def update_stats():
        stats = ui_queue.get_stats()
        stats_var.set(f"Pending: {stats['pending']} | Processed: {stats['processed']} | Errors: {stats['errors']}")
        root.after(100, update_stats)
    
    # Start button
    def start_processing():
        progress_var.set(0)
        listbox.delete(0, 'end')
        thread = threading.Thread(target=worker_thread, daemon=True)
        thread.start()
    
    ttk.Button(root, text="Start Processing", command=start_processing).pack(pady=10)
    
    # Control buttons
    control_frame = ttk.Frame(root)
    control_frame.pack()
    
    ttk.Button(control_frame, text="Pause", command=ui_queue.pause).pack(side='left', padx=5)
    ttk.Button(control_frame, text="Resume", command=ui_queue.resume).pack(side='left', padx=5)
    ttk.Button(control_frame, text="Clear", command=ui_queue.clear).pack(side='left', padx=5)
    
    # Start stats updates
    update_stats()
    
    # Cleanup on close
    def on_close():
        ui_queue.stop()
        root.destroy()
    
    root.protocol("WM_DELETE_WINDOW", on_close)
    
    # Import for message box
    from tkinter import messagebox
    
    root.mainloop()