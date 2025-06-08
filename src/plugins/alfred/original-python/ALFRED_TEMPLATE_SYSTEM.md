# ALFRED Project Templates System

## Overview

The ALFRED Project Templates System provides a comprehensive solution for creating new projects from predefined or custom templates. It includes an interactive wizard interface, built-in templates for common project types, and tools for creating custom templates.

## Features

### 1. **Template Registry** (`alfred_template_system.py`)

The core template management system with:

- **Built-in Templates** (10 included):
  - Python Web Application (Flask/FastAPI)
  - Python CLI Application
  - Python Data Science Project
  - Node.js Web Application
  - React Application
  - FastAPI Application
  - Flask Application
  - Machine Learning Project
  - Microservice (Docker-ready)
  - Documentation Site (MkDocs)

- **Template Structure**:
  ```python
  @dataclass
  class TemplateConfig:
      name: str
      category: str
      description: str
      icon: str  # Emoji icon
      variables: List[Dict]  # Customizable options
      dependencies: Dict[str, List[str]]  # Package dependencies
      post_create_commands: List[str]  # Setup commands
      required_tools: List[str]  # Required system tools
      tags: List[str]  # For searching
  ```

- **Template Engine**:
  - Variable substitution ({{ project_name }}, {{ author }}, etc.)
  - Directory structure creation
  - File generation with proper permissions
  - Dependency installation
  - Post-creation command execution

### 2. **Project Creation Wizard** (`alfred_template_wizard.py`)

Interactive 4-step wizard for creating projects:

#### Step 1: Template Selection
- Browse templates by category
- Search functionality
- Visual template cards with icons and descriptions
- Tag-based filtering

#### Step 2: Project Details
- Project name validation
- Location selection with file browser
- Full path preview
- Duplicate directory detection

#### Step 3: Template Configuration
- Dynamic form based on template variables
- Support for different input types:
  - Text fields
  - Boolean checkboxes
  - Choice dropdowns
- Default values and descriptions

#### Step 4: Review & Create
- Summary of all selections
- List of actions to be performed
- Background project creation
- Progress feedback

### 3. **Template Customizer**

Full-featured template editor with tabs:

- **General**: Name, category, description, icon, tags
- **Files**: Add/edit/remove template files
- **Variables**: Define customizable options
- **Dependencies**: Manage package dependencies
- **Preview**: JSON preview of template structure

Features:
- Visual file tree management
- Syntax highlighting for code files
- Variable configuration with types
- Export/import templates
- Save custom templates to registry

## Usage Examples

### Creating a Project with the Wizard

```python
from alfred_template_wizard import TemplateWizard
from alfred_template_system import TemplateRegistry

# Initialize registry
registry = TemplateRegistry()

# Open wizard
def on_project_created(project_path):
    print(f"Project created at: {project_path}")
    # Open project in ALFRED

wizard = TemplateWizard(
    parent=root,
    registry=registry,
    on_complete=on_project_created
)
```

### Creating a Project Programmatically

```python
from alfred_template_system import TemplateRegistry, TemplateEngine

# Initialize
registry = TemplateRegistry()
engine = TemplateEngine(registry)

# Create project
engine.create_project(
    template_id="python-fastapi",
    project_path=Path("~/Projects/my-api"),
    variables={
        "project_name": "My API",
        "author": "John Doe",
        "include_docker": True
    }
)
```

### Creating a Custom Template

```python
from alfred_template_system import ProjectTemplate, TemplateConfig, TemplateFile

# Define configuration
config = TemplateConfig(
    name="My Custom Template",
    category="Custom",
    description="A template for my projects",
    icon="🚀",
    variables=[
        {
            "name": "use_database",
            "type": "boolean",
            "label": "Include database setup",
            "default": True
        }
    ],
    dependencies={
        "pip": ["requests", "pydantic"]
    }
)

# Define files
files = [
    TemplateFile(
        path="main.py",
        content='''#!/usr/bin/env python3
"""{{ project_name }} - {{ description }}"""

def main():
    print("Hello from {{ project_name }}!")

if __name__ == "__main__":
    main()
'''
    ),
    TemplateFile(
        path="README.md",
        content='''# {{ project_name }}

Created by {{ author }} on {{ date }}
'''
    )
]

# Create template
template = ProjectTemplate(
    config=config,
    files=files,
    directories=["src", "tests", "docs"]
)

# Save to registry
registry.save_custom_template(template)
```

## Template Categories

Templates are organized into categories:

1. **Web Development**: Flask, FastAPI, Node.js, React
2. **Data Science**: Jupyter notebooks, ML projects
3. **Command Line**: CLI applications
4. **Backend**: Microservices, APIs
5. **Documentation**: MkDocs sites
6. **Custom**: User-created templates

## Variable System

Templates support various variable types:

```python
variables = [
    {
        "name": "database_type",
        "type": "choice",
        "label": "Database",
        "choices": ["sqlite", "postgresql", "mysql"],
        "default": "sqlite"
    },
    {
        "name": "include_tests",
        "type": "boolean",
        "label": "Include test suite",
        "default": True
    },
    {
        "name": "port",
        "type": "string",
        "label": "Server port",
        "default": "8000"
    }
]
```

## Built-in Variables

All templates have access to these variables:
- `{{ project_name }}` - Sanitized project name
- `{{ author }}` - Current user
- `{{ date }}` - Creation date
- `{{ year }}` - Current year
- `{{ description }}` - Project description

## Integration with ALFRED

To integrate with ALFRED's main UI:

```python
# In alfred.py, add to menu or toolbar:

def new_project_wizard(self):
    """Open new project wizard"""
    wizard = TemplateWizard(
        parent=self.root,
        registry=self.template_registry,
        on_complete=self.open_project_from_path
    )

def customize_template(self):
    """Open template customizer"""
    customizer = TemplateCustomizer(parent=self.root)
```

## Benefits

1. **Rapid Project Setup**: Create fully-configured projects in seconds
2. **Consistency**: Ensure all projects follow best practices
3. **Customization**: Tailor templates to specific needs
4. **Learning Tool**: Templates serve as examples of project structure
5. **Team Standards**: Share templates across teams
6. **Reduced Boilerplate**: Eliminate repetitive setup tasks

## Future Enhancements

1. **Online Template Gallery**: Download templates from community
2. **Template Inheritance**: Base templates on others
3. **Conditional Files**: Include files based on variables
4. **Template Testing**: Validate templates before use
5. **Version Control**: Track template changes
6. **AI-Generated Templates**: Use AI to create custom templates