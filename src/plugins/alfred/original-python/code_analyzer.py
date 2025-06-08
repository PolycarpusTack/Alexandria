"""
Enterprise Code Factory 9000 Pro - Unified Code Analyzer
--------------------------------------------------------
Provides comprehensive code quality enforcement, validation, and analysis features
with enterprise-level standards and real-time feedback.

This module merges the functionality of code_analyzer.py and live_code_analyzer.py
into a unified, optimized codebase.

Author: Enhanced by Claude
Date: April 10, 2025
"""

import ast
import subprocess
import os
import sys
import logging
import tempfile
import re
import json
import time
import threading
import queue
import tkinter as tk
from tkinter import ttk, font
from pathlib import Path
from typing import Dict, List, Optional, Union, Tuple, Any, Set, Callable
from enum import Enum
from functools import lru_cache
import shutil
from concurrent.futures import ThreadPoolExecutor
import configparser
from dataclasses import dataclass

# Set up module logger
logger = logging.getLogger(__name__)


# Configuration class for quality standards
class QualityConfig:
    """Configuration for code quality standards and thresholds"""
    
    DEFAULT_CONFIG = {
        "python": {
            "max_line_length": "88",
            "enable_flake8": "true",
            "enable_mypy": "true",
            "enable_black": "true",
            "enable_bandit": "true",
            "enable_pylint": "true",
            "cyclomatic_complexity_threshold": "10",
            "max_function_length": "50",
            "enforce_docstrings": "true",
            "enforce_type_hints": "true"
        },
        "javascript": {
            "max_line_length": "80",
            "enable_eslint": "true",
            "enable_prettier": "true",
            "cyclomatic_complexity_threshold": "10",
            "enforce_jsdoc": "true"
        },
        "general": {
            "max_file_size_kb": "1000",
            "banned_functions": "eval,exec",
            "enforce_error_handling": "true",
            "security_scan": "true"
        },
        "ui": {
            "enable_live_analysis": "true",
            "analysis_delay_ms": "500",
            "highlight_issues": "true",
            "auto_fix_enabled": "true"
        }
    }
    
    def __init__(self, config_file: Optional[str] = None):
        """Initialize quality configuration with optional config file path"""
        self.config = configparser.ConfigParser()
        
        # Load from file if it exists
        if config_file and os.path.exists(config_file):
            try:
                self.config.read(config_file)
                logger.info(f"Loaded quality configuration from {config_file}")
            except Exception as e:
                logger.error(f"Error loading quality config: {str(e)}")
                self._set_defaults()
        else:
            self._set_defaults()
    
    def _set_defaults(self) -> None:
        """Set default configuration values"""
        for section, options in self.DEFAULT_CONFIG.items():
            if not self.config.has_section(section):
                self.config.add_section(section)
            for key, value in options.items():
                self.config.set(section, key, value)
    
    def get(self, section: str, option: str, fallback: Optional[str] = None) -> str:
        """Get configuration value with fallback"""
        try:
            return self.config.get(section, option)
        except (configparser.NoSectionError, configparser.NoOptionError):
            if section in self.DEFAULT_CONFIG and option in self.DEFAULT_CONFIG[section]:
                return self.DEFAULT_CONFIG[section][option]
            return fallback if fallback is not None else ""
    
    def get_int(self, section: str, option: str, fallback: int = 0) -> int:
        """Get configuration value as integer with fallback"""
        try:
            return self.config.getint(section, option)
        except (configparser.NoSectionError, configparser.NoOptionError, ValueError):
            if section in self.DEFAULT_CONFIG and option in self.DEFAULT_CONFIG[section]:
                try:
                    return int(self.DEFAULT_CONFIG[section][option])
                except ValueError:
                    pass
            return fallback
    
    def get_bool(self, section: str, option: str, fallback: bool = False) -> bool:
        """Get configuration value as boolean with fallback"""
        try:
            return self.config.getboolean(section, option)
        except (configparser.NoSectionError, configparser.NoOptionError, ValueError):
            if section in self.DEFAULT_CONFIG and option in self.DEFAULT_CONFIG[section]:
                return self.DEFAULT_CONFIG[section][option].lower() in ('true', 'yes', '1', 'on')
            return fallback
    
    def get_list(self, section: str, option: str, fallback: Optional[List[str]] = None) -> List[str]:
        """Get configuration value as a list of strings with fallback"""
        try:
            value = self.config.get(section, option)
            return [item.strip() for item in value.split(',') if item.strip()]
        except (configparser.NoSectionError, configparser.NoOptionError):
            if section in self.DEFAULT_CONFIG and option in self.DEFAULT_CONFIG[section]:
                value = self.DEFAULT_CONFIG[section][option]
                return [item.strip() for item in value.split(',') if item.strip()]
            return fallback if fallback is not None else []


class Language(Enum):
    """Supported programming languages"""
    PYTHON = "python"
    JAVASCRIPT = "javascript"
    TYPESCRIPT = "typescript"
    JAVA = "java"
    GO = "go"
    RUST = "rust"
    CPP = "cpp"
    CSHARP = "csharp"
    PHP = "php"
    RUBY = "ruby"
    UNKNOWN = "unknown"
    
    @classmethod
    def from_file_extension(cls, file_extension: str) -> 'Language':
        """Determine language from file extension"""
        extension_map = {
            ".py": cls.PYTHON,
            ".js": cls.JAVASCRIPT,
            ".ts": cls.TYPESCRIPT,
            ".java": cls.JAVA,
            ".go": cls.GO,
            ".rs": cls.RUST,
            ".cpp": cls.CPP,
            ".c": cls.CPP,
            ".h": cls.CPP,
            ".hpp": cls.CPP,
            ".cs": cls.CSHARP,
            ".php": cls.PHP,
            ".rb": cls.RUBY
        }
        return extension_map.get(file_extension.lower(), cls.UNKNOWN)
    
    @classmethod
    def from_code_content(cls, content: str) -> 'Language':
        """Attempt to determine language from code content (basic heuristics)"""
        # These are simplistic heuristics and could be improved
        if "def " in content and ("import " in content or "class " in content):
            return cls.PYTHON
        if "function " in content and ("{" in content and "}" in content):
            if "interface " in content or ":" in content:
                return cls.TYPESCRIPT
            return cls.JAVASCRIPT
        if "public class " in content and "void " in content:
            return cls.JAVA
        if "package main" in content and "func " in content:
            return cls.GO
        if "fn " in content and "impl " in content:
            return cls.RUST
        if "#include" in content and ("void " in content or "int " in content):
            return cls.CPP
        if "namespace " in content and "public class " in content:
            return cls.CSHARP
        if "<?php" in content or "function " in content and "$" in content:
            return cls.PHP
        if "def " in content and "end" in content and "require " in content:
            return cls.RUBY
            
        # Default to unknown if no clear indicators
        return cls.UNKNOWN


class IssueSeverity(Enum):
    """Issue severity levels for unified interface"""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


@dataclass
class CodeIssue:
    """Unified code issue representation for both analysis systems"""
    line: Optional[int] = None
    column: Optional[int] = None
    message: str = ""
    code: str = ""  # Error code (e.g., "E501")
    severity: Union[str, IssueSeverity] = "warning"  # "info", "warning", "error", "critical"
    source: str = ""  # Tool that found the issue (e.g., "flake8", "mypy")
    suggestion: Optional[str] = None  # Suggested fix if available
    replacement: Optional[str] = None  # Replacement code for auto-fixing
    
    def __post_init__(self):
        """Normalize severity to string"""
        if isinstance(self.severity, IssueSeverity):
            self.severity = self.severity.value
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert issue to dictionary format"""
        return {
            "line": self.line,
            "column": self.column,
            "message": self.message,
            "code": self.code,
            "severity": self.severity,
            "source": self.source,
            "suggestion": self.suggestion,
            "replacement": self.replacement
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'CodeIssue':
        """Create issue from dictionary"""
        return cls(
            line=data.get("line"),
            column=data.get("column"),
            message=data.get("message", ""),
            code=data.get("code", ""),
            severity=data.get("severity", "warning"),
            source=data.get("source", ""),
            suggestion=data.get("suggestion"),
            replacement=data.get("replacement")
        )
    
    def __str__(self) -> str:
        """String representation of the issue"""
        line_info = f"line {self.line}" if self.line is not None else "unknown line"
        col_info = f", column {self.column}" if self.column is not None else ""
        return f"[{self.severity.upper()}] {self.source} - {line_info}{col_info}: {self.code} - {self.message}"


@dataclass
class ValidationResult:
    """Standardized result for code validation"""
    valid: bool = True
    issues: List[CodeIssue] = None
    
    def __post_init__(self):
        if self.issues is None:
            self.issues = []
    
    def add_issue(self, issue: CodeIssue) -> None:
        """Add an issue to the result"""
        if self.issues is None:
            self.issues = []
        self.issues.append(issue)
        # If we have any error or critical issues, mark as invalid
        if issue.severity in ("error", "critical"):
            self.valid = False
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert validation result to dictionary"""
        return {
            "valid": self.valid,
            "issues": [issue.to_dict() for issue in self.issues] if self.issues else []
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ValidationResult':
        """Create validation result from dictionary"""
        result = cls(valid=data.get("valid", True))
        for issue_data in data.get("issues", []):
            result.add_issue(CodeIssue.from_dict(issue_data))
        return result
    
    def merge(self, other: 'ValidationResult') -> None:
        """Merge another validation result into this one"""
        self.valid = self.valid and other.valid
        if other.issues:
            if self.issues is None:
                self.issues = []
            self.issues.extend(other.issues)


class CommandRunner:
    """Utility class to run external commands with error handling"""
    
    @staticmethod
    def run_command(cmd: List[str], input_data: Optional[str] = None, 
                   timeout: int = 30, cwd: Optional[str] = None) -> Tuple[bool, str, str]:
        """
        Run a command and return success flag, stdout and stderr
        
        Args:
            cmd: Command and arguments as list
            input_data: Optional input data to pipe to command
            timeout: Timeout in seconds
            cwd: Working directory for the command
            
        Returns:
            Tuple of (success, stdout, stderr)
        """
        input_bytes = input_data.encode() if input_data else None
        
        try:
            result = subprocess.run(
                cmd,
                input=input_bytes,
                capture_output=True,
                timeout=timeout,
                cwd=cwd,
                text=False  # We'll handle decoding ourselves to ensure proper error handling
            )
            
            # Safely decode stdout and stderr
            stdout = result.stdout.decode('utf-8', errors='replace') if result.stdout else ""
            stderr = result.stderr.decode('utf-8', errors='replace') if result.stderr else ""
            
            success = result.returncode == 0
            return success, stdout, stderr
            
        except subprocess.TimeoutExpired:
            logger.warning(f"Command timed out after {timeout} seconds: {' '.join(cmd)}")
            return False, "", f"Command timed out after {timeout} seconds"
        except Exception as e:
            logger.error(f"Error running command {' '.join(cmd)}: {str(e)}")
            return False, "", f"Error executing command: {str(e)}"
    
    @staticmethod
    def check_tool_available(tool_name: str) -> bool:
        """Check if a command-line tool is available in the PATH"""
        try:
            # Use 'where' on Windows, 'which' on Unix
            cmd = ["where", tool_name] if os.name == "nt" else ["which", tool_name]
            result = subprocess.run(cmd, capture_output=True, timeout=5)
            return result.returncode == 0
        except Exception:
            return False


class CodeAnalyzer:
    """
    Base class for language-specific code analyzers with shared functionality.
    """
    
    def __init__(self, quality_config: Optional[QualityConfig] = None):
        """Initialize analyzer with optional quality configuration"""
        self.quality_config = quality_config or QualityConfig()
    
    def analyze(self, code: str) -> List[CodeIssue]:
        """
        Analyze code and return issues - to be implemented by subclasses
        
        Args:
            code: Source code to analyze
            
        Returns:
            List of issues found
        """
        raise NotImplementedError("Subclasses must implement analyze()")
    
    def auto_fix(self, code: str, issue: CodeIssue) -> Optional[str]:
        """
        Auto-fix an issue in the code
        
        Args:
            code: Source code to fix
            issue: Issue to fix
            
        Returns:
            Fixed code or None if not fixable
        """
        if issue.replacement:
            lines = code.splitlines()
            if issue.line and 1 <= issue.line <= len(lines):
                # Simple line replacement
                lines[issue.line - 1] = issue.replacement
                return "\n".join(lines)
        return None


class PythonAnalyzer(CodeAnalyzer):
    """Python-specific code analyzer with comprehensive checks"""
    
    def analyze(self, code: str) -> List[CodeIssue]:
        """
        Analyze Python code for issues
        
        Args:
            code: Python source code
            
        Returns:
            List of issues found
        """
        issues = []
        
        # Skip empty code
        if not code.strip():
            return issues
        
        # Add syntax check
        syntax_issues = self._check_syntax(code)
        issues.extend(syntax_issues)
        
        # Only perform additional checks if syntax is valid
        if not any(issue.severity == "error" for issue in syntax_issues):
            # Add style checks
            issues.extend(self._check_style(code))
            
            # Add security checks
            issues.extend(self._check_security(code))
            
            # Add best practice checks
            issues.extend(self._check_best_practices(code))
            
            # Add performance checks
            issues.extend(self._check_performance(code))
        
        return issues
    
    def _check_syntax(self, code: str) -> List[CodeIssue]:
        """Check for syntax errors"""
        issues = []
        
        try:
            ast.parse(code)
        except SyntaxError as e:
            issues.append(CodeIssue(
                line=e.lineno or 1,
                column=e.offset or 1,
                message=f"Syntax error: {e.msg}",
                severity="error",
                code="SyntaxError",
                source="Python"
            ))
        except Exception as e:
            issues.append(CodeIssue(
                line=1,
                column=1,
                message=f"Parsing error: {str(e)}",
                severity="error",
                code="ParseError",
                source="Python"
            ))
        
        return issues
    
    def _check_style(self, code: str) -> List[CodeIssue]:
        """Check for style issues"""
        issues = []
        
        # Get max line length from config
        max_line_length = self.quality_config.get_int("python", "max_line_length", 88)
        
        # Check line length
        for i, line in enumerate(code.splitlines(), 1):
            if len(line) > max_line_length:
                issues.append(CodeIssue(
                    line=i,
                    column=max_line_length + 1,
                    message=f"Line too long ({len(line)} > {max_line_length} characters)",
                    code="E501",
                    severity="warning",
                    source="style",
                    suggestion="Break this line into multiple lines"
                ))
        
        # Check whitespace
        trailing_space_pattern = re.compile(r"\s+$")
        for i, line in enumerate(code.splitlines(), 1):
            if match := trailing_space_pattern.search(line):
                issues.append(CodeIssue(
                    line=i,
                    column=match.start() + 1,
                    message="Trailing whitespace",
                    code="W291",
                    severity="info",
                    source="style",
                    suggestion="Remove trailing whitespace",
                    replacement=line.rstrip()
                ))
        
        # Check tabs vs spaces
        if "\t" in code:
            # Find the first line with a tab
            for i, line in enumerate(code.splitlines(), 1):
                if "\t" in line:
                    tab_col = line.index("\t") + 1
                    replacement = line.replace("\t", "    ")
                    issues.append(CodeIssue(
                        line=i,
                        column=tab_col,
                        message="Tab character used instead of spaces",
                        code="W191",
                        severity="warning",
                        source="style",
                        suggestion="Replace tabs with 4 spaces",
                        replacement=replacement
                    ))
                    break
        
        # Check for trailing semicolons (not needed in Python)
        for i, line in enumerate(code.splitlines(), 1):
            if line.rstrip().endswith(';'):
                issues.append(CodeIssue(
                    line=i,
                    column=len(line.rstrip()),
                    message="Unnecessary trailing semicolon",
                    code="W292",
                    severity="info",
                    source="style",
                    suggestion="Remove trailing semicolon",
                    replacement=line.rstrip()[:-1]
                ))
        
        return issues
    
    def _check_security(self, code: str) -> List[CodeIssue]:
        """Check for security issues"""
        issues = []
        
        # Get banned functions from config
        banned_funcs = self.quality_config.get_list("general", "banned_functions", 
                                                ["eval", "exec", "__import__"])
        
        # Check for banned functions
        for func in banned_funcs:
            pattern = re.compile(fr"\b{re.escape(func)}\s*\(")
            for i, line in enumerate(code.splitlines(), 1):
                if match := pattern.search(line):
                    issues.append(CodeIssue(
                        line=i,
                        column=match.start() + 1,
                        message=f"Use of potentially dangerous function: {func}",
                        code="S001",
                        severity="error",
                        source="security",
                        suggestion="Avoid using this function as it can lead to code injection"
                    ))
        
        # Check for hardcoded credentials
        password_pattern = re.compile(r"password\s*=\s*['\"](.*?)['\"]", re.IGNORECASE)
        token_pattern = re.compile(r"(api_key|token|secret)\s*=\s*['\"](.*?)['\"]", re.IGNORECASE)
        
        for i, line in enumerate(code.splitlines(), 1):
            if password_match := password_pattern.search(line):
                # Create replacement with environment variable
                var_name = "PASSWORD"
                replacement = line[:password_match.start(1)-1] + f"os.environ.get('{var_name}')" + line[password_match.end(1)+1:]
                
                issues.append(CodeIssue(
                    line=i,
                    column=password_match.start() + 1,
                    message="Hardcoded password",
                    code="S102",
                    severity="critical",
                    source="security",
                    suggestion="Use environment variables or a secure vault",
                    replacement=replacement
                ))
            
            if token_match := token_pattern.search(line):
                # Create replacement with environment variable
                var_name = token_match.group(1).upper()
                replacement = line[:token_match.start(2)-1] + f"os.environ.get('{var_name}')" + line[token_match.end(2)+1:]
                
                issues.append(CodeIssue(
                    line=i,
                    column=token_match.start() + 1,
                    message=f"Hardcoded {token_match.group(1)}",
                    code="S103",
                    severity="critical",
                    source="security",
                    suggestion="Use environment variables or a secure vault",
                    replacement=replacement
                ))
        
        # Check for dangerous imports
        dangerous_imports = {
            "pickle": "Unpickling untrusted data can lead to remote code execution",
            "marshal": "Loading untrusted data can lead to remote code execution",
            "shelve": "Loading untrusted data can lead to security vulnerabilities"
        }
        
        import_pattern = re.compile(r"^\s*(?:import|from)\s+(\w+)(?:\s+import|\s*$)")
        for i, line in enumerate(code.splitlines(), 1):
            if match := import_pattern.search(line):
                module = match.group(1)
                if module in dangerous_imports:
                    issues.append(CodeIssue(
                        line=i,
                        column=match.start() + 1,
                        message=f"Use of potentially dangerous module: {module}",
                        code="S201",
                        severity="warning",
                        source="security",
                        suggestion=dangerous_imports[module]
                    ))
        
        # Check for SQL injection vulnerabilities
        sql_injection_pattern = re.compile(r"execute\s*\(\s*[\"'].*?\%s.*?[\"']\s*%\s*\(")
        for i, line in enumerate(code.splitlines(), 1):
            if match := sql_injection_pattern.search(line):
                issues.append(CodeIssue(
                    line=i,
                    column=match.start() + 1,
                    message="Potential SQL injection vulnerability",
                    code="S301",
                    severity="error",
                    source="security",
                    suggestion="Use parameterized queries with placeholders instead of string formatting"
                ))
        
        # Check for yaml.load (should use safe_load)
        yaml_load_pattern = re.compile(r"yaml\.load\s*\(")
        for i, line in enumerate(code.splitlines(), 1):
            if match := yaml_load_pattern.search(line):
                issues.append(CodeIssue(
                    line=i,
                    column=match.start() + 1,
                    message="Use of unsafe yaml.load",
                    code="S401",
                    severity="error",
                    source="security",
                    suggestion="Use yaml.safe_load instead to prevent code execution",
                    replacement=line.replace("yaml.load", "yaml.safe_load")
                ))
        
        return issues
    
    def _check_best_practices(self, code: str) -> List[CodeIssue]:
        """Check for best practice violations"""
        issues = []
        
        # Check for TODO comments
        todo_pattern = re.compile(r"#.*\b(TODO|FIXME)\b", re.IGNORECASE)
        for i, line in enumerate(code.splitlines(), 1):
            if match := todo_pattern.search(line):
                issues.append(CodeIssue(
                    line=i,
                    column=match.start() + 1,
                    message=f"TODO comment: {match.group(0)}",
                    code="B001",
                    severity="info",
                    source="best_practice"
                ))
        
        try:
            # Parse code for more advanced checks
            tree = ast.parse(code)
            
            # Visit nodes to find issues
            class BestPracticeVisitor(ast.NodeVisitor):
                def __init__(self, quality_config):
                    self.quality_config = quality_config
                    self.found_issues = []
                    self.parent_stack = []
                
                def visit(self, node):
                    self.parent_stack.append(node)
                    result = super().visit(node)
                    self.parent_stack.pop()
                    return result
                
                def visit_FunctionDef(self, node):
                    # Check for missing docstring if enabled
                    if self.quality_config.get_bool("python", "enforce_docstrings", True):
                        has_docstring = (node.body and isinstance(node.body[0], ast.Expr) and 
                                       isinstance(node.body[0].value, ast.Constant) and 
                                       isinstance(node.body[0].value.value, str))
                        
                        if not has_docstring:
                            # Generate a basic docstring
                            docstring = f'"""{node.name} function\n\n'
                            
                            # Add args if present
                            if node.args.args:
                                docstring += "Args:\n"
                                for arg in node.args.args:
                                    if arg.arg != 'self':  # Skip self for methods
                                        docstring += f"    {arg.arg}: Description\n"
                            
                            docstring += '"""'
                            
                            self.found_issues.append(CodeIssue(
                                line=node.lineno,
                                column=node.col_offset + 1,
                                message=f"Function '{node.name}' missing docstring",
                                code="B101",
                                severity="info",
                                source="best_practice",
                                suggestion=f'Add a docstring: """{node.name} function"""\n'
                            ))
                    
                    # Check function length
                    max_func_length = self.quality_config.get_int("python", "max_function_length", 50)
                    if len(node.body) > max_func_length:
                        self.found_issues.append(CodeIssue(
                            line=node.lineno,
                            column=node.col_offset + 1,
                            message=f"Function '{node.name}' is too long ({len(node.body)} lines)",
                            code="B102",
                            severity="warning",
                            source="best_practice",
                            suggestion="Consider breaking this into smaller functions"
                        ))
                    
                    # Check for too many arguments
                    arg_count = len(node.args.args)
                    if arg_count > 5:
                        self.found_issues.append(CodeIssue(
                            line=node.lineno,
                            column=node.col_offset + 1,
                            message=f"Function '{node.name}' has too many arguments ({arg_count})",
                            code="B103",
                            severity="warning",
                            source="best_practice",
                            suggestion="Consider using a class, dataclass, or a configuration object"
                        ))
                    
                    # Continue visiting children
                    self.generic_visit(node)
                
                def visit_ClassDef(self, node):
                    # Check for missing docstring if enabled
                    if self.quality_config.get_bool("python", "enforce_docstrings", True):
                        has_docstring = (node.body and isinstance(node.body[0], ast.Expr) and 
                                       isinstance(node.body[0].value, ast.Constant) and 
                                       isinstance(node.body[0].value.value, str))
                        
                        if not has_docstring:
                            self.found_issues.append(CodeIssue(
                                line=node.lineno,
                                column=node.col_offset + 1,
                                message=f"Class '{node.name}' missing docstring",
                                code="B201",
                                severity="info",
                                source="best_practice",
                                suggestion=f'Add a docstring: """{node.name} class"""\n'
                            ))
                    
                    # Continue visiting children
                    self.generic_visit(node)
                
                def visit_BinOp(self, node):
                    # Check for type comparisons with '==' instead of isinstance()
                    if (isinstance(node.op, ast.Eq) and 
                        isinstance(node.right, ast.Call) and 
                        isinstance(node.right.func, ast.Name) and
                        node.right.func.id == 'type'):
                        self.found_issues.append(CodeIssue(
                            line=getattr(node, 'lineno', 0),
                            column=getattr(node, 'col_offset', 0) + 1,
                            message="Type comparison using '==' instead of 'isinstance()'",
                            code="B301",
                            severity="warning",
                            source="best_practice",
                            suggestion="Use isinstance() for type checking"
                        ))
                    
                    self.generic_visit(node)
                
                def visit_Compare(self, node):
                    # Check for 'is' being used for value equality instead of 'is None'
                    if any(isinstance(op, ast.Is) for op in node.ops) and not (
                        len(node.ops) == 1 and 
                        isinstance(node.ops[0], ast.Is) and
                        isinstance(node.comparators[0], ast.Constant) and
                        node.comparators[0].value is None
                    ):
                        self.found_issues.append(CodeIssue(
                            line=getattr(node, 'lineno', 0),
                            column=getattr(node, 'col_offset', 0) + 1,
                            message="'is' operator used for value comparison",
                            code="B302",
                            severity="warning",
                            source="best_practice",
                            suggestion="Use '==' for value equality, 'is' only for identity checks"
                        ))
                    
                    self.generic_visit(node)
                
                def visit_Except(self, node):
                    # Check for bare except
                    if node.type is None:
                        self.found_issues.append(CodeIssue(
                            line=getattr(node, 'lineno', 0),
                            column=getattr(node, 'col_offset', 0) + 1,
                            message="Bare except clause",
                            code="B401",
                            severity="warning",
                            source="best_practice",
                            suggestion="Specify exception type(s) to catch or use 'except Exception:'"
                        ))
                    
                    self.generic_visit(node)
            
            # Run visitor
            visitor = BestPracticeVisitor(self.quality_config)
            visitor.visit(tree)
            
            # Add found issues
            issues.extend(visitor.found_issues)
        
        except SyntaxError:
            # Syntax errors already caught by _check_syntax
            pass
        except Exception as e:
            logger.warning(f"Error during best practice check: {str(e)}")
        
        return issues
    
    def _check_performance(self, code: str) -> List[CodeIssue]:
        """Check for performance issues"""
        issues = []
        
        # Check for inefficient list/dict comprehensions
        for i, line in enumerate(code.splitlines(), 1):
            # Check for list/dict creation in loops that could be comprehensions
            if re.search(r"^\s*for .+:\s*$", line):
                # Check next line for list/dict append/update
                if i < len(code.splitlines()):
                    next_line = code.splitlines()[i]
                    if re.search(r"\.append\(", next_line) or re.search(r"\[.+\] ?= ?", next_line):
                        issues.append(CodeIssue(
                            line=i,
                            column=1,
                            message="Consider using a list/dict comprehension",
                            code="P101",
                            severity="info",
                            source="performance",
                            suggestion="Use [expr for item in iterable] or {key: value for item in iterable}"
                        ))
        
        try:
            # Parse code for more advanced checks
            tree = ast.parse(code)
            
            # Visit nodes to find issues
            class PerformanceVisitor(ast.NodeVisitor):
                def __init__(self):
                    self.found_issues = []
                
                def visit_For(self, node):
                    # Check for inefficient range(len(...)) pattern
                    if (isinstance(node.iter, ast.Call) and 
                        isinstance(node.iter.func, ast.Name) and
                        node.iter.func.id == 'range' and
                        len(node.iter.args) == 1 and
                        isinstance(node.iter.args[0], ast.Call) and
                        isinstance(node.iter.args[0].func, ast.Name) and
                        node.iter.args[0].func.id == 'len'):
                        
                        self.found_issues.append(CodeIssue(
                            line=getattr(node, 'lineno', 0),
                            column=getattr(node, 'col_offset', 0) + 1,
                            message="Inefficient 'range(len(...))' pattern",
                            code="P201",
                            severity="info",
                            source="performance",
                            suggestion="Use 'enumerate(iterable)' or 'for item in iterable'"
                        ))
                    
                    self.generic_visit(node)
                
                def visit_ListComp(self, node):
                    # Check for nested list comprehensions (can be hard to read)
                    if any(isinstance(generator.iter, ast.ListComp) for generator in node.generators):
                        self.found_issues.append(CodeIssue(
                            line=getattr(node, 'lineno', 0),
                            column=getattr(node, 'col_offset', 0) + 1,
                            message="Nested list comprehension may be hard to read",
                            code="P301",
                            severity="info",
                            source="performance",
                            suggestion="Consider using intermediate variables or separate comprehensions"
                        ))
                    
                    self.generic_visit(node)
            
            # Run visitor
            visitor = PerformanceVisitor()
            visitor.visit(tree)
            
            # Add found issues
            issues.extend(visitor.found_issues)
        
        except SyntaxError:
            # Syntax errors already caught by _check_syntax
            pass
        except Exception as e:
            logger.warning(f"Error during performance check: {str(e)}")
        
        return issues
    
    def auto_fix(self, code: str, issue: CodeIssue) -> Optional[str]:
        """
        Auto-fix Python issues
        
        Args:
            code: Source code to fix
            issue: Issue to fix
            
        Returns:
            Fixed code or None if not fixable
        """
        # Use parent class implementation for direct replacements
        if issue.replacement:
            return super().auto_fix(code, issue)
        
        # Specialized fixes
        lines = code.splitlines()
        if not issue.line or issue.line < 1 or issue.line > len(lines):
            return None
            
        line_index = issue.line - 1
        
        if issue.code == "W291" and "trailing whitespace" in issue.message:
            lines[line_index] = lines[line_index].rstrip()
            return "\n".join(lines)
        
        if issue.code == "W191" and "tab character" in issue.message:
            lines[line_index] = lines[line_index].replace("\t", "    ")
            return "\n".join(lines)
        
        if issue.code == "W292" and "trailing semicolon" in issue.message:
            lines[line_index] = lines[line_index].rstrip().rstrip(";")
            return "\n".join(lines)
        
        if issue.code == "S401" and "yaml.load" in issue.message:
            lines[line_index] = lines[line_index].replace("yaml.load", "yaml.safe_load")
            return "\n".join(lines)
        
        # For line length issues, attempt to break the line at a sensible point
        if issue.code == "E501" and "line too long" in issue.message:
            line = lines[line_index]
            
            # Try to break at common breakpoints
            if "=" in line and not line.strip().startswith("#"):
                # Break at assignment
                parts = line.split("=", 1)
                indent = len(line) - len(line.lstrip())
                lines[line_index] = f"{parts[0]}="
                lines.insert(line_index + 1, f"{' ' * (indent + 4)}{parts[1].lstrip()}")
                return "\n".join(lines)
            
            # Other line breaking strategies could be added here
        
        return None


class JavaScriptAnalyzer(CodeAnalyzer):
    """JavaScript-specific code analyzer with comprehensive checks"""
    
    def analyze(self, code: str) -> List[CodeIssue]:
        """
        Analyze JavaScript code for issues
        
        Args:
            code: JavaScript source code
            
        Returns:
            List of issues found
        """
        issues = []
        
        # Skip empty code
        if not code.strip():
            return issues
        
        # Add basic syntax check
        bracket_issues = self._check_brackets(code)
        issues.extend(bracket_issues)
        
        # Only perform additional checks if syntax seems valid
        if not any(issue.severity == "error" for issue in bracket_issues):
            # Add style checks
            issues.extend(self._check_style(code))
            
            # Add security checks
            issues.extend(self._check_security(code))
            
            # Add best practice checks
            issues.extend(self._check_best_practices(code))
        
        return issues
    
    def _check_brackets(self, code: str) -> List[CodeIssue]:
        """Check for basic syntax issues like mismatched brackets"""
        issues = []
        
        stack = []
        bracket_pairs = {')': '(', '}': '{', ']': '['}
        
        for i, line in enumerate(code.splitlines(), 1):
            for j, char in enumerate(line, 1):
                if char in '({[':
                    stack.append((char, i, j))
                elif char in ')}]':
                    if not stack or stack[-1][0] != bracket_pairs[char]:
                        issues.append(CodeIssue(
                            line=i,
                            column=j,
                            message=f"Mismatched bracket: '{char}'",
                            code="JS001",
                            severity="error",
                            source="syntax"
                        ))
                    elif stack:
                        stack.pop()
        
        # Check for unclosed brackets
        for bracket, line, column in stack:
            issues.append(CodeIssue(
                line=line,
                column=column,
                message=f"Unclosed bracket: '{bracket}'",
                code="JS002",
                severity="error",
                source="syntax"
            ))
        
        return issues
    
    def _check_style(self, code: str) -> List[CodeIssue]:
        """Check for JavaScript style issues"""
        issues = []
        
        # Get max line length from config
        max_line_length = self.quality_config.get_int("javascript", "max_line_length", 80)
        
        # Check line length
        for i, line in enumerate(code.splitlines(), 1):
            if len(line) > max_line_length:
                issues.append(CodeIssue(
                    line=i,
                    column=max_line_length + 1,
                    message=f"Line too long ({len(line)} > {max_line_length} characters)",
                    code="JS101",
                    severity="warning",
                    source="style",
                    suggestion="Break this line into multiple lines"
                ))
        
        # Check whitespace
        trailing_space_pattern = re.compile(r"\s+$")
        for i, line in enumerate(code.splitlines(), 1):
            if match := trailing_space_pattern.search(line):
                issues.append(CodeIssue(
                    line=i,
                    column=match.start() + 1,
                    message="Trailing whitespace",
                    code="JS102",
                    severity="info",
                    source="style",
                    suggestion="Remove trailing whitespace",
                    replacement=line.rstrip()
                ))
        
        # Check for missing semicolons
        for i, line in enumerate(code.splitlines(), 1):
            # Skip comments, empty lines, and lines that end with brackets or semicolons
            line_content = line.strip()
            if (line_content and 
                not line_content.startswith("//") and 
                not line_content.startswith("/*") and
                not line_content.endswith("*/") and
                not line_content.endswith("{") and
                not line_content.endswith("}") and
                not line_content.endswith(";") and
                not line_content.endswith(",") and
                not line_content.endswith("(") and
                not line_content.endswith("[")):
                
                # Check if this might need a semicolon
                if (re.search(r"\b(var|let|const)\s+", line_content) or
                    re.search(r"\.\w+\s*\(.*\)$", line_content) or
                    re.search(r"=\s*", line_content)):
                    
                    issues.append(CodeIssue(
                        line=i,
                        column=len(line) + 1,
                        message="Missing semicolon",
                        code="JS103",
                        severity="warning",
                        source="style",
                        suggestion="Add semicolon at the end of the line",
                        replacement=line + ";"
                    ))
        
        return issues
    
    def _check_security(self, code: str) -> List[CodeIssue]:
        """Check for JavaScript security issues"""
        issues = []
        
        # Check for eval usage
        eval_pattern = re.compile(r"\beval\s*\(")
        for i, line in enumerate(code.splitlines(), 1):
            if match := eval_pattern.search(line):
                issues.append(CodeIssue(
                    line=i,
                    column=match.start() + 1,
                    message="Use of eval() is discouraged",
                    code="JS201",
                    severity="error",
                    source="security",
                    suggestion="Avoid using eval() as it can lead to code injection vulnerabilities"
                ))
        
        # Check for innerHTML usage (potential XSS)
        innerHTML_pattern = re.compile(r"\.innerHTML\s*=")
        for i, line in enumerate(code.splitlines(), 1):
            if match := innerHTML_pattern.search(line):
                issues.append(CodeIssue(
                    line=i,
                    column=match.start() + 1,
                    message="Direct assignment to innerHTML",
                    code="JS202",
                    severity="warning",
                    source="security",
                    suggestion="Consider using safer alternatives like textContent or DOM methods to avoid XSS"
                ))
        
        # Check for document.write (outdated and can enable XSS)
        document_write_pattern = re.compile(r"document\.write\s*\(")
        for i, line in enumerate(code.splitlines(), 1):
            if match := document_write_pattern.search(line):
                issues.append(CodeIssue(
                    line=i,
                    column=match.start() + 1,
                    message="Use of document.write()",
                    code="JS203",
                    severity="warning",
                    source="security",
                    suggestion="Avoid document.write() as it's outdated and can enable XSS attacks"
                ))
        
        return issues
    
    def _check_best_practices(self, code: str) -> List[CodeIssue]:
        """Check for JavaScript best practice violations"""
        issues = []
        
        # Check for console.log statements (might be left in production code)
        console_log_pattern = re.compile(r"console\.(log|debug|info|warn|error)\s*\(")
        for i, line in enumerate(code.splitlines(), 1):
            if match := console_log_pattern.search(line):
                issues.append(CodeIssue(
                    line=i,
                    column=match.start() + 1,
                    message=f"Console statement: {match.group(0)}",
                    code="JS301",
                    severity="info",
                    source="best_practice",
                    suggestion="Consider removing console statements in production code"
                ))
        
        # Check for == instead of === (strict equality)
        equality_pattern = re.compile(r"[^=!]=[^=]")
        for i, line in enumerate(code.splitlines(), 1):
            if match := equality_pattern.search(line):
                # Skip variable assignments
                prev_chars = line[:match.start()].strip()
                if not prev_chars.endswith("var") and not prev_chars.endswith("let") and not prev_chars.endswith("const"):
                    issues.append(CodeIssue(
                        line=i,
                        column=match.start() + 1,
                        message="Using loose equality (==) instead of strict equality (===)",
                        code="JS302",
                        severity="warning",
                        source="best_practice",
                        suggestion="Use === for equality comparisons to avoid type coercion issues",
                        replacement=line.replace("==", "===").replace("!=", "!==")
                    ))
        
        # Check for TODO comments
        todo_pattern = re.compile(r"//.*\b(TODO|FIXME)\b", re.IGNORECASE)
        for i, line in enumerate(code.splitlines(), 1):
            if match := todo_pattern.search(line):
                issues.append(CodeIssue(
                    line=i,
                    column=match.start() + 1,
                    message=f"TODO comment: {match.group(0)}",
                    code="JS303",
                    severity="info",
                    source="best_practice"
                ))
        
        return issues
    
    def auto_fix(self, code: str, issue: CodeIssue) -> Optional[str]:
        """Auto-fix JavaScript issues"""
        # Use parent class implementation for direct replacements
        if issue.replacement:
            return super().auto_fix(code, issue)
        
        # Specialized fixes
        lines = code.splitlines()
        if not issue.line or issue.line < 1 or issue.line > len(lines):
            return None
            
        line_index = issue.line - 1
        
        if issue.code == "JS102" and "trailing whitespace" in issue.message:
            lines[line_index] = lines[line_index].rstrip()
            return "\n".join(lines)
        
        if issue.code == "JS103" and "missing semicolon" in issue.message:
            lines[line_index] = lines[line_index] + ";"
            return "\n".join(lines)
        
        if issue.code == "JS302" and "loose equality" in issue.message:
            lines[line_index] = lines[line_index].replace("==", "===").replace("!=", "!==")
            return "\n".join(lines)
        
        return None


class CodeAnalysisDisplay:
    """UI component to display code analysis results"""
    
    def __init__(self, parent):
        """Initialize the display component"""
        self.parent = parent
        self.frame = ttk.Frame(parent)
        self.current_issues = []
        self.fix_handler = None
        self.line_select_handler = None
        
        # Set up UI components
        self._setup_ui()
    
    def _setup_ui(self):
        """Set up the UI components"""
        # Create issues list
        columns = ("line", "severity", "message")
        self.issues_tree = ttk.Treeview(self.frame, columns=columns, show="headings")
        
        # Define headings
        self.issues_tree.heading("line", text="Line")
        self.issues_tree.heading("severity", text="Severity")
        self.issues_tree.heading("message", text="Message")
        
        # Define columns
        self.issues_tree.column("line", width=50)
        self.issues_tree.column("severity", width=70)
        self.issues_tree.column("message", width=400)
        
        # Add treeview with scrollbar
        scrollbar = ttk.Scrollbar(self.frame, orient=tk.VERTICAL, command=self.issues_tree.yview)
        self.issues_tree.configure(yscrollcommand=scrollbar.set)
        
        self.issues_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        # Add buttons
        button_frame = ttk.Frame(self.frame)
        button_frame.pack(fill=tk.X, pady=5)
        
        self.fix_button = ttk.Button(button_frame, text="Fix Selected Issue", command=self._fix_selected)
        self.fix_button.pack(side=tk.LEFT, padx=5)
        
        # Bind events
        self.issues_tree.bind("<Double-1>", self._on_issue_select)
    
    def update_issues(self, issues):
        """Update the display with new issues"""
        self.current_issues = issues
        
        # Clear current display
        for item in self.issues_tree.get_children():
            self.issues_tree.delete(item)
        
        # Add new issues
        for i, issue in enumerate(issues):
            line = issue.line or 0
            severity = issue.severity.upper() if issue.severity else "INFO"
            message = issue.message
            
            item_id = self.issues_tree.insert("", tk.END, values=(line, severity, message))
            self.issues_tree.item(item_id, tags=[str(i)])
    
    def _fix_selected(self):
        """Handle fix button click"""
        if not self.fix_handler:
            return
            
        selection = self.issues_tree.selection()
        if not selection:
            return
            
        # Get the issue index from the tags
        item_id = selection[0]
        tags = self.issues_tree.item(item_id, "tags")
        if not tags:
            return
            
        try:
            issue_index = int(tags[0])
            issue = self.current_issues[issue_index]
            self.fix_handler(issue)
        except (IndexError, ValueError):
            pass
    
    def _on_issue_select(self, event):
        """Handle issue selection"""
        if not self.line_select_handler:
            return
            
        selection = self.issues_tree.selection()
        if not selection:
            return
            
        # Get the issue index from the tags
        item_id = selection[0]
        tags = self.issues_tree.item(item_id, "tags")
        if not tags:
            return
            
        try:
            issue_index = int(tags[0])
            issue = self.current_issues[issue_index]
            if issue.line:
                self.line_select_handler(issue.line)
        except (IndexError, ValueError):
            pass
    
    def set_fix_handler(self, handler):
        """Set handler for fix button clicks"""
        self.fix_handler = handler
        
    def set_line_select_handler(self, handler):
        """Set handler for line selection"""
        self.line_select_handler = handler