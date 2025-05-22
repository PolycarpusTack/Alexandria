"""
Hyperion Resource Monitor - Command Line Interface

Allows running Hyperion as a standalone monitor with reporting capabilities.
"""

import argparse
import asyncio
import json
import logging
import os
import sys
import time
from typing import Dict, List, Optional

# Add parent directory to path for local development
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from hyperion.core import HyperionCore
from hyperion.metrics import MetricsCollector
from hyperion.cloud import CloudIntegration
from hyperion.container import ContainerMonitor
from hyperion.energy import EnergyMonitor
from hyperion.ml import MLIntegration

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s [Hyperion] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

logger = logging.getLogger('hyperion')


class HyperionCLI:
    """Command line interface for Hyperion monitor"""
    
    def __init__(self):
        self.monitor = None
        self.metrics = None
        self.cloud = None
        self.container = None
        self.energy = None
        self.ml = None
        self.running = False
        self.output_file = None
        self.report_interval = 10  # seconds
    
    def parse_args(self):
        """Parse command line arguments"""
        parser = argparse.ArgumentParser(description='Hyperion Resource Monitor')
        
        # Basic options
        parser.add_argument('--interval', type=float, default=3.0,
                           help='Monitoring interval in seconds (default: 3.0)')
        parser.add_argument('--report-interval', type=float, default=10.0,
                           help='Reporting interval in seconds (default: 10.0)')
        parser.add_argument('--debug', action='store_true',
                           help='Enable debug logging')
        
        # Output options
        parser.add_argument('--output', type=str, default=None,
                           help='Output file for reports (default: stdout)')
        parser.add_argument('--format', choices=['json', 'prometheus', 'text'], default='text',
                           help='Output format (default: text)')
        parser.add_argument('--pretty', action='store_true',
                           help='Pretty print JSON output')
        
        # Feature flags
        parser.add_argument('--ml', action='store_true',
                           help='Enable machine learning integration')
        parser.add_argument('--cloud', action='store_true',
                           help='Enable cloud integration')
        parser.add_argument('--container', action='store_true',
                           help='Enable container-specific monitoring')
        parser.add_argument('--energy', action='store_true',
                           help='Enable energy monitoring')
        
        # Commands
        subparsers = parser.add_subparsers(dest='command', help='Commands')
        
        # Monitor command (default)
        monitor_parser = subparsers.add_parser('monitor', help='Run continuous monitoring')
        monitor_parser.add_argument('--duration', type=float, default=None,
                                  help='Monitoring duration in seconds (default: indefinite)')
        
        # Status command
        status_parser = subparsers.add_parser('status', help='Show current system status')
        
        # Profile command
        profile_parser = subparsers.add_parser('profile', help='Run a short system profile')
        profile_parser.add_argument('--duration', type=float, default=30.0,
                                  help='Profile duration in seconds (default: 30.0)')
        
        args = parser.parse_args()
        
        # Set debug logging if requested
        if args.debug:
            logging.getLogger().setLevel(logging.DEBUG)
        
        # Set default command if none specified
        if not args.command:
            args.command = 'monitor'
            args.duration = None
        
        return args
    
    async def initialize(self, args):
        """Initialize components based on arguments"""
        # Create core monitor
        config = {
            'check_interval': args.interval,
            'auto_recover': True,
            'adaptive_scaling': True
        }
        self.monitor = HyperionCore(config)
        
        # Create metrics collector
        self.metrics = MetricsCollector()
        
        # Initialize optional components
        if args.cloud:
            self.cloud = CloudIntegration(self.monitor.cloud_provider)
            
        if args.container:
            self.container = ContainerMonitor()
            
        if args.energy:
            self.energy = EnergyMonitor()
            
        if args.ml:
            self.ml = MLIntegration()
        
        # Set output file if specified
        if args.output:
            self.output_file = args.output
            
        # Set report interval
        self.report_interval = args.report_interval
        
        # Start the monitor
        await self.monitor.start()
        logger.info("Hyperion initialized and started")
    
    async def run_command(self, args):
        """Run the specified command"""
        if args.command == 'monitor':
            await self.run_monitor(args)
        elif args.command == 'status':
            await self.show_status(args)
        elif args.command == 'profile':
            await self.run_profile(args)
    
    async def run_monitor(self, args):
        """Run continuous monitoring"""
        logger.info(f"Starting continuous monitoring (interval: {self.monitor.config['check_interval']}s)")
        
        self.running = True
        start_time = time.time()
        last_report_time = 0
        
        while self.running:
            try:
                # Check if duration has elapsed
                if args.duration and (time.time() - start_time) > args.duration:
                    logger.info(f"Monitoring duration of {args.duration}s elapsed, stopping")
                    self.running = False
                    break
                
                # Update metrics
                if self.metrics:
                    self.metrics.collect_all_metrics(self.monitor)
                
                # Generate and output report at specified intervals
                if (time.time() - last_report_time) >= self.report_interval:
                    self.output_report(args.format, args.pretty)
                    last_report_time = time.time()
                
                # Short sleep to avoid tight loop
                await asyncio.sleep(1.0)
                
            except KeyboardInterrupt:
                logger.info("Monitoring interrupted by user")
                self.running = False
                break
            except Exception as e:
                logger.error(f"Error during monitoring: {str(e)}", exc_info=True)
                await asyncio.sleep(5.0)  # Longer delay on error
        
        # Final report
        self.output_report(args.format, args.pretty)
        logger.info("Monitoring stopped")
    
    async def show_status(self, args):
        """Show current system status"""
        # Collect metrics once
        if self.metrics:
            self.metrics.collect_all_metrics(self.monitor)
        
        # Generate and output report
        self.output_report(args.format, args.pretty)
    
    async def run_profile(self, args):
        """Run a short system profile"""
        duration = args.duration
        logger.info(f"Starting system profile for {duration} seconds")
        
        # Record start state
        if self.metrics:
            self.metrics.collect_all_metrics(self.monitor)
            start_metrics = self.metrics.generate_report(include_history=False)
        
        # Run for specified duration
        self.running = True
        start_time = time.time()
        
        while self.running and (time.time() - start_time) < duration:
            try:
                # Update metrics
                if self.metrics:
                    self.metrics.collect_all_metrics(self.monitor)
                
                # Short sleep to avoid tight loop
                await asyncio.sleep(1.0)
                
            except KeyboardInterrupt:
                logger.info("Profiling interrupted by user")
                self.running = False
                break
            except Exception as e:
                logger.error(f"Error during profiling: {str(e)}", exc_info=True)
        
        # Generate final profile report
        if self.metrics:
            self.metrics.collect_all_metrics(self.monitor)
            
        # Output report
        self.output_report(args.format, args.pretty)
        logger.info("System profile completed")
    
    def output_report(self, format_type: str, pretty: bool = False):
        """Generate and output a report in the specified format"""
        if not self.metrics:
            return
        
        # Generate the report
        if format_type == 'json':
            output = self.metrics.export_json(pretty=pretty)
        elif format_type == 'prometheus':
            output = self.metrics.export_prometheus()
        else:
            # Text format
            output = self.format_text_report()
        
        # Output to file or stdout
        if self.output_file:
            with open(self.output_file, 'w') as f:
                f.write(output)
        else:
            # For text format, clear screen first
            if format_type == 'text':
                os.system('cls' if os.name == 'nt' else 'clear')
            print(output)
    
    def format_text_report(self) -> str:
        """Format a human-readable text report"""
        lines = []
        lines.append("=" * 60)
        lines.append(f"HYPERION RESOURCE MONITOR - {time.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("=" * 60)
        
        # System information
        lines.append(f"Environment: {self.monitor.environment}")
        if self.monitor.cloud_provider:
            lines.append(f"Cloud Provider: {self.monitor.cloud_provider}")
        lines.append(f"Container: {'Yes' if self.monitor.is_container else 'No'}")
        lines.append(f"Laptop: {'Yes' if self.monitor.is_laptop else 'No'}")
        
        # Current state
        lines.append("\nCURRENT STATE:")
        lines.append(f"  System: {self.monitor._current_state.upper()}")
        lines.append(f"  CPU Usage: {self.monitor._current_cpu:.1%}")
        lines.append(f"  Memory Usage: {self.monitor._current_mem:.1%}")
        lines.append(f"  Workers: {self.monitor.current_workers}/{self.monitor.max_workers} (current/max)")
        
        # Add energy information if available
        if self.energy:
            power_state = self.energy.get_power_state()
            if power_state['supported']:
                lines.append("\nPOWER STATE:")
                lines.append(f"  Battery: {'Yes' if power_state['on_battery'] else 'No'}")
                if power_state['on_battery']:
                    lines.append(f"  Battery Level: {power_state['battery_percent']:.1f}%")
                    if power_state['battery_time_left']:
                        lines.append(f"  Time Remaining: {int(power_state['battery_time_left'])} minutes")
                lines.append(f"  Power Saver: {'Enabled' if power_state['power_saver_active'] else 'Disabled'}")
        
        # Add container information if available
        if self.container and self.container.is_container:
            lines.append("\nCONTAINER INFO:")
            lines.append(f"  Orchestrator: {self.container.orchestrator or 'Unknown'}")
            if self.container.memory_limit:
                lines.append(f"  Memory Limit: {self.container.memory_limit / (1024*1024):.1f} MB")
            if self.container.cpu_limit:
                lines.append(f"  CPU Limit: {self.container.cpu_limit:.1f} cores")
        
        # Add ML recommendations if available
        if self.ml and self.ml.is_initialized:
            lines.append("\nML RECOMMENDATIONS:")
            recommendations = self.ml.get_ml_recommendations({
                'cpu': self.monitor._current_cpu,
                'memory': self.monitor._current_mem
            })
            
            if 'optimal_workers' in recommendations:
                lines.append(f"  Optimal Workers: {recommendations['optimal_workers']}")
            
            if 'future_usage' in recommendations:
                future = recommendations['future_usage']
                lines.append(f"  Predicted CPU (5m): {future['cpu']:.1%}")
                lines.append(f"  Predicted Memory (5m): {future['memory']:.1%}")
            
            for key in recommendations:
                if key.endswith('_warning'):
                    lines.append(f"  Warning: {recommendations[key]}")
                    
            if 'anomalies' in recommendations:
                for anomaly in recommendations['anomalies']:
                    lines.append(f"  Anomaly Detected: {anomaly}")
        
        lines.append("=" * 60)
        return "\n".join(lines)
    
    async def cleanup(self):
        """Clean up resources"""
        if self.monitor:
            await self.monitor.stop()
        logger.info("Hyperion resources cleaned up")


async def main():
    """Main entry point"""
    cli = HyperionCLI()
    args = cli.parse_args()
    
    try:
        await cli.initialize(args)
        await cli.run_command(args)
    except Exception as e:
        logger.error(f"Error running Hyperion: {str(e)}", exc_info=True)
    finally:
        await cli.cleanup()


if __name__ == "__main__":
    asyncio.run(main())
