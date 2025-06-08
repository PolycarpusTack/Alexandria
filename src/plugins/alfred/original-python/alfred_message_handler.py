#!/usr/bin/env python3
"""
Message handling utilities for ALFRED
Refactored message display and code block handling
"""

import tkinter as tk
from tkinter import ttk
from typing import List, Optional, Tuple
import os
from datetime import datetime
from dataclasses import dataclass
from code_extractor import CodeBlock, CodeExtractor
from alfred_constants import CHAT_DISPLAY_FONT, COLORS


class MessageRenderer:
    """Handles rendering of chat messages with code blocks"""
    
    def __init__(self, chat_display: tk.Text, code_extractor: CodeExtractor):
        self.chat_display = chat_display
        self.code_extractor = code_extractor
        self.code_blocks = []  # Track code blocks and their frames
    
    def append_message(self, message: 'ChatMessage'):
        """Append a message to the chat display"""
        # Add message header
        self._add_message_header(message)
        
        # Process message content based on role
        if message.role == "assistant":
            self._render_assistant_message(message)
        else:
            self._render_user_message(message)
        
        # Add spacing and scroll to bottom
        self._finalize_message()
    
    def _add_message_header(self, message: 'ChatMessage'):
        """Add message header with role and timestamp"""
        # Format timestamp
        timestamp = message.timestamp.strftime("%H:%M:%S")
        header = f"\n[{timestamp}] {message.role.upper()}: "
        
        # Insert with appropriate tag
        self.chat_display.insert('end', header, message.role)
    
    def _render_assistant_message(self, message: 'ChatMessage'):
        """Render assistant message with code block detection"""
        # Extract code blocks
        code_blocks = self.code_extractor.extract_code_blocks(message.content)
        
        if not code_blocks:
            # No code blocks, render as plain text
            self.chat_display.insert('end', message.content)
            return
        
        # Process content with code blocks
        self._render_content_with_code_blocks(message.content, code_blocks)
    
    def _render_user_message(self, message: 'ChatMessage'):
        """Render user message as plain text"""
        self.chat_display.insert('end', message.content)
    
    def _render_content_with_code_blocks(self, content: str, code_blocks: List[CodeBlock]):
        """Render content that contains code blocks"""
        last_pos = 0
        
        # Find all code block matches
        for match in self.code_extractor.CODE_BLOCK_PATTERN.finditer(content):
            # Insert text before code block
            before_text = content[last_pos:match.start()]
            if before_text.strip():
                self.chat_display.insert('end', before_text.strip() + '\n')
            
            # Get the code block details
            language = match.group(1) or 'text'
            code_content = match.group(2).strip()
            
            # Find corresponding CodeBlock object
            code_block = self._find_code_block(code_content, code_blocks)
            
            if code_block:
                # Insert code block widget
                self._insert_code_block_widget(code_block)
            else:
                # Fallback: insert as formatted text
                self._insert_code_as_text(language, code_content)
            
            last_pos = match.end()
        
        # Insert remaining text
        remaining = content[last_pos:].strip()
        if remaining:
            self.chat_display.insert('end', '\n' + remaining)
    
    def _find_code_block(self, content: str, code_blocks: List[CodeBlock]) -> Optional[CodeBlock]:
        """Find matching CodeBlock object"""
        for cb in code_blocks:
            if cb.content.strip() == content:
                return cb
        return None
    
    def _insert_code_block_widget(self, code_block: CodeBlock):
        """Insert an interactive code block widget"""
        # Create frame for code block
        frame = ttk.Frame(self.chat_display, relief='solid', borderwidth=1)
        
        # Header with language and buttons
        header = ttk.Frame(frame)
        header.pack(fill='x', padx=2, pady=2)
        
        # Language label
        lang_label = ttk.Label(
            header,
            text=f"📄 {code_block.language}",
            font=('Consolas', 9, 'bold')
        )
        lang_label.pack(side='left', padx=5)
        
        # Suggested filename
        if code_block.metadata.get('suggested_filename'):
            filename_label = ttk.Label(
                header,
                text=code_block.metadata['suggested_filename'],
                font=('Consolas', 9),
                foreground='#666'
            )
            filename_label.pack(side='left', padx=5)
        
        # Action buttons
        button_frame = ttk.Frame(header)
        button_frame.pack(side='right', padx=5)
        
        # Copy button
        copy_btn = ttk.Button(
            button_frame,
            text="📋 Copy",
            command=lambda: self._copy_code(code_block.content),
            width=8
        )
        copy_btn.pack(side='left', padx=2)
        
        # Save button
        save_btn = ttk.Button(
            button_frame,
            text="💾 Save",
            command=lambda: self._save_code(code_block),
            width=8
        )
        save_btn.pack(side='left', padx=2)
        
        # Code content
        code_text = tk.Text(
            frame,
            height=min(code_block.content.count('\n') + 1, 20),
            font=('Consolas', 9),
            wrap='none',
            background='#f8f8f8'
        )
        code_text.pack(fill='both', expand=True, padx=5, pady=(0, 5))
        
        # Add horizontal scrollbar if needed
        if any(len(line) > 80 for line in code_block.content.split('\n')):
            h_scroll = ttk.Scrollbar(frame, orient='horizontal', command=code_text.xview)
            h_scroll.pack(fill='x', padx=5, pady=(0, 2))
            code_text.config(xscrollcommand=h_scroll.set)
        
        # Insert code content
        code_text.insert('1.0', code_block.content)
        code_text.config(state='disabled')
        
        # Apply syntax highlighting if available
        self._apply_syntax_highlighting(code_text, code_block.language)
        
        # Insert frame into chat display
        self.chat_display.window_create('end', window=frame)
        self.chat_display.insert('end', '\n')
        
        # Track code block
        self.code_blocks.append((code_block, frame))
    
    def _insert_code_as_text(self, language: str, content: str):
        """Insert code as formatted text (fallback)"""
        self.chat_display.insert('end', f"\n```{language}\n", 'code')
        self.chat_display.insert('end', content, 'code')
        self.chat_display.insert('end', "\n```\n", 'code')
    
    def _apply_syntax_highlighting(self, text_widget: tk.Text, language: str):
        """Apply basic syntax highlighting"""
        # This is a placeholder - could integrate with pygments
        if language.lower() in ['python', 'py']:
            # Python keywords
            keywords = ['def', 'class', 'import', 'from', 'if', 'else', 'elif',
                       'for', 'while', 'return', 'try', 'except', 'with', 'as']
            
            for keyword in keywords:
                self._highlight_pattern(text_widget, r'\b' + keyword + r'\b', 'keyword')
            
            # Strings
            self._highlight_pattern(text_widget, r'"[^"]*"', 'string')
            self._highlight_pattern(text_widget, r"'[^']*'", 'string')
            
            # Comments
            self._highlight_pattern(text_widget, r'#.*', 'comment')
    
    def _highlight_pattern(self, text_widget: tk.Text, pattern: str, tag: str):
        """Highlight a pattern in the text widget"""
        import re
        
        # Configure tags if not already done
        if tag == 'keyword':
            text_widget.tag_config(tag, foreground='#0000ff')
        elif tag == 'string':
            text_widget.tag_config(tag, foreground='#008000')
        elif tag == 'comment':
            text_widget.tag_config(tag, foreground='#808080')
        
        # Find and tag all matches
        content = text_widget.get('1.0', 'end-1c')
        for match in re.finditer(pattern, content):
            start_idx = f"1.0+{match.start()}c"
            end_idx = f"1.0+{match.end()}c"
            text_widget.tag_add(tag, start_idx, end_idx)
    
    def _copy_code(self, content: str):
        """Copy code to clipboard"""
        try:
            self.chat_display.clipboard_clear()
            self.chat_display.clipboard_append(content)
            # Could show a temporary tooltip here
        except Exception as e:
            print(f"Failed to copy: {e}")
    
    def _save_code(self, code_block: CodeBlock):
        """Save code block to file"""
        # This should trigger the save dialog in the main app
        # For now, just copy to clipboard
        self._copy_code(code_block.content)
    
    def _finalize_message(self):
        """Finalize message display"""
        self.chat_display.insert('end', '\n')
        self.chat_display.see('end')
    
    def clear_display(self):
        """Clear the chat display"""
        self.chat_display.delete('1.0', 'end')
        self.code_blocks.clear()


class MessageFormatter:
    """Formats messages for display"""
    
    @staticmethod
    def format_error_message(error: Exception, context: str = None) -> str:
        """Format an error message for display"""
        if context:
            return f"❌ {context}: {str(error)}"
        return f"❌ Error: {str(error)}"
    
    @staticmethod
    def format_success_message(message: str) -> str:
        """Format a success message"""
        return f"✅ {message}"
    
    @staticmethod
    def format_warning_message(message: str) -> str:
        """Format a warning message"""
        return f"⚠️ {message}"
    
    @staticmethod
    def format_info_message(message: str) -> str:
        """Format an info message"""
        return f"ℹ️ {message}"
    
    @staticmethod
    def truncate_message(message: str, max_length: int = 100) -> str:
        """Truncate a long message"""
        if len(message) <= max_length:
            return message
        return message[:max_length - 3] + "..."