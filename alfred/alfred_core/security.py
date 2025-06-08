"""
Security Manager - Input validation, sanitization, and permissions for ALFRED
"""

import re
import html
import logging
import hashlib
import hmac
import secrets
from typing import Dict, List, Any, Optional, Set
from datetime import datetime, timedelta
from functools import wraps
import json
from pathlib import Path

logger = logging.getLogger(__name__)


class SecurityManager:
    """Manages security aspects of ALFRED"""
    
    # Permissions that plugins can request
    PERMISSIONS = {
        "filesystem.read": "Read files from the filesystem",
        "filesystem.write": "Write files to the filesystem",
        "network.request": "Make network requests",
        "system.execute": "Execute system commands",
        "ui.notification": "Show system notifications",
        "ai.query": "Query AI models",
        "data.user": "Access user data",
        "data.history": "Access chat history",
        "plugin.install": "Install other plugins",
        "config.modify": "Modify application configuration"
    }
    
    def __init__(self, config_dir: str = ".alfred"):
        self.config_dir = Path.home() / config_dir
        self.config_dir.mkdir(exist_ok=True)
        
        # Permission storage
        self.granted_permissions: Dict[str, Set[str]] = {}
        self._load_permissions()
        
        # Rate limiting
        self.rate_limits: Dict[str, List[datetime]] = {}
        self.rate_limit_window = timedelta(minutes=1)
        self.default_rate_limit = 60  # requests per minute
        
        # Input validation patterns
        self.validators = {
            "url": re.compile(
                r'^https?://'
                r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|'
                r'localhost|'
                r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'
                r'(?::\d+)?'
                r'(?:/?|[/?]\S+)$',
                re.IGNORECASE
            ),
            "email": re.compile(
                r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
            ),
            "path": re.compile(
                r'^[a-zA-Z0-9_\-./\\]+$'
            ),
            "command": re.compile(
                r'^[a-zA-Z0-9_\-\s]+$'
            )
        }
        
        # Dangerous patterns to block
        self.dangerous_patterns = [
            # Path traversal
            re.compile(r'\.\.[\\/]'),
            re.compile(r'\.\.%2[fF]'),
            re.compile(r'\.\.%5[cC]'),
            
            # Command injection
            re.compile(r'[;&|`$]'),
            re.compile(r'\$\([^)]*\)'),
            re.compile(r'`[^`]*`'),
            
            # SQL injection patterns
            re.compile(r"('|\"|;|--|\*/|/\*|xp_|sp_|<script|javascript:|onerror=)", re.IGNORECASE),
            
            # XSS patterns
            re.compile(r'<script[^>]*>.*?</script>', re.IGNORECASE),
            re.compile(r'javascript:', re.IGNORECASE),
            re.compile(r'on\w+\s*=', re.IGNORECASE)
        ]
    
    def validate_input(self, value: str, input_type: str = "text") -> bool:
        """Validate input based on type"""
        if not value or not isinstance(value, str):
            return False
            
        # Check length
        if len(value) > 10000:  # Max 10KB input
            logger.warning("Input too long")
            return False
            
        # Check for dangerous patterns
        for pattern in self.dangerous_patterns:
            if pattern.search(value):
                logger.warning(f"Dangerous pattern detected in input: {pattern.pattern}")
                return False
        
        # Type-specific validation
        if input_type in self.validators:
            if not self.validators[input_type].match(value):
                logger.warning(f"Input failed {input_type} validation")
                return False
                
        return True
    
    def sanitize_output(self, text: str) -> str:
        """Sanitize output for display"""
        if not isinstance(text, str):
            text = str(text)
            
        # HTML escape
        text = html.escape(text)
        
        # Remove any remaining suspicious patterns
        text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.IGNORECASE)
        text = re.sub(r'javascript:', '', text, flags=re.IGNORECASE)
        text = re.sub(r'on\w+\s*=', '', text, flags=re.IGNORECASE)
        
        return text
    
    def sanitize_path(self, path: str) -> Optional[str]:
        """Sanitize file paths to prevent traversal attacks"""
        if not self.validate_input(path, "path"):
            return None
            
        # Resolve to absolute path and check if it's within allowed directories
        try:
            resolved = Path(path).resolve()
            
            # Define allowed directories (customize as needed)
            allowed_dirs = [
                Path.home(),
                Path.cwd(),
                Path("/tmp"),
                Path("/var/tmp")
            ]
            
            # Check if path is within allowed directories
            for allowed in allowed_dirs:
                try:
                    resolved.relative_to(allowed)
                    return str(resolved)
                except ValueError:
                    continue
                    
            logger.warning(f"Path {path} is outside allowed directories")
            return None
            
        except Exception as e:
            logger.error(f"Error sanitizing path: {e}")
            return None
    
    def check_rate_limit(self, identifier: str, limit: Optional[int] = None) -> bool:
        """Check if rate limit is exceeded"""
        if limit is None:
            limit = self.default_rate_limit
            
        now = datetime.now()
        
        # Clean old entries
        if identifier in self.rate_limits:
            self.rate_limits[identifier] = [
                timestamp for timestamp in self.rate_limits[identifier]
                if now - timestamp < self.rate_limit_window
            ]
        else:
            self.rate_limits[identifier] = []
        
        # Check limit
        if len(self.rate_limits[identifier]) >= limit:
            logger.warning(f"Rate limit exceeded for {identifier}")
            return False
            
        # Record this request
        self.rate_limits[identifier].append(now)
        return True
    
    def check_plugin_permissions(self, plugin_name: str, required_permissions: List[str]) -> bool:
        """Check if a plugin has required permissions"""
        if not required_permissions:
            return True
            
        if plugin_name not in self.granted_permissions:
            logger.warning(f"Plugin {plugin_name} has no granted permissions")
            return False
            
        granted = self.granted_permissions[plugin_name]
        
        for permission in required_permissions:
            if permission not in self.PERMISSIONS:
                logger.error(f"Unknown permission requested: {permission}")
                return False
            if permission not in granted:
                logger.warning(f"Plugin {plugin_name} lacks permission: {permission}")
                return False
                
        return True
    
    def grant_permissions(self, plugin_name: str, permissions: List[str]) -> None:
        """Grant permissions to a plugin"""
        if plugin_name not in self.granted_permissions:
            self.granted_permissions[plugin_name] = set()
            
        for permission in permissions:
            if permission in self.PERMISSIONS:
                self.granted_permissions[plugin_name].add(permission)
                logger.info(f"Granted {permission} to {plugin_name}")
            else:
                logger.warning(f"Unknown permission: {permission}")
                
        self._save_permissions()
    
    def revoke_permissions(self, plugin_name: str, permissions: Optional[List[str]] = None) -> None:
        """Revoke permissions from a plugin"""
        if plugin_name not in self.granted_permissions:
            return
            
        if permissions is None:
            # Revoke all permissions
            del self.granted_permissions[plugin_name]
        else:
            # Revoke specific permissions
            for permission in permissions:
                self.granted_permissions[plugin_name].discard(permission)
                
        self._save_permissions()
        logger.info(f"Revoked permissions from {plugin_name}")
    
    def create_token(self, data: Dict[str, Any], secret: str) -> str:
        """Create a secure token"""
        payload = json.dumps(data, sort_keys=True)
        signature = hmac.new(
            secret.encode(),
            payload.encode(),
            hashlib.sha256
        ).hexdigest()
        return f"{payload}.{signature}"
    
    def verify_token(self, token: str, secret: str) -> Optional[Dict[str, Any]]:
        """Verify and decode a token"""
        try:
            payload, signature = token.rsplit('.', 1)
            expected_signature = hmac.new(
                secret.encode(),
                payload.encode(),
                hashlib.sha256
            ).hexdigest()
            
            if hmac.compare_digest(signature, expected_signature):
                return json.loads(payload)
            else:
                logger.warning("Invalid token signature")
                return None
                
        except Exception as e:
            logger.error(f"Token verification failed: {e}")
            return None
    
    def generate_secret(self, length: int = 32) -> str:
        """Generate a cryptographically secure secret"""
        return secrets.token_urlsafe(length)
    
    def _load_permissions(self) -> None:
        """Load permissions from storage"""
        perm_file = self.config_dir / "permissions.json"
        if perm_file.exists():
            try:
                with open(perm_file, 'r') as f:
                    data = json.load(f)
                    self.granted_permissions = {
                        k: set(v) for k, v in data.items()
                    }
            except Exception as e:
                logger.error(f"Failed to load permissions: {e}")
    
    def _save_permissions(self) -> None:
        """Save permissions to storage"""
        perm_file = self.config_dir / "permissions.json"
        try:
            data = {
                k: list(v) for k, v in self.granted_permissions.items()
            }
            with open(perm_file, 'w') as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save permissions: {e}")


def require_permission(permission: str):
    """Decorator to require permission for a method"""
    def decorator(func):
        @wraps(func)
        def wrapper(self, *args, **kwargs):
            if hasattr(self, '_plugin_name') and hasattr(self, '_app'):
                if not self._app.security.check_plugin_permissions(
                    self._plugin_name,
                    [permission]
                ):
                    raise PermissionError(f"Permission denied: {permission}")
            return func(self, *args, **kwargs)
        return wrapper
    return decorator


def validate_input_decorator(input_type: str = "text", param_index: int = 0):
    """Decorator to validate function inputs"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Get the value to validate
            if param_index < len(args):
                value = args[param_index]
            else:
                # Try to get from kwargs
                param_names = func.__code__.co_varnames[:func.__code__.co_argcount]
                if param_index < len(param_names):
                    param_name = param_names[param_index]
                    value = kwargs.get(param_name)
                else:
                    value = None
                    
            if value and isinstance(value, str):
                # Get security manager (assumes it's available globally or via self)
                from . import get_security_manager
                security = get_security_manager()
                if not security.validate_input(value, input_type):
                    raise ValueError(f"Invalid {input_type} input")
                    
            return func(*args, **kwargs)
        return wrapper
    return decorator