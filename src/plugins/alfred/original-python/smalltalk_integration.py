"""
ALFRED-ST: Smalltalk Integration Module
Provides VisualWorks Smalltalk support for ALFRED
"""

import os
import re
import subprocess
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, field
import json
from datetime import datetime

@dataclass
class SmalltalkClass:
    """Represents a Smalltalk class"""
    name: str
    superclass: str
    instance_vars: List[str] = field(default_factory=list)
    class_vars: List[str] = field(default_factory=list)
    category: str = "Unclassified"
    methods: Dict[str, List[str]] = field(default_factory=dict)  # protocol -> method names
    
@dataclass
class SmalltalkMethod:
    """Represents a Smalltalk method"""
    selector: str
    protocol: str
    source: str
    class_name: str
    is_class_method: bool = False

class SmalltalkParser:
    """Parse Smalltalk code and fileout formats"""
    
    # Patterns for parsing Smalltalk
    CLASS_PATTERN = re.compile(
        r'(\w+)\s+subclass:\s*#(\w+)\s*'
        r'instanceVariableNames:\s*[\'"]([^\'"]*)[\'"]\s*'
        r'classVariableNames:\s*[\'"]([^\'"]*)[\'"]\s*'
        r'poolDictionaries:\s*[\'"]([^\'"]*)[\'"]\s*'
        r'category:\s*[\'"]([^\'"]*)[\'"]'
    )
    
    METHOD_PATTERN = re.compile(
        r'^(\w+[:\w\s]*)\s*\n\s*"([^"]*)"\s*\n(.*?)(?=^[\w:]|\Z)',
        re.MULTILINE | re.DOTALL
    )
    
    FILEOUT_CLASS_PATTERN = re.compile(r'!(\w+) class methodsFor: \'([^\']+)\'!')
    FILEOUT_INSTANCE_PATTERN = re.compile(r'!(\w+) methodsFor: \'([^\']+)\'!')
    
    def parse_class_definition(self, source: str) -> Optional[SmalltalkClass]:
        """Parse a class definition"""
        match = self.CLASS_PATTERN.search(source)
        if match:
            superclass = match.group(1)
            name = match.group(2)
            inst_vars = [v.strip() for v in match.group(3).split() if v.strip()]
            class_vars = [v.strip() for v in match.group(4).split() if v.strip()]
            category = match.group(6)
            
            return SmalltalkClass(
                name=name,
                superclass=superclass,
                instance_vars=inst_vars,
                class_vars=class_vars,
                category=category
            )
        return None
    
    def parse_method(self, source: str, class_name: str, 
                    protocol: str = "uncategorized") -> Optional[SmalltalkMethod]:
        """Parse a method definition"""
        lines = source.strip().split('\n')
        if not lines:
            return None
            
        # Extract selector from first line
        selector_line = lines[0].strip()
        # Remove any trailing whitespace or special chars
        selector = selector_line.rstrip()
        
        return SmalltalkMethod(
            selector=selector,
            protocol=protocol,
            source=source,
            class_name=class_name
        )
    
    def parse_fileout(self, content: str) -> Dict[str, Any]:
        """Parse a fileout format file"""
        result = {
            'classes': {},
            'methods': []
        }
        
        # Split by method chunks
        chunks = content.split('\n!\n')
        
        current_class = None
        current_protocol = None
        is_class_method = False
        
        for chunk in chunks:
            # Check for class method header
            class_match = self.FILEOUT_CLASS_PATTERN.search(chunk)
            if class_match:
                current_class = class_match.group(1)
                current_protocol = class_match.group(2)
                is_class_method = True
                continue
                
            # Check for instance method header
            inst_match = self.FILEOUT_INSTANCE_PATTERN.search(chunk)
            if inst_match:
                current_class = inst_match.group(1)
                current_protocol = inst_match.group(2)
                is_class_method = False
                continue
            
            # If we have a current class, this chunk is a method
            if current_class and chunk.strip() and not chunk.startswith('!'):
                method = self.parse_method(
                    chunk.strip(), 
                    current_class, 
                    current_protocol
                )
                if method:
                    method.is_class_method = is_class_method
                    result['methods'].append(method)
        
        return result

class VisualWorksConnector:
    """Connect to and control VisualWorks Smalltalk"""
    
    def __init__(self, vw_home: Optional[str] = None):
        self.vw_home = vw_home or os.environ.get('VISUALWORKS_HOME')
        self.image_path = None
        self.headless_port = 4777  # Default port for headless communication
        
    def find_visualworks(self) -> Optional[str]:
        """Locate VisualWorks installation"""
        common_paths = [
            "C:/Program Files/Cincom/VisualWorks",
            "C:/Cincom/VisualWorks",
            "/opt/cincom/visualworks",
            "/usr/local/visualworks",
            os.path.expanduser("~/VisualWorks")
        ]
        
        for path in common_paths:
            if os.path.exists(path):
                return path
                
        return None
    
    def create_image(self, name: str, base_image: str = "visual.im") -> Tuple[bool, str]:
        """Create a new Smalltalk image"""
        if not self.vw_home:
            return False, "VisualWorks home not found"
            
        try:
            base_path = Path(self.vw_home) / "image" / base_image
            new_path = Path(name).with_suffix('.im')
            
            # Copy image and changes files
            import shutil
            shutil.copy2(base_path, new_path)
            
            changes_base = base_path.with_suffix('.cha')
            if changes_base.exists():
                shutil.copy2(changes_base, new_path.with_suffix('.cha'))
                
            return True, f"Created image: {new_path}"
            
        except Exception as e:
            return False, f"Error creating image: {str(e)}"
    
    def execute_code(self, code: str, image: str) -> Tuple[bool, str]:
        """Execute Smalltalk code in image (headless)"""
        if not self.vw_home:
            return False, "VisualWorks home not found"
            
        try:
            # Create a temporary file with the code
            import tempfile
            with tempfile.NamedTemporaryFile(mode='w', suffix='.st', delete=False) as f:
                f.write(code)
                temp_file = f.name
            
            # Execute using VisualWorks
            vw_exe = Path(self.vw_home) / "bin" / "visual"
            cmd = [
                str(vw_exe),
                image,
                "-headless",
                "-filein",
                temp_file
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            
            # Clean up
            os.unlink(temp_file)
            
            if result.returncode == 0:
                return True, result.stdout
            else:
                return False, f"Error: {result.stderr}"
                
        except Exception as e:
            return False, f"Execution error: {str(e)}"

class SmalltalkCodeGenerator:
    """Generate Smalltalk code with best practices"""
    
    @staticmethod
    def generate_class(name: str, superclass: str = "Object",
                      inst_vars: List[str] = None,
                      class_vars: List[str] = None,
                      category: str = "MyApp-Model") -> str:
        """Generate a class definition"""
        inst_vars = inst_vars or []
        class_vars = class_vars or []
        
        return f"""{superclass} subclass: #{name}
    instanceVariableNames: '{' '.join(inst_vars)}'
    classVariableNames: '{' '.join(class_vars)}'
    poolDictionaries: ''
    category: '{category}'"""
    
    @staticmethod
    def generate_getter(var_name: str) -> str:
        """Generate a getter method"""
        return f"""{var_name}
    "Answer the value of {var_name}"
    ^{var_name}"""
    
    @staticmethod
    def generate_setter(var_name: str) -> str:
        """Generate a setter method"""
        return f"""{var_name}: anObject
    "Set the value of {var_name}"
    {var_name} := anObject"""
    
    @staticmethod
    def generate_initialize_method(inst_vars: List[str]) -> str:
        """Generate initialize method"""
        initializations = []
        for var in inst_vars:
            if var.endswith('s'):  # Likely a collection
                initializations.append(f"    {var} := OrderedCollection new.")
            else:
                initializations.append(f"    {var} := nil.")
                
        return f"""initialize
    "Initialize a newly created instance"
    super initialize.
{chr(10).join(initializations)}"""
    
    @staticmethod
    def generate_test_class(class_name: str) -> str:
        """Generate a test class"""
        return f"""TestCase subclass: #{class_name}Test
    instanceVariableNames: 'instance'
    classVariableNames: ''
    poolDictionaries: ''
    category: 'MyApp-Tests'"""
    
    @staticmethod
    def generate_test_method(method_name: str, class_name: str) -> str:
        """Generate a test method"""
        return f"""test{method_name.capitalize()}
    "Test the {method_name} method"
    | result |
    instance := {class_name} new.
    result := instance {method_name}.
    self assert: result notNil"""

class SmalltalkProjectAnalyzer:
    """Analyze Smalltalk projects and provide insights"""
    
    def __init__(self, project_path: str):
        self.project_path = Path(project_path)
        self.parser = SmalltalkParser()
        
    def analyze_project(self) -> Dict[str, Any]:
        """Analyze project structure and content"""
        analysis = {
            'type': 'smalltalk',
            'images': [],
            'fileouts': [],
            'parcels': [],
            'packages': [],
            'class_count': 0,
            'method_count': 0
        }
        
        # Find Smalltalk-related files
        for file in self.project_path.rglob('*'):
            if file.suffix == '.im':
                analysis['images'].append(str(file.relative_to(self.project_path)))
            elif file.suffix in ['.st', '.cs']:
                analysis['fileouts'].append(str(file.relative_to(self.project_path)))
                # Parse fileout for stats
                try:
                    content = file.read_text(encoding='utf-8')
                    parsed = self.parser.parse_fileout(content)
                    analysis['method_count'] += len(parsed['methods'])
                except:
                    pass
            elif file.suffix in ['.pcl', '.pst']:
                analysis['parcels'].append(str(file.relative_to(self.project_path)))
                
        return analysis
    
    def suggest_improvements(self) -> List[str]:
        """Suggest project improvements"""
        suggestions = []
        analysis = self.analyze_project()
        
        if not analysis['images']:
            suggestions.append("No Smalltalk image found. Create one with 'New Image' button.")
            
        if not analysis['fileouts'] and analysis['images']:
            suggestions.append("Consider creating fileouts for version control.")
            
        if analysis['method_count'] > 100 and not analysis['parcels']:
            suggestions.append("Large project detected. Consider creating parcels for deployment.")
            
        return suggestions

class SmalltalkAIContext:
    """Provide Smalltalk-specific context for AI"""
    
    SMALLTALK_CONTEXT = """You are assisting with VisualWorks Smalltalk development.

Key Smalltalk conventions to follow:
1. Method names use camelCase (not snake_case)
2. Instance variables start with lowercase
3. Class names start with uppercase
4. Use meaningful selector names that read like English
5. Follow the pattern: receiver selector argument
6. Always include method comments in double quotes
7. Use protocols to organize methods (accessing, testing, private, etc.)
8. Prefer polymorphism over conditionals
9. Keep methods small (typically < 7 lines)
10. Use proper collection iteration methods instead of loops

Common patterns:
- Getters: just return the variable (^variableName)
- Setters: variableName: anObject
- Testing: use methods starting with 'is' (isEmpty, isValid)
- Conversion: use methods starting with 'as' (asString, asArray)
- Factory methods: use class-side methods

Example well-formed Smalltalk code:
```smalltalk
Object subclass: #Customer
    instanceVariableNames: 'name email orders'
    classVariableNames: ''
    poolDictionaries: ''
    category: 'MyApp-Model'

name
    "Answer the customer's name"
    ^name

name: aString
    "Set the customer's name"
    name := aString

addOrder: anOrder
    "Add an order to this customer"
    orders add: anOrder.
    anOrder customer: self
```"""
    
    @staticmethod
    def enhance_prompt(prompt: str, project_type: str = None) -> str:
        """Enhance prompt with Smalltalk context"""
        enhanced = SmalltalkAIContext.SMALLTALK_CONTEXT + "\n\n"
        
        if project_type == 'seaside':
            enhanced += "\nThis is a Seaside web application project. Follow Seaside component patterns.\n"
        elif project_type == 'store':
            enhanced += "\nThis project uses Store for version control. Include proper package definitions.\n"
            
        enhanced += f"\nUser request: {prompt}"
        return enhanced