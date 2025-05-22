"""
Centralized regex pattern management for the EnterpriseChunker.

This module provides optimized and cached regular expression patterns for various
content formats, supporting efficient text parsing, chunking, and analysis operations.

Usage:
    from enterprise_chunker.utils.regex_patterns import RegexPatterns
    
    # Get format-specific patterns
    json_patterns = RegexPatterns.get_format_patterns(ContentFormat.JSON)
    
    # Use a specific pattern
    matches = json_patterns['property'].findall(content)
"""

import re
import logging
from enum import Enum
from functools import lru_cache
from typing import Dict, Any, List, Optional, Union, ClassVar
from enterprise_chunker.models.enums import ContentFormat

# Configure module logger
logger = logging.getLogger(__name__)


class PatternLoadError(Exception):
    """Exception raised when a regex pattern cannot be compiled or loaded."""
    pass


class RegexPatterns:
    """
    Central repository for all regex patterns used in chunking.
    
    This class provides optimized and cached access to regular expression patterns
    for various content formats and detection purposes. All patterns are compiled
    once and cached for performance.
    """
    
    @classmethod
    def get_format_patterns(cls, format_type: ContentFormat) -> Dict[str, re.Pattern]:
        """
        Get patterns specific to a content format.
        
        Args:
            format_type: Content format type enum value
            
        Returns:
            Dictionary of compiled regex patterns for the specified format
            
        Raises:
            ValueError: If the format_type is not recognized
        """
        if not isinstance(format_type, ContentFormat):
            logger.warning(f"Invalid format type provided: {format_type}")
            format_type = ContentFormat.TEXT
            
        # Generate patterns based on format type
        format_patterns = {
            ContentFormat.JSON: cls._json_patterns(),
            ContentFormat.XML: cls._xml_patterns(),
            ContentFormat.MARKDOWN: cls._markdown_patterns(),
            ContentFormat.CODE: cls._code_patterns(),
            ContentFormat.LOGS: cls._logs_patterns(),
            ContentFormat.CSV: cls._csv_patterns(),
            ContentFormat.TEXT: cls._text_patterns(),
        }
        
        # Get patterns for the specified format, fallback to TEXT if not found
        patterns = format_patterns.get(format_type)
        if patterns is None:
            logger.warning(f"Format type not found: {format_type}, using TEXT patterns instead")
            patterns = cls._text_patterns()
            
        return patterns
    
    @classmethod
    @lru_cache(maxsize=None)
    def get_language_detection_patterns(cls) -> Dict[str, re.Pattern]:
        """
        Get patterns for programming language detection.
        
        Returns:
            Dictionary of compiled regex patterns for language detection
        """
        try:
            patterns = {
                'python': re.compile(r'^(?:def|class|import|from|if\s+__name__\s*==|@|\s{4})', re.MULTILINE),
                'javascript': re.compile(r'^(?:function|const|let|var|import|export|=>)', re.MULTILINE),
                'java': re.compile(r'^(?:public|private|protected|class|interface|enum|package)', re.MULTILINE),
                'csharp': re.compile(r'^(?:namespace|using|public|private|protected|class|interface)', re.MULTILINE),
                'html': re.compile(r'^(?:<html|<head|<body|<div|<!DOCTYPE)', re.MULTILINE),
                'css': re.compile(r'^(?:\S+\s*{|@media|@import|@keyframes)', re.MULTILINE),
                'typescript': re.compile(r'^(?:interface|type|namespace|enum|declare|as\s+const)', re.MULTILINE),
                'rust': re.compile(r'^(?:fn|struct|enum|impl|mod|use|pub|let\s+mut)', re.MULTILINE),
                'go': re.compile(r'^(?:package|import|func|type|struct|interface|var|const)', re.MULTILINE),
                'php': re.compile(r'^(?:<\?php|\$\w+|function|class|namespace)', re.MULTILINE),
                'ruby': re.compile(r'^(?:require|class|def|module|if\s+__FILE__\s*==)', re.MULTILINE),
                'swift': re.compile(r'^(?:import|class|struct|enum|extension|func|let|var)', re.MULTILINE),
            }
            return patterns
        except re.error as e:
            logger.error(f"Failed to compile language detection patterns: {e}")
            raise PatternLoadError(f"Language detection pattern compilation failed: {e}")
    
    @classmethod
    @lru_cache(maxsize=None)
    def get_token_estimation_patterns(cls) -> Dict[str, re.Pattern]:
        """
        Get patterns for token estimation.
        
        Returns:
            Dictionary of compiled regex patterns for token estimation
        """
        try:
            patterns = {
                # Fixed: Converted to raw string for clarity
                'latin': re.compile(r'[a-zA-Z0-9\s.,?!;:()\[\]{}\'"`<>/\\|~!@#$%^&*_+=]'),
                'cjk': re.compile(r'[\u4e00-\u9fff\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u3400-\u4dbf]'),
                'emoji': re.compile(r'[\U0001F600-\U0001F64F\U0001F300-\U0001F5FF\U0001F680-\U0001F6FF\U0001F700-\U0001F77F\U0001F780-\U0001F7FF\U0001F800-\U0001F8FF\U0001F900-\U0001F9FF\U0001FA00-\U0001FA6F\U0001FA70-\U0001FAFF]', re.UNICODE),
                'whitespace': re.compile(r'\s+'),
                'punctuation': re.compile(r'[.,;:!?()[\]{}\'"`\-_+=<>|\\/@#$%^&*~]'),
                'numbers': re.compile(r'\b\d+(?:\.\d+)?\b'),
                'special_tokens': re.compile(r'<[^>]+>'),
            }
            return patterns
        except re.error as e:
            logger.error(f"Failed to compile token estimation patterns: {e}")
            raise PatternLoadError(f"Token estimation pattern compilation failed: {e}")
    
    @classmethod
    @lru_cache(maxsize=None)
    def get_format_detection_patterns(cls) -> Dict[str, re.Pattern]:
        """
        Get patterns for content format detection.
        
        Returns:
            Dictionary of compiled regex patterns for format detection
        """
        try:
            patterns = {
                'json': re.compile(r'^\s*[\[{]'),
                'xml': re.compile(r'^\s*<(?:\?xml|!DOCTYPE|[a-zA-Z])'),
                'markdown': re.compile(r'^(?:#+\s|\*\s|\d+\.\s|>\s|=+|-+)', re.MULTILINE),
                'source_code': re.compile(r'^(?:function|class|import|export|const|let|var|if|for|while)\b', re.MULTILINE),
                'yaml': re.compile(r'^(?:---|\w+:\s+)', re.MULTILINE),
                'csv': re.compile(r'^(?:[^,\n\r]+(?:,[^,\n\r]+)+)(?:\r?\n(?:[^,\n\r]+(?:,[^,\n\r]+)+))+$'),
                'log': re.compile(r'^(?:\[\d|\d{4}-\d{2}-\d{2}|ERROR|INFO|DEBUG|WARN|FATAL)', re.MULTILINE | re.IGNORECASE),
            }
            return patterns
        except re.error as e:
            logger.error(f"Failed to compile format detection patterns: {e}")
            raise PatternLoadError(f"Format detection pattern compilation failed: {e}")
    
    @classmethod
    @lru_cache(maxsize=None)
    def get_sentence_boundaries(cls) -> re.Pattern:
        """
        Get pattern for sentence boundaries.
        
        Returns:
            Compiled regex pattern for sentence boundaries
        """
        try:
            pattern = re.compile(r'(?<=[.!?])\s+(?=[A-Z])')
            return pattern
        except re.error as e:
            logger.error(f"Failed to compile sentence boundary pattern: {e}")
            raise PatternLoadError(f"Sentence boundary pattern compilation failed: {e}")
    
    @classmethod
    def get_pattern_by_name(cls, format_type: ContentFormat, pattern_name: str) -> Optional[re.Pattern]:
        """
        Get a specific pattern by name from a format.
        
        Args:
            format_type: Content format type
            pattern_name: Name of the pattern to retrieve
            
        Returns:
            The compiled regex pattern or None if not found
        """
        patterns = cls.get_format_patterns(format_type)
        pattern = patterns.get(pattern_name)
        
        if pattern is None:
            logger.warning(f"Pattern '{pattern_name}' not found for format {format_type}")
            
        return pattern
    
    @classmethod
    def find_matches(cls, text: str, format_type: ContentFormat, pattern_name: str) -> List[str]:
        """
        Find all matches for a specific pattern in text.
        
        Args:
            text: The text to search in
            format_type: Content format type
            pattern_name: Name of the pattern to use
            
        Returns:
            List of matched strings
        """
        if not text:
            return []
            
        pattern = cls.get_pattern_by_name(format_type, pattern_name)
        if not pattern:
            return []
            
        try:
            return pattern.findall(text)
        except re.error as e:
            logger.error(f"Error matching pattern '{pattern_name}': {e}")
            return []
    
    @staticmethod
    @lru_cache(maxsize=None)
    def _json_patterns() -> Dict[str, re.Pattern]:
        """
        JSON-specific patterns.
        
        Returns:
            Dictionary of compiled regex patterns for JSON format
        """
        try:
            return {
                'object_start': re.compile(r'^\s*\{'),
                'array_start': re.compile(r'^\s*\['),
                'property': re.compile(r'"([^"\\]|\\.)*":\s*'),
                'string': re.compile(r'"(?:[^"\\]|\\.)*"'),
                'number': re.compile(r'-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?'),
                'boolean': re.compile(r'\b(?:true|false|null)\b'),
                'json_lines': re.compile(r'^\s*\{.*\}\s*$', re.MULTILINE),
                'nested_object': re.compile(r'\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}'),
                'nested_array': re.compile(r'\[(?:[^\[\]]|\[(?:[^\[\]]|\[[^\[\]]*\])*\])*\]'),
            }
        except re.error as e:
            logger.error(f"Failed to compile JSON patterns: {e}")
            raise PatternLoadError(f"JSON pattern compilation failed: {e}")
        
    @staticmethod
    @lru_cache(maxsize=None)
    def _xml_patterns() -> Dict[str, re.Pattern]:
        """
        XML-specific patterns.
        
        Returns:
            Dictionary of compiled regex patterns for XML format
        """
        try:
            return {
                'tag': re.compile(r'</?[a-zA-Z][^>]*>'),
                'opening_tag': re.compile(r'<([a-zA-Z][a-zA-Z0-9]*)[^>]*(?<!/)>'),
                'closing_tag': re.compile(r'</([a-zA-Z][a-zA-Z0-9]*)>'),
                'self_closing_tag': re.compile(r'<([a-zA-Z][a-zA-Z0-9]*)[^>]*/>', re.DOTALL),
                'declaration': re.compile(r'<\?xml[^>]*\?>'),
                'doctype': re.compile(r'<!DOCTYPE[^>]*>'),
                'comment': re.compile(r'<!--.*?-->', re.DOTALL),
                'attribute': re.compile(r'\s([a-zA-Z][a-zA-Z0-9]*)=["\'](.*?)["\']'),
                'cdata': re.compile(r'<!\[CDATA\[(.*?)\]\]>', re.DOTALL),
                'processing_instruction': re.compile(r'<\?([a-zA-Z][a-zA-Z0-9]*)[^>]*\?>'),
                'namespace': re.compile(r'xmlns(?::([a-zA-Z][a-zA-Z0-9]*))?=["\'](.*?)["\']'),
            }
        except re.error as e:
            logger.error(f"Failed to compile XML patterns: {e}")
            raise PatternLoadError(f"XML pattern compilation failed: {e}")
        
    @staticmethod
    @lru_cache(maxsize=None)
    def _markdown_patterns() -> Dict[str, re.Pattern]:
        """
        Markdown-specific patterns.
        
        Returns:
            Dictionary of compiled regex patterns for Markdown format
        """
        try:
            return {
                'headers': re.compile(r'^(#{1,6})\s+(.+)', re.MULTILINE),
                'alt_headers': re.compile(r'^([^\n]+)\n([=\-]{3,})', re.MULTILINE),
                'list_items': re.compile(r'^[\s]*[-*+]\s+.+$', re.MULTILINE),
                'numbered_list': re.compile(r'^[\s]*\d+\.\s+.+$', re.MULTILINE),
                'code_blocks': re.compile(r'^```[\s\S]*?```$', re.MULTILINE),
                'inline_code': re.compile(r'`[^`]+`'),
                'links': re.compile(r'\[.+?\]\(.+?\)'),
                'images': re.compile(r'!\[.*?\]\(.*?\)'),
                'blockquotes': re.compile(r'^>\s+.*?', re.MULTILINE),
                'emphasis': re.compile(r'(\*\*|__).+?(\*\*|__)'),
                'horizontal_rule': re.compile(r'^---', re.MULTILINE),
                'tables': re.compile(r'^\|.+\|$[\r\n]+^\|[-:| ]+\|$', re.MULTILINE),
                'task_list': re.compile(r'^[\s]*[-*+]\s+\[[ xX]\]\s+.+$', re.MULTILINE),
                'footnote_ref': re.compile(r'\[\^.+?\]'),
                'footnote_def': re.compile(r'^\[\^.+?\]:', re.MULTILINE),
                'strikethrough': re.compile(r'~~.+?~~'),
                'html_tags': re.compile(r'<([a-zA-Z][a-zA-Z0-9]*)[^>]*>.*?</\1>', re.DOTALL),
            }
        except re.error as e:
            logger.error(f"Failed to compile Markdown patterns: {e}")
            raise PatternLoadError(f"Markdown pattern compilation failed: {e}")
        
    @staticmethod
    @lru_cache(maxsize=None)
    def _code_patterns() -> Dict[str, re.Pattern]:
        """
        Code-specific patterns.
        
        Returns:
            Dictionary of compiled regex patterns for Code format
        """
        try:
            return {
                'function_def': re.compile(r'^(?:function|class|def|public|private|protected|static|async)\s+\w+\s*\([^)]*\)\s*{?', re.MULTILINE),
                'control_flow': re.compile(r'^(?:if|for|while|switch|try|catch|finally)\s*\([^)]*\)\s*{?', re.MULTILINE),
                'variable_decl': re.compile(r'^(?:const|let|var)\s+\w+\s*=.+?;?', re.MULTILINE),
                'import': re.compile(r'^(?:import|export|require|module\.exports)\s+.+?;?', re.MULTILINE),
                'comments_single': re.compile(r'^\/\/.*', re.MULTILINE),
                'comments_multi': re.compile(r'^\/\*[\s\S]*?\*\/', re.MULTILINE),
                'empty_lines': re.compile(r'^\s*$', re.MULTILINE),
                'class_def': re.compile(r'^(?:class|interface|enum|struct)\s+\w+', re.MULTILINE),
                'decorator': re.compile(r'^@\w+', re.MULTILINE),
                'method_def': re.compile(r'^\s+(?:public|private|protected|static|async)?\s*\w+\s*\([^)]*\)\s*{?', re.MULTILINE),
                'namespace': re.compile(r'^(?:namespace|package|module)\s+[\w.]+', re.MULTILINE),
                'lambda': re.compile(r'=>|->'),
                'string_literal': re.compile(r'([\'"])(?:(?=(\\?))\2.)*?\1'),
                'brackets': re.compile(r'[{}()\[\]]'),
            }
        except re.error as e:
            logger.error(f"Failed to compile Code patterns: {e}")
            raise PatternLoadError(f"Code pattern compilation failed: {e}")
        
    @staticmethod
    @lru_cache(maxsize=None)
    def _logs_patterns() -> Dict[str, re.Pattern]:
        """
        Log-specific patterns.
        
        Returns:
            Dictionary of compiled regex patterns for Logs format
        """
        try:
            return {
                'iso_timestamp': re.compile(r'^\[\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?\]', re.MULTILINE),
                'iso_timestamp_no_bracket': re.compile(r'^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?', re.MULTILINE),
                'us_date': re.compile(r'^\d{1,2}\/\d{1,2}\/\d{2,4}\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s+[AP]M)?', re.MULTILINE),
                'log_level': re.compile(r'^(?:ERROR|WARN(?:ING)?|INFO|DEBUG|TRACE|FATAL|CRITICAL|NOTICE|SEVERE)(?:\s+|\:)', re.MULTILINE | re.IGNORECASE),
                'mobile_log': re.compile(r'^(?:E|W|I|D|T|F|C|N|S)\/[\w.]+\(\s*\d+\):', re.MULTILINE),
                'exception': re.compile(r'^(?:Exception|Error|Traceback|Caused by|at)\s+[\w.$]+(?:[:]\s|[:]\s+\w+|\s+[\w.(]+\()', re.MULTILINE),
                'stack_trace_java': re.compile(r'^\s+at\s+[\w.$]+(?:\.[\w.$]+)+\([^)]*\)$', re.MULTILINE),
                'stack_trace_python': re.compile(r'^\s+File ".*", line \d+', re.MULTILINE),
                'process_id': re.compile(r'^Process ID:?\s+\d+', re.MULTILINE),
                'thread_id': re.compile(r'^Thread(?: ID)?:?\s+\d+', re.MULTILINE),
                'uuid': re.compile(r'[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'),
                'ip_address': re.compile(r'\b(?:\d{1,3}\.){3}\d{1,3}\b'),
                'request_id': re.compile(r'(?:request[-_]id|correlation[-_]id|trace[-_]id)[:=]\s*[\w-]+', re.IGNORECASE),
                'user_agent': re.compile(r'user[-_]agent[:=]\s*[^\n\r]+', re.IGNORECASE),
                'status_code': re.compile(r'(?:status|code|response)[:=]\s*\d{3}', re.IGNORECASE),
                'memory_usage': re.compile(r'(?:memory|heap|ram)[:=]\s*\d+(?:\.\d+)?\s*(?:KB|MB|GB|B)', re.IGNORECASE),
            }
        except re.error as e:
            logger.error(f"Failed to compile Logs patterns: {e}")
            raise PatternLoadError(f"Logs pattern compilation failed: {e}")
        
    @staticmethod
    @lru_cache(maxsize=None)
    def _csv_patterns() -> Dict[str, re.Pattern]:
        """
        CSV-specific patterns.
        
        Returns:
            Dictionary of compiled regex patterns for CSV format
        """
        try:
            return {
                'quoted_field': re.compile(r'"(?:[^"]|"")*"'),
                'unquoted_field': re.compile(r'[^,;\t|"\n\r]+'),
                'delimiter_comma': re.compile(r','),
                'delimiter_semicolon': re.compile(r';'),
                'delimiter_tab': re.compile(r'\t'),
                'delimiter_pipe': re.compile(r'\|'),
                'header_row': re.compile(r'^[^,\n\r]+(?:,[^,\n\r]+)*$'),
                'empty_field': re.compile(r',,|^,|,$'),
                'quoted_with_comma': re.compile(r'"[^"]*,[^"]*"'),
                'row': re.compile(r'^.*$', re.MULTILINE),
                'field_count': re.compile(r'^(?:[^,\n\r]+(?:,[^,\n\r]+)*)\r?\n', re.MULTILINE),
                'number_field': re.compile(r'\b\d+(?:\.\d+)?\b'),
                'date_field': re.compile(r'\b\d{1,4}[-/]\d{1,2}[-/]\d{1,4}\b'),
            }
        except re.error as e:
            logger.error(f"Failed to compile CSV patterns: {e}")
            raise PatternLoadError(f"CSV pattern compilation failed: {e}")
        
    @staticmethod
    @lru_cache(maxsize=None)
    def _text_patterns() -> Dict[str, re.Pattern]:
        """
        General text patterns.
        
        Returns:
            Dictionary of compiled regex patterns for Text format
        """
        try:
            return {
                'paragraph': re.compile(r'\n\s*\n'),
                'line_break': re.compile(r'\n'),
                'sentence': re.compile(r'(?<=[.!?])\s+(?=[A-Z])'),
                'url': re.compile(r'https?://(?:[-\w.]|(?:%[\da-fA-F]{2}))+'),
                'email': re.compile(r'[\w.+-]+@[\w-]+\.[\w.-]+'),
                'phone_number': re.compile(r'\b(?:\+\d{1,2}\s)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b'),
                'date': re.compile(r'\b\d{1,4}[-/]\d{1,2}[-/]\d{1,4}\b'),
                'time': re.compile(r'\b\d{1,2}:\d{2}(?::\d{2})?(?:\s*[aApP][mM])?\b'),
                'currency': re.compile(r'[$€£¥]\s*\d+(?:\.\d{2})?|\d+(?:\.\d{2})?\s*[$€£¥]'),
                'hashtag': re.compile(r'#[a-zA-Z0-9_]+'),
                'mention': re.compile(r'@[a-zA-Z0-9_]+'),
                'acronym': re.compile(r'\b[A-Z]{2,}\b'),
                'word': re.compile(r'\b[a-zA-Z]+\b'),
                'number': re.compile(r'\b\d+(?:\.\d+)?\b'),
                'percentage': re.compile(r'\b\d+(?:\.\d+)?%\b'),
                'citation': re.compile(r'\[\d+\]'),
            }
        except re.error as e:
            logger.error(f"Failed to compile Text patterns: {e}")
            raise PatternLoadError(f"Text pattern compilation failed: {e}")

    @classmethod
    def precompile_all_patterns(cls) -> None:
        """
        Precompile all patterns to populate the cache.
        This can be called at application startup to ensure all patterns
        are loaded and validated before they are needed.
        
        Raises:
            PatternLoadError: If any pattern fails to compile
        """
        try:
            start_time = time.time()
            
            # Load all pattern sets to populate caches
            cls.get_sentence_boundaries()
            cls.get_format_detection_patterns()
            cls.get_language_detection_patterns()
            cls.get_token_estimation_patterns()
            
            # Load all format-specific patterns
            pattern_counts = {}
            for format_type in ContentFormat:
                format_patterns = cls.get_format_patterns(format_type)
                pattern_counts[format_type.name] = len(format_patterns)
                
            # Debug-time sanity check for pattern counts
            logger.info(f"Successfully precompiled all regex patterns in {time.time() - start_time:.3f}s")
            logger.debug(f"Pattern count by format: {pattern_counts}")
            
        except Exception as e:
            logger.error(f"Failed to precompile patterns: {e}")
            raise PatternLoadError(f"Pattern precompilation failed: {e}")