"""
Configuration management for the EnterpriseChunker
"""

import os
from typing import Dict, Any, Optional, Union, TypeVar, cast

from enterprise_chunker.models.enums import ChunkingStrategy, TokenEstimationStrategy


T = TypeVar('T')


class ConfigManager:
    """Configuration management with environment variable support"""
    
    # Single source of truth for default configuration values
    DEFAULT_CONFIG = {
        "max_tokens_per_chunk": 4000,
        "overlap_tokens": 200,
        "reserved_tokens": 1000,
        "chunking_strategy": ChunkingStrategy.ADAPTIVE,
        "token_strategy": TokenEstimationStrategy.BALANCED,
        "preserve_structure": True,
        "enable_format_detection": True,
        "format_detection_sample_size": 2500,
        "add_metadata_comments": True,
        "safety_margin": 0.9,
        "max_chunk_size_chars": 0,
        "target_chunk_ratio": 0.8,
        "stream_buffer_size": 100000,
        "cache_size": 1000,
        "respect_sentences": True,
    }
    
    ENV_PREFIX = "CHUNKER_"
    
    @classmethod
    def get_config(cls, overrides: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Get configuration with environment variables and overrides
        
        Args:
            overrides: Optional configuration overrides
            
        Returns:
            Dictionary with complete configuration
        """
        # Deep copy by creating a new dictionary
        config = {k: v for k, v in cls.DEFAULT_CONFIG.items()}
        
        # Convert enum instances to string values for proper serialization and handling
        for key, value in config.items():
            if hasattr(value, 'value') and not isinstance(value, (str, int, float, bool)):
                config[key] = value.value
        
        # Environment variables override defaults
        for key in config:
            env_key = f"{cls.ENV_PREFIX}{key.upper()}"
            if env_key in os.environ:
                try:
                    config[key] = cls._parse_env_value(env_key, config[key])
                except (ValueError, TypeError) as e:
                    # Log error and keep default if parsing fails
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.error(f"Error parsing environment variable {env_key}: {e}. Using default value.")
                
        # Explicit overrides take precedence
        if overrides:
            config.update(overrides)
            
        # Convert string enum values to enum instances
        for enum_key, enum_class in [
            ("chunking_strategy", ChunkingStrategy),
            ("token_strategy", TokenEstimationStrategy)
        ]:
            if isinstance(config[enum_key], str):
                try:
                    config[enum_key] = enum_class(config[enum_key])
                except ValueError:
                    # Fallback to default if invalid enum value
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.error(f"Invalid value for {enum_key}: {config[enum_key]}. Using default.")
                    config[enum_key] = cls.DEFAULT_CONFIG[enum_key]
            
        return config
    
    @staticmethod
    def _parse_env_value(env_key: str, default_value: Any) -> Any:
        """
        Parse environment variable to appropriate type
        
        Args:
            env_key: Environment variable key
            default_value: Default value to determine type
            
        Returns:
            Parsed value with appropriate type
        """
        value = os.environ[env_key]
        
        # Convert to correct type based on default
        if isinstance(default_value, bool):
            return value.lower() in ('true', 'yes', '1', 'on')
        elif isinstance(default_value, int):
            return int(value)
        elif isinstance(default_value, float):
            return float(value)
        elif hasattr(default_value, 'value') and not isinstance(default_value, (str, int, float, bool)):
            # Handling enum string values
            return value
        else:
            return value
    
    @classmethod
    def create_options(cls, overrides: Optional[Dict[str, Any]] = None) -> 'ChunkingOptions':
        """
        Create ChunkingOptions with environment and override configuration
        
        Args:
            overrides: Optional configuration overrides
            
        Returns:
            ChunkingOptions instance
        """
        config = cls.get_config(overrides)
        return ChunkingOptions(**config)


class ChunkingOptions:
    """Configuration options for chunking"""
    
    def __init__(self, **kwargs):
        """
        Initialize chunking options from provided kwargs
        
        Args:
            **kwargs: Configuration parameters
        """
        # Get defaults from ConfigManager to avoid duplication
        defaults = ConfigManager.DEFAULT_CONFIG
        
        # Apply the provided kwargs with the defaults as fallback
        for key, default_value in defaults.items():
            setattr(self, key, kwargs.get(key, default_value))
        
    def get_effective_max_tokens(self) -> int:
        """
        Calculate effective maximum tokens, accounting for reserved tokens and safety margin
        
        Returns:
            Effective maximum tokens that should be used for chunking
        """
        # Apply both reserved_tokens and safety_margin to calculate the actual limit
        max_effective = int(self.max_tokens_per_chunk * self.safety_margin)
        max_with_reserved = max(0, self.max_tokens_per_chunk - self.reserved_tokens)
        
        # Use the more restrictive of the two approaches
        return min(max_effective, max_with_reserved)
    
    def to_dict(self) -> Dict[str, Any]:
        """
        Convert options to dictionary
        
        Returns:
            Dictionary representation of options
        """
        result = {}
        for key in ConfigManager.DEFAULT_CONFIG:
            value = getattr(self, key)
            # Convert enum instances to their string representation
            if hasattr(value, 'value') and not isinstance(value, (str, int, float, bool)):
                value = value.value
            result[key] = value
        return result