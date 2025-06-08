#!/usr/bin/env python3
"""
Quick fix for the alfred.py AttributeError
This script patches the connection_var initialization issue
"""

import sys
import os

# Path to your alfred.py
alfred_path = r"C:\Projects\alfred\alfred.py"

print("Fixing alfred.py connection_var error...")

# Read the original file
with open(alfred_path, 'r', encoding='utf-8') as f:
    content = f.read()

# The fix: Initialize connection_var at the start of build_ui method
# Find the build_ui method and add the initialization
content = content.replace(
    'def build_ui(self):\n        """Build the main UI"""',
    '''def build_ui(self):\n        """Build the main UI"""
        # Fix: Initialize connection_var before refresh_models
        import tkinter as tk
        CONNECTION_STATUS = {
            'connected': '🟢 Connected',
            'disconnected': '🔴 Disconnected', 
            'error': '🔴 Error'
        }
        self.connection_var = tk.StringVar(value=CONNECTION_STATUS['disconnected'])'''
)

# Save the fixed version
fixed_path = alfred_path.replace('.py', '_patched.py')
with open(fixed_path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"\n✅ Created fixed version: {fixed_path}")
print(f"\nRun it with: python {fixed_path}")

# Create a simple runner
runner_path = os.path.join(os.path.dirname(alfred_path), "run_alfred_fixed.bat")
with open(runner_path, 'w') as f:
    f.write(f'@echo off\npython "{fixed_path}"\npause')
    
print(f"\nOr double-click: {runner_path}")