#!/usr/bin/env python3
"""
Project template wizard for ALFRED
Provides an interactive UI for creating projects from templates
"""

import tkinter as tk
from tkinter import ttk, messagebox, filedialog
from pathlib import Path
from typing import Dict, Any, Optional, List, Callable
from dataclasses import dataclass
import json
import threading

from alfred_template_system import (
    TemplateRegistry, ProjectTemplate, TemplateEngine,
    TemplateConfig, TemplateFile
)
from alfred_ui_builder import UIBuilder
from alfred_validators import validate_input, sanitize_project_name
from alfred_constants import COLORS, CHAT_DISPLAY_FONT


class TemplateWizard:
    """Interactive wizard for project creation"""
    
    def __init__(self, parent: tk.Tk, registry: TemplateRegistry, 
                 on_complete: Optional[Callable] = None):
        self.parent = parent
        self.registry = registry
        self.engine = TemplateEngine(registry)
        self.on_complete = on_complete
        
        # UI Builder
        self.ui_builder = UIBuilder()
        
        # Wizard state
        self.current_step = 0
        self.steps = []
        self.wizard_data = {
            'template': None,
            'project_name': '',
            'project_path': '',
            'variables': {}
        }
        
        # Create wizard window
        self._create_window()
    
    def _create_window(self):
        """Create the wizard window"""
        self.window = tk.Toplevel(self.parent)
        self.window.title("New Project Wizard - ALFRED")
        self.window.geometry("800x600")
        
        # Make modal
        self.window.transient(self.parent)
        self.window.grab_set()
        
        # Main container
        main_frame = ttk.Frame(self.window)
        main_frame.pack(fill='both', expand=True, padx=10, pady=10)
        
        # Header
        self._create_header(main_frame)
        
        # Content area
        self.content_frame = ttk.Frame(main_frame)
        self.content_frame.pack(fill='both', expand=True, pady=20)
        
        # Footer with navigation
        self._create_footer(main_frame)
        
        # Initialize steps
        self._init_steps()
        
        # Show first step
        self._show_step(0)
    
    def _create_header(self, parent):
        """Create wizard header"""
        header_frame = ttk.Frame(parent)
        header_frame.pack(fill='x', pady=(0, 10))
        
        # Title
        title_label = ttk.Label(
            header_frame,
            text="Create New Project",
            font=('Arial', 16, 'bold')
        )
        title_label.pack(side='left')
        
        # Step indicator
        self.step_label = ttk.Label(
            header_frame,
            text="Step 1 of 4",
            font=('Arial', 10)
        )
        self.step_label.pack(side='right')
    
    def _create_footer(self, parent):
        """Create wizard footer with navigation"""
        footer_frame = ttk.Frame(parent)
        footer_frame.pack(fill='x', pady=(10, 0))
        
        # Cancel button
        self.cancel_btn = ttk.Button(
            footer_frame,
            text="Cancel",
            command=self._cancel
        )
        self.cancel_btn.pack(side='left')
        
        # Navigation buttons
        nav_frame = ttk.Frame(footer_frame)
        nav_frame.pack(side='right')
        
        self.back_btn = ttk.Button(
            nav_frame,
            text="← Back",
            command=self._go_back,
            state='disabled'
        )
        self.back_btn.pack(side='left', padx=5)
        
        self.next_btn = ttk.Button(
            nav_frame,
            text="Next →",
            command=self._go_next
        )
        self.next_btn.pack(side='left')
        
        self.finish_btn = ttk.Button(
            nav_frame,
            text="Create Project",
            command=self._finish,
            state='disabled'
        )
        self.finish_btn.pack(side='left')
        self.finish_btn.pack_forget()
    
    def _init_steps(self):
        """Initialize wizard steps"""
        self.steps = [
            WizardStep("Select Template", self._create_template_selection),
            WizardStep("Project Details", self._create_project_details),
            WizardStep("Configure Template", self._create_template_config),
            WizardStep("Review & Create", self._create_review)
        ]
    
    def _show_step(self, step_index: int):
        """Show a specific step"""
        # Clear content
        for widget in self.content_frame.winfo_children():
            widget.destroy()
        
        # Update step indicator
        self.step_label.config(text=f"Step {step_index + 1} of {len(self.steps)}")
        
        # Create step content
        step = self.steps[step_index]
        step.create_func(self.content_frame)
        
        # Update navigation
        self.back_btn.config(state='normal' if step_index > 0 else 'disabled')
        
        if step_index == len(self.steps) - 1:
            self.next_btn.pack_forget()
            self.finish_btn.pack(side='left')
        else:
            self.finish_btn.pack_forget()
            self.next_btn.pack(side='left')
        
        self.current_step = step_index
    
    def _create_template_selection(self, parent):
        """Create template selection step"""
        # Instructions
        instructions = ttk.Label(
            parent,
            text="Choose a project template to get started:",
            font=('Arial', 11)
        )
        instructions.pack(pady=(0, 20))
        
        # Search box
        search_frame = ttk.Frame(parent)
        search_frame.pack(fill='x', pady=(0, 10))
        
        ttk.Label(search_frame, text="Search:").pack(side='left', padx=(0, 5))
        
        self.search_var = tk.StringVar()
        self.search_var.trace('w', self._on_search_changed)
        search_entry = ttk.Entry(search_frame, textvariable=self.search_var, width=30)
        search_entry.pack(side='left', fill='x', expand=True)
        
        # Template list with categories
        list_frame = ttk.Frame(parent)
        list_frame.pack(fill='both', expand=True)
        
        # Create notebook for categories
        self.category_notebook = ttk.Notebook(list_frame)
        self.category_notebook.pack(fill='both', expand=True)
        
        # Add "All" tab
        all_frame = ttk.Frame(self.category_notebook)
        self.category_notebook.add(all_frame, text="All Templates")
        self._create_template_list(all_frame, self.registry.get_all_templates())
        
        # Add category tabs
        for category, templates in self.registry.get_templates_by_category().items():
            cat_frame = ttk.Frame(self.category_notebook)
            self.category_notebook.add(cat_frame, text=category)
            self._create_template_list(cat_frame, {t.config.name: t for t in templates})
    
    def _create_template_list(self, parent, templates: Dict[str, ProjectTemplate]):
        """Create a list of template cards"""
        # Scrollable frame
        canvas = tk.Canvas(parent, highlightthickness=0)
        scrollbar = ttk.Scrollbar(parent, orient='vertical', command=canvas.yview)
        scrollable_frame = ttk.Frame(canvas)
        
        scrollable_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
        )
        
        canvas.create_window((0, 0), window=scrollable_frame, anchor='nw')
        canvas.configure(yscrollcommand=scrollbar.set)
        
        # Template cards
        for template in templates.values():
            self._create_template_card(scrollable_frame, template)
        
        canvas.pack(side='left', fill='both', expand=True)
        scrollbar.pack(side='right', fill='y')
    
    def _create_template_card(self, parent, template: ProjectTemplate):
        """Create a template card"""
        card = ttk.Frame(parent, relief='solid', borderwidth=1)
        card.pack(fill='x', pady=5, padx=5)
        
        # Make clickable
        card.bind("<Button-1>", lambda e: self._select_template(template))
        
        # Header with icon and name
        header_frame = ttk.Frame(card)
        header_frame.pack(fill='x', padx=10, pady=10)
        
        icon_label = ttk.Label(
            header_frame,
            text=template.config.icon,
            font=('Arial', 20)
        )
        icon_label.pack(side='left', padx=(0, 10))
        
        name_label = ttk.Label(
            header_frame,
            text=template.config.name,
            font=('Arial', 12, 'bold'),
            cursor='hand2'
        )
        name_label.pack(side='left')
        name_label.bind("<Button-1>", lambda e: self._select_template(template))
        
        # Version and author
        meta_label = ttk.Label(
            header_frame,
            text=f"v{template.config.version} by {template.config.author}",
            font=('Arial', 9),
            foreground='gray'
        )
        meta_label.pack(side='right')
        
        # Description
        desc_label = ttk.Label(
            card,
            text=template.config.description,
            wraplength=600
        )
        desc_label.pack(fill='x', padx=10, pady=(0, 10))
        
        # Tags
        if template.config.tags:
            tags_frame = ttk.Frame(card)
            tags_frame.pack(fill='x', padx=10, pady=(0, 10))
            
            for tag in template.config.tags:
                tag_label = ttk.Label(
                    tags_frame,
                    text=f"#{tag}",
                    font=('Arial', 9),
                    foreground='blue'
                )
                tag_label.pack(side='left', padx=2)
        
        # Highlight if selected
        if self.wizard_data['template'] == template:
            card.configure(relief='solid', borderwidth=2)
            name_label.configure(foreground='blue')
    
    def _select_template(self, template: ProjectTemplate):
        """Select a template"""
        self.wizard_data['template'] = template
        self.next_btn.config(state='normal')
        
        # Refresh display
        self._show_step(self.current_step)
    
    def _create_project_details(self, parent):
        """Create project details step"""
        # Selected template info
        if self.wizard_data['template']:
            template = self.wizard_data['template']
            
            info_frame = ttk.LabelFrame(parent, text="Selected Template")
            info_frame.pack(fill='x', pady=(0, 20))
            
            info_text = f"{template.config.icon} {template.config.name}\n{template.config.description}"
            ttk.Label(info_frame, text=info_text).pack(padx=10, pady=10)
        
        # Project details form
        form_frame = ttk.LabelFrame(parent, text="Project Details")
        form_frame.pack(fill='x')
        
        # Project name
        name_frame = ttk.Frame(form_frame)
        name_frame.pack(fill='x', padx=10, pady=10)
        
        ttk.Label(name_frame, text="Project Name:", width=15).pack(side='left')
        
        self.name_var = tk.StringVar(value=self.wizard_data.get('project_name', ''))
        name_entry = ttk.Entry(name_frame, textvariable=self.name_var, width=40)
        name_entry.pack(side='left', padx=(0, 10))
        
        # Project location
        path_frame = ttk.Frame(form_frame)
        path_frame.pack(fill='x', padx=10, pady=(0, 10))
        
        ttk.Label(path_frame, text="Location:", width=15).pack(side='left')
        
        self.path_var = tk.StringVar(value=self.wizard_data.get('project_path', str(Path.home() / "Projects")))
        path_entry = ttk.Entry(path_frame, textvariable=self.path_var, width=40)
        path_entry.pack(side='left', padx=(0, 5))
        
        browse_btn = ttk.Button(
            path_frame,
            text="Browse...",
            command=self._browse_location
        )
        browse_btn.pack(side='left')
        
        # Full path preview
        preview_frame = ttk.Frame(form_frame)
        preview_frame.pack(fill='x', padx=10, pady=(0, 10))
        
        ttk.Label(preview_frame, text="Full Path:", width=15).pack(side='left')
        
        self.full_path_label = ttk.Label(
            preview_frame,
            text="",
            font=('Consolas', 9),
            foreground='gray'
        )
        self.full_path_label.pack(side='left')
        
        # Update preview
        self._update_path_preview()
        self.name_var.trace('w', lambda *args: self._update_path_preview())
        self.path_var.trace('w', lambda *args: self._update_path_preview())
    
    def _browse_location(self):
        """Browse for project location"""
        directory = filedialog.askdirectory(
            title="Select Project Location",
            initialdir=self.path_var.get()
        )
        if directory:
            self.path_var.set(directory)
    
    def _update_path_preview(self):
        """Update full path preview"""
        if hasattr(self, 'full_path_label'):
            name = sanitize_project_name(self.name_var.get())
            if name:
                full_path = Path(self.path_var.get()) / name
                self.full_path_label.config(text=str(full_path))
            else:
                self.full_path_label.config(text="Enter a project name")
    
    def _create_template_config(self, parent):
        """Create template configuration step"""
        template = self.wizard_data['template']
        if not template or not template.config.variables:
            # No configuration needed
            label = ttk.Label(
                parent,
                text="This template has no configuration options.",
                font=('Arial', 11)
            )
            label.pack(pady=50)
            return
        
        # Instructions
        instructions = ttk.Label(
            parent,
            text="Configure template options:",
            font=('Arial', 11)
        )
        instructions.pack(pady=(0, 20))
        
        # Scrollable form
        canvas = tk.Canvas(parent, highlightthickness=0)
        scrollbar = ttk.Scrollbar(parent, orient='vertical', command=canvas.yview)
        form_frame = ttk.Frame(canvas)
        
        form_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
        )
        
        canvas.create_window((0, 0), window=form_frame, anchor='nw')
        canvas.configure(yscrollcommand=scrollbar.set)
        
        # Create form fields
        self.config_vars = {}
        
        for var_config in template.config.variables:
            self._create_config_field(form_frame, var_config)
        
        canvas.pack(side='left', fill='both', expand=True)
        scrollbar.pack(side='right', fill='y')
    
    def _create_config_field(self, parent, var_config: Dict[str, Any]):
        """Create a configuration field"""
        field_frame = ttk.Frame(parent)
        field_frame.pack(fill='x', pady=10, padx=20)
        
        # Label
        label_text = var_config.get('label', var_config['name'])
        ttk.Label(field_frame, text=f"{label_text}:", width=20).pack(side='left', anchor='w')
        
        var_name = var_config['name']
        var_type = var_config.get('type', 'string')
        
        if var_type == 'boolean':
            # Checkbox
            var = tk.BooleanVar(value=var_config.get('default', False))
            widget = ttk.Checkbutton(field_frame, variable=var)
            widget.pack(side='left')
            
        elif var_type == 'choice':
            # Dropdown
            var = tk.StringVar(value=var_config.get('default', ''))
            widget = ttk.Combobox(
                field_frame,
                textvariable=var,
                values=var_config.get('choices', []),
                state='readonly',
                width=30
            )
            widget.pack(side='left')
            
        else:
            # Text entry
            var = tk.StringVar(value=var_config.get('default', ''))
            widget = ttk.Entry(field_frame, textvariable=var, width=40)
            widget.pack(side='left')
        
        self.config_vars[var_name] = var
        
        # Description
        if 'description' in var_config:
            desc_label = ttk.Label(
                field_frame,
                text=var_config['description'],
                font=('Arial', 9),
                foreground='gray'
            )
            desc_label.pack(side='left', padx=(10, 0))
    
    def _create_review(self, parent):
        """Create review step"""
        # Title
        title = ttk.Label(
            parent,
            text="Review Your Project",
            font=('Arial', 14, 'bold')
        )
        title.pack(pady=(0, 20))
        
        # Review frame
        review_frame = ttk.Frame(parent)
        review_frame.pack(fill='both', expand=True)
        
        # Template info
        template_frame = ttk.LabelFrame(review_frame, text="Template")
        template_frame.pack(fill='x', pady=5)
        
        template = self.wizard_data['template']
        template_info = f"{template.config.icon} {template.config.name}\n{template.config.description}"
        ttk.Label(template_frame, text=template_info).pack(padx=10, pady=10)
        
        # Project info
        project_frame = ttk.LabelFrame(review_frame, text="Project Details")
        project_frame.pack(fill='x', pady=5)
        
        project_name = sanitize_project_name(self.name_var.get())
        project_path = Path(self.path_var.get()) / project_name
        
        details_text = f"Name: {project_name}\nLocation: {project_path}"
        ttk.Label(project_frame, text=details_text, font=('Consolas', 10)).pack(padx=10, pady=10)
        
        # Configuration
        if hasattr(self, 'config_vars') and self.config_vars:
            config_frame = ttk.LabelFrame(review_frame, text="Configuration")
            config_frame.pack(fill='x', pady=5)
            
            config_text = ""
            for name, var in self.config_vars.items():
                config_text += f"{name}: {var.get()}\n"
            
            ttk.Label(config_frame, text=config_text.strip(), font=('Consolas', 10)).pack(padx=10, pady=10)
        
        # Actions that will be performed
        actions_frame = ttk.LabelFrame(review_frame, text="Actions")
        actions_frame.pack(fill='x', pady=5)
        
        actions = [
            f"✓ Create project directory: {project_path}",
            f"✓ Generate {len(template.files)} files",
            f"✓ Create {len(template.directories)} directories"
        ]
        
        if template.config.dependencies:
            for pkg_manager, deps in template.config.dependencies.items():
                actions.append(f"✓ Install {len(deps)} {pkg_manager} dependencies")
        
        if template.config.post_create_commands:
            actions.append(f"✓ Run {len(template.config.post_create_commands)} setup commands")
        
        actions_text = "\n".join(actions)
        ttk.Label(actions_frame, text=actions_text).pack(padx=10, pady=10)
        
        # Enable finish button
        self.finish_btn.config(state='normal')
    
    def _go_back(self):
        """Go to previous step"""
        if self.current_step > 0:
            self._show_step(self.current_step - 1)
    
    def _go_next(self):
        """Go to next step"""
        # Validate current step
        if self.current_step == 0:
            if not self.wizard_data['template']:
                messagebox.showwarning("No Template", "Please select a template")
                return
                
        elif self.current_step == 1:
            # Validate project details
            name = self.name_var.get().strip()
            if not name:
                messagebox.showwarning("Invalid Name", "Please enter a project name")
                return
            
            is_valid, error = validate_input('project_name', name)
            if not is_valid:
                messagebox.showerror("Invalid Name", error)
                return
            
            # Check if directory exists
            project_path = Path(self.path_var.get()) / sanitize_project_name(name)
            if project_path.exists():
                if not messagebox.askyesno(
                    "Directory Exists",
                    f"Directory '{project_path}' already exists. Continue anyway?"
                ):
                    return
            
            # Save data
            self.wizard_data['project_name'] = sanitize_project_name(name)
            self.wizard_data['project_path'] = str(Path(self.path_var.get()))
        
        elif self.current_step == 2:
            # Save configuration
            if hasattr(self, 'config_vars'):
                for name, var in self.config_vars.items():
                    self.wizard_data['variables'][name] = var.get()
        
        # Go to next step
        if self.current_step < len(self.steps) - 1:
            self._show_step(self.current_step + 1)
    
    def _finish(self):
        """Create the project"""
        # Disable buttons
        self.finish_btn.config(state='disabled', text="Creating...")
        self.back_btn.config(state='disabled')
        self.cancel_btn.config(state='disabled')
        
        # Create project in background
        threading.Thread(target=self._create_project, daemon=True).start()
    
    def _create_project(self):
        """Create project in background"""
        try:
            template = self.wizard_data['template']
            project_name = self.wizard_data['project_name']
            project_path = Path(self.wizard_data['project_path']) / project_name
            
            # Add standard variables
            variables = {
                'project_name': project_name,
                'description': f"Created with ALFRED using {template.config.name} template",
                'author': os.getenv('USER', 'developer'),
                **self.wizard_data.get('variables', {})
            }
            
            # Create project
            self.engine.create_project(
                template_id=template.config.name.lower().replace(' ', '-'),
                project_path=project_path,
                variables=variables
            )
            
            # Success - close wizard
            self.window.after(0, self._on_success, project_path)
            
        except Exception as e:
            # Error - show message
            self.window.after(0, self._on_error, str(e))
    
    def _on_success(self, project_path: Path):
        """Handle successful project creation"""
        messagebox.showinfo(
            "Success",
            f"Project created successfully at:\n{project_path}"
        )
        
        # Call completion callback
        if self.on_complete:
            self.on_complete(str(project_path))
        
        # Close wizard
        self.window.destroy()
    
    def _on_error(self, error: str):
        """Handle project creation error"""
        messagebox.showerror("Error", f"Failed to create project:\n{error}")
        
        # Re-enable buttons
        self.finish_btn.config(state='normal', text="Create Project")
        self.back_btn.config(state='normal')
        self.cancel_btn.config(state='normal')
    
    def _cancel(self):
        """Cancel wizard"""
        self.window.destroy()
    
    def _on_search_changed(self, *args):
        """Handle search text change"""
        query = self.search_var.get()
        if not query:
            # Show all templates
            self._show_step(self.current_step)
            return
        
        # Search templates
        results = self.registry.search_templates(query)
        
        # Update display
        # This is simplified - in a real implementation we'd update the existing lists
        pass


@dataclass
class WizardStep:
    """Represents a wizard step"""
    title: str
    create_func: Callable


class TemplateCustomizer:
    """UI for customizing templates"""
    
    def __init__(self, parent: tk.Tk, template: Optional[ProjectTemplate] = None):
        self.parent = parent
        self.template = template or self._create_blank_template()
        
        self.window = tk.Toplevel(parent)
        self.window.title("Template Customizer - ALFRED")
        self.window.geometry("900x700")
        
        self._create_ui()
    
    def _create_blank_template(self) -> ProjectTemplate:
        """Create a blank template"""
        config = TemplateConfig(
            name="Custom Template",
            category="Custom",
            description="A custom project template",
            author=os.getenv('USER', 'developer')
        )
        return ProjectTemplate(config=config, files=[], directories=[])
    
    def _create_ui(self):
        """Create customizer UI"""
        # Main container with notebook
        notebook = ttk.Notebook(self.window)
        notebook.pack(fill='both', expand=True, padx=10, pady=10)
        
        # General tab
        general_frame = ttk.Frame(notebook)
        notebook.add(general_frame, text="General")
        self._create_general_tab(general_frame)
        
        # Files tab
        files_frame = ttk.Frame(notebook)
        notebook.add(files_frame, text="Files")
        self._create_files_tab(files_frame)
        
        # Variables tab
        vars_frame = ttk.Frame(notebook)
        notebook.add(vars_frame, text="Variables")
        self._create_variables_tab(vars_frame)
        
        # Dependencies tab
        deps_frame = ttk.Frame(notebook)
        notebook.add(deps_frame, text="Dependencies")
        self._create_dependencies_tab(deps_frame)
        
        # Preview tab
        preview_frame = ttk.Frame(notebook)
        notebook.add(preview_frame, text="Preview")
        self._create_preview_tab(preview_frame)
        
        # Bottom buttons
        button_frame = ttk.Frame(self.window)
        button_frame.pack(fill='x', padx=10, pady=(0, 10))
        
        ttk.Button(
            button_frame,
            text="Save Template",
            command=self._save_template
        ).pack(side='right', padx=5)
        
        ttk.Button(
            button_frame,
            text="Export",
            command=self._export_template
        ).pack(side='right')
    
    def _create_general_tab(self, parent):
        """Create general settings tab"""
        # Form fields
        form_frame = ttk.Frame(parent)
        form_frame.pack(fill='x', padx=20, pady=20)
        
        # Name
        ttk.Label(form_frame, text="Template Name:").grid(row=0, column=0, sticky='w', pady=5)
        self.name_var = tk.StringVar(value=self.template.config.name)
        ttk.Entry(form_frame, textvariable=self.name_var, width=40).grid(row=0, column=1, pady=5)
        
        # Category
        ttk.Label(form_frame, text="Category:").grid(row=1, column=0, sticky='w', pady=5)
        self.category_var = tk.StringVar(value=self.template.config.category)
        category_combo = ttk.Combobox(
            form_frame,
            textvariable=self.category_var,
            values=["Web Development", "Data Science", "Command Line", "Backend", "Documentation", "Custom"],
            width=37
        )
        category_combo.grid(row=1, column=1, pady=5)
        
        # Description
        ttk.Label(form_frame, text="Description:").grid(row=2, column=0, sticky='nw', pady=5)
        self.desc_text = tk.Text(form_frame, width=40, height=4)
        self.desc_text.grid(row=2, column=1, pady=5)
        self.desc_text.insert('1.0', self.template.config.description)
        
        # Icon
        ttk.Label(form_frame, text="Icon (emoji):").grid(row=3, column=0, sticky='w', pady=5)
        self.icon_var = tk.StringVar(value=self.template.config.icon)
        ttk.Entry(form_frame, textvariable=self.icon_var, width=10).grid(row=3, column=1, sticky='w', pady=5)
        
        # Tags
        ttk.Label(form_frame, text="Tags:").grid(row=4, column=0, sticky='w', pady=5)
        self.tags_var = tk.StringVar(value=", ".join(self.template.config.tags))
        ttk.Entry(form_frame, textvariable=self.tags_var, width=40).grid(row=4, column=1, pady=5)
        
        # Configure column weights
        form_frame.columnconfigure(1, weight=1)
    
    def _create_files_tab(self, parent):
        """Create files management tab"""
        # Toolbar
        toolbar = ttk.Frame(parent)
        toolbar.pack(fill='x', padx=10, pady=10)
        
        ttk.Button(toolbar, text="Add File", command=self._add_file).pack(side='left', padx=2)
        ttk.Button(toolbar, text="Add Directory", command=self._add_directory).pack(side='left', padx=2)
        ttk.Button(toolbar, text="Remove", command=self._remove_item).pack(side='left', padx=2)
        
        # Tree view
        tree_frame = ttk.Frame(parent)
        tree_frame.pack(fill='both', expand=True, padx=10)
        
        self.files_tree = ttk.Treeview(tree_frame, columns=('type', 'size'), height=15)
        self.files_tree.heading('#0', text='Path')
        self.files_tree.heading('type', text='Type')
        self.files_tree.heading('size', text='Size')
        
        self.files_tree.column('#0', width=400)
        self.files_tree.column('type', width=100)
        self.files_tree.column('size', width=100)
        
        # Scrollbar
        scrollbar = ttk.Scrollbar(tree_frame, orient='vertical', command=self.files_tree.yview)
        self.files_tree.configure(yscrollcommand=scrollbar.set)
        
        self.files_tree.pack(side='left', fill='both', expand=True)
        scrollbar.pack(side='right', fill='y')
        
        # Load existing files
        self._load_files_tree()
        
        # Bind double-click to edit
        self.files_tree.bind('<Double-1>', self._edit_file)
    
    def _create_variables_tab(self, parent):
        """Create variables configuration tab"""
        # Instructions
        instructions = ttk.Label(
            parent,
            text="Define variables that users can customize when creating projects:",
            font=('Arial', 10)
        )
        instructions.pack(pady=10)
        
        # Variables list
        list_frame = ttk.Frame(parent)
        list_frame.pack(fill='both', expand=True, padx=20)
        
        # Toolbar
        toolbar = ttk.Frame(list_frame)
        toolbar.pack(fill='x', pady=(0, 10))
        
        ttk.Button(toolbar, text="Add Variable", command=self._add_variable).pack(side='left', padx=2)
        ttk.Button(toolbar, text="Edit", command=self._edit_variable).pack(side='left', padx=2)
        ttk.Button(toolbar, text="Remove", command=self._remove_variable).pack(side='left', padx=2)
        
        # List
        self.vars_listbox = tk.Listbox(list_frame, height=15)
        self.vars_listbox.pack(fill='both', expand=True)
        
        # Load existing variables
        for var in self.template.config.variables:
            self.vars_listbox.insert('end', f"{var['name']} ({var.get('type', 'string')})")
    
    def _create_dependencies_tab(self, parent):
        """Create dependencies configuration tab"""
        # Package managers
        notebook = ttk.Notebook(parent)
        notebook.pack(fill='both', expand=True, padx=20, pady=20)
        
        # Python/pip
        pip_frame = ttk.Frame(notebook)
        notebook.add(pip_frame, text="Python (pip)")
        self._create_dependency_list(pip_frame, "pip")
        
        # Node/npm
        npm_frame = ttk.Frame(notebook)
        notebook.add(npm_frame, text="Node.js (npm)")
        self._create_dependency_list(npm_frame, "npm")
        
        # Post-create commands
        cmd_frame = ttk.Frame(parent)
        cmd_frame.pack(fill='x', padx=20, pady=(10, 20))
        
        ttk.Label(cmd_frame, text="Post-create commands:").pack(anchor='w')
        
        self.commands_text = tk.Text(cmd_frame, height=4)
        self.commands_text.pack(fill='x', pady=5)
        
        if self.template.config.post_create_commands:
            self.commands_text.insert('1.0', '\n'.join(self.template.config.post_create_commands))
    
    def _create_dependency_list(self, parent, package_manager: str):
        """Create dependency list for a package manager"""
        # Entry for adding
        add_frame = ttk.Frame(parent)
        add_frame.pack(fill='x', pady=10)
        
        entry_var = tk.StringVar()
        entry = ttk.Entry(add_frame, textvariable=entry_var, width=30)
        entry.pack(side='left', padx=(0, 5))
        
        listbox = tk.Listbox(parent, height=10)
        
        def add_dep():
            dep = entry_var.get().strip()
            if dep:
                listbox.insert('end', dep)
                entry_var.set('')
        
        ttk.Button(add_frame, text="Add", command=add_dep).pack(side='left')
        
        # List
        listbox.pack(fill='both', expand=True, pady=(10, 0))
        
        # Load existing
        if package_manager in self.template.config.dependencies:
            for dep in self.template.config.dependencies[package_manager]:
                listbox.insert('end', dep)
        
        # Store reference
        setattr(self, f"{package_manager}_listbox", listbox)
    
    def _create_preview_tab(self, parent):
        """Create template preview tab"""
        # Preview text
        self.preview_text = tk.Text(parent, wrap='none')
        self.preview_text.pack(fill='both', expand=True, padx=20, pady=20)
        
        # Scrollbars
        v_scroll = ttk.Scrollbar(parent, orient='vertical', command=self.preview_text.yview)
        h_scroll = ttk.Scrollbar(parent, orient='horizontal', command=self.preview_text.xview)
        
        self.preview_text.configure(yscrollcommand=v_scroll.set, xscrollcommand=h_scroll.set)
        
        v_scroll.pack(side='right', fill='y')
        h_scroll.pack(side='bottom', fill='x')
        
        # Update button
        ttk.Button(
            parent,
            text="Update Preview",
            command=self._update_preview
        ).pack(pady=10)
        
        # Initial preview
        self._update_preview()
    
    def _load_files_tree(self):
        """Load files into tree view"""
        # Clear tree
        for item in self.files_tree.get_children():
            self.files_tree.delete(item)
        
        # Add directories
        for directory in self.template.directories:
            self.files_tree.insert('', 'end', text=directory, values=('Directory', '-'))
        
        # Add files
        for file in self.template.files:
            size = len(file.content) if not file.binary else '-'
            self.files_tree.insert('', 'end', text=file.path, values=('File', size))
    
    def _add_file(self):
        """Add a new file to template"""
        # Simple dialog for file path
        dialog = tk.Toplevel(self.window)
        dialog.title("Add File")
        dialog.geometry("500x400")
        
        # Path
        ttk.Label(dialog, text="File Path:").grid(row=0, column=0, sticky='w', padx=10, pady=10)
        path_var = tk.StringVar()
        ttk.Entry(dialog, textvariable=path_var, width=40).grid(row=0, column=1, padx=10, pady=10)
        
        # Content
        ttk.Label(dialog, text="Content:").grid(row=1, column=0, sticky='nw', padx=10, pady=10)
        content_text = tk.Text(dialog, width=50, height=15)
        content_text.grid(row=1, column=1, padx=10, pady=10)
        
        def save_file():
            path = path_var.get().strip()
            content = content_text.get('1.0', 'end-1c')
            
            if path:
                file = TemplateFile(path=path, content=content)
                self.template.files.append(file)
                self._load_files_tree()
                dialog.destroy()
        
        ttk.Button(dialog, text="Add", command=save_file).grid(row=2, column=1, pady=10)
    
    def _add_directory(self):
        """Add a directory to template"""
        # Simple input dialog
        from tkinter import simpledialog
        directory = simpledialog.askstring("Add Directory", "Directory path:")
        
        if directory:
            self.template.directories.append(directory)
            self._load_files_tree()
    
    def _remove_item(self):
        """Remove selected item"""
        selection = self.files_tree.selection()
        if not selection:
            return
        
        item = self.files_tree.item(selection[0])
        path = item['text']
        item_type = item['values'][0]
        
        if item_type == 'Directory':
            if path in self.template.directories:
                self.template.directories.remove(path)
        else:
            # Remove file
            self.template.files = [f for f in self.template.files if f.path != path]
        
        self._load_files_tree()
    
    def _edit_file(self, event):
        """Edit selected file"""
        selection = self.files_tree.selection()
        if not selection:
            return
        
        item = self.files_tree.item(selection[0])
        if item['values'][0] != 'File':
            return
        
        # Find file
        path = item['text']
        file = next((f for f in self.template.files if f.path == path), None)
        
        if file:
            # Edit dialog (simplified)
            self._add_file()  # Reuse add dialog for now
    
    def _add_variable(self):
        """Add a new variable"""
        # Variable dialog
        dialog = tk.Toplevel(self.window)
        dialog.title("Add Variable")
        dialog.geometry("400x300")
        
        # Form
        ttk.Label(dialog, text="Name:").grid(row=0, column=0, sticky='w', padx=10, pady=5)
        name_var = tk.StringVar()
        ttk.Entry(dialog, textvariable=name_var).grid(row=0, column=1, padx=10, pady=5)
        
        ttk.Label(dialog, text="Type:").grid(row=1, column=0, sticky='w', padx=10, pady=5)
        type_var = tk.StringVar(value="string")
        ttk.Combobox(
            dialog,
            textvariable=type_var,
            values=["string", "boolean", "choice"],
            state='readonly'
        ).grid(row=1, column=1, padx=10, pady=5)
        
        ttk.Label(dialog, text="Label:").grid(row=2, column=0, sticky='w', padx=10, pady=5)
        label_var = tk.StringVar()
        ttk.Entry(dialog, textvariable=label_var).grid(row=2, column=1, padx=10, pady=5)
        
        ttk.Label(dialog, text="Default:").grid(row=3, column=0, sticky='w', padx=10, pady=5)
        default_var = tk.StringVar()
        ttk.Entry(dialog, textvariable=default_var).grid(row=3, column=1, padx=10, pady=5)
        
        def save_var():
            var_config = {
                'name': name_var.get(),
                'type': type_var.get(),
                'label': label_var.get(),
                'default': default_var.get()
            }
            
            if var_config['name']:
                self.template.config.variables.append(var_config)
                self.vars_listbox.insert('end', f"{var_config['name']} ({var_config['type']})")
                dialog.destroy()
        
        ttk.Button(dialog, text="Add", command=save_var).grid(row=4, column=1, pady=20)
    
    def _edit_variable(self):
        """Edit selected variable"""
        # TODO: Implement variable editing
        pass
    
    def _remove_variable(self):
        """Remove selected variable"""
        selection = self.vars_listbox.curselection()
        if selection:
            index = selection[0]
            self.vars_listbox.delete(index)
            del self.template.config.variables[index]
    
    def _update_preview(self):
        """Update template preview"""
        # Generate preview JSON
        preview = {
            'config': {
                'name': self.name_var.get(),
                'category': self.category_var.get(),
                'description': self.desc_text.get('1.0', 'end-1c'),
                'icon': self.icon_var.get(),
                'tags': [t.strip() for t in self.tags_var.get().split(',') if t.strip()],
                'variables': self.template.config.variables,
                'dependencies': self._get_dependencies(),
                'post_create_commands': self._get_commands()
            },
            'files': [{'path': f.path, 'size': len(f.content)} for f in self.template.files],
            'directories': self.template.directories
        }
        
        # Display
        self.preview_text.delete('1.0', 'end')
        self.preview_text.insert('1.0', json.dumps(preview, indent=2))
    
    def _get_dependencies(self) -> Dict[str, List[str]]:
        """Get dependencies from UI"""
        deps = {}
        
        if hasattr(self, 'pip_listbox'):
            pip_deps = list(self.pip_listbox.get(0, 'end'))
            if pip_deps:
                deps['pip'] = pip_deps
        
        if hasattr(self, 'npm_listbox'):
            npm_deps = list(self.npm_listbox.get(0, 'end'))
            if npm_deps:
                deps['npm'] = npm_deps
        
        return deps
    
    def _get_commands(self) -> List[str]:
        """Get post-create commands"""
        commands = self.commands_text.get('1.0', 'end-1c').strip()
        if commands:
            return [cmd.strip() for cmd in commands.split('\n') if cmd.strip()]
        return []
    
    def _save_template(self):
        """Save the template"""
        # Update template from UI
        self.template.config.name = self.name_var.get()
        self.template.config.category = self.category_var.get()
        self.template.config.description = self.desc_text.get('1.0', 'end-1c')
        self.template.config.icon = self.icon_var.get()
        self.template.config.tags = [t.strip() for t in self.tags_var.get().split(',') if t.strip()]
        self.template.config.dependencies = self._get_dependencies()
        self.template.config.post_create_commands = self._get_commands()
        
        # Save to registry
        registry = TemplateRegistry()
        if registry.save_custom_template(self.template):
            messagebox.showinfo("Success", "Template saved successfully!")
        else:
            messagebox.showerror("Error", "Failed to save template")
    
    def _export_template(self):
        """Export template to file"""
        filename = filedialog.asksaveasfilename(
            title="Export Template",
            defaultextension=".json",
            filetypes=[("JSON files", "*.json"), ("All files", "*.*")]
        )
        
        if filename:
            try:
                data = {
                    'config': asdict(self.template.config),
                    'files': [asdict(f) for f in self.template.files],
                    'directories': self.template.directories
                }
                
                with open(filename, 'w') as f:
                    json.dump(data, f, indent=2)
                
                messagebox.showinfo("Success", f"Template exported to {filename}")
            except Exception as e:
                messagebox.showerror("Error", f"Failed to export: {e}")