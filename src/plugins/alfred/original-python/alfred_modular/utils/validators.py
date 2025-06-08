"""Input validation utilities."""

import re
from typing import Optional, Tuple
from pathlib import Path


class InputValidator:
    """Validates various types of user input."""
    
    @staticmethod
    def validate_project_name(name: str) -> Tuple[bool, Optional[str]]:
        """Validate a project name."""
        if not name or not name.strip():
            return False, "Project name cannot be empty"
            
        if len(name) > 100:
            return False, "Project name too long (max 100 characters)"
            
        # Check for invalid characters
        if not re.match(r'^[\w\s\-\.]+$', name):
            return False, "Project name contains invalid characters"
            
        return True, None
        
    @staticmethod
    def validate_chat_name(name: str) -> Tuple[bool, Optional[str]]:
        """Validate a chat session name."""
        if not name or not name.strip():
            return False, "Chat name cannot be empty"
            
        if len(name) > 50:
            return False, "Chat name too long (max 50 characters)"
            
        return True, None
        
    @staticmethod
    def validate_model_name(name: str) -> Tuple[bool, Optional[str]]:
        """Validate an AI model name."""
        if not name or not name.strip():
            return False, "Model name cannot be empty"
            
        # Check format (provider:model or just model)
        if not re.match(r'^[\w\-]+(\.[\w\-]+)*(:[a-zA-Z0-9\-\.]+)?$', name):
            return False, "Invalid model name format"
            
        return True, None
        
    @staticmethod
    def validate_url(url: str) -> Tuple[bool, Optional[str]]:
        """Validate a URL."""
        if not url:
            return False, "URL cannot be empty"
            
        # Simple URL validation
        url_pattern = re.compile(
            r'^https?://'  # http:// or https://
            r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|'  # domain...
            r'localhost|'  # localhost...
            r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'  # ...or ip
            r'(?::\d+)?'  # optional port
            r'(?:/?|[/?]\S+)$', re.IGNORECASE)
            
        if not url_pattern.match(url):
            return False, "Invalid URL format"
            
        return True, None
        
    @staticmethod
    def validate_directory_path(path: str) -> Tuple[bool, Optional[str]]:
        """Validate a directory path."""
        if not path:
            return False, "Path cannot be empty"
            
        try:
            path_obj = Path(path)
            
            # Check if parent exists (for new directories)
            if not path_obj.exists() and not path_obj.parent.exists():
                return False, "Parent directory does not exist"
                
            # Check if it's a file (when it exists)
            if path_obj.exists() and not path_obj.is_dir():
                return False, "Path exists but is not a directory"
                
            return True, None
            
        except Exception as e:
            return False, f"Invalid path: {str(e)}"
            
    @staticmethod
    def validate_file_path(path: str) -> Tuple[bool, Optional[str]]:
        """Validate a file path."""
        if not path:
            return False, "Path cannot be empty"
            
        try:
            path_obj = Path(path)
            
            # Check if parent directory exists
            if not path_obj.parent.exists():
                return False, "Parent directory does not exist"
                
            # Check if it's a directory (when it exists)
            if path_obj.exists() and not path_obj.is_file():
                return False, "Path exists but is not a file"
                
            return True, None
            
        except Exception as e:
            return False, f"Invalid path: {str(e)}"
            
    @staticmethod
    def validate_message(message: str, max_length: int = 50000) -> Tuple[bool, Optional[str]]:
        """Validate a chat message."""
        if not message or not message.strip():
            return False, "Message cannot be empty"
            
        if len(message) > max_length:
            return False, f"Message too long (max {max_length} characters)"
            
        return True, None
        
    @staticmethod
    def validate_template_name(name: str) -> Tuple[bool, Optional[str]]:
        """Validate a template name."""
        if not name or not name.strip():
            return False, "Template name cannot be empty"
            
        if len(name) > 50:
            return False, "Template name too long (max 50 characters)"
            
        # Check for valid characters
        if not re.match(r'^[\w\-]+$', name):
            return False, "Template name can only contain letters, numbers, hyphens, and underscores"
            
        return True, None