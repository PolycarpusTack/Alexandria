"""
Hyperion Resource Monitor - Security Module

Provides security features including authentication, authorization, 
and secure configuration management.
"""

import asyncio
import base64
import contextlib
import hashlib
import hmac
import json
import logging
import os
import secrets
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Set, Tuple, Union

logger = logging.getLogger(__name__)


class Permission(Enum):
    """Permissions for authorization"""
    READ_METRICS = "read:metrics"
    WRITE_METRICS = "write:metrics"
    READ_CONFIG = "read:config"
    WRITE_CONFIG = "write:config"
    ADMIN = "admin"


@dataclass
class User:
    """User account for authentication and authorization"""
    username: str
    # Store password hash, never the actual password
    password_hash: str
    salt: str
    permissions: Set[Permission] = field(default_factory=set)
    api_keys: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def has_permission(self, permission: Permission) -> bool:
        """
        Check if user has a specific permission
        
        Args:
            permission: Permission to check
            
        Returns:
            True if user has permission, False otherwise
        """
        # Admin has all permissions
        if Permission.ADMIN in self.permissions:
            return True
            
        return permission in self.permissions
    
    def generate_api_key(self, name: str, expires_in: Optional[int] = None) -> str:
        """
        Generate a new API key for this user
        
        Args:
            name: Key name for reference
            expires_in: Optional expiration time in seconds
            
        Returns:
            The generated API key
        """
        # Generate a secure random API key
        api_key = secrets.token_urlsafe(32)
        
        # Calculate expiration time
        expires_at = None
        if expires_in is not None:
            expires_at = int(time.time()) + expires_in
            
        # Store API key information
        self.api_keys[api_key] = {
            "name": name,
            "created_at": int(time.time()),
            "expires_at": expires_at,
            "last_used": None
        }
        
        return api_key
    
    def revoke_api_key(self, api_key: str) -> bool:
        """
        Revoke an API key
        
        Args:
            api_key: API key to revoke
            
        Returns:
            True if key was revoked, False if not found
        """
        if api_key in self.api_keys:
            del self.api_keys[api_key]
            return True
        return False
    
    def is_api_key_valid(self, api_key: str) -> bool:
        """
        Check if an API key is valid
        
        Args:
            api_key: API key to validate
            
        Returns:
            True if key is valid, False otherwise
        """
        if api_key not in self.api_keys:
            return False
            
        # Check expiration
        key_info = self.api_keys[api_key]
        if key_info.get("expires_at") and key_info["expires_at"] < int(time.time()):
            return False
            
        # Update last used timestamp
        key_info["last_used"] = int(time.time())
        
        return True


class SecurityManager:
    """
    Central security management for the application
    
    Provides authentication, authorization, and secure operations.
    """
    
    def __init__(self, config_path: Optional[str] = None):
        """
        Initialize security manager
        
        Args:
            config_path: Path to security configuration file
        """
        self.users = {}  # username -> User
        self.config_path = config_path
        self.token_cache = {}  # token -> (username, expiry)
        self.key_strength = 16  # For key generation
        
        # Default admin credentials for initial setup - should be changed
        self._create_default_admin()
        
        # Load configuration if available
        if config_path and os.path.exists(config_path):
            self._load_config()
        
        logger.info("Security manager initialized")
    
    def _create_default_admin(self) -> None:
        """Create default admin user for initial setup"""
        # Check if environment variables are set for admin credentials
        admin_user = os.environ.get("HYPERION_ADMIN_USER", "admin")
        admin_pass = os.environ.get("HYPERION_ADMIN_PASS")
        
        if admin_pass:
            # Create admin with provided password
            self.create_user(
                username=admin_user,
                password=admin_pass,
                permissions={Permission.ADMIN}
            )
            logger.info(f"Created admin user '{admin_user}' from environment variables")
        else:
            # Don't create default admin without password from environment
            pass
    
    def _load_config(self) -> None:
        """Load security configuration from file"""
        try:
            with open(self.config_path, 'r') as f:
                config = json.load(f)
                
            # Load users
            for user_data in config.get("users", []):
                username = user_data.get("username")
                if not username:
                    continue
                    
                # Create user object
                user = User(
                    username=username,
                    password_hash=user_data.get("password_hash", ""),
                    salt=user_data.get("salt", ""),
                    permissions=set(Permission(p) for p in user_data.get("permissions", [])),
                    api_keys=user_data.get("api_keys", {}),
                    metadata=user_data.get("metadata", {})
                )
                
                self.users[username] = user
                
            logger.info(f"Loaded {len(self.users)} users from configuration")
            
        except Exception as e:
            logger.error(f"Error loading security configuration: {str(e)}", exc_info=True)
    
    def _save_config(self) -> None:
        """Save security configuration to file"""
        if not self.config_path:
            logger.warning("No config path set, security configuration won't be saved")
            return
            
        try:
            # Convert user objects to serializable dictionaries
            users_data = []
            for user in self.users.values():
                user_data = {
                    "username": user.username,
                    "password_hash": user.password_hash,
                    "salt": user.salt,
                    "permissions": [p.value for p in user.permissions],
                    "api_keys": user.api_keys,
                    "metadata": user.metadata
                }
                users_data.append(user_data)
                
            # Create configuration object
            config = {
                "users": users_data
            }
            
            # Save to file (atomic write)
            temp_path = f"{self.config_path}.tmp"
            with open(temp_path, 'w') as f:
                json.dump(config, f, indent=2)
                
            # Rename to actual path (atomic operation)
            os.rename(temp_path, self.config_path)
            
            logger.info(f"Saved security configuration with {len(self.users)} users")
            
        except Exception as e:
            logger.error(f"Error saving security configuration: {str(e)}", exc_info=True)
    
    def _hash_password(self, password: str, salt: Optional[str] = None) -> Tuple[str, str]:
        """
        Hash a password with a salt
        
        Args:
            password: Plain text password
            salt: Optional salt (generated if not provided)
            
        Returns:
            Tuple of (password_hash, salt)
        """
        # Generate salt if not provided
        if salt is None:
            salt = secrets.token_hex(16)
            
        # Hash the password with the salt
        key = hashlib.pbkdf2_hmac(
            'sha256',
            password.encode('utf-8'),
            salt.encode('utf-8'),
            100000  # Number of iterations
        )
        
        # Convert to hex for storage
        password_hash = key.hex()
        
        return password_hash, salt
    
    def create_user(
        self,
        username: str,
        password: str,
        permissions: Optional[Set[Permission]] = None
    ) -> User:
        """
        Create a new user
        
        Args:
            username: Username
            password: Plain text password
            permissions: Set of permissions
            
        Returns:
            Created user object
        """
        # Check if user already exists
        if username in self.users:
            raise ValueError(f"User '{username}' already exists")
            
        # Hash the password
        password_hash, salt = self._hash_password(password)
        
        # Create user object
        user = User(
            username=username,
            password_hash=password_hash,
            salt=salt,
            permissions=permissions or set()
        )
        
        # Store user
        self.users[username] = user
        
        # Save updated configuration
        self._save_config()
        
        logger.info(f"Created user: {username}")
        
        return user
    
    def authenticate(self, username: str, password: str) -> bool:
        """
        Authenticate a user with username and password
        
        Args:
            username: Username
            password: Plain text password
            
        Returns:
            True if authentication succeeded, False otherwise
        """
        # Check if user exists
        if username not in self.users:
            logger.warning(f"Authentication failed: User '{username}' not found")
            return False
            
        user = self.users[username]
        
        # Hash the provided password with the user's salt
        password_hash, _ = self._hash_password(password, user.salt)
        
        # Compare with stored hash
        if password_hash == user.password_hash:
            logger.info(f"User '{username}' authenticated successfully")
            return True
        
        logger.warning(f"Authentication failed for user '{username}': Invalid password")
        return False
    
    def authenticate_with_key(self, api_key: str) -> Optional[str]:
        """
        Authenticate using an API key
        
        Args:
            api_key: API key
            
        Returns:
            Username if authenticated, None otherwise
        """
        # Check all users for matching API key
        for username, user in self.users.items():
            if user.is_api_key_valid(api_key):
                logger.info(f"User '{username}' authenticated with API key")
                return username
                
        logger.warning("API key authentication failed: Invalid key")
        return None
    
    def generate_token(self, username: str, expires_in: int = 3600) -> Optional[str]:
        """
        Generate authentication token for a user
        
        Args:
            username: Username
            expires_in: Token validity in seconds
            
        Returns:
            Authentication token or None if user not found
        """
        # Check if user exists
        if username not in self.users:
            logger.warning(f"Token generation failed: User '{username}' not found")
            return None
            
        # Generate token
        token = secrets.token_urlsafe(32)
        expiry = int(time.time()) + expires_in
        
        # Store in token cache
        self.token_cache[token] = (username, expiry)
        
        logger.info(f"Generated token for user '{username}', valid for {expires_in}s")
        
        return token
    
    def validate_token(self, token: str) -> Optional[str]:
        """
        Validate an authentication token
        
        Args:
            token: Authentication token
            
        Returns:
            Username if token is valid, None otherwise
        """
        # Check if token exists in cache
        if token not in self.token_cache:
            return None
            
        username, expiry = self.token_cache[token]
        
        # Check if token has expired
        if expiry < int(time.time()):
            # Remove expired token
            del self.token_cache[token]
            return None
            
        return username
    
    def revoke_token(self, token: str) -> bool:
        """
        Revoke an authentication token
        
        Args:
            token: Authentication token
            
        Returns:
            True if token was revoked, False if not found
        """
        if token in self.token_cache:
            del self.token_cache[token]
            logger.info("Token revoked")
            return True
            
        return False
    
    def check_permission(self, username: str, permission: Permission) -> bool:
        """
        Check if a user has a specific permission
        
        Args:
            username: Username
            permission: Permission to check
            
        Returns:
            True if user has permission, False otherwise
        """
        # Check if user exists
        if username not in self.users:
            return False
            
        return self.users[username].has_permission(permission)
    
    def encrypt_sensitive_data(self, data: str) -> str:
        """
        Encrypt sensitive data
        
        Args:
            data: Data to encrypt
            
        Returns:
            Encrypted data as a string
        """
        # In a real implementation, this would use a proper encryption library
        # This is a placeholder using base64 encoding - NOT secure!
        return base64.b64encode(data.encode('utf-8')).decode('utf-8')
    
    def decrypt_sensitive_data(self, encrypted_data: str) -> str:
        """
        Decrypt sensitive data
        
        Args:
            encrypted_data: Encrypted data
            
        Returns:
            Decrypted data
        """
        # In a real implementation, this would use a proper encryption library
        # This is a placeholder using base64 decoding - NOT secure!
        return base64.b64decode(encrypted_data.encode('utf-8')).decode('utf-8')
    
    def secure_hash(self, data: str) -> str:
        """
        Create a secure hash of data
        
        Args:
            data: Data to hash
            
        Returns:
            Secure hash as a hex string
        """
        return hashlib.sha256(data.encode('utf-8')).hexdigest()
    
    def generate_secure_id(self) -> str:
        """
        Generate a secure random identifier
        
        Returns:
            Secure random identifier
        """
        return secrets.token_urlsafe(self.key_strength)
    
    @contextlib.contextmanager
    def elevated_permissions(self, reason: str) -> None:
        """
        Context manager for temporary elevated permissions
        
        Args:
            reason: Reason for elevation
            
        Yields:
            None
        """
        # Log elevation
        logger.info(f"Elevating permissions: {reason}")
        
        try:
            # In a real implementation, this would modify the current security context
            yield
        finally:
            # Log end of elevation
            logger.info("Permission elevation ended")
    
    async def rotate_keys(self) -> None:
        """Rotate security keys periodically"""
        # In a real implementation, this would rotate encryption keys
        logger.info("Security keys rotated")


class AccessControl:
    """
    Access control for API endpoints and operations
    
    Provides decorators and middleware for enforcing security policies.
    """
    
    def __init__(self, security_manager: SecurityManager):
        """
        Initialize access control
        
        Args:
            security_manager: Security manager instance
        """
        self.security_manager = security_manager
    
    def require_permission(self, permission: Permission):
        """
        Decorator requiring a permission for a function
        
        Args:
            permission: Required permission
            
        Returns:
            Decorator function
        """
        def decorator(func):
            @functools.wraps(func)
            async def async_wrapper(*args, **kwargs):
                # Extract request object (assuming first arg after self)
                request = args[1] if len(args) > 1 else None
                
                # Get authentication token from request
                token = self._extract_auth_token(request)
                if not token:
                    raise PermissionError("Authentication required")
                    
                # Validate token
                username = self.security_manager.validate_token(token)
                if not username:
                    raise PermissionError("Invalid or expired authentication token")
                    
                # Check permission
                if not self.security_manager.check_permission(username, permission):
                    raise PermissionError(f"Missing required permission: {permission.value}")
                    
                # Set username in request for later use
                if request:
                    setattr(request, 'username', username)
                    
                # Call the function
                return await func(*args, **kwargs)
            
            @functools.wraps(func)
            def sync_wrapper(*args, **kwargs):
                # Extract request object (assuming first arg after self)
                request = args[1] if len(args) > 1 else None
                
                # Get authentication token from request
                token = self._extract_auth_token(request)
                if not token:
                    raise PermissionError("Authentication required")
                    
                # Validate token
                username = self.security_manager.validate_token(token)
                if not username:
                    raise PermissionError("Invalid or expired authentication token")
                    
                # Check permission
                if not self.security_manager.check_permission(username, permission):
                    raise PermissionError(f"Missing required permission: {permission.value}")
                    
                # Set username in request for later use
                if request:
                    setattr(request, 'username', username)
                    
                # Call the function
                return func(*args, **kwargs)
            
            # Use the appropriate wrapper based on the function type
            if asyncio.iscoroutinefunction(func):
                return async_wrapper
            else:
                return sync_wrapper
        
        return decorator
    
    def _extract_auth_token(self, request) -> Optional[str]:
        """
        Extract authentication token from request
        
        Args:
            request: HTTP request object
            
        Returns:
            Authentication token or None
        """
        # This is a placeholder - real implementation would depend on the web framework
        # For example, extracting from Authorization header
        if hasattr(request, 'headers') and 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                return auth_header[7:]
                
        # Try from query params
        if hasattr(request, 'query_params') and 'token' in request.query_params:
            return request.query_params['token']
            
        return None
    
    async def authenticate_request(self, request) -> Optional[str]:
        """
        Authenticate a request
        
        Args:
            request: HTTP request object
            
        Returns:
            Username if authenticated, None otherwise
        """
        # Try token authentication
        token = self._extract_auth_token(request)
        if token:
            return self.security_manager.validate_token(token)
            
        # Try API key authentication
        api_key = self._extract_api_key(request)
        if api_key:
            return self.security_manager.authenticate_with_key(api_key)
            
        return None
    
    def _extract_api_key(self, request) -> Optional[str]:
        """
        Extract API key from request
        
        Args:
            request: HTTP request object
            
        Returns:
            API key or None
        """
        # This is a placeholder - real implementation would depend on the web framework
        # Try from headers
        if hasattr(request, 'headers') and 'X-API-Key' in request.headers:
            return request.headers['X-API-Key']
            
        # Try from query params
        if hasattr(request, 'query_params') and 'api_key' in request.query_params:
            return request.query_params['api_key']
            
        return None


class SecureCommunication:
    """
    Secure communication utilities
    
    Provides methods for verifying message authenticity and integrity.
    """
    
    def __init__(self, secret_key: Optional[str] = None):
        """
        Initialize secure communication
        
        Args:
            secret_key: Secret key for HMAC (generated if not provided)
        """
        self.secret_key = secret_key or secrets.token_hex(32)
    
    def sign_message(self, message: str) -> str:
        """
        Sign a message with HMAC
        
        Args:
            message: Message to sign
            
        Returns:
            Signature as a hex string
        """
        signature = hmac.new(
            self.secret_key.encode('utf-8'),
            message.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        
        return signature
    
    def verify_signature(self, message: str, signature: str) -> bool:
        """
        Verify a message signature
        
        Args:
            message: Original message
            signature: Signature to verify
            
        Returns:
            True if signature is valid, False otherwise
        """
        expected_signature = self.sign_message(message)
        return hmac.compare_digest(expected_signature, signature)
    
    def secure_message(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a secure message with signature
        
        Args:
            message: Message content
            
        Returns:
            Secure message with signature
        """
        # Convert message to string
        message_str = json.dumps(message, sort_keys=True)
        
        # Sign the message
        signature = self.sign_message(message_str)
        
        # Add timestamp for replay protection
        secured = {
            "content": message,
            "timestamp": int(time.time()),
            "signature": signature
        }
        
        return secured
    
    def verify_secure_message(
        self,
        secured_message: Dict[str, Any],
        max_age: int = 300
    ) -> Optional[Dict[str, Any]]:
        """
        Verify and extract content from a secure message
        
        Args:
            secured_message: Secure message to verify
            max_age: Maximum age of message in seconds
            
        Returns:
            Original message content if verified, None otherwise
        """
        # Check required fields
        if not all(k in secured_message for k in ["content", "timestamp", "signature"]):
            logger.warning("Invalid secure message format")
            return None
            
        # Check message age
        message_time = secured_message["timestamp"]
        current_time = int(time.time())
        
        if current_time - message_time > max_age:
            logger.warning(f"Message too old: {current_time - message_time}s")
            return None
            
        # Reconstruct the original message string
        original = {
            "content": secured_message["content"],
            "timestamp": secured_message["timestamp"]
        }
        original_str = json.dumps(original, sort_keys=True)
        
        # Verify signature
        if not self.verify_signature(original_str, secured_message["signature"]):
            logger.warning("Invalid message signature")
            return None
            
        return secured_message["content"]
