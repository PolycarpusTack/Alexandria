"""
Unit tests for Smalltalk chunking strategy
"""

import unittest
import re
from typing import List, Dict, Any

from enterprise_chunker import EnterpriseChunker, ChunkingStrategy
from enterprise_chunker.strategies.formats.smalltalk_chunker import SmalltalkChunkingStrategy, SmalltalkDialect


class TestSmalltalkChunking(unittest.TestCase):
    """Test cases for Smalltalk chunking strategy"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.chunker = EnterpriseChunker()
        self.smalltalk_strategy = SmalltalkChunkingStrategy()
    
    def test_dialect_detection(self):
        """Test detection of different Smalltalk dialects"""
        # Test VisualWorks detection
        visualworks_code = """
        !classDefinition: #MyClass category: 'MyApp-Core' superclass: #Object!
        Object subclass: #MyClass
            instanceVariableNames: 'var1 var2'
            classVariableNames: 'ClassVar1'
            poolDictionaries: ''
            category: 'MyApp-Core'!
            
        !MyClass methodsFor: 'accessing'!
        var1
            ^ var1!
            
        var1: aValue
            var1 := aValue!
            
        !MyClass methodsFor: 'initialization'!
        initialize
            "Initialize the receiver"
            super initialize.
            var1 := nil.
            var2 := 'test'!
        """
        
        detected_dialect = self.smalltalk_strategy._detect_smalltalk_dialect(visualworks_code)
        self.assertEqual(detected_dialect, SmalltalkDialect.VISUALWORKS)
        
        # Test Pharo detection
        pharo_code = """
        Object subclass: #MyClass
            instanceVariableNames: 'var1 var2'
            classVariableNames: 'ClassVar1'
            package: 'MyApp-Core'
            
        MyClass >> var1
            <getter>
            ^ var1
            
        MyClass >> var1: aValue
            <setter>
            var1 := aValue
            
        MyClass class >> initialize
            "Initialize the class"
            Smalltalk globals at: #MyGlobal put: self new.
            SystemAnnouncer uniqueInstance announce: ClassInitialized
        """
        
        detected_dialect = self.smalltalk_strategy._detect_smalltalk_dialect(pharo_code)
        self.assertEqual(detected_dialect, SmalltalkDialect.PHARO)
        
        # Test Squeak detection
        squeak_code = """
        Object subclass: #MyClass
            instanceVariableNames: 'var1 var2'
            classVariableNames: 'ClassVar1'
            poolDictionaries: ''
            category: 'MyApp-Core'
            
        !MyClass methodsFor: 'accessing' stamp: 'jdoe 5/1/2023 10:00'!
        var1
            "Return the value of var1"
            ^ var1
        !
            
        !MyClass methodsFor: 'accessing' stamp: 'jdoe 5/1/2023 10:01'!
        var1: aValue
            "Set the value of var1"
            var1 := aValue.
            self changed: #var1
        !
            
        Morph subclass: #MyMorph
            instanceVariableNames: 'position extent'
            classVariableNames: ''
            poolDictionaries: ''
            category: 'MyApp-UI'
        """
        
        detected_dialect = self.smalltalk_strategy._detect_smalltalk_dialect(squeak_code)
        self.assertEqual(detected_dialect, SmalltalkDialect.SQUEAK)
        
        # Test GemStone detection
        gemstone_code = """
        Object subclass: 'MyClass'
            instVarNames: #(var1 var2)
            classVars: #(ClassVar1)
            classInstVars: #()
            poolDictionaries: #()
            inDictionary: UserGlobals
            constraints: #()
            classConstraints: #()
            
        category: 'accessing'
        method: MyClass
        var1
            ^ var1
        %
            
        category: 'accessing'
        method: MyClass
        var1: aValue
            var1 := aValue
        %
            
        commitTransaction
        """
        
        detected_dialect = self.smalltalk_strategy._detect_smalltalk_dialect(gemstone_code)
        self.assertEqual(detected_dialect, SmalltalkDialect.GEMSTONE)
        
        # Test Dolphin detection
        dolphin_code = """
        Object subclass: #MyClass
            instanceVariableNames: 'var1 var2'
            classVariableNames: 'ClassVar1'
            poolDictionaries: ''
            
        !MyClass methodsFor: 'accessing'!
        var1
            "Return the value of var1"
            ^var1!
            
        var1: aValue
            "Set the value of var1"
            var1 := aValue!
            
        !MyClass class methodsFor: 'class initialization'!
        initialize
            "Initialize the class"
            self register!
            
        package paxVersion: 1;
            basicComment: 'Dolphin Smalltalk package'.
        """
        
        detected_dialect = self.smalltalk_strategy._detect_smalltalk_dialect(dolphin_code)
        self.assertEqual(detected_dialect, SmalltalkDialect.DOLPHIN)
    
    def test_class_definition_detection(self):
        """Test detection of class definitions across dialects"""
        # Standard class definition
        std_class_def = """
        Object subclass: #MyClass
            instanceVariableNames: 'var1 var2'
            classVariableNames: 'ClassVar1'
            poolDictionaries: ''
            category: 'MyApp-Core'
        """
        
        boundaries = []
        self.smalltalk_strategy.dialect = SmalltalkDialect.STANDARD
        self.smalltalk_strategy._detect_class_definitions(std_class_def, boundaries)
        
        self.assertEqual(len(boundaries), 1)
        self.assertEqual(boundaries[0]['type'], 'class_definition')
        self.assertEqual(boundaries[0]['superclass'], 'Object')
        self.assertEqual(boundaries[0]['subclass'], 'MyClass')
        
        # Pharo class definition with traits
        pharo_class_def = """
        Object subclass: #MyClass
            uses: MyTrait
            instanceVariableNames: 'var1 var2'
            classVariableNames: 'ClassVar1'
            package: 'MyApp-Core'
        """
        
        boundaries = []
        self.smalltalk_strategy.dialect = SmalltalkDialect.PHARO
        self.smalltalk_strategy._detect_class_definitions(pharo_class_def, boundaries)
        
        self.assertEqual(len(boundaries), 1)
        self.assertEqual(boundaries[0]['type'], 'class_definition')
        self.assertEqual(boundaries[0]['superclass'], 'Object')
        self.assertEqual(boundaries[0]['subclass'], 'MyClass')
        
        # VisualWorks class definition
        vw_class_def = """
        !classDefinition: #MyClass category: 'MyApp-Core' superclass: #Object!
        Object subclass: #MyClass
            instanceVariableNames: 'var1 var2'
            classVariableNames: 'ClassVar1'
            poolDictionaries: ''
            category: 'MyApp-Core'!
        """
        
        boundaries = []
        self.smalltalk_strategy.dialect = SmalltalkDialect.VISUALWORKS
        self.smalltalk_strategy._detect_class_definitions(vw_class_def, boundaries)
        
        # Should detect both the class definition statement and the class definition chunk
        self.assertGreaterEqual(len(boundaries), 1)
        self.assertTrue(any(b['type'] == 'class_definition' for b in boundaries))
        self.assertTrue(any(b['subclass'] == 'MyClass' for b in boundaries))
    
    def test_method_detection(self):
        """Test detection of method definitions in different formats"""
        # Test unary method
        unary_method = """
        initialize
            "Initialize the receiver"
            super initialize.
            var1 := nil.
            var2 := 'test'
        """
        
        boundaries = []
        self.smalltalk_strategy._detect_method_definitions(unary_method, boundaries)
        
        self.assertEqual(len(boundaries), 1)
        self.assertEqual(boundaries[0]['type'], 'method_definition')
        self.assertEqual(boundaries[0]['method_name'], 'initialize')
        self.assertTrue(boundaries[0]['is_unary_method'])
        
        # Test keyword method
        keyword_method = """
        var1: aValue with: anotherValue
            "Set the values"
            var1 := aValue.
            var2 := anotherValue.
        """
        
        boundaries = []
        self.smalltalk_strategy._detect_method_definitions(keyword_method, boundaries)
        
        self.assertEqual(len(boundaries), 1)
        self.assertEqual(boundaries[0]['type'], 'method_definition')
        self.assertEqual(boundaries[0]['method_name'], 'var1: aValue with: anotherValue')
        self.assertTrue(boundaries[0]['is_keyword_method'])
        
        # Test binary method
        binary_method = """
        + aNumber
            "Add aNumber to the receiver"
            ^ self value + aNumber
        """
        
        boundaries = []
        self.smalltalk_strategy._detect_method_definitions(binary_method, boundaries)
        
        self.assertEqual(len(boundaries), 1)
        self.assertEqual(boundaries[0]['type'], 'method_definition')
        self.assertTrue(boundaries[0]['is_binary_method'])
    
    def test_block_detection(self):
        """Test detection of block structures"""
        # Test block with arguments
        block_code = """
        collect: aBlock
            "Evaluate aBlock with each of my elements as the argument."
            | newCollection |
            newCollection := self species new: self size.
            self do: [:each | newCollection add: (aBlock value: each)].
            ^ newCollection
        """
        
        boundaries = []
        self.smalltalk_strategy._detect_block_structures(block_code, boundaries)
        
        # Should find at least the block with arguments [:each |
        self.assertGreaterEqual(len(boundaries), 1)
        self.assertTrue(any(b['type'] == 'block_with_args' for b in boundaries))
        
        # Test method return
        return_code = """
        value
            ^ self calculateValue
        """
        
        boundaries = []
        self.smalltalk_strategy._detect_block_structures(return_code, boundaries)
        
        self.assertEqual(len(boundaries), 1)
        self.assertEqual(boundaries[0]['type'], 'method_return')
        
        # Test block with temp variables
        temp_vars_code = """
        calculate
            | temp1 temp2 |
            temp1 := 10.
            temp2 := 20.
            ^ temp1 + temp2
        """
        
        boundaries = []
        self.smalltalk_strategy._detect_block_structures(temp_vars_code, boundaries)
        
        self.assertGreaterEqual(len(boundaries), 1)
        self.assertTrue(any(b['type'] == 'temp_vars' for b in boundaries))
    
    def test_pragma_detection(self):
        """Test detection of method pragmas"""
        # Pharo-style pragma
        pharo_pragma = """
        doSomething
            <primitive: 60>
            <important>
            self doSomethingElse
        """
        
        boundaries = []
        self.smalltalk_strategy.dialect = SmalltalkDialect.PHARO
        self.smalltalk_strategy._detect_pragmas(pharo_pragma, boundaries)
        
        self.assertEqual(len(boundaries), 2)
        self.assertTrue(all(b['is_pragma'] for b in boundaries))
        self.assertTrue(any(b['pragma_name'] == 'primitive' for b in boundaries))
        self.assertTrue(any(b['pragma_name'] == 'important' for b in boundaries))
        
        # Dolphin-style pragma
        dolphin_pragma = """
        doSomething
            [<primitive: 60>]
            self doSomethingElse
        """
        
        boundaries = []
        self.smalltalk_strategy.dialect = SmalltalkDialect.DOLPHIN
        self.smalltalk_strategy._detect_pragmas(dolphin_pragma, boundaries)
        
        self.assertEqual(len(boundaries), 1)
        self.assertTrue(boundaries[0]['is_pragma'])
        self.assertEqual(boundaries[0]['pragma_name'], 'primitive')
    
    def test_trait_detection(self):
        """Test detection of trait compositions in Pharo"""
        pharo_trait = """
        Object subclass: #MyClass
            uses: TComparable
            instanceVariableNames: 'var1 var2'
            classVariableNames: ''
            package: 'MyApp-Core'
            
        Object subclass: #AnotherClass
            uses: TComparable + TEnumerable - {#collect:. #select:} @ {#at:->#fetch:}
            instanceVariableNames: 'var1 var2'
            classVariableNames: ''
            package: 'MyApp-Core'
        """
        
        boundaries = []
        self.smalltalk_strategy.dialect = SmalltalkDialect.PHARO
        self.smalltalk_strategy._detect_trait_compositions(pharo_trait, boundaries)
        
        self.assertGreaterEqual(len(boundaries), 1)
        self.assertTrue(any(b['type'] == 'trait_composition' for b in boundaries))
    
    def test_full_chunking(self):
        """Test full chunking process with a realistic Smalltalk file"""
        # Create a sample Smalltalk file with multiple classes and methods
        smalltalk_file = """
        "This is a sample Smalltalk file with multiple classes and methods"
        
        Object subclass: #Person
            instanceVariableNames: 'name age'
            classVariableNames: ''
            poolDictionaries: ''
            category: 'Examples'!
            
        !Person methodsFor: 'accessing'!
        name
            "Return the name"
            ^ name!
            
        name: aString
            "Set the name"
            name := aString!
            
        age
            "Return the age"
            ^ age!
            
        age: anInteger
            "Set the age"
            age := anInteger!
            
        !Person methodsFor: 'printing'!
        printOn: aStream
            "Print a representation of the receiver on aStream"
            super printOn: aStream.
            aStream 
                nextPutAll: ' named ';
                print: name;
                nextPutAll: ' aged ';
                print: age!
                
        !Person methodsFor: 'initialization'!
        initialize
            "Initialize a new instance of the receiver"
            super initialize.
            name := ''.
            age := 0!
            
        !Person class methodsFor: 'instance creation'!
        named: aString
            "Create a new instance with the given name"
            ^ self new
                name: aString;
                yourself!
                
        named: aString aged: anInteger
            "Create a new instance with the given name and age"
            ^ self new
                name: aString;
                age: anInteger;
                yourself!
        """
        
        # Perform chunking
        chunks = self.chunker.adaptive_chunk_text(
            smalltalk_file,
            max_tokens_per_chunk=100,  # Small to force chunking
            strategy=ChunkingStrategy.STRUCTURAL
        )
        
        # Check that we got multiple chunks
        self.assertGreater(len(chunks), 1)
        
        # Check that chunks contain context information
        context_markers = 0
        for chunk in chunks[1:]:  # Skip first chunk
            if '"Smalltalk dialect:' in chunk:
                context_markers += 1
                
        # At least some chunks should have context information
        self.assertGreater(context_markers, 0)
        
        # Check that no method is split in the middle
        incomplete_methods = 0
        for i, chunk in enumerate(chunks):
            # Look for method starts without ends
            method_starts = len(re.findall(r'^\s*\w+(?::\s*\w+\s*)*\s*, chunk, re.MULTILINE))
            method_ends = len(re.findall(r'\^\s*\w+.*?[!\n]', chunk, re.MULTILINE))
            
            if method_starts > method_ends and i < len(chunks) - 1:
                # Check if the next chunk has the ending
                if not re.search(r'^\s*\^', chunks[i+1], re.MULTILINE):
                    incomplete_methods += 1
        
        # There should be no incomplete methods
        self.assertEqual(incomplete_methods, 0, "Found methods split across chunks")
    
    def test_create_context_tracker(self):
        """Test creating and updating context tracker"""
        # Create context tracker
        context = self.smalltalk_strategy._create_context_tracker()
        
        # Check initial state
        self.assertIsNone(context['current_class'])
        self.assertIsNone(context['current_superclass'])
        self.assertEqual(context['instance_vars'], [])
        
        # Update with class definition
        class_boundary = {
            'type': 'class_definition',
            'subclass': 'TestClass',
            'superclass': 'Object',
            'instance_vars': ['var1', 'var2'],
            'class_vars': ['ClassVar'],
            'category': 'Testing'
        }
        
        self.smalltalk_strategy._update_context_tracker(context, class_boundary)
        
        # Check updated state
        self.assertEqual(context['current_class'], 'TestClass')
        self.assertEqual(context['current_superclass'], 'Object')
        self.assertEqual(context['instance_vars'], ['var1', 'var2'])
        self.assertEqual(context['current_category'], 'Testing')
        
        # Update with method definition
        method_boundary = {
            'type': 'method_definition',
            'method_name': 'testMethod',
            'is_class_method': True
        }
        
        self.smalltalk_strategy._update_context_tracker(context, method_boundary)
        
        # Check updated state
        self.assertEqual(context['current_method'], 'testMethod')
        self.assertTrue(context['is_class_side'])
        
        # Get preserved context
        preserved_context = self.smalltalk_strategy._get_preserved_context(context)
        
        # Verify content
        self.assertIn('TestClass', preserved_context)
        self.assertIn('Object', preserved_context)
        self.assertIn('var1', preserved_context)
        self.assertIn('Class side', preserved_context)
    
    def test_file_in_format_detection(self):
        """Test detection of file-in format"""
        # VisualWorks file-in format
        vw_file_in = """
        "This is a VisualWorks file-in"
        !classDefinition: #Person category: 'Examples' superclass: #Object!
        Object subclass: #Person
            instanceVariableNames: 'name age'
            classVariableNames: ''
            poolDictionaries: ''
            category: 'Examples'!
            
        !Person methodsFor: 'accessing'!
        name
            ^ name!
        """
        
        is_file_in = self.smalltalk_strategy._is_file_in_format(vw_file_in)
        self.assertTrue(is_file_in)
        
        # Non file-in format
        regular_code = """
        Object subclass: #Person
            instanceVariableNames: 'name age'
            classVariableNames: ''
            package: 'Examples'.
            
        Person >> name [
            ^ name
        ]
        """
        
        is_file_in = self.smalltalk_strategy._is_file_in_format(regular_code)
        self.assertFalse(is_file_in)
    
    def test_context_preservation(self):
        """Test context preservation between chunks"""
        # Create a sample Smalltalk file
        smalltalk_code = """
        Object subclass: #TestClass
            instanceVariableNames: 'var1 var2 var3'
            classVariableNames: 'ClassVar1'
            poolDictionaries: ''
            category: 'Test-Category'!
            
        !TestClass methodsFor: 'accessing'!
        var1
            "Return var1"
            ^ var1!
            
        var1: aValue
            "Set var1"
            var1 := aValue!
            
        !TestClass methodsFor: 'operations'!
        operation1
            "First operation"
            | temp |
            temp := self var1.
            temp doSomething.
            ^ temp!
            
        operation2
            "Second operation"
            | temp |
            temp := self var1.
            temp doSomethingElse.
            ^ temp!
        """
        
        # Force small chunk size to ensure multiple chunks
        chunks = self.chunker.adaptive_chunk_text(
            smalltalk_code,
            max_tokens_per_chunk=50,  # Very small to force multiple chunks
            strategy=ChunkingStrategy.STRUCTURAL
        )
        
        # Verify we got multiple chunks
        self.assertGreater(len(chunks), 2)
        
        # Count chunks with context preservation
        context_chunks = 0
        for chunk in chunks[1:]:  # Skip first chunk
            if 'Smalltalk dialect:' in chunk or 'Current method:' in chunk:
                context_chunks += 1
        
        # Most chunks after the first should have context
        self.assertGreater(context_chunks, len(chunks) * 0.5)
