"""
Token estimation utilities for text analysis

This module provides accurate estimation of token counts for different types of text,
which is essential for planning chunking strategies and managing model context limits.
"""

import re
import math
import hashlib
from functools import lru_cache
from typing import Dict, Any, Optional, List, Set, Union, Pattern, Match, Iterable, Tuple

try:
    import regex  # Try to import the third-party regex library
    HAS_REGEX_LIB = True
except ImportError:
    HAS_REGEX_LIB = False

from enterprise_chunker.models.enums import TokenEstimationStrategy
from enterprise_chunker.models.content_features import ContentFeatures
from enterprise_chunker.patterns.regex_patterns import RegexPatterns


class BaseTokenEstimator:
    """Base class for token estimation strategies"""
    
    def __init__(self):
        """Initialize the token estimator with caching and regex patterns"""
        self._token_cache = {}
        self._token_cache_keys = []
        self._cache_size = 1000
        self._patterns = RegexPatterns.get_token_estimation_patterns()
        
        # Create additional patterns for non-Latin scripts
        self._arabic_pattern = re.compile(r'[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]')
        self._hebrew_pattern = re.compile(r'[\u0590-\u05FF\uFB1D-\uFB4F]')
    
    def estimate(self, text: str) -> int:
        """
        Estimate tokens in text
        
        Args:
            text: Input text
            
        Returns:
            Estimated token count
        """
        # Handle empty or trivial inputs
        if not text:
            return 0
        if len(text) <= 1:
            return 1
        
        # For long inputs, use cache
        if len(text) > 100:
            # Generate a cache key based on length and samplings
            # Take samples from beginning, middle, and end for better cache hit rate
            middle_idx = len(text) // 2
            cache_sample = f"{text[:20]}:{text[middle_idx-10:middle_idx+10]}:{text[-20:]}"
            cache_key = f"{len(text)}:{hashlib.md5(cache_sample.encode()).hexdigest()}"
            
            if cache_key in self._token_cache:
                return self._token_cache[cache_key]
        else:
            cache_key = None
        
        # Extract features for estimation
        features = self._extract_text_features(text)
        
        # Calculate estimate based on features
        count = self._calculate_estimate(features, text)
        
        # Update cache for non-trivial inputs
        if cache_key:
            # LRU-like cache management
            if len(self._token_cache) >= self._cache_size:
                old_key = self._token_cache_keys.pop(0)
                self._token_cache.pop(old_key, None)
                
            self._token_cache[cache_key] = count
            self._token_cache_keys.append(cache_key)
            
        return count
    
    def _extract_text_features(self, text: str) -> ContentFeatures:
        """
        Extract features from text for token estimation
        
        Args:
            text: Input text
            
        Returns:
            ContentFeatures object with extracted features
        """
        # Handle empty text
        if not text:
            return ContentFeatures(
                length=0,
                word_count=0,
                whitespace_ratio=0,
                symbol_density=0,
                has_cjk=False,
                has_emoji=False,
                avg_word_length=0
            )
            
        # Basic counts
        word_matches = re.findall(r'\b\w+\b', text)
        word_count = len(word_matches)
        whitespace_count = len(self._patterns['whitespace'].findall(text))
        symbol_count = len(self._patterns['punctuation'].findall(text))
        
        # Calculate ratios
        whitespace_ratio = whitespace_count / max(1, len(text))  # Avoid division by zero
        symbol_density = symbol_count / max(1, len(text))  # Avoid division by zero
        
        # Language checks
        has_cjk = bool(self._patterns['cjk'].search(text))
        has_emoji = bool(self._patterns['emoji'].search(text))
        has_arabic = bool(self._arabic_pattern.search(text))
        has_hebrew = bool(self._hebrew_pattern.search(text))
        
        # Calculate average word length
        avg_word_length = (
            sum(len(word) for word in word_matches) / max(1, word_count)  # Avoid division by zero
        )
        
        # Approximate sentence count
        sentences_count = len(re.findall(r'[.!?]+\s+', text)) + 1
        
        # Check for markdown features - use native format detection from RegexPatterns
        from enterprise_chunker.models.enums import ContentFormat
        format_patterns = RegexPatterns.get_format_patterns(ContentFormat.MARKDOWN)  # Use markdown format
        has_code_blocks = bool(format_patterns['code_blocks'].search(text))
        has_list_items = bool(format_patterns['list_items'].search(text))
        has_headings = bool(format_patterns['headers'].search(text))
        has_tables = bool(re.search(r'\|.*\|.*\n\|[-:]+\|', text))
        
        features = ContentFeatures(
            length=len(text),
            word_count=word_count,
            whitespace_ratio=whitespace_ratio,
            symbol_density=symbol_density,
            has_cjk=has_cjk,
            has_emoji=has_emoji,
            avg_word_length=avg_word_length,
            sentences_count=sentences_count,
            has_code_blocks=has_code_blocks,
            has_list_items=has_list_items,
            has_tables=has_tables,
            has_headings=has_headings
        )
        
        # Store Arabic/Hebrew detection as attributes even though they're not in the dataclass
        setattr(features, 'has_arabic', has_arabic)
        setattr(features, 'has_hebrew', has_hebrew)
        
        return features
    
    def _calculate_estimate(self, features: ContentFeatures, text: str) -> int:
        """
        Calculate estimate based on features (to be overridden)
        
        Args:
            features: Content features
            text: Original text
            
        Returns:
            Estimated token count
        """
        raise NotImplementedError("Subclasses must implement this method")
    
    def _count_emoji(self, text: str) -> Tuple[int, int]:
        """
        Count emojis and their byte length in text
        
        Args:
            text: Input text
            
        Returns:
            Tuple of (emoji_count, total_emoji_bytes)
        """
        emoji_pattern = self._patterns['emoji']
        emoji_matches = emoji_pattern.findall(text)
        
        # Calculate total bytes used by emojis
        total_emoji_bytes = sum(len(emoji.encode('utf-8')) for emoji in emoji_matches)
        
        return len(emoji_matches), total_emoji_bytes


class PrecisionTokenEstimator(BaseTokenEstimator):
    """High-precision token estimation strategy"""
    
    def _calculate_estimate(self, features: ContentFeatures, text: str) -> int:
        """
        Calculate high-precision token estimate
        
        Args:
            features: Content features
            text: Original text
            
        Returns:
            Estimated token count
        """
        # Start with word count as a baseline
        base_estimate = features.word_count * 1.25  # Average token-per-word ratio
        
        # Adjust for different content characteristics
        base_estimate *= 1 + (features.symbol_density * 0.2)
        
        # Language-specific adjustments
        if features.has_cjk:  # CJK languages have different tokenization
            cjk_pattern = self._patterns['cjk']
            cjk_chars = sum(len(match.group(0)) for match in cjk_pattern.finditer(text))
            base_estimate += cjk_chars * 0.8  # CJK chars often tokenize 1:1
        
        # Handle emoji (which often use multiple tokens)
        if features.has_emoji:
            emoji_count, emoji_bytes = self._count_emoji(text)
            # Emojis typically use more tokens than regular characters
            emoji_tokens = emoji_count * 2.0  # Conservative estimate
            base_estimate += emoji_tokens
        
        # Handle Arabic and Hebrew scripts
        if getattr(features, 'has_arabic', False) or getattr(features, 'has_hebrew', False):
            # Count Arabic/Hebrew characters
            arabic_chars = sum(1 for _ in self._arabic_pattern.finditer(text))
            hebrew_chars = sum(1 for _ in self._hebrew_pattern.finditer(text))
            # Adjust the estimate - these often tokenize differently than Latin script
            base_estimate += (arabic_chars + hebrew_chars) * 0.5
        
        # Adjust for whitespace and punctuation
        whitespace_count = len(self._patterns['whitespace'].findall(text))
        punctuation_count = len(self._patterns['punctuation'].findall(text))
        
        base_estimate += whitespace_count * 0.1
        base_estimate += punctuation_count * 0.3
        
        # Special case for code
        if features.has_code_blocks or re.search(r'(?:function|class|def|if|for|while|var|let|const)\s', text):
            # Code tends to have more specialized tokens
            base_estimate *= 1.15
        
        return math.ceil(base_estimate)


class BalancedTokenEstimator(BaseTokenEstimator):
    """Balanced token estimation strategy"""
    
    def _calculate_estimate(self, features: ContentFeatures, text: str) -> int:
        """
        Calculate balanced token estimate (compromise between speed and accuracy)
        
        Args:
            features: Content features
            text: Original text
            
        Returns:
            Estimated token count
        """
        # Normalize whitespace for more consistent results
        normalized_text = re.sub(r'\s+', ' ', text)
        
        # Perform a basic language check to choose better defaults
        non_latin_chars = len(re.findall(r'[^\x00-\x7F]', normalized_text))
        non_latin_ratio = non_latin_chars / max(1, len(normalized_text))  # Avoid division by zero
        
        # Determine appropriate chars per token based on content
        if non_latin_ratio > 0.5:
            # Likely CJK or other non-Latin script
            chars_per_token = 1.5
        elif re.search(r'\S+', normalized_text) and not re.search(r'\s', normalized_text):
            # Content with no whitespace (e.g., URLs, identifiers)
            chars_per_token = 3.0
        elif re.search(r'[\{\}\[\]()=><]', normalized_text):
            # Content with programming symbols
            chars_per_token = 3.5
        else:
            # Standard English text
            chars_per_token = 4.0
        
        # Check for emoji (which tokenize differently)
        emoji_count, emoji_bytes = self._count_emoji(normalized_text)
        
        if emoji_count > 0:
            # Calculate token estimate without emoji bytes
            text_bytes = len(normalized_text.encode('utf-8'))
            non_emoji_bytes = text_bytes - emoji_bytes
            
            # Base token count from non-emoji characters
            # Convert back to approximate char count
            non_emoji_chars = non_emoji_bytes / 2  # Rough approximation for UTF-8
            token_count = non_emoji_chars / chars_per_token
            
            # Add emoji tokens (each emoji typically takes 1-2 tokens)
            emoji_tokens = emoji_count * 1.5  # Conservative average
            
            return math.ceil(token_count + emoji_tokens)
        else:
            # No emoji - use simple character-based estimation
            return math.ceil(len(normalized_text) / chars_per_token)


class PerformanceTokenEstimator(BaseTokenEstimator):
    """Performance-optimized token estimation strategy"""
    
    def _calculate_estimate(self, features: ContentFeatures, text: str) -> int:
        """
        Calculate fast token estimate
        
        Args:
            features: Content features
            text: Original text
            
        Returns:
            Estimated token count
        """
        # Simple character-based estimation based on approximate chars per token
        chars_per_token = 4.0  # Typical ratio for English text
        
        # Adjust for language characteristics
        if self._patterns['cjk'].search(text):
            # CJK languages have much different tokenization
            chars_per_token = 1.5
        elif self._arabic_pattern.search(text) or self._hebrew_pattern.search(text):
            # Arabic and Hebrew scripts
            chars_per_token = 3.0
        
        # Handle emoji if present
        if features.has_emoji:
            emoji_count, emoji_bytes = self._count_emoji(text)
            
            # Subtract emoji bytes and calculate tokens separately
            text_bytes = len(text.encode('utf-8'))
            non_emoji_bytes = max(0, text_bytes - emoji_bytes)  # Ensure non-negative
            
            # Estimate tokens for non-emoji content
            non_emoji_tokens = (non_emoji_bytes / 4) / chars_per_token  # Approx 4 bytes per UTF-8 char on average
            
            # Add emoji tokens
            emoji_tokens = emoji_count * 1.5  # Simple multiplier for emojis
            
            return math.ceil(non_emoji_tokens + emoji_tokens)
            
        # Basic estimate
        return math.ceil(len(text) / chars_per_token)


class TokenEstimatorFactory:
    """Factory for creating token estimators based on strategy"""
    
    _instances = {}  # Cache for singleton-like behavior
    
    @classmethod
    def create_estimator(cls, strategy: TokenEstimationStrategy) -> BaseTokenEstimator:
        """
        Create token estimator for the specified strategy
        
        Args:
            strategy: Token estimation strategy
            
        Returns:
            Token estimator instance
        """
        # Use cached instance if available for better performance
        if strategy in cls._instances:
            return cls._instances[strategy]
            
        # Create new instance if needed
        if strategy == TokenEstimationStrategy.PRECISION:
            estimator = PrecisionTokenEstimator()
        elif strategy == TokenEstimationStrategy.PERFORMANCE:
            estimator = PerformanceTokenEstimator()
        else:  # BALANCED (default)
            estimator = BalancedTokenEstimator()
            
        # Cache the instance
        cls._instances[strategy] = estimator
        return estimator


@lru_cache(maxsize=128)
def estimate_tokens(text: str, strategy: TokenEstimationStrategy = TokenEstimationStrategy.BALANCED) -> int:
    """
    Cached function for estimating tokens in text
    
    Args:
        text: Input text
        strategy: Estimation strategy to use
        
    Returns:
        Estimated token count
    """
    estimator = TokenEstimatorFactory.create_estimator(strategy)
    return estimator.estimate(text)


# Advanced token estimation using the 'regex' library if available
if HAS_REGEX_LIB:
    # Create enhanced patterns with proper Unicode property support
    class EnhancedTokenEstimation:
        """Advanced token estimation utilities using the 'regex' library"""
        
        # Initialize once as class variables
        ARABIC_PATTERN = regex.compile(r'\p{Arabic}')
        HEBREW_PATTERN = regex.compile(r'\p{Hebrew}')
        CJK_PATTERN = regex.compile(r'\p{Han}|\p{Hangul}|\p{Hiragana}|\p{Katakana}')
        EMOJI_PATTERN = regex.compile(r'\p{Emoji}')
        
        @classmethod
        def estimate_with_unicode_props(cls, text: str) -> int:
            """
            Estimate tokens with full Unicode property support
            
            Args:
                text: Input text
                
            Returns:
                Estimated token count
            """
            # Determine script composition
            has_arabic = bool(cls.ARABIC_PATTERN.search(text))
            has_hebrew = bool(cls.HEBREW_PATTERN.search(text))
            has_cjk = bool(cls.CJK_PATTERN.search(text))
            has_emoji = bool(cls.EMOJI_PATTERN.search(text))
            
            # Base character-to-token ratio
            if has_cjk:
                chars_per_token = 1.5
            elif has_arabic or has_hebrew:
                chars_per_token = 3.0
            else:
                chars_per_token = 4.0
                
            # Basic token count
            token_count = len(text) / chars_per_token
            
            # Emoji adjustment
            if has_emoji:
                emoji_matches = cls.EMOJI_PATTERN.findall(text)
                emoji_count = len(emoji_matches)
                token_count += emoji_count * 0.5  # Additional tokens for emoji
                
            return math.ceil(token_count)
    
    # Enhanced estimation function
    def enhanced_estimate_tokens(text: str) -> int:
        """
        Estimate tokens using enhanced Unicode support
        
        Args:
            text: Input text
            
        Returns:
            Estimated token count
        """
        return EnhancedTokenEstimation.estimate_with_unicode_props(text)