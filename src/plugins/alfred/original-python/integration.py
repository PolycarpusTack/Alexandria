"""
Enterprise Code Factory 9000 Pro - Integration Module
----------------------------------------------------
Integrates all enhanced modules into the application.

Author: Claude (Enhanced)
Date: April 10, 2025
"""

import logging
import os
import tkinter as tk
from tkinter import ttk, messagebox
import sys
from pathlib import Path
from typing import Dict, List, Optional, Any, Callable, Union, Tuple

# Set up logger
logger = logging.getLogger(__name__)

# Import enhancement modules - with error handling
try:
    from performance_utils import (
        init_performance_monitoring, 
        shutdown_performance_monitoring,
        track_performance, 
        track_method_performance,
        memory_watcher, 
        resource_manager,
        get_performance_metrics,
        get_slowest_functions,
        log_performance_summary
    )
except ImportError as e:
    logger.warning(f"Could not import performance_utils module: {e}")
    # Create minimal replacement functions if module is missing
    def init_performance_monitoring(): pass
    def shutdown_performance_monitoring(): pass
    def track_performance(*args, **kwargs): 
        def decorator(func): return func
        return decorator
    def track_method_performance(*args, **kwargs): 
        def decorator(func): return func
        return decorator
    memory_watcher = None
    resource_manager = None
    def get_performance_metrics(): return []
    def get_slowest_functions(limit=10): return []
    def log_performance_summary(): pass

# Other imports with error handling
try:
    from project_tree_manager import ProjectTreeManager
except ImportError as e:
    logger.warning(f"Could not import ProjectTreeManager: {e}")
    ProjectTreeManager = None

try:
    from unified_code_analyzer import LiveCodeAnalyzer, CodeIssue
except ImportError as e:
    logger.warning(f"Could not import code analyzer modules: {e}")
    LiveCodeAnalyzer = None
    class CodeIssue: pass

try:
    from code_analyzer import CodeAnalysisDisplay
except ImportError as e:
    logger.warning(f"Could not import CodeAnalysisDisplay: {e}")
    CodeAnalysisDisplay = None

try:
    from accessibility_manager import create_accessibility_manager, AccessibilityFeature
except ImportError as e:
    logger.warning(f"Could not import accessibility modules: {e}")
    def create_accessibility_manager(root, config_path=None): return None
    class AccessibilityFeature: pass


class EnterpriseCodeFactoryEnhancer:
    """
    Enhances the Enterprise Code Factory application with new features
    
    This class integrates all the enhanced modules into the main application
    and provides a unified interface for managing them.
    """
    
    def __init__(self, app):
        """
        Initialize the enhancer
        
        Args:
            app: The main application instance
        """
        self.app = app
        self.enhanced_components = {}
        self.initialize_modules()
        logger.info("EnterpriseCodeFactoryEnhancer initialized")
    
    def initialize_modules(self):
        """Initialize all enhancement modules"""
        # Initialize in order of dependency
        self._initialize_performance_monitoring()
        
        try:
            # Only initialize if we have a valid root
            if hasattr(self.app, 'master') and self.app.master is not None:
                if ProjectTreeManager is not None:
                    self._initialize_project_tree_manager()
                
                if LiveCodeAnalyzer is not None and CodeAnalysisDisplay is not None:
                    self._initialize_live_code_analyzer()
                
                # Initialize accessibility after other components
                try:
                    self._initialize_accessibility_manager()
                except Exception as e:
                    logger.error(f"Error initializing accessibility manager: {e}")
                
                # Initialize Ollama integration last
                self._initialize_ollama_integration()
            else:
                logger.warning("Application master window is None, skipping UI enhancements")
        except Exception as e:
            logger.error(f"Error initializing enhancement modules: {e}")
    
    def _initialize_performance_monitoring(self):
        """Initialize performance monitoring"""
        try:
            # Performance monitoring is already initialized at application startup
            # Register main resources for cleanup
            if hasattr(self.app, 'api_client') and hasattr(self.app.api_client, 'executor'):
                if resource_manager:
                    resource_manager.register(
                        "api_client_executor",
                        lambda: self.app.api_client.executor.shutdown(wait=False)
                    )
            
            # Store reference
            self.enhanced_components['performance_monitoring'] = {
                'memory_watcher': memory_watcher,
                'resource_manager': resource_manager
            }
            
            logger.info("Performance monitoring integration complete")
        except Exception as e:
            logger.error(f"Error in performance monitoring setup: {e}")
    
    def _initialize_project_tree_manager(self):
        """Initialize and connect the project tree manager"""
        if not hasattr(self.app, 'project_tree'):
            logger.warning("Project tree not found, skipping project tree manager")
            return
        
        try:
            # Create project tree manager
            tree_manager = ProjectTreeManager(self.app.project_tree)
            
            # Connect to application
            self.app.tree_manager = tree_manager
            
            # Override project tree methods to use tree manager
            self._replace_project_tree_methods()
            
            # Store reference
            self.enhanced_components['project_tree_manager'] = tree_manager
            
            logger.info("Project tree manager integration complete")
        except Exception as e:
            logger.error(f"Error initializing project tree manager: {e}")
    
    def _replace_project_tree_methods(self):
        """Replace project tree methods with enhanced versions"""
        # Store original methods for reference
        self.original_methods = {
            'update_project_tree': self.app.update_project_tree,
            '_filter_project_tree': self.app._filter_project_tree,
            '_on_tree_item_double_click': self.app._on_tree_item_double_click,
            '_get_tree_item_path': self.app._get_tree_item_path
        }
        
        # Replace methods
        def enhanced_update_project_tree(self, filter_text=""):
            """Enhanced update_project_tree method"""
            if not self.project_manager.current_project:
                return
                
            if hasattr(self, "tree_manager"):
                self.tree_manager.set_project(self.project_manager.current_project)
                self.tree_manager.load_project(filter_text)
                
            # Update status
            project_name = os.path.basename(str(self.project_manager.current_project))
            self.status_manager.set(f"Project tree updated: {project_name}")
        
        def enhanced_filter_project_tree(self, *args):
            """Enhanced _filter_project_tree method"""
            search_text = self.search_var.get().lower()
            
            if hasattr(self, "tree_manager"):
                self.tree_manager.load_project(search_text)
        
        def enhanced_on_tree_item_double_click(self, event):
            """Enhanced _on_tree_item_double_click method"""
            item_id = self.project_tree.identify("item", event.x, event.y)
            if not item_id:
                return
                
            # Get the full path of the item using the tree manager
            if hasattr(self, "tree_manager"):
                item_path = self.tree_manager.get_path_for_id(item_id)
                if item_path and os.path.isfile(item_path):
                    self.open_file(item_path)
        
        def enhanced_get_tree_item_path(self, item_id):
            """Enhanced _get_tree_item_path method"""
            if hasattr(self, "tree_manager"):
                return self.tree_manager.get_path_for_id(item_id)
            return None
        
        # Replace methods in the application
        self.app.update_project_tree = enhanced_update_project_tree.__get__(self.app)
        self.app._filter_project_tree = enhanced_filter_project_tree.__get__(self.app)
        self.app._on_tree_item_double_click = enhanced_on_tree_item_double_click.__get__(self.app)
        self.app._get_tree_item_path = enhanced_get_tree_item_path.__get__(self.app)
    
    def _initialize_live_code_analyzer(self):
        """Initialize and connect the live code analyzer"""
        if not hasattr(self.app, 'editor') or not hasattr(self.app, 'quality_frame'):
            logger.warning("Editor or quality frame not found, skipping live code analyzer")
            return
        
        try:
            # Create code analysis display
            analysis_display = CodeAnalysisDisplay(self.app.quality_frame)
            analysis_display.frame.pack(fill=tk.BOTH, expand=True)
            
            # Create live code analyzer
            code_analyzer = LiveCodeAnalyzer(
                editor=self.app.editor,
                issues_callback=self._on_code_issues_found,
                throttle_ms=1000
            )
            
            # Connect to application
            self.app.code_analyzer = code_analyzer
            self.app.analysis_display = analysis_display
            
            # Set up handlers
            analysis_display.set_fix_handler(self._on_fix_issue_requested)
            analysis_display.set_line_select_handler(self._on_issue_line_selected)
            
            # Start the analyzer
            code_analyzer.start()
            
            # Connect to file open method to set language
            self._enhance_file_open_method()
            
            # Store reference
            self.enhanced_components['live_code_analyzer'] = {
                'analyzer': code_analyzer,
                'display': analysis_display
            }
            
            logger.info("Live code analyzer integration complete")
        except Exception as e:
            logger.error(f"Error initializing live code analyzer: {e}")
    
    def _initialize_ollama_integration(self):
        """Initialize and connect Ollama AI integration"""
        try:
            # Import Ollama integration modules
            try:
                from ollama_integration import OllamaClient, OllamaModelSelector, AICodeEnhancer, is_ollama_available
            except ImportError as e:
                logger.warning(f"Ollama integration module not found: {e}")
                return
            
            # Check if Ollama is available
            if not is_ollama_available():
                logger.warning("Ollama service not available, skipping AI integration")
                return
            
            # Create AI frame in the app's left panel if available
            if hasattr(self.app, 'left_panel'):
                ai_frame = ttk.LabelFrame(self.app.left_panel, text="AI Model Selection")
                
                # Position the frame properly in the UI
                if len(self.app.left_panel.winfo_children()) > 0:
                    ai_frame.pack(fill=tk.X, pady=10, after=self.app.left_panel.winfo_children()[0])
                else:
                    ai_frame.pack(fill=tk.X, pady=10)
                
                # Initialize Ollama client
                ollama_client = OllamaClient()
                
                # Create model selector
                ollama_selector = OllamaModelSelector(ai_frame, ollama_client)
                ollama_selector.frame.pack(fill=tk.X, expand=True, padx=10, pady=5)
                
                # Initialize AI enhancer
                ai_enhancer = AICodeEnhancer(ollama_client)
                
                # Connect to application
                self.app.ollama_client = ollama_client
                self.app.ollama_selector = ollama_selector
                self.app.ai_enhancer = ai_enhancer
                
                # Enhance generate_code method to use AI enhancer
                if hasattr(self.app, 'generate_code'):
                    self._enhance_code_generation()
                
                # Store references
                self.enhanced_components['ollama_integration'] = {
                    'client': ollama_client,
                    'selector': ollama_selector,
                    'enhancer': ai_enhancer
                }
                
                logger.info("Ollama AI integration complete")
            else:
                logger.warning("Left panel not found, skipping Ollama integration UI")
        except Exception as e:
            logger.error(f"Error initializing Ollama integration: {e}")
    
    def get_ai_enhancer(self):
        """
        Get the AI enhancer component if available
        
        Returns:
            AI enhancer or None if not available
        """
        if 'ollama_integration' in self.enhanced_components:
            return self.enhanced_components['ollama_integration'].get('enhancer')
        return None
    
    def _enhance_code_generation(self):
        """Enhance the app's code generation to use Ollama when available"""
        if not hasattr(self.app, 'generate_code'):
            logger.warning("generate_code method not found, skipping enhancement")
            return
            
        # Store original method
        original_generate_code = self.app.generate_code
        
        def enhanced_generate_code(self, event=None):
            """Enhanced generate_code method that uses Ollama AI Enhancer if available"""
            # Skip enhancement if AI enhancer not available
            if not hasattr(self, 'ai_enhancer') or not self.ai_enhancer:
                return original_generate_code(event)
            
            # Get prompt from editor
            prompt = self.editor.get("1.0", tk.END).strip()
            if not prompt:
                self.status_manager.set("Please enter a prompt first", "warning")
                return
            
            # Check for project
            if not self.project_manager.current_project:
                if messagebox.askyesno("No Project", 
                                      "No active project. Create a new one?"):
                    self.create_new_project()
                    if not self.project_manager.current_project:
                        return
                else:
                    return
            
            # Show spinner for background operation
            self.busy_indicator.start()
            self.status_manager.set("Generating code with Ollama...", "info")
            
            # Update AI console
            if hasattr(self, 'ai_console'):
                self.ai_console.delete("1.0", tk.END)
                model_name = self.ollama_selector.get_selected_model() if hasattr(self, 'ollama_selector') else "default"
                self.ai_console.insert(tk.END, f"Prompt: {prompt}\n\nGenerating code with {model_name}...\n")
            
            # Use the AI enhancer for code generation
            def _on_generation_complete(result):
                self.busy_indicator.stop()
                
                if result.success:
                    # Validate and enhance code
                    validation = self.code_enforcer.validate_syntax(result.data)
                    if not validation.get("valid", True):
                        self.show_errors(validation.get("issues", []))
                        return
                    
                    # Apply the AI enhancer improvements
                    improved_code = self.ai_enhancer.optimize_code(result.data, "python")
                    final_code = improved_code if improved_code else result.data
                    
                    # Update editor with result
                    self.editor.delete("1.0", tk.END)
                    self.editor.insert(tk.END, final_code)
                    self._set_editor_modified(True)
                    
                    # Update AI console
                    if hasattr(self, 'ai_console'):
                        self.ai_console.insert(tk.END, "\nGeneration successful with Ollama model!\n")
                    
                    # Log interaction
                    if hasattr(self, 'current_logger') and self.current_logger:
                        self.current_logger.log_interaction(
                            prompt, final_code, ["main.py"], 
                            model=self.ollama_selector.get_selected_model() if hasattr(self, 'ollama_selector') else "default"
                        )
                    
                    # Auto-generate tests if enabled
                    if hasattr(self, 'config') and self.config.get_bool("projects", "auto_tests"):
                        self.auto_generate_tests(final_code)
                    
                    # Run quality checks if enabled
                    if hasattr(self, 'config') and self.config.get_bool("projects", "quality_checks"):
                        self.run_quality_checks()
                    
                    model_name = self.ollama_selector.get_selected_model() if hasattr(self, 'ollama_selector') else "default"
                    self.status_manager.set(f"✅ Code generated with Ollama model: {model_name}", "info")
                else:
                    # Fall back to original method on failure
                    if hasattr(self, 'ai_console'):
                        self.ai_console.insert(tk.END, f"\nError with Ollama model, falling back to default generation: {result.error}\n")
                    self.busy_indicator.stop()
                    original_generate_code(event)
            
            def _on_generation_error(error):
                self.busy_indicator.stop()
                error_msg = str(error)
                if hasattr(self, 'ai_console'):
                    self.ai_console.insert(tk.END, f"\nError with Ollama model, falling back to default generation: {error_msg}\n")
                
                # Fall back to original method
                original_generate_code(event)
            
            try:
                # Update model from selector
                if hasattr(self, 'ollama_selector'):
                    model = self.ollama_selector.get_selected_model()
                    if model and hasattr(self, 'ai_enhancer'):
                        self.ai_enhancer.set_model(model)
                
                # Use the AI enhancer to generate code
                if hasattr(self, 'ai_enhancer'):
                    result = self.ai_enhancer.suggest_fix("", prompt, "python")
                    
                    # Process the result
                    if result:
                        # Create a successful result
                        class Result:
                            def __init__(self, data):
                                self.success = True
                                self.data = data
                                self.error = None
                        
                        _on_generation_complete(Result(result))
                    else:
                        # Fall back to original method
                        if hasattr(self, 'ai_console'):
                            self.ai_console.insert(tk.END, "\nNo response from Ollama model, falling back to default generation\n")
                        self.busy_indicator.stop()
                        original_generate_code(event)
                else:
                    # No AI enhancer available
                    self.busy_indicator.stop()
                    original_generate_code(event)
            except Exception as e:
                _on_generation_error(e)
        
        # Replace method in the application
        self.app.generate_code = enhanced_generate_code.__get__(self.app)
    
    def _on_code_issues_found(self, issues: List[CodeIssue]):
        """Handle code issues found by the analyzer"""
        if hasattr(self.app, 'analysis_display'):
            self.app.analysis_display.update_issues(issues)
            
            # Enhance with AI suggestions if available
            if hasattr(self.app, 'ai_enhancer') and self.app.ai_enhancer:
                code = self.app.editor.get("1.0", tk.END)
                if code.strip():
                    # Determine language
                    language = "python"  # Default
                    if hasattr(self.app, 'language_var'):
                        language = self.app.language_var.get()
                    
                    # Get AI suggestions
                    enhanced_issues = self.app.ai_enhancer.enhance_analysis(issues, code, language)
                    
                    # Update display if we got enhanced issues
                    if enhanced_issues != issues:
                        self.app.analysis_display.update_issues(enhanced_issues)
                        self.app.status_manager.set("Enhanced analysis with AI suggestions", "info")
    
    def _on_fix_issue_requested(self, issue: CodeIssue):
        """Handle fix issue request"""
        if not hasattr(self.app, 'editor') or not hasattr(self.app, 'code_analyzer'):
            return
            
        # Get current code
        code = self.app.editor.get("1.0", tk.END)
        
        # Try to fix the issue with code analyzer
        fixed_code = self.app.code_analyzer.auto_fix(code, issue)
        
        # If code analyzer couldn't fix it, try with AI enhancer
        if not fixed_code and hasattr(self.app, 'ai_enhancer') and self.app.ai_enhancer:
            # Determine language
            language = "python"  # Default
            if hasattr(self.app, 'language_var'):
                language = self.app.language_var.get()
                
            # Get the issue line
            lines = code.splitlines()
            if issue.line and issue.line <= len(lines):
                issue_line = lines[issue.line - 1]
                
                # Try to fix with AI
                fixed_code = self.app.ai_enhancer.suggest_fix(
                    issue_line,
                    f"Fix this issue: {issue.message}",
                    language
                )
                
                # Apply the fix if successful
                if fixed_code:
                    lines[issue.line - 1] = fixed_code
                    fixed_code = "\n".join(lines)
        
        if fixed_code:
            # Apply fix
            self.app.editor.delete("1.0", tk.END)
            self.app.editor.insert(tk.END, fixed_code)
            
            # Mark as modified
            if hasattr(self.app, '_set_editor_modified'):
                self.app._set_editor_modified(True)
            
            # Show success message
            self.app.status_manager.set(f"Fixed issue: {issue.message}", "info")
        else:
            # Show error message
            self.app.status_manager.set(f"Could not auto-fix issue: {issue.message}", "warning")
    
    def _on_issue_line_selected(self, line: int):
        """Handle issue line selection"""
        if not hasattr(self.app, 'editor'):
            return
            
        # Highlight and scroll to the line
        self.app.editor.tag_remove("sel", "1.0", tk.END)
        self.app.editor.tag_add("sel", f"{line}.0", f"{line+1}.0")
        self.app.editor.see(f"{line}.0")
        self.app.editor.focus_set()
    
    def _enhance_file_open_method(self):
        """Enhance file open method to set language based on extension"""
        if not hasattr(self.app, 'open_file'):
            return
            
        original_open_file = self.app.open_file
        
        def enhanced_open_file(self, file_path: str):
            """Enhanced open_file method"""
            # Call original method
            result = original_open_file(file_path)
            
            # Set language based on file extension
            if hasattr(self, 'code_analyzer'):
                _, ext = os.path.splitext(file_path)
                ext = ext.lower()
                
                if ext == '.py':
                    self.code_analyzer.set_language("python")
                elif ext in ('.js', '.jsx'):
                    self.code_analyzer.set_language("javascript")
                # Add other language mappings as needed
                
                # Announce file type for screen reader
                if hasattr(self, 'accessibility_manager'):
                    lang_name = "Python" if ext == '.py' else "JavaScript" if ext in ('.js', '.jsx') else "text"
                    self.accessibility_manager.announce(f"Opened {lang_name} file {os.path.basename(file_path)}")
            
            return result
        
        # Replace method in the application
        self.app.open_file = enhanced_open_file.__get__(self.app)
    
    def _initialize_accessibility_manager(self):
        """Initialize and connect the accessibility manager"""
        # Create accessibility manager only if the app has a master window
        if not hasattr(self.app, 'master') or self.app.master is None:
            logger.warning("Application master not available, skipping accessibility manager")
            return
            
        try:
            # Create accessibility manager
            accessibility_manager = create_accessibility_manager(self.app.master)
            
            # Connect to application
            self.app.accessibility_manager = accessibility_manager
            
            # Enhance help menu to add accessibility options
            if hasattr(self.app, 'master') and self.app.master is not None:
                self._enhance_help_menu()
            
                # Make important UI components accessible
                self._make_ui_accessible()
            
            # Store reference
            self.enhanced_components['accessibility_manager'] = accessibility_manager
            
            logger.info("Accessibility manager integration complete")
        except Exception as e:
            logger.error(f"Error initializing accessibility manager: {e}")
    
    def _enhance_help_menu(self):
        """Enhance help menu with accessibility options"""
        if not hasattr(self.app, 'master') or not hasattr(self.app.master, 'config'):
            logger.warning("Application master not found, skipping help menu enhancement")
            return
        
        try:
            # Try to find the existing help menu
            menubar = None
            access_menu = None
            
            # Get all menus
            all_menus = self.app.master.winfo_children()
            for widget in all_menus:
                if widget.winfo_class() == "Menu":
                    menubar = widget
                    break
            
            if not menubar:
                logger.warning("Menu bar not found, skipping help menu enhancement")
                return
            
            # Add Accessibility menu
            access_menu = tk.Menu(menubar, tearoff=0)
            
            # Add menu items
            access_menu.add_command(
                label="Accessibility Settings", 
                command=self.app.accessibility_manager.show_accessibility_dialog,
                accelerator="Alt+A"
            )
            access_menu.add_separator()
            
            # Create variable for tracking state
            high_contrast_var = tk.BooleanVar(
                value=self.app.accessibility_manager.settings[AccessibilityFeature.HIGH_CONTRAST.value]
            )
            large_font_var = tk.BooleanVar(
                value=self.app.accessibility_manager.settings[AccessibilityFeature.LARGE_FONT.value]
            )
            screen_reader_var = tk.BooleanVar(
                value=self.app.accessibility_manager.settings[AccessibilityFeature.SCREEN_READER.value]
            )
            
            # Create toggle commands
            def toggle_high_contrast():
                self.app.accessibility_manager.toggle_feature(AccessibilityFeature.HIGH_CONTRAST)
                high_contrast_var.set(
                    self.app.accessibility_manager.settings[AccessibilityFeature.HIGH_CONTRAST.value]
                )
            
            def toggle_large_font():
                self.app.accessibility_manager.toggle_feature(AccessibilityFeature.LARGE_FONT)
                large_font_var.set(
                    self.app.accessibility_manager.settings[AccessibilityFeature.LARGE_FONT.value]
                )
            
            def toggle_screen_reader():
                self.app.accessibility_manager.toggle_feature(AccessibilityFeature.SCREEN_READER)
                screen_reader_var.set(
                    self.app.accessibility_manager.settings[AccessibilityFeature.SCREEN_READER.value]
                )
            
            # Add checkbuttons
            access_menu.add_checkbutton(
                label="High Contrast Mode", 
                variable=high_contrast_var,
                command=toggle_high_contrast,
                accelerator="Alt+C"
            )
            access_menu.add_checkbutton(
                label="Large Font", 
                variable=large_font_var,
                command=toggle_large_font,
                accelerator="Alt+F"
            )
            access_menu.add_checkbutton(
                label="Screen Reader Support", 
                variable=screen_reader_var,
                command=toggle_screen_reader,
                accelerator="Alt+R"
            )
            
            access_menu.add_separator()
            access_menu.add_command(
                label="Accessibility Help",
                command=self.app.accessibility_manager.show_accessibility_help
            )
            
            # Add to menubar
            menubar.add_cascade(label="Accessibility", menu=access_menu)
            
        except Exception as e:
            logger.error(f"Error enhancing help menu: {str(e)}")
    
    def _make_ui_accessible(self):
        """Make important UI components accessible"""
        if not hasattr(self.app, 'accessibility_manager'):
            return
            
        # Add accessibility descriptions to main UI components
        try:
            # Editor
            if hasattr(self.app, 'editor'):
                self.app.accessibility_manager.setup_widget_for_accessibility(
                    self.app.editor,
                    description="Code editor window",
                    shortcut="F5 to generate code"
                )
            
            # Project tree
            if hasattr(self.app, 'project_tree'):
                self.app.accessibility_manager.setup_widget_for_accessibility(
                    self.app.project_tree,
                    description="Project file explorer",
                    shortcut="Double-click to open file"
                )
            
            # Quality display
            if hasattr(self.app, 'quality_display'):
                self.app.accessibility_manager.setup_widget_for_accessibility(
                    self.app.quality_display,
                    description="Code quality issues display"
                )
            
            # AI console
            if hasattr(self.app, 'ai_console'):
                self.app.accessibility_manager.setup_widget_for_accessibility(
                    self.app.ai_console,
                    description="AI communication console"
                )
            
            # Ollama model selector if available
            if hasattr(self.app, 'ollama_selector') and hasattr(self.app.ollama_selector, 'model_combo'):
                self.app.accessibility_manager.setup_widget_for_accessibility(
                    self.app.ollama_selector.model_combo,
                    description="AI model selection dropdown",
                    shortcut="Select different AI models"
                )
        except Exception as e:
            logger.error(f"Error making UI accessible: {e}")
    
    def shutdown(self):
        """Shutdown all enhanced components"""
        # Shutdown live code analyzer if active
        if 'live_code_analyzer' in self.enhanced_components:
            analyzer = self.enhanced_components['live_code_analyzer'].get('analyzer')
            if analyzer:
                analyzer.stop()
                logger.info("Live code analyzer stopped")
        
        # Cleanup accessibility manager
        if 'accessibility_manager' in self.enhanced_components:
            if hasattr(self.enhanced_components['accessibility_manager'], 'cleanup'):
                self.enhanced_components['accessibility_manager'].cleanup()
                logger.info("Accessibility manager cleaned up")
        
        # Log performance summary
        log_performance_summary()
        
        # Performance monitoring will be shut down by the main application
        logger.info("Enhancement modules shutdown complete")


def initialize_enhancements(app):
    """
    Initialize all enhancements for the application
    
    Args:
        app: The main application instance
        
    Returns:
        EnterpriseCodeFactoryEnhancer instance
    """
    try:
        # Initialize performance monitoring
        init_performance_monitoring()
        
        # Create enhancer
        enhancer = EnterpriseCodeFactoryEnhancer(app)
        
        # Set up shutdown hook
        original_exit = getattr(app, '_on_exit', None)
        
        def enhanced_exit():
            """Enhanced exit method with proper shutdown"""
            # Shutdown enhancer
            if hasattr(app, 'enhancer'):
                app.enhancer.shutdown()
            
            # Call original exit method if available
            if original_exit:
                original_exit()
            else:
                try:
                    if hasattr(app, 'master') and app.master:
                        app.master.destroy()
                except Exception as e:
                    logger.error(f"Error destroying master window: {e}")
            
            # Shutdown performance monitoring
            shutdown_performance_monitoring()
        
        # Replace exit method
        app._on_exit = enhanced_exit.__get__(app)
        
        # Store enhancer reference in app
        app.enhancer = enhancer
        
        return enhancer
    except Exception as e:
        logger.error(f"Error initializing enhancements: {e}")
        return None


def shutdown_and_exit(app):
    """
    Shutdown application with proper cleanup
    
    Args:
        app: The main application instance
    """
    try:
        # Call enhanced exit method
        if hasattr(app, '_on_exit'):
            app._on_exit()
        else:
            # Fallback if exit method not available
            if hasattr(app, 'enhancer'):
                app.enhancer.shutdown()
            
            if hasattr(app, 'master') and app.master:
                app.master.destroy()
            
            # Shutdown performance monitoring
            shutdown_performance_monitoring()
    except Exception as e:
        logger.error(f"Error during shutdown: {e}")
        # Force exit if shutdown fails
        sys.exit(1)
