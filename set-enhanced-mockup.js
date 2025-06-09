// Script to set the enhanced mockup layout
console.log('Setting Alexandria to use the enhanced mockup layout...');

// This script should be run in the browser console
const script = `
// Clear existing layout preference
localStorage.removeItem('alexandria-layout-mode');

// Set to enhanced-mockup
localStorage.setItem('alexandria-layout-mode', 'enhanced-mockup');

console.log('Layout set to enhanced-mockup. Please refresh the page.');
`;

console.log('\nRun this in your browser console:');
console.log('----------------------------------------');
console.log(script);
console.log('----------------------------------------');
console.log('\nOr visit: http://localhost:4000 and run it there.');