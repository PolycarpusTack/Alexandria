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
from tkinter import ttk, font, messagebox
from pathlib import Path
from typing import Dict, List, Optional, Union, Tuple, Any, Set, Callable
from enum import Enum
from functools import lru_cache
import shutil
import traceback
from concurrent.futures import ThreadPoolExecutor
import configparser
import argparse
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

class LiveCodeAnalyzer:
    """Real-time code analysis with editor integration"""
    
    def __init__(self, editor=None, issues_callback=None, throttle_ms=500):
        """Initialize the live code analyzer"""
        self.editor = editor
        self.issues_callback = issues_callback
        self.throttle_ms = throttle_ms
        self.code_enforcer = CodeEnforcer()
        self.current_language = Language.PYTHON
        self.analyzing = False
        self.analysis_thread = None
        self.analysis_queue = queue.Queue()
        
    def start(self):
        """Start the analyzer thread"""
        if not self.analyzing:
            self.analyzing = True
            self.analysis_thread = threading.Thread(target=self._analysis_worker, daemon=True)
            self.analysis_thread.start()
    
    def stop(self):
        """Stop the analyzer thread"""
        self.analyzing = False
        if self.analysis_thread and self.analysis_thread.is_alive():
            self.analysis_thread.join(1.0)
    
    def set_language(self, language_name):
        """Set the current language for analysis"""
        try:
            self.current_language = Language(language_name.lower())
        except ValueError:
            # Default to Python if invalid language
            self.current_language = Language.PYTHON
    
    def auto_fix(self, code, issue):
        """Auto-fix a specific issue in the code"""
        if self.current_language in self.code_enforcer.analyzers:
            analyzer = self.code_enforcer.analyzers[self.current_language]
            return analyzer.auto_fix(code, issue)
        return None
    
    def _analysis_worker(self):
        """Background worker for code analysis"""
        while self.analyzing:
            try:
                # Get the next analysis task with a timeout
                try:
                    code, language = self.analysis_queue.get(timeout=0.1)
                except queue.Empty:
                    # If editor is available, periodically check its content
                    if self.editor and hasattr(self.editor, 'get'):
                        code = self.editor.get("1.0", tk.END)
                        if code.strip():
                            self._analyze_code(code)
                    continue
                
                # Analyze the code
                self._analyze_code(code)
                
                self.analysis_queue.task_done()
                
            except Exception as e:
                logger.error(f"Error in analysis worker: {str(e)}")
                continue
    
    def _analyze_code(self, code):
        """Analyze code and report issues"""
        if not code.strip():
            return
            
        try:
            # Run analysis for current language
            if self.current_language in self.code_enforcer.analyzers:
                analyzer = self.code_enforcer.analyzers[self.current_language]
                issues = analyzer.analyze(code)
                
                # Call the callback with issues
                if self.issues_callback and issues:
                    self.issues_callback(issues)
            
        except Exception as e:
            logger.error(f"Error analyzing code: {str(e)}")

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
        """Check for best practice issues"""
        issues = []
        
        # Check for presence of docstrings
        if self.quality_config.get_bool("python", "enforce_docstrings", True):
            tree = ast.parse(code)
            for node in ast.walk(tree):
                if isinstance(node, (ast.FunctionDef, ast.ClassDef, ast.Module)):
                    # Check for docstring
                    docstring = ast.get_docstring(node)
                    if not docstring:
                        if isinstance(node, ast.FunctionDef):
                            issues.append(CodeIssue(
                                line=node.lineno,
                                message=f"Function '{node.name}' is missing a docstring",
                                code="D103",
                                severity="info",
                                source="docstring",
                                suggestion="Add a docstring to describe the function purpose and parameters"
                            ))
                        elif isinstance(node, ast.ClassDef):
                            issues.append(CodeIssue(
                                line=node.lineno,
                                message=f"Class '{node.name}' is missing a docstring",
                                code="D101",
                                severity="info",
                                source="docstring",
                                suggestion="Add a docstring to describe the class purpose and usage"
                            ))
                        elif isinstance(node, ast.Module) and node.lineno == 1:
                            issues.append(CodeIssue(
                                line=1,
                                message="Module is missing a docstring",
                                code="D100",
                                severity="info",
                                source="docstring",
                                suggestion="Add a module-level docstring at the beginning of the file"
                            ))
        
        # Check for type hints
        if self.quality_config.get_bool("python", "enforce_type_hints", True):
            tree = ast.parse(code)
            for node in ast.walk(tree):
                if isinstance(node, ast.FunctionDef):
                    missing_types = []
                    
                    # Check return type annotation
                    if not node.returns and node.name != "__init__":
                        missing_types.append("return")
                    
                    # Check parameter type annotations
                    for arg in node.args.args:
                        if not arg.annotation and arg.arg != "self" and arg.arg != "cls":
                            missing_types.append(arg.arg)
                    
                    if missing_types:
                        msg = f"Function '{node.name}' is missing type hints for: {', '.join(missing_types)}"
                        issues.append(CodeIssue(
                            line=node.lineno,
                            message=msg,
                            code="T001",
                            severity="info",
                            source="typing",
                            suggestion="Add type hints using the typing module"
                        ))
        
        # Check for exception handling
        if self.quality_config.get_bool("general", "enforce_error_handling", True):
            tree = ast.parse(code)
            for node in ast.walk(tree):
                if isinstance(node, ast.Try):
                    # Check for bare except
                    for handler in node.handlers:
                        if handler.type is None:
                            issues.append(CodeIssue(
                                line=handler.lineno,
                                message="Use of bare 'except:' without specific exception type",
                                code="E722",
                                severity="warning",
                                source="exception",
                                suggestion="Specify the exception type(s) to catch instead of catching all exceptions"
                            ))
        
        # Check for function length
        max_function_length = self.quality_config.get_int("python", "max_function_length", 50)
        tree = ast.parse(code)
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef):
                # Get function source
                func_lines = len(ast.get_source_segment(code, node).splitlines())
                if func_lines > max_function_length:
                    issues.append(CodeIssue(
                        line=node.lineno,
                        message=f"Function '{node.name}' is too long ({func_lines} lines > {max_function_length})",
                        code="C901",
                        severity="warning",
                        source="complexity",
                        suggestion=f"Consider breaking this function into smaller functions of less than {max_function_length} lines"
                    ))
        
        return issues
    
    def _check_performance(self, code: str) -> List[CodeIssue]:
        """Check for performance issues"""
        issues = []
        
        # Check for inefficient list comprehensions vs loops
        tree = ast.parse(code)
        
        # Look for list building in loops
        for node in ast.walk(tree):
            if isinstance(node, ast.For):
                # Simple detection of list building in loops
                list_append_pattern = False
                
                for subnode in ast.walk(node):
                    if (isinstance(subnode, ast.Call) and 
                        isinstance(subnode.func, ast.Attribute) and 
                        subnode.func.attr == 'append'):
                        list_append_pattern = True
                        break
                
                if list_append_pattern:
                    issues.append(CodeIssue(
                        line=node.lineno,
                        message="Consider using a list comprehension instead of building a list with append",
                        code="P001",
                        severity="info",
                        source="performance",
                        suggestion="Replace loops that build lists with list comprehensions for better performance"
                    ))
        
        # Check for string concatenation in loops
        for node in ast.walk(tree):
            if isinstance(node, ast.For):
                # Look for string concatenation with +=
                string_concat = False
                
                for subnode in ast.walk(node):
                    if (isinstance(subnode, ast.AugAssign) and 
                        isinstance(subnode.op, ast.Add) and 
                        isinstance(subnode.target, ast.Name)):
                        string_concat = True
                        break
                
                if string_concat:
                    issues.append(CodeIssue(
                        line=node.lineno,
                        message="Potential inefficient string concatenation in loop",
                        code="P002",
                        severity="info",
                        source="performance",
                        suggestion="Use ''.join() or StringBuilder pattern instead of string concatenation in loops"
                    ))
        
        # Check for unnecessary list conversions
        for node in ast.walk(tree):
            if (isinstance(node, ast.Call) and 
                isinstance(node.func, ast.Name) and 
                node.func.id == 'list'):
                
                if len(node.args) == 1 and isinstance(node.args[0], ast.ListComp):
                    issues.append(CodeIssue(
                        line=node.lineno,
                        message="Unnecessary list() conversion of a list comprehension",
                        code="P003",
                        severity="info",
                        source="performance",
                        suggestion="Remove the redundant list() conversion since list comprehensions already create lists"
                    ))
        
        return issues


class JavaScriptAnalyzer(CodeAnalyzer):
    """JavaScript-specific code analyzer"""
    
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
        
        # Basic syntax check
        # Note: A full parser would be better, but this is a simple check
        try:
            self._check_js_syntax(code)
        except Exception as e:
            issues.append(CodeIssue(
                line=getattr(e, 'lineno', 1),
                message=f"Syntax error: {str(e)}",
                severity="error",
                code="SyntaxError",
                source="JavaScript"
            ))
            return issues  # Don't proceed with other checks if syntax is invalid
            
        # Style checks
        issues.extend(self._check_js_style(code))
        
        # Security checks
        issues.extend(self._check_js_security(code))
        
        # Best practices
        issues.extend(self._check_js_best_practices(code))
        
        return issues
    
    def _check_js_syntax(self, code: str) -> None:
        """
        Simple JavaScript syntax check
        
        This is a very basic check that looks for mismatched brackets and braces.
        A proper analyzer would use a JavaScript parser.
        """
        stack = []
        lines = code.splitlines()
        
        for i, line in enumerate(lines, 1):
            for j, char in enumerate(line, 1):
                if char in '({[':
                    stack.append((char, i, j))
                elif char in ')}]':
                    if not stack:
                        e = Exception(f"Unexpected closing '{char}'")
                        e.lineno = i
                        e.offset = j
                        raise e
                    
                    opening, open_line, open_col = stack.pop()
                    if (opening == '(' and char != ')') or \
                       (opening == '{' and char != '}') or \
                       (opening == '[' and char != ']'):
                        e = Exception(f"Mismatched brackets: '{opening}' at line {open_line}, column {open_col} and '{char}'")
                        e.lineno = i
                        e.offset = j
                        raise e
        
        if stack:
            opening, open_line, open_col = stack[0]
            e = Exception(f"Unclosed '{opening}' at line {open_line}, column {open_col}")
            e.lineno = open_line
            e.offset = open_col
            raise e
    
    def _check_js_style(self, code: str) -> List[CodeIssue]:
        """Check JavaScript style issues"""
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
                    code="max-len",
                    severity="warning",
                    source="style",
                    suggestion="Break this line into multiple lines"
                ))
        
        # Check for semicolon usage
        for i, line in enumerate(code.splitlines(), 1):
            stripped = line.strip()
            if (stripped and not stripped.startswith('//') and
                not stripped.startswith('/*') and
                not stripped.endswith('*/') and
                not stripped.endswith('{') and
                not stripped.endswith('}') and
                not stripped.endswith(';') and
                not stripped.endswith(',') and
                not stripped.endswith('(') and
                not stripped.endswith('[')):
                
                issues.append(CodeIssue(
                    line=i,
                    message="Missing semicolon at end of statement",
                    code="semi",
                    severity="warning",
                    source="style",
                    suggestion="Add a semicolon at the end of the statement",
                    replacement=line + ";"
                ))
        
        # Check for 'var' usage (recommend const/let)
        var_pattern = re.compile(r"\bvar\s+")
        for i, line in enumerate(code.splitlines(), 1):
            if match := var_pattern.search(line):
                issues.append(CodeIssue(
                    line=i,
                    column=match.start() + 1,
                    message="Use of 'var' instead of 'const' or 'let'",
                    code="no-var",
                    severity="warning",
                    source="style",
                    suggestion="Replace 'var' with 'const' if the variable is not reassigned, otherwise use 'let'"
                ))
        
        return issues
    
    def _check_js_security(self, code: str) -> List[CodeIssue]:
        """Check JavaScript security issues"""
        issues = []
        
        # Check for eval usage
        eval_pattern = re.compile(r"\beval\s*\(")
        for i, line in enumerate(code.splitlines(), 1):
            if match := eval_pattern.search(line):
                issues.append(CodeIssue(
                    line=i,
                    column=match.start() + 1,
                    message="Use of eval() is strongly discouraged",
                    code="no-eval",
                    severity="error",
                    source="security",
                    suggestion="Avoid using eval() as it can lead to code injection attacks"
                ))
        
        # Check for innerHTML
        inner_html_pattern = re.compile(r"\.innerHTML\s*=")
        for i, line in enumerate(code.splitlines(), 1):
            if match := inner_html_pattern.search(line):
                issues.append(CodeIssue(
                    line=i,
                    column=match.start() + 1,
                    message="Assignment to innerHTML",
                    code="no-inner-html",
                    severity="warning",
                    source="security",
                    suggestion="Use textContent or DOM methods instead to avoid XSS vulnerabilities"
                ))
        
        # Check for document.write
        doc_write_pattern = re.compile(r"document\.write\s*\(")
        for i, line in enumerate(code.splitlines(), 1):
            if match := doc_write_pattern.search(line):
                issues.append(CodeIssue(
                    line=i,
                    column=match.start() + 1,
                    message="Use of document.write()",
                    code="no-document-write",
                    severity="warning",
                    source="security",
                    suggestion="Avoid document.write() as it can lead to XSS vulnerabilities and performance issues"
                ))
        
        return issues
    
    def _check_js_best_practices(self, code: str) -> List[CodeIssue]:
        """Check JavaScript best practices"""
        issues = []
        
        # Check for console.log
        console_log_pattern = re.compile(r"\bconsole\.log\s*\(")
        for i, line in enumerate(code.splitlines(), 1):
            if match := console_log_pattern.search(line):
                issues.append(CodeIssue(
                    line=i,
                    column=match.start() + 1,
                    message="console.log statement found",
                    code="no-console",
                    severity="info",
                    source="best-practice",
                    suggestion="Remove console.log statements before deploying to production"
                ))
        
        # Check for proper error handling in promises
        then_pattern = re.compile(r"\.then\s*\(")
        catch_pattern = re.compile(r"\.catch\s*\(")
        
        has_then = False
        has_catch = False
        
        for line in code.splitlines():
            if then_pattern.search(line):
                has_then = True
            if catch_pattern.search(line):
                has_catch = True
        
        if has_then and not has_catch:
            issues.append(CodeIssue(
                message="Promise chain is missing error handling",
                code="promise-catch",
                severity="warning",
                source="best-practice",
                suggestion="Add a .catch() handler to properly handle promise rejections"
            ))
        
        # Check for proper JSDoc (simplistic check)
        if self.quality_config.get_bool("javascript", "enforce_jsdoc", True):
            function_pattern = re.compile(r"function\s+(\w+)")
            for i, line in enumerate(code.splitlines(), 1):
                if match := function_pattern.search(line):
                    func_name = match.group(1)
                    # Look for JSDoc comment above (simplistic)
                    has_jsdoc = False
                    if i > 1:
                        for j in range(i-1, max(0, i-5), -1):
                            if "/**" in code.splitlines()[j-1]:
                                has_jsdoc = True
                                break
                    
                    if not has_jsdoc:
                        issues.append(CodeIssue(
                            line=i,
                            message=f"Function '{func_name}' is missing JSDoc documentation",
                            code="require-jsdoc",
                            severity="info",
                            source="documentation",
                            suggestion="Add JSDoc comment to document the function's purpose, parameters and return value"
                        ))
        
        return issues


class CodeEnforcer:
    """
    High-level code quality enforcement and validation system that integrates
    multiple language-specific analyzers.
    """
    
    def __init__(self, quality_config: Optional[QualityConfig] = None):
        """Initialize code enforcer with optional quality configuration"""
        self.quality_config = quality_config or QualityConfig()
        
        # Initialize language-specific analyzers
        self.analyzers = {
            Language.PYTHON: PythonAnalyzer(self.quality_config),
            Language.JAVASCRIPT: JavaScriptAnalyzer(self.quality_config),
            # Other language analyzers would be initialized here
        }
        
        # Cache of available external tools
        self._available_tools = {}
        self._check_external_tools()
    
    def _check_external_tools(self) -> None:
        """Check which external tools are available"""
        tools_to_check = [
            "flake8", "mypy", "black", "pylint", "bandit",  # Python tools
            "eslint", "prettier", "jshint"  # JavaScript tools
        ]
        
        for tool in tools_to_check:
            self._available_tools[tool] = CommandRunner.check_tool_available(tool)
            logger.info(f"Tool availability: {tool} - {'available' if self._available_tools[tool] else 'not available'}")
    
    def detect_language(self, code: str, filename: Optional[str] = None) -> Language:
        """
        Detect the programming language of the provided code
        
        Args:
            code: Source code to analyze
            filename: Optional filename which may contain an extension
            
        Returns:
            Detected language enum
        """
        # Try to detect from filename extension first
        if filename:
            _, ext = os.path.splitext(filename)
            if ext:
                lang = Language.from_file_extension(ext)
                if lang != Language.UNKNOWN:
                    return lang
        
        # Fall back to content-based detection
        return Language.from_code_content(code)
    
    def validate_syntax(self, code: str, language: Optional[Union[str, Language]] = None, 
                      filename: Optional[str] = None) -> ValidationResult:
        """
        Validate basic syntax for the given code
        
        Args:
            code: Source code to validate
            language: Programming language or None for auto-detection
            filename: Optional filename for better language detection
            
        Returns:
            ValidationResult with issues if syntax is invalid
        """
        if not code.strip():
            return ValidationResult()  # Empty code is syntactically valid
            
        # Determine language if not provided
        if language is None:
            detected_lang = self.detect_language(code, filename)
        else:
            if isinstance(language, str):
                try:
                    detected_lang = Language(language.lower())
                except ValueError:
                    detected_lang = Language.UNKNOWN
            else:
                detected_lang = language
        
        result = ValidationResult()
        
        try:
            # Use language-specific validation when available
            if detected_lang in self.analyzers:
                analyzer = self.analyzers[detected_lang]
                
                # For now, just check syntax
                # For Python, use ast.parse
                if detected_lang == Language.PYTHON:
                    try:
                        ast.parse(code)
                    except SyntaxError as e:
                        result.add_issue(CodeIssue(
                            line=e.lineno,
                            column=e.offset,
                            message=f"Syntax error: {e.msg}",
                            severity="error",
                            code="SyntaxError",
                            source="Python"
                        ))
                    except Exception as e:
                        result.add_issue(CodeIssue(
                            message=f"Parsing error: {str(e)}",
                            severity="error",
                            code="ParseError",
                            source="Python"
                        ))
                
                # For JavaScript, use our simple syntax checker
                elif detected_lang == Language.JAVASCRIPT:
                    try:
                        self.analyzers[Language.JAVASCRIPT]._check_js_syntax(code)
                    except Exception as e:
                        result.add_issue(CodeIssue(
                            line=getattr(e, 'lineno', 1),
                            column=getattr(e, 'offset', 1),
                            message=f"Syntax error: {str(e)}",
                            severity="error",
                            code="SyntaxError",
                            source="JavaScript"
                        ))
            
            # For other languages, we might offer more basic validation or 
            # use external tools when available
            else:
                logger.info(f"No specific syntax validator available for {detected_lang.value}")
                # For now, consider it valid but with a warning
                result.add_issue(CodeIssue(
                    message=f"No syntax validator available for {detected_lang.value}",
                    severity="info",
                    source="validation"
                ))
        
        except Exception as e:
            # Handle any unexpected errors
            logger.error(f"Error validating syntax: {str(e)}")
            result.add_issue(CodeIssue(
                message=f"Validation error: {str(e)}",
                severity="error",
                source="validation"
            ))
        
        return result
    
    def enforce_standards(self, code: str, language: Optional[Union[str, Language]] = None,
                       filename: Optional[str] = None) -> str:
        """
        Enforce code standards by formatting/fixing the code
        
        Args:
            code: Source code to format
            language: Programming language or None for auto-detection
            filename: Optional filename for better language detection
            
        Returns:
            Formatted code
        """
        if not code.strip():
            return code  # Nothing to format
            
        # Determine language if not provided
        if language is None:
            detected_lang = self.detect_language(code, filename)
        else:
            if isinstance(language, str):
                try:
                    detected_lang = Language(language.lower())
                except ValueError:
                    detected_lang = Language.UNKNOWN
            else:
                detected_lang = language
        
        # Format based on language
        try:
            # Use external formatting tools if available
            if detected_lang == Language.PYTHON:
                # Try black formatter first
                if self._available_tools.get("black", False):
                    success, stdout, stderr = CommandRunner.run_command(
                        ["black", "-", "--quiet"], 
                        input_data=code
                    )
                    
                    if success and stdout:
                        return stdout
                        
                # Simple built-in formatting as fallback
                return self._format_python(code)
                
            elif detected_lang == Language.JAVASCRIPT:
                # Try prettier if available
                if self._available_tools.get("prettier", False):
                    success, stdout, stderr = CommandRunner.run_command(
                        ["prettier", "--stdin-filepath", filename or "code.js"], 
                        input_data=code
                    )
                    
                    if success and stdout:
                        return stdout
                
                # Simple built-in formatting as fallback
                return self._format_javascript(code)
            
            # For other languages, return unchanged
            return code
            
        except Exception as e:
            logger.error(f"Error enforcing standards: {str(e)}")
            return code  # Return original if formatting fails
    
    def _format_python(self, code: str) -> str:
        """Simple Python code formatter (basic rules only)"""
        lines = code.splitlines()
        result = []
        
        for line in lines:
            # Remove trailing whitespace
            formatted = line.rstrip()
            
            # Replace tabs with spaces
            formatted = formatted.replace("\t", "    ")
            
            # Remove trailing semicolons
            if formatted.endswith(';'):
                formatted = formatted[:-1]
                
            result.append(formatted)
        
        return "\n".join(result)
    
    def _format_javascript(self, code: str) -> str:
        """Simple JavaScript code formatter (basic rules only)"""
        lines = code.splitlines()
        result = []
        
        for line in lines:
            # Remove trailing whitespace
            formatted = line.rstrip()
            
            # Replace tabs with spaces
            formatted = formatted.replace("\t", "  ")
                
            result.append(formatted)
        
        return "\n".join(result)
    
    def run_quality_checks(self, code: str, language: Optional[Union[str, Language]] = None,
                         filename: Optional[str] = None, fast_mode: bool = False) -> List[CodeIssue]:
        """
        Run comprehensive quality checks on the provided code
        
        Args:
            code: Source code to analyze
            language: Programming language or None for auto-detection
            filename: Optional filename for better language detection
            fast_mode: If True, skip slower external tool checks
            
        Returns:
            List of issues found
        """
        # Skip empty code
        if not code.strip():
            return []
        
        try:
            # Determine language if not provided
            if language is None:
                detected_lang = self.detect_language(code, filename)
            else:
                if isinstance(language, str):
                    try:
                        detected_lang = Language(language.lower())
                    except ValueError:
                        detected_lang = Language.UNKNOWN
                else:
                    detected_lang = language
            
            # Run language-specific checks
            if detected_lang in self.analyzers:
                analyzer = self.analyzers[detected_lang]
                issues = analyzer.analyze(code)
                
                # Add general checks that apply to all languages
                general_issues = self._check_general_quality(code, detected_lang)
                issues.extend(general_issues)
                
                # Run external tool checks if not in fast mode
                if not fast_mode:
                    external_issues = self._run_external_tools(code, detected_lang, filename)
                    issues.extend(external_issues)
                
                # Sort issues by line number
                issues.sort(key=lambda x: (x.line or 0, x.column or 0))
                
                return issues
            else:
                # For unsupported languages, just run general checks
                return self._check_general_quality(code, detected_lang)
        except Exception as e:
            logger.error(f"Error in quality checks: {str(e)}")
            
            # Return the error as an issue
            return [CodeIssue(
                message=f"Quality check error: {str(e)}",
                severity="error",
                source="quality_check"
            )]
    
    def _run_external_tools(self, code: str, language: Language, 
                          filename: Optional[str] = None) -> List[CodeIssue]:
        """Run external tools for the given language"""
        issues = []
        
        # Create a temporary file for tools that need a file path
        with tempfile.NamedTemporaryFile(suffix=f".{language.value}", 
                                       delete=False, mode="w") as temp_file:
            temp_file.write(code)
            temp_path = temp_file.name
        
        try:
            if language == Language.PYTHON:
                # Run flake8 if enabled and available
                if (self.quality_config.get_bool("python", "enable_flake8") and 
                    self._available_tools.get("flake8", False)):
                    
                    max_line_length = self.quality_config.get_int("python", "max_line_length", 88)
                    
                    success, stdout, stderr = CommandRunner.run_command(
                        ["flake8", "--max-line-length", str(max_line_length), temp_path],
                        timeout=10
                    )
                    
                    if stdout:
                        # Parse flake8 output (format: "FILE:LINE:COL: CODE MESSAGE")
                        for line in stdout.splitlines():
                            try:
                                match = re.match(r".*?:(\d+):(\d+): ([A-Z]\d+) (.*)", line)
                                if match:
                                    line_num, col, code, message = match.groups()
                                    issues.append(CodeIssue(
                                        line=int(line_num),
                                        column=int(col),
                                        message=message,
                                        code=code,
                                        severity="warning",
                                        source="flake8"
                                    ))
                            except Exception:
                                # If parsing fails, add the raw message
                                issues.append(CodeIssue(
                                    message=line,
                                    source="flake8"
                                ))
                
                # Run mypy if enabled and available
                if (self.quality_config.get_bool("python", "enable_mypy") and 
                    self._available_tools.get("mypy", False)):
                    
                    success, stdout, stderr = CommandRunner.run_command(
                        ["mypy", temp_path],
                        timeout=15
                    )
                    
                    if stdout:
                        # Parse mypy output (format: "FILE:LINE: error: MESSAGE")
                        for line in stdout.splitlines():
                            try:
                                match = re.match(r".*:(\d+): (\w+): (.*)", line)
                                if match:
                                    line_num, severity, message = match.groups()
                                    issues.append(CodeIssue(
                                        line=int(line_num),
                                        message=message,
                                        severity=severity,
                                        source="mypy"
                                    ))
                            except Exception:
                                # If parsing fails, add the raw message
                                issues.append(CodeIssue(
                                    message=line,
                                    source="mypy"
                                ))
                
                # Run pylint if enabled and available
                if (self.quality_config.get_bool("python", "enable_pylint") and 
                    self._available_tools.get("pylint", False)):
                    
                    success, stdout, stderr = CommandRunner.run_command(
                        ["pylint", "--output-format=text", temp_path],
                        timeout=20
                    )
                    
                    if stdout:
                        # Parse pylint output
                        for line in stdout.splitlines():
                            if re.match(r"[A-Z]:\d+,\d+:", line):
                                try:
                                    parts = line.split(":", 1)
                                    prefix = parts[0]
                                    message = parts[1].strip()
                                    
                                    prefix_parts = prefix.split(",")
                                    code_type = prefix_parts[0][0]  # C, W, E, F, R
                                    line_num = int(prefix_parts[0][1:])
                                    col = int(prefix_parts[1])
                                    
                                    severity = "info"
                                    if code_type == "C":
                                        severity = "info"  # Convention
                                    elif code_type == "W":
                                        severity = "warning"  # Warning
                                    elif code_type == "E":
                                        severity = "error"  # Error
                                    elif code_type == "F":
                                        severity = "critical"  # Fatal
                                    
                                    issues.append(CodeIssue(
                                        line=line_num,
                                        column=col,
                                        message=message,
                                        severity=severity,
                                        source="pylint"
                                    ))
                                except Exception:
                                    # If parsing fails, add the raw message
                                    issues.append(CodeIssue(
                                        message=line,
                                        source="pylint"
                                    ))
                
                # Run bandit for security issues if enabled
                if (self.quality_config.get_bool("python", "enable_bandit") and 
                    self._available_tools.get("bandit", False)):
                    
                    success, stdout, stderr = CommandRunner.run_command(
                        ["bandit", "-f", "json", temp_path],
                        timeout=15
                    )
                    
                    if success and stdout:
                        try:
                            # Parse JSON output
                            results = json.loads(stdout)
                            for result in results.get("results", []):
                                issues.append(CodeIssue(
                                    line=result.get("line_number"),
                                    message=result.get("issue_text", ""),
                                    code=f"B{result.get('test_id', '')}",
                                    severity="error" if result.get("issue_severity") == "HIGH" else "warning",
                                    source="bandit",
                                    suggestion=result.get("more_info")
                                ))
                        except Exception as e:
                            # If JSON parsing fails
                            issues.append(CodeIssue(
                                message=f"Error parsing bandit results: {str(e)}",
                                source="bandit"
                            ))
            
            elif language == Language.JAVASCRIPT:
                # Run ESLint if enabled and available
                if (self.quality_config.get_bool("javascript", "enable_eslint") and 
                    self._available_tools.get("eslint", False)):
                    
                    success, stdout, stderr = CommandRunner.run_command(
                        ["eslint", "--format=json", temp_path],
                        timeout=15
                    )
                    
                    if success and stdout:
                        try:
                            # Parse JSON output
                            results = json.loads(stdout)
                            for file_result in results:
                                for msg in file_result.get("messages", []):
                                    severity = "info"
                                    if msg.get("severity") == 1:
                                        severity = "warning"
                                    elif msg.get("severity") == 2:
                                        severity = "error"
                                    
                                    issues.append(CodeIssue(
                                        line=msg.get("line"),
                                        column=msg.get("column"),
                                        message=msg.get("message", ""),
                                        code=msg.get("ruleId", ""),
                                        severity=severity,
                                        source="eslint",
                                        suggestion=msg.get("fix", {}).get("text")
                                    ))
                        except Exception as e:
                            # If JSON parsing fails
                            issues.append(CodeIssue(
                                message=f"Error parsing ESLint results: {str(e)}",
                                source="eslint"
                            ))
        
        finally:
            # Clean up temporary file
            try:
                os.unlink(temp_path)
            except Exception:
                pass
        
        return issues
    
    def _check_general_quality(self, code: str, language: Language) -> List[CodeIssue]:
        """Run language-agnostic quality checks"""
        issues = []
        
        # Check file size
        max_size = self.quality_config.get_int("general", "max_file_size_kb", 1000)
        size_kb = len(code.encode('utf-8')) / 1024
        if size_kb > max_size:
            issues.append(CodeIssue(
                message=f"File is too large ({size_kb:.1f} KB > {max_size} KB)",
                severity="warning",
                source="general"
            ))
        
        # Check for banned functions
        banned_funcs = self.quality_config.get_list("general", "banned_functions")
        for func in banned_funcs:
            pattern = re.compile(fr"\b{re.escape(func)}\s*\(")
            for i, line in enumerate(code.splitlines(), 1):
                if pattern.search(line):
                    issues.append(CodeIssue(
                        line=i,
                        message=f"Usage of potentially dangerous function: {func}",
                        severity="error",
                        source="security_check"
                    ))
        
        # Check for TODOs
        todo_pattern = re.compile(r"(#|//)\s*TODO", re.IGNORECASE)
        for i, line in enumerate(code.splitlines(), 1):
            if todo_pattern.search(line):
                issues.append(CodeIssue(
                    line=i,
                    message="TODO comment found",
                    severity="info",
                    source="general"
                ))
        
        return issues
    
    def analyze_code_complexity(self, code: str, language: Optional[Union[str, Language]] = None,
                             filename: Optional[str] = None) -> Dict[str, Any]:
        """
        Analyze code complexity metrics
        
        Args:
            code: Source code to analyze
            language: Programming language or None for auto-detection
            filename: Optional filename for better language detection
            
        Returns:
            Dictionary with complexity metrics
        """
        # Determine language if not provided
        if language is None:
            detected_lang = self.detect_language(code, filename)
        else:
            if isinstance(language, str):
                try:
                    detected_lang = Language(language.lower())
                except ValueError:
                    detected_lang = Language.UNKNOWN
            else:
                detected_lang = language
        
        # Basic metrics for all languages
        metrics = {
            "lines_total": len(code.splitlines()),
            "lines_code": sum(1 for line in code.splitlines() if line.strip() and not line.strip().startswith(('#', '//'))),
            "lines_comment": sum(1 for line in code.splitlines() if line.strip() and line.strip().startswith(('#', '//'))),
            "lines_blank": sum(1 for line in code.splitlines() if not line.strip()),
            "language": detected_lang.value
        }
        
        # Language-specific metrics
        if detected_lang == Language.PYTHON:
            python_metrics = self._analyze_python_complexity(code)
            metrics.update(python_metrics)
        elif detected_lang in (Language.JAVASCRIPT, Language.TYPESCRIPT):
            js_metrics = self._analyze_js_complexity(code)
            metrics.update(js_metrics)
        
        return metrics
    
    def _analyze_python_complexity(self, code: str) -> Dict[str, Any]:
        """Analyze Python code complexity"""
        metrics = {}
        
        # Basic Python metrics
        metrics["classes"] = len(re.findall(r"^class\s+\w+", code, re.MULTILINE))
        metrics["functions"] = len(re.findall(r"^def\s+\w+", code, re.MULTILINE))
        metrics["imports"] = len(re.findall(r"^import\s+|^from\s+\w+\s+import", code, re.MULTILINE))
        
        # More advanced metrics would use AST parsing in a real implementation
        try:
            tree = ast.parse(code)
            
            # Count function complexity (approximation)
            functions_details = []
            classes_details = []
            
            for node in ast.walk(tree):
                if isinstance(node, ast.FunctionDef):
                    # Simple cyclomatic complexity approximation
                    func_code = ast.get_source_segment(code, node)
                    if func_code:
                        complexity = 1
                        complexity += func_code.count(" if ")
                        complexity += func_code.count(" else ")
                        complexity += func_code.count(" elif ")
                        complexity += func_code.count(" for ")
                        complexity += func_code.count(" while ")
                        complexity += func_code.count(" and ")
                        complexity += func_code.count(" or ")
                        complexity += func_code.count("except ")
                        
                        functions_details.append({
                            "name": node.name,
                            "line": node.lineno,
                            "complexity": complexity,
                            "args": len(node.args.args)
                        })
                
                elif isinstance(node, ast.ClassDef):
                    methods = [n.name for n in node.body if isinstance(n, ast.FunctionDef)]
                    classes_details.append({
                        "name": node.name,
                        "line": node.lineno,
                        "methods": len(methods),
                        "method_names": methods
                    })
            
            metrics["functions_details"] = functions_details
            metrics["classes_details"] = classes_details
            
            # Calculate average complexity
            if functions_details:
                metrics["avg_function_complexity"] = sum(f["complexity"] for f in functions_details) / len(functions_details)
            else:
                metrics["avg_function_complexity"] = 0
            
        except Exception as e:
            logger.warning(f"Error analyzing Python complexity: {str(e)}")
        
        return metrics
    
    def _analyze_js_complexity(self, code: str) -> Dict[str, Any]:
        """Analyze JavaScript/TypeScript code complexity"""
        metrics = {}
        
        # Basic JavaScript metrics
        metrics["functions"] = len(re.findall(r"function\s+\w+|=>|^(\s+)?\w+:\s*function", code, re.MULTILINE))
        metrics["classes"] = len(re.findall(r"class\s+\w+", code, re.MULTILINE))
        
        # Count function complexity (approximation)
        functions = []
        function_pattern = re.compile(r"function\s+(\w+)\s*\(")
        
        # Find named functions and their approximate complexity
        for i, line in enumerate(code.splitlines(), 1):
            if match := function_pattern.search(line):
                func_name = match.group(1)
                
                # Find function body (simplistic approach)
                bracket_count = 0
                start_line = i
                end_line = i
                in_function = False
                
                for j, func_line in enumerate(code.splitlines()[i-1:], i):
                    if "{" in func_line and not in_function:
                        in_function = True
                        bracket_count += func_line.count("{")
                    elif in_function:
                        bracket_count += func_line.count("{")
                        bracket_count -= func_line.count("}")
                        
                    if bracket_count <= 0 and in_function:
                        end_line = j
                        break
                
                # Get function body
                function_body = "\n".join(code.splitlines()[start_line-1:end_line])
                
                # Approximate complexity
                complexity = 1
                complexity += function_body.count(" if ")
                complexity += function_body.count(" else ")
                complexity += function_body.count(" for ")
                complexity += function_body.count(" while ")
                complexity += function_body.count(" && ")
                complexity += function_body.count(" || ")
                complexity += function_body.count(" ? ")
                complexity += function_body.count("catch ")
                
                functions.append({
                    "name": func_name,
                    "line": start_line,
                    "complexity": complexity,
                    "lines": end_line - start_line + 1
                })
        
        metrics["functions_details"] = functions
        
        # Calculate average complexity
        if functions:
            metrics["avg_function_complexity"] = sum(f["complexity"] for f in functions) / len(functions)
        else:
            metrics["avg_function_complexity"] = 0
        
        return metrics
    
    def auto_fix_issues(self, code: str, issues: List[CodeIssue], language: Optional[Union[str, Language]] = None,
                      filename: Optional[str] = None) -> str:
        """
        Attempt to automatically fix common code issues
        
        Args:
            code: Source code to fix
            issues: List of issues to fix
            language: Programming language or None for auto-detection
            filename: Optional filename for better language detection
            
        Returns:
            Fixed code or original if no fixes could be applied
        """
        if not code or not issues:
            return code
            
        # Determine language if not provided
        if language is None:
            detected_lang = self.detect_language(code, filename)
        else:
            if isinstance(language, str):
                try:
                    detected_lang = Language(language.lower())
                except ValueError:
                    detected_lang = Language.UNKNOWN
            else:
                detected_lang = language
        
        # Use the appropriate analyzer for auto-fixing
        if detected_lang in self.analyzers:
            analyzer = self.analyzers[detected_lang]
            fixed_code = code
            
            # Apply fixes one by one
            for issue in issues:
                new_code = analyzer.auto_fix(fixed_code, issue)
                if new_code:
                    fixed_code = new_code
            
            return fixed_code
        
        # Fall back to formatting which fixes many simple issues
        return self.enforce_standards(code, detected_lang, filename)
    
    @lru_cache(maxsize=128)
    def get_language_best_practices(self, language: Language) -> List[str]:
        """
        Get a list of best practices for a given language
        
        Args:
            language: Programming language
            
        Returns:
            List of best practice descriptions
        """
        # This would be loaded from a database or config file in a real system
        if language == Language.PYTHON:
            return [
                "Use meaningful variable and function names",
                "Add docstrings to all functions, classes, and modules",
                "Use type hints for function parameters and return values",
                "Follow PEP 8 style guide",
                "Handle exceptions with specific exception types",
                "Use context managers (with statement) for resource management",
                "Prefer list/dict comprehensions over loops when appropriate",
                "Use f-strings for string formatting in Python 3.6+",
                "Avoid global variables",
                "Write unit tests for your code"
            ]
        elif language == Language.JAVASCRIPT:
            return [
                "Use const and let instead of var",
                "Use arrow functions for callbacks",
                "Use destructuring for objects and arrays",
                "Use template literals for string concatenation",
                "Use async/await for asynchronous code",
                "Use ESLint to catch common errors",
                "Follow a consistent style guide",
                "Use modules instead of global variables",
                "Handle promise rejections",
                "Write unit tests for your code"
            ]
        else:
            return ["Follow language-specific best practices and style guides"]
    
    def suggest_improvements(self, code: str, language: Optional[Union[str, Language]] = None,
                          filename: Optional[str] = None, metrics: Optional[Dict[str, Any]] = None) -> List[str]:
        """
        Suggest code improvements based on analysis
        
        Args:
            code: Source code to analyze
            language: Programming language or None for auto-detection
            filename: Optional filename for better language detection
            metrics: Optional pre-computed metrics
            
        Returns:
            List of suggested improvements
        """