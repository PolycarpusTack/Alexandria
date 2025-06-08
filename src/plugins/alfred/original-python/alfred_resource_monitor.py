#!/usr/bin/env python3
"""
ALFRED with Built-in Resource Monitoring
Simplified resource monitoring without external dependencies
"""

import os
import time
import threading
from datetime import datetime
from pathlib import Path
import tkinter as tk
from tkinter import ttk, messagebox

# Import ALFRED components
from alfred import AlfredApp, OllamaClient, get_logger

# Try to import psutil for resource monitoring
try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False


class ResourceMonitor:
    """Simple resource monitor using psutil"""
    
    def __init__(self):
        self.has_psutil = PSUTIL_AVAILABLE
        self.cpu_history = []
        self.memory_history = []
        self.max_history = 60  # Keep 60 samples
        
        # Start monitoring thread if psutil available
        if self.has_psutil:
            self.monitoring = True
            self.monitor_thread = threading.Thread(target=self._monitor_loop, daemon=True)
            self.monitor_thread.start()
    
    def _monitor_loop(self):
        """Background monitoring loop"""
        while self.monitoring:
            try:
                # Collect metrics
                cpu = psutil.cpu_percent(interval=1)
                mem = psutil.virtual_memory().percent
                
                # Add to history
                self.cpu_history.append(cpu)
                self.memory_history.append(mem)
                
                # Trim history
                if len(self.cpu_history) > self.max_history:
                    self.cpu_history.pop(0)
                if len(self.memory_history) > self.max_history:
                    self.memory_history.pop(0)
                
            except Exception as e:
                print(f"Monitor error: {e}")
            
            time.sleep(2)  # Update every 2 seconds
    
    def get_current_metrics(self):
        """Get current resource metrics"""
        if not self.has_psutil:
            return {'cpu': 0, 'memory': 0, 'available': False}
        
        try:
            return {
                'cpu': psutil.cpu_percent(interval=0.1),
                'memory': psutil.virtual_memory().percent,
                'memory_gb': psutil.virtual_memory().used / (1024**3),
                'memory_available_gb': psutil.virtual_memory().available / (1024**3),
                'available': True
            }
        except:
            return {'cpu': 0, 'memory': 0, 'available': False}
    
    def get_average_metrics(self, seconds=60):
        """Get average metrics over time period"""
        if not self.cpu_history:
            return self.get_current_metrics()
        
        # Calculate samples to average
        samples = min(len(self.cpu_history), seconds // 2)
        
        return {
            'cpu': sum(self.cpu_history[-samples:]) / samples if samples > 0 else 0,
            'memory': sum(self.memory_history[-samples:]) / samples if samples > 0 else 0,
            'available': True
        }
    
    def should_warn(self):
        """Check if we should warn about resources"""
        metrics = self.get_current_metrics()
        return metrics['memory'] > 85 or metrics['cpu'] > 90


class ResourceWidget(ttk.Frame):
    """Resource monitoring widget for ALFRED"""
    
    def __init__(self, parent, monitor):
        super().__init__(parent)
        self.monitor = monitor
        self.create_widgets()
        self.update_display()
    
    def create_widgets(self):
        """Create the resource display widgets"""
        # Container frame
        container = ttk.Frame(self, relief='ridge', borderwidth=1)
        container.pack(fill='both', expand=True, padx=2, pady=2)
        
        if PSUTIL_AVAILABLE:
            # CPU gauge
            cpu_frame = ttk.Frame(container)
            cpu_frame.pack(side='left', padx=5, pady=2)
            
            ttk.Label(cpu_frame, text="CPU", font=('Arial', 8)).pack()
            self.cpu_var = tk.DoubleVar()
            self.cpu_bar = ttk.Progressbar(
                cpu_frame, 
                variable=self.cpu_var,
                maximum=100,
                length=60,
                mode='determinate'
            )
            self.cpu_bar.pack()
            self.cpu_label = ttk.Label(cpu_frame, text="0%", font=('Arial', 8))
            self.cpu_label.pack()
            
            # Memory gauge
            mem_frame = ttk.Frame(container)
            mem_frame.pack(side='left', padx=5, pady=2)
            
            ttk.Label(mem_frame, text="Memory", font=('Arial', 8)).pack()
            self.mem_var = tk.DoubleVar()
            self.mem_bar = ttk.Progressbar(
                mem_frame,
                variable=self.mem_var,
                maximum=100,
                length=60,
                mode='determinate'
            )
            self.mem_bar.pack()
            self.mem_label = ttk.Label(mem_frame, text="0%", font=('Arial', 8))
            self.mem_label.pack()
            
            # Status
            self.status_label = ttk.Label(container, text="", font=('Arial', 8))
            self.status_label.pack(side='left', padx=10)
        else:
            # No psutil message
            msg = ttk.Label(
                container, 
                text="Resource monitoring: pip install psutil",
                font=('Arial', 8),
                foreground='gray'
            )
            msg.pack(padx=5, pady=2)
    
    def update_display(self):
        """Update the resource display"""
        if PSUTIL_AVAILABLE:
            metrics = self.monitor.get_current_metrics()
            
            # Update CPU
            cpu = metrics['cpu']
            self.cpu_var.set(cpu)
            self.cpu_label.config(text=f"{cpu:.0f}%")
            
            # Update Memory
            mem = metrics['memory']
            self.mem_var.set(mem)
            mem_gb = metrics.get('memory_gb', 0)
            self.mem_label.config(text=f"{mem:.0f}% ({mem_gb:.1f}GB)")
            
            # Color coding
            if cpu > 80:
                self.cpu_label.config(foreground='red')
            elif cpu > 60:
                self.cpu_label.config(foreground='orange')
            else:
                self.cpu_label.config(foreground='green')
            
            if mem > 80:
                self.mem_label.config(foreground='red')
                self.status_label.config(text="⚠ High Memory", foreground='red')
            elif mem > 60:
                self.mem_label.config(foreground='orange')
                self.status_label.config(text="", foreground='black')
            else:
                self.mem_label.config(foreground='green')
                self.status_label.config(text="", foreground='black')
        
        # Schedule next update
        self.after(2000, self.update_display)


class ResourceAwareOllamaClient(OllamaClient):
    """Ollama client with resource awareness"""
    
    def __init__(self, *args, monitor=None, **kwargs):
        super().__init__(*args, **kwargs)
        self.monitor = monitor or ResourceMonitor()
    
    def generate(self, prompt: str, model: str = "deepseek-coder:latest", 
                 context=None) -> str:
        """Generate with resource checking"""
        
        # Check resources before making request
        metrics = self.monitor.get_current_metrics()
        
        if metrics['available'] and metrics['memory'] > 90:
            self.logger.log_warning("High memory usage", {
                "memory_percent": metrics['memory'],
                "memory_gb": metrics.get('memory_gb', 0)
            })
            
            # Return warning instead of trying and failing
            return (f"⚠️ System memory is critically high ({metrics['memory']:.0f}% used). "
                   f"Only {metrics.get('memory_available_gb', 0):.1f}GB available.\n\n"
                   "Please close other applications before continuing.")
        
        # Calculate adaptive timeout
        if metrics['available']:
            # Increase timeout if system is under load
            cpu_factor = 1.0 + (metrics['cpu'] / 200.0)  # Up to 1.5x at 100% CPU
            mem_factor = 1.0 + (metrics['memory'] / 200.0)  # Up to 1.5x at 100% memory
            
            adaptive_timeout = int(self.timeout * cpu_factor * mem_factor)
            
            self.logger.log_info("Using adaptive timeout", {
                "base_timeout": self.timeout,
                "adaptive_timeout": adaptive_timeout,
                "cpu": metrics['cpu'],
                "memory": metrics['memory']
            })
            
            # Temporarily adjust timeout
            original_timeout = self.timeout
            self.timeout = adaptive_timeout
            try:
                return super().generate(prompt, model, context)
            finally:
                self.timeout = original_timeout
        else:
            # No resource info, use standard timeout
            return super().generate(prompt, model, context)


class ResourceAwareAlfredApp(AlfredApp):
    """ALFRED with integrated resource monitoring"""
    
    def __init__(self, root):
        # Initialize resource monitor first
        self.resource_monitor = ResourceMonitor()
        
        # Initialize parent
        super().__init__(root)
        
        # Replace Ollama client with resource-aware version
        self.ollama_client = ResourceAwareOllamaClient(
            base_url=self.ollama_client.base_url,
            timeout=self.ollama_client.timeout,
            monitor=self.resource_monitor
        )
        
        # Add resource widget to UI
        self._add_resource_widget()
        
        # Log system info
        self._log_system_info()
    
    def _add_resource_widget(self):
        """Add resource widget to the toolbar"""
        if hasattr(self, 'toolbar'):
            # Add separator
            ttk.Separator(self.toolbar, orient='vertical').pack(side='right', fill='y', padx=5)
            
            # Add resource widget
            self.resource_widget = ResourceWidget(self.toolbar, self.resource_monitor)
            self.resource_widget.pack(side='right', padx=5)
    
    def _log_system_info(self):
        """Log system information"""
        if PSUTIL_AVAILABLE:
            try:
                vm = psutil.virtual_memory()
                self.logger.log_info("System information", {
                    "total_memory_gb": vm.total / (1024**3),
                    "available_memory_gb": vm.available / (1024**3),
                    "cpu_count": psutil.cpu_count(),
                    "platform": os.name
                })
            except:
                pass
    
    def send_message(self):
        """Override to check resources before sending"""
        # Check if we should warn
        if self.resource_monitor.should_warn():
            metrics = self.resource_monitor.get_current_metrics()
            
            warning = f"System resources are high:\n"
            warning += f"• CPU: {metrics['cpu']:.0f}%\n"
            warning += f"• Memory: {metrics['memory']:.0f}% ({metrics.get('memory_gb', 0):.1f}GB used)\n\n"
            warning += "This may cause slow or failed responses.\n"
            warning += "Continue anyway?"
            
            if not messagebox.askyesno("Resource Warning", warning, icon='warning'):
                return
        
        # Call parent implementation
        super().send_message()
    
    def check_connection(self):
        """Enhanced connection check with resource info"""
        # First do parent's connection check
        super().check_connection()
        
        # Then add resource info
        def add_resource_info():
            if PSUTIL_AVAILABLE:
                metrics = self.resource_monitor.get_current_metrics()
                info = f" | Memory: {metrics['memory']:.0f}% CPU: {metrics['cpu']:.0f}%"
                current = self.connection_var.get()
                if "Connected" in current:
                    self.connection_var.set(current + info)
        
        # Update after a short delay
        self.root.after(100, add_resource_info)


def main():
    """Run ALFRED with resource monitoring"""
    
    print("="*60)
    print("ALFRED - AI Development Assistant")
    print("With Resource Monitoring")
    print("="*60)
    
    if PSUTIL_AVAILABLE:
        print("✓ Resource monitoring enabled")
        try:
            vm = psutil.virtual_memory()
            print(f"  System Memory: {vm.total/(1024**3):.1f}GB total, {vm.available/(1024**3):.1f}GB available")
            print(f"  CPU Cores: {psutil.cpu_count()}")
        except:
            pass
    else:
        print("✗ Resource monitoring disabled")
        print("  To enable: pip install psutil")
    
    print("="*60)
    print()
    
    # Create and run app
    root = tk.Tk()
    app = ResourceAwareAlfredApp(root)
    
    # Show initial tip if memory is already high
    if PSUTIL_AVAILABLE:
        root.after(1000, lambda: check_initial_resources(app))
    
    root.mainloop()


def check_initial_resources(app):
    """Check resources on startup and show tips if needed"""
    metrics = app.resource_monitor.get_current_metrics()
    
    if metrics['memory'] > 70:
        app.status_var.set(
            f"Tip: Memory is at {metrics['memory']:.0f}%. "
            "Close unused applications for better performance."
        )


if __name__ == "__main__":
    main()