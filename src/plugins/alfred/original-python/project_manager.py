"""
Enterprise Code Factory 9000 Pro - Project Manager Module
---------------------------------------------------------
Handles project creation, management, and organization with
enterprise-level features and robustness.

Author: Enhanced by Claude
Date: April 10, 2025
"""

import os
import json
import shutil
import logging
import datetime
import tempfile
import zipfile
import uuid
import sys
import re
import hashlib
from enum import Enum
from pathlib import Path
from typing import Dict, List, Optional, Union, Any, Set, Tuple
from dataclasses import dataclass, field, asdict
import concurrent.futures
from functools import lru_cache
import threading
from contextlib import contextmanager

# Set up module logger
logger = logging.getLogger(__name__)


class ProjectTemplate(Enum):
    """Available project templates"""
    BASIC = "basic"
    WEB = "web"
    API = "api"
    DATA_SCIENCE = "data_science"
    MICROSERVICE = "microservice"
    MOBILE = "mobile"
    LIBRARY = "library"
    CLI = "cli"
    
    @classmethod
    def from_string(cls, template_name: str) -> 'ProjectTemplate':
        """Get template enum from string name"""
        try:
            return cls(template_name.lower())
        except ValueError:
            logger.warning(f"Unknown template: {template_name}, using BASIC")
            return cls.BASIC
    
    @classmethod
    def get_description(cls, template: 'ProjectTemplate') -> str:
        """Get description for a template"""
        descriptions = {
            cls.BASIC: "Basic project structure with minimal setup",
            cls.WEB: "Web application with frontend/backend structure",
            cls.API: "RESTful API service with documentation",
            cls.DATA_SCIENCE: "Data science project with notebook support",
            cls.MICROSERVICE: "Microservice with Docker and CI/CD setup",
            cls.MOBILE: "Mobile application structure with native components",
            cls.LIBRARY: "Reusable library with package configuration",
            cls.CLI: "Command-line interface application"
        }
        return descriptions.get(template, "No description available")


@dataclass
class ProjectMetadata:
    """Structured project metadata"""
    name: str
    created: str = field(default_factory=lambda: datetime.datetime.now().isoformat())
    last_modified: str = field(default_factory=lambda: datetime.datetime.now().isoformat())
    template: str = "basic"
    description: str = ""
    tags: List[str] = field(default_factory=list)
    author: str = ""
    version: str = "0.1.0"
    dependencies: Dict[str, str] = field(default_factory=dict)
    ai_interactions: List[Dict[str, Any]] = field(default_factory=list)
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization"""
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ProjectMetadata':
        """Create instance from dictionary"""
        # Filter only the fields that exist in the dataclass
        valid_fields = {k: v for k, v in data.items() if k in cls.__annotations__}
        return cls(**valid_fields)


@dataclass
class AIInteraction:
    """Record of an AI interaction within a project"""
    prompt: str
    response: str
    timestamp: str = field(default_factory=lambda: datetime.datetime.now().isoformat())
    files_affected: List[str] = field(default_factory=list)
    session_id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    model: str = ""
    duration_ms: int = 0
    token_count: int = 0
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization"""
        return asdict(self)


class ProjectLock:
    """Thread-safe project locking mechanism"""
    
    def __init__(self):
        self._locks: Dict[str, threading.RLock] = {}
        self._global_lock = threading.RLock()
    
    def get_lock(self, project_path: Union[str, Path]) -> threading.RLock:
        """Get or create a lock for a specific project"""
        project_key = str(project_path)
        
        with self._global_lock:
            if project_key not in self._locks:
                self._locks[project_key] = threading.RLock()
            return self._locks[project_key]
    
    @contextmanager
    def locked_project(self, project_path: Union[str, Path]):
        """Context manager for safely locking a project during operations"""
        lock = self.get_lock(project_path)
        lock.acquire()
        try:
            yield
        finally:
            lock.release()


class ProjectManager:
    """
    Enhanced project management system with enterprise features
    for creating, tracking, and organizing AI-assisted projects.
    """
    
    # Project file patterns to ignore when scanning
    DEFAULT_IGNORE_PATTERNS = [
        r".*\.pyc$",
        r".*\.pyo$",
        r".*\.pyd$",
        r".*\.so$",
        r".*\.git.*",
        r".*__pycache__.*",
        r".*\.DS_Store$",
        r".*\.idea.*",
        r".*\.vscode.*",
        r".*\.vs.*",
        r".*node_modules.*",
        r".*\.env$",
        r".*\.env\..*"
    ]
    
    def __init__(self, projects_dir: Optional[Union[str, Path]] = None, 
                max_workers: int = 4):
        """
        Initialize the project manager
        
        Args:
            projects_dir: Base directory for projects (default: ~/ai_projects)
            max_workers: Maximum number of worker threads for operations
        """
        self.current_project: Optional[Path] = None
        self.projects_dir = Path(projects_dir) if projects_dir else Path.home() / "ai_projects"
        self.projects_dir.mkdir(exist_ok=True, parents=True)
        
        self._lock_manager = ProjectLock()
        self._executor = concurrent.futures.ThreadPoolExecutor(max_workers=max_workers)
        
        # Compile ignore patterns
        self._ignore_patterns = [re.compile(pattern) for pattern in self.DEFAULT_IGNORE_PATTERNS]
        
        # Cache for project metadata
        self._metadata_cache: Dict[str, ProjectMetadata] = {}
        
        logger.info(f"Project manager initialized with projects directory: {self.projects_dir}")
    
    def create_project(self, project_name: str, template: str = "basic", 
                    description: str = "", author: str = "",
                    tags: Optional[List[str]] = None) -> Path:
        """
        Create a new project with the specified template
        
        Args:
            project_name: Name of the project
            template: Template to use (one of ProjectTemplate enum values)
            description: Project description
            author: Project author name
            tags: List of tags for the project
            
        Returns:
            Path to the created project
        """
        # Sanitize project name
        safe_name = self._sanitize_project_name(project_name)
        if safe_name != project_name:
            logger.info(f"Project name sanitized from '{project_name}' to '{safe_name}'")
            project_name = safe_name
        
        project_path = self.projects_dir / project_name
        
        # Use the lock manager to ensure thread safety
        with self._lock_manager.locked_project(project_path):
            # Check if project already exists
            if project_path.exists():
                logger.warning(f"Project '{project_name}' already exists")
                
                # Create a unique name by appending a timestamp
                timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
                project_name = f"{project_name}_{timestamp}"
                project_path = self.projects_dir / project_name
                logger.info(f"Creating project with modified name: '{project_name}'")
                
            # Create the project directory
            project_path.mkdir(exist_ok=True, parents=True)
            
            # Parse template enum
            template_enum = ProjectTemplate.from_string(template)
            
            # Create project structure based on template
            self._create_project_structure(project_path, template_enum)
            
            # Initialize project metadata
            metadata = ProjectMetadata(
                name=project_name,
                template=template_enum.value,
                description=description,
                author=author,
                tags=tags or []
            )
            
            # Save metadata
            self._save_metadata(project_path, metadata)
            
            # Update current project
            self.current_project = project_path
            
            # Add to metadata cache
            self._metadata_cache[str(project_path)] = metadata
            
            logger.info(f"Created project: {project_name} with template: {template}")
            
            return project_path
    
    def _sanitize_project_name(self, name: str) -> str:
        """
        Sanitize project name to be safe for filesystem
        
        Args:
            name: Original project name
            
        Returns:
            Sanitized name
        """
        # Replace spaces with underscores
        name = name.replace(" ", "_")
        
        # Remove any characters that aren't alphanumeric, underscore, or hyphen
        name = re.sub(r"[^a-zA-Z0-9_\-]", "", name)
        
        # Ensure first character is a letter or underscore
        if name and not (name[0].isalpha() or name[0] == "_"):
            name = f"project_{name}"
            
        return name
    
    def _create_project_structure(self, project_path: Path, template: ProjectTemplate) -> None:
        """
        Create the directory structure for a project based on template
        
        Args:
            project_path: Path to the project
            template: Template to use for structure
        """
        # Common directories for all projects
        common_dirs = ["src", "tests", "docs", "config", "logs"]
        for d in common_dirs:
            (project_path / d).mkdir(exist_ok=True)
            
        # Add README file
        with open(project_path / "README.md", "w") as f:
            f.write(f"# {project_path.name}\n\n")
            f.write(f"{ProjectTemplate.get_description(template)}\n\n")
            f.write(f"Created on: {datetime.datetime.now().strftime('%Y-%m-%d')}\n")
        
        # Add .gitignore
        with open(project_path / ".gitignore", "w") as f:
            f.write("# Python\n")
            f.write("__pycache__/\n*.py[cod]\n*$py.class\n")
            f.write("*.so\n.Python\nenv/\nvenv/\nENV/\n")
            f.write("# Logs\nlogs/\n*.log\n")
            f.write("# OS specific\n.DS_Store\nThumbs.db\n")
        
        # Template-specific structure
        if template == ProjectTemplate.WEB:
            (project_path / "src" / "frontend").mkdir(exist_ok=True)
            (project_path / "src" / "backend").mkdir(exist_ok=True)
            (project_path / "src" / "static").mkdir(exist_ok=True)
            (project_path / "src" / "templates").mkdir(exist_ok=True)
            
            # Add basic HTML template
            with open(project_path / "src" / "templates" / "index.html", "w") as f:
                f.write('<!DOCTYPE html>\n<html>\n<head>\n    <title>Web Project</title>\n')
                f.write('    <link rel="stylesheet" href="../static/style.css">\n')
                f.write('</head>\n<body>\n    <h1>Web Project</h1>\n')
                f.write('    <script src="../static/main.js"></script>\n')
                f.write('</body>\n</html>\n')
                
            # Add CSS and JS files
            with open(project_path / "src" / "static" / "style.css", "w") as f:
                f.write("body {\n    font-family: Arial, sans-serif;\n}\n")
                
            with open(project_path / "src" / "static" / "main.js", "w") as f:
                f.write("console.log('Web project initialized');\n")
        
        elif template == ProjectTemplate.API:
            (project_path / "src" / "api").mkdir(exist_ok=True)
            (project_path / "src" / "models").mkdir(exist_ok=True)
            (project_path / "src" / "schemas").mkdir(exist_ok=True)
            (project_path / "docs" / "api").mkdir(exist_ok=True)
            
            # Add API documentation template
            with open(project_path / "docs" / "api" / "openapi.yaml", "w") as f:
                f.write("openapi: 3.0.0\ninfo:\n  title: API Project\n")
                f.write(f"  version: 0.1.0\n  description: API for {project_path.name}\n")
                f.write("paths:\n  /api/v1/health:\n    get:\n")
                f.write("      summary: Health check endpoint\n")
                f.write("      responses:\n        '200':\n")
                f.write("          description: Service is healthy\n")
        
        elif template == ProjectTemplate.DATA_SCIENCE:
            (project_path / "notebooks").mkdir(exist_ok=True)
            (project_path / "data").mkdir(exist_ok=True)
            (project_path / "data" / "raw").mkdir(exist_ok=True)
            (project_path / "data" / "processed").mkdir(exist_ok=True)
            (project_path / "models").mkdir(exist_ok=True)
            (project_path / "src" / "features").mkdir(exist_ok=True)
            (project_path / "src" / "visualization").mkdir(exist_ok=True)
            
            # Add requirements.txt with common data science packages
            with open(project_path / "requirements.txt", "w") as f:
                f.write("numpy\npandas\nscikit-learn\nmatplotlib\nseaborn\njupyter\n")
                
            # Add example notebook
            with open(project_path / "notebooks" / "exploration.ipynb", "w") as f:
                f.write('{\n "cells": [\n  {\n   "cell_type": "markdown",\n')
                f.write('   "metadata": {},\n   "source": ["# Data Exploration"]\n  },\n')
                f.write('  {\n   "cell_type": "code",\n   "execution_count": null,\n')
                f.write('   "metadata": {},\n   "outputs": [],\n')
                f.write('   "source": ["import numpy as np\\nimport pandas as pd\\n"]\n  }\n ],\n')
                f.write(' "metadata": {\n  "kernelspec": {\n   "display_name": "Python 3",\n')
                f.write('   "language": "python",\n   "name": "python3"\n  }\n },\n')
                f.write(' "nbformat": 4,\n "nbformat_minor": 4\n}\n')
        
        elif template == ProjectTemplate.MICROSERVICE:
            (project_path / "src" / "api").mkdir(exist_ok=True)
            (project_path / "src" / "services").mkdir(exist_ok=True)
            (project_path / "src" / "models").mkdir(exist_ok=True)
            (project_path / "deploy").mkdir(exist_ok=True)
            
            # Add Dockerfile
            with open(project_path / "Dockerfile", "w") as f:
                f.write("FROM python:3.9-slim\n\n")
                f.write("WORKDIR /app\n\n")
                f.write("COPY requirements.txt .\n")
                f.write("RUN pip install --no-cache-dir -r requirements.txt\n\n")
                f.write("COPY . .\n\n")
                f.write("EXPOSE 8000\n\n")
                f.write('CMD ["python", "src/main.py"]\n')
                
            # Add docker-compose.yml
            with open(project_path / "docker-compose.yml", "w") as f:
                f.write("version: '3'\n\nservices:\n")
                f.write(f"  {project_path.name.lower()}:\n")
                f.write("    build: .\n")
                f.write("    ports:\n      - \"8000:8000\"\n")
                f.write("    environment:\n      - ENV=development\n")
        
        elif template == ProjectTemplate.MOBILE:
            (project_path / "src" / "screens").mkdir(exist_ok=True)
            (project_path / "src" / "components").mkdir(exist_ok=True)
            (project_path / "src" / "navigation").mkdir(exist_ok=True)
            (project_path / "src" / "assets").mkdir(exist_ok=True)
            (project_path / "src" / "services").mkdir(exist_ok=True)
        
        elif template == ProjectTemplate.LIBRARY:
            package_name = project_path.name.lower().replace("-", "_")
            package_dir = project_path / "src" / package_name
            package_dir.mkdir(exist_ok=True, parents=True)
            
            # Add __init__.py
            with open(package_dir / "__init__.py", "w") as f:
                f.write(f'"""Core package for {project_path.name}."""\n\n')
                f.write('__version__ = "0.1.0"\n')
                
            # Add setup.py
            with open(project_path / "setup.py", "w") as f:
                f.write("from setuptools import setup, find_packages\n\n")
                f.write("setup(\n")
                f.write(f"    name=\"{project_path.name}\",\n")
                f.write('    version="0.1.0",\n')
                f.write(f"    description=\"{ProjectTemplate.get_description(template)}\",\n")
                f.write("    packages=find_packages(where=\"src\"),\n")
                f.write("    package_dir={\"\":\"src\"},\n")
                f.write("    python_requires=\">=3.7\",\n")
                f.write(")\n")
        
        elif template == ProjectTemplate.CLI:
            (project_path / "src" / "commands").mkdir(exist_ok=True)
            (project_path / "src" / "utils").mkdir(exist_ok=True)
            
            # Add a basic CLI module
            with open(project_path / "src" / "cli.py", "w") as f:
                f.write('"""Command-line interface for the project."""\n\n')
                f.write("import argparse\n\n")
                f.write("def main():\n")
                f.write('    """Main entry point for the CLI."""\n')
                f.write("    parser = argparse.ArgumentParser(description=\"CLI tool\")\n")
                f.write('    parser.add_argument("--version", action="store_true", help="Show version")\n')
                f.write("    args = parser.parse_args()\n\n")
                f.write("    if args.version:\n")
                f.write('        print("v0.1.0")\n')
                f.write("    else:\n")
                f.write('        print("Welcome to the CLI tool")\n\n')
                f.write('if __name__ == "__main__":\n')
                f.write("    main()\n")
    
    def open_project(self, project_path: Union[str, Path]) -> Optional[Path]:
        """
        Open an existing project
        
        Args:
            project_path: Path to the project
            
        Returns:
            Path to the opened project or None if not found
        """
        path = Path(project_path)
        
        # Check if it's a relative path within projects_dir
        if not path.is_absolute():
            path = self.projects_dir / path
        
        if not path.exists():
            logger.error(f"Project path does not exist: {path}")
            return None
        
        # Check if it has a metadata file to confirm it's a valid project
        if not (path / "project_meta.json").exists():
            logger.warning(f"Project at {path} does not have metadata file")
        
        self.current_project = path
        logger.info(f"Opened project: {path}")
        
        # Load metadata into cache
        self._load_metadata(path)
        
        return path
    
    def list_projects(self) -> List[Dict[str, Any]]:
        """
        List all projects in the projects directory with metadata
        
        Returns:
            List of project info dictionaries
        """
        projects = []
        
        # Check if projects directory exists
        if not self.projects_dir.exists():
            logger.warning(f"Projects directory does not exist: {self.projects_dir}")
            return projects
        
        # Iterate over subdirectories
        for item in self.projects_dir.iterdir():
            if item.is_dir() and (item / "project_meta.json").exists():
                metadata = self._load_metadata(item)
                
                # Get last modified time
                try:
                    last_modified = max(
                        f.stat().st_mtime for f in item.rglob("*") if f.is_file()
                    )
                    last_modified_date = datetime.datetime.fromtimestamp(last_modified).isoformat()
                except (ValueError, OSError):
                    last_modified_date = metadata.last_modified
                
                # Count files
                try:
                    file_count = sum(1 for _ in item.rglob("*") if _.is_file())
                except (ValueError, OSError):
                    file_count = 0
                
                projects.append({
                    "name": metadata.name,
                    "path": str(item),
                    "template": metadata.template,
                    "description": metadata.description,
                    "created": metadata.created,
                    "last_modified": last_modified_date,
                    "tags": metadata.tags,
                    "file_count": file_count
                })
        
        # Sort by last modified (most recent first)
        projects.sort(key=lambda p: p["last_modified"], reverse=True)
        
        return projects
    
    def search_projects(self, query: str, tags: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        """
        Search projects by name, description, or tags
        
        Args:
            query: Search term
            tags: Optional tags to filter by
            
        Returns:
            List of matching project info dictionaries
        """
        projects = self.list_projects()
        
        if not query and not tags:
            return projects
        
        filtered_projects = []
        query = query.lower()
        
        for project in projects:
            # Check for query match in name or description
            name_match = query in project["name"].lower()
            desc_match = query in project["description"].lower()
            
            # Check for tag match if tags are specified
            tag_match = True
            if tags:
                project_tags = [t.lower() for t in project.get("tags", [])]
                tag_match = all(t.lower() in project_tags for t in tags)
            
            if (name_match or desc_match) and tag_match:
                filtered_projects.append(project)
        
        return filtered_projects
    
    def get_project_structure(self, include_hidden: bool = False) -> List[str]:
        """
        Get formatted project structure
        
        Args:
            include_hidden: Whether to include hidden files/dirs
            
        Returns:
            List of formatted strings representing the structure
        """
        if not self.current_project:
            logger.warning("No project is currently open")
            return []
        
        structure = []
        
        try:
            for root, dirs, files in os.walk(self.current_project):
                # Skip hidden files/directories if not requested
                if not include_hidden:
                    dirs[:] = [d for d in dirs if not d.startswith('.')]
                    files = [f for f in files if not f.startswith('.')]
                
                # Skip ignored patterns
                if any(pattern.match(root) for pattern in self._ignore_patterns):
                    continue
                
                level = root.replace(str(self.current_project), '').count(os.sep)
                indent = ' ' * 4 * level
                structure.append(f"{indent}{os.path.basename(root)}/")
                
                subindent = ' ' * 4 * (level + 1)
                
                # Filter files by ignore patterns
                visible_files = []
                for f in files:
                    full_path = os.path.join(root, f)
                    if not any(pattern.match(full_path) for pattern in self._ignore_patterns):
                        visible_files.append(f)
                
                # Sort files alphabetically
                for f in sorted(visible_files):
                    structure.append(f"{subindent}{f}")
        except Exception as e:
            logger.error(f"Error getting project structure: {str(e)}")
        
        return structure
    
    def get_project_files(self, extension: Optional[str] = None) -> List[Path]:
        """
        Get all files in the project, optionally filtered by extension
        
        Args:
            extension: Optional file extension to filter by (e.g., ".py")
            
        Returns:
            List of paths to project files
        """
        if not self.current_project:
            logger.warning("No project is currently open")
            return []
        
        files = []
        
        try:
            # Get all files recursively
            for path in self.current_project.rglob("*"):
                # Skip directories and ignored patterns
                if path.is_dir() or any(pattern.match(str(path)) for pattern in self._ignore_patterns):
                    continue
                
                # Filter by extension if specified
                if extension is None or path.suffix == extension:
                    files.append(path)
        except Exception as e:
            logger.error(f"Error getting project files: {str(e)}")
        
        return sorted(files)
    
    def create_file(self, rel_path: str, content: str = "") -> Optional[Path]:
        """
        Create a new file in the project
        
        Args:
            rel_path: Path relative to project root
            content: Initial file content
            
        Returns:
            Path to the created file or None on failure
        """
        if not self.current_project:
            logger.warning("No project is currently open")
            return None
        
        file_path = self.current_project / rel_path
        
        # Ensure parent directory exists
        file_path.parent.mkdir(parents=True, exist_ok=True)
        
        try:
            with open(file_path, "w") as f:
                f.write(content)
            
            # Update project metadata last modified
            self._update_last_modified()
            
            logger.info(f"Created file: {rel_path}")
            return file_path
        except Exception as e:
            logger.error(f"Error creating file {rel_path}: {str(e)}")
            return None
    
    def rename_file(self, old_path: Union[str, Path], new_path: Union[str, Path]) -> bool:
        """
        Rename or move a file within the project
        
        Args:
            old_path: Current path (relative or absolute)
            new_path: New path (relative or absolute)
            
        Returns:
            True on success, False on failure
        """
        if not self.current_project:
            logger.warning("No project is currently open")
            return False
        
        # Convert to absolute paths if relative
        old_abs = old_path if isinstance(old_path, Path) else self.current_project / old_path
        new_abs = new_path if isinstance(new_path, Path) else self.current_project / new_path
        
        # Ensure the file exists
        if not old_abs.exists():
            logger.error(f"Source file does not exist: {old_abs}")
            return False
        
        # Ensure the destination directory exists
        new_abs.parent.mkdir(parents=True, exist_ok=True)
        
        try:
            # Use shutil to handle cross-device moves
            shutil.move(str(old_abs), str(new_abs))
            
            # Update project metadata last modified
            self._update_last_modified()
            
            logger.info(f"Renamed file: {old_abs} to {new_abs}")
            return True
        except Exception as e:
            logger.error(f"Error renaming file: {str(e)}")
            return False
    
    def delete_file(self, file_path: Union[str, Path]) -> bool:
        """
        Delete a file from the project
        
        Args:
            file_path: Path to the file (relative or absolute)
            
        Returns:
            True on success, False on failure
        """
        if not self.current_project:
            logger.warning("No project is currently open")
            return False
        
        # Convert to absolute path if relative
        abs_path = file_path if isinstance(file_path, Path) else self.current_project / file_path
        
        # Ensure the file exists
        if not abs_path.exists():
            logger.error(f"File does not exist: {abs_path}")
            return False
        
        try:
            # Delete the file
            os.remove(abs_path)
            
            # Update project metadata last modified
            self._update_last_modified()
            
            logger.info(f"Deleted file: {abs_path}")
            return True
        except Exception as e:
            logger.error(f"Error deleting file: {str(e)}")
            return False
    
    def log_interaction(self, prompt: str, response: str, 
                     files_affected: Optional[List[str]] = None,
                     model: str = "", duration_ms: int = 0,
                     token_count: int = 0) -> bool:
        """
        Log an AI interaction for the current project
        
        Args:
            prompt: User prompt
            response: AI response
            files_affected: List of affected file paths
            model: AI model used
            duration_ms: Duration in milliseconds
            token_count: Number of tokens processed
            
        Returns:
            True on success, False on failure
        """
        if not self.current_project:
            logger.warning("No project is currently open")
            return False
        
        try:
            # Create interaction object
            interaction = AIInteraction(
                prompt=prompt,
                response=response,
                files_affected=files_affected or [],
                model=model,
                duration_ms=duration_ms,
                token_count=token_count
            )
            
            # Add to log file
            log_dir = self.current_project / "logs"
            log_dir.mkdir(exist_ok=True)
            
            log_file = log_dir / "ai_interactions.log"
            with open(log_file, "a") as f:
                f.write(json.dumps(interaction.to_dict()) + "\n")
            
            # Update metadata
            metadata = self._load_metadata(self.current_project)
            
            # Add summary of interaction to metadata (without full response)
            summary = {
                "timestamp": interaction.timestamp,
                "prompt": interaction.prompt[:100] + "..." if len(interaction.prompt) > 100 else interaction.prompt,
                "files_affected": interaction.files_affected,
                "model": interaction.model,
                "duration_ms": interaction.duration_ms
            }
            
            metadata.ai_interactions.append(summary)
            
            # Keep only most recent 20 interactions in metadata
            if len(metadata.ai_interactions) > 20:
                metadata.ai_interactions = metadata.ai_interactions[-20:]
            
            # Update last modified
            metadata.last_modified = datetime.datetime.now().isoformat()
            
            # Save metadata
            self._save_metadata(self.current_project, metadata)
            
            logger.info(f"Logged AI interaction at {interaction.timestamp}")
            return True
        except Exception as e:
            logger.error(f"Error logging interaction: {str(e)}")
            return False
    
    def get_interactions_history(self, limit: int = 100) -> List[Dict[str, Any]]:
        """
        Get history of AI interactions for the current project
        
        Args:
            limit: Maximum number of interactions to return
            
        Returns:
            List of interaction dictionaries
        """
        if not self.current_project:
            logger.warning("No project is currently open")
            return []
        
        log_file = self.current_project / "logs" / "ai_interactions.log"
        
        if not log_file.exists():
            return []
        
        interactions = []
        
        try:
            with open(log_file, "r") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    
                    try:
                        interaction = json.loads(line)
                        interactions.append(interaction)
                    except json.JSONDecodeError:
                        logger.warning(f"Invalid JSON in interaction log: {line[:50]}...")
            
            # Sort by timestamp (newest first) and limit
            interactions.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
            return interactions[:limit]
        except Exception as e:
            logger.error(f"Error reading interaction history: {str(e)}")
            return []
    
    def export_project(self, output_path: Optional[Union[str, Path]] = None, 
                     include_history: bool = False) -> Optional[Path]:
        """
        Export the current project as a zip archive
        
        Args:
            output_path: Optional output path (default: project_name.zip)
            include_history: Whether to include interaction history
            
        Returns:
            Path to exported zip file or None on failure
        """
        if not self.current_project:
            logger.warning("No project is currently open")
            return None
        
        # Default output path
        if output_path is None:
            output_path = self.current_project.parent / f"{self.current_project.name}.zip"
        else:
            output_path = Path(output_path)
        
        try:
            with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zipf:
                project_root_len = len(str(self.current_project)) + 1  # +1 for the slash
                
                for root, _, files in os.walk(self.current_project):
                    # Skip log directory if history not included
                    if not include_history and os.path.basename(root) == "logs":
                        continue
                    
                    for file in files:
                        file_path = os.path.join(root, file)
                        
                        # Skip files matching ignore patterns
                        if any(pattern.match(file_path) for pattern in self._ignore_patterns):
                            continue
                        
                        # Add file to zip with relative path
                        archive_name = file_path[project_root_len:]
                        zipf.write(file_path, archive_name)
            
            logger.info(f"Project exported to: {output_path}")
            return output_path
        except Exception as e:
            logger.error(f"Error exporting project: {str(e)}")
            return None
    
    def import_project(self, zip_path: Union[str, Path], project_name: Optional[str] = None) -> Optional[Path]:
        """
        Import a project from a zip archive
        
        Args:
            zip_path: Path to the zip archive
            project_name: Optional name for the imported project
            
        Returns:
            Path to imported project or None on failure
        """
        zip_path = Path(zip_path)
        
        if not zip_path.exists():
            logger.error(f"Zip file does not exist: {zip_path}")
            return None
        
        # Use zip filename as project name if not specified
        if project_name is None:
            project_name = zip_path.stem
        
        # Create a unique project name if it already exists
        original_name = project_name
        counter = 1
        while (self.projects_dir / project_name).exists():
            project_name = f"{original_name}_{counter}"
            counter += 1
        
        project_path = self.projects_dir / project_name
        
        try:
            # Extract zip to project directory
            with zipfile.ZipFile(zip_path, "r") as zipf:
                zipf.extractall(project_path)
            
            # Check if project metadata exists, create if not
            if not (project_path / "project_meta.json").exists():
                metadata = ProjectMetadata(
                    name=project_name,
                    description=f"Imported from {zip_path.name}"
                )
                self._save_metadata(project_path, metadata)
            
            # Set as current project
            self.current_project = project_path
            
            logger.info(f"Project imported to: {project_path}")
            return project_path
        except Exception as e:
            logger.error(f"Error importing project: {str(e)}")
            
            # Clean up on failure
            if project_path.exists():
                try:
                    shutil.rmtree(project_path)
                except Exception:
                    pass
            
            return None
    
    def duplicate_project(self, new_name: Optional[str] = None) -> Optional[Path]:
        """
        Duplicate the current project
        
        Args:
            new_name: Name for the duplicated project
            
        Returns:
            Path to duplicated project or None on failure
        """
        if not self.current_project:
            logger.warning("No project is currently open")
            return None
        
        # Generate new name if not provided
        if new_name is None:
            new_name = f"{self.current_project.name}_copy"
        
        # Create a unique name if it already exists
        original_name = new_name
        counter = 1
        while (self.projects_dir / new_name).exists():
            new_name = f"{original_name}_{counter}"
            counter += 1
        
        new_path = self.projects_dir / new_name
        
        try:
            # Copy project files
            shutil.copytree(self.current_project, new_path)
            
            # Update metadata
            if (new_path / "project_meta.json").exists():
                metadata = self._load_metadata(new_path)
                metadata.name = new_name
                metadata.created = datetime.datetime.now().isoformat()
                metadata.last_modified = metadata.created
                metadata.id = str(uuid.uuid4())  # Generate new ID
                self._save_metadata(new_path, metadata)
            
            logger.info(f"Project duplicated to: {new_path}")
            return new_path
        except Exception as e:
            logger.error(f"Error duplicating project: {str(e)}")
            
            # Clean up on failure
            if new_path.exists():
                try:
                    shutil.rmtree(new_path)
                except Exception:
                    pass
            
            return None
    
    def analyze_project(self) -> Dict[str, Any]:
        """
        Analyze the current project and return statistics
        
        Returns:
            Dictionary with project statistics
        """
        if not self.current_project:
            logger.warning("No project is currently open")
            return {}
        
        stats = {
            "name": self.current_project.name,
            "path": str(self.current_project),
            "created": "",
            "last_modified": "",
            "file_count": 0,
            "total_size_bytes": 0,
            "languages": {},
            "file_types": {},
            "largest_files": [],
            "recent_files": []
        }
        
        try:
            # Load metadata
            metadata = self._load_metadata(self.current_project)
            stats["created"] = metadata.created
            stats["last_modified"] = metadata.last_modified
            stats["description"] = metadata.description
            stats["template"] = metadata.template
            stats["tags"] = metadata.tags
            stats["interactions_count"] = len(self.get_interactions_history())
            
            # Analyze files
            all_files = []
            
            for path in self.current_project.rglob("*"):
                if not path.is_file():
                    continue
                
                # Skip ignored files
                if any(pattern.match(str(path)) for pattern in self._ignore_patterns):
                    continue
                
                # Get file stats
                file_stat = path.stat()
                file_info = {
                    "path": str(path.relative_to(self.current_project)),
                    "size_bytes": file_stat.st_size,
                    "modified": datetime.datetime.fromtimestamp(file_stat.st_mtime).isoformat(),
                    "extension": path.suffix.lower()
                }
                
                all_files.append(file_info)
                
                # Update totals
                stats["file_count"] += 1
                stats["total_size_bytes"] += file_stat.st_size
                
                # Update file type counts
                ext = path.suffix.lower()
                stats["file_types"][ext] = stats["file_types"].get(ext, 0) + 1
                
                # Categorize by language
                lang = "other"
                if ext in [".py", ".pyx", ".pyi"]:
                    lang = "python"
                elif ext in [".js", ".jsx", ".ts", ".tsx"]:
                    lang = "javascript/typescript"
                elif ext in [".html", ".htm", ".css"]:
                    lang = "web"
                elif ext in [".md", ".txt", ".rst"]:
                    lang = "documentation"
                elif ext in [".json", ".yaml", ".yml", ".toml", ".ini"]:
                    lang = "config"
                
                stats["languages"][lang] = stats["languages"].get(lang, 0) + 1
            
            # Get largest files
            all_files.sort(key=lambda x: x["size_bytes"], reverse=True)
            stats["largest_files"] = all_files[:5]
            
            # Get most recently modified files
            all_files.sort(key=lambda x: x["modified"], reverse=True)
            stats["recent_files"] = all_files[:5]
            
            # Convert total size to human-readable format
            size_bytes = stats["total_size_bytes"]
            for unit in ["B", "KB", "MB", "GB"]:
                if size_bytes < 1024 or unit == "GB":
                    stats["total_size_human"] = f"{size_bytes:.2f} {unit}"
                    break
                size_bytes /= 1024
            
            return stats
        except Exception as e:
            logger.error(f"Error analyzing project: {str(e)}")
            return stats
    
    def _load_metadata(self, project_path: Path) -> ProjectMetadata:
        """
        Load project metadata from file
        
        Args:
            project_path: Path to the project
            
        Returns:
            ProjectMetadata object
        """
        # Check cache first
        cache_key = str(project_path)
        if cache_key in self._metadata_cache:
            return self._metadata_cache[cache_key]
        
        metadata_path = project_path / "project_meta.json"
        
        if metadata_path.exists():
            try:
                with open(metadata_path, "r") as f:
                    data = json.load(f)
                
                metadata = ProjectMetadata.from_dict({**data, "name": project_path.name})
                
                # Update cache
                self._metadata_cache[cache_key] = metadata
                
                return metadata
            except Exception as e:
                logger.error(f"Error loading metadata: {str(e)}")
        
        # Return default metadata if file doesn't exist or has errors
        default_metadata = ProjectMetadata(name=project_path.name)
        self._metadata_cache[cache_key] = default_metadata
        return default_metadata
    
    def _save_metadata(self, project_path: Path, metadata: ProjectMetadata) -> bool:
        """
        Save project metadata to file
        
        Args:
            project_path: Path to the project
            metadata: ProjectMetadata object
            
        Returns:
            True on success, False on failure
        """
        metadata_path = project_path / "project_meta.json"
        
        try:
            with open(metadata_path, "w") as f:
                json.dump(metadata.to_dict(), f, indent=2)
            
            # Update cache
            self._metadata_cache[str(project_path)] = metadata
            
            return True
        except Exception as e:
            logger.error(f"Error saving metadata: {str(e)}")
            return False
    
    def _update_last_modified(self) -> None:
        """Update last_modified time in project metadata"""
        if not self.current_project:
            return
        
        try:
            metadata = self._load_metadata(self.current_project)
            metadata.last_modified = datetime.datetime.now().isoformat()
            self._save_metadata(self.current_project, metadata)
        except Exception as e:
            logger.error(f"Error updating last_modified: {str(e)}")
    
    @property
    def current_project_name(self) -> Optional[str]:
        """Get the name of the current project"""
        return self.current_project.name if self.current_project else None
    
    def __del__(self):
        """Cleanup when object is destroyed"""
        if hasattr(self, "_executor") and self._executor:
            self._executor.shutdown(wait=False)
            
    def compute_project_hash(self) -> str:
        """
        Compute a hash of the project's content for versioning
        
        Returns:
            Hash string representing project state
        """
        if not self.current_project:
            return ""
            
        hasher = hashlib.sha256()
        
        try:
            # Get all files sorted by path
            files = sorted(self.get_project_files())
            
            for file_path in files:
                rel_path = file_path.relative_to(self.current_project)
                hasher.update(str(rel_path).encode())
                
                try:
                    with open(file_path, "rb") as f:
                        # Only hash up to 1MB per file to keep this efficient
                        hasher.update(f.read(1024 * 1024))
                except Exception:
                    # Skip files that can't be read
                    pass
            
            return hasher.hexdigest()
        except Exception as e:
            logger.error(f"Error computing project hash: {str(e)}")
            return ""


# Factory function to create a project manager
def create_project_manager(projects_dir: Optional[Union[str, Path]] = None) -> ProjectManager:
    """
    Create a project manager instance with optional custom projects directory
    
    Args:
        projects_dir: Optional custom directory for projects
        
    Returns:
        Configured ProjectManager instance
    """
    # Set up logging if not already configured
    if not logging.getLogger().handlers:
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
    
    # Create and return manager
    return ProjectManager(projects_dir)