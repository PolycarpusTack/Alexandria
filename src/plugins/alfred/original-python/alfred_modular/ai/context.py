"""Context management for AI requests."""

from typing import List, Dict, Any, Optional
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


class ContextManager:
    """Manages context for AI requests."""
    
    def __init__(self, max_context_length: int = 8000):
        self.max_context_length = max_context_length
        self._context_files: List[Path] = []
        self._context_snippets: List[str] = []
        
    def add_file(self, filepath: Path) -> bool:
        """Add a file to context."""
        if not filepath.exists():
            logger.warning(f"File not found: {filepath}")
            return False
            
        if filepath not in self._context_files:
            self._context_files.append(filepath)
            return True
        return False
        
    def remove_file(self, filepath: Path) -> bool:
        """Remove a file from context."""
        if filepath in self._context_files:
            self._context_files.remove(filepath)
            return True
        return False
        
    def add_snippet(self, snippet: str, name: Optional[str] = None) -> None:
        """Add a text snippet to context."""
        if name:
            snippet = f"[{name}]\n{snippet}"
        self._context_snippets.append(snippet)
        
    def clear_snippets(self) -> None:
        """Clear all text snippets."""
        self._context_snippets.clear()
        
    def clear_files(self) -> None:
        """Clear all context files."""
        self._context_files.clear()
        
    def clear(self) -> None:
        """Clear all context."""
        self.clear_files()
        self.clear_snippets()
        
    def build_context(self) -> str:
        """Build the full context string."""
        parts = []
        current_length = 0
        
        # Add file contents
        for filepath in self._context_files:
            try:
                content = filepath.read_text()
                file_context = f"File: {filepath.name}\n```\n{content}\n```\n"
                
                if current_length + len(file_context) > self.max_context_length:
                    logger.warning(f"Context limit reached, skipping {filepath}")
                    break
                    
                parts.append(file_context)
                current_length += len(file_context)
                
            except Exception as e:
                logger.error(f"Error reading file {filepath}: {e}")
                
        # Add snippets
        for snippet in self._context_snippets:
            if current_length + len(snippet) > self.max_context_length:
                logger.warning("Context limit reached, skipping snippet")
                break
                
            parts.append(snippet)
            current_length += len(snippet)
            
        return "\n".join(parts)
        
    @property
    def file_count(self) -> int:
        """Number of context files."""
        return len(self._context_files)
        
    @property
    def snippet_count(self) -> int:
        """Number of context snippets."""
        return len(self._context_snippets)
        
    def get_summary(self) -> Dict[str, Any]:
        """Get context summary."""
        return {
            "files": [str(f) for f in self._context_files],
            "file_count": self.file_count,
            "snippet_count": self.snippet_count,
            "total_length": len(self.build_context())
        }