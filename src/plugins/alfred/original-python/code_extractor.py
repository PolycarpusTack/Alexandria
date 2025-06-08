"""
Code Block Extractor for ALFRED
Extracts code blocks from AI responses and provides file operations
"""

import re
import os
from dataclasses import dataclass
from typing import List, Optional, Tuple
from pathlib import Path


@dataclass
class CodeBlock:
    """Represents an extracted code block"""
    language: str
    content: str
    suggested_filename: Optional[str] = None
    line_number: int = 0
    
    def get_extension(self) -> str:
        """Get file extension based on language"""
        extensions = {
            'python': '.py',
            'javascript': '.js',
            'typescript': '.ts',
            'java': '.java',
            'cpp': '.cpp',
            'c': '.c',
            'html': '.html',
            'css': '.css',
            'json': '.json',
            'yaml': '.yml',
            'yml': '.yml',
            'bash': '.sh',
            'shell': '.sh',
            'sql': '.sql',
            'markdown': '.md',
            'rust': '.rs',
            'go': '.go',
            'ruby': '.rb',
            'php': '.php',
            'smalltalk': '.st',
        }
        return extensions.get(self.language.lower(), '.txt')


class CodeExtractor:
    """Extracts code blocks from text"""
    
    # Regex pattern for code blocks
    CODE_BLOCK_PATTERN = re.compile(
        r'```(\w+)?\n(.*?)```',
        re.DOTALL | re.MULTILINE
    )
    
    # Pattern to detect filenames in comments
    FILENAME_PATTERNS = [
        re.compile(r'#\s*(?:file:|filename:)\s*(\S+)', re.IGNORECASE),
        re.compile(r'//\s*(?:file:|filename:)\s*(\S+)', re.IGNORECASE),
        re.compile(r'/\*\s*(?:file:|filename:)\s*(\S+)\s*\*/', re.IGNORECASE),
        re.compile(r'<!--\s*(?:file:|filename:)\s*(\S+)\s*-->', re.IGNORECASE),
    ]
    
    def extract_code_blocks(self, text: str) -> List[CodeBlock]:
        """Extract all code blocks from text"""
        blocks = []
        
        for match in self.CODE_BLOCK_PATTERN.finditer(text):
            language = match.group(1) or 'text'
            content = match.group(2).strip()
            
            if content:  # Only add non-empty blocks
                block = CodeBlock(
                    language=language,
                    content=content,
                    line_number=text[:match.start()].count('\n') + 1
                )
                
                # Try to detect filename
                block.suggested_filename = self._detect_filename(content, language)
                
                blocks.append(block)
        
        return blocks
    
    def _detect_filename(self, content: str, language: str) -> Optional[str]:
        """Try to detect filename from code content"""
        # Check first few lines for filename comments
        lines = content.split('\n')[:5]
        
        for line in lines:
            for pattern in self.FILENAME_PATTERNS:
                match = pattern.search(line)
                if match:
                    return match.group(1)
        
        # Generate default filename if specific patterns found
        if language == 'python':
            # Check for main block
            if 'if __name__ == "__main__":' in content:
                if 'class App' in content or 'app = ' in content:
                    return 'app.py'
                return 'main.py'
            # Check for Flask/Django
            if 'from flask import' in content:
                return 'app.py'
            if 'from django' in content:
                return 'views.py'
        
        elif language in ['javascript', 'typescript']:
            if 'export default' in content:
                if 'function App' in content or 'const App' in content:
                    return f'App.{language[:2]}'
            if 'express()' in content:
                return f'server.{language[:2]}'
        
        elif language == 'html':
            if '<html' in content or '<!DOCTYPE' in content:
                return 'index.html'
        
        return None
    
    def format_code_block_for_display(self, block: CodeBlock) -> str:
        """Format code block for display with line numbers"""
        lines = block.content.split('\n')
        formatted_lines = []
        
        for i, line in enumerate(lines, 1):
            formatted_lines.append(f"{i:4d} | {line}")
        
        return '\n'.join(formatted_lines)


class CodeFileManager:
    """Manages file operations for code blocks"""
    
    def __init__(self, project_path: str):
        self.project_path = Path(project_path)
    
    def save_code_block(self, block: CodeBlock, filename: str, 
                       subdirectory: Optional[str] = None) -> Tuple[bool, str]:
        """
        Save code block to file
        Returns: (success, message)
        """
        try:
            # Determine full path
            if subdirectory:
                file_path = self.project_path / subdirectory / filename
            else:
                file_path = self.project_path / filename
            
            # Create directory if needed
            file_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Check if file exists
            if file_path.exists():
                return False, f"File already exists: {file_path}"
            
            # Write file
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(block.content)
            
            return True, f"Saved to: {file_path}"
            
        except Exception as e:
            return False, f"Error saving file: {str(e)}"
    
    def save_or_update_file(self, block: CodeBlock, filename: str,
                           subdirectory: Optional[str] = None,
                           force: bool = False) -> Tuple[bool, str, Optional[str]]:
        """
        Save or update file with confirmation
        Returns: (success, message, old_content)
        """
        try:
            # Determine full path
            if subdirectory:
                file_path = self.project_path / subdirectory / filename
            else:
                file_path = self.project_path / filename
            
            # Create directory if needed
            file_path.parent.mkdir(parents=True, exist_ok=True)
            
            old_content = None
            
            # Check if file exists
            if file_path.exists() and not force:
                # Read existing content
                with open(file_path, 'r', encoding='utf-8') as f:
                    old_content = f.read()
                
                if old_content == block.content:
                    return True, "File already up to date", None
                
                return False, f"File exists with different content: {file_path}", old_content
            
            # Write file
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(block.content)
            
            if old_content:
                return True, f"Updated: {file_path}", old_content
            else:
                return True, f"Created: {file_path}", None
                
        except Exception as e:
            return False, f"Error saving file: {str(e)}", None
    
    def get_safe_filename(self, suggested: str, language: str) -> str:
        """Get a safe filename"""
        if suggested:
            # Remove any path components for safety
            suggested = os.path.basename(suggested)
            # Ensure it has an extension
            if '.' not in suggested:
                suggested += CodeBlock(language=language, content='').get_extension()
            return suggested
        
        # Generate default name
        import datetime
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        extension = CodeBlock(language=language, content='').get_extension()
        return f"code_{timestamp}{extension}"


# Diff functionality
def generate_diff(old_content: str, new_content: str) -> List[str]:
    """Generate a simple diff between two contents"""
    import difflib
    
    old_lines = old_content.splitlines(keepends=True)
    new_lines = new_content.splitlines(keepends=True)
    
    diff = difflib.unified_diff(
        old_lines, new_lines,
        fromfile='Current', tofile='New',
        lineterm=''
    )
    
    return list(diff)