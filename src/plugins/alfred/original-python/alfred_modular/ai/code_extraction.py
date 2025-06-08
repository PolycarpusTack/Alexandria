"""Code extraction from AI responses."""

import re
from dataclasses import dataclass
from typing import List, Optional, Tuple
from pathlib import Path


@dataclass
class CodeBlock:
    """Represents an extracted code block."""
    content: str
    language: Optional[str] = None
    filename: Optional[str] = None
    line_start: Optional[int] = None
    line_end: Optional[int] = None
    
    @property
    def extension(self) -> str:
        """Get file extension based on language."""
        if self.filename:
            return Path(self.filename).suffix
            
        language_map = {
            "python": ".py",
            "javascript": ".js",
            "typescript": ".ts",
            "java": ".java",
            "cpp": ".cpp",
            "c": ".c",
            "rust": ".rs",
            "go": ".go",
            "ruby": ".rb",
            "php": ".php",
            "swift": ".swift",
            "kotlin": ".kt",
            "scala": ".scala",
            "r": ".r",
            "sql": ".sql",
            "html": ".html",
            "css": ".css",
            "xml": ".xml",
            "json": ".json",
            "yaml": ".yaml",
            "toml": ".toml",
            "markdown": ".md",
            "bash": ".sh",
            "shell": ".sh",
            "powershell": ".ps1",
            "dockerfile": ".dockerfile",
            "makefile": ".makefile",
        }
        
        if self.language:
            return language_map.get(self.language.lower(), ".txt")
        return ".txt"


class CodeExtractor:
    """Extract code blocks from AI responses."""
    
    # Regex patterns for code blocks
    FENCE_PATTERN = re.compile(
        r'```(?P<language>\w+)?\s*\n(?P<code>.*?)```',
        re.DOTALL | re.MULTILINE
    )
    
    INLINE_PATTERN = re.compile(
        r'`(?P<code>[^`]+)`'
    )
    
    # Pattern for filename hints
    FILENAME_PATTERN = re.compile(
        r'(?:file|filename|File|Filename|FILE|FILENAME)\s*[:=]\s*([^\s]+)',
        re.IGNORECASE
    )
    
    @classmethod
    def extract_blocks(cls, text: str) -> List[CodeBlock]:
        """Extract all code blocks from text."""
        blocks = []
        
        # Extract fenced code blocks
        for match in cls.FENCE_PATTERN.finditer(text):
            language = match.group('language')
            code = match.group('code').strip()
            
            # Check for filename in the preceding text
            start_pos = max(0, match.start() - 200)
            preceding_text = text[start_pos:match.start()]
            filename_match = cls.FILENAME_PATTERN.search(preceding_text)
            filename = filename_match.group(1) if filename_match else None
            
            blocks.append(CodeBlock(
                content=code,
                language=language,
                filename=filename
            ))
            
        # If no fenced blocks found, try inline code
        if not blocks:
            for match in cls.INLINE_PATTERN.finditer(text):
                code = match.group('code')
                # Only include if it looks like actual code
                if any(char in code for char in ['{', '}', '(', ')', '=', ';']):
                    blocks.append(CodeBlock(content=code))
                    
        return blocks
        
    @classmethod
    def extract_first_block(cls, text: str) -> Optional[CodeBlock]:
        """Extract the first code block from text."""
        blocks = cls.extract_blocks(text)
        return blocks[0] if blocks else None
        
    @classmethod
    def remove_code_blocks(cls, text: str) -> str:
        """Remove all code blocks from text."""
        # Remove fenced blocks
        text = cls.FENCE_PATTERN.sub('', text)
        # Remove inline code
        text = cls.INLINE_PATTERN.sub('', text)
        return text.strip()
        
    @classmethod
    def format_code_block(cls, code: str, language: Optional[str] = None) -> str:
        """Format code as a markdown code block."""
        if language:
            return f"```{language}\n{code}\n```"
        return f"```\n{code}\n```"
        
    @classmethod
    def detect_language(cls, code: str) -> Optional[str]:
        """Attempt to detect the programming language from code."""
        # Simple heuristic-based detection
        patterns = {
            "python": [
                r'^\s*def\s+\w+\s*\(',
                r'^\s*class\s+\w+',
                r'^\s*import\s+\w+',
                r'^\s*from\s+\w+\s+import',
                r'if\s+__name__\s*==\s*["\']__main__["\']',
            ],
            "javascript": [
                r'^\s*function\s+\w+\s*\(',
                r'^\s*const\s+\w+\s*=',
                r'^\s*let\s+\w+\s*=',
                r'^\s*var\s+\w+\s*=',
                r'^\s*class\s+\w+\s*{',
                r'=>',
            ],
            "java": [
                r'^\s*public\s+class\s+\w+',
                r'^\s*private\s+\w+\s+\w+',
                r'^\s*public\s+static\s+void\s+main',
                r'^\s*package\s+\w+',
            ],
            "cpp": [
                r'^\s*#include\s*<',
                r'^\s*using\s+namespace\s+',
                r'^\s*int\s+main\s*\(',
                r'^\s*class\s+\w+\s*{',
                r'::\w+',
            ],
        }
        
        for language, language_patterns in patterns.items():
            for pattern in language_patterns:
                if re.search(pattern, code, re.MULTILINE):
                    return language
                    
        return None