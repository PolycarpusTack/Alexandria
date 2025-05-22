"""
React and Vue component-specific chunking strategy implementation.

This module provides specialized chunking for React (JSX/TSX) and Vue (SFC) components,
maintaining component structure awareness for optimal semantic chunking.
"""

import re
import logging
import time
from typing import List, Dict, Any, Optional, Tuple, ClassVar, Pattern
from functools import lru_cache

from enterprise_chunker.strategies.base import BaseChunkingStrategy
from enterprise_chunker.models.enums import ContentFormat, ChunkingStrategy
from enterprise_chunker.config import ChunkingOptions
from enterprise_chunker.utils.token_estimation import estimate_tokens
from enterprise_chunker.patterns.regex_patterns import RegexPatterns
from enterprise_chunker.models.chunk_metadata import ChunkingResult

# Configure logging
logger = logging.getLogger(__name__)


class ReactVueChunkingStrategy(BaseChunkingStrategy):
    """
    Strategy for chunking React and Vue component files with structure awareness.
    
    This handles JSX, TSX for React and .vue single-file components with intelligent
    boundary detection that preserves component structure and semantics.
    
    Features:
        - React component detection (functional and class components)
        - Vue SFC section detection (template, script, style)
        - Component hierarchy preservation
        - Hook and lifecycle method detection
        - Intelligent context preservation between chunks
    """
    
    # Cached pattern sets for improved performance
    _VUE_PATTERNS: ClassVar[Dict[str, Pattern]] = {
        # Vue template section
        'template_tag': re.compile(r'(<template.*?>)([\s\S]*?)(<\/template>)'),
        'script_tag': re.compile(r'(<script.*?>)([\s\S]*?)(<\/script>)'),
        'style_tag': re.compile(r'(<style.*?>)([\s\S]*?)(<\/style>)'),
        'component_tag': re.compile(r'<([A-Z][A-Za-z0-9]*|[a-z]+-[a-z-]+)[^>]*>', re.MULTILINE),
        
        # Options API patterns
        'component_definition': re.compile(r'export\s+default\s*{'),
        'props_section': re.compile(r'props\s*:'),
        'data_section': re.compile(r'data\s*\(\)\s*{'),
        'computed_section': re.compile(r'computed\s*:'),
        'methods_section': re.compile(r'methods\s*:'),
        'watch_section': re.compile(r'watch\s*:'),
        'lifecycle_method': re.compile(r'(mounted|created|beforeMount|updated|beforeUpdate)\s*\(\)'),
        
        # Composition API patterns
        'setup_function': re.compile(r'setup\s*\([^)]*\)\s*{'),
        'ref_definition': re.compile(r'const\s+\w+\s*=\s*ref\('),
        'reactive_definition': re.compile(r'const\s+\w+\s*=\s*reactive\('),
        'computed_definition': re.compile(r'const\s+\w+\s*=\s*computed\('),
        'watch_definition': re.compile(r'watch\(\w+,'),
        'lifecycle_hook': re.compile(r'on(Mounted|Created|BeforeMount|Updated|BeforeUpdate)\('),
        
        # CSS patterns
        'css_selector': re.compile(r'([.#]?[a-zA-Z0-9_-]+(?:\s+[.#]?[a-zA-Z0-9_-]+)*)\s*{', re.MULTILINE),
        'media_query': re.compile(r'@media\s+[^{]+{', re.MULTILINE),
    }
    
    _REACT_PATTERNS: ClassVar[Dict[str, Pattern]] = {
        # Import and export patterns
        'import': re.compile(r'^import\s+.*?;?\s*$', re.MULTILINE),
        'export': re.compile(r'^export\s+default\s+\w+', re.MULTILINE),
        
        # Component definitions
        'func_component': re.compile(
            r'^(?:export\s+)?(?:const|function)\s+([A-Z]\w*)\s*(?:=\s*(?:\([^)]*\)|)\s*=>|(?:\([^)]*\)))', 
            re.MULTILINE
        ),
        'class_component': re.compile(
            r'^(?:export\s+)?class\s+([A-Z]\w*)\s+extends\s+(?:React\.)?Component',
            re.MULTILINE
        ),
        
        # Hooks and handlers
        'hook': re.compile(
            r'(?:const|let)\s+\[(\w+),\s*set(\w+)\]\s*=\s*useState|' +
            r'const\s+\w+\s*=\s*useRef|' +
            r'useEffect\(\s*\(\)\s*=>|' +
            r'useCallback\(\s*\([^)]*\)\s*=>|' +
            r'useMemo\(\s*\(\)\s*=>',
            re.MULTILINE
        ),
        'event_handler': re.compile(
            r'(?:const|function)\s+handle\w+\s*=|' +
            r'(?:const|function)\s+on[A-Z]\w+\s*=|' +
            r'(?:public|private|protected)?\s*\w+\s*=\s*(?:\([^)]*\)|event)',
            re.MULTILINE
        ),
        
        # JSX
        'jsx_block': re.compile(r'return\s*\(\s*<', re.MULTILINE | re.DOTALL),
    }
    
    def __init__(self):
        """Initialize the React/Vue chunking strategy with cached patterns."""
        super().__init__(ContentFormat.CODE)
        self.is_vue = False
    
    def chunk(self, text: str, options: ChunkingOptions) -> ChunkingResult:
        """
        Override to detect Vue or React before chunking.
        
        Args:
            text: Component code to chunk
            options: Chunking options
            
        Returns:
            ChunkingResult with chunks and metadata
        """
        # Detect if this is a Vue component
        self.is_vue = self._detect_vue_component(text)
        logger.debug(f"[{self.operation_id}] Detected component type: {'Vue' if self.is_vue else 'React'}")
        
        # Continue with normal chunking process
        return super().chunk(text, options)
    
    def detect_boundaries(self, text: str, options: ChunkingOptions) -> List[Dict[str, Any]]:
        """
        Detect boundaries in React or Vue components based on component type.
        
        Args:
            text: Component code to analyze
            options: Chunking options
            
        Returns:
            List of boundary dictionaries
        """
        if self.is_vue:
            return self._detect_vue_boundaries(text)
        else:
            return self._detect_react_boundaries(text)
    
    def _detect_vue_boundaries(self, text: str) -> List[Dict[str, Any]]:
        """
        Detect boundaries in Vue single-file components.
        
        Args:
            text: Vue component code
            
        Returns:
            List of boundary dictionaries
        """
        boundaries = []
        
        # Find the main section tags: <template>, <script>, <style>
        template_match = self._VUE_PATTERNS['template_tag'].search(text)
        script_match = self._VUE_PATTERNS['script_tag'].search(text)
        style_match = self._VUE_PATTERNS['style_tag'].search(text)
        
        # Add template section
        if template_match:
            # Add template start tag
            boundaries.append({
                'index': template_match.start(1),
                'end': template_match.end(1),
                'text': template_match.group(1),
                'type': 'template_tag',
                'is_section': True
            })
            
            # Parse template content for component boundaries
            template_content = template_match.group(2)
            template_start = template_match.start(2)
            
            # Find component tags in template
            for match in self._VUE_PATTERNS['component_tag'].finditer(template_content):
                boundaries.append({
                    'index': template_start + match.start(),
                    'end': template_start + match.end(),
                    'text': match.group(0),
                    'type': 'component_tag',
                    'is_section': False
                })
                
            # Add template end tag
            boundaries.append({
                'index': template_match.start(3),
                'end': template_match.end(3),
                'text': template_match.group(3),
                'type': 'template_tag',
                'is_section': True
            })
        
        # Add script section
        if script_match:
            # Add script start tag
            boundaries.append({
                'index': script_match.start(1),
                'end': script_match.end(1),
                'text': script_match.group(1),
                'type': 'script_tag',
                'is_section': True
            })
            
            # Parse script content for JS structure
            script_content = script_match.group(2)
            script_start = script_match.start(2)
            
            # Options API patterns
            options_api_patterns = [
                ('component_definition', 'component_definition'),
                ('props_section', 'props_section'),
                ('data_section', 'data_section'),
                ('computed_section', 'computed_section'),
                ('methods_section', 'methods_section'),
                ('watch_section', 'watch_section'),
                ('lifecycle_method', 'lifecycle_method')
            ]
            
            # Composition API patterns
            composition_api_patterns = [
                ('setup_function', 'setup_function'),
                ('ref_definition', 'ref_definition'),
                ('reactive_definition', 'reactive_definition'),
                ('computed_definition', 'computed_definition'),
                ('watch_definition', 'watch_definition'),
                ('lifecycle_hook', 'lifecycle_hook')
            ]
            
            # Check all patterns
            for pattern_list in [options_api_patterns, composition_api_patterns]:
                for pattern_key, type_name in pattern_list:
                    pattern = self._VUE_PATTERNS[pattern_key]
                    for match in pattern.finditer(script_content):
                        boundaries.append({
                            'index': script_start + match.start(),
                            'end': script_start + match.end(),
                            'text': match.group(0),
                            'type': type_name,
                            'is_section': False
                        })
            
            # Add script end tag
            boundaries.append({
                'index': script_match.start(3),
                'end': script_match.end(3),
                'text': script_match.group(3),
                'type': 'script_tag',
                'is_section': True
            })
        
        # Add style section
        if style_match:
            # Add style start tag
            boundaries.append({
                'index': style_match.start(1),
                'end': style_match.end(1),
                'text': style_match.group(1),
                'type': 'style_tag',
                'is_section': True
            })
            
            # Add CSS structure boundaries
            style_content = style_match.group(2)
            style_start = style_match.start(2)
            
            # Find CSS selectors
            for match in self._VUE_PATTERNS['css_selector'].finditer(style_content):
                boundaries.append({
                    'index': style_start + match.start(),
                    'end': style_start + match.end(),
                    'text': match.group(0),
                    'type': 'css_selector',
                    'is_section': False
                })
            
            # Add media queries
            for match in self._VUE_PATTERNS['media_query'].finditer(style_content):
                boundaries.append({
                    'index': style_start + match.start(),
                    'end': style_start + match.end(),
                    'text': match.group(0),
                    'type': 'media_query',
                    'is_section': False
                })
            
            # Add style end tag
            boundaries.append({
                'index': style_match.start(3),
                'end': style_match.end(3),
                'text': style_match.group(3),
                'type': 'style_tag',
                'is_section': True
            })
        
        # Add a boundary at the beginning if none exists
        if not boundaries or boundaries[0]['index'] > 0:
            boundaries.insert(0, {
                'index': 0,
                'end': 0,
                'text': '',
                'type': 'start',
                'is_section': False
            })
        
        # Sort boundaries by position
        boundaries.sort(key=lambda x: x['index'])
        
        return boundaries
    
    def _detect_react_boundaries(self, text: str) -> List[Dict[str, Any]]:
        """
        Detect boundaries in React components.
        
        Args:
            text: React component code
            
        Returns:
            List of boundary dictionaries
        """
        boundaries = []
        
        # Find import statements
        for match in self._REACT_PATTERNS['import'].finditer(text):
            boundaries.append({
                'index': match.start(),
                'end': match.end(),
                'text': match.group(0),
                'type': 'import',
                'is_section': True
            })
        
        # Find function component definitions
        for match in self._REACT_PATTERNS['func_component'].finditer(text):
            boundaries.append({
                'index': match.start(),
                'end': match.end(),
                'text': match.group(0),
                'type': 'component_function',
                'is_section': True,
                'component_name': match.group(1) if match.groups() else None
            })
        
        # Find class component definitions
        for match in self._REACT_PATTERNS['class_component'].finditer(text):
            boundaries.append({
                'index': match.start(),
                'end': match.end(),
                'text': match.group(0),
                'type': 'component_class',
                'is_section': True,
                'component_name': match.group(1) if match.groups() else None
            })
        
        # Find hooks
        for match in self._REACT_PATTERNS['hook'].finditer(text):
            boundaries.append({
                'index': match.start(),
                'end': match.end(),
                'text': match.group(0),
                'type': 'hook',
                'is_section': False
            })
        
        # Find JSX elements in return statements
        for match in self._REACT_PATTERNS['jsx_block'].finditer(text):
            # Find the closing parenthesis
            open_count = 1
            start_pos = match.end()
            end_pos = start_pos
            
            for i in range(start_pos, len(text)):
                if text[i] == '(':
                    open_count += 1
                elif text[i] == ')':
                    open_count -= 1
                    if open_count == 0:
                        end_pos = i + 1
                        break
            
            if end_pos > start_pos:
                boundaries.append({
                    'index': match.start(),
                    'end': end_pos,
                    'text': text[match.start():end_pos],
                    'type': 'jsx_block',
                    'is_section': True
                })
        
        # Find event handlers and methods
        for match in self._REACT_PATTERNS['event_handler'].finditer(text):
            boundaries.append({
                'index': match.start(),
                'end': match.end(),
                'text': match.group(0),
                'type': 'event_handler',
                'is_section': False
            })
        
        # Find export statement
        for match in self._REACT_PATTERNS['export'].finditer(text):
            boundaries.append({
                'index': match.start(),
                'end': match.end(),
                'text': match.group(0),
                'type': 'export',
                'is_section': True
            })
            
        # Add a boundary at the beginning if none exists
        if not boundaries or boundaries[0]['index'] > 0:
            boundaries.insert(0, {
                'index': 0,
                'end': 0,
                'text': '',
                'type': 'start',
                'is_section': False
            })
            
        # Sort boundaries by position
        boundaries.sort(key=lambda x: x['index'])
        
        return boundaries
    
    def _create_context_tracker(self) -> Optional[Dict[str, Any]]:
        """
        Create a context tracker for React/Vue components.
        
        Returns:
            Context tracker dictionary
        """
        return {
            'imports': [],
            'component_name': None,
            'sections': [],
            'is_vue': self.is_vue,
            'current_section': None
        }
    
    def _update_context_tracker(self, context_tracker: Optional[Dict[str, Any]], boundary: Dict[str, Any]):
        """
        Update context tracker with React/Vue component information.
        
        Args:
            context_tracker: Context tracker to update
            boundary: Current boundary information
        """
        if not context_tracker:
            return
            
        boundary_type = boundary.get('type', '')
        boundary_text = boundary.get('text', '')
        
        # Track imports
        if boundary_type == 'import' and boundary_text:
            if boundary_text not in context_tracker['imports']:
                context_tracker['imports'].append(boundary_text)
        
        # Track component name
        if 'component_name' in boundary:
            context_tracker['component_name'] = boundary.get('component_name')
        
        # Track sections for Vue components
        if self.is_vue and boundary.get('is_section', False):
            if boundary_type in ['template_tag', 'script_tag', 'style_tag']:
                if boundary_text.startswith('</'):
                    # End tag
                    if context_tracker['current_section'] == boundary_type.replace('_tag', ''):
                        context_tracker['current_section'] = None
                else:
                    # Start tag
                    section_name = boundary_type.replace('_tag', '')
                    context_tracker['current_section'] = section_name
                    if section_name not in context_tracker['sections']:
                        context_tracker['sections'].append(section_name)
        
        # Track sections for React components
        if not self.is_vue and boundary.get('is_section', False):
            if boundary_type not in context_tracker['sections']:
                context_tracker['sections'].append(boundary_type)
    
    def _get_preserved_context(self, context_tracker: Dict[str, Any]) -> str:
        """
        Get preserved context for React/Vue components.
        
        Args:
            context_tracker: Context tracker
            
        Returns:
            Component context string
        """
        if not context_tracker:
            return ""
            
        context_lines = []
        
        # Add framework identifier
        if self.is_vue:
            context_lines.append("// Vue Component")
        else:
            context_lines.append("// React Component")
            
        # Add component name if available
        if context_tracker['component_name']:
            context_lines.append(f"// Component: {context_tracker['component_name']}")
            
        # Add import statements
        if context_tracker['imports']:
            context_lines.append("\n// Important imports:")
            # Limit to 5 most important imports to avoid context bloat
            top_imports = context_tracker['imports'][:5]
            context_lines.extend(top_imports)
            if len(context_tracker['imports']) > 5:
                context_lines.append(f"// ... and {len(context_tracker['imports']) - 5} more imports")
            
        # Add section information
        if context_tracker['sections']:
            context_lines.append("\n// Component structure:")
            for section in context_tracker['sections']:
                context_lines.append(f"// - {section}")
                
        return "\n".join(context_lines)
    
    def _create_new_chunk_with_context(
        self,
        previous_chunk: str,
        context_tracker: Optional[Dict[str, Any]],
        overlap_chars: int,
        boundary: Dict[str, Any],
        options: ChunkingOptions
    ) -> str:
        """
        Create a new chunk with React/Vue-specific context and overlap.
        
        Args:
            previous_chunk: Previous chunk content
            context_tracker: Context tracker
            overlap_chars: Number of chars to overlap
            boundary: Current boundary information
            options: Chunking options
            
        Returns:
            New chunk text with context
        """
        # Start with context
        if context_tracker:
            preserved_context = self._get_preserved_context(context_tracker)
            if preserved_context:
                chunk = f"// COMPONENT CONTEXT FROM PREVIOUS CHUNK\n{preserved_context}\n\n// CURRENT CODE CONTENT\n"
            else:
                chunk = "// Continued from previous chunk\n"
        else:
            chunk = "// Continued from previous chunk\n"
        
        # Add overlap if configured
        if overlap_chars > 0 and len(previous_chunk) > overlap_chars:
            # For React/Vue, try to start at a clean line
            overlap_content = previous_chunk[-overlap_chars:]
            
            # Look for newlines to start at a clean line
            line_match = re.search(r'\n', overlap_content)
            if line_match:
                # Start from the line break for cleaner context
                overlap_content = overlap_content[line_match.end():]
            
            chunk += overlap_content
        
        return chunk
    
    def _add_metadata_comments(self, chunks: List[str], options: ChunkingOptions) -> List[str]:
        """
        Add component-specific metadata comments to chunks.
        
        Args:
            chunks: List of chunks to add metadata to
            options: Chunking options
            
        Returns:
            Chunks with metadata comments
        """
        if not chunks:
            return chunks
        
        total_chunks = len(chunks)
        framework = "Vue" if self.is_vue else "React"
        
        return [
            f"// {framework} COMPONENT CHUNK {i+1}/{total_chunks}\n{chunk}"
            for i, chunk in enumerate(chunks)
        ]
    
    @lru_cache(maxsize=8)
    def _detect_vue_component(self, text: str) -> bool:
        """
        Detect if text is a Vue component.
        
        Args:
            text: Code to analyze
            
        Returns:
            True if it's a Vue component
        """
        # Look for Vue SFC structure
        has_template = '<template>' in text and '</template>' in text
        has_script = '<script>' in text and '</script>' in text
        
        # Alternative detection for Vue options API or composition API
        vue_api_patterns = [
            r'createApp\(',
            r'new Vue\(',
            r'Vue\.component\(',
            r'defineComponent\(',
            r'setup\s*\(',
            r'export\s+default\s*{[\s\S]*?(?:data|methods|computed|watch|props)\s*:'
        ]
        
        vue_api_match = any(re.search(pattern, text) for pattern in vue_api_patterns)
        
        return has_template or (has_script and vue_api_match)
    
    @lru_cache(maxsize=1)
    def _get_chunking_strategy(self) -> ChunkingStrategy:
        """
        Get the chunking strategy this implementation represents.
        
        Returns:
            ChunkingStrategy enum value
        """
        return ChunkingStrategy.STRUCTURAL