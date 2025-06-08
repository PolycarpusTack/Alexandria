#!/usr/bin/env python3
"""
ALFRED - AI-Linked Framework for Rapid Engineering Development
Smart launcher that auto-selects the best available UI
"""

import sys
import argparse
import asyncio
import logging
from pathlib import Path
import importlib.util

# Add alfred package to path
sys.path.insert(0, str(Path(__file__).parent))

from alfred_core import AlfredCore, set_alfred_instance

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class UILoader:
    """Loads and detects available UI implementations"""
    
    @staticmethod
    def detect_available_uis():
        """Detect which UIs are available"""
        available = []
        
        # Check for tkinter
        try:
            import tkinter
            available.append(("tkinter", "Classic tkinter UI"))
        except ImportError:
            pass
            
        # Check for customtkinter
        try:
            import customtkinter
            available.append(("custom", "Modern CustomTkinter UI"))
        except ImportError:
            pass
            
        # Check for web UI dependencies
        try:
            import fastapi
            import uvicorn
            available.append(("web", "Web-based UI"))
        except ImportError:
            pass
            
        return available
    
    @staticmethod
    def load_ui(ui_type: str, core: AlfredCore):
        """Load a specific UI implementation"""
        ui_modules = {
            "tkinter": "alfred_ui.tkinter_ui",
            "custom": "alfred_ui.custom_ui",
            "web": "alfred_ui.web_ui"
        }
        
        if ui_type not in ui_modules:
            raise ValueError(f"Unknown UI type: {ui_type}")
            
        try:
            # Import the UI module
            module = importlib.import_module(ui_modules[ui_type])
            
            # Get the UI class (assumes it's named [Type]UI)
            class_name = f"{ui_type.capitalize()}UI"
            if ui_type == "custom":
                class_name = "CustomUI"
            elif ui_type == "web":
                class_name = "WebUI"
                
            ui_class = getattr(module, class_name)
            
            # Create and return UI instance
            return ui_class(core)
            
        except ImportError as e:
            logger.error(f"Failed to import {ui_type} UI: {e}")
            raise
        except AttributeError as e:
            logger.error(f"UI class not found in {ui_type} module: {e}")
            raise


async def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="ALFRED - AI-Linked Framework for Rapid Engineering Development"
    )
    parser.add_argument(
        "--ui",
        choices=["auto", "tkinter", "custom", "web"],
        default="auto",
        help="UI mode to use (default: auto-detect)"
    )
    parser.add_argument(
        "--config",
        help="Path to configuration file"
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Enable debug logging"
    )
    parser.add_argument(
        "--list-plugins",
        action="store_true",
        help="List available plugins and exit"
    )
    parser.add_argument(
        "--version",
        action="version",
        version="ALFRED v0.1.0"
    )
    
    args = parser.parse_args()
    
    # Set debug logging if requested
    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # Initialize core
    logger.info("Initializing ALFRED core...")
    core = AlfredCore(args.config)
    set_alfred_instance(core)
    
    # Override debug setting from command line
    if args.debug:
        core.config.set("app.debug", True)
    
    # List plugins if requested
    if args.list_plugins:
        await core.start()
        plugins = core.plugin_manager.list_plugins()
        print("\nAvailable Plugins:")
        print("-" * 50)
        for plugin in plugins:
            status = "✓ Active" if plugin["active"] else "○ Inactive"
            print(f"{status} {plugin['name']} v{plugin['version']}")
            print(f"   {plugin['description']}")
            print(f"   UI Support: {', '.join(plugin['ui_support'])}")
            if plugin['dependencies']:
                print(f"   Dependencies: {', '.join(plugin['dependencies'])}")
            print()
        await core.stop()
        return
    
    # Detect available UIs
    available_uis = UILoader.detect_available_uis()
    
    if not available_uis:
        logger.error("No UI implementations available!")
        logger.error("Please install tkinter, customtkinter, or web UI dependencies")
        sys.exit(1)
    
    # Select UI
    ui_type = args.ui
    if ui_type == "auto":
        # Auto-detect best UI
        # Prefer: custom > web > tkinter
        ui_priority = ["custom", "web", "tkinter"]
        for ui in ui_priority:
            if any(u[0] == ui for u in available_uis):
                ui_type = ui
                break
        else:
            ui_type = available_uis[0][0]
            
        logger.info(f"Auto-detected UI: {ui_type}")
    
    # Check if requested UI is available
    if not any(u[0] == ui_type for u in available_uis):
        logger.error(f"Requested UI '{ui_type}' is not available")
        logger.info("Available UIs:")
        for ui, desc in available_uis:
            logger.info(f"  - {ui}: {desc}")
        sys.exit(1)
    
    # Load UI
    logger.info(f"Loading {ui_type} UI...")
    try:
        ui = UILoader.load_ui(ui_type, core)
        core.set_ui(ui)
    except Exception as e:
        logger.error(f"Failed to load UI: {e}")
        sys.exit(1)
    
    # Start application
    try:
        # Start core
        await core.start()
        
        # Initialize UI
        await ui.initialize()
        
        # Run UI (this blocks until UI is closed)
        await ui.run()
        
    except KeyboardInterrupt:
        logger.info("Received interrupt signal")
    except Exception as e:
        logger.error(f"Application error: {e}", exc_info=True)
    finally:
        # Cleanup
        logger.info("Shutting down...")
        try:
            await ui.stop()
        except:
            pass
        await core.stop()
        logger.info("Shutdown complete")


if __name__ == "__main__":
    # Run the async main function
    asyncio.run(main())