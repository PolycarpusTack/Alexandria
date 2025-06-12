#!/usr/bin/env node

/**
 * Script to set the Alexandria platform to use the modern VSCode/Notion style layout
 */

console.log('Setting Alexandria to use modern layout...');

// This script should be run in the browser console or incorporated into the app
const script = `
// Clear any existing layout preference
localStorage.removeItem('alexandria-layout-mode');

// Set to modern layout
localStorage.setItem('alexandria-layout-mode', 'modern');

console.log('Layout set to modern. Please refresh the page.');
`;

console.log('\nTo apply the modern layout, run this in your browser console:');
console.log('----------------------------------------');
console.log(script);
console.log('----------------------------------------');
console.log('\nAlternatively, the app will use modern layout by default for new users.');