"""
Smalltalk-specific chunking strategy implementation.

Provides intelligent chunking for Smalltalk code with robust support for:
- Class and method boundary detection
- Dialect-specific syntax handling
- Context preservation across chunks
- Support for multiple Smalltalk dialects:
  - Squeak
  - Pharo
  - VisualWorks
  - GemStone
  - Dolphin
  - GNU Smalltalk
  - Amber
  - Cuis
"""

import re
import logging
import time
from typing import List, Dict, Any, Optional, Tuple, Set, ClassVar, Pattern
from functools import lru_cache

from enterprise_chunker.strategies.base import BaseChunkingStrategy
from enterprise_chunker.models.enums import ContentFormat, ChunkingStrategy
from enterprise_chunker.config import ChunkingOptions
from enterprise_chunker.utils.token_estimation import estimate_tokens
from enterprise_chunker.patterns.regex_patterns import RegexPatterns
from enterprise_chunker.models.chunk_metadata import ChunkingResult

# Configure logging
logger = logging.getLogger(__name__)


class SmalltalkDialect:
    """Supported Smalltalk dialects"""
    STANDARD = "standard"
    VISUALWORKS = "visualworks"
    PHARO = "pharo"
    SQUEAK = "squeak"
    GEMSTONE = "gemstone"
    DOLPHIN = "dolphin"
    GNU = "gnu"
    AMBER = "amber"
    CUIS = "cuis"
    UNKNOWN = "unknown"


class SmalltalkChunkingStrategy(BaseChunkingStrategy):
    """
    Strategy for chunking Smalltalk code with method and class awareness.
    
    Supports multiple Smalltalk dialects with specific pattern recognition 
    and structure-preserving chunking. The strategy intelligently handles
    various Smalltalk syntax variants and file formats.
    
    Features:
        - Multi-dialect support with automatic detection
        - Class and method boundary preservation
        - Context tracking across chunks
        - Support for file-in format and source code
    """
    
    # Cached regex patterns compiled at module load time
    _CLASS_PATTERNS: ClassVar[Dict[str, Dict[str, Pattern]]] = {}
    _METHOD_PATTERNS: ClassVar[Dict[str, Dict[str, Pattern]]] = {}
    
    # Dialect detection patterns - compiled at class initialization
    _DIALECT_PATTERNS: ClassVar[Dict[str, List[str]]] = {
        SmalltalkDialect.VISUALWORKS: [
            r'!!.*?methodsFor:',       # VisualWorks file-in format
            r'!classDefinition:',      # VisualWorks class definition
            r'Smalltalk\s+at:',        # VisualWorks global access
            r'core\.Object',           # VisualWorks namespace
            r'VisualWorks',            # Direct mention
            r'parcel:\s+',             # VisualWorks parcels
            r'USERINIT\.ST',           # Common VisualWorks file
            r'abtVariableSubclass:',   # ABT VisualWorks extension
            r'NameSpace current'       # VisualWorks namespace access
        ],
        
        SmalltalkDialect.PHARO: [
            r'Pharo(?:\s+class)?',         # Direct mention
            r'SystemVersion',               # Pharo system class
            r'package:',                    # Pharo packaging
            r'Pragma',                      # Pharo pragmas
            r'ZnHttpServer',                # Pharo-specific class
            r'RPackage',                    # Pharo package system
            r'Metacello new',               # Pharo Metacello
            r'PharoKernel',                 # Pharo kernel
            r'Spec',                        # Pharo Spec UI framework
            r'SystemAnnouncer',             # Pharo announcer
            r'Iceberg',                     # Pharo Iceberg
            r'StPlayground'                 # Pharo Playground
        ],
        
        SmalltalkDialect.SQUEAK: [
            r'Squeak(?:\s+class)?',        # Direct mention
            r'SystemWindow',                # Squeak GUI
            r'Morphic',                     # Squeak Morphic
            r'ScriptingSystem',             # Squeak scripting
            r'SmalltalkImage',              # Squeak system
            r'WorldState',                  # Squeak world
            r'StandardSystemView',          # Squeak MVC
            r'initializeImageFormat',       # Squeak image format
            r'Project current',             # Squeak projects
            r'FileList open'                # Squeak file browser
        ],
        
        SmalltalkDialect.GEMSTONE: [
            r'GemStone(?:\s+class)?',      # Direct mention
            r'System\s+class',              # GemStone system class
            r'inDictionary:',               # GemStone-specific syntax
            r'transient',                   # GemStone transaction
            r'commitTransaction',           # GemStone commit
            r'UserGlobals',                 # GemStone globals
            r'abort:',                      # GemStone abort
            r'System myUserProfile',        # GemStone user profile
            r'SymbolDictionary',            # GemStone symbol dict
            r'GsObject'                     # GemStone object
        ],
        
        SmalltalkDialect.DOLPHIN: [
            r'Dolphin(?:\s+class)?',       # Direct mention
            r'package\s+paxVersion',        # Dolphin PAX
            r'DolphinSureFire',             # Dolphin SureFire
            r'Win32Constants',              # Dolphin Win32
            r'Filename class',              # Dolphin filename
            r'SmalltalkSystem current',     # Dolphin system
            r'SmalltalkParseError',         # Dolphin parse error
            r'ImageStripper',               # Dolphin image stripper
            r'DolphinDependencyChecker',    # Dolphin dependency checker
            r'AXControlLibrary'             # Dolphin ActiveX
        ],
        
        SmalltalkDialect.GNU: [
            r'GNU Smalltalk',              # Direct mention
            r'FileStream stderr',           # GNU stderr
            r'ObjectMemory',                # GNU memory
            r'CObject',                     # GNU C object
            r'CPtr',                        # GNU C pointer
            r'CString',                     # GNU C string
            r'CStringPtr',                  # GNU C string pointer
            r'CType',                       # GNU C type
            r'ArrayCType',                  # GNU array C type
            r'Namespace current'            # GNU namespace
        ],
        
        SmalltalkDialect.AMBER: [
            r'Amber(?:\s+class)?',         # Direct mention
            r'package\s*\(\s*[\'"].*?[\'"]', # Amber package
            r'defineClass:',                # Amber class definition
            r'exportAs:',                   # Amber export
            r'amber\/.*?\.js',              # Amber JS
            r'smalltalk\.classes',          # Amber classes
            r'^\s*return\s+self\._',        # Amber method pattern
            r'_[\w]+_',                     # Amber internal methods
            r'@AmberComponent',             # Amber component annotation
            r'HTMLCanvas'                   # Amber HTML canvas
        ],
        
        SmalltalkDialect.CUIS: [
            r'Cuis(?:\s+class)?',          # Direct mention
            r'ClassComment',                # Cuis class comment
            r'SystemWindow subclass',       # Cuis window
            r'Feature require:',            # Cuis feature
            r'\'Cuis\'',                    # Cuis string
            r'Feature\s+require:\s+#',      # Cuis feature
            r'Theme',                       # Cuis theme
            r'MorphicCanvas',               # Cuis morphic
            r'WorldState',                  # Cuis world
            r'ExtendedFileStream'           # Cuis file stream
        ]
    }
    
    # Initialize class and method pattern dictionaries
    @classmethod
    def _init_patterns(cls):
        """Initialize cached regex pattern dictionaries."""
        if not cls._CLASS_PATTERNS:
            cls._CLASS_PATTERNS = cls._compile_class_patterns()
            
        if not cls._METHOD_PATTERNS:
            cls._METHOD_PATTERNS = cls._compile_method_patterns()
    
    def __init__(self):
        """Initialize the Smalltalk chunking strategy with cached patterns."""
        super().__init__(ContentFormat.CODE)
        self.dialect = SmalltalkDialect.UNKNOWN  # Will detect the dialect during chunking
        
        # Initialize patterns at first instantiation
        if not self.__class__._CLASS_PATTERNS:
            self.__class__._init_patterns()
    
    def chunk(self, text: str, options: ChunkingOptions) -> ChunkingResult:
        """
        Override to detect Smalltalk dialect before chunking.
        
        Args:
            text: Smalltalk code to chunk
            options: Chunking options
            
        Returns:
            ChunkingResult with chunks and metadata
        """
        # Detect the Smalltalk dialect
        self.dialect = self._detect_smalltalk_dialect(text)
        logger.debug(f"[{self.operation_id}] Detected Smalltalk dialect: {self.dialect}")
        
        # Continue with normal chunking process
        return super().chunk(text, options)
    
    def detect_boundaries(self, text: str, options: ChunkingOptions) -> List[Dict[str, Any]]:
        """
        Detect method and class boundaries in Smalltalk code.
        
        This method analyzes Smalltalk code to identify structural elements such as
        classes, methods, and blocks to create logical chunking boundaries.
        
        Args:
            text: Smalltalk code to analyze
            options: Chunking options
            
        Returns:
            List of boundary dictionaries
        """
        boundaries = []
        
        # Detect file format (fileIn vs. source code)
        is_file_in = self._is_file_in_format(text)
        
        # First, detect file chunks (for file-in format)
        if is_file_in:
            self._detect_file_in_chunks(text, boundaries)
        
        # Next, detect class definitions
        self._detect_class_definitions(text, boundaries)
        
        # Detect method definitions
        self._detect_method_definitions(text, boundaries)
        
        # Detect blocks and other structural elements
        self._detect_block_structures(text, boundaries)
        
        # Detect pragmas
        self._detect_pragmas(text, boundaries)
        
        # Detect trait compositions
        self._detect_trait_compositions(text, boundaries)
        
        # Add a boundary at the beginning if none exists
        if not boundaries or boundaries[0]['index'] > 0:
            boundaries.insert(0, {
                'index': 0,
                'end': 0,
                'text': '',
                'type': 'start',
            })
        
        # Sort boundaries by position
        boundaries.sort(key=lambda x: x['index'])
        
        return boundaries
    
    def _is_file_in_format(self, text: str) -> bool:
        """
        Detect if the text is in file-in format.
        
        Args:
            text: Smalltalk code to analyze
            
        Returns:
            True if file-in format, False otherwise
        """
        # Check for file-in format patterns
        file_in_markers = [
            r'^".*"!',                          # Filename marker
            r'!!.*!',                           # Chunk marker
            r'!classDefinition:',               # VisualWorks class definition
            r'^[-a-zA-Z0-9_]+\s+methodsFor:',   # Method category marker
        ]
        
        for marker in file_in_markers:
            if re.search(marker, text, re.MULTILINE):
                return True
                
        return False
    
    def _detect_file_in_chunks(self, text: str, boundaries: List[Dict[str, Any]]):
        """
        Detect file-in format chunk boundaries.
        
        Args:
            text: Smalltalk code to analyze
            boundaries: List to add boundaries to
        """
        # File-in chunks are typically delimited by ! characters
        
        # Filename/class markers
        filename_pattern = re.compile(r'^"([^"]+)"!', re.MULTILINE)
        for match in filename_pattern.finditer(text):
            filename = match.group(1)
            boundaries.append({
                'index': match.start(),
                'end': match.end(),
                'text': match.group(0),
                'type': 'filename_declaration',
                'is_declaration': True,
                'filename': filename
            })
        
        # VisualWorks style chunk declarations
        if self.dialect == SmalltalkDialect.VISUALWORKS:
            chunk_patterns = [
                # Method category chunk
                (r'!([A-Z][a-zA-Z0-9_]*)\s+methodsFor:\s*[\'"](.*?)[\'"](.*?)!', 'method_category'),
                # Class-side method category chunk
                (r'!([A-Z][a-zA-Z0-9_]*)\s+class\s+methodsFor:\s*[\'"](.*?)[\'"](.*?)!', 'class_method_category'),
                # Class definition chunk
                (r'!classDefinition:[\s\S]*?!', 'class_definition_chunk'),
                # Class comment chunk
                (r'!([A-Z][a-zA-Z0-9_]*)\s+commentStamp:[\s\S]*?!', 'class_comment'),
                # Initialize chunk
                (r'!([A-Z][a-zA-Z0-9_]*)\s+initialize!', 'initialize_chunk'),
                # General double-bang chunk
                (r'!![\s\S]*?!', 'generic_chunk')
            ]
            
            for pattern, chunk_type in chunk_patterns:
                for match in re.finditer(pattern, text, re.DOTALL):
                    # Extract class name and category if available
                    class_name = None
                    category = None
                    
                    if chunk_type in ('method_category', 'class_method_category') and match.groups():
                        class_name = match.group(1)
                        if len(match.groups()) > 1:
                            category = match.group(2)
                    
                    boundaries.append({
                        'index': match.start(),
                        'end': match.end(),
                        'text': match.group(0),
                        'type': chunk_type,
                        'is_chunk': True,
                        'class_name': class_name,
                        'category': category
                    })
        
        # Squeak/Pharo style chunk declarations
        elif self.dialect in (SmalltalkDialect.SQUEAK, SmalltalkDialect.PHARO, SmalltalkDialect.CUIS):
            # In Squeak/Pharo, methods often appear after class definitions with ---
            method_chunk_pattern = re.compile(r'^([\s\S]*?)(\r?\n---+\r?\n)', re.MULTILINE)
            for match in method_chunk_pattern.finditer(text):
                boundaries.append({
                    'index': match.start(2),  # Start of separator
                    'end': match.end(2),      # End of separator
                    'text': match.group(2),
                    'type': 'method_separator',
                    'is_separator': True
                })
    
    def _detect_class_definitions(self, text: str, boundaries: List[Dict[str, Any]]):
        """
        Detect class definition boundaries.
        
        Args:
            text: Smalltalk code to analyze
            boundaries: List to add boundaries to
        """
        # Get dialect-specific class patterns
        dialect_patterns = self._CLASS_PATTERNS.get(self.dialect, self._CLASS_PATTERNS[SmalltalkDialect.STANDARD])
        
        # Also try standard patterns as fallback
        patterns_to_try = [dialect_patterns]
        if self.dialect != SmalltalkDialect.STANDARD:
            patterns_to_try.append(self._CLASS_PATTERNS[SmalltalkDialect.STANDARD])
        
        for pattern_dict in patterns_to_try:
            for pattern_type, pattern in pattern_dict.items():
                for match in pattern.finditer(text, re.MULTILINE):
                    # Extract class information
                    superclass = match.group(1) if match.groups() else None
                    subclass = match.group(2) if len(match.groups()) > 1 else None
                    
                    # Extract variables if present
                    instance_vars = []
                    class_vars = []
                    
                    # Look for instance variables
                    if 'instanceVariableNames:' in match.group(0) or 'instVarNames:' in match.group(0):
                        var_match = re.search(r'(?:instanceVariableNames:|instVarNames:)\s*[\'"](.+?)[\'"]', match.group(0))
                        if var_match:
                            instance_vars = [v.strip() for v in var_match.group(1).split()]
                    
                    # Look for class variables
                    if 'classVariableNames:' in match.group(0) or 'classVars:' in match.group(0):
                        var_match = re.search(r'(?:classVariableNames:|classVars:)\s*[\'"](.+?)[\'"]', match.group(0))
                        if var_match:
                            class_vars = [v.strip() for v in var_match.group(1).split()]
                    
                    # Determine category/package
                    category = None
                    for cat_pattern in (r'category:\s*[\'"](.+?)[\'"]', r'package:\s*[\'"](.+?)[\'"]'):
                        cat_match = re.search(cat_pattern, match.group(0))
                        if cat_match:
                            category = cat_match.group(1)
                            break
                    
                    boundaries.append({
                        'index': match.start(),
                        'end': match.end(), 
                        'text': match.group(0),
                        'type': 'class_definition',
                        'is_class': True,
                        'definition_type': pattern_type,
                        'superclass': superclass,
                        'subclass': subclass,
                        'instance_vars': instance_vars,
                        'class_vars': class_vars,
                        'category': category
                    })
    
    def _detect_method_definitions(self, text: str, boundaries: List[Dict[str, Any]]):
        """
        Detect method definition boundaries.
        
        Args:
            text: Smalltalk code to analyze
            boundaries: List to add boundaries to
        """
        # In Smalltalk, methods are defined with the format:
        # methodName: arg1 with: arg2
        #    "method comment"
        #    | temp1 temp2 |
        #    statements.
        #    ^returnValue
        
        # Get dialect-specific method patterns
        method_patterns = self._METHOD_PATTERNS.get(self.dialect, self._METHOD_PATTERNS[SmalltalkDialect.STANDARD])
        
        for pattern_type, pattern in method_patterns.items():
            for match in pattern.finditer(text, re.MULTILINE):
                # Different patterns have different group structures
                method_name = None
                if match.groups():
                    method_name = match.group(1)
                
                # Skip if we can't determine the method name
                if not method_name:
                    continue
                
                # Determine method type and structure
                is_keyword_method = ':' in method_name
                is_binary_method = not is_keyword_method and re.match(r'^[-+*/~<>=@,%|&?!]', method_name.strip())
                is_unary_method = not (is_keyword_method or is_binary_method)
                
                # Check if this is a class-side method
                is_class_method = False
                if pattern_type == 'class_method':
                    is_class_method = True
                
                boundaries.append({
                    'index': match.start(),
                    'end': match.end(),
                    'text': match.group(0),
                    'type': 'method_definition',
                    'is_method': True,
                    'method_name': method_name.strip(),
                    'is_class_method': is_class_method,
                    'is_keyword_method': is_keyword_method,
                    'is_binary_method': is_binary_method,
                    'is_unary_method': is_unary_method
                })
    
    def _detect_block_structures(self, text: str, boundaries: List[Dict[str, Any]]):
        """
        Detect block structures in Smalltalk code.
        
        Args:
            text: Smalltalk code to analyze
            boundaries: List to add boundaries to
        """
        # Block structure patterns
        block_patterns = [
            # Block with arguments
            (r'\[\s*(?::\w+\s*)+\|', 'block_with_args'),
            # Block with temps
            (r'\[\s*\|\s*\w+(?:\s+\w+)*\s*\|', 'block_with_temps'),
            # Simple block
            (r'\[\s*(?!\|)(?!:)', 'simple_block'),
            # Block return
            (r'\^\s*\[', 'block_return'),
            # Method return
            (r'^\s*\^', 'method_return'),
            # Temp variables
            (r'^\s*\|\s*\w+(?:\s+\w+)*\s*\|', 'temp_vars')
        ]
        
        for pattern, block_type in block_patterns:
            for match in re.finditer(pattern, text, re.MULTILINE):
                boundaries.append({
                    'index': match.start(),
                    'end': match.end(),
                    'text': match.group(0),
                    'type': block_type,
                    'is_block': block_type.startswith('block'),
                    'is_return': 'return' in block_type
                })
    
    def _detect_pragmas(self, text: str, boundaries: List[Dict[str, Any]]):
        """
        Detect method pragmas in Smalltalk code.
        
        Args:
            text: Smalltalk code to analyze
            boundaries: List to add boundaries to
        """
        # Pragma patterns vary by dialect
        pragma_patterns = {
            SmalltalkDialect.PHARO: r'<(\w+)(?::.*?)?(?:\s+.*?)?>',
            SmalltalkDialect.SQUEAK: r'<(\w+)(?::.*?)?(?:\s+.*?)?>',
            SmalltalkDialect.VISUALWORKS: r'<(\w+)(?::.*?)?(?:\s+.*?)?>',
            SmalltalkDialect.GEMSTONE: r'<(\w+)(?::.*?)?(?:\s+.*?)?>',
            SmalltalkDialect.DOLPHIN: r'\[\s*<(\w+)(?::.*?)?(?:\s+.*?)?>\s*\]',
            SmalltalkDialect.GNU: r'<(\w+)(?::.*?)?(?:\s+.*?)?>',
            SmalltalkDialect.STANDARD: r'<(\w+)(?::.*?)?(?:\s+.*?)?>',
        }
        
        # Get the appropriate pattern
        pragma_pattern = pragma_patterns.get(self.dialect, pragma_patterns[SmalltalkDialect.STANDARD])
        
        for match in re.finditer(pragma_pattern, text, re.MULTILINE):
            pragma_name = match.group(1) if match.groups() else "unknown"
            
            boundaries.append({
                'index': match.start(),
                'end': match.end(),
                'text': match.group(0),
                'type': 'pragma',
                'is_pragma': True,
                'pragma_name': pragma_name
            })
    
    def _detect_trait_compositions(self, text: str, boundaries: List[Dict[str, Any]]):
        """
        Detect trait compositions in Smalltalk code (Pharo-specific).
        
        Args:
            text: Smalltalk code to analyze
            boundaries: List to add boundaries to
        """
        # Trait composition patterns (mainly for Pharo)
        if self.dialect in (SmalltalkDialect.PHARO, SmalltalkDialect.CUIS):
            trait_patterns = [
                # Trait composition
                (r'^\s*(\w+)\s+uses:\s+(\w+(?:\s*\+\s*\w+)*)', 'trait_composition'),
                # Trait method exclusion
                (r'^\s*(\w+)\s+uses:\s+\w+(?:\s*\+\s*\w+)*\s+-\s+\{(.*?)\}', 'trait_exclusion'),
                # Trait alias
                (r'^\s*(\w+)\s+uses:\s+\w+(?:\s*\+\s*\w+)*\s+@\s+\{(.*?)\}', 'trait_alias'),
            ]
            
            for pattern, trait_type in trait_patterns:
                for match in re.finditer(pattern, text, re.MULTILINE):
                    class_name = match.group(1) if match.groups() else None
                    
                    boundaries.append({
                        'index': match.start(),
                        'end': match.end(),
                        'text': match.group(0),
                        'type': trait_type,
                        'is_trait': True,
                        'class_name': class_name
                    })
    
    def _create_context_tracker(self) -> Optional[Dict[str, Any]]:
        """
        Create a context tracker for Smalltalk code.
        
        Returns:
            Context tracker dictionary
        """
        return {
            'current_class': None,
            'current_superclass': None,
            'current_category': None,
            'current_protocol': None,
            'instance_vars': [],
            'class_vars': [],
            'dialect': self.dialect,
            'current_method': None,
            'is_class_side': False,
            'traits': [],
            'in_file_chunk': False,
            'file_chunk_type': None
        }
    
    def _update_context_tracker(self, context_tracker: Optional[Dict[str, Any]], boundary: Dict[str, Any]):
        """
        Update context tracker with Smalltalk class and method information.
        
        Args:
            context_tracker: Context tracker to update
            boundary: Current boundary information
        """
        if not context_tracker:
            return
            
        boundary_type = boundary.get('type', '')
        
        # Update class information
        if boundary_type == 'class_definition':
            context_tracker['current_class'] = boundary.get('subclass')
            context_tracker['current_superclass'] = boundary.get('superclass')
            context_tracker['instance_vars'] = boundary.get('instance_vars', [])
            context_tracker['class_vars'] = boundary.get('class_vars', [])
            context_tracker['current_category'] = boundary.get('category')
            context_tracker['is_class_side'] = False  # Reset to instance side
            
        # Update method information
        elif boundary_type == 'method_definition':
            context_tracker['current_method'] = boundary.get('method_name')
            context_tracker['is_class_side'] = boundary.get('is_class_method', False)
            
        # Update chunk information (for file-in format)
        elif 'is_chunk' in boundary and boundary.get('is_chunk'):
            context_tracker['in_file_chunk'] = True
            context_tracker['file_chunk_type'] = boundary_type
            
            # Update class from chunk if available
            if 'class_name' in boundary and boundary['class_name']:
                context_tracker['current_class'] = boundary['class_name']
            
            # Update protocol/category from chunk if available
            if 'category' in boundary and boundary['category']:
                context_tracker['current_protocol'] = boundary['category']
                
            # Set class-side flag
            if boundary_type == 'class_method_category':
                context_tracker['is_class_side'] = True
            elif boundary_type == 'method_category':
                context_tracker['is_class_side'] = False
                
        # Update trait information
        elif 'is_trait' in boundary and boundary.get('is_trait'):
            if 'class_name' in boundary and boundary['class_name']:
                trait_text = boundary.get('text', '')
                if trait_text not in context_tracker['traits']:
                    context_tracker['traits'].append(trait_text)
    
    def _get_preserved_context(self, context_tracker: Dict[str, Any]) -> str:
        """
        Get preserved context information for Smalltalk code.
        
        Args:
            context_tracker: Context tracker
            
        Returns:
            Smalltalk context string
        """
        if not context_tracker:
            return ""
            
        context_lines = []
        
        # Add dialect information
        context_lines.append(f'"Smalltalk dialect: {context_tracker["dialect"]}"')
        
        # Add class context if available
        if context_tracker['current_class'] and context_tracker['current_superclass']:
            context_lines.append(f'"{context_tracker["current_superclass"]} subclass: #{context_tracker["current_class"]}"')
        
        # Add category if available
        if context_tracker['current_category']:
            context_lines.append(f'"Category: {context_tracker["current_category"]}"')
            
        # Add protocol if available
        if context_tracker['current_protocol']:
            context_lines.append(f'"Protocol: {context_tracker["current_protocol"]}"')
            
        # Add side information (class vs instance)
        if context_tracker['is_class_side']:
            context_lines.append('"Class side"')
        else:
            context_lines.append('"Instance side"')
            
        # Add current method if available
        if context_tracker['current_method']:
            context_lines.append(f'"Current method: {context_tracker["current_method"]}"')
            
        # Add instance variables if available
        if context_tracker['instance_vars']:
            vars_str = ' '.join(context_tracker['instance_vars'])
            context_lines.append(f'"Instance variables: {vars_str}"')
            
        # Add class variables if available
        if context_tracker['class_vars']:
            vars_str = ' '.join(context_tracker['class_vars'])
            context_lines.append(f'"Class variables: {vars_str}"')
            
        # Add trait information if available
        if context_tracker['traits']:
            context_lines.append('"Traits:"')
            for trait in context_tracker['traits'][:3]:  # Limit to 3 traits for brevity
                context_lines.append(f'"{trait.strip()}"')
                
        # Add file chunk information if applicable
        if context_tracker['in_file_chunk'] and context_tracker['file_chunk_type']:
            context_lines.append(f'"In {context_tracker["file_chunk_type"]}"')
            
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
        Create a new chunk with Smalltalk-specific context and overlap.
        
        Args:
            previous_chunk: Previous chunk content
            context_tracker: Context tracker
            overlap_chars: Number of chars to overlap
            boundary: Current boundary information
            options: Chunking options
            
        Returns:
            New chunk text with context
        """
        # Get context information
        context = self._get_preserved_context(context_tracker) if context_tracker else ""
        
        # Create header with context
        if context:
            chunk = f"{context}\n\n"
        else:
            chunk = '"Continued from previous chunk"\n\n'
            
        # Add overlap if configured
        if overlap_chars > 0 and len(previous_chunk) > overlap_chars:
            # For Smalltalk, try to start at a clean statement
            overlap_content = previous_chunk[-overlap_chars:]
            
            # Look for statement endings (period followed by whitespace or newline)
            statement_match = re.search(r'\.\s+', overlap_content)
            if statement_match:
                # Start from after the statement end
                overlap_content = overlap_content[statement_match.end():]
            elif re.search(r'!\s*$', overlap_content):
                # File-in format chunk ending
                overlap_content = ""
            
            chunk += overlap_content
        
        return chunk
    
    def _add_metadata_comments(self, chunks: List[str], options: ChunkingOptions) -> List[str]:
        """
        Add Smalltalk-specific metadata comments to chunks.
        
        Args:
            chunks: List of chunks to add metadata to
            options: Chunking options
            
        Returns:
            Chunks with metadata comments
        """
        if not chunks:
            return chunks
        
        total_chunks = len(chunks)
        
        return [
            f'"SMALLTALK CHUNK {i+1}/{total_chunks} ({self.dialect})"\n{chunk}'
            for i, chunk in enumerate(chunks)
        ]
    
    @lru_cache(maxsize=16)
    def _detect_smalltalk_dialect(self, text: str) -> str:
        """
        Detect the Smalltalk dialect from code patterns.
        
        Args:
            text: Smalltalk code to analyze
            
        Returns:
            Dialect identifier string
        """
        # Check each dialect's patterns and count matches
        dialect_scores = {}
        
        for dialect, patterns in self._DIALECT_PATTERNS.items():
            matches = sum(1 for pattern in patterns if re.search(pattern, text))
            dialect_scores[dialect] = matches
        
        # Get dialect with highest score
        best_dialect, best_score = max(dialect_scores.items(), key=lambda x: x[1])
        
        # If score is 0 or very low, return "standard"
        if best_score < 2:
            return SmalltalkDialect.STANDARD
            
        return best_dialect
    
    @classmethod
    def _compile_class_patterns(cls) -> Dict[str, Dict[str, Pattern]]:
        """
        Compile regex patterns for class definitions.
        
        Returns:
            Dictionary of dialect-specific pattern dictionaries
        """
        patterns = {
            # Standard patterns
            SmalltalkDialect.STANDARD: {
                'subclass': r'^\s*([A-Z][a-zA-Z0-9_]*)(?:\s+class)?\s+(?:subclass:\s+#([A-Z][a-zA-Z0-9_]*)(?:\s+instanceVariableNames:\s*[\'"](.*?)[\'"])?(?:\s+classVariableNames:\s*[\'"](.*?)[\'"])?(?:\s+poolDictionaries:\s*[\'"](.*?)[\'"])?(?:\s+category:\s*[\'"](.*?)[\'"])?)(?:!|\.)?$',
                'variableSubclass': r'^\s*([A-Z][a-zA-Z0-9_]*)(?:\s+class)?\s+(?:variableSubclass:\s+#([A-Z][a-zA-Z0-9_]*)(?:\s+instanceVariableNames:\s*[\'"](.*?)[\'"])?(?:\s+classVariableNames:\s*[\'"](.*?)[\'"])?(?:\s+poolDictionaries:\s*[\'"](.*?)[\'"])?(?:\s+category:\s*[\'"](.*?)[\'"])?)(?:!|\.)?$',
            },
            
            # VisualWorks patterns
            SmalltalkDialect.VISUALWORKS: {
                'subclass': r'^\s*([A-Z][a-zA-Z0-9_]*)\s+(?:subclass):\s+#([A-Z][a-zA-Z0-9_]*)(?:\s+instanceVariableNames:\s*[\'"](.*?)[\'"])?(?:\s+classVariableNames:\s*[\'"](.*?)[\'"])?(?:\s+(?:poolDictionaries|imports):\s*[\'"](.*?)[\'"])?(?:\s+(?:category|asAbstract):\s*[\'"](.*?)[\'"])?',
                'variableSubclass': r'^\s*([A-Z][a-zA-Z0-9_]*)\s+(?:variableSubclass):\s+#([A-Z][a-zA-Z0-9_]*)(?:\s+instanceVariableNames:\s*[\'"](.*?)[\'"])?(?:\s+classVariableNames:\s*[\'"](.*?)[\'"])?(?:\s+(?:poolDictionaries|imports):\s*[\'"](.*?)[\'"])?(?:\s+(?:category|asAbstract):\s*[\'"](.*?)[\'"])?',
                'variableByteSubclass': r'^\s*([A-Z][a-zA-Z0-9_]*)\s+(?:variableByteSubclass):\s+#([A-Z][a-zA-Z0-9_]*)(?:\s+instanceVariableNames:\s*[\'"](.*?)[\'"])?(?:\s+classVariableNames:\s*[\'"](.*?)[\'"])?(?:\s+(?:poolDictionaries|imports):\s*[\'"](.*?)[\'"])?(?:\s+(?:category|asAbstract):\s*[\'"](.*?)[\'"])?',
                'classDefinition': r'!classDefinition:\s+#([A-Z][a-zA-Z0-9_]*)\s+category:\s*[\'"](.*?)[\'"]\s+superclass:\s+#([A-Z][a-zA-Z0-9_]*)',
            },
            
            # Pharo patterns
            SmalltalkDialect.PHARO: {
                'subclass': r'^\s*([A-Z][a-zA-Z0-9_]*)\s+subclass:\s+#([A-Z][a-zA-Z0-9_]*)(?:\s+uses:\s+[\'"](.*?)[\'"])?(?:\s+instanceVariableNames:\s*[\'"](.*?)[\'"])?(?:\s+classVariableNames:\s*[\'"](.*?)[\'"])?(?:\s+package:\s*[\'"](.*?)[\'"])?',
                'variableSubclass': r'^\s*([A-Z][a-zA-Z0-9_]*)\s+variableSubclass:\s+#([A-Z][a-zA-Z0-9_]*)(?:\s+instanceVariableNames:\s*[\'"](.*?)[\'"])?(?:\s+classVariableNames:\s*[\'"](.*?)[\'"])?(?:\s+package:\s*[\'"](.*?)[\'"])?',
                'variableByteSubclass': r'^\s*([A-Z][a-zA-Z0-9_]*)\s+variableByteSubclass:\s+#([A-Z][a-zA-Z0-9_]*)(?:\s+instanceVariableNames:\s*[\'"](.*?)[\'"])?(?:\s+classVariableNames:\s*[\'"](.*?)[\'"])?(?:\s+package:\s*[\'"](.*?)[\'"])?',
                'variableWordSubclass': r'^\s*([A-Z][a-zA-Z0-9_]*)\s+variableWordSubclass:\s+#([A-Z][a-zA-Z0-9_]*)(?:\s+instanceVariableNames:\s*[\'"](.*?)[\'"])?(?:\s+classVariableNames:\s*[\'"](.*?)[\'"])?(?:\s+package:\s*[\'"](.*?)[\'"])?',
                'trait': r'^\s*Trait\s+named:\s+#([A-Z][a-zA-Z0-9_]*)(?:\s+uses:\s+[\'"](.*?)[\'"])?(?:\s+package:\s*[\'"](.*?)[\'"])?',
            },
            
            # Squeak patterns
            SmalltalkDialect.SQUEAK: {
                'subclass': r'^\s*([A-Z][a-zA-Z0-9_]*)\s+subclass:\s+#([A-Z][a-zA-Z0-9_]*)(?:\s+instanceVariableNames:\s*[\'"](.*?)[\'"])?(?:\s+classVariableNames:\s*[\'"](.*?)[\'"])?(?:\s+poolDictionaries:\s*[\'"](.*?)[\'"])?(?:\s+category:\s*[\'"](.*?)[\'"])?',
                'variableSubclass': r'^\s*([A-Z][a-zA-Z0-9_]*)\s+variableSubclass:\s+#([A-Z][a-zA-Z0-9_]*)(?:\s+instanceVariableNames:\s*[\'"](.*?)[\'"])?(?:\s+classVariableNames:\s*[\'"](.*?)[\'"])?(?:\s+poolDictionaries:\s*[\'"](.*?)[\'"])?(?:\s+category:\s*[\'"](.*?)[\'"])?',
                'variableByteSubclass': r'^\s*([A-Z][a-zA-Z0-9_]*)\s+variableByteSubclass:\s+#([A-Z][a-zA-Z0-9_]*)(?:\s+instanceVariableNames:\s*[\'"](.*?)[\'"])?(?:\s+classVariableNames:\s*[\'"](.*?)[\'"])?(?:\s+poolDictionaries:\s*[\'"](.*?)[\'"])?(?:\s+category:\s*[\'"](.*?)[\'"])?',
                'variableWordSubclass': r'^\s*([A-Z][a-zA-Z0-9_]*)\s+variableWordSubclass:\s+#([A-Z][a-zA-Z0-9_]*)(?:\s+instanceVariableNames:\s*[\'"](.*?)[\'"])?(?:\s+classVariableNames:\s*[\'"](.*?)[\'"])?(?:\s+poolDictionaries:\s*[\'"](.*?)[\'"])?(?:\s+category:\s*[\'"](.*?)[\'"])?',
            },
            
            # GemStone patterns
            SmalltalkDialect.GEMSTONE: {
                'subclass': r'^\s*([A-Z][a-zA-Z0-9_]*)\s+(?:subclass):\s+\'([A-Z][a-zA-Z0-9_]*)\'(?:\s+instVarNames:\s+#\((.*?)\))?(?:\s+classVars:\s+#\((.*?)\))?(?:\s+classInstVars:\s+#\((.*?)\))?(?:\s+poolDictionaries:\s+#\((.*?)\))?(?:\s+inDictionary:\s+[\'"](.*?)[\'"])?',
                'variableSubclass': r'^\s*([A-Z][a-zA-Z0-9_]*)\s+(?:variableSubclass):\s+\'([A-Z][a-zA-Z0-9_]*)\'(?:\s+instVarNames:\s+#\((.*?)\))?(?:\s+classVars:\s+#\((.*?)\))?(?:\s+classInstVars:\s+#\((.*?)\))?(?:\s+poolDictionaries:\s+#\((.*?)\))?(?:\s+inDictionary:\s+[\'"](.*?)[\'"])?',
                'indexableSubclass': r'^\s*([A-Z][a-zA-Z0-9_]*)\s+(?:indexableSubclass):\s+\'([A-Z][a-zA-Z0-9_]*)\'(?:\s+instVarNames:\s+#\((.*?)\))?(?:\s+classVars:\s+#\((.*?)\))?(?:\s+classInstVars:\s+#\((.*?)\))?(?:\s+poolDictionaries:\s+#\((.*?)\))?(?:\s+inDictionary:\s+[\'"](.*?)[\'"])?',
            },
            
            # Dolphin patterns
            SmalltalkDialect.DOLPHIN: {
                'subclass': r'^\s*([A-Z][a-zA-Z0-9_]*)\s+subclass:\s+#([A-Z][a-zA-Z0-9_]*)(?:\s+instanceVariableNames:\s*[\'"](.*?)[\'"])?(?:\s+classVariableNames:\s*[\'"](.*?)[\'"])?(?:\s+poolDictionaries:\s*[\'"](.*?)[\'"])?',
                'variableSubclass': r'^\s*([A-Z][a-zA-Z0-9_]*)\s+variableSubclass:\s+#([A-Z][a-zA-Z0-9_]*)(?:\s+instanceVariableNames:\s*[\'"](.*?)[\'"])?(?:\s+classVariableNames:\s*[\'"](.*?)[\'"])?(?:\s+poolDictionaries:\s*[\'"](.*?)[\'"])?',
                'externalClass': r'ExternalClass\s+subclass:\s*#([A-Z][a-zA-Z0-9_]*)\s+instanceVariableNames:\s*[\'"](.*?)[\'"]\s+classVariableNames:\s*[\'"](.*?)[\'"]\s+poolDictionaries:\s*[\'"](.*?)[\'"]\s+superclass:\s*[\'"]([A-Z][a-zA-Z0-9_]*)[\'"]',
            },
            
            # GNU patterns
            SmalltalkDialect.GNU: {
                'subclass': r'^\s*([A-Z][a-zA-Z0-9_]*)\s+subclass:\s+([A-Z][a-zA-Z0-9_]*)(?:\s+instanceVariableNames:\s*[\'"](.*?)[\'"])?(?:\s+classVariableNames:\s*[\'"](.*?)[\'"])?(?:\s+poolDictionaries:\s*[\'"](.*?)[\'"])?(?:\s+category:\s*[\'"](.*?)[\'"])?',
                'variableSubclass': r'^\s*([A-Z][a-zA-Z0-9_]*)\s+variableSubclass:\s+([A-Z][a-zA-Z0-9_]*)(?:\s+instanceVariableNames:\s*[\'"](.*?)[\'"])?(?:\s+classVariableNames:\s*[\'"](.*?)[\'"])?(?:\s+poolDictionaries:\s*[\'"](.*?)[\'"])?(?:\s+category:\s*[\'"](.*?)[\'"])?',
                'variableByteSubclass': r'^\s*([A-Z][a-zA-Z0-9_]*)\s+variableByteSubclass:\s+([A-Z][a-zA-Z0-9_]*)(?:\s+instanceVariableNames:\s*[\'"](.*?)[\'"])?(?:\s+classVariableNames:\s*[\'"](.*?)[\'"])?(?:\s+poolDictionaries:\s*[\'"](.*?)[\'"])?(?:\s+category:\s*[\'"](.*?)[\'"])?',
                'variableWordSubclass': r'^\s*([A-Z][a-zA-Z0-9_]*)\s+variableWordSubclass:\s+([A-Z][a-zA-Z0-9_]*)(?:\s+instanceVariableNames:\s*[\'"](.*?)[\'"])?(?:\s+classVariableNames:\s*[\'"](.*?)[\'"])?(?:\s+poolDictionaries:\s*[\'"](.*?)[\'"])?(?:\s+category:\s*[\'"](.*?)[\'"])?',
            },
            
            # Amber patterns
            SmalltalkDialect.AMBER: {
                'subclass': r'^\s*([A-Z][a-zA-Z0-9_]*)\s+subclass:\s+#([A-Z][a-zA-Z0-9_]*)(?:\s+instanceVariableNames:\s*[\'"](.*?)[\'"])?(?:\s+package:\s*[\'"](.*?)[\'"])?',
                'defineClass': r'smalltalk\s+defineClass:\s+[\'"](.*?)[\'"](?:\s+superclass:\s+[\'"](.*?)[\'"])?(?:\s+instanceVariableNames:\s*[\'"](.*?)[\'"])?(?:\s+package:\s*[\'"](.*?)[\'"])?',
            },
            
            # Cuis patterns
            SmalltalkDialect.CUIS: {
                'subclass': r'^\s*([A-Z][a-zA-Z0-9_]*)\s+subclass:\s+#([A-Z][a-zA-Z0-9_]*)(?:\s+instanceVariableNames:\s*[\'"](.*?)[\'"])?(?:\s+classVariableNames:\s*[\'"](.*?)[\'"])?(?:\s+poolDictionaries:\s*[\'"](.*?)[\'"])?(?:\s+category:\s*[\'"](.*?)[\'"])?',
                'variableSubclass': r'^\s*([A-Z][a-zA-Z0-9_]*)\s+variableSubclass:\s+#([A-Z][a-zA-Z0-9_]*)(?:\s+instanceVariableNames:\s*[\'"](.*?)[\'"])?(?:\s+classVariableNames:\s*[\'"](.*?)[\'"])?(?:\s+poolDictionaries:\s*[\'"](.*?)[\'"])?(?:\s+category:\s*[\'"](.*?)[\'"])?',
                'variableByteSubclass': r'^\s*([A-Z][a-zA-Z0-9_]*)\s+variableByteSubclass:\s+#([A-Z][a-zA-Z0-9_]*)(?:\s+instanceVariableNames:\s*[\'"](.*?)[\'"])?(?:\s+classVariableNames:\s*[\'"](.*?)[\'"])?(?:\s+poolDictionaries:\s*[\'"](.*?)[\'"])?(?:\s+category:\s*[\'"](.*?)[\'"])?',
                'variableWordSubclass': r'^\s*([A-Z][a-zA-Z0-9_]*)\s+variableWordSubclass:\s+#([A-Z][a-zA-Z0-9_]*)(?:\s+instanceVariableNames:\s*[\'"](.*?)[\'"])?(?:\s+classVariableNames:\s*[\'"](.*?)[\'"])?(?:\s+poolDictionaries:\s*[\'"](.*?)[\'"])?(?:\s+category:\s*[\'"](.*?)[\'"])?',
            },
        }
        
        # Compile all patterns
        for dialect, dialect_patterns in patterns.items():
            for pattern_name, pattern in list(dialect_patterns.items()):
                dialect_patterns[pattern_name] = re.compile(pattern, re.MULTILINE)
                
        return patterns
    
    @classmethod
    def _compile_method_patterns(cls) -> Dict[str, Dict[str, Pattern]]:
        """
        Compile regex patterns for method definitions.
        
        Returns:
            Dictionary of dialect-specific pattern dictionaries
        """
        patterns = {
            # Standard patterns that work across dialects
            SmalltalkDialect.STANDARD: {
                # Unary method (no arguments)
                'unary_method': re.compile(r'^\s*([a-zA-Z][a-zA-Z0-9_]*)\s*$', re.MULTILINE),
                
                # Keyword method (with colons)
                'keyword_method': re.compile(r'^\s*([a-zA-Z][a-zA-Z0-9_]*(?::\s*[a-zA-Z][a-zA-Z0-9_]*\s*)+)', re.MULTILINE),
                
                # Binary method (symbols)
                'binary_method': re.compile(r'^\s*([-+*/~<>=@,%|&?!]+)\s+([a-zA-Z][a-zA-Z0-9_]*)', re.MULTILINE),
                
                # Class method detection pattern - in standard smalltalk, usually from file structure
                'class_method': re.compile(r'^\s*([a-zA-Z][a-zA-Z0-9_]*(?::\s*[a-zA-Z][a-zA-Z0-9_]*\s*)*)\s*(?:$|["|\[])', re.MULTILINE),
            },
            
            # VisualWorks specific patterns
            SmalltalkDialect.VISUALWORKS: {
                # Methods in chunk format
                'chunk_method': re.compile(r'^(!.*?methodsFor:.*?!)\s*([a-zA-Z][a-zA-Z0-9_]*(?::\s*[a-zA-Z][a-zA-Z0-9_]*\s*)*)', re.MULTILINE),
                
                # Class-side methods in chunk format
                'chunk_class_method': re.compile(r'^(!.*?class\s+methodsFor:.*?!)\s*([a-zA-Z][a-zA-Z0-9_]*(?::\s*[a-zA-Z][a-zA-Z0-9_]*\s*)*)', re.MULTILINE),
                
                # Standard method patterns
                'unary_method': re.compile(r'^\s*([a-zA-Z][a-zA-Z0-9_]*)\s*$', re.MULTILINE),
                'keyword_method': re.compile(r'^\s*([a-zA-Z][a-zA-Z0-9_]*(?::\s*[a-zA-Z][a-zA-Z0-9_]*\s*)+)', re.MULTILINE),
                'binary_method': re.compile(r'^\s*([-+*/~<>=@,%|&?!]+)\s+([a-zA-Z][a-zA-Z0-9_]*)', re.MULTILINE),
            },
            
            # Pharo specific patterns
            SmalltalkDialect.PHARO: {
                # Methods with pragmas
                'pragma_method': re.compile(r'^\s*([a-zA-Z][a-zA-Z0-9_]*(?::\s*[a-zA-Z][a-zA-Z0-9_]*\s*)*)\s*<\w+', re.MULTILINE),
                
                # Standard method patterns
                'unary_method': re.compile(r'^\s*([a-zA-Z][a-zA-Z0-9_]*)\s*$', re.MULTILINE),
                'keyword_method': re.compile(r'^\s*([a-zA-Z][a-zA-Z0-9_]*(?::\s*[a-zA-Z][a-zA-Z0-9_]*\s*)+)', re.MULTILINE),
                'binary_method': re.compile(r'^\s*([-+*/~<>=@,%|&?!]+)\s+([a-zA-Z][a-zA-Z0-9_]*)', re.MULTILINE),
            },
            
            # Squeak specific patterns
            SmalltalkDialect.SQUEAK: {
                # Methods with formatting hints
                'formatted_method': re.compile(r'^\s*([a-zA-Z][a-zA-Z0-9_]*(?::\s*[a-zA-Z][a-zA-Z0-9_]*\s*)*)\s*"(?:stamp:|primitive:)', re.MULTILINE),
                
                # Standard method patterns
                'unary_method': re.compile(r'^\s*([a-zA-Z][a-zA-Z0-9_]*)\s*$', re.MULTILINE),
                'keyword_method': re.compile(r'^\s*([a-zA-Z][a-zA-Z0-9_]*(?::\s*[a-zA-Z][a-zA-Z0-9_]*\s*)+)', re.MULTILINE),
                'binary_method': re.compile(r'^\s*([-+*/~<>=@,%|&?!]+)\s+([a-zA-Z][a-zA-Z0-9_]*)', re.MULTILINE),
            },
            
            # GemStone specific patterns
            SmalltalkDialect.GEMSTONE: {
                # Methods with GemStone environment info
                'gemstone_method': re.compile(r'^\s*([a-zA-Z][a-zA-Z0-9_]*(?::\s*[a-zA-Z][a-zA-Z0-9_]*\s*)*)\s*\%', re.MULTILINE),
                
                # Standard method patterns
                'unary_method': re.compile(r'^\s*([a-zA-Z][a-zA-Z0-9_]*)\s*$', re.MULTILINE),
                'keyword_method': re.compile(r'^\s*([a-zA-Z][a-zA-Z0-9_]*(?::\s*[a-zA-Z][a-zA-Z0-9_]*\s*)+)', re.MULTILINE),
                'binary_method': re.compile(r'^\s*([-+*/~<>=@,%|&?!]+)\s+([a-zA-Z][a-zA-Z0-9_]*)', re.MULTILINE),
            },
            
            # Dolphin specific patterns
            SmalltalkDialect.DOLPHIN: {
                # Method with Dolphin's metadata
                'dolphin_method': re.compile(r'^\s*([a-zA-Z][a-zA-Z0-9_]*(?::\s*[a-zA-Z][a-zA-Z0-9_]*\s*)*)\s*\[\s*<\w+', re.MULTILINE),
                
                # Standard method patterns
                'unary_method': re.compile(r'^\s*([a-zA-Z][a-zA-Z0-9_]*)\s*$', re.MULTILINE),
                'keyword_method': re.compile(r'^\s*([a-zA-Z][a-zA-Z0-9_]*(?::\s*[a-zA-Z][a-zA-Z0-9_]*\s*)+)', re.MULTILINE),
                'binary_method': re.compile(r'^\s*([-+*/~<>=@,%|&?!]+)\s+([a-zA-Z][a-zA-Z0-9_]*)', re.MULTILINE),
            },
            
            # GNU Smalltalk specific patterns
            SmalltalkDialect.GNU: {
                # GNU's primitive method format
                'primitive_method': re.compile(r'^\s*([a-zA-Z][a-zA-Z0-9_]*(?::\s*[a-zA-Z][a-zA-Z0-9_]*\s*)*)\s*<primitive:', re.MULTILINE),
                
                # Standard method patterns
                'unary_method': re.compile(r'^\s*([a-zA-Z][a-zA-Z0-9_]*)\s*$', re.MULTILINE),
                'keyword_method': re.compile(r'^\s*([a-zA-Z][a-zA-Z0-9_]*(?::\s*[a-zA-Z][a-zA-Z0-9_]*\s*)+)', re.MULTILINE),
                'binary_method': re.compile(r'^\s*([-+*/~<>=@,%|&?!]+)\s+([a-zA-Z][a-zA-Z0-9_]*)', re.MULTILINE),
            },
            
            # Amber (JavaScript) Smalltalk specific patterns
            SmalltalkDialect.AMBER: {
                # Amber method with JS syntax
                'amber_method': re.compile(r'^\s*([a-zA-Z][a-zA-Z0-9_]*(?::\s*[a-zA-Z][a-zA-Z0-9_]*\s*)*)\s*\{\s*return\s+', re.MULTILINE),
                
                # Standard method patterns
                'unary_method': re.compile(r'^\s*([a-zA-Z][a-zA-Z0-9_]*)\s*$', re.MULTILINE),
                'keyword_method': re.compile(r'^\s*([a-zA-Z][a-zA-Z0-9_]*(?::\s*[a-zA-Z][a-zA-Z0-9_]*\s*)+)', re.MULTILINE),
                'binary_method': re.compile(r'^\s*([-+*/~<>=@,%|&?!]+)\s+([a-zA-Z][a-zA-Z0-9_]*)', re.MULTILINE),
            },
            
            # Cuis specific patterns
            SmalltalkDialect.CUIS: {
                # Cuis file-in format
                'cuis_method': re.compile(r'^\s*!([a-zA-Z][a-zA-Z0-9_]*)\s+methodsFor:\s*[\'"].*?[\'"]\s*!\s*([a-zA-Z][a-zA-Z0-9_]*(?::\s*[a-zA-Z][a-zA-Z0-9_]*\s*)*)', re.MULTILINE),
                
                # Standard method patterns
                'unary_method': re.compile(r'^\s*([a-zA-Z][a-zA-Z0-9_]*)\s*$', re.MULTILINE),
                'keyword_method': re.compile(r'^\s*([a-zA-Z][a-zA-Z0-9_]*(?::\s*[a-zA-Z][a-zA-Z0-9_]*\s*)+)', re.MULTILINE),
                'binary_method': re.compile(r'^\s*([-+*/~<>=@,%|&?!]+)\s+([a-zA-Z][a-zA-Z0-9_]*)', re.MULTILINE),
            },
        }
        
        return patterns
    
    @lru_cache(maxsize=1)
    def _get_chunking_strategy(self) -> ChunkingStrategy:
        """
        Get the chunking strategy this implementation represents.
        
        Returns:
            ChunkingStrategy enum value
        """
        return ChunkingStrategy.STRUCTURAL