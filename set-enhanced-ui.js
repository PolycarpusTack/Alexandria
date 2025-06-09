/**
 * Script to ensure the enhanced layout is set as default
 * Run this to make sure the new UI is active
 */

// Set the enhanced layout as default
localStorage.setItem('alexandria-layout-mode', 'enhanced');

// Also ensure dark theme is set (looks better with the new UI)
localStorage.setItem('alexandria-theme', 'dark');

console.log('✅ Enhanced layout has been set as default');
console.log('✅ Dark theme has been activated');
console.log('');
console.log('🚀 Refresh the page to see the new UI!');
console.log('');
console.log('Keyboard shortcuts:');
console.log('  ⌘K - Open command palette');
console.log('  ⌘B - Toggle sidebar');
console.log('  ⌘, - Open quick access panel');
console.log('  ⌘⇧T - Toggle theme');
