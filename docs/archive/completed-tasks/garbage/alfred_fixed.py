# This is a simple launcher script to fix and run the original alfred.py
import subprocess
import sys
import os

# Change to the alfred directory
alfred_dir = "/mnt/c/Projects/alfred"

# Create a fixed version by adding connection_var initialization early
fix_code = '''
# Read the original file
with open('/mnt/c/Projects/alfred/alfred.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Add connection_var initialization after "def build_ui(self):"
content = content.replace(
    'def build_ui(self):\\n        """Build the main UI"""',
    'def build_ui(self):\\n        """Build the main UI"""\\n        # Initialize connection status variable early\\n        self.connection_var = tk.StringVar(value=CONNECTION_STATUS[\\'disconnected\\'])\\n'
)

# Remove the duplicate initialization later
lines = content.split('\\n')
fixed_lines = []
skip_next = False
for line in lines:
    if 'self.connection_var = tk.StringVar(value=CONNECTION_STATUS' in line and 'Initialize connection status variable early' not in content[:content.find(line)]:
        continue
    fixed_lines.append(line)

# Save as a temporary fixed version
with open('/mnt/c/Projects/alfred/alfred_temp_fixed.py', 'w', encoding='utf-8') as f:
    f.write('\\n'.join(fixed_lines))
'''

# Execute the fix
subprocess.run([sys.executable, '-c', fix_code])

# Now run the fixed version
os.chdir(alfred_dir)
subprocess.run([sys.executable, 'alfred_temp_fixed.py'])