#!/usr/bin/env python3
"""
Alfred - AI-Linked Framework for Rapid Engineering Development

Main entry point for the modular Alfred implementation.
"""

import sys
import asyncio
import argparse
import logging
from pathlib import Path

from .core import AlfredApplication
from .utils import Config, setup_logging
from .ui import AlfredUI


def parse_arguments():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Alfred - AI Development Assistant",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  alfred                    # Launch GUI
  alfred --cli              # Launch CLI mode
  alfred --config ~/.alfred # Use custom config directory
  alfred --debug           # Enable debug logging
        """
    )
    
    parser.add_argument(
        "--cli", 
        action="store_true",
        help="Run in CLI mode instead of GUI"
    )
    
    parser.add_argument(
        "--config",
        type=Path,
        help="Configuration directory path"
    )
    
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Enable debug logging"
    )
    
    parser.add_argument(
        "--no-plugins",
        action="store_true",
        help="Disable plugin loading"
    )
    
    parser.add_argument(
        "--version",
        action="version",
        version="Alfred 2.0.0"
    )
    
    return parser.parse_args()


async def run_gui(app: AlfredApplication):
    """Run the GUI application."""
    # Import here to avoid loading tkinter in CLI mode
    from .ui import AlfredUI
    
    ui = AlfredUI(app)
    
    # Run UI in main thread
    await ui.run()


async def run_cli(app: AlfredApplication):
    """Run the CLI application."""
    # Import here to avoid loading in GUI mode
    from .cli import AlfredCLI
    
    cli = AlfredCLI(app)
    await cli.run()


async def main():
    """Main entry point."""
    args = parse_arguments()
    
    # Setup logging
    log_level = logging.DEBUG if args.debug else logging.INFO
    setup_logging(level=log_level)
    
    logger = logging.getLogger(__name__)
    logger.info("Starting Alfred...")
    
    # Load configuration
    config = Config.load(args.config)
    if args.config:
        config.data_dir = args.config
        
    # Create application
    app = AlfredApplication(config)
    
    try:
        # Initialize application
        await app.initialize()
        
        # Load plugins unless disabled
        if not args.no_plugins:
            await app.plugin_manager.load_plugins()
            
        # Run appropriate interface
        if args.cli:
            await run_cli(app)
        else:
            await run_gui(app)
            
    except KeyboardInterrupt:
        logger.info("Interrupted by user")
        
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)
        
    finally:
        # Shutdown
        await app.shutdown()
        logger.info("Alfred shutdown complete")


def entry_point():
    """Entry point for console script."""
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nGoodbye!")
        sys.exit(0)


if __name__ == "__main__":
    entry_point()