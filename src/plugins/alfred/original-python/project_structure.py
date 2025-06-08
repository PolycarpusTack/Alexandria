"""
Project Structure Manager for ALFRED
Handles intelligent file placement and project organization
"""

import os
import json
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, field
import re
from datetime import datetime


@dataclass
class ProjectStructure:
    """Represents a project's directory structure"""
    root: str
    type: str = "generic"
    directories: Dict[str, str] = field(default_factory=dict)
    patterns: Dict[str, str] = field(default_factory=dict)
    config_files: List[str] = field(default_factory=list)
    
    def get_suggested_path(self, filename: str, content: str) -> str:
        """Get suggested path for a file based on its name and content"""
        # Check patterns first
        for pattern, directory in self.patterns.items():
            if re.match(pattern, filename):
                return directory
        
        # Check content-based rules
        return self._analyze_content_for_path(filename, content)
    
    def _analyze_content_for_path(self, filename: str, content: str) -> str:
        """Analyze file content to determine best location"""
        lower_content = content.lower()
        
        # Python files
        if filename.endswith('.py'):
            if 'test_' in filename or 'import pytest' in content or 'import unittest' in content:
                return self.directories.get('tests', 'tests')
            elif 'from flask' in content or 'from django' in content:
                if 'route' in lower_content or 'blueprint' in lower_content:
                    return self.directories.get('routes', 'routes')
                elif 'model' in lower_content or 'class.*model' in lower_content:
                    return self.directories.get('models', 'models')
                elif 'view' in lower_content:
                    return self.directories.get('views', 'views')
            elif '__main__' in content:
                return ""  # Root directory
            elif 'def ' in content or 'class ' in content:
                return self.directories.get('src', 'src')
        
        # JavaScript/TypeScript files
        elif filename.endswith(('.js', '.jsx', '.ts', '.tsx')):
            if 'test' in filename or 'spec' in filename:
                return self.directories.get('tests', '__tests__')
            elif 'component' in lower_content or 'react' in lower_content:
                return self.directories.get('components', 'src/components')
            elif filename.startswith(('use', 'Use')):
                return self.directories.get('hooks', 'src/hooks')
            elif 'service' in filename.lower():
                return self.directories.get('services', 'src/services')
            elif 'route' in lower_content:
                return self.directories.get('routes', 'src/routes')
        
        # CSS/Style files
        elif filename.endswith(('.css', '.scss', '.sass', '.less')):
            return self.directories.get('styles', 'src/styles')
        
        # Smalltalk files
        elif filename.endswith(('.st', '.cs')):
            if 'test' in filename.lower() or 'TestCase subclass:' in content:
                return self.directories.get('tests', 'tests')
            else:
                return self.directories.get('sources', 'sources')
        elif filename.endswith('.im'):
            return self.directories.get('images', 'images')
        elif filename.endswith(('.pcl', '.pst', '.pal')):
            return self.directories.get('parcels', 'parcels')
        
        # Config files
        elif filename in self.config_files:
            return ""  # Root directory
        
        # Documentation
        elif filename.endswith('.md'):
            return self.directories.get('docs', 'docs')
        
        # Default to appropriate directory
        return self.directories.get('default', '')


class ProjectTypeDetector:
    """Detects project type from existing files and structure"""
    
    PROJECT_INDICATORS = {
        'flask': {
            'files': ['app.py', 'requirements.txt'],
            'patterns': ['from flask import', 'Flask(__name__)'],
            'structure': {
                'templates': 'templates',
                'static': 'static',
                'models': 'models',
                'routes': 'routes',
                'tests': 'tests'
            }
        },
        'django': {
            'files': ['manage.py', 'requirements.txt'],
            'patterns': ['from django', 'django.db import models'],
            'structure': {
                'apps': 'apps',
                'templates': 'templates',
                'static': 'static',
                'media': 'media',
                'tests': 'tests'
            }
        },
        'react': {
            'files': ['package.json', 'src/App.js', 'src/App.jsx', 'src/App.tsx'],
            'patterns': ['import React', 'from \'react\'', 'from "react"'],
            'structure': {
                'components': 'src/components',
                'pages': 'src/pages',
                'hooks': 'src/hooks',
                'services': 'src/services',
                'styles': 'src/styles',
                'tests': 'src/__tests__',
                'public': 'public'
            }
        },
        'vue': {
            'files': ['package.json', 'src/App.vue'],
            'patterns': ['<template>', 'new Vue', 'export default {'],
            'structure': {
                'components': 'src/components',
                'views': 'src/views',
                'router': 'src/router',
                'store': 'src/store',
                'assets': 'src/assets'
            }
        },
        'fastapi': {
            'files': ['main.py', 'requirements.txt'],
            'patterns': ['from fastapi import', 'FastAPI()'],
            'structure': {
                'routers': 'routers',
                'models': 'models',
                'schemas': 'schemas',
                'services': 'services',
                'tests': 'tests'
            }
        },
        'express': {
            'files': ['package.json', 'server.js', 'app.js'],
            'patterns': ['express()', 'require(\'express\')', 'require("express")'],
            'structure': {
                'routes': 'routes',
                'models': 'models',
                'controllers': 'controllers',
                'middleware': 'middleware',
                'public': 'public',
                'views': 'views'
            }
        },
        'nextjs': {
            'files': ['package.json', 'next.config.js', 'pages/_app.js'],
            'patterns': ['from next/', 'import.*from.*next'],
            'structure': {
                'pages': 'pages',
                'components': 'components',
                'styles': 'styles',
                'public': 'public',
                'api': 'pages/api'
            }
        },
        'smalltalk': {
            'files': ['*.im', '*.cha', '*.st', '*.cs'],
            'patterns': ['subclass:', 'instanceVariableNames:', 'methodsFor:'],
            'structure': {
                'images': 'images',
                'sources': 'sources',
                'fileouts': 'fileouts',
                'parcels': 'parcels',
                'tests': 'tests'
            }
        }
    }
    
    def detect_project_type(self, project_path: str) -> Tuple[str, Dict[str, str]]:
        """Detect project type and return type name and structure"""
        path = Path(project_path)
        
        # Special handling for Smalltalk
        smalltalk_indicators = self.PROJECT_INDICATORS['smalltalk']
        # Check for Smalltalk image files
        for pattern in ['*.im', '*.cha', '*.st', '*.cs']:
            if list(path.glob(pattern)):
                # Check for Smalltalk patterns in .st files
                for st_file in path.glob('*.st'):
                    try:
                        with open(st_file, 'r', encoding='utf-8') as f:
                            content = f.read()
                            for pattern in smalltalk_indicators['patterns']:
                                if pattern in content:
                                    return 'smalltalk', smalltalk_indicators['structure']
                    except:
                        pass
                # Even without pattern match, if we have .im files it's likely Smalltalk
                if list(path.glob('*.im')):
                    return 'smalltalk', smalltalk_indicators['structure']
        
        # Check for existing files
        for project_type, indicators in self.PROJECT_INDICATORS.items():
            if project_type == 'smalltalk':
                continue  # Already handled above
            # Check indicator files
            for indicator_file in indicators['files']:
                if (path / indicator_file).exists():
                    # Read file content to confirm
                    try:
                        with open(path / indicator_file, 'r', encoding='utf-8') as f:
                            content = f.read()
                            for pattern in indicators['patterns']:
                                if pattern in content:
                                    return project_type, indicators['structure']
                    except:
                        pass
        
        # Check package.json for framework detection
        package_json = path / 'package.json'
        if package_json.exists():
            try:
                with open(package_json, 'r') as f:
                    data = json.load(f)
                    deps = {**data.get('dependencies', {}), **data.get('devDependencies', {})}
                    
                    if 'react' in deps:
                        if 'next' in deps:
                            return 'nextjs', self.PROJECT_INDICATORS['nextjs']['structure']
                        return 'react', self.PROJECT_INDICATORS['react']['structure']
                    elif 'vue' in deps:
                        return 'vue', self.PROJECT_INDICATORS['vue']['structure']
                    elif 'express' in deps:
                        return 'express', self.PROJECT_INDICATORS['express']['structure']
            except:
                pass
        
        # Default to generic
        return 'generic', {
            'src': 'src',
            'tests': 'tests',
            'docs': 'docs',
            'scripts': 'scripts'
        }


class ProjectStructureManager:
    """Manages project structure and file organization"""
    
    def __init__(self, project_path: str, tree_cache=None):
        self.project_path = Path(project_path)
        self.detector = ProjectTypeDetector()
        self.structure = self._initialize_structure()
        
        # Initialize tree cache if not provided
        if tree_cache is None:
            from project_tree_cache import create_tree_cache
            self.tree_cache = create_tree_cache()
        else:
            self.tree_cache = tree_cache
        
        # Cache the initial tree
        self._cached_tree = None
        self._refresh_tree_cache()
    
    def _initialize_structure(self) -> ProjectStructure:
        """Initialize project structure"""
        project_type, directories = self.detector.detect_project_type(str(self.project_path))
        
        # Define patterns for common files
        patterns = {
            r'test_.*\.py$': directories.get('tests', 'tests'),
            r'.*\.test\.(js|jsx|ts|tsx)$': directories.get('tests', '__tests__'),
            r'.*\.spec\.(js|jsx|ts|tsx)$': directories.get('tests', '__tests__'),
            r'.*\.md$': directories.get('docs', 'docs'),
            r'.*\.css$': directories.get('styles', 'styles'),
            r'.*\.scss$': directories.get('styles', 'styles'),
        }
        
        # Common config files that go in root
        config_files = [
            'package.json', 'package-lock.json', 'yarn.lock',
            'requirements.txt', 'Pipfile', 'poetry.lock',
            'setup.py', 'setup.cfg', 'pyproject.toml',
            '.gitignore', '.env', '.env.example',
            'README.md', 'LICENSE', 'CHANGELOG.md',
            'tsconfig.json', 'jsconfig.json', 'babel.config.js',
            'webpack.config.js', 'vite.config.js', 'rollup.config.js',
            'docker-compose.yml', 'Dockerfile', '.dockerignore'
        ]
        
        return ProjectStructure(
            root=str(self.project_path),
            type=project_type,
            directories=directories,
            patterns=patterns,
            config_files=config_files
        )
    
    def _refresh_tree_cache(self, force=False):
        """Refresh the cached project tree"""
        self._cached_tree, self._cache_metadata = self.tree_cache.get_tree(
            self.project_path, 
            force_refresh=force
        )
    
    def get_file_path(self, filename: str, content: str, 
                     force_directory: Optional[str] = None) -> Tuple[str, bool]:
        """
        Get the full path for a file
        Returns: (suggested_path, needs_creation)
        """
        if force_directory is not None:
            # User specified directory
            directory = force_directory
        else:
            # Auto-detect directory
            directory = self.structure.get_suggested_path(filename, content)
        
        # Build full path
        if directory:
            full_path = self.project_path / directory / filename
        else:
            full_path = self.project_path / filename
        
        # Check if directory needs to be created
        needs_creation = not full_path.parent.exists()
        
        return str(full_path), needs_creation
    
    def get_tree(self, force_refresh=False):
        """Get cached project tree"""
        if force_refresh or self._cached_tree is None:
            self._refresh_tree_cache(force_refresh)
        return self._cached_tree
    
    def get_tree_stats(self):
        """Get statistics about the project tree"""
        if self._cache_metadata:
            return {
                "files": self._cache_metadata.file_count,
                "directories": self._cache_metadata.dir_count,
                "total_size_mb": self._cache_metadata.total_size / (1024 * 1024),
                "scan_time": self._cache_metadata.scan_time,
                "cached": True,
                "cache_age": (datetime.now() - self._cache_metadata.created).total_seconds()
            }
        return None
    
    def invalidate_cache(self):
        """Invalidate the tree cache for this project"""
        self.tree_cache.invalidate(self.project_path)
        self._cached_tree = None
    
    def create_initial_structure(self):
        """Create initial project structure based on type"""
        for directory in self.structure.directories.values():
            if directory:
                dir_path = self.project_path / directory
                dir_path.mkdir(parents=True, exist_ok=True)
    
    def get_project_tree(self) -> Dict:
        """Get project tree structure for display"""
        def build_tree(path: Path, prefix: str = "") -> List[str]:
            """Build tree representation"""
            items = []
            children = sorted(path.iterdir(), key=lambda x: (x.is_file(), x.name))
            
            for i, child in enumerate(children):
                is_last = i == len(children) - 1
                current_prefix = "└── " if is_last else "├── "
                next_prefix = "    " if is_last else "│   "
                
                if child.is_file():
                    items.append(f"{prefix}{current_prefix}{child.name}")
                else:
                    items.append(f"{prefix}{current_prefix}{child.name}/")
                    # Recurse into directory (limit depth)
                    if prefix.count("│") < 3:  # Limit depth
                        items.extend(build_tree(child, prefix + next_prefix))
            
            return items
        
        return {
            'type': self.structure.type,
            'tree': build_tree(self.project_path)
        }
    
    def suggest_structure_improvements(self) -> List[str]:
        """Suggest improvements to project structure"""
        suggestions = []
        
        # Check for missing standard directories
        for purpose, directory in self.structure.directories.items():
            dir_path = self.project_path / directory
            if not dir_path.exists() and purpose in ['tests', 'docs']:
                suggestions.append(f"Consider creating '{directory}' directory for {purpose}")
        
        # Check for files in wrong locations
        for file in self.project_path.rglob('*'):
            if file.is_file():
                suggested_dir = self.structure.get_suggested_path(file.name, "")
                if suggested_dir and file.parent != self.project_path / suggested_dir:
                    suggestions.append(
                        f"'{file.name}' might be better placed in '{suggested_dir}'"
                    )
        
        return suggestions