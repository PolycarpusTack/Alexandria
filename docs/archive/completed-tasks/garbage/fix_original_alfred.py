#!/usr/bin/env python3
"""
Fix for the original alfred.py connection_var error
Run this from PowerShell: python fix_original_alfred.py
"""

import os
import sys

# Path to the original alfred.py
alfred_path = r"C:\Projects\alfred\alfred.py"

print(f"Fixing {alfred_path}...")

# Read the file
with open(alfred_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find where to insert the fix
fixed_lines = []
for i, line in enumerate(lines):
    fixed_lines.append(line)
    
    # After finding "def build_ui(self):", add the connection_var initialization
    if 'def build_ui(self):' in line:
        # Check if not already fixed
        if i + 2 < len(lines) and 'connection_var' not in lines[i+2]:
            fixed_lines.append('        # Initialize connection status variable early (fix for refresh_models)\n')
            fixed_lines.append("        self.connection_var = tk.StringVar(value=CONNECTION_STATUS['disconnected'])\n")
            fixed_lines.append('\n')

# Remove the duplicate initialization later
final_lines = []
skip_line = False
for line in fixed_lines:
    # Skip the original connection_var initialization (around line 511)
    if 'self.connection_var = tk.StringVar(value=CONNECTION_STATUS' in line and '# Initialize connection status variable early' not in str(final_lines[-5:]):
        continue
    final_lines.append(line)

# Write the fixed version
output_path = alfred_path.replace('.py', '_fixed.py')
with open(output_path, 'w', encoding='utf-8') as f:
    f.writelines(final_lines)

print(f"Fixed version saved as: {output_path}")
print(f"\nTo run the fixed version:")
print(f"python {output_path}")

# Also create a simple batch file
batch_content = f'@echo off\npython "{output_path}"\npause'
batch_path = alfred_path.replace('.py', '_fixed.bat')
with open(batch_path, 'w') as f:
    f.write(batch_content)
    
print(f"\nOr double-click: {batch_path}")