/**
 * Script to activate the exact mockup design
 */

// Set the mockup layout as default
localStorage.setItem('alexandria-layout-mode', 'mockup');

// Ensure dark theme is set
localStorage.setItem('alexandria-theme', 'dark');

// Also set dark class on body
document.body.classList.add('dark');

console.log('✅ Mockup layout has been activated');
console.log('✅ Dark theme has been set');
console.log('');
console.log('🎨 The Alexandria Platform now uses the exact mockup design!');
console.log('');
console.log('🚀 Refresh the page to see the changes');
