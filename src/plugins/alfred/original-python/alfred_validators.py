#!/usr/bin/env python3
"""
Input validation utilities for ALFRED
Provides comprehensive validation for user inputs
"""

import re
import os
from pathlib import Path
from typing import Any, Optional, List, Tuple, Union
from alfred_exceptions import ValidationError
from alfred_constants import MAX_CONTEXT_FILE_SIZE


class Validator:
    """Base validator class"""
    
    def validate(self, value: Any) -> Tuple[bool, Optional[str]]:
        """
        Validate a value
        Returns: (is_valid, error_message)
        """
        raise NotImplementedError


class StringValidator(Validator):
    """String validation"""
    
    def __init__(self, min_length: int = 0, max_length: int = 1000,
                 pattern: Optional[str] = None, allowed_chars: Optional[str] = None):
        self.min_length = min_length
        self.max_length = max_length
        self.pattern = re.compile(pattern) if pattern else None
        self.allowed_chars = set(allowed_chars) if allowed_chars else None
    
    def validate(self, value: Any) -> Tuple[bool, Optional[str]]:
        if not isinstance(value, str):
            return False, "Value must be a string"
        
        if len(value) < self.min_length:
            return False, f"Must be at least {self.min_length} characters"
        
        if len(value) > self.max_length:
            return False, f"Must not exceed {self.max_length} characters"
        
        if self.pattern and not self.pattern.match(value):
            return False, "Invalid format"
        
        if self.allowed_chars:
            invalid_chars = set(value) - self.allowed_chars
            if invalid_chars:
                return False, f"Contains invalid characters: {invalid_chars}"
        
        return True, None


class ProjectNameValidator(StringValidator):
    """Validate project names"""
    
    def __init__(self):
        # Allow alphanumeric, spaces, hyphens, underscores
        super().__init__(
            min_length=1,
            max_length=100,
            pattern=r'^[\w\s\-]+$'
        )
    
    def validate(self, value: Any) -> Tuple[bool, Optional[str]]:
        is_valid, error = super().validate(value)
        if not is_valid:
            return is_valid, error
        
        # Additional checks
        if value.strip() != value:
            return False, "Name cannot start or end with whitespace"
        
        # Check for reserved names
        reserved = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'LPT1']  # Windows reserved
        if value.upper() in reserved:
            return False, f"'{value}' is a reserved name"
        
        return True, None


class PathValidator(Validator):
    """Path validation"""
    
    def __init__(self, must_exist: bool = False, must_be_dir: bool = False,
                 must_be_file: bool = False, base_path: Optional[Path] = None):
        self.must_exist = must_exist
        self.must_be_dir = must_be_dir
        self.must_be_file = must_be_file
        self.base_path = Path(base_path) if base_path else None
    
    def validate(self, value: Any) -> Tuple[bool, Optional[str]]:
        try:
            path = Path(value)
        except:
            return False, "Invalid path format"
        
        # Check if path is absolute when it shouldn't be
        if self.base_path and path.is_absolute():
            # Try to make it relative to base
            try:
                path.relative_to(self.base_path)
            except ValueError:
                return False, "Path must be within project directory"
        
        if self.must_exist and not path.exists():
            return False, "Path does not exist"
        
        if self.must_be_dir and path.exists() and not path.is_dir():
            return False, "Path must be a directory"
        
        if self.must_be_file and path.exists() and not path.is_file():
            return False, "Path must be a file"
        
        # Check for path traversal
        try:
            # Resolve to catch .. sequences
            resolved = path.resolve()
            if self.base_path:
                resolved.relative_to(self.base_path.resolve())
        except ValueError:
            return False, "Path traversal detected"
        
        return True, None


class FileValidator(PathValidator):
    """File-specific validation"""
    
    def __init__(self, max_size: int = MAX_CONTEXT_FILE_SIZE,
                 allowed_extensions: Optional[List[str]] = None, **kwargs):
        super().__init__(must_be_file=True, **kwargs)
        self.max_size = max_size
        self.allowed_extensions = allowed_extensions
    
    def validate(self, value: Any) -> Tuple[bool, Optional[str]]:
        is_valid, error = super().validate(value)
        if not is_valid:
            return is_valid, error
        
        path = Path(value)
        
        # Check extension
        if self.allowed_extensions:
            if not any(path.suffix == ext for ext in self.allowed_extensions):
                return False, f"File type not allowed. Allowed types: {self.allowed_extensions}"
        
        # Check size if file exists
        if path.exists():
            size = path.stat().st_size
            if size > self.max_size:
                size_mb = size / (1024 * 1024)
                max_mb = self.max_size / (1024 * 1024)
                return False, f"File too large ({size_mb:.1f}MB). Maximum: {max_mb:.1f}MB"
        
        return True, None


class URLValidator(Validator):
    """URL validation"""
    
    def __init__(self, require_https: bool = False, allowed_domains: Optional[List[str]] = None):
        self.require_https = require_https
        self.allowed_domains = allowed_domains
        self.pattern = re.compile(
            r'^https?://'  # Scheme
            r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+(?:[A-Z]{2,6}\.?|[A-Z0-9-]{2,}\.?)|'  # Domain
            r'localhost|'  # Localhost
            r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'  # IP
            r'(?::\d+)?'  # Port
            r'(?:/?|[/?]\S+)$', re.IGNORECASE)
    
    def validate(self, value: Any) -> Tuple[bool, Optional[str]]:
        if not isinstance(value, str):
            return False, "URL must be a string"
        
        if not self.pattern.match(value):
            return False, "Invalid URL format"
        
        if self.require_https and not value.startswith('https://'):
            return False, "URL must use HTTPS"
        
        if self.allowed_domains:
            # Extract domain
            from urllib.parse import urlparse
            parsed = urlparse(value)
            domain = parsed.netloc.lower()
            
            if not any(domain == d or domain.endswith('.' + d) for d in self.allowed_domains):
                return False, f"Domain not allowed. Allowed: {self.allowed_domains}"
        
        return True, None


class ModelNameValidator(StringValidator):
    """Validate AI model names"""
    
    def __init__(self):
        # Model names typically follow pattern: name:tag
        super().__init__(
            min_length=1,
            max_length=100,
            pattern=r'^[a-zA-Z0-9\-_]+(?::[a-zA-Z0-9\-_.]+)?$'
        )


class ChatMessageValidator(Validator):
    """Validate chat messages"""
    
    def __init__(self, max_length: int = 10000):
        self.max_length = max_length
    
    def validate(self, value: Any) -> Tuple[bool, Optional[str]]:
        if not isinstance(value, str):
            return False, "Message must be a string"
        
        if not value.strip():
            return False, "Message cannot be empty"
        
        if len(value) > self.max_length:
            return False, f"Message too long (max {self.max_length} characters)"
        
        return True, None


class CompoundValidator(Validator):
    """Combine multiple validators"""
    
    def __init__(self, validators: List[Validator]):
        self.validators = validators
    
    def validate(self, value: Any) -> Tuple[bool, Optional[str]]:
        for validator in self.validators:
            is_valid, error = validator.validate(value)
            if not is_valid:
                return is_valid, error
        return True, None


class ValidatorRegistry:
    """Registry of validators for different input types"""
    
    def __init__(self):
        self.validators = {
            'project_name': ProjectNameValidator(),
            'file_path': FileValidator(),
            'directory_path': PathValidator(must_be_dir=True),
            'url': URLValidator(),
            'model_name': ModelNameValidator(),
            'chat_message': ChatMessageValidator(),
        }
    
    def validate(self, input_type: str, value: Any) -> Tuple[bool, Optional[str]]:
        """Validate a value using registered validator"""
        if input_type not in self.validators:
            return True, None  # No validator registered
        
        return self.validators[input_type].validate(value)
    
    def register(self, input_type: str, validator: Validator):
        """Register a custom validator"""
        self.validators[input_type] = validator


# Global validator registry
_validator_registry = ValidatorRegistry()


def validate_input(input_type: str, value: Any) -> Tuple[bool, Optional[str]]:
    """Validate an input value"""
    return _validator_registry.validate(input_type, value)


def ensure_valid(input_type: str, value: Any, context: str = "") -> Any:
    """Ensure a value is valid, raise ValidationError if not"""
    is_valid, error = validate_input(input_type, value)
    if not is_valid:
        if context:
            raise ValidationError(f"{context}: {error}")
        else:
            raise ValidationError(error)
    return value


# Convenience functions
def is_valid_project_name(name: str) -> bool:
    """Check if project name is valid"""
    is_valid, _ = validate_input('project_name', name)
    return is_valid


def is_valid_file_path(path: str, must_exist: bool = False) -> bool:
    """Check if file path is valid"""
    validator = FileValidator(must_exist=must_exist)
    is_valid, _ = validator.validate(path)
    return is_valid


def sanitize_project_name(name: str) -> str:
    """Sanitize a project name to make it valid"""
    # Remove invalid characters
    sanitized = re.sub(r'[^\w\s\-]', '', name)
    # Collapse multiple spaces
    sanitized = re.sub(r'\s+', ' ', sanitized)
    # Trim
    sanitized = sanitized.strip()
    
    if not sanitized:
        sanitized = "untitled"
    
    # Ensure not too long
    if len(sanitized) > 100:
        sanitized = sanitized[:100]
    
    return sanitized