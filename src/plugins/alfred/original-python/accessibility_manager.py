"""
Enterprise Code Factory 9000 Pro - Accessibility Manager
-------------------------------------------------------
Accessibility support for the application with screen reader integration
and keyboard navigation enhancements.

Author: Claude (Enhanced)
Date: April 10, 2025
"""

import tkinter as tk
from tkinter import ttk, messagebox
import logging
import json
import os
import sys
from typing import Dict, List, Optional, Any, Callable, Union
from enum import Enum
from pathlib import Path
import threading
import time

# Set up module logger
logger = logging.getLogger(__name__)


class AccessibilityFeature(Enum):
    """Accessibility features that can be enabled"""
    HIGH_CONTRAST = "high_contrast"
    LARGE_FONT = "large_font"
    KEYBOARD_NAVIGATION = "keyboard_navigation"
    SCREEN_READER = "screen_reader"
    REDUCED_MOTION = "reduced_motion"
    FOCUS_HIGHLIGHTING = "focus_highlighting"
    TEXT_TO_SPEECH = "text_to_speech"
    TOOLTIPS = "tooltips"


class AccessibilityManager:
    """
    Manages accessibility features for the application
    """
    
    def __init__(self, root: tk.Tk, config_path: Optional[str] = None):
        """
        Initialize accessibility manager
        
        Args:
            root: Tkinter root window
            config_path: Optional path to configuration file
        """
        self.root = root
        self.config_path = config_path or str(Path.home() / ".ecf" / "accessibility.json")
        
        # Default settings
        self.settings = {
            AccessibilityFeature.HIGH_CONTRAST.value: False,
            AccessibilityFeature.LARGE_FONT.value: False,
            AccessibilityFeature.KEYBOARD_NAVIGATION.value: True,
            AccessibilityFeature.SCREEN_READER.value: False,
            AccessibilityFeature.REDUCED_MOTION.value: False,
            AccessibilityFeature.FOCUS_HIGHLIGHTING.value: True,
            AccessibilityFeature.TEXT_TO_SPEECH.value: False,
            AccessibilityFeature.TOOLTIPS.value: True
        }
        
        # Default font sizes
        self.font_sizes = {
            "small": 9,
            "normal": 10,
            "large": 12,
            "very_large": 14,
            "huge": 16
        }
        
        # Store original styles
        self.original_styles = {}
        
        # Text-to-speech engine
        self.tts_engine = None
        
        # Track registered widgets
        self.accessible_widgets = {}
        
        # Tooltip tracking
        self.current_tooltip = None
        
        # Focus tracking for keyboard navigation
        self.focus_history = []
        self.max_focus_history = 20
        
        # Load settings
        self._load_settings()
        
        # Set up key bindings
        self._setup_key_bindings()
        
        # Apply initial settings
        self.apply_settings()
        
        logger.info("Accessibility manager initialized")
    
    def _load_settings(self) -> None:
        """Load settings from configuration file"""
        try:
            if os.path.exists(self.config_path):
                with open(self.config_path, 'r') as f:
                    loaded_settings = json.load(f)
                
                # Update settings with loaded values
                for key, value in loaded_settings.items():
                    if key in self.settings:
                        self.settings[key] = value
                
                logger.info(f"Loaded accessibility settings from {self.config_path}")
            else:
                # Ensure directory exists
                os.makedirs(os.path.dirname(self.config_path), exist_ok=True)
                
                # Save default settings
                self._save_settings()
        except Exception as e:
            logger.error(f"Error loading accessibility settings: {str(e)}")
    
    def _save_settings(self) -> None:
        """Save settings to configuration file"""
        try:
            # Ensure directory exists
            os.makedirs(os.path.dirname(self.config_path), exist_ok=True)
            
            with open(self.config_path, 'w') as f:
                json.dump(self.settings, f, indent=2)
            
            logger.info(f"Saved accessibility settings to {self.config_path}")
        except Exception as e:
            logger.error(f"Error saving accessibility settings: {str(e)}")
    
    def _setup_key_bindings(self) -> None:
        """Set up keyboard shortcuts for accessibility features"""
        # Check if root is None before attempting to bind
        if self.root is None:
            logger.warning("Cannot set up key bindings: root is None")
            return
            
        # Accessibility menu toggle
        self.root.bind("<Alt-a>", lambda e: self.show_accessibility_dialog())
        
        # Toggle high contrast mode
        self.root.bind("<Alt-c>", lambda e: self.toggle_feature(AccessibilityFeature.HIGH_CONTRAST))
        
        # Toggle large font
        self.root.bind("<Alt-f>", lambda e: self.toggle_feature(AccessibilityFeature.LARGE_FONT))
        
        # Toggle screen reader
        self.root.bind("<Alt-r>", lambda e: self.toggle_feature(AccessibilityFeature.SCREEN_READER))
        
        # Keyboard navigation - forward
        self.root.bind("<Alt-Tab>", lambda e: self._navigate_focus(1))
        
        # Keyboard navigation - backward
        self.root.bind("<Alt-Shift-Tab>", lambda e: self._navigate_focus(-1))
        
        # Focus tracking
        self.root.bind_all("<FocusIn>", self._on_focus_in)
    
    def toggle_feature(self, feature: AccessibilityFeature) -> None:
        """
        Toggle an accessibility feature
        
        Args:
            feature: Feature to toggle
        """
        # Toggle the setting
        self.settings[feature.value] = not self.settings[feature.value]
        
        # Apply the change
        self.apply_settings()
        
        # Save settings
        self._save_settings()
        
        # Announce the change if screen reader is enabled
        feature_name = feature.value.replace('_', ' ').title()
        status = "enabled" if self.settings[feature.value] else "disabled"
        self.announce(f"{feature_name} {status}")
        
        logger.info(f"Toggled {feature.value} to {self.settings[feature.value]}")
    
    def apply_settings(self) -> None:
        """Apply current accessibility settings"""
        # Apply each feature
        self._apply_high_contrast()
        self._apply_font_size()
        self._apply_focus_highlighting()
        self._apply_reduced_motion()
        self._apply_screen_reader()
    
    def _apply_high_contrast(self) -> None:
        """Apply high contrast mode"""
        style = ttk.Style()
        
        if self.settings[AccessibilityFeature.HIGH_CONTRAST.value]:
            # Save original colors if not already saved
            if "background" not in self.original_styles:
                self.original_styles["background"] = style.lookup(".", "background") or "SystemButtonFace"
                self.original_styles["foreground"] = style.lookup(".", "foreground") or "SystemButtonText"
                self.original_styles["selectbackground"] = style.lookup("Treeview", "selectbackground") or "SystemHighlight"
                self.original_styles["selectforeground"] = style.lookup("Treeview", "selectforeground") or "SystemHighlightText"
            
            # Apply high contrast theme
            style.configure(".", background="black", foreground="white")
            style.configure("TButton", background="black", foreground="white")
            style.configure("TFrame", background="black")
            style.configure("TLabel", background="black", foreground="white")
            style.configure("TNotebook", background="black")
            style.configure("TNotebook.Tab", background="black", foreground="white")
            style.map("TNotebook.Tab", background=[("selected", "gray20")], foreground=[("selected", "white")])
            style.configure("Treeview", background="black", foreground="white", fieldbackground="black")
            style.map("Treeview", background=[("selected", "gray20")], foreground=[("selected", "white")])
            
            # Apply to non-ttk widgets too
            if self.root:
                self.root.config(background="black")
            
            # Update all text widgets
            for widget in self._find_widgets_by_class(self.root, "Text"):
                widget.config(bg="black", fg="white", insertbackground="white")
            
            # Update all listbox widgets
            for widget in self._find_widgets_by_class(self.root, "Listbox"):
                widget.config(bg="black", fg="white", selectbackground="gray20", selectforeground="white")
            
            # Update all entry widgets
            for widget in self._find_widgets_by_class(self.root, "Entry"):
                widget.config(bg="black", fg="white", insertbackground="white")
        else:
            # Restore original colors if saved
            if "background" in self.original_styles:
                style.configure(".", background=self.original_styles["background"], 
                              foreground=self.original_styles["foreground"])
                style.configure("Treeview", selectbackground=self.original_styles["selectbackground"],
                              selectforeground=self.original_styles["selectforeground"])
                
                # Reset non-ttk widgets
                if self.root:
                    self.root.config(background=self.original_styles["background"])
                
                # Reset text widgets
                for widget in self._find_widgets_by_class(self.root, "Text"):
                    widget.config(bg="white", fg="black", insertbackground="black")
                
                # Reset listbox widgets
                for widget in self._find_widgets_by_class(self.root, "Listbox"):
                    widget.config(bg="white", fg="black", 
                                selectbackground=self.original_styles["selectbackground"], 
                                selectforeground=self.original_styles["selectforeground"])
                
                # Reset entry widgets
                for widget in self._find_widgets_by_class(self.root, "Entry"):
                    widget.config(bg="white", fg="black", insertbackground="black")
    
    def _apply_font_size(self) -> None:
        """Apply font size settings"""
        # Determine base font size
        if self.settings[AccessibilityFeature.LARGE_FONT.value]:
            base_size = self.font_sizes["large"]
            heading_size = self.font_sizes["very_large"]
        else:
            base_size = self.font_sizes["normal"]
            heading_size = self.font_sizes["large"]
        
        # Create default fonts
        default_font = ("Helvetica", base_size)
        heading_font = ("Helvetica", heading_size, "bold")
        monospace_font = ("Courier New", base_size)
        
        # Apply fonts to widgets
        if self.root:
            self.root.option_add("*Font", default_font)
            self.root.option_add("*Label.Font", default_font)
            self.root.option_add("*Button.Font", default_font)
            self.root.option_add("*Entry.Font", default_font)
            self.root.option_add("*Text.Font", monospace_font)
            self.root.option_add("*Heading.Font", heading_font)
            
            # Update existing widgets
            self._update_widget_fonts(self.root, default_font, monospace_font, heading_font)
    
    def _update_widget_fonts(self, widget, default_font, monospace_font, heading_font):
        """Recursively update fonts for all widgets"""
        try:
            # Update font based on widget type
            if widget.winfo_class() in ("Text", "Entry"):
                widget.configure(font=monospace_font)
            elif widget.winfo_class() == "Label" and hasattr(widget, "heading") and widget.heading:
                widget.configure(font=heading_font)
            elif widget.winfo_class() not in ("Frame", "Toplevel", "Tk"):
                if hasattr(widget, "configure") and callable(getattr(widget, "configure")):
                    widget.configure(font=default_font)
        except Exception:
            # Some widgets may not support font configuration
            pass
        
        # Process children
        try:
            for child in widget.winfo_children():
                self._update_widget_fonts(child, default_font, monospace_font, heading_font)
        except Exception:
            # Skip if widget doesn't support winfo_children
            pass
    
    def _apply_focus_highlighting(self) -> None:
        """Apply focus highlighting settings"""
        style = ttk.Style()
        
        if self.settings[AccessibilityFeature.FOCUS_HIGHLIGHTING.value]:
            # Save original focus colors if not already saved
            if "focuscolor" not in self.original_styles:
                self.original_styles["focuscolor"] = style.lookup(".", "focuscolor") or "SystemHighlight"
            
            # Apply strong focus highlighting
            style.configure(".", focusthickness=2)
            style.map(".", focuscolor=[("focus", "#ff6600")])
            style.map("TEntry", fieldbackground=[("focus", "#ffe0cc")])
            style.map("TCombobox", fieldbackground=[("focus", "#ffe0cc")])
            style.map("TButton", relief=[("focus", "sunken")], 
                    padding=[("focus", 4)])
        else:
            # Restore original focus highlighting
            if "focuscolor" in self.original_styles:
                style.map(".", focuscolor=[("focus", self.original_styles["focuscolor"])])
                style.configure(".", focusthickness=1)
    
    def _apply_reduced_motion(self) -> None:
        """Apply reduced motion settings"""
        # This would modify any animations or transitions used in the application
        # For now, we'll just log that it's enabled
        if self.settings[AccessibilityFeature.REDUCED_MOTION.value]:
            logger.info("Reduced motion mode enabled")
            
            # Tell all accessible widgets to disable animations if they support it
            for widget_id, widget_info in self.accessible_widgets.items():
                widget = widget_info.get("widget")
                if widget and hasattr(widget, "set_reduced_motion"):
                    widget.set_reduced_motion(True)
    
    def _apply_screen_reader(self) -> None:
        """Initialize screen reader integration if enabled"""
        if self.settings[AccessibilityFeature.SCREEN_READER.value]:
            # Initialize text-to-speech if not already done
            if self.tts_engine is None:
                self._initialize_tts()
        elif self.tts_engine is not None:
            # Shut down text-to-speech if it was running
            self._shutdown_tts()
    
    def _initialize_tts(self) -> None:
        """Initialize text-to-speech engine"""
        try:
            # Try to import pyttsx3 (a common TTS library)
            try:
                import pyttsx3
                self.tts_engine = pyttsx3.init()
                self.tts_engine.setProperty('rate', 150)  # Speed of speech
                self.tts_engine.setProperty('volume', 0.8)  # Volume (0.0 to 1.0)
                logger.info("Initialized pyttsx3 for text-to-speech")
            except ImportError:
                # Fall back to platform-specific approaches if pyttsx3 is not available
                if os.name == 'nt':  # Windows
                    try:
                        import win32com.client
                        self.tts_engine = win32com.client.Dispatch("SAPI.SpVoice")
                        logger.info("Initialized Windows SAPI for text-to-speech")
                    except ImportError:
                        logger.warning("Could not initialize text-to-speech on Windows")
                elif os.name == 'posix':  # Unix/Linux/Mac
                    # Use subprocess to call system TTS tools like 'say' (Mac) or 'espeak' (Linux)
                    import subprocess
                    
                    # Check for available TTS command
                    for cmd in ['say', 'espeak', 'festival']:
                        try:
                            subprocess.run([cmd, "--version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                            self.tts_engine = cmd
                            logger.info(f"Initialized {cmd} for text-to-speech")
                            break
                        except Exception:
                            continue
                    
                    if self.tts_engine is None:
                        logger.warning("Could not find text-to-speech command on this system")
        
            # Announce that screen reader is enabled
            self.announce("Screen reader enabled")
        except Exception as e:
            logger.error(f"Error initializing text-to-speech: {str(e)}")
            self.tts_engine = None
    
    def _shutdown_tts(self) -> None:
        """Shut down text-to-speech engine"""
        try:
            if hasattr(self.tts_engine, 'stop'):
                self.tts_engine.stop()
            self.tts_engine = None
            logger.info("Text-to-speech engine shut down")
        except Exception as e:
            logger.error(f"Error shutting down text-to-speech: {str(e)}")
    
    def announce(self, text: str) -> None:
        """
        Announce text through screen reader
        
        Args:
            text: Text to announce
        """
        if not self.settings[AccessibilityFeature.SCREEN_READER.value] or self.tts_engine is None:
            return
        
        try:
            # Handle announcement in a separate thread to avoid UI freezing
            def _do_announce():
                try:
                    if hasattr(self.tts_engine, 'say'):  # pyttsx3
                        self.tts_engine.say(text)
                        self.tts_engine.runAndWait()
                    elif hasattr(self.tts_engine, 'Speak'):  # Windows SAPI
                        self.tts_engine.Speak(text)
                    elif isinstance(self.tts_engine, str):  # Command-line TTS
                        import subprocess
                        try:
                            if self.tts_engine == 'say':  # Mac
                                subprocess.Popen(['say', text])
                            elif self.tts_engine == 'espeak':  # Linux espeak
                                subprocess.Popen(['espeak', text])
                            elif self.tts_engine == 'festival':  # Linux festival
                                subprocess.Popen(['echo', text], stdout=subprocess.PIPE)
                        except Exception as e:
                            logger.error(f"Error executing TTS command: {str(e)}")
                except Exception as e:
                    logger.error(f"Error announcing text: {str(e)}")
            
            threading.Thread(target=_do_announce, daemon=True).start()
        except Exception as e:
            logger.error(f"Error starting announcement thread: {str(e)}")
    
    def describe_widget(self, widget) -> None:
        """
        Describe a widget for screen reader
        
        Args:
            widget: Widget to describe
        """
        description = self._get_widget_description(widget)
        self.announce(description)
    
    def _get_widget_description(self, widget) -> str:
        """
        Get a description of a widget for screen reader
        
        Args:
            widget: Widget to describe
            
        Returns:
            Description of the widget
        """
        try:
            # Check if widget is in our registry
            widget_id = str(widget)
            if widget_id in self.accessible_widgets:
                desc = self.accessible_widgets[widget_id].get("description")
                if desc:
                    return desc
            
            # Fall back to generic descriptions
            widget_class = widget.winfo_class()
            
            if widget_class == "Button" or widget_class == "TButton":
                return f"Button: {widget.cget('text')}"
            elif widget_class == "Entry" or widget_class == "TEntry":
                return f"Text entry field: {widget.get()}"
            elif widget_class == "Label" or widget_class == "TLabel":
                return f"Label: {widget.cget('text')}"
            elif widget_class == "Checkbutton" or widget_class == "TCheckbutton":
                state = "checked" if widget.var.get() else "unchecked"
                return f"Checkbox: {widget.cget('text')}, {state}"
            elif widget_class == "Radiobutton" or widget_class == "TRadiobutton":
                state = "selected" if widget.var.get() == widget.cget('value') else "unselected"
                return f"Radio button: {widget.cget('text')}, {state}"
            elif widget_class == "Listbox":
                selected = widget.curselection()
                if selected:
                    selected_item = widget.get(selected[0])
                    return f"List box with {widget.size()} items, selected: {selected_item}"
                else:
                    return f"List box with {widget.size()} items"
            elif widget_class == "Text":
                selection = widget.tag_ranges("sel")
                if selection:
                    selected_text = widget.get(selection[0], selection[1])
                    return f"Text editor with selected text: {selected_text[:50]}{'...' if len(selected_text) > 50 else ''}"
                else:
                    return "Text editor"
            elif widget_class == "Frame" or widget_class == "TFrame":
                return "Panel"
            elif widget_class == "Canvas":
                return "Drawing area"
            else:
                return f"{widget_class} widget"
        except Exception as e:
            logger.error(f"Error describing widget: {str(e)}")
            return "Unknown widget"
    
    def show_accessibility_dialog(self) -> None:
        """Show dialog for configuring accessibility settings"""
        if self.root is None:
            logger.warning("Cannot show accessibility dialog: root is None")
            return
            
        dialog = tk.Toplevel(self.root)
        dialog.title("Accessibility Settings")
        dialog.transient(self.root)
        dialog.grab_set()
        
        # Create content
        frame = ttk.Frame(dialog, padding="20")
        frame.pack(fill=tk.BOTH, expand=True)
        
        ttk.Label(frame, text="Accessibility Settings", font=("Helvetica", 14, "bold")).grid(
            row=0, column=0, columnspan=2, sticky=tk.W, pady=(0, 10))
        
        # Create variables for checkboxes
        check_vars = {}
        for i, feature in enumerate(AccessibilityFeature):
            var = tk.BooleanVar(value=self.settings[feature.value])
            check_vars[feature.value] = var
            
            # Format display name
            display_name = feature.value.replace('_', ' ').title()
            
            # Add checkbox
            cb = ttk.Checkbutton(frame, text=display_name, variable=var)
            cb.grid(row=i+1, column=0, sticky=tk.W, pady=2)
            
            # Add description
            description = self._get_feature_description(feature)
            lbl = ttk.Label(frame, text=description, wraplength=300, justify=tk.LEFT)
            lbl.grid(row=i+1, column=1, sticky=tk.W, padx=10, pady=2)
        
        # Separator
        ttk.Separator(frame).grid(row=len(AccessibilityFeature)+1, column=0, columnspan=2, 
                                sticky=tk.EW, pady=10)
        
        # Font size options
        ttk.Label(frame, text="Font Sizes").grid(row=len(AccessibilityFeature)+2, column=0, 
                                               sticky=tk.W, pady=(5, 0))
        
        # Font size sliders
        size_frame = ttk.Frame(frame)
        size_frame.grid(row=len(AccessibilityFeature)+3, column=0, columnspan=2, sticky=tk.EW, pady=5)
        
        font_size_vars = {}
        
        for i, (name, size) in enumerate(self.font_sizes.items()):
            # Format display name
            display_name = name.replace('_', ' ').title()
            
            ttk.Label(size_frame, text=f"{display_name}:").grid(row=i, column=0, sticky=tk.W, pady=2)
            
            var = tk.IntVar(value=size)
            font_size_vars[name] = var
            
            slider = ttk.Scale(size_frame, from_=8, to=24, variable=var, orient=tk.HORIZONTAL, length=200)
            slider.grid(row=i, column=1, sticky=tk.EW, padx=(10, 5), pady=2)
            
            ttk.Label(size_frame, textvariable=var, width=2).grid(row=i, column=2, padx=(0, 10))
        
        # Button frame
        button_frame = ttk.Frame(frame)
        button_frame.grid(row=len(AccessibilityFeature)+4, column=0, columnspan=2, pady=10)
        
        def save_settings():
            # Update settings from checkboxes
            for feature in AccessibilityFeature:
                self.settings[feature.value] = check_vars[feature.value].get()
            
            # Update font sizes
            for name, var in font_size_vars.items():
                self.font_sizes[name] = var.get()
            
            # Apply settings
            self.apply_settings()
            
            # Save settings
            self._save_settings()
            
            # Close dialog
            dialog.destroy()
            
            # Announce settings saved
            self.announce("Accessibility settings saved")
        
        ttk.Button(button_frame, text="Save", command=save_settings).pack(side=tk.RIGHT, padx=5)
        ttk.Button(button_frame, text="Cancel", command=dialog.destroy).pack(side=tk.RIGHT, padx=5)
        
        # Apply initial focus to the dialog for keyboard navigation
        frame.focus_set()
        
        # Make dialog accessible
        dialog.bind("<Escape>", lambda e: dialog.destroy())
        dialog.protocol("WM_DELETE_WINDOW", dialog.destroy)
        
        # Auto-size dialog based on content
        dialog.update_idletasks()
        dialog.geometry(f"{frame.winfo_reqwidth() + 40}x{frame.winfo_reqheight() + 40}")
        
        # Center dialog
        self._center_window(dialog)
        
        # Announce dialog
        self.announce("Accessibility settings dialog opened")
    
    def _center_window(self, window):
        """Center a window on screen"""
        window.update_idletasks()
        width = window.winfo_width()
        height = window.winfo_height()
        x = (window.winfo_screenwidth() // 2) - (width // 2)
        y = (window.winfo_screenheight() // 2) - (height // 2)
        window.geometry(f"{width}x{height}+{x}+{y}")
    
    def _get_feature_description(self, feature: AccessibilityFeature) -> str:
        """
        Get description of an accessibility feature
        
        Args:
            feature: Feature to describe
            
        Returns:
            Description of the feature
        """
        descriptions = {
            AccessibilityFeature.HIGH_CONTRAST: "Increases contrast for better visibility",
            AccessibilityFeature.LARGE_FONT: "Increases font size for better readability",
            AccessibilityFeature.KEYBOARD_NAVIGATION: "Enables full keyboard control of the application",
            AccessibilityFeature.SCREEN_READER: "Enables text-to-speech for screen reading",
            AccessibilityFeature.REDUCED_MOTION: "Reduces or eliminates animations",
            AccessibilityFeature.FOCUS_HIGHLIGHTING: "Highlights the currently focused element",
            AccessibilityFeature.TEXT_TO_SPEECH: "Reads selected text aloud",
            AccessibilityFeature.TOOLTIPS: "Shows helpful tooltips on hover"
        }
        
        return descriptions.get(feature, "")
    
    def setup_widget_for_accessibility(self, widget, description: Optional[str] = None,
                                     shortcut: Optional[str] = None, actions: Optional[Dict[str, Callable]] = None):
        """
        Configure a widget for accessibility
        
        Args:
            widget: Widget to configure
            description: Optional accessibility description
            shortcut: Optional keyboard shortcut
            actions: Optional dict of action name -> function for screen reader to announce
        """
        widget_id = str(widget)
        
        # Register widget
        self.accessible_widgets[widget_id] = {
            "widget": widget,
            "description": description,
            "shortcut": shortcut,
            "actions": actions or {}
        }
        
        if description:
            # Set as tooltip if tooltips are enabled
            if self.settings[AccessibilityFeature.TOOLTIPS.value]:
                shortcut_text = f" ({shortcut})" if shortcut else ""
                self._create_tooltip(widget, description + shortcut_text)
        
        # Bind events for screen reader
        widget.bind("<FocusIn>", lambda e: self._on_widget_focus_in(e, description))
        
        # Add to accessibility index if it's a focusable widget
        if widget.winfo_class() in ["Button", "TButton", "Entry", "TEntry", "Text", 
                                  "Checkbutton", "TCheckbutton", "Radiobutton", "TRadiobutton",
                                  "Listbox", "Combobox", "TCombobox"]:
            # Add widget to focus tracking
            self._register_focusable(widget)
    
    def _register_focusable(self, widget) -> None:
        """Register a widget as focusable for keyboard navigation"""
        widget_id = str(widget)
        
        # Set tabindex if it doesn't have one
        try:
            widget.config(takefocus=1)
        except tk.TclError:
            # Some widgets don't support takefocus
            pass
    
    def _on_focus_in(self, event) -> None:
        """Track focus for keyboard navigation history"""
        widget = event.widget
        widget_id = str(widget)
        
        # Skip non-interactive widgets
        if widget.winfo_class() in ["Frame", "TFrame", "Toplevel", "Tk"]:
            return
        
        # Add to focus history
        if len(self.focus_history) == 0 or self.focus_history[-1] != widget_id:
            self.focus_history.append(widget_id)
            # Trim history if needed
            if len(self.focus_history) > self.max_focus_history:
                self.focus_history = self.focus_history[-self.max_focus_history:]
    
    def _on_widget_focus_in(self, event, description: Optional[str] = None):
        """Handle widget focus for screen reader"""
        if self.settings[AccessibilityFeature.SCREEN_READER.value]:
            widget = event.widget
            if description:
                self.announce(description)
            else:
                self.describe_widget(widget)
    
    def _navigate_focus(self, direction: int) -> None:
        """
        Navigate focus in the specified direction
        
        Args:
            direction: 1 for forward, -1 for backward
        """
        if not self.settings[AccessibilityFeature.KEYBOARD_NAVIGATION.value] or self.root is None:
            return
            
        # Get current focus
        focused = self.root.focus_get()
        if not focused:
            # Find first focusable widget
            for widget_id, info in self.accessible_widgets.items():
                widget = info["widget"]
                try:
                    widget.focus_set()
                    break
                except:
                    continue
            return
        
        # Get next/previous focusable widget
        if direction > 0:
            # Forward navigation
            self._focus_next_widget(focused)
        else:
            # Backward navigation
            self._focus_previous_widget(focused)
    
    def _focus_next_widget(self, current_widget) -> None:
        """Focus the next widget in tab order"""
        # This is a simplified implementation
        # A real implementation would traverse the widget hierarchy
        
        # Get all focusable widgets
        focusable = []
        self._collect_focusable_widgets(self.root, focusable)
        
        if not focusable:
            return
            
        # Find current widget index
        current_idx = -1
        for i, widget in enumerate(focusable):
            if widget == current_widget:
                current_idx = i
                break
        
        # Focus next widget
        if current_idx >= 0:
            next_idx = (current_idx + 1) % len(focusable)
            try:
                focusable[next_idx].focus_set()
            except:
                # Try the next one if this fails
                self._focus_next_widget(focusable[next_idx])
        else:
            # Current widget not found, focus first widget
            try:
                focusable[0].focus_set()
            except:
                pass
    
    def _focus_previous_widget(self, current_widget) -> None:
        """Focus the previous widget in tab order"""
        # This is a simplified implementation
        
        # Get all focusable widgets
        focusable = []
        self._collect_focusable_widgets(self.root, focusable)
        
        if not focusable:
            return
            
        # Find current widget index
        current_idx = -1
        for i, widget in enumerate(focusable):
            if widget == current_widget:
                current_idx = i
                break
        
        # Focus previous widget
        if current_idx >= 0:
            prev_idx = (current_idx - 1) % len(focusable)
            try:
                focusable[prev_idx].focus_set()
            except:
                # Try the previous one if this fails
                self._focus_previous_widget(focusable[prev_idx])
        else:
            # Current widget not found, focus last widget
            try:
                focusable[-1].focus_set()
            except:
                pass
    
    def _collect_focusable_widgets(self, widget, focusable: List) -> None:
        """Recursively collect focusable widgets"""
        try:
            # Check if widget is focusable
            if widget.winfo_class() not in ["Frame", "TFrame", "Toplevel", "Tk"] and \
               hasattr(widget, "focus_set"):
                # Check takefocus attribute if available
                try:
                    if str(widget.cget("takefocus")).lower() not in ["0", "none", "false"]:
                        focusable.append(widget)
                except (tk.TclError, AttributeError):
                    # If we can't check takefocus, assume it's focusable
                    focusable.append(widget)
        except Exception as e:
            # Skip problematic widgets
            pass
        
        # Process children
        try:
            for child in widget.winfo_children():
                self._collect_focusable_widgets(child, focusable)
        except Exception:
            # Skip if widget doesn't support winfo_children
            pass
    
    def _find_widgets_by_class(self, widget, class_name: str) -> List:
        """Find all widgets of a specific class"""
        result = []
        
        if widget is None:
            return result
            
        # Check current widget
        try:
            if widget.winfo_class() == class_name:
                result.append(widget)
        except Exception:
            pass
        
        # Check children
        try:
            for child in widget.winfo_children():
                result.extend(self._find_widgets_by_class(child, class_name))
        except Exception:
            pass
        
        return result
    
    def _create_tooltip(self, widget, text: str):
        """
        Create a tooltip for a widget
        
        Args:
            widget: Widget to add tooltip to
            text: Tooltip text
        """
        # Create a tooltip (will be shown on hover)
        tooltip = _ToolTip(widget, text, delay=800)
        
        def enter(event):
            if self.settings[AccessibilityFeature.TOOLTIPS.value]:
                tooltip.showtip()
                self.current_tooltip = tooltip
        
        def leave(event):
            if tooltip == self.current_tooltip:
                tooltip.hidetip()
                self.current_tooltip = None
        
        widget.bind("<Enter>", enter)
        widget.bind("<Leave>", leave)
    
    def speak_selected_text(self) -> None:
        """Speak currently selected text"""
        if not self.settings[AccessibilityFeature.TEXT_TO_SPEECH.value] or self.root is None:
            return
            
        # Find focused widget
        focused = self.root.focus_get()
        if not focused:
            return
            
        # Get selected text based on widget type
        selected_text = ""
        
        try:
            if focused.winfo_class() == "Text":
                # Text widget
                try:
                    selected_text = focused.get("sel.first", "sel.last")
                except tk.TclError:
                    # No selection
                    pass
                    
            elif focused.winfo_class() in ["Entry", "TEntry"]:
                # Entry widget
                try:
                    sel_start = focused.index("sel.first")
                    sel_end = focused.index("sel.last")
                    selected_text = focused.get()[sel_start:sel_end]
                except (tk.TclError, AttributeError):
                    # No selection
                    pass
                    
            elif focused.winfo_class() == "Listbox":
                # Listbox widget
                selection = focused.curselection()
                if selection:
                    selected_text = focused.get(selection[0])
        except Exception as e:
            logger.error(f"Error getting selected text: {str(e)}")
        
        # Speak the selected text
        if selected_text:
            self.announce(selected_text)
        else:
            self.announce("No text selected")
    
    def cleanup(self) -> None:
        """Clean up resources before application exit"""
        # Shut down TTS
        if self.tts_engine is not None:
            self._shutdown_tts()
        
        # Save settings
        self._save_settings()
    
    def register_help_context(self, context_id: str, help_text: str) -> None:
        """
        Register context-sensitive help text
        
        Args:
            context_id: Unique identifier for the context
            help_text: Help text to display for this context
        """
        # This would be used to provide context-sensitive help
        # Not fully implemented in this version
        pass
    
    def show_accessibility_help(self) -> None:
        """Show accessibility help dialog"""
        if self.root is None:
            logger.warning("Cannot show accessibility help: root is None")
            return
            
        help_text = """
        Accessibility Features:
        
        Keyboard Navigation:
        Alt+Tab - Navigate to next focusable element
        Alt+Shift+Tab - Navigate to previous focusable element
        
        Screen Reader:
        Alt+R - Toggle screen reader
        
        High Contrast:
        Alt+C - Toggle high contrast mode
        
        Font Size:
        Alt+F - Toggle large font mode
        
        Accessibility Settings:
        Alt+A - Open accessibility settings dialog
        """
        
        # Create dialog
        dialog = tk.Toplevel(self.root)
        dialog.title("Accessibility Help")
        dialog.transient(self.root)
        
        # Create content
        frame = ttk.Frame(dialog, padding="20")
        frame.pack(fill=tk.BOTH, expand=True)
        
        # Help text
        help_label = ttk.Label(frame, text=help_text, justify=tk.LEFT, wraplength=400)
        help_label.pack(pady=10)
        
        # Close button
        ttk.Button(frame, text="Close", command=dialog.destroy).pack(pady=10)
        
        # Center dialog
        self._center_window(dialog)
        
        # Announce dialog
        self.announce("Accessibility help dialog opened")
        
        # Focus dialog
        dialog.focus_set()


class _ToolTip:
    """Tooltip implementation for widgets"""
    
    def __init__(self, widget, text: str, delay: int = 800, wrap_length: int = 250):
        """
        Initialize tooltip
        
        Args:
            widget: Widget to attach to
            text: Tooltip text
            delay: Delay before showing tooltip in milliseconds
            wrap_length: Text wrapping length
        """
        self.widget = widget
        self.text = text
        self.delay = delay
        self.wrap_length = wrap_length
        self.tipwindow = None
        self.id = None
        self.x = self.y = 0
    
    def showtip(self):
        """Show the tooltip"""
        if self.tipwindow or not self.text:
            return
        
        # Get widget position
        x, y, _, _ = self.widget.bbox("insert")
        x += self.widget.winfo_rootx() + 25
        y += self.widget.winfo_rooty() + 25
        
        # Create tooltip window
        self.tipwindow = tw = tk.Toplevel(self.widget)
        tw.wm_overrideredirect(True)
        tw.wm_geometry(f"+{x}+{y}")
        
        # Add label with tooltip text
        label = ttk.Label(tw, text=self.text, justify=tk.LEFT,
                        wraplength=self.wrap_length, background="#ffffe0", 
                        relief=tk.SOLID, borderwidth=1)
        label.pack(padx=4, pady=4)
    
    def hidetip(self):
        """Hide the tooltip"""
        tw = self.tipwindow
        self.tipwindow = None
        if tw:
            tw.destroy()


def create_accessibility_manager(root: tk.Tk, config_path: Optional[str] = None) -> AccessibilityManager:
    """
    Create and initialize an accessibility manager
    
    Args:
        root: Tkinter root window
        config_path: Optional path to configuration file
        
    Returns:
        Initialized AccessibilityManager
    """
    return AccessibilityManager(root, config_path)
