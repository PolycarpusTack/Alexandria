"""
Content format detection utilities.

This module provides automatic detection of content formats based on pattern matching
and heuristic scoring. It analyzes text samples to determine the most likely format
from JSON, XML, Markdown, code, logs, CSV, or plain text.
"""

import re
import json
import logging
from typing import Dict, Any, Tuple
from functools import lru_cache

from enterprise_chunker.models.enums import ContentFormat
from enterprise_chunker.patterns.regex_patterns import RegexPatterns

# Configure logging
logger = logging.getLogger(__name__)


class FormatDetector:
    """Content format detection with confidence scoring."""
    
    def __init__(self, sample_size: int = 2500):
        """
        Initialize the format detector.
        
        Args:
            sample_size: Maximum sample size for format detection
        """
        self.sample_size = sample_size
    
    def detect_format(self, text: str) -> Tuple[ContentFormat, float]:
        """
        Detect the content format based on patterns and heuristics.
        
        Args:
            text: Input text
            
        Returns:
            Tuple of (ContentFormat, confidence_score)
        """
        # Sample the content for faster detection with large texts
        sample_size = min(len(text), self.sample_size)
        sample = text[:sample_size]
        
        # Score each format
        scores = {
            ContentFormat.JSON: self._score_json(sample),
            ContentFormat.XML: self._score_xml(sample),
            ContentFormat.MARKDOWN: self._score_markdown(sample),
            ContentFormat.CODE: self._score_code(sample),
            ContentFormat.LOGS: self._score_logs(sample),
            ContentFormat.CSV: self._score_csv(sample),
            ContentFormat.TEXT: 0.1  # Default low score for plain text
        }
        
        # Select the format with the highest score
        best_format = ContentFormat.TEXT
        best_score = 0.1  # Minimum confidence threshold
        
        for fmt, score in scores.items():
            if score > best_score:
                best_score = score
                best_format = fmt
        
        logger.debug(f"Detected content format: {best_format.value} (confidence: {best_score:.2f})")
        return best_format, best_score
    
    @lru_cache(maxsize=128)
    def _score_json(self, sample: str) -> float:
        """
        Score the likelihood of content being JSON.
        
        Args:
            sample: Content sample
            
        Returns:
            Confidence score (0-1)
        """
        try:
            # Try to parse as JSON - high confidence if valid
            json.loads(sample)
            return 0.95
        except json.JSONDecodeError:
            # Check for JSON-like patterns
            json_markers = len(re.findall(r'[{}\[\],:"]', sample)) / (len(sample) or 1)
            string_literals = len(re.findall(r'"(?:[^"\\]|\\.)*"', sample))
            json_keywords = len(re.findall(r'\b(?:true|false|null)\b', sample))
            
            # Calculate score
            score = 0
            if re.match(r'^\s*[\[{]', sample):
                score += 0.3
                
            score += min(0.4, json_markers * 5)
            score += min(0.2, (string_literals / 10) * 0.3)
            score += min(0.1, (json_keywords / 5) * 0.2)
            
            return min(0.9, score)
    
    @lru_cache(maxsize=128)
    def _score_xml(self, sample: str) -> float:
        """
        Score the likelihood of content being XML or HTML.
        
        Args:
            sample: Content sample
            
        Returns:
            Confidence score (0-1)
        """
        # Check for XML declaration or doctype
        if re.search(r'<\?xml|<!DOCTYPE', sample, re.IGNORECASE):
            return 0.9
            
        # Count tags and attributes
        open_tags = len(re.findall(r'<[a-zA-Z][^>]*>', sample))
        close_tags = len(re.findall(r'</[a-zA-Z][^>]*>', sample))
        attributes = len(re.findall(r'\s[a-zA-Z][a-zA-Z0-9]*=["\'][^"\']*["|\']', sample))
        
        # Calculate score
        score = 0
        score += min(0.4, (open_tags / 20) * 0.4)
        score += min(0.3, (close_tags / 20) * 0.3)
        score += min(0.2, (attributes / 10) * 0.2)
        
        # Check for HTML-specific patterns
        if re.search(r'<html|<body|<div|<p|<span|<h[1-6]|<a\s|<img|<table', sample, re.IGNORECASE):
            score += 0.3
            
        return min(0.9, score)
    
    @lru_cache(maxsize=128)
    def _score_markdown(self, sample: str) -> float:
        """
        Score the likelihood of content being Markdown.
        
        Args:
            sample: Content sample
            
        Returns:
            Confidence score (0-1)
        """
        # Count markdown-specific patterns
        headings = len(re.findall(r'^#{1,6}\s+.+$', sample, re.MULTILINE))
        alt_headings = len(re.findall(r'^[^\n]+\n[=\-]{2,}$', sample, re.MULTILINE))
        list_items = len(re.findall(r'^[\s]*[-*+]\s+.+$', sample, re.MULTILINE))
        numbered_items = len(re.findall(r'^[\s]*\d+\.\s+.+$', sample, re.MULTILINE))
        code_blocks = len(re.findall(r'^```[\s\S]*?```$', sample, re.MULTILINE))
        links = len(re.findall(r'\[.+?\]\(.+?\)', sample))
        emphasis = len(re.findall(r'(\*\*|__).+?(\*\*|__)', sample))
        
        # Calculate score
        score = 0
        score += min(0.3, (headings / 5) * 0.3)
        score += min(0.2, (alt_headings / 2) * 0.2)
        score += min(0.2, (list_items / 10) * 0.2)
        score += min(0.1, (numbered_items / 5) * 0.1)
        score += min(0.2, (code_blocks / 2) * 0.2)
        score += min(0.1, (links / 5) * 0.1)
        score += min(0.1, (emphasis / 5) * 0.1)
        
        # Additional checks
        if re.search(r'!\[.*?\]\(.*?\)', sample):  # Images
            score += 0.1
        if re.search(r'>\s+.*?', sample):  # Blockquotes
            score += 0.1
            
        return min(0.9, score)
    
    @lru_cache(maxsize=128)
    def _score_code(self, sample: str) -> float:
        """
        Score the likelihood of content being source code.
        
        Args:
            sample: Content sample
            
        Returns:
            Confidence score (0-1)
        """
        # Try to remove strings and comments for more accurate detection
        cleaned = re.sub(r'"(?:[^"\\]|\\.)*"', '""', sample)
        cleaned = re.sub(r'\'(?:[^\'\\]|\\.)*\'', "''", cleaned)
        cleaned = re.sub(r'/\*[\s\S]*?\*/', '', cleaned)
        cleaned = re.sub(r'//.*$', '', cleaned, flags=re.MULTILINE)
        
        # Count code-specific patterns
        keywords = [
            'function', 'class', 'if', 'else', 'for', 'while', 'return',
            'var', 'const', 'let', 'import', 'export', 'try', 'catch',
            'def', 'from', 'import', 'public', 'private', 'protected'
        ]
        
        keyword_pattern = r'\b(?:' + '|'.join(keywords) + r')\b'
        keyword_count = len(re.findall(keyword_pattern, cleaned))
        
        bracket_pairs = min(
            len(re.findall(r'\{', cleaned)), 
            len(re.findall(r'\}', cleaned))
        )
        
        semicolons = len(re.findall(r';', cleaned))
        indentation = len(re.findall(r'^\s+', cleaned, re.MULTILINE))
        
        # Language-specific checks
        js_patterns = len(re.findall(r'\b(?:typeof|undefined|null|console|document|window)\b', cleaned))
        python_patterns = len(re.findall(r'\b(?:def|elif|lambda|self|__init__|pass)\b', cleaned))
        java_patterns = len(re.findall(r'\b(?:public|private|protected|static|void|extends|implements)\b', cleaned))
        
        # Calculate score
        score = 0
        score += min(0.3, (keyword_count / 20) * 0.3)
        score += min(0.2, (bracket_pairs / 10) * 0.2)
        score += min(0.1, (semicolons / 15) * 0.1)
        score += min(0.2, (indentation / 15) * 0.2)
        score += min(0.1, (js_patterns / 5) * 0.1)
        score += min(0.1, (python_patterns / 5) * 0.1)
        score += min(0.1, (java_patterns / 5) * 0.1)
        
        # Check for common code patterns
        if re.search(r'^(?:function|class|import|export|const|let|var|if|for|while)\b', sample, re.MULTILINE):
            score += 0.2
            
        return min(0.9, score)
    
    @lru_cache(maxsize=128)
    def _score_logs(self, sample: str) -> float:
        """
        Score the likelihood of content being log file data.
        
        Args:
            sample: Content sample
            
        Returns:
            Confidence score (0-1)
        """
        # Split into lines for analysis
        lines = sample.split('\n')[:20]  # Use up to first 20 lines
        
        # Count timestamp-like patterns
        timestamp_patterns = [
            r'\d{4}-\d{2}-\d{2}',  # YYYY-MM-DD
            r'\d{1,2}/\d{1,2}/\d{2,4}',  # MM/DD/YYYY
            r'\d{2}:\d{2}:\d{2}',  # HH:MM:SS
            r'\[\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?\]',  # ISO timestamps with brackets
        ]
        
        timestamp_count = sum(
            1 for line in lines
            for pattern in timestamp_patterns
            if re.search(pattern, line)
        )
        
        # Count log level indicators
        log_level_count = len([
            line for line in lines 
            if re.search(r'\b(?:ERROR|WARN(?:ING)?|INFO|DEBUG|TRACE|FATAL|CRITICAL|NOTICE|SEVERE)\b', line, re.IGNORECASE)
        ])
        
        # Count stack trace indicators
        stack_trace_patterns = [
            r'at .+\(.+\.(?:java|js|ts|cs|py):\d+\)',
            r'\s+at\s+[\w.$]+(?:\.[\w.$]+)+\([^)]*\)',
            r'File ".+", line \d+'
        ]
        
        stack_trace_count = sum(
            1 for line in lines
            for pattern in stack_trace_patterns
            if re.search(pattern, line)
        )
        
        # Calculate score
        score = 0
        if lines:
            score += min(0.5, (timestamp_count / len(lines)) * 0.5)
            score += min(0.4, (log_level_count / len(lines)) * 0.4)
            score += min(0.3, (stack_trace_count / len(lines)) * 0.3)
        
        # Check for platform-specific log formats
        if re.search(r'\[\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?\]', sample):
            score += 0.2  # ISO 8601
        if re.search(r'\<\d+\>\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}\s+\w+', sample):
            score += 0.2  # RFC 3164
        if re.search(r'^(?:[A-Z])\/[^\(]+\(\s*\d+\):', sample, re.MULTILINE):
            score += 0.2  # Android
            
        return min(0.9, score)
    
    @lru_cache(maxsize=128)
    def _score_csv(self, sample: str) -> float:
        """
        Score the likelihood of content being CSV data.
        
        Args:
            sample: Content sample
            
        Returns:
            Confidence score (0-1)
        """
        lines = sample.strip().split('\n')[:10]  # Check first 10 lines at most
        if not lines:
            return 0.0
            
        # Check for consistent delimiters across lines
        delimiters = [',', ';', '\t', '|']
        consistent_structure = False
        first_line_fields = None
        
        # Analyze structure consistency
        for delimiter in delimiters:
            fields_per_line = [line.count(delimiter) + 1 for line in lines]
            
            # Check for consistent fields per line
            if len(set(fields_per_line)) <= 2:  # Allow for header + data rows
                # Check for reasonable number of fields (at least 2)
                if fields_per_line[0] >= 2:
                    consistent_structure = True
                    first_line_fields = fields_per_line[0]
                    break
                    
        # Calculate score
        score = 0
        
        if consistent_structure:
            score += 0.5  # Consistent structure is a strong indicator
            
            # Check for header-like first line
            if len(lines) > 1:
                header_line = lines[0]
                data_line = lines[1]
                
                header_has_quotes = '"' in header_line
                data_has_numeric = bool(re.search(r'\d+(?:\.\d+)?', data_line))
                
                if header_has_quotes or not data_has_numeric:
                    score += 0.1
                    
            # Check for balanced quotes
            quotes_balanced = all(
                line.count('"') % 2 == 0 for line in lines
            )
            if quotes_balanced:
                score += 0.1
                
            # Check for a good number of fields
            if first_line_fields is not None:
                if 2 <= first_line_fields <= 20:  # Typical CSV range
                    score += 0.1
                    
        return min(0.85, score)


def detect_content_format(text: str, sample_size: int = 2500) -> ContentFormat:
    """
    Convenience function to detect content format.
    
    Args:
        text: Text to analyze
        sample_size: Maximum sample size for format detection
        
    Returns:
        Detected ContentFormat
    """
    detector = FormatDetector(sample_size)
    format_type, confidence = detector.detect_format(text)
    return format_type