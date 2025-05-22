"""
User model for authentication and tracking.

This module defines the User dataclass for managing user authentication,
authorization roles, and tracking within the enterprise chunker system.
"""

from dataclasses import dataclass, field
from typing import Optional, List, Set


@dataclass(frozen=False)
class User:
    """
    User model for the system.
    
    Attributes:
        id: Unique identifier for the user
        username: User's login name
        email: User's email address (optional)
        roles: List of role identifiers the user has in the system
        is_active: Whether the user account is active
    """
    id: str
    username: str
    email: Optional[str] = None
    roles: List[str] = field(default_factory=list)
    is_active: bool = True
    
    def has_role(self, role: str) -> bool:
        """
        Check if user has a specific role.
        
        Args:
            role: The role identifier to check
            
        Returns:
            bool: True if the user has the role, False otherwise
        """
        return role in self.roles
    
    def add_role(self, role: str) -> None:
        """
        Add a role to the user if it doesn't already exist.
        
        Args:
            role: The role identifier to add
        """
        if role not in self.roles:
            self.roles.append(role)
    
    def remove_role(self, role: str) -> None:
        """
        Remove a role from the user if it exists.
        
        Args:
            role: The role identifier to remove
        """
        if role in self.roles:
            self.roles.remove(role)
    
    @property
    def display_name(self) -> str:
        """
        Get a user-friendly display name.
        
        Returns:
            str: Username if no email exists, otherwise the username portion of the email
        """
        if self.email:
            return self.email.split('@')[0]
        return self.username
    
    def __str__(self) -> str:
        """String representation of the user."""
        return f"User(id={self.id}, username={self.username})"