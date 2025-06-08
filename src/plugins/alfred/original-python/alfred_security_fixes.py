#!/usr/bin/env python3
"""
Security fixes and improvements for ALFRED
These functions should replace vulnerable code in alfred.py
"""

import subprocess
import shlex
from pathlib import Path
from typing import Optional, Union
import os
import platform


class SecurityError(Exception):
    """Security-related errors"""
    pass


def validate_path(path: Union[str, Path], base_path: Union[str, Path]) -> Path:
    """
    Validate that a path is within the allowed base path.
    Prevents path traversal attacks.
    
    Args:
        path: Path to validate
        base_path: Base directory that path must be within
        
    Returns:
        Resolved safe path
        
    Raises:
        SecurityError: If path is outside base_path
    """
    path = Path(path).resolve()
    base_path = Path(base_path).resolve()
    
    try:
        # This will raise ValueError if path is not relative to base_path
        path.relative_to(base_path)
        return path
    except ValueError:
        raise SecurityError(f"Path '{path}' is outside allowed directory '{base_path}'")


def safe_file_read(file_path: Union[str, Path], max_size: int = 10 * 1024 * 1024) -> str:
    """
    Safely read a file with size limits.
    
    Args:
        file_path: Path to file
        max_size: Maximum file size in bytes (default 10MB)
        
    Returns:
        File contents
        
    Raises:
        SecurityError: If file is too large
        FileNotFoundError: If file doesn't exist
    """
    file_path = Path(file_path)
    
    if not file_path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")
    
    file_size = file_path.stat().st_size
    if file_size > max_size:
        raise SecurityError(f"File too large: {file_size} bytes (max: {max_size})")
    
    with open(file_path, 'r', encoding='utf-8') as f:
        return f.read()


def safe_open_directory(directory: Union[str, Path]) -> bool:
    """
    Safely open a directory in the system file manager.
    Replaces unsafe os.system() calls.
    
    Args:
        directory: Path to directory
        
    Returns:
        True if successful, False otherwise
    """
    directory = Path(directory)
    
    if not directory.exists() or not directory.is_dir():
        return False
    
    try:
        system = platform.system()
        
        if system == "Darwin":  # macOS
            subprocess.run(['open', str(directory)], check=True)
        elif system == "Linux":
            # Try different Linux file managers
            for cmd in ['xdg-open', 'gnome-open', 'kde-open']:
                try:
                    subprocess.run([cmd, str(directory)], check=True)
                    break
                except (subprocess.CalledProcessError, FileNotFoundError):
                    continue
        elif system == "Windows":
            subprocess.run(['explorer', str(directory)], check=True)
        else:
            return False
            
        return True
        
    except Exception:
        return False


def sanitize_filename(filename: str) -> str:
    """
    Sanitize a filename to prevent security issues.
    
    Args:
        filename: Original filename
        
    Returns:
        Sanitized filename
    """
    # Remove path separators
    filename = filename.replace('/', '_').replace('\\', '_')
    
    # Remove special characters that could cause issues
    invalid_chars = '<>:"|?*'
    for char in invalid_chars:
        filename = filename.replace(char, '_')
    
    # Remove leading/trailing dots and spaces
    filename = filename.strip('. ')
    
    # Limit length
    max_length = 255
    if len(filename) > max_length:
        name, ext = os.path.splitext(filename)
        filename = name[:max_length - len(ext)] + ext
    
    # Ensure filename is not empty
    if not filename:
        filename = "unnamed"
    
    return filename


def safe_json_load(file_path: Union[str, Path], default=None):
    """
    Safely load JSON with error handling.
    
    Args:
        file_path: Path to JSON file
        default: Default value if loading fails
        
    Returns:
        Parsed JSON or default value
    """
    import json
    
    try:
        file_path = Path(file_path)
        if not file_path.exists():
            return default
            
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return default


def safe_json_save(data, file_path: Union[str, Path], indent: int = 2) -> bool:
    """
    Safely save JSON with atomic writes.
    
    Args:
        data: Data to save
        file_path: Path to save to
        indent: JSON indentation
        
    Returns:
        True if successful, False otherwise
    """
    import json
    import tempfile
    
    try:
        file_path = Path(file_path)
        
        # Create parent directory if needed
        file_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Write to temporary file first
        with tempfile.NamedTemporaryFile(
            mode='w',
            dir=file_path.parent,
            delete=False,
            encoding='utf-8'
        ) as tmp_file:
            json.dump(data, tmp_file, indent=indent)
            tmp_path = tmp_file.name
        
        # Atomic rename
        Path(tmp_path).replace(file_path)
        return True
        
    except Exception:
        # Clean up temp file if it exists
        if 'tmp_path' in locals():
            try:
                Path(tmp_path).unlink()
            except:
                pass
        return False


# Example usage in alfred.py:
"""
# Replace this:
os.system(f'open "{log_dir}"')

# With this:
from alfred_security_fixes import safe_open_directory
safe_open_directory(log_dir)

# Replace this:
with open(project_file, 'w') as f:
    json.dump(self.current_project.to_dict(), f, indent=2)

# With this:
from alfred_security_fixes import safe_json_save
safe_json_save(self.current_project.to_dict(), project_file)

# Add path validation:
from alfred_security_fixes import validate_path
try:
    safe_path = validate_path(user_provided_path, self.project_path)
    # Use safe_path
except SecurityError as e:
    messagebox.showerror("Security Error", str(e))
"""