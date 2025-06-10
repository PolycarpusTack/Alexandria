const { spawn } = require('child_process');

console.log('Testing Alexandria dev startup...\n');
console.log('The fixed migration includes:');
console.log('- Separate trigger functions for alfred_sessions and alfred_templates');
console.log('- Proper foreign key constraints to the users table');
console.log('- Both tables now properly reference user_id from the users table\n');

console.log('Starting dev environment...');
console.log('(Press Ctrl+C to stop)\n');

const dev = spawn('pnpm', ['dev'], {
  stdio: 'inherit',
  shell: true
});

dev.on('error', (error) => {
  console.error('Failed to start:', error);
});

dev.on('exit', (code) => {
  console.log(`Dev process exited with code ${code}`);
});