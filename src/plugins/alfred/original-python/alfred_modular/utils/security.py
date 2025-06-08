"""Security utilities for Alfred."""

import os
import re
import logging
from pathlib import Path
from typing import Optional, List

logger = logging.getLogger(__name__)


class SecurityValidator:
    """Validates inputs and operations for security."""
    
    # Patterns for path traversal detection
    PATH_TRAVERSAL_PATTERNS = [
        r'\.\.',  # Parent directory
        r'\.\.[\\/]',  # Parent directory with separator
        r'[\\/]\.\.[\\/]',  # Parent directory in path
        r'^[A-Za-z]:[\\/]',  # Absolute Windows path
        r'^[\\/]',  # Absolute Unix path
        r'~[\\/]',  # Home directory
    ]
    
    # Dangerous filename patterns
    DANGEROUS_FILENAMES = [
        r'^\..*',  # Hidden files
        r'.*\.exe$',  # Executables
        r'.*\.dll$',  # Libraries
        r'.*\.so$',  # Shared objects
        r'.*\.dylib$',  # Mac libraries
        r'.*\.bat$',  # Batch files
        r'.*\.cmd$',  # Command files
        r'.*\.com$',  # Command files
        r'.*\.scr$',  # Screensavers
        r'.*\.vbs$',  # Visual Basic scripts
        r'.*\.ps1$',  # PowerShell scripts
    ]
    
    def __init__(self, 
                 max_path_length: int = 260,
                 max_filename_length: int = 255,
                 allowed_extensions: Optional[List[str]] = None):
        self.max_path_length = max_path_length
        self.max_filename_length = max_filename_length
        self.allowed_extensions = allowed_extensions or []
        
    def validate_path(self, path: str, base_path: Optional[Path] = None) -> bool:
        """Validate a file path for security issues."""
        # Check length
        if len(path) > self.max_path_length:
            logger.warning(f"Path too long: {len(path)} characters")
            return False
            
        # Check for path traversal attempts
        for pattern in self.PATH_TRAVERSAL_PATTERNS:
            if re.search(pattern, path):
                logger.warning(f"Path traversal attempt detected: {path}")
                return False
                
        # If base path provided, ensure path is within it
        if base_path:
            try:
                resolved = Path(path).resolve()
                base_resolved = base_path.resolve()
                
                # Check if path is within base path
                if not str(resolved).startswith(str(base_resolved)):
                    logger.warning(f"Path outside base directory: {path}")
                    return False
            except Exception as e:
                logger.error(f"Path validation error: {e}")
                return False
                
        return True
        
    def validate_filename(self, filename: str) -> bool:
        """Validate a filename for security issues."""
        # Check length
        if len(filename) > self.max_filename_length:
            logger.warning(f"Filename too long: {len(filename)} characters")
            return False
            
        # Check for dangerous patterns
        for pattern in self.DANGEROUS_FILENAMES:
            if re.match(pattern, filename, re.IGNORECASE):
                logger.warning(f"Dangerous filename pattern: {filename}")
                return False
                
        # Check for null bytes
        if '\x00' in filename:
            logger.warning(f"Null byte in filename: {filename}")
            return False
            
        # Check for control characters
        if any(ord(char) < 32 for char in filename):
            logger.warning(f"Control characters in filename: {filename}")
            return False
            
        # Check extension if allowed list provided
        if self.allowed_extensions:
            ext = Path(filename).suffix.lower()
            if ext not in self.allowed_extensions:
                logger.warning(f"Disallowed file extension: {ext}")
                return False
                
        return True
        
    def sanitize_filename(self, filename: str) -> str:
        """Sanitize a filename by removing dangerous characters."""
        # Remove null bytes and control characters
        filename = ''.join(char for char in filename if ord(char) >= 32)
        
        # Replace dangerous characters
        dangerous_chars = '<>:"|?*'
        for char in dangerous_chars:
            filename = filename.replace(char, '_')
            
        # Remove leading/trailing dots and spaces
        filename = filename.strip('. ')
        
        # Limit length
        if len(filename) > self.max_filename_length:
            name, ext = os.path.splitext(filename)
            max_name_length = self.max_filename_length - len(ext)
            filename = name[:max_name_length] + ext
            
        return filename
        
    def validate_file_size(self, size: int, max_size: int) -> bool:
        """Validate file size."""
        if size > max_size:
            logger.warning(f"File too large: {size} bytes (max: {max_size})")
            return False
        return True
        
    def is_safe_to_read(self, filepath: Path, max_size: int = 10 * 1024 * 1024) -> bool:
        """Check if a file is safe to read."""
        if not filepath.exists():
            return False
            
        if not filepath.is_file():
            logger.warning(f"Not a regular file: {filepath}")
            return False
            
        # Check file size
        size = filepath.stat().st_size
        if not self.validate_file_size(size, max_size):
            return False
            
        # Check filename
        if not self.validate_filename(filepath.name):
            return False
            
        return True


class SafeFileOperations:
    """Safe file operations with security checks."""
    
    def __init__(self, validator: Optional[SecurityValidator] = None):
        self.validator = validator or SecurityValidator()
        
    def safe_read(self, filepath: Path, max_size: int = 10 * 1024 * 1024) -> Optional[str]:
        """Safely read a file with security checks."""
        if not self.validator.is_safe_to_read(filepath, max_size):
            return None
            
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                return f.read()
        except Exception as e:
            logger.error(f"Error reading file {filepath}: {e}")
            return None
            
    def safe_write(self, filepath: Path, content: str, base_path: Optional[Path] = None) -> bool:
        """Safely write to a file with security checks."""
        # Validate path
        if not self.validator.validate_path(str(filepath), base_path):
            return False
            
        # Validate filename
        if not self.validator.validate_filename(filepath.name):
            return False
            
        try:
            # Create parent directory if needed
            filepath.parent.mkdir(parents=True, exist_ok=True)
            
            # Write atomically using temporary file
            temp_file = filepath.with_suffix('.tmp')
            with open(temp_file, 'w', encoding='utf-8') as f:
                f.write(content)
                
            # Move to final location
            temp_file.replace(filepath)
            
            return True
            
        except Exception as e:
            logger.error(f"Error writing file {filepath}: {e}")
            return False